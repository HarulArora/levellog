import express from 'express'
import Game from '../models/Game.js'
import { protect } from '../middleware/auth.js'
import { awardXP } from '../utils/xp.js'

const router = express.Router()

// ── GET /api/games ──
router.get('/', protect, async (req, res) => {
    try {
        const games = await Game.find({
            userId: req.user._id
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
router.get('/activity/:userId', protect, async (req, res) => {
    try {
        const games = await Game.find({
            userId: req.params.userId
        }).sort({ updatedAt: -1 }).limit(20)

        const activity = []

        games.forEach(game => {
            const gameInfo = {
                title: game.title,
                cover: game.cover,
                id: game._id,
                igdbId: game.igdbId || null
            }

            if (game.status === 'completed') {
                activity.push({
                    type: 'completed',
                    game: gameInfo,
                    rating: game.rating > 0 ? game.rating : null,
                    time: game.updatedAt
                })
            } else if (game.status === 'playing') {
                activity.push({
                    type: 'playing',
                    game: gameInfo,
                    time: game.updatedAt
                })
            } else if (game.status === 'dropped') {
                activity.push({
                    type: 'dropped',
                    game: gameInfo,
                    hours: game.hours,
                    time: game.updatedAt
                })
            } else if (game.status === 'planned') {
                activity.push({
                    type: 'planned',
                    game: gameInfo,
                    time: game.createdAt
                })
            } else if (game.status === 'paused') {
                activity.push({
                    type: 'paused',
                    game: gameInfo,
                    time: game.updatedAt
                })
            }

            if (game.rating > 0 && game.status !== 'completed') {
                activity.push({
                    type: 'rated',
                    game: gameInfo,
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
router.post('/', protect, async (req, res) => {
    try {
        const {
            title, genre, status, rating,
            hours, platforms, steamId,
            notes, cover, summary, igdbId
        } = req.body

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            })
        }

        const newGame = new Game({
            userId: req.user._id,
            title, genre, status, rating,
            hours, platforms, steamId,
            notes, cover, summary, igdbId
        })

        const savedGame = await newGame.save()

        // ── Award XP for logging a game ──
        await awardXP(req.user._id, 1)

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
router.put('/:id', protect, async (req, res) => {
    try {
        // Get the game before update to compare rating
        const existingGame = await Game.findOne({
            _id: req.params.id,
            userId: req.user._id
        })

        if (!existingGame) {
            return res.status(404).json({
                success: false,
                message: 'Game not found or not authorized'
            })
        }

        const hadRatingBefore = existingGame.rating > 0
        const hasRatingNow = req.body.rating > 0

        const game = await Game.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true }
        )

        // ── Award XP for rating a game (only first time) ──
        if (!hadRatingBefore && hasRatingNow) {
            await awardXP(req.user._id, 1)
        }

        // ── Award XP for completing a game (only first time) ──
        if (existingGame.status !== 'completed' && req.body.status === 'completed') {
            await awardXP(req.user._id, 1)
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
router.delete('/:id', protect, async (req, res) => {
    try {
        const game = await Game.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        })

        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found or not authorized'
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