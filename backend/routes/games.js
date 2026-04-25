import express from 'express'
import Game from '../models/Game.js'
import GameLike from '../models/GameLike.js'
import Wishlist from '../models/Wishlist.js'
import { protect, protectOptional } from '../middleware/auth.js'
import { awardXP, deductXP } from '../utils/xp.js'
import { updateGlobalStats, syncGlobalStats } from '../utils/stats.js'
import { updateUserStats } from '../utils/userStats.js'
import GlobalStats from '../models/GlobalStats.js'
import { fetchGameDetailById } from './igdb.js'

const router = express.Router()

// ── GET /api/games ──
router.get('/', protect, async (req, res) => {
    try {
        const games = await Game.find({ userId: req.user._id })
            .select('title cover status genre rating hours platforms igdbId steamId createdAt updatedAt')
            .sort({ createdAt: -1 })
            .lean()
        res.json({ success: true, games })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch games', error: error.message })
    }
})

// ── GET /api/games/user/:userId ──
router.get('/user/:userId', async (req, res) => {
    try {
        const games = await Game.find({ userId: req.params.userId })
            .select('title cover status genre rating hours platforms igdbId createdAt updatedAt')
            .sort({ createdAt: -1 })
            .lean()
        res.json({ success: true, games })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch games', error: error.message })
    }
})

// ── GET /api/games/activity/:userId ──
router.get('/activity/:userId', protect, async (req, res) => {
    try {
        const games = await Game.find({ userId: req.params.userId })
            .select('title cover status rating hours igdbId createdAt updatedAt')
            .sort({ updatedAt: -1 })
            .limit(20)
            .lean()
        const activity = []

        games.forEach(game => {
            const gameInfo = { title: game.title, cover: game.cover, id: game._id, igdbId: game.igdbId || null }

            if (game.status === 'completed') {
                activity.push({ type: 'completed', game: gameInfo, rating: game.rating > 0 ? game.rating : null, time: game.updatedAt })
            } else if (game.status === 'playing') {
                activity.push({ type: 'playing', game: gameInfo, time: game.updatedAt })
            } else if (game.status === 'dropped') {
                activity.push({ type: 'dropped', game: gameInfo, hours: game.hours, time: game.updatedAt })
            } else if (game.status === 'planned') {
                activity.push({ type: 'planned', game: gameInfo, time: game.createdAt })
            } else if (game.status === 'paused') {
                activity.push({ type: 'paused', game: gameInfo, time: game.updatedAt })
            }

            if (game.rating > 0 && game.status !== 'completed') {
                activity.push({ type: 'rated', game: gameInfo, rating: game.rating, time: game.updatedAt })
            }
        })

        activity.sort((a, b) => new Date(b.time) - new Date(a.time))
        res.json({ success: true, activity: activity.slice(0, 20) })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch activity', error: error.message })
    }
})

