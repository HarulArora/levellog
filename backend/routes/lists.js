import express from 'express'
import { protect } from '../middleware/auth.js'
import GameList from '../models/GameList.js'
import GameLike from '../models/GameLike.js'
import Wishlist from '../models/Wishlist.js'
import GameReview from '../models/GameReview.js'
import User from '../models/User.js'
import { awardXP } from '../utils/xp.js'

const router = express.Router()

// ── GET /api/lists/me ── get all my lists + likes + wishlist
router.get('/me', protect, async (req, res) => {
    try {
        const [customLists, likes, wishlist, reviews, user] = await Promise.all([
            GameList.find({ userId: req.user._id }).sort({ createdAt: -1 }),
            GameLike.find({ userId: req.user._id }).sort({ createdAt: -1 }),
            Wishlist.find({ userId: req.user._id }).sort({ createdAt: -1 }),
            GameReview.find({ userId: req.user._id }).sort({ createdAt: -1 }),
            User.findById(req.user._id).select('xp level badge isPro username')
        ])
        res.json({ success: true, customLists, likes, wishlist, reviews, user })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/lists/custom ── create custom list (requires level 2)
router.post('/custom', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)

        if (user.level < 2) {
            return res.status(403).json({
                success: false,
                message: 'You need to reach Level 2 (5 XP) to create a custom list'
            })
        }

        // Non-pro users can only have 1 custom list
        if (!user.isPro) {
            const existing = await GameList.countDocuments({ userId: req.user._id })
            if (existing >= 1) {
                return res.status(403).json({
                    success: false,
                    message: 'Free users can only create 1 custom list. Upgrade to Pro for unlimited lists.',
                    requiresPro: true
                })
            }
        }

        const { name, description, isPublic } = req.body
        if (!name?.trim()) {
            return res.status(400).json({ success: false, message: 'List name is required' })
        }

        const list = await GameList.create({
            userId: req.user._id,
            name: name.trim(),
            description: description?.trim() || '',
            isPublic: isPublic !== false
        })

        res.status(201).json({ success: true, list })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── PUT /api/lists/custom/:id ── add/remove game from custom list
router.put('/custom/:id/game', protect, async (req, res) => {
    try {
        const list = await GameList.findOne({
            _id: req.params.id,
            userId: req.user._id
        })
        if (!list) return res.status(404).json({ success: false, message: 'List not found' })

        const { igdbId, gameTitle, gameCover, genre, action } = req.body

        if (action === 'add') {
            const exists = list.games.find(g => g.igdbId === igdbId)
            if (!exists) {
                list.games.push({ igdbId, gameTitle, gameCover, genre })
            }
        } else if (action === 'remove') {
            list.games = list.games.filter(g => g.igdbId !== igdbId)
        }

        await list.save()
        res.json({ success: true, list })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── DELETE /api/lists/custom/:id ── delete custom list
router.delete('/custom/:id', protect, async (req, res) => {
    try {
        await GameList.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
        res.json({ success: true, message: 'List deleted' })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/lists/like ── like a game (+1 XP)
router.post('/like', protect, async (req, res) => {
    try {
        const { igdbId, gameTitle, gameCover, genre } = req.body
        const existing = await GameLike.findOne({ userId: req.user._id, igdbId })

        if (existing) {
            await GameLike.findByIdAndDelete(existing._id)
            return res.json({ success: true, liked: false, message: 'Like removed' })
        }

        await GameLike.create({ userId: req.user._id, igdbId, gameTitle, gameCover, genre })
        const updatedUser = await awardXP(req.user._id, 1)
        res.json({ success: true, liked: true, message: 'Game liked +1 XP', xp: updatedUser.xp, level: updatedUser.level, badge: updatedUser.badge })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/lists/wishlist ── add/remove wishlist (+1 XP)
router.post('/wishlist', protect, async (req, res) => {
    try {
        const { igdbId, gameTitle, gameCover, genre, releaseYear } = req.body
        const existing = await Wishlist.findOne({ userId: req.user._id, igdbId })

        if (existing) {
            await Wishlist.findByIdAndDelete(existing._id)
            return res.json({ success: true, wishlisted: false, message: 'Removed from wishlist' })
        }

        await Wishlist.create({ userId: req.user._id, igdbId, gameTitle, gameCover, genre, releaseYear })
        const updatedUser = await awardXP(req.user._id, 1)
        res.json({ success: true, wishlisted: true, message: 'Added to wishlist +1 XP', xp: updatedUser.xp, level: updatedUser.level, badge: updatedUser.badge })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/lists/review ── write a review (+1 XP)
router.post('/review', protect, async (req, res) => {
    try {
        const { igdbId, gameTitle, gameCover, review, rating } = req.body
        if (!review?.trim()) {
            return res.status(400).json({ success: false, message: 'Review text is required' })
        }

        const existing = await GameReview.findOne({ userId: req.user._id, igdbId })
        let updatedUser = null
        let savedReview = null

        if (existing) {
            existing.review = review.trim()
            if (rating !== undefined) existing.rating = rating
            await existing.save()
            savedReview = existing
        } else {
            savedReview = await GameReview.create({
                userId: req.user._id,
                igdbId,
                gameTitle,
                gameCover,
                review: review.trim(),
                rating
            })
            updatedUser = await awardXP(req.user._id, 1)
        }

        // ── Sync rating to Game library entry ──
        if (rating !== undefined && rating > 0) {
            const Game = (await import('../models/Game.js')).default
            await Game.findOneAndUpdate(
                { userId: req.user._id, igdbId: Number(igdbId) },
                { rating: Number(rating) }
            )
        }

        res.json({
            success: true,
            review: savedReview,
            message: existing ? 'Review updated' : 'Review posted +1 XP',
            ...(updatedUser && {
                xp: updatedUser.xp,
                level: updatedUser.level,
                badge: updatedUser.badge
            })
        })

    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/review/:igdbId ── get reviews for a game
router.get('/review/:igdbId', async (req, res) => {
    try {
        const reviews = await GameReview.find({ igdbId: req.params.igdbId })
            .populate('userId', 'username badge level')
            .sort({ createdAt: -1 })
        res.json({ success: true, reviews })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/like/:igdbId ── check if user liked a game
router.get('/like/:igdbId', protect, async (req, res) => {
    try {
        const like = await GameLike.findOne({ userId: req.user._id, igdbId: req.params.igdbId })
        res.json({ success: true, liked: !!like })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/wishlist/:igdbId ── check if game is wishlisted
router.get('/wishlist/:igdbId', protect, async (req, res) => {
    try {
        const item = await Wishlist.findOne({ userId: req.user._id, igdbId: req.params.igdbId })
        res.json({ success: true, wishlisted: !!item })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

export default router