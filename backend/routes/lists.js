import express from 'express'
import { protect } from '../middleware/auth.js'
import GameList from '../models/GameList.js'
import GameListEntry from '../models/GameListEntry.js'
import GameLike from '../models/GameLike.js'
import Wishlist from '../models/Wishlist.js'
import GameReview from '../models/GameReview.js'
import User from '../models/User.js'
import { awardXP, deductXP } from '../utils/xp.js'
import { updateGlobalStats } from '../utils/stats.js'

const router = express.Router()

// ── GET /api/lists/me (Summary View) ──────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
    try {
        const [customLists, likeCount, wishCount, reviews, user] = await Promise.all([
            GameList.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean(),
            GameLike.countDocuments({ userId: req.user._id }),
            Wishlist.countDocuments({ userId: req.user._id }),
            GameReview.countDocuments({ userId: req.user._id }),
            User.findById(req.user._id).select('xp level badge username avatar').lean(),
        ])

        // Get only the first 6 entries for each custom list as a preview
        const listIds = customLists.map(l => l._id)
        const entriesPreview = await GameListEntry.find({ listId: { $in: listIds } }).sort({ createdAt: -1 }).lean()
        
        // Get the first 6 likes/wishlist items for preview
        const likesPreview = await GameLike.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(6).lean()
        const wishlistPreview = await Wishlist.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(6).lean()

        const listsWithPreviews = customLists.map(list => ({
            ...list,
            games: entriesPreview.filter(e => e.listId.toString() === list._id.toString()).slice(0, 6)
        }))

        res.json({ 
            success: true, 
            customLists: listsWithPreviews, 
            likesCount: likeCount, 
            wishlistCount: wishCount,
            likesPreview,
            wishlistPreview,
            reviewsCount: reviews, 
            user 
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/likes (Full Fetch) ──────────────────────────────────────────
router.get('/likes', protect, async (req, res) => {
    try {
        const likes = await GameLike.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean()
        res.json({ success: true, likes })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/wishlist (Full Fetch) ───────────────────────────────────────
router.get('/wishlist', protect, async (req, res) => {
    try {
        const wishlist = await Wishlist.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean()
        res.json({ success: true, wishlist })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/user/:userId ────────────────────────────────────────────────
router.get('/user/:userId', async (req, res) => {
    try {
        const lists = await GameList.find({ userId: req.params.userId }).sort({ createdAt: -1 }).lean()
        const listIds = lists.map(l => l._id)
        const allEntries = await GameListEntry.find({ listId: { $in: listIds } }).sort({ createdAt: -1 }).lean()
        const listsWithGames = lists.map(list => ({
            ...list,
            games: allEntries.filter(e => e.listId.toString() === list._id.toString())
        }))
        res.json({ success: true, lists: listsWithGames })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/lists/custom ────────────────────────────────────────────────────
router.post('/custom', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).lean()
        if (user.level < 2)
            return res.status(403).json({ success: false, message: 'You need Level 2 to create a custom list', locked: true })

        const existing = await GameList.countDocuments({ userId: req.user._id })
        if (existing >= 2)
            return res.status(403).json({ success: false, message: 'You can have up to 2 custom lists.' })

        const { name, description, isPublic } = req.body
        if (!name?.trim()) return res.status(400).json({ success: false, message: 'List name is required' })

        const list = await GameList.create({
            userId: req.user._id,
            name: name.trim(),
            description: description?.trim() || '',
            isPublic: isPublic !== false,
            gameCount: 0,
        })

        res.status(201).json({ success: true, list: { ...list.toObject(), games: [] } })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── PUT /api/lists/custom/:id ──────────────────────────────────────────────────
router.put('/custom/:id', protect, async (req, res) => {
    try {
        const list = await GameList.findOne({ _id: req.params.id, userId: req.user._id })
        if (!list) return res.status(404).json({ success: false, message: 'List not found' })

        const { name, description, isPublic } = req.body
        if (name !== undefined) list.name = name.trim()
        if (description !== undefined) list.description = description.trim()
        if (isPublic !== undefined) list.isPublic = isPublic

        await list.save()
        res.json({ success: true, list })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── PUT /api/lists/custom/:id/game ── add or remove a game ────────────────────
router.put('/custom/:id/game', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).lean()
        if (user.level < 2)
            return res.status(403).json({ success: false, message: 'Reach Level 2 to use custom lists.', locked: true })

        const list = await GameList.findOne({ _id: req.params.id, userId: req.user._id }).lean()
        if (!list) return res.status(404).json({ success: false, message: 'List not found' })

        const { igdbId, gameTitle, gameCover, genre, action } = req.body

        if (action === 'add') {
            try {
                await GameListEntry.create({ listId: list._id, igdbId, gameTitle, gameCover, genre })
                await GameList.findByIdAndUpdate(list._id, { $inc: { gameCount: 1 } })
            } catch (e) {
                if (e.code === 11000) {
                    // already in list — silent ignore
                }
            }
        } else if (action === 'remove') {
            const deleted = await GameListEntry.findOneAndDelete({ listId: list._id, igdbId })
            if (deleted) await GameList.findByIdAndUpdate(list._id, { $inc: { gameCount: -1 } })
        }

        const entries = await GameListEntry.find({ listId: list._id }).sort({ createdAt: -1 }).lean()
        const updatedList = await GameList.findById(list._id).lean()
        res.json({ success: true, list: { ...updatedList, games: entries } })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── DELETE /api/lists/custom/:id ──────────────────────────────────────────────
router.delete('/custom/:id', protect, async (req, res) => {
    try {
        const list = await GameList.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
        if (list) await GameListEntry.deleteMany({ listId: list._id })
        res.json({ success: true, message: 'List deleted' })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/lists/like ──────────────────────────────────────────────────────
router.post('/like', protect, async (req, res) => {
    try {
        const { igdbId, gameTitle, gameCover, genre } = req.body
        const idNum = Number(igdbId)
        const existing = await GameLike.findOne({ userId: req.user._id, igdbId: idNum })

        if (existing) {
            await GameLike.findByIdAndDelete(existing._id)
            const updatedUser = await deductXP(req.user._id, 1)
            // Atomic decrement
            await updateGlobalStats(idNum, { likeCount: -1 })
            return res.json({
                success: true, liked: false, message: 'Like removed · -1 XP',
                xp: updatedUser.xp, level: updatedUser.level, badge: updatedUser.badge
            })
        }

        await GameLike.create({ userId: req.user._id, igdbId: idNum, gameTitle, gameCover, genre })
        const updatedUser = await awardXP(req.user._id, 1)
        // Atomic increment
        await updateGlobalStats(idNum, { likeCount: 1 })
        res.json({
            success: true, liked: true, message: 'Game liked · +1 XP',
            xp: updatedUser.xp, level: updatedUser.level, badge: updatedUser.badge
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/lists/wishlist ──────────────────────────────────────────────────
router.post('/wishlist', protect, async (req, res) => {
    try {
        const { igdbId, gameTitle, gameCover, genre, releaseYear } = req.body
        const idNum = Number(igdbId)
        const existing = await Wishlist.findOne({ userId: req.user._id, igdbId: idNum })

        if (existing) {
            await Wishlist.findByIdAndDelete(existing._id)
            await updateGlobalStats(idNum, { wishlistCount: -1 })
            return res.json({ success: true, wishlisted: false, message: 'Removed from wishlist' })
        }

        await Wishlist.create({ userId: req.user._id, igdbId: idNum, gameTitle, gameCover, genre, releaseYear })
        await updateGlobalStats(idNum, { wishlistCount: 1 })
        res.json({ success: true, wishlisted: true, message: 'Added to wishlist' })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/lists/review ────────────────────────────────────────────────────
router.post('/review', protect, async (req, res) => {
    try {
        const { igdbId, gameTitle, gameCover, review, rating } = req.body
        if (!review?.trim()) return res.status(400).json({ success: false, message: 'Review text is required' })

        const igdbIdNum = Number(igdbId)
        const existing = await GameReview.findOne({ userId: req.user._id, igdbId: igdbIdNum })

        if (existing) {
            existing.review = review.trim()
            if (rating !== undefined) existing.rating = Number(rating)
            await existing.save()
            if (rating !== undefined && rating > 0) {
                const Game = (await import('../models/Game.js')).default
                await Game.findOneAndUpdate({ userId: req.user._id, igdbId: igdbIdNum }, { rating: Number(rating) })
            }
            return res.json({ success: true, review: existing, message: 'Review updated' })
        }

        const savedReview = await GameReview.create({
            userId: req.user._id, igdbId: igdbIdNum,
            gameTitle, gameCover, review: review.trim(), rating: Number(rating) || 0
        })
        if (rating !== undefined && rating > 0) {
            const Game = (await import('../models/Game.js')).default
            await Game.findOneAndUpdate({ userId: req.user._id, igdbId: igdbIdNum }, { rating: Number(rating) })
        }
        res.json({ success: true, review: savedReview, message: 'Review posted' })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── DELETE /api/lists/review/:igdbId ─────────────────────────────────────────
router.delete('/review/:igdbId', protect, async (req, res) => {
    try {
        const deleted = await GameReview.findOneAndDelete({ userId: req.user._id, igdbId: Number(req.params.igdbId) })
        if (!deleted) return res.status(404).json({ success: false, message: 'Review not found' })
        res.json({ success: true, message: 'Review deleted' })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/review/:igdbId ─────────────────────────────────────────────
router.get('/review/:igdbId', async (req, res) => {
    try {
        const reviews = await GameReview.find({ igdbId: Number(req.params.igdbId) })
            .populate('userId', 'username badge level avatar')
            .sort({ createdAt: -1 })
        res.json({ success: true, reviews })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/like/:igdbId ───────────────────────────────────────────────
router.get('/like/:igdbId', protect, async (req, res) => {
    try {
        const like = await GameLike.findOne({ userId: req.user._id, igdbId: Number(req.params.igdbId) })
        res.json({ success: true, liked: !!like })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/wishlist/:igdbId ───────────────────────────────────────────
router.get('/wishlist/:igdbId', protect, async (req, res) => {
    try {
        const item = await Wishlist.findOne({ userId: req.user._id, igdbId: Number(req.params.igdbId) })
        res.json({ success: true, wishlisted: !!item })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

export default router