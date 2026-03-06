// games.js — all API endpoints related to games
// Each endpoint is a URL the frontend can call

import express from 'express'
import Game from '../models/Game.js'

// Router is like a mini Express app just for game routes
const router = express.Router()


// ── GET /api/games ──
// Get all games
// Frontend calls this to load the library
router.get('/', async (req, res) => {
    try {
        // find() with no arguments returns ALL games
        // sort by newest first using createdAt
        const games = await Game.find().sort({ createdAt: -1 })

        res.json({
            success: true,
            games
        })

    } catch (error) {
        // If something goes wrong — send error response
        res.status(500).json({
            success: false,
            message: 'Failed to fetch games',
            error: error.message
        })
    }
})


// ── POST /api/games ──
// Add a new game
// Frontend sends game data in request body
router.post('/', async (req, res) => {
    try {
        // req.body contains the data sent from frontend
        const { title, genre, status, rating, hours, platforms, steamId, notes } = req.body

        // Validate — title is required
        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            })
        }

        // Create new game document using our Game model
        const newGame = new Game({
            title,
            genre,
            status,
            rating,
            hours,
            platforms,
            steamId,
            notes
        })

        // Save to MongoDB
        const savedGame = await newGame.save()

        res.status(201).json({
            success: true,
            message: 'Game added successfully',
            game: savedGame
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to add game',
            error: error.message
        })
    }
})


// ── PUT /api/games/:id ──
// Update a game by its ID
// :id is a URL parameter — /api/games/abc123
router.put('/:id', async (req, res) => {
    try {
        // req.params.id gets the :id from the URL
        const game = await Game.findByIdAndUpdate(
            req.params.id,
            req.body,           // update with data from frontend
            { new: true }       // return the updated document
        )

        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            })
        }

        res.json({
            success: true,
            message: 'Game updated',
            game
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update game',
            error: error.message
        })
    }
})


// ── DELETE /api/games/:id ──
// Delete a game by its ID
router.delete('/:id', async (req, res) => {
    try {
        const game = await Game.findByIdAndDelete(req.params.id)

        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            })
        }

        res.json({
            success: true,
            message: 'Game deleted'
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete game',
            error: error.message
        })
    }
})


export default router