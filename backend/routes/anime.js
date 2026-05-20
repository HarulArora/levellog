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
import { updateMediaStats, getBulkStats, syncMediaStats } from '../utils/stats.js';
import { logEngagement } from '../utils/engagement.js';
import { withRetryTransaction } from '../utils/transaction.js';
import { getMediaDetail } from '../utils/mediaDetailCache.js';

const router = express.Router();
const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const TMDB_BASE_URL = 'https://api.tmdb.org/3';

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

const cleanMALCover = (url) => {
    if (!url) return '';
    // Strip sizing patterns like /r/192x272/ or /r/96x136/
    let cleaned = url.replace(/\/r\/\d+x\d+\//g, '/');
    // Strip signatures and query params
    cleaned = cleaned.split('?')[0];
    // Ensure absolute URL
    if (cleaned && !cleaned.startsWith('http')) {
        cleaned = `https://cdn.myanimelist.net${cleaned.startsWith('/') ? '' : '/'}${cleaned}`;
    }
    // Auto-heal double cdn prefixes or missing slashes
    if (cleaned.includes('cdn.myanimelist.netimages')) {
        cleaned = cleaned.replace('cdn.myanimelist.netimages', 'cdn.myanimelist.net/images');
    }
    return cleaned;
};

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

        // 1. Fetch all rankings from DB (INSTANT)
        const [trendingRankings, topRatedRankings, upcomingRankings] = await Promise.all([
            Ranking.find({ contentType: type, rankType: 'trending' }).sort({ rankPosition: 1 }).limit(15),
            Ranking.find({ contentType: type, rankType: 'top_rated' }).sort({ rankPosition: 1 }).limit(15),
            Ranking.find({ contentType: type, rankType: 'coming_soon' }).sort({ rankPosition: 1 }).limit(15)
        ]);

        const mapRanking = (r) => ({
            mal_id: parseInt(r.contentId),
            externalId: parseInt(r.contentId),
            title: r.title,
            cover: r.cover,
            year: r.year,
            genres: r.genres || [],
            type: type
        });

        let trending = trendingRankings.map(mapRanking);
        let topRated = topRatedRankings.map(mapRanking);
        let upcoming = upcomingRankings.map(mapRanking);

        // 2. Resolve missing years and titles via AniList for Home items
        const allItems = [...trending, ...topRated, ...upcoming];
        const missingMetaIds = allItems.map(i => i.externalId);
        
        if (missingMetaIds.length > 0) {
            const aniMeta = await fetchAnilistEnglishTitles(missingMetaIds, type);
            allItems.forEach(item => {
                const meta = aniMeta[item.externalId];
                if (meta) {
                    if (meta.title) item.title = meta.title;
                    if (meta.cover && !item.cover) item.cover = meta.cover;
                    if (!item.year || item.year > 2026) item.year = meta.year || item.year;
                }
            });
        }

        // 3. Aggregate stats for the items found
        const allIds = allItems.map(i => i.externalId);
        const stats = await fetchMediaStats(allIds, type);

        const sections = [
            { title: `Trending ${type === 'manga' ? 'Manga' : 'Anime'}`, items: trending },
            { title: `Top Rated ${type === 'manga' ? 'Manga' : 'Anime'}`, items: topRated },
            { title: `${type === 'manga' ? 'Upcoming Manga' : 'Upcoming Anime'}`, items: upcoming }
        ];

        const result = { sections, stats };
        
        // Cache the result for a short time
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

        const [response] = await Promise.all([
            apiClient.get(`${JIKAN_BASE_URL}/${type}`, {
                params: { q, limit: 25, page: parseInt(page), sfw: true },
                retry: 3,
                timeout: 10000
            })
        ]);

        let results = (response.data?.data || []).map(item => formatJikanItem(item, type));

        // Quality Filter: Remove items missing important values
        results = results.filter(item => 
            item.title && 
            item.cover && 
            !item.cover.toLowerCase().includes('placeholder') &&
            !item.cover.toLowerCase().includes('icon-manga-placeholder')
        );
        
        const pagination = response.data?.pagination || {};
        const totalItems = pagination.items?.total || (pagination.last_visible_page ? pagination.last_visible_page * 25 : results.length);
        const totalPages = Math.ceil(totalItems / 25);
        // Resolve English Titles and Deduplicate
        const englishTitles = await fetchAnilistEnglishTitles(results.map(i => i.externalId), type);
        const seen = new Set();
        results = results.map(item => {
            const meta = englishTitles[item.externalId];
            if (meta) {
                item.title = meta.title;
                if (meta.cover && !item.cover) item.cover = meta.cover;
                if (!item.year || item.year > 2026) item.year = meta.year || item.year;
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
            totalPages, 
            total: totalItems 
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
        const { type = 'anime', genre, page = 1, limit = 25 } = req.query;
        const cacheKey = `discover-v3-${type}-${genre || 'all'}-${page}`;
        
        if (jikanCache.has(cacheKey)) {
            return res.json({ success: true, ...jikanCache.get(cacheKey) });
        }

        const params = {
            page: parseInt(page),
            limit: parseInt(limit),
            order_by: 'popularity',
            sort: 'asc',
            sfw: true
        };

        if (genre) {
            if (['movie', 'ova', 'special', 'tv'].includes(genre)) {
                params.type = genre;
            } else {
                params.genres = genre;
            }
        }

        let results = [];
        let totalPages = 1;
        let totalCount = 0;

        try {
            const [response] = await Promise.all([
                apiClient.get(`${JIKAN_BASE_URL}/${type}`, { 
                    params: { ...params, limit: 25, page: parseInt(page) }, 
                    retry: 2, 
                    timeout: 10000 
                })
            ]);

            results = (response.data?.data || []).map(item => formatJikanItem(item, type));

            // Quality Filter: Remove items missing important values
            results = results.filter(item => 
                item.title && 
                item.cover && 
                !item.cover.toLowerCase().includes('placeholder') &&
                !item.cover.toLowerCase().includes('icon-manga-placeholder')
            );
            
            const totalItems = response.data?.pagination?.items?.total || (response.data?.pagination?.last_visible_page ? response.data.pagination.last_visible_page * 25 : results.length);
            totalPages = Math.ceil(totalItems / 25);
            totalCount = totalItems;
        } catch (jikanErr) {
            console.error('Jikan Discover Error:', jikanErr.message);
            // No local fallback to Ranking collection as per user preference
            results = [];
        }
        
        if (results.length > 0) {
            // Parallel fetch for English titles and Internal stats for speed
            const [englishTitles, stats] = await Promise.all([
                fetchAnilistEnglishTitles(results.map(i => i.externalId), type),
                fetchMediaStats(results.map(r => r.externalId), type)
            ]);

            const seen = new Set();
            results = results.map(item => {
                const meta = englishTitles[item.externalId];
                if (meta) {
                    item.title = meta.title;
                    if (meta.cover && !item.cover) item.cover = meta.cover;
                    if (!item.year || item.year > 2026) item.year = meta.year || item.year;
                }
                return item;
            }).filter(item => {
                if (seen.has(item.externalId)) return false;
                seen.add(item.externalId);
                return true;
            });

            const result = { 
                items: results, 
                stats,
                totalPages,
                total: totalCount
            };

            jikanCache.set(cacheKey, result);
            return res.json({ success: true, ...result });
        }

        res.json({ success: true, items: [], stats: {}, totalPages: 1, total: 0 });
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

        // Retrieve fully optimized persistent cached media detail
        const anime = await getMediaDetail(id, type);
        if (!anime) return res.status(404).json({ success: false, message: 'Detail not found' });

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
            await logEngagement(id, type || 'anime', 'comment', req.user._id, session);
            
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
        
        let healCount = 0;
        const MAX_HEALS_PER_REQUEST = 3;

        // Populate legacy fields for frontend compatibility
        const sanitizedLibrary = await Promise.all(library.map(async (entry) => {
            const obj = entry.toObject();
            if (!obj.cover && obj.coverImage) obj.cover = obj.coverImage;
            if (!obj.type && obj.mediaType) obj.type = obj.mediaType;

            // Heal generic genres or AniList/broken covers if possible
            const isGeneric = !obj.genre || ['anime', 'manga'].includes(obj.genre.toLowerCase());
            const isNonStandardCover = !obj.cover || 
                                       obj.cover.includes('anilist.co') || 
                                       obj.cover.includes('?s=') || 
                                       !obj.cover.startsWith('https://cdn.myanimelist.net/');

            if ((isGeneric || isNonStandardCover) && obj.externalId) {
                let shouldHeal = false;
                if (healCount < MAX_HEALS_PER_REQUEST) {
                    healCount++;
                    shouldHeal = true;
                }

                if (shouldHeal) {
                    try {
                        const response = await apiClient.get(`${JIKAN_BASE_URL}/${obj.type}/${obj.externalId}`, { retry: 1 });
                        const fresh = formatJikanItem(response.data.data, obj.type);
                        
                        const updates = {};
                        if (fresh.genre && !['anime', 'manga'].includes(fresh.genre.toLowerCase())) {
                            obj.genre = fresh.genre;
                            updates.genre = fresh.genre;
                        }
                        if (fresh.cover && fresh.cover !== obj.cover) {
                            obj.cover = fresh.cover;
                            updates.cover = fresh.cover;
                        }

                        if (Object.keys(updates).length > 0) {
                            // Save back to DB asynchronously to fix it permanently
                            AnimeEntry.updateOne({ _id: obj._id }, updates).catch(e => console.error('Library heal save error:', e));
                        }
                    } catch (e) { /* ignore */ }
                }
            }
            return obj;
        }));

        res.json({ success: true, games: sanitizedLibrary }); // Named "games" for profile component compatibility
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch library' });
    }
});

router.get('/library', protect, async (req, res) => {
    try {
        const library = await AnimeEntry.find({ userId: req.user._id }).sort({ updatedAt: -1 });
        
        let healCount = 0;
        const MAX_HEALS_PER_REQUEST = 3;

        // Populate legacy fields for frontend compatibility
        const sanitizedLibrary = await Promise.all(library.map(async (entry) => {
            const obj = entry.toObject();
            if (!obj.cover && obj.coverImage) obj.cover = obj.coverImage;
            if (!obj.type && obj.mediaType) obj.type = obj.mediaType;

            // Heal generic genres or AniList/broken covers if possible
            const isGeneric = !obj.genre || ['anime', 'manga'].includes(obj.genre.toLowerCase());
            const isNonStandardCover = !obj.cover || 
                                       obj.cover.includes('anilist.co') || 
                                       obj.cover.includes('?s=') || 
                                       !obj.cover.startsWith('https://cdn.myanimelist.net/');

            if ((isGeneric || isNonStandardCover) && obj.externalId) {
                let shouldHeal = false;
                if (healCount < MAX_HEALS_PER_REQUEST) {
                    healCount++;
                    shouldHeal = true;
                }

                if (shouldHeal) {
                    try {
                        const response = await apiClient.get(`${JIKAN_BASE_URL}/${obj.type}/${obj.externalId}`, { retry: 1 });
                        const fresh = formatJikanItem(response.data.data, obj.type);
                        
                        const updates = {};
                        if (fresh.genre && !['anime', 'manga'].includes(fresh.genre.toLowerCase())) {
                            obj.genre = fresh.genre;
                            updates.genre = fresh.genre;
                        }
                        if (fresh.cover && fresh.cover !== obj.cover) {
                            obj.cover = fresh.cover;
                            updates.cover = fresh.cover;
                        }

                        if (Object.keys(updates).length > 0) {
                            // Save back to DB asynchronously to fix it permanently
                            AnimeEntry.updateOne({ _id: obj._id }, updates).catch(e => console.error('Library heal save error:', e));
                        }
                    } catch (e) { /* ignore */ }
                }
            }
            return obj;
        }));

        res.json({ success: true, library: sanitizedLibrary });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Library fetch failed' });
    }
});

router.post('/log', protect, async (req, res) => {
    try {
        let { externalId, type, status, rating, episodesWatched, chaptersRead, volumesRead, totalEpisodes, totalChapters, totalVolumes, airingStatus, notes, title, cover, genre, year } = req.body;
        
        // Normalize cover images to use MyAnimeList standard, resolving AniList on-demand
        if (cover && cover.includes('anilist.co')) {
            try {
                const response = await apiClient.get(`${JIKAN_BASE_URL}/${type}/${externalId}`, { retry: 1 });
                const fresh = formatJikanItem(response.data.data, type);
                if (fresh.cover) {
                    cover = fresh.cover;
                }
            } catch (e) {
                cover = cleanMALCover(cover);
            }
        } else {
            cover = cleanMALCover(cover);
        }

        const result = await withRetryTransaction(async (session) => {
            const oldEntry = await AnimeEntry.findOne({ userId: req.user._id, externalId: parseInt(externalId), type }).session(session);
            const isNew = !oldEntry;

            const updateData = { status, rating, episodesWatched, chaptersRead, volumesRead, totalEpisodes, totalChapters, totalVolumes, airingStatus, notes, title, cover, genre, year };
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

// ==========================================
// AUTO-IMPORT & SYNC ENDPOINTS
// ==========================================

// AniList Public Sync GraphQL Endpoint
router.post('/import/anilist', protect, async (req, res) => {
    try {
        const { username, mediaType, anilistData } = req.body;
        if (!username) {
            return res.status(400).json({ success: false, message: 'AniList username is required' });
        }

        let data;

        if (anilistData) {
            data = anilistData;
        } else {
            const typeFilter = mediaType === 'manga' ? 'MANGA' : 'ANIME';
            
            // Query public lists without OAuth tokens using AniList GraphQL API (Fallback)
            const query = `
                query ($username: String, $type: MediaType) {
                    MediaListCollection(userName: $username, type: $type) {
                        lists {
                            name
                            isCustomList
                            status
                            entries {
                                score(format: POINT_10)
                                progress
                                progressVolumes
                                status
                                media {
                                    idMal
                                    title {
                                        romaji
                                        english
                                    }
                                    coverImage {
                                        large
                                    }
                                    genres
                                    episodes
                                    chapters
                                    volumes
                                    startDate {
                                        year
                                    }
                                }
                            }
                        }
                    }
                }
            `;

            const response = await apiClient.post('https://graphql.anilist.co', {
                query,
                variables: { username, type: typeFilter }
            });

            data = response.data;
        }
        
        // 🛡️ Inspect for GraphQL Errors (e.g. User not found, private list)
        if (data.errors && data.errors.length > 0) {
            const firstError = data.errors[0].message;
            return res.status(400).json({ success: false, message: `AniList: ${firstError}` });
        }

        const lists = data.data?.MediaListCollection?.lists || [];
        
        let importedCount = 0;
        let updatedCount = 0;
        let xpGained = 0;
        
        // Map AniList Statuses to LevelLog standard
        const statusMap = {
            CURRENT: mediaType === 'manga' ? 'reading' : 'watching',
            COMPLETED: 'completed',
            PAUSED: 'paused',
            DROPPED: 'dropped',
            PLANNING: 'planned'
        };

        const listEntries = [];
        lists.forEach(l => {
            if (l.entries) {
                l.entries.forEach(e => listEntries.push(e));
            }
        });

        if (listEntries.length === 0) {
            return res.json({ success: true, message: 'No entries found in this AniList collection.', importedCount: 0, updatedCount: 0, xpGained: 0 });
        }

        // Loop over entries to sync
        for (const entry of listEntries) {
            const media = entry.media;
            const externalId = media.idMal;
            if (!externalId) continue; // Requires MAL ID mapping for parity

            const title = media.title.english || media.title.romaji;
            const status = statusMap[entry.status] || 'planned';
            const progress = entry.progress || 0;
            const score = entry.score || 0;

            // Check if existing record exists
            const existing = await AnimeEntry.findOne({
                userId: req.user._id,
                externalId,
                type: mediaType
            });

            if (existing) {
                // Update only if imported progress is higher/newer or cover is missing/broken
                const progressKey = mediaType === 'manga' ? 'chaptersRead' : 'episodesWatched';
                const currentProgress = existing[progressKey] || 0;
                
                let coverUpdated = false;
                if (!existing.cover || existing.cover.includes('netimages') || existing.cover.includes('anilist.co')) {
                    const cover = media.coverImage?.large || '';
                    // Only update cover if it doesn't already have a standard MAL/Jikan cover
                    if (cover && !existing.cover?.startsWith('https://cdn.myanimelist.net/') && cover !== existing.cover) {
                        existing.cover = cover;
                        coverUpdated = true;
                    }
                }

                if (progress > currentProgress || existing.status !== status || (score > 0 && existing.rating !== score) || coverUpdated) {
                    // Check if rating is being added for the first time
                    const oldRating = existing.rating || 0;
                    if (oldRating === 0 && score > 0) {
                        xpGained += 1;
                    }

                    existing.status = status;
                    if (mediaType === 'manga') {
                        existing.chaptersRead = progress;
                        existing.volumesRead = entry.progressVolumes || 0;
                    } else {
                        existing.episodesWatched = progress;
                    }
                    if (score > 0) existing.rating = score;
                    
                    await existing.save();
                    updatedCount++;

                    // Automatically recalculate global media average rating and stats!
                    await syncMediaStats(externalId, mediaType);

                    // Automatically clean up user's wishlist since they are now watching/reading/completed
                    if (status !== 'planned') {
                        await AnimeWishlist.deleteOne({ userId: req.user._id, externalId, type: mediaType });
                    }
                }
            } else {
                // Insert brand-new entry
                const newEntry = new AnimeEntry({
                    userId: req.user._id,
                    externalId,
                    type: mediaType,
                    title,
                    cover: media.coverImage?.large || '',
                    status,
                    rating: score,
                    genre: media.genres?.[0] || (mediaType === 'manga' ? 'Manga' : 'Anime'),
                    year: media.startDate?.year || new Date().getFullYear(),
                    episodesWatched: mediaType === 'anime' ? progress : 0,
                    totalEpisodes: mediaType === 'anime' ? (media.episodes || 0) : 0,
                    chaptersRead: mediaType === 'manga' ? progress : 0,
                    totalChapters: mediaType === 'manga' ? (media.chapters || 0) : 0,
                    volumesRead: mediaType === 'manga' ? (entry.progressVolumes || 0) : 0,
                    totalVolumes: mediaType === 'manga' ? (media.volumes || 0) : 0,
                });
                
                await newEntry.save();
                importedCount++;
                
                // +1 XP for logging new item
                xpGained += 1;
                // +1 XP for rating on first log
                if (score > 0) {
                    xpGained += 1;
                }

                // Automatically recalculate global media average rating and stats!
                await syncMediaStats(externalId, mediaType);

                // Automatically clean up user's wishlist since they are now watching/reading/completed
                if (status !== 'planned') {
                    await AnimeWishlist.deleteOne({ userId: req.user._id, externalId, type: mediaType });
                }
            }
        }

        // Atomically award XP in bulk based on new items logged
        let updatedUser = req.user;
        if (xpGained > 0) {
            updatedUser = await awardXP(req.user._id, xpGained);
        }

        res.json({
            success: true,
            message: `Successfully synchronized ${mediaType} from AniList!`,
            importedCount,
            updatedCount,
            xpGained,
            xp: updatedUser.xp,
            level: updatedUser.level,
            badge: updatedUser.badge
        });

    } catch (err) {
        console.error('AniList Sync Error:', err);
        const status = err.response?.status || 500;
        let message = 'Sync failed. Please try again later.';

        if (status === 404 || err.message?.includes('Not Found') || err.message?.includes('not found')) {
            message = 'AniList profile not found. Please check your username spelling and ensure your profile list is public.';
        } else if (err.response?.data?.errors?.[0]?.message) {
            message = err.response.data.errors[0].message;
        } else if (err.message) {
            message = err.message;
        }

        res.status(status).json({ success: false, message });
    }
});

// MyAnimeList Public Sync API (via Native MAL Load endpoint)
router.post('/import/mal', protect, async (req, res) => {
    try {
        const { username, mediaType } = req.body;
        if (!username) {
            return res.status(400).json({ success: false, message: 'MAL username is required' });
        }

        let entries = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const url = `https://myanimelist.net/${mediaType}list/${username}/load.json?offset=${offset}&status=7`;
            const response = await apiClient.get(url, {
                headers: {
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'X-Requested-With': 'XMLHttpRequest',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const chunk = response.data || [];
            if (!Array.isArray(chunk) || chunk.length === 0) {
                hasMore = false;
            } else {
                entries = entries.concat(chunk);
                if (chunk.length < 300) {
                    hasMore = false;
                } else {
                    offset += 300;
                    // respect rate limit and cloudflare pacing
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
        }

        if (entries.length === 0) {
            return res.json({ success: true, message: 'No entries found in this MyAnimeList collection.', importedCount: 0, updatedCount: 0, xpGained: 0 });
        }

        let importedCount = 0;
        let updatedCount = 0;
        let xpGained = 0;

        // Status code mappings from MAL internal json
        const statusMap = {
            1: mediaType === 'manga' ? 'reading' : 'watching',
            2: 'completed',
            3: 'paused',
            4: 'dropped',
            6: 'planned'
        };

        const parseYear = (dateStr) => {
            if (!dateStr) return new Date().getFullYear();
            // dateStr could be YYYY-MM-DD or MM-DD-YY / MM-DD-YYYY
            const parts = dateStr.split('-');
            if (parts.length < 3) return new Date().getFullYear();
            
            // Check if first part is a 4 digit year (YYYY-MM-DD)
            if (parts[0].length === 4) {
                const yr = parseInt(parts[0]);
                if (!isNaN(yr)) return yr;
            }
            
            // Check if third part is a 4 digit year (MM-DD-YYYY)
            if (parts[2].length === 4) {
                const yr = parseInt(parts[2]);
                if (!isNaN(yr)) return yr;
            }
            
            // Otherwise, it might be 2 digit year at the end (MM-DD-YY)
            let yr = parseInt(parts[2]);
            if (isNaN(yr)) return new Date().getFullYear();
            if (yr <= 50) yr += 2000;
            else if (yr < 100) yr += 1900;
            return yr;
        };

        for (const entry of entries) {
            const externalId = mediaType === 'manga' ? entry.manga_id : entry.anime_id;
            if (!externalId) continue;

            const title = mediaType === 'manga' 
                ? (entry.manga_english || entry.manga_title) 
                : (entry.anime_title_eng || entry.anime_title);
                
            const status = statusMap[entry.status] || 'planned';
            const progress = mediaType === 'manga' ? (entry.num_read_chapters || 0) : (entry.num_watched_episodes || 0);
            const score = entry.score || 0;

            const existing = await AnimeEntry.findOne({
                userId: req.user._id,
                externalId,
                type: mediaType
            });

            if (existing) {
                const progressKey = mediaType === 'manga' ? 'chaptersRead' : 'episodesWatched';
                const currentProgress = existing[progressKey] || 0;

                let coverUpdated = false;
                if (!existing.cover || existing.cover.includes('netimages') || existing.cover.includes('?s=') || !existing.cover.startsWith('https://cdn.myanimelist.net/')) {
                    const rawCover = mediaType === 'manga' ? entry.manga_image_path : entry.anime_image_path;
                    const cover = cleanMALCover(rawCover);
                    if (cover && cover !== existing.cover) {
                        existing.cover = cover;
                        coverUpdated = true;
                    }
                }

                if (progress > currentProgress || existing.status !== status || (score > 0 && existing.rating !== score) || coverUpdated) {
                    const oldRating = existing.rating || 0;
                    if (oldRating === 0 && score > 0) {
                        xpGained += 1;
                    }

                    existing.status = status;
                    if (mediaType === 'manga') {
                        existing.chaptersRead = progress;
                        existing.volumesRead = entry.num_read_volumes || 0;
                    } else {
                        existing.episodesWatched = progress;
                    }
                    if (score > 0) existing.rating = score;

                    await existing.save();
                    updatedCount++;

                    // Automatically recalculate global media average rating and stats!
                    await syncMediaStats(externalId, mediaType);

                    // Automatically clean up user's wishlist since they are now watching/reading/completed
                    if (status !== 'planned') {
                        await AnimeWishlist.deleteOne({ userId: req.user._id, externalId, type: mediaType });
                    }
                }
            } else {
                const rawCover = mediaType === 'manga' ? entry.manga_image_path : entry.anime_image_path;
                const cover = cleanMALCover(rawCover);
                
                const genre = entry.genres?.[0]?.name || (mediaType === 'manga' ? 'Manga' : 'Anime');
                const rawDateStr = mediaType === 'manga' ? entry.manga_start_date_string : entry.anime_start_date_string;
                const year = parseYear(rawDateStr);

                const newEntry = new AnimeEntry({
                    userId: req.user._id,
                    externalId,
                    type: mediaType,
                    title,
                    cover,
                    status,
                    rating: score,
                    genre,
                    year,
                    episodesWatched: mediaType === 'anime' ? progress : 0,
                    totalEpisodes: mediaType === 'anime' ? (entry.anime_num_episodes || 0) : 0,
                    chaptersRead: mediaType === 'manga' ? progress : 0,
                    totalChapters: mediaType === 'manga' ? (entry.manga_num_chapters || 0) : 0,
                    volumesRead: mediaType === 'manga' ? (entry.num_read_volumes || 0) : 0,
                    totalVolumes: mediaType === 'manga' ? (entry.manga_num_volumes || 0) : 0,
                });

                await newEntry.save();
                importedCount++;

                xpGained += 1; // +1 XP for logging new item
                if (score > 0) {
                    xpGained += 1; // +1 XP for rating on first log
                }

                // Automatically recalculate global media average rating and stats!
                await syncMediaStats(externalId, mediaType);

                // Automatically clean up user's wishlist since they are now watching/reading/completed
                if (status !== 'planned') {
                    await AnimeWishlist.deleteOne({ userId: req.user._id, externalId, type: mediaType });
                }
            }
        }

        let updatedUser = req.user;
        if (xpGained > 0) {
            updatedUser = await awardXP(req.user._id, xpGained);
        }

        res.json({
            success: true,
            message: `Successfully synchronized ${mediaType} from MyAnimeList!`,
            importedCount,
            updatedCount,
            xpGained,
            xp: updatedUser.xp,
            level: updatedUser.level,
            badge: updatedUser.badge
        });

    } catch (err) {
        console.error('MAL Sync Error:', err);
        const status = err.response?.status || 500;
        let message = 'Sync failed. Please try again later.';
        
        if (status === 404 || status === 400) {
            message = 'MyAnimeList profile not found or list is private. Please check your username spelling and ensure your list is public.';
        } else if (status === 403) {
            message = 'This MyAnimeList profile is private. Please set your list settings to "Public" in your MAL options.';
        } else if (err.response?.data?.message) {
            message = err.response.data.message;
        } else if (err.message) {
            message = err.message;
        }

        res.status(status).json({ success: false, message });
    }
});

export default router;
