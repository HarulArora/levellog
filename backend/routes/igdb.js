import express from 'express'
import { LRUCache } from 'lru-cache'
import { searchGames, getAccessToken } from '../utils/igdb.js'
import Game from '../models/Game.js'
import GameLike from '../models/GameLike.js'
import logger from '../utils/logger.js'

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
            const normCover = (c) => {
                if (!c) return null
                if (typeof c === 'string') return c.startsWith('http') ? c : ('https:' + c)
                if (c.url) return c.url.replace('t_thumb', 't_cover_big').replace('//', 'https://')
                return null
            }
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
            ? ` & genres.name = "${genre}"`
            : ''

        const where = `where rating != null & rating_count > 20 & cover != null${genreFilter}`

        const token = await getAccessToken()

        const headers = {
            'Client-ID': process.env.IGDB_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain'
        }

        const [gamesRes, countRes] = await Promise.all([
            fetch('https://api.igdb.com/v4/games', {
                method: 'POST',
                headers,
                body: `
          fields name, cover.url, genres.name, platforms.name, rating, rating_count, first_release_date;
          ${where};
          sort rating_count desc;
          limit ${limitNum};
          offset ${offset};
        `
            }),
            fetch('https://api.igdb.com/v4/games/count', {
                method: 'POST',
                headers,
                body: `${where};`
            })
        ])

        const [gamesData, countData] = await Promise.all([gamesRes.json(), countRes.json()])

        const shortPlatform = (name) => {
            if (name.includes('PC') || name === 'Windows' || name === 'Linux' || name === 'Mac') return 'PC'
            if (name.includes('PlayStation 5')) return 'PS5'
            if (name.includes('PlayStation 4')) return 'PS4'
            if (name.includes('PlayStation 3')) return 'PS3'
            if (name.includes('PlayStation')) return 'PS'
            if (name.includes('Xbox Series')) return 'Xbox Series'
            if (name.includes('Xbox One')) return 'Xbox One'
            if (name.includes('Xbox')) return 'Xbox'
            if (name.includes('Nintendo Switch')) return 'Switch'
            if (name.includes('iOS') || name.includes('Android')) return 'Mobile'
            return null // skip obscure platforms
        }

        // ── CACHE WRAPPER FOR IGDB DATA ONLY ──
        const igdbDataCacheKey = `igdb-discover-v2-${genre}-${pageNum}-${limitNum}`
        let igdbResult = igdbCache.get(igdbDataCacheKey)

        if (!igdbResult) {
            const rawGames = (Array.isArray(gamesData) ? gamesData : []).map(game => ({
                id: game.id,
                title: game.name,
                cover: game.cover?.url
                    ? game.cover.url.replace('t_thumb', 't_cover_big').replace('//', 'https://')
                    : null,
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

// ── GET /api/igdb/game/:id ──
router.get('/game/:id', async (req, res) => {
    try {
        const token = await getAccessToken()

        const response = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: {
                'Client-ID': process.env.IGDB_CLIENT_ID,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'text/plain'
            },
            body: `
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
               screenshots.url,
               videos.video_id,
               storyline,
               themes.name;
        where id = ${req.params.id};
        limit 1;
      `
        })

        const data = await response.json()
        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, message: 'Game not found' })
        }

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

        const cover = g.cover?.url
            ? g.cover.url.replace('t_thumb', 't_cover_big_2x').replace('//', 'https://')
            : null

        const screenshots = g.screenshots?.map(s =>
            s.url.replace('t_thumb', 't_screenshot_big').replace('//', 'https://')
        ) || []

        const similarGames = g.similar_games?.slice(0, 6).map(sg => ({
            id: sg.id,
            title: sg.name,
            cover: sg.cover?.url
                ? sg.cover.url.replace('t_thumb', 't_cover_big').replace('//', 'https://')
                : null,
            rating: sg.rating ? (sg.rating / 10).toFixed(1) : null
        })) || []

        const platforms = g.platforms?.map(p => {
            const name = p.name
            if (name.includes('PC')) return 'PC'
            if (name.includes('PlayStation 5')) return 'PS5'
            if (name.includes('PlayStation 4')) return 'PS4'
            if (name.includes('PlayStation')) return 'PS'
            if (name.includes('Xbox Series')) return 'Xbox Series'
            if (name.includes('Xbox One')) return 'Xbox One'
            if (name.includes('Xbox')) return 'Xbox'
            if (name.includes('Nintendo Switch')) return 'Switch'
            if (name.includes('iOS') || name.includes('Android')) return 'Mobile'
            return p.name
        }) || []

        // ── Community Stats Fetching ──
        const [wishlistCount, likeCount, loggedCount] = await Promise.all([
            import('../models/Wishlist.js').then(m => m.default.countDocuments({ igdbId: parseInt(req.params.id) })),
            import('../models/GameLike.js').then(m => m.default.countDocuments({ igdbId: parseInt(req.params.id) })),
            import('../models/Game.js').then(m => m.default.countDocuments({ igdbId: parseInt(req.params.id) }))
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

        res.json({ success: true, game })

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch game details', error: error.message })
    }
})

// ── GET /api/igdb/trending ──
router.get('/trending', async (req, res) => {
    try {
        if (igdbCache.has('trending')) return res.json({ success: true, games: igdbCache.get('trending') })
        const token = await getAccessToken()
        const response = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: {
                'Client-ID': process.env.IGDB_CLIENT_ID,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'text/plain'
            },
            body: `
        fields name, cover.url, genres.name, rating, rating_count;
        where rating > 85 & rating_count > 500 & cover != null & genres != null;
        sort rating_count desc;
        limit 15;
      `
        })
        const data = await response.json()
        const games = data.map(game => ({
            id: game.id,
            title: game.name,
            cover: game.cover?.url
                ? game.cover.url.replace('t_thumb', 't_cover_big').replace('//', 'https://')
                : null,
            genre: game.genres?.[0]?.name || 'Unknown',
            rating: game.rating ? (game.rating / 10).toFixed(1) : null,
            ratingCount: game.rating_count
        }))
        igdbCache.set('trending', games)
        res.json({ success: true, games })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch trending', error: error.message })
    }
})

