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

// ── GET /api/games/stats/:igdbId ── MUST be before /:id routes
router.get('/stats/:igdbId', async (req, res) => {
    try {
        const igdbId = Number(req.params.igdbId)

        const [loggedCount, ratingData, likeCount] = await Promise.all([
            Game.countDocuments({ igdbId }),
            Game.aggregate([
                { $match: { igdbId, rating: { $gt: 0 } } },
                { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
            ]),
            (await import('../models/GameLike.js')).default.countDocuments({ igdbId })
        ])

        const avgRating = ratingData[0]
            ? parseFloat(ratingData[0].avg.toFixed(1))
            : null
        const ratingCount = ratingData[0]?.count || 0

        res.json({
            success: true,
            stats: { loggedCount, avgRating, ratingCount, likeCount }
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/games/stats/batch ── MUST be before POST /
router.post('/stats/batch', async (req, res) => {
    try {
        const { igdbIds } = req.body
        if (!igdbIds?.length) return res.json({ success: true, stats: {} })

        const ids = igdbIds.map(Number)

        const [reviewData, likeCounts, logCounts] = await Promise.all([
            Game.aggregate([
                { $match: { igdbId: { $in: ids }, rating: { $gt: 0 } } },
                { $group: { _id: '$igdbId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
            ]),
            (await import('../models/GameLike.js')).default.aggregate([
                { $match: { igdbId: { $in: ids } } },
                { $group: { _id: '$igdbId', count: { $sum: 1 } } }
            ]),
            Game.aggregate([
                { $match: { igdbId: { $in: ids } } },
                { $group: { _id: '$igdbId', count: { $sum: 1 } } }
            ])
        ])

        const stats = {}
        ids.forEach(id => {
            const review = reviewData.find(r => r._id === id)
            const like = likeCounts.find(l => l._id === id)
            const log = logCounts.find(l => l._id === id)
            stats[id] = {
                avgRating: review ? parseFloat(review.avg.toFixed(1)) : null,
                ratingCount: review?.count || 0,
                likeCount: like?.count || 0,
                loggedCount: log?.count || 0
            }
        })

        res.json({ success: true, stats })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
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

        if (!hadRatingBefore && hasRatingNow) {
            await awardXP(req.user._id, 1)
        }

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
