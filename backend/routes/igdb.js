import express from 'express'
import { searchGames, getAccessToken } from '../utils/igdb.js'

const router = express.Router()

// ── GET /api/igdb/search?q=query ──
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Query is required'
            })
        }
        const games = await searchGames(query)
        res.json({ success: true, games })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'IGDB search failed',
            error: error.message
        })
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
        where rating > 85
          & rating_count > 500
          & cover != null
          & genres != null;
        sort rating_count desc;
        limit 10;
      `
        })
        const data = await response.json()

        const games = data.map(game => ({
            id: game.id,
            title: game.name,
            cover: game.cover?.url
                ? game.cover.url
                    .replace('t_thumb', 't_cover_big')
                    .replace('//', 'https://')
                : null,
            genre: game.genres?.[0]?.name || 'Unknown',
            rating: game.rating ? (game.rating / 10).toFixed(1) : null,
            ratingCount: game.rating_count
        }))

        res.json({ success: true, games })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch trending',
            error: error.message
        })
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
        where rating > 90
          & rating_count > 200
          & cover != null
          & genres != null;
        sort rating desc;
        limit 5;
      `
        })
        const data = await response.json()

        const games = data.map(game => ({
            id: game.id,
            title: game.name,
            cover: game.cover?.url
                ? game.cover.url
                    .replace('t_thumb', 't_cover_big')
                    .replace('//', 'https://')
                : null,
            genre: game.genres?.[0]?.name || 'Unknown',
            rating: game.rating ? (game.rating / 10).toFixed(1) : null,
        }))

        res.json({ success: true, games })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch top rated',
            error: error.message
        })
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
          & cover != null
          & hypes > 5;
        sort hypes desc;
        limit 6;
      `
        })
        const data = await response.json()

        const games = data.map(game => ({
            id: game.id,
            title: game.name,
            cover: game.cover?.url
                ? game.cover.url
                    .replace('t_thumb', 't_cover_big')
                    .replace('//', 'https://')
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
        res.status(500).json({
            success: false,
            message: 'Failed to fetch coming soon',
            error: error.message
        })
    }
})

export default router