// ── GET /api/igdb/top-rated ──
router.get('/top-rated', async (req, res) => {
    try {
        if (igdbCache.has('top-rated')) return res.json({ success: true, games: igdbCache.get('top-rated') })
        const token = await getAccessToken()
        const response = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: {
                'Client-ID': process.env.IGDB_CLIENT_ID,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'text/plain'
            },
            body: `
        fields name, cover.url, genres.name, rating, rating_count;
        where rating > 90 & rating_count > 200 & cover != null & genres != null;
        sort rating desc;
        limit 15;
      `
        })
        const data = await response.json()
        const games = data.map(game => ({
            id: game.id,
            title: game.name,
            cover: game.cover?.url
                ? game.cover.url.replace('t_thumb', 't_cover_big').replace('//', 'https://')
                : null,
            genre: game.genres?.[0]?.name || 'Unknown',
            rating: game.rating ? (game.rating / 10).toFixed(1) : null,
        }))
        igdbCache.set('top-rated', games)
        res.json({ success: true, games })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch top rated', error: error.message })
    }
})

// ── GET /api/igdb/coming-soon ──
router.get('/coming-soon', async (req, res) => {
    try {
        if (igdbCache.has('coming-soon')) return res.json({ success: true, games: igdbCache.get('coming-soon') })
        const token = await getAccessToken()
        const now = Math.floor(Date.now() / 1000)
        const sixMonths = now + (60 * 60 * 24 * 180)
        const response = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: {
                'Client-ID': process.env.IGDB_CLIENT_ID,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'text/plain'
            },
            body: `
        fields name, cover.url, genres.name, first_release_date, hypes;
        where first_release_date > ${now}
          & first_release_date < ${sixMonths}
          & cover != null & hypes > 5;
        sort hypes desc;
        limit 6;
      `
        })
        const data = await response.json()
        const games = data.map(game => ({
            id: game.id,
            title: game.name,
            cover: game.cover?.url
                ? game.cover.url.replace('t_thumb', 't_cover_big').replace('//', 'https://')
                : null,
            genre: game.genres?.[0]?.name || 'Unknown',
            releaseDate: game.first_release_date
                ? new Date(game.first_release_date * 1000).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                })
                : 'TBA',
            hypes: game.hypes
        }))
        igdbCache.set('coming-soon', games)
        res.json({ success: true, games })
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
        const token = await getAccessToken()
        const now = Math.floor(Date.now() / 1000)
        const sixMonths = now + 60 * 60 * 24 * 180
        const headers = {
            'Client-ID': process.env.IGDB_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain'
        }

        // All 3 IGDB network calls fire in parallel
        const [trendRes, topRes, comingRes] = await Promise.all([
            fetch('https://api.igdb.com/v4/games', {
                method: 'POST', headers,
                body: 'fields name, cover.url, genres.name, rating, rating_count; where rating > 85 & rating_count > 500 & cover != null & genres != null; sort rating_count desc; limit 15;'
            }),
            fetch('https://api.igdb.com/v4/games', {
                method: 'POST', headers,
                body: 'fields name, cover.url, genres.name, rating, rating_count; where rating > 90 & rating_count > 200 & cover != null & genres != null; sort rating desc; limit 15;'
            }),
            fetch('https://api.igdb.com/v4/games', {
                method: 'POST', headers,
                body: `fields name, cover.url, genres.name, first_release_date, hypes; where first_release_date > ${now} & first_release_date < ${sixMonths} & cover != null & hypes > 5; sort hypes desc; limit 6;`
            })
        ])

        if (!trendRes.ok || !topRes.ok || !comingRes.ok) {
            throw new Error(`IGDB API Error: ${trendRes.status} ${trendRes.statusText}`)
        }

        const [trendData, topData, comingData] = await Promise.all([
            trendRes.json(), topRes.json(), comingRes.json()
        ])

        const normCover = (url) => url
            ? url.replace('t_thumb', 't_cover_big').replace('//', 'https://')
            : null

        let trending = (Array.isArray(trendData) ? trendData : []).map(g => ({
            id: g.id, title: g.name,
            cover: normCover(g.cover?.url),
            genre: g.genres?.[0]?.name || 'Unknown',
            rating: g.rating ? (g.rating / 10).toFixed(1) : null,
            ratingCount: g.rating_count
        }))

        let topRated = (Array.isArray(topData) ? topData : []).map(g => ({
            id: g.id, title: g.name,
            cover: normCover(g.cover?.url),
            genre: g.genres?.[0]?.name || 'Unknown',
            rating: g.rating ? (g.rating / 10).toFixed(1) : null
        }))

        let comingSoon = (Array.isArray(comingData) ? comingData : []).map(g => ({
            id: g.id, title: g.name,
            cover: normCover(g.cover?.url),
            genre: g.genres?.[0]?.name || 'Unknown',
            releaseDate: g.first_release_date
                ? new Date(g.first_release_date * 1000).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                })
                : 'TBA',
            hypes: g.hypes
        }))

        // ── CACHE WRAPPER FOR IGDB DATA ONLY (v4 to fix everything) ──
        const igdbCacheKey = 'home_igdb_data_v4'
        let igdbBundle = igdbCache.get(igdbCacheKey)

        if (!igdbBundle) {
            // ONLY cache if we actually got data back to avoid caching empty states
            if (trending.length > 0 || topRated.length > 0) {
                igdbBundle = { trending, topRated, comingSoon }
                igdbCache.set(igdbCacheKey, igdbBundle, { ttl: 1000 * 60 * 60 * 12 }) 
            }
        } else {
            // Use cached lists
            trending = igdbBundle.trending
            topRated = igdbBundle.topRated
            comingSoon = igdbBundle.comingSoon
        }

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