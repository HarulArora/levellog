import express from 'express';
import apiClient from '../utils/apiClient.js';
import { LRUCache } from 'lru-cache';
import MovieEntry from '../models/MovieEntry.js';
import MovieComment from '../models/MovieComment.js';
import MovieLike from '../models/MovieLike.js';
import MovieWishlist from '../models/MovieWishlist.js';
import { protect, protectOptional } from '../middleware/auth.js';
import { awardXP, deductXP } from '../utils/xp.js';
import { updateMediaStats, getBulkStats } from '../utils/stats.js';

const router = express.Router();
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const movieCache = new LRUCache({
    max: 200,
    ttl: 1000 * 60 * 60 // 1 hour
});

const fetchMediaStats = getBulkStats;

const formatMovieItem = (item, type) => ({
    id: item.id,
    externalId: item.id,
    title: item.title || item.name,
    cover: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    genre: 'Media', 
    year: (item.release_date || item.first_air_date || '').split('-')[0],
    score: item.vote_average,
    summary: item.overview,
    production: item.production_companies?.map(c => c.name).join(', '),
    language: item.original_language?.toUpperCase(),
    status: item.status,
    type: type
});

const isAnime = (item) => {
    // TMDB Genre 16 is Animation. Combined with original_language 'ja', it's almost always Anime.
    const isAnimation = item.genre_ids?.includes(16) || item.genres?.some(g => g.id === 16);
    const isJapanese = item.original_language === 'ja';
    return isAnimation && isJapanese;
};

// ── HOME ──
router.get('/home', async (req, res) => {
    try {
        const { type = 'movie' } = req.query;
        const cacheKey = `movie-home-${type}`;
        if (movieCache.has(cacheKey)) return res.json({ success: true, ...movieCache.get(cacheKey) });

        const params = { api_key: process.env.TMDB_API_KEY };
        const requestConfig = { params, retry: 3, retryDelay: 2000 };
        const [trendingRes, topRes, upcomingRes] = await Promise.all([
            apiClient.get(`${TMDB_BASE_URL}/trending/${type}/week`, requestConfig),
            apiClient.get(`${TMDB_BASE_URL}/${type}/top_rated`, requestConfig),
            apiClient.get(`${TMDB_BASE_URL}/${type}/${type === 'movie' ? 'upcoming' : 'on_the_air'}`, requestConfig)
        ]);

        const trending = trendingRes.data.results
            .filter(item => !isAnime(item))
            .map(item => formatMovieItem(item, type))
            .slice(0, 12);
        const topRated = topRes.data.results
            .filter(item => !isAnime(item))
            .map(item => formatMovieItem(item, type))
            .slice(0, 12);
        const upcoming = upcomingRes.data.results
            .filter(item => !isAnime(item))
            .map(item => formatMovieItem(item, type))
            .slice(0, 12);

        const allIds = [...trending, ...topRated, ...upcoming].map(i => i.externalId);
        const stats = await fetchMediaStats(allIds, type);

        const sections = [
            { title: `Trending ${type === 'movie' ? 'Movies' : 'TV Shows'}`, items: trending },
            { title: `Top Rated ${type === 'movie' ? 'Movies' : 'TV Shows'}`, items: topRated },
            { title: type === 'movie' ? 'Upcoming Movies' : 'Airing Today', items: upcoming }
        ];
        
        const result = { sections, stats };
        movieCache.set(cacheKey, result);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Movie Home Error:', error.message);
        res.status(500).json({ success: false, message: 'Home failed' });
    }
});

// ── SEARCH ──
router.get('/search', async (req, res) => {
    try {
        const { q, type = 'movie' } = req.query;
        if (!q) return res.status(400).json({ success: false, message: 'Query is required' });

        const cacheKey = `search-${type}-${q}`;
        if (movieCache.has(cacheKey)) return res.json({ success: true, ...movieCache.get(cacheKey) });

        const params = { 
            api_key: process.env.TMDB_API_KEY,
            query: q,
            include_adult: false
        };
        
        const endpoint = type === 'movie' ? 'search/movie' : 'search/tv';
        const response = await apiClient.get(`${TMDB_BASE_URL}/${endpoint}`, { params, retry: 3, retryDelay: 1000 });

        const results = response.data.results
            .filter(item => !isAnime(item))
            .map(item => formatMovieItem(item, type));
        
        const stats = await fetchMediaStats(results.map(r => r.externalId), type);
        const result = { results, stats };
        movieCache.set(cacheKey, result);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Movie Search Error:', error.message);
        res.status(500).json({ success: false, message: 'Search failed' });
    }
});

