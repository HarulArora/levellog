import express from 'express';
import apiClient from '../utils/apiClient.js';
import { LRUCache } from 'lru-cache';
import AnimeEntry from '../models/AnimeEntry.js';
import AnimeComment from '../models/AnimeComment.js';
import AnimeLike from '../models/AnimeLike.js';
import AnimeWishlist from '../models/AnimeWishlist.js';
import { protect, protectOptional } from '../middleware/auth.js';
import { awardXP, deductXP } from '../utils/xp.js';
import { updateMediaStats, getBulkStats } from '../utils/stats.js';

const router = express.Router();
const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const jikanCache = new LRUCache({
    max: 200,
    ttl: 1000 * 60 * 60 // 1 hour
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
    title: item.title || item.name,
    cover: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url,
    genre: item.genres?.[0]?.name || 'Media',
    genres: item.genres?.map(g => g.name) || [],
    year: item.aired?.prop?.from?.year || item.published?.prop?.from?.year || item.year,
    score: item.score,
    summary: item.synopsis,
    status: item.status,
    airingStatus: item.status, // Jikan status is the airing status
    episodes: item.episodes,
    chapters: item.chapters,
    studios: item.studios?.map(s => s.name).join(', '),
    producers: item.producers?.map(p => p.name).join(', '),
    source: item.source,
    rating: item.rating,
    type: type
});

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

        const requestConfig = { retry: 3, retryDelay: 2000 };
        const [trendingRes, topRes, upcomingRes] = await Promise.all([
            apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, { ...requestConfig, params: { limit: 15, filter: type === 'manga' ? 'publishing' : 'airing', sfw: true } }).catch(() => ({ data: { data: [] } })),
            apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, { ...requestConfig, params: { limit: 15, filter: 'bypopularity', sfw: true } }).catch(() => ({ data: { data: [] } })),
            apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, { ...requestConfig, params: { limit: 15, filter: 'upcoming', sfw: true } }).catch(() => ({ data: { data: [] } }))
        ]);

        const trending = (trendingRes.data?.data || []).map(item => formatJikanItem(item, type)).slice(0, 12);
        const topRated = (topRes.data?.data || []).map(item => formatJikanItem(item, type)).slice(0, 12);
        const upcoming = (upcomingRes.data?.data || []).map(item => formatJikanItem(item, type)).slice(0, 12);

        // Aggregate stats
        const allIds = [...trending, ...topRated, ...upcoming].map(i => i.externalId);
        const stats = await fetchMediaStats(allIds, type);

        const sections = [
            { title: `Trending ${type === 'manga' ? 'Manga' : 'Anime'}`, items: trending },
            { title: `Top Rated ${type === 'manga' ? 'Manga' : 'Anime'}`, items: topRated },
            { title: `Upcoming ${type === 'manga' ? 'Manga' : 'Anime'}`, items: upcoming }
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
router.get('/search', async (req, res) => {
    try {
        const { q, type = 'anime', limit = 24 } = req.query;
        if (!q) return res.status(400).json({ success: false, message: 'Query is required' });

        const cacheKey = `search-${type}-${q}`;
        if (jikanCache.has(cacheKey)) return res.json({ success: true, ...jikanCache.get(cacheKey) });

        const response = await apiClient.get(`${JIKAN_BASE_URL}/${type}`, {
            params: { q, limit: parseInt(limit), sfw: true },
            retry: 3,
            retryDelay: 1000
        });

        const results = (response.data?.data || []).map(item => formatJikanItem(item, type));
        const stats = await fetchMediaStats(results.map(r => r.externalId), type);
        const result = { results, stats };
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
        
        const results = (response.data?.data || []).map(item => formatJikanItem(item, type));
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

        const cacheKey = `detail-v10-${type}-${id}`;
        let anime = jikanCache.get(cacheKey);

        if (!anime) {
            const requestConfig = { retry: 3, retryDelay: 1000 };
            const [mainRes, picsRes, recsRes, videoRes, charRes, staffRes, streamingRes] = await Promise.all([
                apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/full`, requestConfig),
                apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/pictures`, requestConfig).catch(() => ({ data: { data: [] } })),
                apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/recommendations`, requestConfig).catch(() => ({ data: { data: [] } })),
                apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/videos`, requestConfig).catch(() => ({ data: { data: {} } })),
                apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/characters`, requestConfig).catch(() => ({ data: { data: [] } })),
                apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/staff`, requestConfig).catch(() => ({ data: { data: [] } })),
                apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}/streaming`, requestConfig).catch(() => ({ data: { data: [] } }))
            ]);

            const rawData = mainRes.data.data;
            anime = formatJikanItem(rawData, type);
            anime.streamingLinks = streamingRes.data.data || [];

            // ── TMDB WATCH PROVIDER INTEGRATION ──
            try {
                // Search TMDB for this anime to get regional watch providers
                // Search both tv and movie since some anime are films
                const animeTitle = anime.title;
                const tmdbSearch = await apiClient.get(`${TMDB_BASE_URL}/search/multi`, {
                    params: { query: animeTitle, include_adult: false },
                    retry: 2
                });

                const bestMatch = tmdbSearch.data.results?.find(r => 
                    (r.media_type === 'tv' || r.media_type === 'movie') && 
                    (r.original_language === 'ja' || r.name === animeTitle || r.title === animeTitle)
                );

                if (bestMatch) {
                    const providersRes = await apiClient.get(`${TMDB_BASE_URL}/${bestMatch.media_type}/${bestMatch.id}/watch/providers`);
                    anime.watchProviders = providersRes.data.results || {};
                }
            } catch (tmdbErr) {
                console.error('TMDB Provider Fetch Failed for Anime:', tmdbErr.message);
                anime.watchProviders = {};
            }
            
            // Extract Relations - FAST (No cover fetching here)
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

            // Explicitly find relations (IDs only for frontend to fetch covers lazily)
            const adaptation = rawData.relations?.find(r => r.relation === 'Adaptation')?.entry?.[0];
            if (adaptation && adaptation.type === 'manga') {
                anime.sourceManga = { id: adaptation.mal_id, name: adaptation.name };
            }

            const prequel = rawData.relations?.find(r => r.relation === 'Prequel')?.entry?.[0];
            const sequel = rawData.relations?.find(r => r.relation === 'Sequel')?.entry?.[0];
            if (prequel) anime.prequel = { id: prequel.mal_id, name: prequel.name, type: prequel.type };
            if (sequel) anime.sequel = { id: sequel.mal_id, name: sequel.name, type: sequel.type };
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
            
            jikanCache.set(cacheKey, anime);
        }

        // Migration/Force update: If cached anime is missing trailer but mainRes had it (not easily available here)
        // For now, just ensure the field exists for the frontend check
        if (anime && !anime.trailer && anime.synopsis) {
            // If it's a detail object but missing trailer, it might be an old cache.
            // We can't easily re-fetch without performance hit, but we can ensure the property is defined.
        }

        const [statsAgg, like, wishlist] = await Promise.all([
            AnimeEntry.aggregate([
                { $match: { externalId: parseInt(id), type } },
                { $group: { _id: '$externalId', avgRating: { $avg: { $cond: [{ $gt: ['$rating', 0] }, '$rating', null] } }, ratingCount: { $sum: { $cond: [{ $gt: ['$rating', 0] }, 1, 0] } }, loggedCount: { $sum: 1 } }}
            ]),
            userId ? AnimeLike.findOne({ userId, externalId: parseInt(id), type }) : null,
            userId ? AnimeWishlist.findOne({ userId, externalId: parseInt(id), type }) : null
        ]);

        const likeCount = await AnimeLike.countDocuments({ externalId: parseInt(id), type });
        const wishlistCount = await AnimeWishlist.countDocuments({ externalId: parseInt(id), type });

        const stats = statsAgg[0] ? {
            avgRating: statsAgg[0].avgRating ? parseFloat(statsAgg[0].avgRating.toFixed(1)) : null,
            ratingCount: statsAgg[0].ratingCount,
            loggedCount: statsAgg[0].loggedCount,
            likeCount,
            wishlistCount
        } : { avgRating: null, ratingCount: 0, loggedCount: 0, likeCount, wishlistCount };

        res.json({ success: true, anime, stats, userStatus: { liked: !!like, wishlisted: !!wishlist } });
    } catch (error) {
        console.error('Anime Detail Error:', error.message);
        res.status(500).json({ success: false, message: 'Detail failed' });
    }
});

// ── LIKE / WISHLIST ──
router.post('/like', protect, async (req, res) => {
    try {
        const { externalId, title, cover, type, genre } = req.body;
        const existing = await AnimeLike.findOne({ userId: req.user._id, externalId: parseInt(externalId), type });
        if (existing) {
            await existing.deleteOne();
            updateMediaStats(externalId, type, { likeCount: -1 });
            await deductXP(req.user._id, 1);
            return res.json({ success: true, liked: false, message: 'Like removed · -1 XP' });
        }
        await AnimeLike.create({ userId: req.user._id, externalId: parseInt(externalId), type, title, cover, genre });
        updateMediaStats(externalId, type, { likeCount: 1 });
        const updatedUser = await awardXP(req.user._id, 1);
        res.json({ 
            success: true, 
            liked: true, 
            message: 'Liked · +1 XP',
            xp: updatedUser?.xp,
            level: updatedUser?.level,
            badge: updatedUser?.badge
        });
        jikanCache.delete(`home-${type}`);
        jikanCache.delete(`detail-${type}-${externalId}`);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Like failed' });
    }
});

router.post('/wishlist', protect, async (req, res) => {
    try {
        const { externalId, title, cover, type, genre } = req.body;
        const existing = await AnimeWishlist.findOne({ userId: req.user._id, externalId: parseInt(externalId), type });
        if (existing) {
            await existing.deleteOne();
            updateMediaStats(externalId, type, { wishlistCount: -1 });
            return res.json({ success: true, wishlisted: false });
        }
        await AnimeWishlist.create({ userId: req.user._id, externalId: parseInt(externalId), type, title, cover, genre });
        updateMediaStats(externalId, type, { wishlistCount: 1 });
        res.json({ success: true, wishlisted: true });
        jikanCache.delete(`home-${type}`);
        jikanCache.delete(`detail-${type}-${externalId}`);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Wishlist failed' });
    }
});

// ── COMMENTS ──
router.get('/comments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type = 'anime' } = req.query;
        const comments = await AnimeComment.find({ externalId: parseInt(id), type, parentId: null })
            .populate('userId', 'username avatar badge level')
            .sort({ createdAt: -1 });
        
        const commentsWithReplies = await Promise.all(comments.map(async (c) => {
            const replies = await AnimeComment.find({ parentId: c._id }).populate('userId', 'username avatar badge level').sort({ createdAt: 1 });
            return { ...c.toObject(), replies };
        }));

        res.json({ success: true, comments: commentsWithReplies });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Comments failed' });
    }
});

router.post('/comments/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const { text, parentId, type = 'anime' } = req.body;
        const comment = await AnimeComment.create({
            userId: req.user._id,
            externalId: parseInt(id),
            type,
            text,
            parentId: parentId || null
        });
        const updatedUser = await awardXP(req.user._id, 1);
        res.json({ 
            success: true, 
            comment,
            message: 'Comment posted · +1 XP',
            xp: updatedUser?.xp,
            level: updatedUser?.level,
            badge: updatedUser?.badge
        });
    } catch (error) {
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
            { new: true }
        );
        if (!comment) return res.status(404).json({ success: false, message: 'Comment not found or unauthorized' });
        res.json({ success: true, comment });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Edit failed' });
    }
});

router.delete('/comments/:commentId', protect, async (req, res) => {
    try {
        const { commentId } = req.params;
        const comment = await AnimeComment.findOneAndDelete({ _id: commentId, userId: req.user._id });
        if (!comment) return res.status(404).json({ success: false, message: 'Comment not found or unauthorized' });
        
        // Also delete replies
        await AnimeComment.deleteMany({ parentId: commentId });
        
        const updatedUser = await deductXP(req.user._id, 1);
        res.json({ 
            success: true, 
            message: 'Comment deleted · -1 XP',
            xp: updatedUser?.xp,
            level: updatedUser?.level,
            badge: updatedUser?.badge
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Delete failed' });
    }
});

// ── LIBRARY / LOGGING ──
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
        let { externalId, type, status, rating, episodesWatched, chaptersRead, totalEpisodes, totalChapters, airingStatus, notes, title, cover, genre } = req.body;
        
        const oldEntry = await AnimeEntry.findOne({ userId: req.user._id, externalId: parseInt(externalId), type });
        const isNew = !oldEntry;

        const updateData = { status, rating, episodesWatched, chaptersRead, totalEpisodes, totalChapters, airingStatus, notes, title, cover, genre };
        const entry = await AnimeEntry.findOneAndUpdate(
            { userId: req.user._id, externalId: parseInt(externalId), type },
            updateData,
            { upsert: true, returnDocument: 'after' }
        );
        
        const delta = {
            loggedCount: isNew ? 1 : 0,
            ratingCount: (isNew && rating > 0) ? 1 : (!isNew && (oldEntry.rating || 0) === 0 && rating > 0) ? 1 : (!isNew && (oldEntry.rating || 0) > 0 && rating === 0) ? -1 : 0,
            ratingValue: rating - (oldEntry?.rating || 0)
        };
        updateMediaStats(externalId, type, delta);
        
        // XP System integration
        let xpGained = 0;
        let updatedUser = null;
        if (isNew) {
            updatedUser = await awardXP(req.user._id, 1);
            xpGained += 1;
        }
        if (delta.ratingCount === 1) {
            updatedUser = await awardXP(req.user._id, 1);
            xpGained += 1;
        }
        if (delta.ratingCount === -1) {
            updatedUser = await deductXP(req.user._id, 1);
            xpGained -= 1;
        }

        res.json({ 
            success: true, 
            entry,
            xpGained,
            xp: updatedUser?.xp,
            level: updatedUser?.level,
            badge: updatedUser?.badge
        });

        jikanCache.clear();
    } catch (error) {
        res.status(500).json({ success: false, message: 'Log failed' });
    }
});

router.delete('/log/:id', protect, async (req, res) => {
    try {
        const entry = await AnimeEntry.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
        res.json({ success: true, message: 'Entry removed' });

        const delta = {
            loggedCount: -1,
            ratingCount: (entry.rating || 0) > 0 ? -1 : 0,
            ratingValue: -(entry.rating || 0)
        };
        updateMediaStats(entry.externalId, entry.type, delta);
        
        // XP System integration
        let xpGained = 0;
        let updatedUser = null;
        
        // Deduct for removal
        updatedUser = await deductXP(req.user._id, 1); // For log
        xpGained -= 1;
        if ((entry.rating || 0) > 0) {
            updatedUser = await deductXP(req.user._id, 1); // For rating
            xpGained -= 1;
        }

        res.json({ 
            success: true, 
            message: 'Entry removed',
            xpGained,
            xp: updatedUser?.xp,
            level: updatedUser?.level,
            badge: updatedUser?.badge
        });

        jikanCache.clear();
    } catch (error) {
        res.status(500).json({ success: false, message: 'Delete failed' });
    }
});

export default router;
