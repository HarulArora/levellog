import express from 'express'
import { LRUCache } from 'lru-cache'
import { searchGames, getAccessToken } from '../utils/igdb.js'
import Game from '../models/Game.js'
import GameLike from '../models/GameLike.js'
import logger from '../utils/logger.js'
import apiClient from '../utils/apiClient.js'
import { shortPlatform, normalizeCover } from '../utils/helpers.js'
import GlobalList from '../models/GlobalList.js'
import { syncIGDBLists } from '../tasks/igdbSync.js'

const router = express.Router()

const igdbCache = new LRUCache({
    max: 500,
    ttl: 1000 * 60 * 60 * 12, // 12 hours
})

// 🚀 Request Pooling to prevent redundant external calls
const inFlightRequests = new Map()

// ── GET /api/igdb/search?q=query ──
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q
        if (!query) return res.status(400).json({ success: false, message: 'Query is required' })
        
        const cacheKey = `search-${query}`
        if (igdbCache.has(cacheKey)) return res.json({ success: true, ...igdbCache.get(cacheKey) })
        
        // 🚀 Pooling check
        if (inFlightRequests.has(cacheKey)) {
            const data = await inFlightRequests.get(cacheKey)
            return res.json({ success: true, games: data })
        }
        
        const performSearch = async () => {
            const raw = await searchGames(query)
            const normCover = (c) => normalizeCover(c)
            const results = (raw || []).map(g => {
                const genreNames = g.genres
                    ? (Array.isArray(g.genres)
                        ? g.genres.map(x => typeof x === 'string' ? x : x.name).filter(Boolean)
                        : [g.genres])
                    : (g.genre ? [g.genre] : [])
                return {
                    id: g.igdbId || g.id,
                    igdbId: g.igdbId || g.id,
                    title: g.title || g.name || 'Unknown',
                    cover: normCover(g.cover),
                    genre: genreNames[0] || null,
                    genres: genreNames,
                    releaseYear: g.releaseYear || (g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null),
                    rating: g.rating != null ? g.rating : (g.igdbRating != null ? g.igdbRating : null),
                    platforms: g.platforms || [],
                    summary: g.summary || g.description || '',
                }
            })
            igdbCache.set(cacheKey, { games: results })
            return results
        }

        const fetchPromise = performSearch()
        inFlightRequests.set(cacheKey, fetchPromise)
        const finalGames = await fetchPromise
        inFlightRequests.delete(cacheKey)

        res.json({ success: true, games: finalGames })
    } catch (error) {
        res.status(500).json({ success: false, message: 'IGDB search failed', error: error.message })
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
        const igdbDataCacheKey = `igdb-discover-v2-${genre}-${pageNum}-${limitNum}`
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
        let [trendingDoc, topRatedDoc, comingSoonDoc] = await Promise.all([
            GlobalList.findOne({ key: 'trending' }),
            GlobalList.findOne({ key: 'top-rated' }),
            GlobalList.findOne({ key: 'coming-soon' })
        ])

        // If any list is empty, trigger a background sync and use fallback or wait
        if (!trendingDoc || !topRatedDoc || !comingSoonDoc) {
            await syncIGDBLists()
            // Re-fetch after sync
            ;[trendingDoc, topRatedDoc, comingSoonDoc] = await Promise.all([
                GlobalList.findOne({ key: 'trending' }),
                GlobalList.findOne({ key: 'top-rated' }),
                GlobalList.findOne({ key: 'coming-soon' })
            ])
        }

        const trending = trendingDoc?.games || []
        const topRated = topRatedDoc?.games || []
        const comingSoon = comingSoonDoc?.games || []

        // ── FRESH STATS FETCHING (NOT CACHED) ──
        const allIds = [...trending, ...topRated].map(g => g.id).filter(Boolean)
        let gameStats = {}
        if (allIds.length > 0) {
            const [reviewData, likeCounts, logCounts] = await Promise.all([
                Game.aggregate([
                    { $match: { igdbId: { $in: allIds }, rating: { $gt: 0 } } },
                    { $group: { _id: '$igdbId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
                ]),
                GameLike.aggregate([
                    { $match: { igdbId: { $in: allIds } } },
                    { $group: { _id: '$igdbId', count: { $sum: 1 } } }
                ]),
                Game.aggregate([
                    { $match: { igdbId: { $in: allIds } } },
                    { $group: { _id: '$igdbId', count: { $sum: 1 } } }
                ])
            ])
            allIds.forEach(id => {
                const review = reviewData.find(r => r._id === id)
                const like = likeCounts.find(l => l._id === id)
                const log = logCounts.find(l => l._id === id)
                gameStats[id] = {
                    avgRating: review ? parseFloat(review.avg.toFixed(1)) : null,
                    ratingCount: review?.count || 0,
                    likeCount: like?.count || 0,
                    loggedCount: log?.count || 0
                }
            })
        }

        res.json({ success: true, trending, topRated, comingSoon, gameStats })
    } catch (error) {
        logger.error('Home bundle error:', error)
        res.status(500).json({ success: false, message: 'Failed to fetch home data', error: error.message })
    }
})

export default router