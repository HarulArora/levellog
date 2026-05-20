import MediaDetail from '../models/MediaDetail.js';
import apiClient from './apiClient.js';
import { shortPlatform, normalizeCover } from './helpers.js';
import { getAccessToken } from './igdb.js';
import logger from './logger.js';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const TMDB_BASE_URL = 'https://api.tmdb.org/3';
const TMDB_GENRES = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama',
    10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
    878: 'Sci-Fi', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
    10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
    10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

// In-memory track of active background revalidations to prevent race conditions or double fetching
const activeRevalidations = new Map();

// Helper: Clean MAL cover url
const cleanMALCover = (url) => {
    if (!url) return '';
    let cleaned = url.replace(/\/r\/\d+x\d+\//g, '/');
    cleaned = cleaned.split('?')[0];
    if (cleaned && !cleaned.startsWith('http')) {
        cleaned = `https://cdn.myanimelist.net${cleaned.startsWith('/') ? '' : '/'}${cleaned}`;
    }
    if (cleaned.includes('cdn.myanimelist.netimages')) {
        cleaned = cleaned.replace('cdn.myanimelist.netimages', 'cdn.myanimelist.net/images');
    }
    return cleaned;
};

// Helper: Fetch cover image for related items
const fetchRelationCover = async (type, id) => {
    try {
        const res = await apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}`, { retry: 2, retryDelay: 1000 });
        return res.data.data.images?.webp?.large_image_url || res.data.data.images?.jpg?.large_image_url;
    } catch (e) { return null; }
};

// Helper: Format Jikan Items
const formatJikanItem = (item, type) => ({
    id: item.mal_id,
    externalId: item.mal_id,
    title: item.title_english || item.title || item.name,
    cover: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url,
    genre: item.genres?.[0]?.name || 'Media',
    genres: item.genres?.map(g => g.name) || [],
    year: item.aired?.prop?.from?.year || item.published?.prop?.from?.year || item.year || (item.aired?.from && !isNaN(new Date(item.aired.from).getFullYear()) ? new Date(item.aired.from).getFullYear() : null),
    score: item.score,
    summary: item.synopsis,
    status: item.status,
    airingStatus: item.status,
    episodes: item.episodes,
    chapters: item.chapters,
    volumes: item.volumes,
    studios: item.studios?.map(s => s.name).join(', '),
    producers: item.producers?.map(p => p.name).join(', '),
    source: item.source,
    rating: item.rating,
    type: type
});

// Helper: Format Movie/TV Items
const formatMovieItem = (item, type) => {
    const genreName = 
        (item.genre_ids?.[0] ? TMDB_GENRES[item.genre_ids[0]] : null) || 
        (item.genres?.[0]?.name) || 
        (typeof item.genres?.[0] === 'string' ? item.genres[0] : null) ||
        item.genre;

    const fallbackType = type === 'movie' ? 'Movie' : 'TV Show';

    return {
        id: item.id,
        externalId: item.id,
        title: item.title || item.name,
        cover: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        genre: genreName || fallbackType,
        genres: genreName ? [genreName] : [fallbackType],
        year: (item.release_date || item.first_air_date || '').split('-')[0],
        avgRating: parseFloat((item.vote_average || item.score || 0).toFixed(1)),
        summary: item.overview,
        production: item.production_companies?.map(c => c.name).join(', '),
        language: item.original_language?.toUpperCase(),
        status: item.status,
        type: type,
        totalEpisodes: item.number_of_episodes || 0,
        totalSeasons: item.number_of_seasons || 0
    };
};

const isAnime = (item) => {
    const isAnimation = item.genre_ids?.includes(16) || item.genres?.some(g => g.id === 16);
    const isJapanese = item.original_language === 'ja' || (item.origin_country && item.origin_country.includes('JP'));
    return isAnimation && isJapanese;
};

// AniList English Titles Resolver
const fetchAnilistEnglishTitles = async (malIds, type = 'ANIME') => {
    if (!malIds || malIds.length === 0) return {};
    const aniType = type.toUpperCase() === 'MANGA' ? 'MANGA' : 'ANIME';
    const query = `
    query ($idMal_in: [Int], $type: MediaType) {
        Page(page: 1, perPage: 50) {
            media(idMal_in: $idMal_in, type: $type) {
                idMal
                title { english romaji }
                coverImage { large }
                seasonYear
                startDate { year }
            }
        }
    }`;

    try {
        const response = await apiClient.post('https://graphql.anilist.co', {
            query,
            variables: { idMal_in: malIds, type: aniType }
        });
        const mapping = {};
        response.data.data.Page.media.forEach(m => {
            mapping[m.idMal] = {
                title: m.title.english || m.title.romaji,
                cover: m.coverImage.large,
                year: m.seasonYear || m.startDate?.year
            };
        });
        return mapping;
    } catch (e) {
        logger.error('AniList Titles Error in cache: ' + e.message);
        return {};
    }
};

// AniList Full Detail API Fetcher
const fetchAnilistFullDetail = async (idMal, type = 'anime') => {
    try {
        if (!idMal || isNaN(parseInt(idMal))) {
            logger.error('Invalid idMal passed to fetchAnilistFullDetail: ' + idMal);
            return null;
        }

        const aniType = type.toUpperCase() === 'MANGA' ? 'MANGA' : 'ANIME';
        const query = `
        query ($idMal: Int, $type: MediaType) {
          Media(idMal: $idMal, type: $type) {
            id
            idMal
            title { english romaji }
            description
            coverImage { extraLarge large }
            bannerImage
            genres
            averageScore
            status
            seasonYear
            startDate {
              year
            }
            source
            studios(isMain: true) {
              nodes {
                name
              }
            }
            staff(perPage: 8) {
              edges {
                role
                node {
                  name { full }
                }
              }
            }
            episodes
            chapters
            volumes
            format
            trailer { id site }
            externalLinks { url site }
            characters(perPage: 24) {
              edges {
                role
                node {
                  name { full }
                  image { large }
                  id
                  favourites
                }
                voiceActors(language: JAPANESE) {
                  name { full }
                  image { large }
                }
              }
            }
            relations {
              edges {
                relationType
                node {
                  idMal
                  type
                  title { english romaji }
                  coverImage { large }
                }
              }
            }
            recommendations(perPage: 6) {
              nodes {
                mediaRecommendation {
                  idMal
                  title { english romaji }
                  coverImage { large }
                }
              }
            }
          }
        }
        `;

        const response = await apiClient.post('https://graphql.anilist.co', {
            query,
            variables: { idMal: parseInt(idMal), type: aniType }
        });

        const data = response.data.data.Media;
        if (!data) return null;

        const anime = {
            id: data.idMal,
            externalId: data.idMal,
            anilistId: data.id,
            title: data.title.english || data.title.romaji,
            summary: data.description,
            cover: data.coverImage.extraLarge || data.coverImage.large,
            banner: data.bannerImage,
            genres: data.genres,
            genre: data.genres?.[0] || 'Media',
            score: data.averageScore ? data.averageScore / 10 : null,
            status: data.status,
            year: data.seasonYear || data.startDate?.year,
            source: data.source?.replace(/_/g, ' '),
            studios: data.studios?.nodes?.length > 0 
                ? data.studios.nodes.map(s => s.name).join(', ') 
                : data.staff?.edges?.filter(e => {
                    const role = e.role.toLowerCase();
                    return role.includes('story') || role.includes('art') || role.includes('original creator');
                }).map(e => e.node.name.full).filter((v, i, a) => a.indexOf(v) === i).join(', '),
            episodes: data.episodes,
            chapters: data.chapters,
            volumes: data.volumes,
            type: type,
            format: data.format,
            trailer: data.trailer?.site === 'youtube' ? data.trailer.id : null,
            externalLinks: data.externalLinks.map(l => ({ url: l.url, site: l.site })),
            streamingLinks: data.externalLinks.map(l => ({ url: l.url, name: l.site })),
            cast: data.characters.edges.map(e => ({
                name: e.node.name.full,
                role: e.role,
                image: e.node.image.large,
                favorites: e.node.favourites,
                va: e.voiceActors?.[0] ? { 
                    name: e.voiceActors[0].name.full, 
                    image: e.voiceActors[0].image.large 
                } : null
            })),
            relations: data.relations.edges.map(e => ({
                relation: e.relationType,
                items: [{
                    id: e.node.idMal,
                    name: e.node.title.english || e.node.title.romaji,
                    type: e.node.type?.toLowerCase(),
                    cover: e.node.coverImage?.large
                }]
            })),
            similar: data.recommendations.nodes.map(n => ({
                id: n.mediaRecommendation?.idMal,
                title: n.mediaRecommendation?.title.english || n.mediaRecommendation?.title.romaji,
                cover: n.mediaRecommendation?.coverImage?.large
            })).filter(i => i.id),
            screenshots: []
        };

        return anime;
    } catch (e) {
        logger.error('AniList Full Detail Cache Fetcher Error: ' + e.message);
        return null;
    }
};

/**
 * Synchronously or in background revalidate a media item, saving the result in persistent MongoDB collection.
 */
export const revalidateMediaDetail = async (externalId, type) => {
    const id = parseInt(externalId);
    let detail = null;

    try {
        if (type === 'anime' || type === 'manga') {
            // 1. Try AniList First
            detail = await fetchAnilistFullDetail(id, type);

            // 2. Jikan Fallback if AniList misses
            if (!detail) {
                logger.info(`AniList cache miss/failure for ${type} ${id}, running Jikan fallback...`);
                const requestConfig = { retry: 3, retryDelay: 1000 };
                const isManga = type === 'manga';

                const fetches = [
                    apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/full`, requestConfig),
                    apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/pictures`, requestConfig).catch(() => ({ data: { data: [] } })),
                    apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/recommendations`, requestConfig).catch(() => ({ data: { data: [] } })),
                    apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/characters`, requestConfig).catch(() => ({ data: { data: [] } }))
                ];

                if (!isManga) {
                    fetches.push(
                        apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/staff`, requestConfig).catch(() => ({ data: { data: [] } })),
                        apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/streaming`, requestConfig).catch(() => ({ data: { data: [] } })),
                        apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/external`, requestConfig).catch(() => ({ data: { data: [] } }))
                    );
                }

                const results = await Promise.all(fetches);
                const mainRes = results[0];
                const picsRes = results[1];
                const recsRes = results[2];
                const charRes = results[3];

                let staffRes = { data: { data: [] } };
                let streamingRes = { data: { data: [] } };
                let externalRes = { data: { data: [] } };

                if (!isManga) {
                    staffRes = results[4];
                    streamingRes = results[5];
                    externalRes = results[6];
                }

                const rawData = mainRes.data.data;
                detail = formatJikanItem(rawData, type);
                detail.streamingLinks = streamingRes.data.data || [];
                detail.externalLinks = externalRes.data.data || [];

                // Extract Relations
                detail.relations = rawData.relations?.map(rel => ({
                    relation: rel.relation,
                    items: rel.entry.map(e => ({
                        id: e.mal_id,
                        name: e.name,
                        type: e.type
                    }))
                })) || [];

                // Extract Staff
                detail.staff = staffRes.data.data?.slice(0, 8).map(s => ({
                    name: s.person.name,
                    positions: s.positions,
                    image: s.person.images?.jpg?.image_url
                })) || [];

                detail.screenshots = picsRes.data.data?.map(p => p.webp?.large_image_url || p.jpg?.large_image_url).slice(0, 8) || [];

                detail.cast = charRes.data.data?.slice(0, 24).map(c => {
                    const va = c.voice_actors?.find(v => v.language === 'Japanese');
                    return {
                        name: c.character.name,
                        role: c.role,
                        image: c.character.images?.webp?.image_url || c.character.images?.jpg?.image_url,
                        favorites: c.character.favorites,
                        va: va ? { name: va.person.name, image: va.person.images?.jpg?.image_url } : null
                    };
                }) || [];

                detail.similar = recsRes.data.data?.slice(0, 6).map(r => ({
                    id: r.entry.mal_id,
                    title: r.entry.title,
                    cover: r.entry.images?.webp?.large_image_url || r.entry.images?.jpg?.large_image_url
                })) || [];
            }

            // 3. TMDB Provider Integration (Only Anime, skip Manga)
            if (type !== 'manga') {
                try {
                    const animeTitle = detail.title;
                    const tmdbSearch = await apiClient.get(`${TMDB_BASE_URL}/search/multi`, {
                        params: { 
                            api_key: process.env.TMDB_API_KEY,
                            query: animeTitle, 
                            include_adult: false 
                        },
                        retry: 2
                    });

                    const bestMatch = tmdbSearch.data.results?.find(r => 
                        (r.media_type === 'tv' || r.media_type === 'movie') && 
                        (r.original_language === 'ja' || r.name === animeTitle || r.title === animeTitle)
                    );

                    if (bestMatch) {
                        const providersRes = await apiClient.get(`${TMDB_BASE_URL}/${bestMatch.media_type}/${bestMatch.id}/watch/providers`, {
                            params: { api_key: process.env.TMDB_API_KEY }
                        });
                        detail.watchProviders = providersRes.data.results || {};
                    }
                } catch (tmdbErr) {
                    logger.error('TMDB Watch Provider fetch failed in Cache: ' + tmdbErr.message);
                    detail.watchProviders = {};
                }
            } else {
                detail.watchProviders = {};
            }

            // 4. Resolve covers and titles for relations and similar items using fetchAnilistEnglishTitles
            const relatedIds = [];
            detail.relations.forEach(r => r.items.forEach(i => relatedIds.push(i.id)));
            detail.similar.forEach(i => relatedIds.push(i.id));

            if (relatedIds.length > 0) {
                const relatedEnglish = await fetchAnilistEnglishTitles(relatedIds, type);
                detail.relations.forEach(r => r.items.forEach(i => {
                    if (relatedEnglish[i.id]) {
                        i.name = relatedEnglish[i.id].title;
                        i.cover = relatedEnglish[i.id].cover;
                    }
                }));
                detail.similar.forEach(i => {
                    if (relatedEnglish[i.id]) {
                        i.title = relatedEnglish[i.id].title;
                        i.cover = relatedEnglish[i.id].cover;
                    }
                });
            }
        } 
        else if (type === 'movie' || type === 'tv') {
            const params = { api_key: process.env.TMDB_API_KEY, append_to_response: 'videos,images,recommendations,credits,watch/providers' };
            const response = await apiClient.get(`${TMDB_BASE_URL}/${type}/${id}`, { params, retry: 3, retryDelay: 1000 });
            const rawData = response.data;

            detail = formatMovieItem(rawData, type);
            detail.watchProviders = rawData['watch/providers']?.results || {};
            detail.genres = rawData.genres?.map(g => g.name) || [];
            detail.runtime = rawData.runtime;
            detail.totalSeasons = rawData.number_of_seasons || 0;
            detail.totalEpisodes = rawData.number_of_episodes || 0;
            detail.seasonsCount = detail.totalSeasons;
            detail.trailer = rawData.videos?.results?.find(v => v.type === 'Trailer')?.key || 
                            rawData.videos?.results?.find(v => v.type === 'Teaser')?.key ||
                            rawData.videos?.results?.[0]?.key;
            detail.screenshots = rawData.images?.backdrops?.slice(0, 8).map(img => `https://image.tmdb.org/t/p/original${img.file_path}`) || [];
            detail.cast = rawData.credits?.cast?.slice(0, 24).map(c => ({
                name: c.name,
                role: c.character,
                image: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
                popularity: c.popularity
            })) || [];
            detail.similar = rawData.recommendations?.results
                ?.filter(item => !isAnime(item))
                ?.slice(0, 6).map(r => ({
                id: r.id,
                title: r.title || r.name,
                cover: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null
            })) || [];
        } 
        else if (type === 'game') {
            const token = await getAccessToken();
            const response = await apiClient.post('https://api.igdb.com/v4/games', `
            fields name, cover.url, summary, storyline, genres.name,
                   platforms.name, first_release_date,
                   rating, rating_count, aggregated_rating,
                   involved_companies.company.name,
                   involved_companies.developer,
                   involved_companies.publisher,
                   game_engines.name,
                   game_modes.name,
                   age_ratings.rating, age_ratings.category,
                   keywords.name,
                   similar_games.name, similar_games.cover.url,
                   similar_games.rating,
                   similar_games.genres.name,
                   videos.video_id, screenshots.url;
            where id = ${id};
            `, {
                headers: {
                    'Client-ID': process.env.IGDB_CLIENT_ID,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'text/plain'
                },
                retry: 3,
                retryDelay: 1000
            });

            const data = response.data;
            if (!data || data.length === 0) return null;

            const g = data[0];
            const developer = g.involved_companies?.find(c => c.developer)?.company?.name || null;
            const publisher = g.involved_companies?.find(c => c.publisher)?.company?.name || null;

            const ageRatingMap = {
                1: 'RP', 2: 'EC', 3: 'E', 4: 'E10+',
                5: 'T', 6: 'M', 7: 'AO',
                8: '3', 9: '7', 10: '12', 11: '16', 12: '18'
            };
            const ageRating = g.age_ratings?.[0]
                ? ageRatingMap[g.age_ratings[0].rating] || null
                : null;

            const cover = normalizeCover(g.cover?.url, 't_cover_big_2x');
            const screenshots = g.screenshots?.map(s => normalizeCover(s.url, 't_screenshot_big')) || [];
            const similarGames = g.similar_games?.slice(0, 6).map(sg => ({
                id: sg.id,
                title: sg.name,
                cover: normalizeCover(sg.cover?.url),
                rating: sg.rating ? (sg.rating / 10).toFixed(1) : null
            })) || [];

            const platforms = g.platforms?.map(p => shortPlatform(p.name) || p.name) || [];

            detail = {
                id: g.id,
                title: g.name,
                cover,
                summary: g.summary || '',
                storyline: g.storyline || '',
                genre: g.genres?.[0]?.name || 'Unknown',
                genres: g.genres?.map(x => x.name) || [],
                platforms,
                releaseYear: g.first_release_date
                    ? new Date(g.first_release_date * 1000).getFullYear()
                    : null,
                criticScore: g.aggregated_rating ? Math.round(g.aggregated_rating) : null,
                userScore: g.rating ? (g.rating / 10).toFixed(1) : null,
                ratingCount: g.rating_count || 0,
                developer,
                publisher,
                engine: g.game_engines?.[0]?.name || null,
                modes: g.game_modes?.map(m => m.name).join(', ') || null,
                ageRating,
                keywords: g.keywords?.slice(0, 10).map(k => k.name) || [],
                themes: g.themes?.map(t => t.name) || [],
                similarGames,
                screenshots,
                videoId: g.videos?.[0]?.video_id || null
            };
        }

        if (detail) {
            // Upsert the results into MongoDB collection
            const updatedDoc = await MediaDetail.findOneAndUpdate(
                { externalId: String(id), type },
                { data: detail, lastFetchedAt: new Date(), lastAccessedAt: new Date() },
                { upsert: true, new: true }
            );
            return updatedDoc.data;
        }

        return null;
    } catch (error) {
        logger.error(`Revalidation error for ${type} id ${id}: ` + error.stack);
        throw error;
    }
};

