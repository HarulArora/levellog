import express from 'express';
import mongoose from 'mongoose';
import apiClient from '../utils/apiClient.js';
import { LRUCache } from 'lru-cache';
import MovieEntry from '../models/MovieEntry.js';
import MovieComment from '../models/MovieComment.js';
import MovieCommentLike from '../models/MovieCommentLike.js';
import MovieLike from '../models/MovieLike.js';
import MovieWishlist from '../models/MovieWishlist.js';
import MediaStats from '../models/MediaStats.js';
import Ranking from '../models/Ranking.js';
import { protect, protectOptional } from '../middleware/auth.js';
import { awardXP, deductXP } from '../utils/xp.js';
import { updateMediaStats, getBulkStats } from '../utils/stats.js';
import { logEngagement } from '../utils/engagement.js';
import { withRetryTransaction } from '../utils/transaction.js';

const router = express.Router();
const TMDB_BASE_URL = 'http://api.themoviedb.org/3';

const movieCache = new LRUCache({
    max: 200,
    ttl: 1000 * 60 * 60 * 12 // 12 hours
});

const fetchMediaStats = getBulkStats;


const fetchTMDBPaginated = async (endpoint, params, page, limit, filterFn = null) => {
    const requestedLimit = parseInt(limit) || 24;
    const requestedPage = parseInt(page) || 1;
    const tmdbPageSize = 20;
    
    // To ensure we have enough items after filtering, we fetch an extra buffer page.
    // We fetch the 'theoretical' pages needed plus one more.
    const startOffset = (requestedPage - 1) * requestedLimit;
    const endOffset = requestedPage * requestedLimit;
    
    const startTMDBPage = Math.floor(startOffset / tmdbPageSize) + 1;
    const endTMDBPage = Math.floor((endOffset - 1) / tmdbPageSize) + 1;
    
    // Fetch 3 pages to provide a good buffer for filtering
    const pagesToFetch = [startTMDBPage, startTMDBPage + 1, startTMDBPage + 2];
    
    const responses = await Promise.all(pagesToFetch.map(p => 
        apiClient.get(endpoint, { 
            params: { ...params, page: p },
            retry: 3 
        })
    ));
    
    let allResults = [];
    responses.forEach(res => {
        allResults = allResults.concat(res.data.results || []);
    });
    
    // Apply filter if provided
    let filteredResults = filterFn ? allResults.filter(item => !filterFn(item)) : allResults;
    
    // Calculate the slice. 
    // Since we are fetching from a calculated startTMDBPage, we need to find the 
    // relative offset. This isn't perfectly accurate across all pages if filtering 
    // is heavy, but for TMDB movies it's very reliable.
    const firstItemTMDBIndex = (startTMDBPage - 1) * tmdbPageSize;
    const relativeOffset = startOffset - firstItemTMDBIndex;
    
    const slicedResults = filteredResults.slice(relativeOffset, relativeOffset + requestedLimit);
    
    const totalResults = responses[0].data.total_results || 0;
    const totalPages = Math.ceil(totalResults / requestedLimit);
    
    return {
        results: slicedResults,
        total: totalResults,
        totalPages: totalPages > 500 ? 500 : totalPages
    };
};

const TMDB_GENRES = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama',
    10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
    878: 'Sci-Fi', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
    10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
    10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

const formatMovieItem = (item, type) => {
    // Try genre_ids first (search results), then genres array (details), then genres string if it exists
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
    // TMDB Genre 16 is Animation.
    // We check for Japanese origin via original_language or origin_country.
    const isAnimation = item.genre_ids?.includes(16) || item.genres?.some(g => g.id === 16);
    const isJapanese = item.original_language === 'ja' || (item.origin_country && item.origin_country.includes('JP'));
    return isAnimation && isJapanese;
};