// ── DISCOVER ──
router.get('/discover', async (req, res) => {
    try {
        const { type = 'movie', genre, page = 1 } = req.query;
        const cacheKey = `movie-discover-${type}-${genre || 'all'}-${page}`;
        if (movieCache.has(cacheKey)) return res.json({ success: true, ...movieCache.get(cacheKey) });

        const params = { api_key: process.env.TMDB_API_KEY, page: parseInt(page), include_adult: false };
        const requestConfig = { params, retry: 3, retryDelay: 1000 };

        if (genre) {
            // Genre search uses discover endpoint
            const response = await apiClient.get(`${TMDB_BASE_URL}/discover/${type}`, { 
                params: { ...params, with_genres: genre, sort_by: 'popularity.desc' } 
            });
            const results = response.data.results.filter(item => !isAnime(item)).map(item => formatMovieItem(item, type));
            const stats = await fetchMediaStats(results.map(r => r.externalId), type);
            const result = { 
                items: results, 
                stats,
                totalPages: response.data.total_pages > 500 ? 500 : response.data.total_pages, // TMDB limit
                total: response.data.total_results
            };
            movieCache.set(cacheKey, result);
            return res.json({ success: true, ...result });
        }

        const [popularRes, nowPlayingRes, topRes] = await Promise.all([
            apiClient.get(`${TMDB_BASE_URL}/${type}/popular`, requestConfig),
            apiClient.get(`${TMDB_BASE_URL}/${type}/${type === 'movie' ? 'now_playing' : 'airing_today'}`, requestConfig),
            apiClient.get(`${TMDB_BASE_URL}/${type}/top_rated`, requestConfig)
        ]);

        const sections = [
            { title: `Popular ${type === 'movie' ? 'Movies' : 'TV Shows'}`, items: popularRes.data.results.filter(item => !isAnime(item)).map(item => formatMovieItem(item, type)) },
            { title: type === 'movie' ? 'In Theaters' : 'Airing Today', items: nowPlayingRes.data.results.filter(item => !isAnime(item)).map(item => formatMovieItem(item, type)) },
            { title: `Critics Choice`, items: topRes.data.results.filter(item => !isAnime(item)).map(item => formatMovieItem(item, type)) }
        ];

        const allIds = sections.flatMap(s => s.items).map(i => i.externalId);
        const stats = await fetchMediaStats(allIds, type);

        const result = { sections, stats };
        movieCache.set(cacheKey, result);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Movie Discover Error:', error.message);
        res.status(500).json({ success: false, message: 'Discover failed' });
    }
});

// ── GENRES ──
router.get('/genres', async (req, res) => {
    try {
        const { type = 'movie' } = req.query;
        const cacheKey = `movie-genres-${type}`;
        if (movieCache.has(cacheKey)) return res.json({ success: true, genres: movieCache.get(cacheKey) });

        const response = await apiClient.get(`${TMDB_BASE_URL}/genre/${type}/list`, {
            params: { api_key: process.env.TMDB_API_KEY }
        });

        const genres = response.data.genres.map(g => ({ label: g.name, id: g.id }));
        movieCache.set(cacheKey, genres);
        res.json({ success: true, genres });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Genres failed' });
    }
});

