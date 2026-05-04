import express from 'express'
import { LRUCache } from 'lru-cache'
import { searchGames, getAccessToken } from '../utils/igdb.js'
import Game from '../models/Game.js'
import GameLike from '../models/GameLike.js'
import logger from '../utils/logger.js'
import apiClient from '../utils/apiClient.js'
import { shortPlatform, normalizeCover } from '../utils/helpers.js'
import GlobalList from '../models/GlobalList.js'
import Ranking from '../models/Ranking.js'
import GlobalStats from '../models/GlobalStats.js'
import { syncIGDBLists } from '../tasks/igdbSync.js'
import { protectOptional } from '../middleware/auth.js'

const router = express.Router()

const igdbCache = new LRUCache({
    max: 500,
    ttl: 1000 * 60 * 60 * 12, // 12 hours
})

// 🚀 Request Pooling to prevent redundant external calls
const inFlightRequests = new Map()

// ── GET /api/igdb/search?q=query ──
router.get('/search', protectOptional, async (req, res) => {
    try {
        const query = req.query.q
        const page = parseInt(req.query.page) || 1
        const limit = parseInt(req.query.limit) || 20

        if (!query) return res.status(400).json({ success: false, message: 'Query is required' })

        const cacheKey = `search-${query}-${page}-${limit}`
        if (igdbCache.has(cacheKey)) {
            const cached = igdbCache.get(cacheKey)
            return res.json({ success: true, ...cached })
        }

        // 🚀 Pooling check
        if (inFlightRequests.has(cacheKey)) {
            const data = await inFlightRequests.get(cacheKey)
            return res.json({ success: true, ...data })
        }

        const performSearch = async () => {
            const results = await searchGames(query, page, limit)
            
            // ── FETCH COMMUNITY STATS FOR SEARCH RESULTS (Optional) ──
            const allIds = results.map(g => g.igdbId || g.id).filter(id => typeof id === 'number')
            let stats = {}
            let userRatings = {}

            try {
                if (allIds.length > 0) {
                    const reviewData = await Game.aggregate([
                        { $match: { igdbId: { $in: allIds }, rating: { $gt: 0 } } },
                        { $group: { _id: '$igdbId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
                    ])
                    allIds.forEach(id => {
                        const review = reviewData.find(r => r._id === id)
                        stats[id] = {
                            avgRating: review ? parseFloat(review.avg.toFixed(1)) : null,
                            ratingCount: review?.count || 0
                        }
                    })
                }

                // ── FETCH USER RATINGS IF AUTHENTICATED ──
                if (req.user && allIds.length > 0) {
                    const userGames = await Game.find({
                        userId: req.user._id,
                        igdbId: { $in: allIds }
                    }).select('igdbId rating')
                    userGames.forEach(g => {
                        if (g.rating > 0) userRatings[g.igdbId] = g.rating
                    })
                }
            } catch (dbErr) {
                logger.error('[IGDB Search] Stats enrichment failed:', dbErr.message)
                // Continue without stats/ratings
            }

            const finalResponse = { games: results, stats, userRatings }
            igdbCache.set(cacheKey, finalResponse)
            return finalResponse
        }

        const fetchPromise = performSearch()
        inFlightRequests.set(cacheKey, fetchPromise)
        
        let responseData;
        try {
            responseData = await fetchPromise
        } finally {
            inFlightRequests.delete(cacheKey)
        }

        res.json({ success: true, ...responseData })
    } catch (error) {
        logger.error(`[IGDB Search Route Error] Query: "${req.query.q}":`, error)
        res.status(500).json({ 
            success: false, 
            message: 'IGDB search failed', 
            error: error.message 
        })
    }
})

// ── GET /api/igdb/discover?genre=Action&page=1&limit=24 ──
router.get('/discover', async (req, res) => {
    try {
        const { genre, page = 1, limit = 24 } = req.query
        const pageNum = Math.max(1, parseInt(page) || 1)
        const limitNum = Math.min(50, parseInt(limit) || 24)

        const offset = (pageNum - 1) * limitNum

        const genreFilter = genre && genre.toLowerCase() !== 'all'
            ? ` & (genres.name = "${genre}" | themes.name = "${genre}")`
            : ''

        const where = `where rating != null & rating_count > 20 & cover != null${genreFilter}`

        const token = await getAccessToken()

        const headers = {
            'Client-ID': process.env.IGDB_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain'
        }

        const [gamesRes, countRes] = await Promise.all([
            apiClient.post('https://api.igdb.com/v4/games', `
          fields name, cover.url, genres.name, platforms.name, rating, rating_count, first_release_date;
          ${where};
          sort rating_count desc;
          limit ${limitNum};
          offset ${offset};
        `, { headers, retry: 2, retryDelay: 2000 }),
            apiClient.post('https://api.igdb.com/v4/games/count', `${where};`, { headers, retry: 2, retryDelay: 2000 })
        ])

        const [gamesData, countData] = [gamesRes.data, countRes.data]

        // Uses imported shortPlatform

        // ── CACHE WRAPPER FOR IGDB DATA ONLY ──
        const igdbDataCacheKey = `igdb-discover-v3-${genre}-${pageNum}-${limitNum}`
        let igdbResult = igdbCache.get(igdbDataCacheKey)

        if (!igdbResult) {
            const rawGames = (Array.isArray(gamesData) ? gamesData : []).map(game => ({
                id: game.id,
                title: game.name,
                cover: normalizeCover(game.cover?.url),
                genre: game.genres?.[0]?.name || null,
                platforms: [...new Set(
                    (game.platforms || [])
                        .map(p => shortPlatform(p.name))
                        .filter(Boolean)
                )].slice(0, 4),
                year: game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : null,
                ratingCount: game.rating_count || 0,
            }))

            const total = countData.count || 0
            const totalPages = Math.ceil(total / limitNum)

            igdbResult = { rawGames, total, totalPages }
            igdbCache.set(igdbDataCacheKey, igdbResult, { ttl: 1000 * 60 * 60 * 12 }) // Static data stays 12h
        }

        const { rawGames, total, totalPages } = igdbResult

        // ── FRESH STATS FETCHING (NOT CACHED) ──
        const igdbIds = rawGames.map(g => g.id)
        const avgRatings = await Game.aggregate([
            { $match: { igdbId: { $in: igdbIds }, rating: { $gt: 0 } } },
            { $group: { _id: '$igdbId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
        ])

        const ratingMap = {}
        for (const r of avgRatings) ratingMap[r._id] = { avg: r.avg, count: r.count }

        const games = rawGames.map(g => ({
            ...g,
            avgRating: ratingMap[g.id] ? parseFloat(ratingMap[g.id].avg.toFixed(1)) : null,
            avgRatingCount: ratingMap[g.id]?.count || 0,
        }))

        res.json({
            success: true,
            games,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages
        })
    } catch (error) {
        logger.error('Discover error:', error)
        res.status(500).json({ success: false, message: 'Failed to fetch games', error: error.message })
    }
})

// ── INTERNAL HELPER ──
export const fetchGameDetailById = async (gameId) => {
    try {
        const cacheKey = `game-detail-${gameId}`

        if (igdbCache.has(cacheKey)) {
            return igdbCache.get(cacheKey)
        }

        if (inFlightRequests.has(cacheKey)) {
            return await inFlightRequests.get(cacheKey)
        }

        const performFetch = async () => {
            const token = await getAccessToken()
            const response = await apiClient.post('https://api.igdb.com/v4/games', `
            fields name, cover.url, summary, genres.name,
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
            where id = ${gameId};
            `, {
                headers: {
                    'Client-ID': process.env.IGDB_CLIENT_ID,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'text/plain'
                },
                retry: 3,
                retryDelay: 1000
            })

            const data = response.data
            if (!data || data.length === 0) return null

            const g = data[0]

            const developer = g.involved_companies?.find(c => c.developer)?.company?.name || null
            const publisher = g.involved_companies?.find(c => c.publisher)?.company?.name || null

            const ageRatingMap = {
                1: 'RP', 2: 'EC', 3: 'E', 4: 'E10+',
                5: 'T', 6: 'M', 7: 'AO',
                8: '3', 9: '7', 10: '12', 11: '16', 12: '18'
            }
            const ageRating = g.age_ratings?.[0]
                ? ageRatingMap[g.age_ratings[0].rating] || null
                : null

            const cover = normalizeCover(g.cover?.url, 't_cover_big_2x')

            const screenshots = g.screenshots?.map(s => normalizeCover(s.url, 't_screenshot_big')) || []

            const similarGames = g.similar_games?.slice(0, 6).map(sg => ({
                id: sg.id,
                title: sg.name,
                cover: normalizeCover(sg.cover?.url),
                rating: sg.rating ? (sg.rating / 10).toFixed(1) : null
            })) || []

            const platforms = g.platforms?.map(p => shortPlatform(p.name) || p.name) || []

            // ── Community Stats Fetching ──
            const [wishlistCount, likeCount, loggedCount] = await Promise.all([
                import('../models/Wishlist.js').then(m => m.default.countDocuments({ igdbId: parseInt(gameId) })),
                import('../models/GameLike.js').then(m => m.default.countDocuments({ igdbId: parseInt(gameId) })),
                import('../models/Game.js').then(m => m.default.countDocuments({ igdbId: parseInt(gameId) }))
            ])

            const game = {
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
                videoId: g.videos?.[0]?.video_id || null,
                communityWishlist: wishlistCount,
                communityLikes: likeCount,
                communityLogged: loggedCount
            }

            igdbCache.set(cacheKey, game)
            return game
        }

        const fetchPromise = performFetch()
        inFlightRequests.set(cacheKey, fetchPromise)
        const finalGame = await fetchPromise
        inFlightRequests.delete(cacheKey)
        return finalGame
    } catch (error) {
        logger.error('Failed internal game fetch:', error)
        throw error
    }
}

// ── GET /api/igdb/game/:id ──
router.get('/game/:id', async (req, res) => {
    try {
        const finalGame = await fetchGameDetailById(req.params.id)
        if (!finalGame) return res.status(404).json({ success: false, message: 'Game not found' })
        res.json({ success: true, game: finalGame })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch game details', error: error.message })
    }
})

// ── GET /api/igdb/trending ──
router.get('/trending', async (req, res) => {
    try {
        let list = await GlobalList.findOne({ key: 'trending' })
        if (!list || list.games.length === 0) {
            await syncIGDBLists()
            list = await GlobalList.findOne({ key: 'trending' })
        }
        res.json({ success: true, games: list?.games || [] })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch trending', error: error.message })
    }
})

// ── GET /api/igdb/top-rated ──
router.get('/top-rated', async (req, res) => {
    try {
        let list = await GlobalList.findOne({ key: 'top-rated' })
        if (!list || list.games.length === 0) {
            await syncIGDBLists()
            list = await GlobalList.findOne({ key: 'top-rated' })
        }
        res.json({ success: true, games: list?.games || [] })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch top rated', error: error.message })
    }
})

// ── GET /api/igdb/coming-soon ──
router.get('/coming-soon', async (req, res) => {
    try {
        let list = await GlobalList.findOne({ key: 'coming-soon' })
        if (!list || list.games.length === 0) {
            await syncIGDBLists()
            list = await GlobalList.findOne({ key: 'coming-soon' })
        }
        res.json({ success: true, games: list?.games || [] })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch coming soon', error: error.message })
    }
})

// ── GET /api/igdb/home ─────────────────────────────────────────────────────────
// Single bundled endpoint for the Home page.
// Fires trending + top-rated + coming-soon in parallel, then fetches DB stats
// for all returned game IDs in one batch. Result cached for 12 h.
router.get('/home', async (req, res) => {
    try {
        // 1. Fetch Trending from Rankings (Local) with GlobalList fallback
        let trendingRankings = await Ranking.find({ contentType: 'game', rankType: 'trending' }).sort({ rankPosition: 1 }).limit(15);
        if (trendingRankings.length === 0) {
            const globalTrending = await GlobalList.findOne({ key: 'trending' });
            if (globalTrending) {
                trendingRankings = globalTrending.games.map((g, idx) => ({
                    contentId: String(g.id),
                    title: g.title,
                    cover: g.cover,
                    genres: [g.genre],
                    year: g.year,
                    rankPosition: idx + 1
                }));
            }
        }

        let trending = (trendingRankings || []).map(r => ({
            id: parseInt(r.contentId),
            title: r.title,
            cover: r.cover,
            genre: r.genres?.[0] || (r.genre) || 'Game',
            year: r.year,
            releaseDate: r.year ? `Jan 1, ${r.year}` : null
        }));

        // 2. Fetch Top Rated from Rankings
        let topRatedRankings = await Ranking.find({ contentType: 'game', rankType: 'top_rated' }).sort({ rankPosition: 1 }).limit(15);
        if (topRatedRankings.length === 0) {
            const globalTop = await GlobalList.findOne({ key: 'top-rated' });
            if (globalTop) {
                topRatedRankings = globalTop.games.map((g, idx) => ({
                    contentId: String(g.id),
                    title: g.title,
                    cover: g.cover,
                    genres: [g.genre],
                    year: g.year,
                    rankPosition: idx + 1
                }));
            }
        }

        let topRated = (topRatedRankings || []).map(r => ({
            id: parseInt(r.contentId),
            title: r.title,
            cover: r.cover,
            genre: r.genres?.[0] || (r.genre) || 'Game',
            year: r.year,
            releaseDate: r.year ? `Jan 1, ${r.year}` : null
        }));

        // 4. Fetch Coming Soon from Rankings
        let comingSoonRankings = await Ranking.find({ contentType: 'game', rankType: 'coming_soon' }).sort({ rankPosition: 1 }).limit(15);
        if (comingSoonRankings.length === 0) {
            const globalSoon = await GlobalList.findOne({ key: 'coming-soon' });
            if (globalSoon) {
                comingSoonRankings = globalSoon.games.map((g, idx) => ({
                    contentId: String(g.id),
                    title: g.title,
                    cover: g.cover,
                    genres: [g.genre],
                    year: g.year,
                    rankPosition: idx + 1
                }));
            }
        }

        let comingSoon = (comingSoonRankings || []).map(r => ({
            id: parseInt(r.contentId),
            title: r.title,
            cover: r.cover,
            genre: r.genres?.[0] || (r.genre) || 'Game',
            year: r.year,
            releaseDate: r.year ? `Jan 1, ${r.year}` : null
        }));

        // ── ON-THE-FLY RECOVERY FOR MISSING YEARS ──
        const missingYearIds = [...trending, ...topRated, ...comingSoon]
            .filter(g => !g.year)
            .map(g => g.id);

        if (missingYearIds.length > 0) {
            try {
                const token = await getAccessToken();
                const headers = { 'Client-ID': process.env.IGDB_CLIENT_ID, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' };
                const igdbRes = await apiClient.post('https://api.igdb.com/v4/games', 
                    `fields first_release_date; where id = (${missingYearIds.join(',')});`, 
                    { headers }
                );
                const yearMap = {};
                (igdbRes.data || []).forEach(g => {
                    if (g.first_release_date) {
                        yearMap[g.id] = new Date(g.first_release_date * 1000).getFullYear();
                    }
                });

                // Update the arrays in-memory AND heal the database
                const healingOps = [];
                [trending, topRated, comingSoon].forEach(list => {
                    list.forEach(g => {
                        if (!g.year && yearMap[g.id]) {
                            g.year = yearMap[g.id];
                            g.releaseDate = `Jan 1, ${g.year}`;
                            
                            // Queue DB update
                            healingOps.push(
                                Ranking.updateMany(
                                    { contentId: String(g.id), contentType: 'game' },
                                    { $set: { year: g.year } }
                                )
                            );
                        }
                    });
                });
                if (healingOps.length > 0) Promise.all(healingOps).catch(e => logger.error('[Home Healing] DB update failed:', e.message));
            } catch (err) { logger.error('[Home Year Recovery] Failed:', err.message); }
        }

        // 5. Backfill/Fallback to IGDB API if Rankings have less than 15 items
        if (trending.length < 15 || topRated.length < 15 || comingSoon.length < 15) {
            try {
                const token = await getAccessToken();
                const now = Math.floor(Date.now() / 1000);
                const headers = { 'Client-ID': process.env.IGDB_CLIENT_ID, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' };
                
                const fetchList = async (body) => {
                    const res = await apiClient.post('https://api.igdb.com/v4/games', body, { headers });
                    return (res.data || []).map(g => ({
                        id: g.id,
                        title: g.name,
                        cover: normalizeCover(g.cover?.url),
                        genre: g.genres?.[0]?.name || 'Game',
                        year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
                        releaseDate: g.first_release_date
                            ? new Date(g.first_release_date * 1000).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric'
                            })
                            : null
                    }));
                };

                const [trendLive, topLive, soonLive] = await Promise.all([
                    trending.length < 15 ? fetchList(`fields name, cover.url, genres.name, rating, rating_count; where rating > 70 & rating_count > 50 & cover != null; sort rating_count desc; limit 50;`) : [],
                    topRated.length < 15 ? fetchList(`fields name, cover.url, genres.name, rating, rating_count; where rating > 85 & rating_count > 20 & cover != null; sort rating desc; limit 50;`) : [],
                    comingSoon.length < 15 ? fetchList(`fields name, cover.url, genres.name, first_release_date; where first_release_date >= ${now} & cover != null; sort first_release_date asc; limit 50;`) : []
                ]);

                // Helper to merge and unique
                const mergeUnique = (existing, fetched) => {
                    const ids = new Set(existing.map(i => i.id));
                    const merged = [...existing];
                    for (const item of fetched) {
                        if (!ids.has(item.id) && merged.length < 15) {
                            merged.push(item);
                            ids.add(item.id);
                        }
                    }
                    return merged;
                };

                if (trending.length < 15) trending = mergeUnique(trending, trendLive);
                if (topRated.length < 15) topRated = mergeUnique(topRated, topLive);
                if (comingSoon.length < 15) comingSoon = mergeUnique(comingSoon, soonLive);
            } catch (err) { logger.error('[IGDB Home] Backfill failed:', err.message); }
        }

        // 6. Fetch Fresh Stats for all items
        const allIds = [...trending, ...topRated, ...comingSoon].map(g => g.id).filter(Boolean);
        let gameStats = {};
        if (allIds.length > 0) {
            const stats = await GlobalStats.find({ igdbId: { $in: allIds } });
            (stats || []).forEach(s => {
                gameStats[s.igdbId] = {
                    avgRating: s.avgRating,
                    ratingCount: s.ratingCount,
                    likeCount: s.likeCount,
                    loggedCount: s.loggedCount
                };
            });
        }

        res.json({ success: true, trending, topRated, comingSoon, gameStats })
    } catch (error) {
        logger.error('Home bundle error:', error)
        res.status(500).json({ success: false, message: 'Failed to fetch home data', error: error.message })
    }
})

export default router