// ── HOME ──
router.get('/home', async (req, res) => {
    try {
        const { type = 'movie' } = req.query;
        const cacheKey = `movie-home-${type}`;
        if (movieCache.has(cacheKey)) return res.json({ success: true, ...movieCache.get(cacheKey) });
        const [trendingRankings, topRatedRankings, upcomingRankings] = await Promise.all([
            Ranking.find({ contentType: type, rankType: 'trending' }).sort({ rankPosition: 1 }).limit(15),
            Ranking.find({ contentType: type, rankType: 'top_rated' }).sort({ rankPosition: 1 }).limit(15),
            Ranking.find({ contentType: type, rankType: 'coming_soon' }).sort({ rankPosition: 1 }).limit(15)
        ]);

        let trending = (trendingRankings || []).map(r => ({
            id: parseInt(r.contentId),
            externalId: parseInt(r.contentId),
            title: r.title,
            cover: r.cover,
            year: r.year,
            genre: r.genres?.[0] || (type === 'movie' ? 'Movie' : 'TV Show'),
            genres: r.genres || [],
            avgRating: r.avgRating || 0,
            score: r.score || 0,
            type: type
        }));

        let topRated = (topRatedRankings || []).map(r => ({
            id: parseInt(r.contentId),
            externalId: parseInt(r.contentId),
            title: r.title,
            cover: r.cover,
            year: r.year,
            genre: r.genres?.[0] || (type === 'movie' ? 'Movie' : 'TV Show'),
            genres: r.genres || [],
            avgRating: r.avgRating || 0,
            score: r.score || 0,
            type: type
        }));

        let upcoming = (upcomingRankings || []).map(r => ({
            id: parseInt(r.contentId),
            externalId: parseInt(r.contentId),
            title: r.title,
            cover: r.cover,
            year: r.year,
            genre: r.genres?.[0] || (type === 'movie' ? 'Movie' : 'TV Show'),
            genres: r.genres || [],
            avgRating: r.avgRating || 0,
            score: r.score || 0,
            type: type
        }));

        // 4. Backfill/Fallback for Trending/Top/Upcoming if Ranking has less than 15 items
        if (trending.length < 15 || topRated.length < 15 || upcoming.length < 15) {
            const [trendFallback, topFallback, soonFallback] = await Promise.all([
                trending.length < 15 ? apiClient.get(`${TMDB_BASE_URL}/trending/${type}/week`, { params: { api_key: process.env.TMDB_API_KEY }, retry: 3 }).catch(() => ({ data: { results: [] } })) : { data: { results: [] } },
                topRated.length < 15 ? apiClient.get(`${TMDB_BASE_URL}/${type}/top_rated`, { params: { api_key: process.env.TMDB_API_KEY }, retry: 3 }).catch(() => ({ data: { results: [] } })) : { data: { results: [] } },
                upcoming.length < 15 ? apiClient.get(`${TMDB_BASE_URL}/${type}/${type === 'movie' ? 'upcoming' : 'on_the_air'}`, { params: { api_key: process.env.TMDB_API_KEY }, retry: 3 }).catch(() => ({ data: { results: [] } })) : { data: { results: [] } }
            ]);

            const mergeUnique = (existing, fetchedRaw) => {
                const fetched = (fetchedRaw || []).filter(item => !isAnime(item)).map(item => formatMovieItem(item, type));
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

            if (trending.length < 15) trending = mergeUnique(trending, trendFallback.data?.results);
            if (topRated.length < 15) topRated = mergeUnique(topRated, topFallback.data?.results);
            if (upcoming.length < 15) upcoming = mergeUnique(upcoming, soonFallback.data?.results);
        }

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
router.get('/search', protectOptional, async (req, res) => {
    try {
        const { q, type = 'movie' } = req.query;
        if (!q) return res.status(400).json({ success: false, message: 'Query is required' });

        const cacheKey = `search-${type}-${q}-${req.query.page || 1}`;
        if (movieCache.has(cacheKey)) return res.json({ success: true, ...movieCache.get(cacheKey) });

        const endpoint = type === 'movie' ? 'search/movie' : 'search/tv';
        const { results: tmdbResults, total, totalPages } = await fetchTMDBPaginated(
            `${TMDB_BASE_URL}/${endpoint}`, 
            { api_key: process.env.TMDB_API_KEY, query: q, include_adult: false },
            req.query.page || 1,
            req.query.limit || 24,
            isAnime
        );

        const results = tmdbResults.map(item => formatMovieItem(item, type));
        
        const stats = await fetchMediaStats(results.map(r => r.externalId), type);

        // ── FETCH USER RATINGS IF AUTHENTICATED ──
        let userRatings = {}
        if (req.user && results.length > 0) {
            const userEntries = await MovieEntry.find({
                userId: req.user._id,
                externalId: { $in: results.map(r => r.externalId) },
                type
            }).select('externalId rating')
            userEntries.forEach(e => {
                if (e.rating > 0) userRatings[e.externalId] = e.rating
            })
        }

        const result = { results, stats, total, totalPages, userRatings };
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

        const { results: tmdbResults, total, totalPages } = await fetchTMDBPaginated(
            `${TMDB_BASE_URL}/discover/${type}`,
            { api_key: process.env.TMDB_API_KEY, with_genres: genre, sort_by: 'popularity.desc', include_adult: false },
            page,
            req.query.limit || 24,
            isAnime
        );

        const results = tmdbResults.map(item => formatMovieItem(item, type));
        const stats = await fetchMediaStats(results.map(r => r.externalId), type);
        const result = { items: results, stats, total, totalPages };
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
        console.error('Genres API Error:', error.message);
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
            movie.totalSeasons = response.data.number_of_seasons || 0;
            movie.totalEpisodes = response.data.number_of_episodes || 0;
            movie.seasonsCount = movie.totalSeasons;
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

        const [mediaStats, like, wishlist] = await Promise.all([
            MediaStats.findOne({ externalId: parseInt(id), type }),
            userId ? MovieLike.findOne({ userId, externalId: parseInt(id), type }) : null,
            userId ? MovieWishlist.findOne({ userId, externalId: parseInt(id), type }) : null
        ]);

        const stats = mediaStats ? {
            avgRating: mediaStats.avgRating,
            ratingCount: mediaStats.ratingCount,
            loggedCount: mediaStats.loggedCount,
            likeCount: mediaStats.likeCount,
            wishlistCount: mediaStats.wishlistCount
        } : { avgRating: null, ratingCount: 0, loggedCount: 0, likeCount: 0, wishlistCount: 0 };

        res.json({ success: true, movie, stats, userStatus: { liked: !!like, wishlisted: !!wishlist } });

        // Log view engagement
        logEngagement(id, type, 'view', userId);
    } catch (error) {
        console.error('Movie Detail Error:', error.message);
        res.status(500).json({ success: false, message: 'Detail failed' });
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
router.get('/comments/:id', protectOptional, async (req, res) => {
    try {
        const { id } = req.params;
        const { type = 'movie' } = req.query;
        const userId = req.user?._id;

        const comments = await MovieComment.find({ externalId: parseInt(id), type, parentId: null })
            .populate('userId', 'username avatar badge level')
            .sort({ createdAt: -1 });
        
        const commentsWithReplies = await Promise.all(comments.map(async (c) => {
            const replies = await MovieComment.find({ parentId: c._id }).populate('userId', 'username avatar badge level').sort({ createdAt: 1 });
            
            // If user is logged in, check if they liked/disliked this comment and its replies
            let userLike = null;
            if (userId) {
                userLike = await MovieCommentLike.findOne({ commentId: c._id, userId });
            }

            const repliesWithStatus = await Promise.all(replies.map(async (r) => {
                let rUserLike = null;
                if (userId) {
                    rUserLike = await MovieCommentLike.findOne({ commentId: r._id, userId });
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
            const comment = await MovieComment.create([{
                externalId: parseInt(id),
                userId: req.user._id,
                text,
                type: type || 'movie',
                parentId: parentId || null
            }], { session });

            const populated = await MovieComment.findById(comment[0]._id)
                .populate('userId', 'username avatar badge level')
                .session(session);

            const updatedUser = await awardXP(req.user._id, 1, session);
            await logEngagement(id, type || 'movie', 'comment', req.user._id, { session });

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
        console.error('Movie Comment Post Error:', error);
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
        const { type: likeType } = req.body; // 'like' or 'dislike'
        const userId = req.user._id;

        const result = await withRetryTransaction(async (session) => {
            const comment = await MovieComment.findById(commentId).session(session);
            if (!comment) throw new Error('Comment not found');

            const existing = await MovieCommentLike.findOne({ commentId, userId }).session(session);

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
                await MovieCommentLike.create([{ commentId, userId, type: likeType }], { session });
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
        console.error('Movie Comment Like Error:', error);
        res.status(500).json({ success: false, message: 'Action failed' });
    }
});

router.delete('/comments/:commentId', protect, async (req, res) => {
    try {
        const { commentId } = req.params;
        
        const result = await withRetryTransaction(async (session) => {
            const comment = await MovieComment.findOne({ _id: commentId, userId: req.user._id }).session(session);
            if (!comment) throw new Error('Comment not found');

            const replies = await MovieComment.find({ parentId: comment._id }).session(session);
            for (const reply of replies) {
                await deductXP(reply.userId, 1, session);
            }
            await MovieComment.deleteMany({ parentId: comment._id }, { session });
            await MovieCommentLike.deleteMany({ commentId: comment._id }, { session });
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
        console.error('Movie Comment Delete Error:', error);
        res.status(500).json({ success: false, message: 'Delete failed' });
    }
});

// ── LIBRARY ──
router.get('/user/:userId', async (req, res) => {
    try {
        const library = await MovieEntry.find({ userId: req.params.userId }).sort({ updatedAt: -1 });
        
        // Populate legacy fields for frontend compatibility
        const sanitizedLibrary = await Promise.all(library.map(async (entry) => {
            const obj = entry.toObject();
            if (!obj.cover && obj.coverImage) obj.cover = obj.coverImage;
            if (!obj.type && obj.mediaType) obj.type = obj.mediaType;

            // Heal generic genres if possible
            const isGeneric = !obj.genre || ['movie', 'tv show', 'series'].includes(obj.genre.toLowerCase());
            if (isGeneric && obj.externalId) {
                try {
                    const endpoint = obj.type === 'movie' ? `movie/${obj.externalId}` : `tv/${obj.externalId}`;
                    const tmdbRes = await apiClient.get(`${TMDB_BASE_URL}/${endpoint}`, {
                        params: { api_key: process.env.TMDB_API_KEY },
                        retry: 1
                    });
                    const fresh = formatMovieItem(tmdbRes.data, obj.type);
                    if (fresh.genre && !['movie', 'tv show', 'series'].includes(fresh.genre.toLowerCase())) {
                        obj.genre = fresh.genre;
                        // Save back to DB asynchronously to fix it permanently
                        MovieEntry.updateOne({ _id: obj._id }, { genre: fresh.genre }).catch(e => console.error('Genre heal save error:', e));
                    }
                } catch (e) { /* ignore */ }
            }
            return obj;
        }));

        res.json({ success: true, games: sanitizedLibrary }); // Named "games" for profile component compatibility
    } catch (error) {
        res.status(500).json({ success: false, message: 'Library fetch failed' });
    }
});

router.get('/library', protect, async (req, res) => {
    try {
        const library = await MovieEntry.find({ userId: req.user._id }).sort({ updatedAt: -1 });
        
        // Populate legacy fields for frontend compatibility
        const sanitizedLibrary = await Promise.all(library.map(async (entry) => {
            const obj = entry.toObject();
            if (!obj.cover && obj.coverImage) obj.cover = obj.coverImage;
            if (!obj.type && obj.mediaType) obj.type = obj.mediaType;

            // Heal generic genres if possible
            const isGeneric = !obj.genre || ['movie', 'tv show', 'series'].includes(obj.genre.toLowerCase());
            if (isGeneric && obj.externalId) {
                try {
                    const endpoint = obj.type === 'movie' ? `movie/${obj.externalId}` : `tv/${obj.externalId}`;
                    const tmdbRes = await apiClient.get(`${TMDB_BASE_URL}/${endpoint}`, {
                        params: { api_key: process.env.TMDB_API_KEY },
                        retry: 1
                    });
                    const fresh = formatMovieItem(tmdbRes.data, obj.type);
                    if (fresh.genre && !['movie', 'tv show', 'series'].includes(fresh.genre.toLowerCase())) {
                        obj.genre = fresh.genre;
                        // Save back to DB asynchronously to fix it permanently
                        MovieEntry.updateOne({ _id: obj._id }, { genre: fresh.genre }).catch(e => console.error('Genre heal save error:', e));
                    }
                } catch (e) { /* ignore */ }
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
        const { externalId, type, status, rating, seasonsWatched, episodesWatched, totalEpisodes, totalSeasons, notes, title, cover, genre, year } = req.body;
        
        const result = await withRetryTransaction(async (session) => {
            const oldEntry = await MovieEntry.findOne({ userId: req.user._id, externalId: parseInt(externalId), type }).session(session);
            const isNew = !oldEntry;

            const updateData = { status, rating, seasonsWatched, episodesWatched, totalEpisodes, totalSeasons, notes, title, cover, genre, type, year };
            const entry = await MovieEntry.findOneAndUpdate(
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

        movieCache.clear();
    } catch (error) {
        console.error('Movie Log Error:', error);
        res.status(500).json({ success: false, message: 'Log failed' });
    }
});

router.delete('/log/:id', protect, async (req, res) => {
    try {
        const result = await withRetryTransaction(async (session) => {
            const entry = await MovieEntry.findOneAndDelete({ _id: req.params.id, userId: req.user._id }).session(session);
            if (!entry) throw new Error('Entry not found');
            
            const delta = {
                loggedCount: -1,
                ratingCount: entry.rating > 0 ? -1 : 0,
                ratingValue: -entry.rating
            };
            await updateMediaStats(entry.externalId, entry.type, delta, session);
            
            await deductXP(req.user._id, 1, session); // For log
            let updatedUser = req.user;
            if (entry.rating > 0) {
                updatedUser = await deductXP(req.user._id, 1, session); // For rating
            } else {
                updatedUser = await awardXP(req.user._id, 0, session); // Just to get state
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

        movieCache.clear();
    } catch (error) {
        console.error('Movie Delete Log Error:', error);
        res.status(500).json({ success: false, message: 'Delete failed' });
    }
});

export default router;