// ── DETAIL ──
router.get('/detail/:id', protectOptional, async (req, res) => {
    try {
        const { id } = req.params;
        const { type = 'movie' } = req.query;
        const userId = req.user?._id;

        const cacheKey = `movie-detail-v3-${type}-${id}`;
        let movie = movieCache.get(cacheKey);

        if (!movie) {
            const params = { api_key: process.env.TMDB_API_KEY, append_to_response: 'videos,images,recommendations,credits,watch/providers' };
            const response = await apiClient.get(`${TMDB_BASE_URL}/${type}/${id}`, { params, retry: 3, retryDelay: 1000 });
            movie = formatMovieItem(response.data, type);
            movie.watchProviders = response.data['watch/providers']?.results || {};
            movie.genres = response.data.genres?.map(g => g.name) || [];
            movie.runtime = response.data.runtime;
            movie.seasonsCount = response.data.number_of_seasons;
            movie.trailer = response.data.videos?.results?.find(v => v.type === 'Trailer')?.key || 
                            response.data.videos?.results?.find(v => v.type === 'Teaser')?.key ||
                            response.data.videos?.results?.[0]?.key;
            movie.screenshots = response.data.images?.backdrops?.slice(0, 8).map(img => `https://image.tmdb.org/t/p/original${img.file_path}`) || [];
            movie.cast = response.data.credits?.cast?.slice(0, 24).map(c => ({
                name: c.name,
                role: c.character,
                image: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
                popularity: c.popularity
            })) || [];
            movie.similar = response.data.recommendations?.results
                ?.filter(item => !isAnime(item))
                ?.slice(0, 6).map(r => ({
                id: r.id,
                title: r.title || r.name,
                cover: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null
            })) || [];
            
            movieCache.set(cacheKey, movie);
        }

        const [statsAgg, like, wishlist] = await Promise.all([
            MovieEntry.aggregate([
                { $match: { externalId: parseInt(id), type } },
                { $group: { _id: '$externalId', avgRating: { $avg: { $cond: [{ $gt: ['$rating', 0] }, '$rating', null] } }, ratingCount: { $sum: { $cond: [{ $gt: ['$rating', 0] }, 1, 0] } }, loggedCount: { $sum: 1 } }}
            ]),
            userId ? MovieLike.findOne({ userId, externalId: parseInt(id), type }) : null,
            userId ? MovieWishlist.findOne({ userId, externalId: parseInt(id), type }) : null
        ]);

        const likeCount = await MovieLike.countDocuments({ externalId: parseInt(id), type });
        const wishlistCount = await MovieWishlist.countDocuments({ externalId: parseInt(id), type });

        const stats = statsAgg[0] ? {
            avgRating: statsAgg[0].avgRating ? parseFloat(statsAgg[0].avgRating.toFixed(1)) : null,
            ratingCount: statsAgg[0].ratingCount,
            loggedCount: statsAgg[0].loggedCount,
            likeCount,
            wishlistCount
        } : { avgRating: null, ratingCount: 0, loggedCount: 0, likeCount, wishlistCount };

        res.json({ success: true, movie, stats, userStatus: { liked: !!like, wishlisted: !!wishlist } });
    } catch (error) {
        console.error('Movie Detail Error:', error.message);
        res.status(500).json({ success: false, message: 'Detail failed' });
    }
});

// ── LIKE / WISHLIST ──
router.post('/like', protect, async (req, res) => {
    try {
        const { externalId, title, cover, type, genre } = req.body;
        const existing = await MovieLike.findOne({ userId: req.user._id, externalId: parseInt(externalId), type });
        if (existing) {
            await existing.deleteOne();
            updateMediaStats(externalId, type, { likeCount: -1 });
            await deductXP(req.user._id, 1);
            return res.json({ success: true, liked: false, message: 'Like removed · -1 XP' });
        }
        await MovieLike.create({ userId: req.user._id, externalId: parseInt(externalId), type, title, cover, genre });
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
        movieCache.delete(`movie-home-${type}`);
        movieCache.delete(`movie-detail-${type}-${externalId}`);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Like failed' });
    }
});

router.post('/wishlist', protect, async (req, res) => {
    try {
        const { externalId, title, cover, type, genre } = req.body;
        const existing = await MovieWishlist.findOne({ userId: req.user._id, externalId: parseInt(externalId), type });
        if (existing) {
            await existing.deleteOne();
            updateMediaStats(externalId, type, { wishlistCount: -1 });
            return res.json({ success: true, wishlisted: false });
        }
        await MovieWishlist.create({ userId: req.user._id, externalId: parseInt(externalId), type, title, cover, genre });
        updateMediaStats(externalId, type, { wishlistCount: 1 });
        res.json({ success: true, wishlisted: true });
        movieCache.delete(`movie-home-${type}`);
        movieCache.delete(`movie-detail-${type}-${externalId}`);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Wishlist failed' });
    }
});

