// igdb.js route
// Frontend calls this to search for games

import express from 'express'
import { searchGames } from '../utils/igdb.js'

const router = express.Router()


// ── GET /api/igdb/search?q=elden ──
// Search games by query
router.get('/search', async (req, res) => {
    try {
        // q is the search query from frontend
        // example: /api/igdb/search?q=elden ring
        const { q } = req.query

        if (!q || q.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Query must be at least 2 characters'
            })
        }

        const games = await searchGames(q)

        res.json({
            success: true,
            games
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to search games',
            error: error.message
        })
    }
})


export default router