/**
 * Trigger background revalidation of a stale cache entry, pooled to prevent concurrent duplicate fetching.
 */
const triggerBackgroundRevalidation = (externalId, type) => {
    const key = `${type}-${externalId}`;
    if (activeRevalidations.has(key)) return;

    logger.info(`Triggering background revalidation for stale ${type} ${externalId}`);
    const promise = revalidateMediaDetail(externalId, type)
        .then(() => {
            logger.info(`Successfully background revalidated ${type} ${externalId}`);
        })
        .catch(err => {
            logger.error(`Background revalidation failed for ${type} ${externalId}: ` + err.message);
        })
        .finally(() => {
            activeRevalidations.delete(key);
        });

    activeRevalidations.set(key, promise);
};

/**
 * Primary O(1) entry-point: Load detail from MongoDB cache, serve instantly, revalidate out-of-band.
 */
export const getMediaDetail = async (externalId, type) => {
    try {
        const cached = await MediaDetail.findOne({ externalId: String(externalId), type });

        if (cached) {
            // High-Scale Write Optimization: Only update lastAccessedAt if the last access was more than 24 hours ago.
            // This reduces write operations on popular items by 99.9%+ at high traffic scales.
            const lastAccess = cached.lastAccessedAt ? new Date(cached.lastAccessedAt).getTime() : 0;
            if (Date.now() - lastAccess > 24 * 60 * 60 * 1000) {
                MediaDetail.updateOne({ _id: cached._id }, { $set: { lastAccessedAt: new Date() } }).catch(err => {
                    logger.error('Failed to update lastAccessedAt: ' + err.message);
                });
            }

            // 24 Hour stale limit
            const isStale = (Date.now() - new Date(cached.lastFetchedAt).getTime()) > 24 * 60 * 60 * 1000;
            if (isStale) {
                // Out-of-band revalidation, completely non-blocking for user!
                triggerBackgroundRevalidation(externalId, type);
            }
            return cached.data;
        }

        // Cache Miss: Perform synchronous query & update
        logger.info(`Cache miss for ${type} ${externalId}. Fetching synchronously...`);
        return await revalidateMediaDetail(externalId, type);
    } catch (error) {
        logger.error(`getMediaDetail error for ${type} ${externalId}: ` + error.message);
        // Fallback: Try a synchronous fetch direct
        return await revalidateMediaDetail(externalId, type);
    }
};
