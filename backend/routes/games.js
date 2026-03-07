import express from 'express'
import Game from '../models/Game.js'

const router = express.Router()

// ── GET /api/games ──
router.get('/', async (req, res) => {
    try {
        const games = await Game.find().sort({ createdAt: -1 })
        res.json({ success: true, games })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch games',
            error: error.message
        })
    }
})

// ── GET /api/games/user/:userId ──
router.get('/user/:userId', async (req, res) => {
    try {
        const games = await Game.find({
            userId: req.params.userId
        }).sort({ createdAt: -1 })
        res.json({ success: true, games })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch games',
            error: error.message
        })
    }
})

// ── GET /api/games/activity/:userId ──
router.get('/activity/:userId', async (req, res) => {
    try {
        const games = await Game.find({
            userId: req.params.userId
        }).sort({ updatedAt: -1 }).limit(20)

        const activity = []

        games.forEach(game => {
            if (game.status === 'completed') {
                activity.push({
                    type: 'completed',
                    game: { title: game.title, cover: game.cover, id: game._id },
                    rating: game.rating > 0 ? game.rating : null,
                    time: game.updatedAt
                })
            } else if (game.status === 'playing') {
                activity.push({
                    type: 'playing',
                    game: { title: game.title, cover: game.cover, id: game._id },
                    time: game.updatedAt
                })
            } else if (game.status === 'dropped') {
                activity.push({
                    type: 'dropped',
                    game: { title: game.title, cover: game.cover, id: game._id },
                    hours: game.hours,
                    time: game.updatedAt
                })
            } else if (game.status === 'planned') {
                activity.push({
                    type: 'planned',
                    game: { title: game.title, cover: game.cover, id: game._id },
                    time: game.createdAt
                })
            } else if (game.status === 'paused') {
                activity.push({
                    type: 'paused',
                    game: { title: game.title, cover: game.cover, id: game._id },
                    time: game.updatedAt
                })
            }

            if (game.rating > 0 && game.status !== 'completed') {
                activity.push({
                    type: 'rated',
                    game: { title: game.title, cover: game.cover, id: game._id },
                    rating: game.rating,
                    time: game.updatedAt
                })
            }
        })

        activity.sort((a, b) => new Date(b.time) - new Date(a.time))

        res.json({ success: true, activity: activity.slice(0, 20) })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activity',
            error: error.message
        })
    }
})

// ── POST /api/games ──
router.post('/', async (req, res) => {
    try {
        const {
            title, genre, status, rating,
            hours, platforms, steamId,
            notes, cover, summary, igdbId, userId
        } = req.body

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            })
        }

        const newGame = new Game({
            userId: userId || null,
            title, genre, status, rating,
            hours, platforms, steamId,
            notes, cover, summary, igdbId
        })

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
router.put('/:id', async (req, res) => {
    try {
        const game = await Game.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        )

        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            })
        }

        res.json({ success: true, message: 'Game updated', game })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update game',
            error: error.message
        })
    }
})

// ── DELETE /api/games/:id ──
router.delete('/:id', async (req, res) => {
    try {
        const game = await Game.findByIdAndDelete(req.params.id)

        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            })
        }

        res.json({ success: true, message: 'Game deleted' })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete game',
            error: error.message
        })
    }
})

export default router