// ── ACTIVITY ──
router.get('/activity/:userId', protect, async (req, res) => {
    try {
        const entries = await MovieEntry.find({ userId: req.params.userId })
            .select('title cover status rating episodesWatched seasonsWatched externalId type createdAt updatedAt')
            .sort({ updatedAt: -1 })
            .limit(20)
            .lean();
        
        const activity = [];
        entries.forEach(item => {
            const itemInfo = { title: item.title, cover: item.cover, id: item._id, externalId: item.externalId, mediaType: item.type };

            if (item.status === 'completed') {
                activity.push({ type: 'completed', movie: itemInfo, rating: item.rating > 0 ? item.rating : null, time: item.updatedAt });
            } else if (item.status === 'playing') {
                activity.push({ type: 'playing', movie: itemInfo, time: item.updatedAt });
            } else if (item.status === 'dropped') {
                activity.push({ type: 'dropped', movie: itemInfo, time: item.updatedAt });
            } else if (item.status === 'planned') {
                activity.push({ type: 'planned', movie: itemInfo, time: item.createdAt });
            } else if (item.status === 'paused') {
                activity.push({ type: 'paused', movie: itemInfo, time: item.updatedAt });
            }

            if (item.rating > 0 && item.status !== 'completed') {
                activity.push({ type: 'rated', movie: itemInfo, rating: item.rating, time: item.updatedAt });
            }
        });

        activity.sort((a, b) => new Date(b.time) - new Date(a.time));
        res.json({ success: true, activity: activity.slice(0, 20) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch activity' });
    }
});

// ── COMMENTS ──
router.get('/comments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type = 'movie' } = req.query;
        const comments = await MovieComment.find({ externalId: parseInt(id), type, parentId: null })
            .populate('userId', 'username avatar badge level')
            .sort({ createdAt: -1 });
        
        const commentsWithReplies = await Promise.all(comments.map(async (c) => {
            const replies = await MovieComment.find({ parentId: c._id }).populate('userId', 'username avatar badge level').sort({ createdAt: 1 });
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
        const { text, parentId, type = 'movie' } = req.body;
        const comment = await MovieComment.create({
            userId: req.user._id,
            externalId: parseInt(id),
            type,
            text,
            parentId: parentId || null
        });
        res.json({ success: true, comment });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Comment post failed' });
    }
});

router.put('/comments/:commentId', protect, async (req, res) => {
    try {
        const { commentId } = req.params;
        const { text } = req.body;
        const comment = await MovieComment.findOneAndUpdate(
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
        const comment = await MovieComment.findOneAndDelete({ _id: commentId, userId: req.user._id });
        if (!comment) return res.status(404).json({ success: false, message: 'Comment not found or unauthorized' });
        
        // Also delete replies
        await MovieComment.deleteMany({ parentId: commentId });
        
        res.json({ success: true, message: 'Comment deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Delete failed' });
    }
});

// ── LIBRARY ──
router.get('/library', protect, async (req, res) => {
    try {
        const library = await MovieEntry.find({ userId: req.user._id }).sort({ updatedAt: -1 });
        
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
        const { externalId, type, status, rating, seasonsWatched, episodesWatched, totalEpisodes, totalSeasons, notes, title, cover, genre } = req.body;
        
        const oldEntry = await MovieEntry.findOne({ userId: req.user._id, externalId: parseInt(externalId), type });
        const isNew = !oldEntry;

        const updateData = { status, rating, seasonsWatched, episodesWatched, totalEpisodes, totalSeasons, notes, title, cover, genre, type };
        const entry = await MovieEntry.findOneAndUpdate(
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

        movieCache.clear();
    } catch (error) {
        res.status(500).json({ success: false, message: 'Log failed' });
    }
});

router.delete('/log/:id', protect, async (req, res) => {
    try {
        const entry = await MovieEntry.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
        
        const delta = {
            loggedCount: -1,
            ratingCount: entry.rating > 0 ? -1 : 0,
            ratingValue: -entry.rating
        };
        updateMediaStats(entry.externalId, entry.type, delta);
        
        // XP System integration
        let xpGained = 0;
        let updatedUser = null;
        
        // Deduct for removal
        updatedUser = await deductXP(req.user._id, 1); // For log
        xpGained -= 1;
        if (entry.rating > 0) {
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

        movieCache.clear();
    } catch (error) {
        res.status(500).json({ success: false, message: 'Delete failed' });
    }
});

export default router;
