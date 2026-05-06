import express from 'express'
import { protect, protectOptional } from '../middleware/auth.js'
import GameLike from '../models/GameLike.js'
import Wishlist from '../models/Wishlist.js'
import GameReview from '../models/GameReview.js'
import User from '../models/User.js'
import AnimeLike from '../models/AnimeLike.js'
import AnimeWishlist from '../models/AnimeWishlist.js'
import MovieLike from '../models/MovieLike.js'
import MovieWishlist from '../models/MovieWishlist.js'
import Follow from '../models/Follow.js'
import { awardXP, deductXP } from '../utils/xp.js'
import { updateGlobalStats, updateMediaStats } from '../utils/stats.js'
import { logEngagement } from '../utils/engagement.js'
import { withRetryTransaction } from '../utils/transaction.js'

const router = express.Router()

// Helper to get models for Like/Wishlist
const getMediaModels = (mediaType) => {
    switch (mediaType) {
        case 'anime':
        case 'manga':
            return { Like: AnimeLike, Wishlist: AnimeWishlist }
        case 'movie':
        case 'tv':
            return { Like: MovieLike, Wishlist: MovieWishlist }
        default:
            return { Like: GameLike, Wishlist: Wishlist }
    }
}

// ── GET /api/lists/me (Summary View) ──────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
    try {
        const { mediaType = 'game' } = req.query
        const { Like, Wishlist: WishlistModel } = getMediaModels(mediaType)

        const [likeCount, wishCount, user] = await Promise.all([
            Like.countDocuments({ userId: req.user._id, ...(mediaType !== 'game' ? { type: mediaType } : {}) }),
            WishlistModel.countDocuments({ userId: req.user._id, ...(mediaType !== 'game' ? { type: mediaType } : {}) }),
            User.findById(req.user._id).select('xp level badge username avatar isLikesPublic isWishlistPublic isAnimeLikesPublic isAnimeWishlistPublic isMangaLikesPublic isMangaWishlistPublic isMovieLikesPublic isMovieWishlistPublic isTVLikesPublic isTVWishlistPublic').lean(),
        ])

        // Get previews for likes/wishlist
        const likesPreview = await Like.find({ userId: req.user._id, ...(mediaType !== 'game' ? { type: mediaType } : {}) }).sort({ createdAt: -1 }).limit(6).lean()
        const wishlistPreview = await WishlistModel.find({ userId: req.user._id, ...(mediaType !== 'game' ? { type: mediaType } : {}) }).sort({ createdAt: -1 }).limit(6).lean()

        // Normalize previews for frontend
        const normalize = (item) => ({
            ...item,
            igdbId: item.igdbId || item.externalId,
            gameTitle: item.gameTitle || item.title,
            gameCover: item.gameCover || item.cover
        })

        res.json({ 
            success: true, 
            customLists: [], 
            likesCount: likeCount, 
            wishlistCount: wishCount,
            likesPreview: likesPreview.map(normalize),
            wishlistPreview: wishlistPreview.map(normalize),
            user 
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/user/:userId ── fetch lists for a user profile ─────────────
router.get('/user/:userId', protectOptional, async (req, res) => {
    try {
        const { mediaType = 'game' } = req.query
        const targetUser = await User.findById(req.params.userId).select('isPrivate').lean()
        if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' })

        res.json({ success: true, lists: [] })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/user/:userId/likes ── fetch liked items for a user profile ──
router.get('/user/:userId/likes', protectOptional, async (req, res) => {
    try {
        const { mediaType = 'game' } = req.query
        const prefix = mediaType === 'game' ? '' : (mediaType === 'tv' ? 'TV' : mediaType.charAt(0).toUpperCase() + mediaType.slice(1))
        const privacyField = prefix ? `is${prefix}LikesPublic` : 'isLikesPublic'
        const targetUser = await User.findById(req.params.userId).select(`isPrivate ${privacyField}`).lean()
        if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' })

        // 🛡️ Privacy Wall
        let isAuthorized = false
        if (req.user) {
            const requesterId = req.user._id.toString()
            if (requesterId === req.params.userId) isAuthorized = true
            else {
                const isFollowing = await Follow.findOne({ followerId: requesterId, followingId: req.params.userId }).lean()
                if (isFollowing) isAuthorized = true
            }
        }

        if (targetUser.isPrivate && !isAuthorized) {
            return res.json({ success: true, likes: [], isRestricted: true })
        }

        if (!targetUser[privacyField] && !isAuthorized) {
            return res.json({ success: true, likes: [], isRestricted: true, message: 'This collection is private' })
        }

        const { Like } = getMediaModels(mediaType)
        const likes = await Like.find({ userId: req.params.userId, ...(mediaType !== 'game' ? { type: mediaType } : {}) }).sort({ createdAt: -1 }).lean()
        
        const normalize = (item) => ({
            ...item,
            igdbId: item.igdbId || item.externalId,
            gameTitle: item.gameTitle || item.title,
            gameCover: item.gameCover || item.cover
        })

        const normalizedLikes = likes.map(normalize)

        // ── FETCH COMMUNITY STATS FOR GAMES IN LIKES ──
        if (mediaType === 'game') {
            const allIds = normalizedLikes.map(g => g.igdbId).filter(Boolean)
            if (allIds.length > 0) {
                const { default: GlobalStats } = await import('../models/GlobalStats.js')
                const reviewData = await GlobalStats.find({ igdbId: { $in: allIds } })
                const stats = {}
                reviewData.forEach(s => { stats[s.igdbId] = s.avgRating || null })
                normalizedLikes.forEach(g => { g.avgRating = stats[g.igdbId] || null })
            }
        }

        res.json({ success: true, likes: normalizedLikes })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/user/:userId/wishlist ── fetch wishlist items for a user profile ──
router.get('/user/:userId/wishlist', protectOptional, async (req, res) => {
    try {
        const { mediaType = 'game' } = req.query
        const prefix = mediaType === 'game' ? '' : (mediaType === 'tv' ? 'TV' : mediaType.charAt(0).toUpperCase() + mediaType.slice(1))
        const privacyField = prefix ? `is${prefix}WishlistPublic` : 'isWishlistPublic'
        const targetUser = await User.findById(req.params.userId).select(`isPrivate ${privacyField}`).lean()
        if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' })

        // 🛡️ Privacy Wall
        let isAuthorized = false
        if (req.user) {
            const requesterId = req.user._id.toString()
            if (requesterId === req.params.userId) isAuthorized = true
            else {
                const isFollowing = await Follow.findOne({ followerId: requesterId, followingId: req.params.userId }).lean()
                if (isFollowing) isAuthorized = true
            }
        }

        if (targetUser.isPrivate && !isAuthorized) {
            return res.json({ success: true, wishlist: [], isRestricted: true })
        }

        if (!targetUser[privacyField] && !isAuthorized) {
            return res.json({ success: true, wishlist: [], isRestricted: true, message: 'This collection is private' })
        }

        const { Wishlist: WishlistModel } = getMediaModels(mediaType)
        const wishlist = await WishlistModel.find({ userId: req.params.userId, ...(mediaType !== 'game' ? { type: mediaType } : {}) }).sort({ createdAt: -1 }).lean()
        
        const normalize = (item) => ({
            ...item,
            igdbId: item.igdbId || item.externalId,
            gameTitle: item.gameTitle || item.title,
            gameCover: item.gameCover || item.cover
        })

        const normalizedWishlist = wishlist.map(normalize)

        // ── FETCH COMMUNITY STATS FOR GAMES IN WISHLIST ──
        if (mediaType === 'game') {
            const allIds = normalizedWishlist.map(g => g.igdbId).filter(Boolean)
            if (allIds.length > 0) {
                const { default: GlobalStats } = await import('../models/GlobalStats.js')
                const reviewData = await GlobalStats.find({ igdbId: { $in: allIds } })
                const stats = {}
                reviewData.forEach(s => { stats[s.igdbId] = s.avgRating || null })
                normalizedWishlist.forEach(g => { g.avgRating = stats[g.igdbId] || null })
            }
        }

        res.json({ success: true, wishlist: normalizedWishlist })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/likes (Full Fetch) ──────────────────────────────────────────
router.get('/likes', protect, async (req, res) => {
    try {
        const { mediaType = 'game' } = req.query
        const { Like } = getMediaModels(mediaType)
        const likes = await Like.find({ userId: req.user._id, ...(mediaType !== 'game' ? { type: mediaType } : {}) }).sort({ createdAt: -1 }).lean()
        
        const normalized = likes.map(item => ({
            ...item,
            igdbId: item.igdbId || item.externalId,
            gameTitle: item.gameTitle || item.title,
            gameCover: item.gameCover || item.cover
        }))

        res.json({ success: true, likes: normalized })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/lists/wishlist (Full Fetch) ───────────────────────────────────────
router.get('/wishlist', protect, async (req, res) => {
    try {
        const { mediaType = 'game' } = req.query
        const { Wishlist: WishlistModel } = getMediaModels(mediaType)
        const wishlist = await WishlistModel.find({ userId: req.user._id, ...(mediaType !== 'game' ? { type: mediaType } : {}) }).sort({ createdAt: -1 }).lean()
        
        const normalized = wishlist.map(item => ({
            ...item,
            igdbId: item.igdbId || item.externalId,
            gameTitle: item.gameTitle || item.title,
            gameCover: item.gameCover || item.cover
        }))

        res.json({ success: true, wishlist: normalized })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})



// ── POST /api/lists/like ──────────────────────────────────────────────────────
router.post('/like', protect, async (req, res) => {
    try {
        const { igdbId, externalId, gameTitle, gameCover, genre, mediaType = 'game' } = req.body
        const mediaId = Number(igdbId || externalId)
        const { Like } = getMediaModels(mediaType)
        
        const result = await withRetryTransaction(async (session) => {
            const findQuery = mediaType === 'game' 
                ? { userId: req.user._id, igdbId: mediaId } 
                : { userId: req.user._id, externalId: mediaId, type: mediaType }

            const existing = await Like.findOne(findQuery).session(session)

            if (existing) {
                await Like.findByIdAndDelete(existing._id, { session })
                const updatedUser = await deductXP(req.user._id, 1, session)
                
                if (mediaType === 'game') await updateGlobalStats(mediaId, { likeCount: -1 }, session)
                else await updateMediaStats(mediaId, mediaType, { likeCount: -1 }, session)

                return { liked: false, updatedUser }
            }

            const createData = { userId: req.user._id, gameTitle, gameCover, genre }
            if (mediaType === 'game') {
                createData.igdbId = mediaId
            } else {
                createData.externalId = mediaId
                createData.type = mediaType
                createData.title = gameTitle
                createData.cover = gameCover
            }

            await Like.create([createData], { session })
            const updatedUser = await awardXP(req.user._id, 1, session)
            
            if (mediaType === 'game') await updateGlobalStats(mediaId, { likeCount: 1 }, session)
            else await updateMediaStats(mediaId, mediaType, { likeCount: 1 }, session)

            await logEngagement(mediaId, mediaType, 'like', req.user._id, session)

            return { liked: true, updatedUser }
        })

        res.json({
            success: true, 
            liked: result.liked, 
            message: result.liked ? 'Liked · +1 XP' : 'Like removed · -1 XP',
            xp: result.updatedUser.xp, 
            level: result.updatedUser.level, 
            badge: result.updatedUser.badge
        })
    } catch (err) {
        console.error('List Like Error:', err)
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/lists/wishlist ──────────────────────────────────────────────────
router.post('/wishlist', protect, async (req, res) => {
    try {
        const { igdbId, externalId, gameTitle, gameCover, genre, releaseYear, mediaType = 'game' } = req.body
        const mediaId = Number(igdbId || externalId)
        const { Wishlist: WishlistModel } = getMediaModels(mediaType)

        const result = await withRetryTransaction(async (session) => {
            const findQuery = mediaType === 'game' 
                ? { userId: req.user._id, igdbId: mediaId } 
                : { userId: req.user._id, externalId: mediaId, type: mediaType }

            const existing = await WishlistModel.findOne(findQuery).session(session)

            if (existing) {
                await WishlistModel.findByIdAndDelete(existing._id, { session })
                if (mediaType === 'game') await updateGlobalStats(mediaId, { wishlistCount: -1 }, session)
                else await updateMediaStats(mediaId, mediaType, { wishlistCount: -1 }, session)
                return { wishlisted: false }
            }

            const createData = { userId: req.user._id, gameTitle, gameCover, genre, releaseYear }
            if (mediaType === 'game') {
                createData.igdbId = mediaId
            } else {
                createData.externalId = mediaId
                createData.type = mediaType
                createData.title = gameTitle
                createData.cover = gameCover
            }

            await WishlistModel.create([createData], { session })
            if (mediaType === 'game') await updateGlobalStats(mediaId, { wishlistCount: 1 }, session)
            else await updateMediaStats(mediaId, mediaType, { wishlistCount: 1 }, session)

            await logEngagement(mediaId, mediaType, 'wishlist', req.user._id, session)
            return { wishlisted: true }
        })

        res.json({ 
            success: true, 
            wishlisted: result.wishlisted, 
            message: result.wishlisted ? 'Added to wishlist' : 'Removed from wishlist' 
        })
    } catch (err) {
        console.error('List Wishlist Error:', err)
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
        const { mediaType = 'game' } = req.query
        const { Like } = getMediaModels(mediaType)
        const findQuery = mediaType === 'game' 
            ? { userId: req.user._id, igdbId: Number(req.params.igdbId) } 
            : { userId: req.user._id, externalId: Number(req.params.igdbId), type: mediaType }
        const like = await Like.findOne(findQuery)
        res.json({ success: true, liked: !!like })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

export default router