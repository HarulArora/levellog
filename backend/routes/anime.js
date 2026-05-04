import express from 'express';
import mongoose from 'mongoose';
import apiClient from '../utils/apiClient.js';
import { LRUCache } from 'lru-cache';
import AnimeEntry from '../models/AnimeEntry.js';
import AnimeComment from '../models/AnimeComment.js';
import AnimeCommentLike from '../models/AnimeCommentLike.js';
import AnimeLike from '../models/AnimeLike.js';
import AnimeWishlist from '../models/AnimeWishlist.js';
import MediaStats from '../models/MediaStats.js';
import Ranking from '../models/Ranking.js';
import { protect, protectOptional } from '../middleware/auth.js';
import { awardXP, deductXP } from '../utils/xp.js';
import { updateMediaStats, getBulkStats } from '../utils/stats.js';
import { logEngagement } from '../utils/engagement.js';
import { withRetryTransaction } from '../utils/transaction.js';

const router = express.Router();
const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const TMDB_BASE_URL = 'http://api.themoviedb.org/3';

const jikanCache = new LRUCache({
    max: 200,
    ttl: 1000 * 60 * 60 * 12 // 12 hours
});

const fetchMediaStats = getBulkStats;


const fetchRelationCover = async (type, id) => {
    try {
        const res = await apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}`, { retry: 2, retryDelay: 1000 });
        return res.data.data.images?.webp?.large_image_url || res.data.data.images?.jpg?.large_image_url;
    } catch (e) { return null; }
};

const formatJikanItem = (item, type) => ({
    id: item.mal_id,
    externalId: item.mal_id,
    title: item.title_english || item.title || item.name,
    cover: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url,
    genre: item.genres?.[0]?.name || 'Media',
    genres: item.genres?.map(g => g.name) || [],
    year: item.aired?.prop?.from?.year || item.published?.prop?.from?.year || item.year,
    score: item.score,
    summary: item.synopsis,
    status: item.status,
    airingStatus: item.status, 
    episodes: item.episodes,
    chapters: item.chapters,
    studios: item.studios?.map(s => s.name).join(', '),
    producers: item.producers?.map(p => p.name).join(', '),
    source: item.source,
    rating: item.rating,
    type: type
});

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
                cover: m.coverImage.large
            };
        });
        return mapping;
    } catch (e) {
        console.error('AniList Titles Error:', e.message);
        return {};
    }
};

const fetchAnilistFullDetail = async (idMal, type = 'anime') => {
    try {
        if (!idMal || isNaN(parseInt(idMal))) {
            console.error('Invalid idMal passed to fetchAnilistFullDetail:', idMal);
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
            screenshots: [] // AniList doesn't provide screenshots directly in this query
        };

        return anime;
    } catch (e) {
        console.error('AniList Full Detail Error:', e.message);
        return null;
    }
};

// ── ASYNC COVER FETCH (For speed optimization) ──
router.get('/cover/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const cacheKey = `cover-${type}-${id}`;
        if (jikanCache.has(cacheKey)) return res.json({ success: true, cover: jikanCache.get(cacheKey) });

        const cover = await fetchRelationCover(type, id);
        if (cover) jikanCache.set(cacheKey, cover);
        res.json({ success: true, cover });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// ── HOME ──
router.get('/home', async (req, res) => {
    try {
        const { type = 'anime' } = req.query;
        const cacheKey = `home-${type}-v2`;
        if (jikanCache.has(cacheKey)) return res.json({ success: true, ...jikanCache.get(cacheKey) });

        const [trendingRankings, topRatedRankings, upcomingRankings] = await Promise.all([
            Ranking.find({ contentType: type, rankType: 'trending' }).sort({ rankPosition: 1 }).limit(15),
            Ranking.find({ contentType: type, rankType: 'top_rated' }).sort({ rankPosition: 1 }).limit(15),
            type === 'anime' ? Ranking.find({ contentType: type, rankType: 'coming_soon' }).sort({ rankPosition: 1 }).limit(15) : []
        ]);

        let trending = trendingRankings.map(r => ({
            mal_id: parseInt(r.contentId),
            externalId: parseInt(r.contentId),
            title: r.title,
            cover: r.cover,
            year: r.year,
            genres: r.genres || [],
            type: type
        }));

        let topRated = topRatedRankings.map(r => ({
            mal_id: parseInt(r.contentId),
            externalId: parseInt(r.contentId),
            title: r.title,
            cover: r.cover,
            year: r.year,
            genres: r.genres || [],
            type: type
        }));

        let upcoming = upcomingRankings.map(r => ({
            mal_id: parseInt(r.contentId),
            externalId: parseInt(r.contentId),
            title: r.title,
            cover: r.cover,
            year: r.year,
            genres: r.genres || [],
            type: type
        }));

        // 4. Backfill/Fallback for Trending/Top/Upcoming if Ranking has less than 15 items
        if (trending.length < 15 || topRated.length < 15 || upcoming.length < 15) {
            const [trendFallback, topFallback, soonFallback] = await Promise.all([
                trending.length < 15 ? apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, { retry: 3, params: { limit: 25, filter: type === 'manga' ? 'publishing' : 'airing', sfw: true } }).catch(() => ({ data: { data: [] } })) : { data: { data: [] } },
                topRated.length < 15 ? apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, { retry: 3, params: { limit: 25, filter: 'bypopularity', sfw: true } }).catch(() => ({ data: { data: [] } })) : { data: { data: [] } },
                upcoming.length < 15 ? apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, { retry: 3, params: { limit: 25, filter: 'upcoming', sfw: true } }).catch(() => ({ data: { data: [] } })) : { data: { data: [] } }
            ]);

            const mergeUnique = (existing, fetchedRaw) => {
                const fetched = (fetchedRaw || []).map(item => formatJikanItem(item, type));
                const ids = new Set(existing.map(i => i.externalId));
                const merged = [...existing];
                for (const item of fetched) {
                    if (!ids.has(item.externalId) && merged.length < 15) {
                        merged.push(item);
                        ids.add(item.externalId);
                    }
                }
                return merged;
            };

            if (trending.length < 15) trending = mergeUnique(trending, trendFallback.data?.data);
            if (topRated.length < 15) topRated = mergeUnique(topRated, topFallback.data?.data);
            if (upcoming.length < 15) upcoming = mergeUnique(upcoming, soonFallback.data?.data);
        }

        // Aggregate stats
        const allIds = [...trending, ...topRated, ...upcoming].map(i => i.externalId);
        const [stats, englishTitles] = await Promise.all([
            fetchMediaStats(allIds, type),
            fetchAnilistEnglishTitles(allIds, type)
        ]);

        // Standardize English Titles and Deduplicate
        const finalizeList = (list) => {
            const seen = new Set();
            return list.map(item => {
                const meta = englishTitles[item.externalId];
                if (meta) {
                    item.title = meta.title;
                    item.cover = meta.cover;
                }
                return item;
            }).filter(item => {
                if (seen.has(item.externalId)) return false;
                seen.add(item.externalId);
                return true;
            });
        };

        trending = finalizeList(trending);
        topRated = finalizeList(topRated);
        upcoming = finalizeList(upcoming);

        const sections = [
            { title: `Trending ${type === 'manga' ? 'Manga' : 'Anime'}`, items: trending },
            { title: `Top Rated ${type === 'manga' ? 'Manga' : 'Anime'}`, items: topRated },
            { title: `${type === 'manga' ? 'Upcoming Manga' : 'Upcoming Anime'}`, items: upcoming }
        ];

        const result = { sections, stats };
        jikanCache.set(cacheKey, result);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Anime Home Error:', error.message);
        res.status(500).json({ success: false, message: 'Home failed' });
    }
});

// ── SEARCH ──
router.get('/search', protectOptional, async (req, res) => {
    try {
        const { q, type = 'anime', limit = 24, page = 1 } = req.query;
        if (!q) return res.status(400).json({ success: false, message: 'Query is required' });

        const cacheKey = `search-${type}-${q}-${page}-${limit}`;
        if (jikanCache.has(cacheKey)) return res.json({ success: true, ...jikanCache.get(cacheKey) });

        const response = await apiClient.get(`${JIKAN_BASE_URL}/${type}`, {
            params: { q, limit: parseInt(limit), page: parseInt(page), sfw: true },
            retry: 3,
            retryDelay: 1000
        });

        let results = (response.data?.data || []).map(item => formatJikanItem(item, type));
        const pagination = response.data?.pagination || {};
        // Resolve English Titles and Deduplicate
        const englishTitles = await fetchAnilistEnglishTitles(results.map(i => i.externalId), type);
        const seen = new Set();
        results = results.map(item => {
            const meta = englishTitles[item.externalId];
            if (meta) {
                item.title = meta.title;
                item.cover = meta.cover;
            }
            return item;
        }).filter(item => {
            if (seen.has(item.externalId)) return false;
            seen.add(item.externalId);
            return true;
        });

        const stats = await fetchMediaStats(results.map(r => r.externalId), type);
        // ── FETCH USER RATINGS IF AUTHENTICATED ──
        let userRatings = {}
        if (req.user && results.length > 0) {
            const userEntries = await AnimeEntry.find({
                userId: req.user._id,
                externalId: { $in: results.map(r => r.externalId) },
                type
            }).select('externalId rating')
            userEntries.forEach(e => {
                if (e.rating > 0) userRatings[e.externalId] = e.rating
            })
        }

        const result = { 
            results, 
            stats, 
            userRatings, 
            totalPages: pagination.last_visible_page || 1, 
            total: pagination.items?.total || 0 
        };
        jikanCache.set(cacheKey, result);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Anime Search Error:', error.message);
        res.status(500).json({ success: false, message: 'Search failed' });
    }
});

// ── DISCOVER ──
router.get('/discover', async (req, res) => {
    try {
        const { type = 'anime', genre, page = 1, limit = 24 } = req.query;
        const cacheKey = `discover-v2-${type}-${genre || 'all'}-${page}`;
        
        if (jikanCache.has(cacheKey)) {
            return res.json({ success: true, ...jikanCache.get(cacheKey) });
        }

        const params = {
            page: parseInt(page),
            limit: parseInt(limit),
            order_by: 'popularity',
            sort: 'asc',
            sfw: true // Filter out explicit content
        };

        if (genre) {
            if (['movie', 'ova', 'special', 'tv'].includes(genre)) {
                params.type = genre;
            } else {
                params.genres = genre;
            }
        }

        const response = await apiClient.get(`${JIKAN_BASE_URL}/${type}`, { 
            params, 
            retry: 3, 
            retryDelay: 2000 
        });
        
        let results = (response.data?.data || []).map(item => formatJikanItem(item, type));
        
        // Resolve English Titles and Deduplicate
        const englishTitles = await fetchAnilistEnglishTitles(results.map(i => i.externalId), type);
        const seen = new Set();
        results = results.map(item => {
            const meta = englishTitles[item.externalId];
            if (meta) {
                item.title = meta.title;
                item.cover = meta.cover;
            }
            return item;
        }).filter(item => {
            if (seen.has(item.externalId)) return false;
            seen.add(item.externalId);
            return true;
        });

        const stats = await fetchMediaStats(results.map(r => r.externalId), type);
        const result = { 
            items: results, 
            stats,
            totalPages: response.data?.pagination?.last_visible_page || 1,
            total: response.data?.pagination?.items?.total || results.length
        };

        jikanCache.set(cacheKey, result);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Anime Discover Error:', error.message);
        res.status(500).json({ success: false, message: 'Discover failed' });
    }
});

// ── ACTIVITY ──
router.get('/activity/:userId', protect, async (req, res) => {
    try {
        const entries = await AnimeEntry.find({ userId: req.params.userId })
            .select('title cover status rating episodesWatched chaptersRead externalId type createdAt updatedAt')
            .sort({ updatedAt: -1 })
            .limit(20)
            .lean();
        
        const activity = [];
        entries.forEach(item => {
            const itemInfo = { title: item.title, cover: item.cover, id: item._id, externalId: item.externalId, mediaType: item.type };

            if (item.status === 'completed') {
                activity.push({ type: 'completed', anime: itemInfo, rating: item.rating > 0 ? item.rating : null, time: item.updatedAt });
            } else if (item.status === 'playing') {
                activity.push({ type: 'playing', anime: itemInfo, time: item.updatedAt });
            } else if (item.status === 'dropped') {
                activity.push({ type: 'dropped', anime: itemInfo, episodesWatched: item.episodesWatched, time: item.updatedAt });
            } else if (item.status === 'planned') {
                activity.push({ type: 'planned', anime: itemInfo, time: item.createdAt });
            } else if (item.status === 'paused') {
                activity.push({ type: 'paused', anime: itemInfo, time: item.updatedAt });
            }

            if (item.rating > 0 && item.status !== 'completed') {
                activity.push({ type: 'rated', anime: itemInfo, rating: item.rating, time: item.updatedAt });
            }
        });

        activity.sort((a, b) => new Date(b.time) - new Date(a.time));
        res.json({ success: true, activity: activity.slice(0, 20) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch activity' });
    }
});

// ── DETAIL ──
router.get('/detail/:id', protectOptional, async (req, res) => {
    try {
        const { id } = req.params;
        const { type = 'anime' } = req.query;
        const userId = req.user?._id;

        const cacheKey = `detail-v14-${type}-${id}`; // Bumped version to v14
        let anime = jikanCache.get(cacheKey);

        if (!anime) {
            // ── TRY ANILIST FIRST ──
            anime = await fetchAnilistFullDetail(id, type);

            if (!anime) {
                console.log(`AniList missed for ${type} ${id}, falling back to Jikan...`);
                const requestConfig = { retry: 3, retryDelay: 1000 };
                const [mainRes, picsRes, recsRes, videoRes, charRes, staffRes, streamingRes, externalRes] = await Promise.all([
                    apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/full`, requestConfig),
                    apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/pictures`, requestConfig).catch(() => ({ data: { data: [] } })),
                    apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/recommendations`, requestConfig).catch(() => ({ data: { data: [] } })),
                    apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/videos`, requestConfig).catch(() => ({ data: { data: {} } })),
                    apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/characters`, requestConfig).catch(() => ({ data: { data: [] } })),
                    apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/staff`, requestConfig).catch(() => ({ data: { data: [] } })),
                    apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/streaming`, requestConfig).catch(() => ({ data: { data: [] } })),
                    apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/external`, requestConfig).catch(() => ({ data: { data: [] } }))
                ]);

                const rawData = mainRes.data.data;
                anime = formatJikanItem(rawData, type);
                anime.streamingLinks = streamingRes.data.data || [];
                anime.externalLinks = externalRes.data.data || [];
                
                // Extract Relations
                anime.relations = rawData.relations?.map(rel => ({
                    relation: rel.relation,
                    items: rel.entry.map(e => ({
                        id: e.mal_id,
                        name: e.name,
                        type: e.type
                    }))
                })) || [];

                // Extract Staff
                anime.staff = staffRes.data.data?.slice(0, 8).map(s => ({
                    name: s.person.name,
                    positions: s.positions,
                    image: s.person.images?.jpg?.image_url
                })) || [];

                anime.screenshots = picsRes.data.data?.map(p => p.webp?.large_image_url || p.jpg?.large_image_url).slice(0, 8) || [];
                
                anime.cast = charRes.data.data?.slice(0, 24).map(c => {
                    const va = c.voice_actors?.find(v => v.language === 'Japanese');
                    return {
                        name: c.character.name,
                        role: c.role,
                        image: c.character.images?.webp?.image_url || c.character.images?.jpg?.image_url,
                        favorites: c.character.favorites,
                        va: va ? { name: va.person.name, image: va.person.images?.jpg?.image_url } : null
                    };
                }) || [];

                anime.similar = recsRes.data.data?.slice(0, 6).map(r => ({
                    id: r.entry.mal_id,
                    title: r.entry.title,
                    cover: r.entry.images?.webp?.large_image_url || r.entry.images?.jpg?.large_image_url
                })) || [];
            }

            // ── TMDB WATCH PROVIDER INTEGRATION (Always run for regional data) ──
            try {
                const animeTitle = anime.title;
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
                    anime.watchProviders = providersRes.data.results || {};
                }
            } catch (tmdbErr) {
                console.error('TMDB Provider Fetch Failed:', tmdbErr.message);
                anime.watchProviders = {};
            }

            // Resolve English titles for relations/similar if they were fetched from Jikan or just to be safe
            const relatedIds = [];
            anime.relations.forEach(r => r.items.forEach(i => relatedIds.push(i.id)));
            anime.similar.forEach(i => relatedIds.push(i.id));
            
            const relatedEnglish = await fetchAnilistEnglishTitles(relatedIds, type);
            anime.relations.forEach(r => r.items.forEach(i => {
                if (relatedEnglish[i.id]) {
                    i.name = relatedEnglish[i.id].title;
                    i.cover = relatedEnglish[i.id].cover;
                }
            }));
            anime.similar.forEach(i => {
                if (relatedEnglish[i.id]) {
                    i.title = relatedEnglish[i.id].title;
                    i.cover = relatedEnglish[i.id].cover;
                }
            });

            jikanCache.set(cacheKey, anime);
        }

        // Migration/Force update: If cached anime is missing trailer but mainRes had it (not easily available here)
        // For now, just ensure the field exists for the frontend check
        if (anime && !anime.trailer && anime.synopsis) {
            // If it's a detail object but missing trailer, it might be an old cache.
            // We can't easily re-fetch without performance hit, but we can ensure the property is defined.
        }

        const [mediaStats, like, wishlist] = await Promise.all([
            MediaStats.findOne({ externalId: parseInt(id), type }),
            userId ? AnimeLike.findOne({ userId, externalId: parseInt(id), type }) : null,
            userId ? AnimeWishlist.findOne({ userId, externalId: parseInt(id), type }) : null
        ]);

        const stats = mediaStats ? {
            avgRating: mediaStats.avgRating,
            ratingCount: mediaStats.ratingCount,
            loggedCount: mediaStats.loggedCount,
            likeCount: mediaStats.likeCount,
            wishlistCount: mediaStats.wishlistCount
        } : { avgRating: null, ratingCount: 0, loggedCount: 0, likeCount: 0, wishlistCount: 0 };

        res.json({ success: true, anime, stats, userStatus: { liked: !!like, wishlisted: !!wishlist } });

        // Log view engagement
        logEngagement(id, type, 'view', userId);
    } catch (error) {
        console.error('Anime Detail Error:', error.message);
        res.status(500).json({ success: false, message: 'Detail failed' });
    }
});

// ── LIKE / WISHLIST ──
router.post('/like', protect, async (req, res) => {
    try {
        const { externalId, title, cover, type, genre } = req.body;
        
        const result = await withRetryTransaction(async (session) => {
            const existing = await AnimeLike.findOne({ userId: req.user._id, externalId: parseInt(externalId), type }).session(session);
            
            if (existing) {
                await existing.deleteOne({ session });
                await updateMediaStats(externalId, type, { likeCount: -1 }, session);
                const updatedUser = await deductXP(req.user._id, 1, session);
                
                return { 
                    liked: false, 
                    message: 'Like removed · -1 XP',
                    xp: updatedUser?.xp,
                    level: updatedUser?.level,
                    badge: updatedUser?.badge
                };
            }
            
            await AnimeLike.create([{ userId: req.user._id, externalId: parseInt(externalId), type, title, cover, genre }], { session });
            await updateMediaStats(externalId, type, { likeCount: 1 }, session);
            await logEngagement(externalId, type, 'like', req.user._id, session);
            
            const updatedUser = await awardXP(req.user._id, 1, session);
            return { 
                liked: true, 
                message: 'Liked · +1 XP',
                xp: updatedUser?.xp,
                level: updatedUser?.level,
                badge: updatedUser?.badge
            };
        });

        res.json({ success: true, ...result });
        
        jikanCache.clear();
    } catch (error) {
        console.error('Anime Like Error:', error);
        res.status(500).json({ success: false, message: 'Like failed' });
    }
});

router.post('/wishlist', protect, async (req, res) => {
    try {
        const { externalId, title, cover, type, genre } = req.body;
        const result = await withRetryTransaction(async (session) => {
            const existing = await AnimeWishlist.findOne({ userId: req.user._id, externalId: parseInt(externalId), type }).session(session);
            if (existing) {
                await existing.deleteOne({ session });
                await updateMediaStats(externalId, type, { wishlistCount: -1 }, session);
                return { wishlisted: false };
            }
            await AnimeWishlist.create([{ userId: req.user._id, externalId: parseInt(externalId), type, title, cover, genre }], { session });
            await updateMediaStats(externalId, type, { wishlistCount: 1 }, session);
            await logEngagement(externalId, type, 'wishlist', req.user._id, session);
            return { wishlisted: true };
        });
        res.json({ success: true, ...result });
        jikanCache.clear();
    } catch (error) {
        res.status(500).json({ success: false, message: 'Wishlist failed' });
    }
});

// ── COMMENTS ──
router.get('/comments/:id', protectOptional, async (req, res) => {
    try {
        const { id } = req.params;
        const { type = 'anime' } = req.query;
        const userId = req.user?._id;

        const comments = await AnimeComment.find({ externalId: parseInt(id), type, parentId: null })
            .populate('userId', 'username avatar badge level')
            .sort({ createdAt: -1 });
        
        const commentsWithReplies = await Promise.all(comments.map(async (c) => {
            const replies = await AnimeComment.find({ parentId: c._id }).populate('userId', 'username avatar badge level').sort({ createdAt: 1 });
            
            // If user is logged in, check if they liked/disliked this comment and its replies
            let userLike = null;
            if (userId) {
                userLike = await AnimeCommentLike.findOne({ commentId: c._id, userId });
            }

            const repliesWithStatus = await Promise.all(replies.map(async (r) => {
                let rUserLike = null;
                if (userId) {
                    rUserLike = await AnimeCommentLike.findOne({ commentId: r._id, userId });
                }
                return { ...r.toObject(), liked: rUserLike?.type === 'like', disliked: rUserLike?.type === 'dislike' };
            }));

            return { 
                ...c.toObject(), 
                replies: repliesWithStatus,
                liked: userLike?.type === 'like',
                disliked: userLike?.type === 'dislike'
            };
        }));

        res.json({ success: true, comments: commentsWithReplies });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Comments failed' });
    }
});

router.post('/comments/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const { text, type, parentId } = req.body;
        
        const result = await withRetryTransaction(async (session) => {
            const comment = await AnimeComment.create([{
                externalId: parseInt(id),
                userId: req.user._id,
                text,
                type: type || 'anime',
                parentId: parentId || null
            }], { session });

            const populated = await AnimeComment.findById(comment[0]._id)
                .populate('userId', 'username avatar badge level')
                .session(session);

            const updatedUser = await awardXP(req.user._id, 1, session);
            await logEngagement(id, type || 'anime', 'comment', req.user._id, { session });
            
            return { comment: populated, updatedUser };
        });

        res.json({ 
            success: true, 
            comment: result.comment,
            xp: result.updatedUser?.xp,
            level: result.updatedUser?.level,
            badge: result.updatedUser?.badge
        });
    } catch (error) {
        console.error('Anime Comment Post Error:', error);
        res.status(500).json({ success: false, message: 'Comment post failed' });
    }
});

router.put('/comments/:commentId', protect, async (req, res) => {
    try {
        const { commentId } = req.params;
        const { text } = req.body;
        const comment = await AnimeComment.findOneAndUpdate(
            { _id: commentId, userId: req.user._id },
            { text, edited: true },
            { returnDocument: 'after' }
        );
        if (!comment) return res.status(404).json({ success: false, message: 'Comment not found or unauthorized' });
        res.json({ success: true, comment });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Edit failed' });
    }
});

router.post('/comments/:commentId/like', protect, async (req, res) => {
    try {
        const { commentId } = req.params;
        const { type: likeType } = req.body;
        const userId = req.user._id;

        const result = await withRetryTransaction(async (session) => {
            const comment = await AnimeComment.findById(commentId).session(session);
            if (!comment) throw new Error('Comment not found');

            const existing = await AnimeCommentLike.findOne({ commentId, userId }).session(session);

            let likeDiff = 0;
            let dislikeDiff = 0;

            if (existing) {
                if (existing.type === likeType) {
                    await existing.deleteOne({ session });
                    if (likeType === 'like') {
                        likeDiff = -1;
                    } else {
                        dislikeDiff = -1;
                    }
                } else {
                    existing.type = likeType;
                    await existing.save({ session });
                    if (likeType === 'like') {
                        likeDiff = 1;
                        dislikeDiff = -1;
                    } else {
                        likeDiff = -1;
                        dislikeDiff = 1;
                    }
                }
            } else {
                await AnimeCommentLike.create([{ commentId, userId, type: likeType }], { session });
                if (likeType === 'like') {
                    likeDiff = 1;
                } else {
                    dislikeDiff = 1;
                }
            }

            comment.likeCount = Math.max(0, (comment.likeCount || 0) + likeDiff);
            comment.dislikeCount = Math.max(0, (comment.dislikeCount || 0) + dislikeDiff);
            await comment.save({ session });

            return { 
                liked: existing?.type === likeType ? false : (likeType === 'like'),
                disliked: existing?.type === likeType ? false : (likeType === 'dislike'),
                likeCount: comment.likeCount,
                dislikeCount: comment.dislikeCount
            };
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Anime Comment Like Error:', error);
        res.status(500).json({ success: false, message: 'Action failed' });
    }
});

router.delete('/comments/:commentId', protect, async (req, res) => {
    try {
        const { commentId } = req.params;
        
        const result = await withRetryTransaction(async (session) => {
            const comment = await AnimeComment.findOne({ _id: commentId, userId: req.user._id }).session(session);
            if (!comment) throw new Error('Comment not found');

            const replies = await AnimeComment.find({ parentId: comment._id }).session(session);
            for (const reply of replies) {
                await deductXP(reply.userId, 1, session);
            }
            await AnimeComment.deleteMany({ parentId: comment._id }, { session });
            await AnimeCommentLike.deleteMany({ commentId: comment._id }, { session });
            await comment.deleteOne({ session });
            const updatedUser = await deductXP(req.user._id, 1, session);
            
            return { updatedUser };
        });

        res.json({ 
            success: true, 
            message: 'Comment deleted',
            xp: result.updatedUser?.xp,
            level: result.updatedUser?.level,
            badge: result.updatedUser?.badge
        });
    } catch (error) {
        console.error('Anime Comment Delete Error:', error);
        res.status(500).json({ success: false, message: 'Delete failed' });
    }
});

// ── LIBRARY / LOGGING ──
router.get('/user/:userId', async (req, res) => {
    try {
        const library = await AnimeEntry.find({ userId: req.params.userId }).sort({ updatedAt: -1 });
        
        // Populate legacy fields for frontend compatibility
        const sanitizedLibrary = library.map(entry => {
            const obj = entry.toObject();
            if (!obj.cover && obj.coverImage) obj.cover = obj.coverImage;
            if (!obj.type && obj.mediaType) obj.type = obj.mediaType;
            return obj;
        });

        res.json({ success: true, games: sanitizedLibrary }); // Named "games" for profile component compatibility
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch library' });
    }
});

router.get('/library', protect, async (req, res) => {
    try {
        const library = await AnimeEntry.find({ userId: req.user._id }).sort({ updatedAt: -1 });
        
        // Populate legacy fields for frontend compatibility
        const sanitizedLibrary = library.map(entry => {
            const obj = entry.toObject();
            if (!obj.cover && obj.coverImage) obj.cover = obj.coverImage;
            if (!obj.type && obj.mediaType) obj.type = obj.mediaType;
            return obj;
        });

        res.json({ success: true, library: sanitizedLibrary });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Library fetch failed' });
    }
});

router.post('/log', protect, async (req, res) => {
    try {
        let { externalId, type, status, rating, episodesWatched, chaptersRead, totalEpisodes, totalChapters, airingStatus, notes, title, cover, genre, year } = req.body;
        
        const result = await withRetryTransaction(async (session) => {
            const oldEntry = await AnimeEntry.findOne({ userId: req.user._id, externalId: parseInt(externalId), type }).session(session);
            const isNew = !oldEntry;

            const updateData = { status, rating, episodesWatched, chaptersRead, totalEpisodes, totalChapters, airingStatus, notes, title, cover, genre, year };
            const entry = await AnimeEntry.findOneAndUpdate(
                { userId: req.user._id, externalId: parseInt(externalId), type },
                updateData,
                { upsert: true, returnDocument: 'after', session }
            );
            
            const delta = {
                loggedCount: isNew ? 1 : 0,
                ratingCount: (isNew && rating > 0) ? 1 : (!isNew && (oldEntry.rating || 0) === 0 && rating > 0) ? 1 : (!isNew && (oldEntry.rating || 0) > 0 && rating === 0) ? -1 : 0,
                ratingValue: rating - (oldEntry?.rating || 0)
            };
            await updateMediaStats(externalId, type, delta, session);
            
            let updatedUser = req.user;
            if (isNew) {
                updatedUser = await awardXP(req.user._id, 1, session);
            }
            if (delta.ratingCount === 1) {
                updatedUser = await awardXP(req.user._id, 1, session);
                await logEngagement(externalId, type, 'rating', req.user._id, session);
            }
            if (delta.ratingCount === -1) {
                updatedUser = await deductXP(req.user._id, 1, session);
            }
            return { entry, updatedUser };
        });

        res.json({ 
            success: true, 
            entry: result.entry,
            xp: result.updatedUser?.xp,
            level: result.updatedUser?.level,
            badge: result.updatedUser?.badge
        });

        jikanCache.clear();
    } catch (error) {
        console.error('Anime Log Error:', error);
        res.status(500).json({ success: false, message: 'Log failed' });
    }
});

router.delete('/log/:id', protect, async (req, res) => {
    try {
        const result = await withRetryTransaction(async (session) => {
            const entry = await AnimeEntry.findOneAndDelete({ _id: req.params.id, userId: req.user._id }).session(session);
            if (!entry) throw new Error('Entry not found');

            const delta = {
                loggedCount: -1,
                ratingCount: (entry.rating || 0) > 0 ? -1 : 0,
                ratingValue: -(entry.rating || 0)
            };
            await updateMediaStats(entry.externalId, entry.type, delta, session);
            
            await deductXP(req.user._id, 1, session); // For log
            let updatedUser = req.user;
            if ((entry.rating || 0) > 0) {
                updatedUser = await deductXP(req.user._id, 1, session); // For rating
            } else {
                updatedUser = await awardXP(req.user._id, 0, session);
            }
            return { updatedUser };
        });

        res.json({ 
            success: true, 
            message: 'Entry removed',
            xp: result.updatedUser?.xp,
            level: result.updatedUser?.level,
            badge: result.updatedUser?.badge
        });

        jikanCache.clear();
    } catch (error) {
        console.error('Anime Delete Log Error:', error);
        res.status(500).json({ success: false, message: 'Delete failed' });
    }
});

export default router;