// ── GET /api/games/stats/:igdbId ── O(1) Lookup (Optimized)
router.get('/stats/:igdbId', async (req, res) => {
    try {
        const igdbId = Number(req.params.igdbId)
        let stats = await GlobalStats.findOne({ igdbId })
        
        // ── Self-Healing Strategy ──
        // If stats are missing, negative, or clearly inconsistent, trigger a recalculation.
        if (!stats || stats.loggedCount < 0 || stats.wishlistCount < 0 || stats.likeCount < 0 || stats.ratingCount < 0) {
            await syncGlobalStats(igdbId);
            stats = await GlobalStats.findOne({ igdbId });
        }

        res.json({ 
            success: true, 
            stats: stats || { 
                loggedCount: 0, 
                avgRating: null, 
                ratingCount: 0, 
                likeCount: 0, 
                wishlistCount: 0 
            } 
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/games/context/:igdbId ── O(1) Bundled Fetch (Optimized)
// Returns [Game Data] + [Global Stats] + [User Status]
router.get('/context/:igdbId', protectOptional, async (req, res) => {
    try {
        const igdbId = Number(req.params.igdbId)
        const userId = req.user?._id // Populated by 'protectOptional' if token is valid

        // 1. Fire all lookups in parallel
        const [stats, game, like, wish] = await Promise.all([
            GlobalStats.findOne({ igdbId }),
            // Fetch game data directly to bypass HTTP latency
            fetchGameDetailById(igdbId),
            userId ? GameLike.findOne({ userId, igdbId }) : null,
            userId ? Wishlist.findOne({ userId, igdbId }) : null
        ])

        // ── Real-time Inconsistency Check ──
        // If the user has a record (liked/wishlisted) but the global count is 0, trigger a sync.
        // This handles cases where server restarts or crashes caused a mismatch.
        if ((like && stats?.likeCount === 0) || (wish && stats?.wishlistCount === 0)) {
            await syncGlobalStats(igdbId);
            const updatedStats = await GlobalStats.findOne({ igdbId });
            if (updatedStats) {
                stats.likeCount = updatedStats.likeCount;
                stats.wishlistCount = updatedStats.wishlistCount;
                stats.loggedCount = updatedStats.loggedCount;
                stats.avgRating = updatedStats.avgRating;
                stats.ratingCount = updatedStats.ratingCount;
            }
        }

        const cleanAvgRating = stats?.avgRating && stats.avgRating > 0 ? stats.avgRating : null;

        res.json({
            success: true,
            game,
            stats: { 
                loggedCount: Math.max(0, stats?.loggedCount || 0), 
                avgRating: cleanAvgRating, 
                ratingCount: Math.max(0, stats?.ratingCount || 0), 
                likeCount: Math.max(0, stats?.likeCount || 0), 
                wishlistCount: Math.max(0, stats?.wishlistCount || 0) 
            },
            userStatus: {
                liked: !!like,
                wishlisted: !!wish
            }
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/games/stats/batch ── O(N) where N is batch size (Optimized)
router.post('/stats/batch', async (req, res) => {
    try {
        const { igdbIds } = req.body
        if (!igdbIds?.length) return res.json({ success: true, stats: {} })
        const ids = igdbIds.map(Number)
        
        const allStats = await GlobalStats.find({ igdbId: { $in: ids } })
        
        const stats = {}
        ids.forEach(id => {
            const s = allStats.find(x => x.igdbId === id)
            stats[id] = s ? {
                avgRating: s.avgRating || null,
                ratingCount: s.ratingCount || 0,
                likeCount: s.likeCount || 0,
                loggedCount: s.loggedCount || 0,
                wishlistCount: s.wishlistCount || 0
            } : {
                avgRating: null,
                ratingCount: 0,
                likeCount: 0,
                loggedCount: 0,
                wishlistCount: 0
            }
        })
        res.json({ success: true, stats })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/games ── +1 XP for logging, +1 XP if rated on first log
router.post('/', protect, async (req, res) => {
    try {
        const { title, genre, status, rating, hours, platforms, steamId, notes, cover, summary, igdbId } = req.body

        if (!title) return res.status(400).json({ success: false, message: 'Title is required' })

        const newGame = new Game({
            userId: req.user._id,
            title, genre, status, rating, hours, platforms, steamId, notes, cover, summary, igdbId
        })
        const savedGame = await newGame.save()

        // ── Global Stats Denormalization ──
        const statsUpdate = { loggedCount: 1 }
        if (rating > 0) {
            statsUpdate.ratingCount = 1
            statsUpdate.ratingValue = Number(rating)
        }
        await updateGlobalStats(igdbId, statsUpdate)

        // ── User Stats Denormalization ──
        const userStatsUpdate = { 
            'gameStats.total': 1,
            [`gameStats.${status}`]: 1,
            'gameStats.totalHours': Number(hours) || 0
        }
        if (rating > 0) {
            userStatsUpdate['gameStats.ratingCount'] = 1
            userStatsUpdate['gameStats.totalRatingSum'] = Number(rating)
        }
        await updateUserStats(req.user._id, userStatsUpdate)

        // +1 XP for logging
        let updatedUser = await awardXP(req.user._id, 1)
        let xpGained = 1

        // +1 XP if rated on first log
        if (rating > 0) {
            updatedUser = await awardXP(req.user._id, 1)
            xpGained += 1
        }

        res.status(201).json({
            success: true,
            message: 'Game added successfully',
            game: savedGame,
            xpGained,
            xp: updatedUser.xp,
            level: updatedUser.level,
            badge: updatedUser.badge
        })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to add game', error: error.message })
    }
})

// ── PUT /api/games/:id ── award/deduct XP for rating changes only
router.put('/:id', protect, async (req, res) => {
    try {
        const existingGame = await Game.findOne({ _id: req.params.id, userId: req.user._id })
        if (!existingGame) return res.status(404).json({ success: false, message: 'Game not found or not authorized' })

        const oldRating = existingGame.rating || 0
        const hadRatingBefore = oldRating > 0
        const hasRatingNow = req.body.rating > 0

        const game = await Game.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { returnDocument: 'after' }
        )

        // ── Global Stats Update ──
        if (game.igdbId) {
            const ratingDelta = (Number(req.body.rating) || 0) - oldRating
            const countDelta = (!hadRatingBefore && hasRatingNow) ? 1 : (hadRatingBefore && !hasRatingNow) ? -1 : 0
            
            if (ratingDelta !== 0 || countDelta !== 0) {
                await updateGlobalStats(game.igdbId, {
                    ratingCount: countDelta,
                    ratingValue: ratingDelta
                })
            }
        }

        // ── User Stats Update ──
        const userStatsUpdate = {}
        const oldStatus = existingGame.status
        const newStatus = req.body.status
        if (newStatus && oldStatus !== newStatus) {
            userStatsUpdate[`gameStats.${oldStatus}`] = -1
            userStatsUpdate[`gameStats.${newStatus}`] = 1
        }
        const oldHours = existingGame.hours || 0
        const newHours = Number(req.body.hours)
        if (!isNaN(newHours) && oldHours !== newHours) {
            userStatsUpdate['gameStats.totalHours'] = newHours - oldHours
        }
        const ratingDelta = (Number(req.body.rating) || 0) - (existingGame.rating || 0)
        const countDelta = (!hadRatingBefore && hasRatingNow) ? 1 : (hadRatingBefore && !hasRatingNow) ? -1 : 0
        
        if (ratingDelta !== 0 || countDelta !== 0) {
            userStatsUpdate['gameStats.ratingCount'] = countDelta
            userStatsUpdate['gameStats.totalRatingSum'] = ratingDelta
        }

        if (Object.keys(userStatsUpdate).length > 0) {
            await updateUserStats(req.user._id, userStatsUpdate)
        }

        let updatedUser = null

        // First time rating → +1 XP
        if (!hadRatingBefore && hasRatingNow) {
            updatedUser = await awardXP(req.user._id, 1)
        }
        // Rating removed → -1 XP
        if (hadRatingBefore && !hasRatingNow) {
            updatedUser = await deductXP(req.user._id, 1)
        }

        res.json({
            success: true,
            message: 'Game updated',
            game,
            ...(updatedUser && { xp: updatedUser.xp, level: updatedUser.level, badge: updatedUser.badge })
        })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update game', error: error.message })
    }
})

// ── DELETE /api/games/:id ── deduct XP earned for this game
router.delete('/:id', protect, async (req, res) => {
    try {
        const game = await Game.findOne({ _id: req.params.id, userId: req.user._id })
        if (!game) return res.status(404).json({ success: false, message: 'Game not found or not authorized' })

        // Calculate XP to deduct: 1 for logging + 1 if had rating
        let xpToDeduct = 1
        if (game.rating > 0) xpToDeduct += 1

        await game.deleteOne()
        
        // ── Global Stats Update ──
        if (game.igdbId) {
            await updateGlobalStats(game.igdbId, {
                loggedCount: -1,
                ratingCount: game.rating > 0 ? -1 : 0,
                ratingValue: game.rating > 0 ? -game.rating : 0
            })
        }

        // ── User Stats Update ──
        const userStatsDelete = {
            'gameStats.total': -1,
            [`gameStats.${game.status}`]: -1,
            'gameStats.totalHours': -(game.hours || 0)
        }
        if (game.rating > 0) {
            userStatsDelete['gameStats.ratingCount'] = -1
            userStatsDelete['gameStats.totalRatingSum'] = -game.rating
        }
        await updateUserStats(req.user._id, userStatsDelete)

        const updatedUser = await deductXP(req.user._id, xpToDeduct)

        res.json({
            success: true,
            message: 'Game deleted',
            xpDeducted: xpToDeduct,
            xp: updatedUser.xp,
            level: updatedUser.level,
            badge: updatedUser.badge
        })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete game', error: error.message })
    }
})

export default router
