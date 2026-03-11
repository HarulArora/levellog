import express from 'express'
import { searchGames, getAccessToken } from '../utils/igdb.js'
import Game from '../models/Game.js'

const router = express.Router()

// ── GET /api/igdb/search?q=query ──
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q
        if (!query) return res.status(400).json({ success: false, message: 'Query is required' })
        const raw = await searchGames(query)

        const normCover = (c) => {
            if (!c) return null
            if (typeof c === 'string') return c.startsWith('http') ? c : ('https:' + c)
            if (c.url) return c.url.replace('t_thumb', 't_cover_big').replace('//', 'https://')
            return null
        }

        // Return ALL fields needed by both GameSearch.jsx (igdbId, genres[]) and GameSearchBar (id, genre)
        const games = (raw || []).map(g => {
            const genreNames = g.genres
                ? (Array.isArray(g.genres)
                    ? g.genres.map(x => typeof x === 'string' ? x : x.name).filter(Boolean)
                    : [g.genres])
                : (g.genre ? [g.genre] : [])

            const title = g.title || g.name || 'Unknown'
            const cover = normCover(g.cover)
            const releaseYear = g.releaseYear || (g.first_release_date
                ? new Date(g.first_release_date * 1000).getFullYear() : null)
            const platforms = g.platforms || []
            const summary = g.summary || g.description || ''
            const rating = g.rating != null ? g.rating : (g.igdbRating != null ? g.igdbRating : null)

            return {
                id: g.id,
                igdbId: g.igdbId || g.id,
                title,
                cover,
                genre: genreNames[0] || null,
                genres: genreNames,
                releaseYear,
                rating,
                platforms,
                summary,
            }
        })

        res.json({ success: true, games })
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

        // Batch fetch avg platform (user) ratings from DB
        const igdbIds = rawGames.map(g => g.id)
        const avgRatings = await Game.aggregate([
            { $match: { igdbId: { $in: igdbIds }, rating: { $ne: null } } },
            { $group: { _id: '$igdbId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
        ])
        const ratingMap = {}
        for (const r of avgRatings) ratingMap[r._id] = { avg: r.avg, count: r.count }

        const games = rawGames.map(g => ({
            ...g,
            avgRating: ratingMap[g.id] ? parseFloat(ratingMap[g.id].avg.toFixed(1)) : null,
            avgRatingCount: ratingMap[g.id]?.count || 0,
        }))

        const total = countData.count || 0

        res.json({
            success: true,
            games,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        })
    } catch (error) {
        console.error('Discover error:', error)
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
            videoId: g.videos?.[0]?.video_id || null
        }

        res.json({ success: true, game })

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch game details', error: error.message })
    }
})

// ── GET /api/igdb/trending ──
router.get('/trending', async (req, res) => {
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
        res.json({ success: true, games })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch trending', error: error.message })
    }
})

// ── GET /api/igdb/top-rated ──
router.get('/top-rated', async (req, res) => {
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
        res.json({ success: true, games })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch top rated', error: error.message })
    }
})

// ── GET /api/igdb/coming-soon ──
router.get('/coming-soon', async (req, res) => {
    try {
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
        res.json({ success: true, games })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch coming soon', error: error.message })
    }
})

export default router