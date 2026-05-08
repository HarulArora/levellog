import express from 'express'
import Game from '../models/Game.js'
import AnimeEntry from '../models/AnimeEntry.js'
import MovieEntry from '../models/MovieEntry.js'
import GameLike from '../models/GameLike.js'
import Wishlist from '../models/Wishlist.js'
import { protect, protectOptional } from '../middleware/auth.js'
import { awardXP, deductXP } from '../utils/xp.js'
import { updateGlobalStats, syncGlobalStats } from '../utils/stats.js'
import { updateUserStats } from '../utils/userStats.js'
import GlobalStats from '../models/GlobalStats.js'
import { fetchGameDetailById } from './igdb.js'
import { logEngagement } from '../utils/engagement.js'
import mongoose from 'mongoose'

const router = express.Router()

// ── GET /api/games ──
router.get('/', protect, async (req, res) => {
    try {
        const games = await Game.find({ userId: req.user._id })
            .select('title cover status genre rating hours platforms igdbId steamId year createdAt updatedAt')
            .sort({ createdAt: -1 })
            .lean()

        // ── FETCH COMMUNITY STATS FOR LIBRARY ──
        const allIds = games.map(g => g.igdbId).filter(Boolean)
        let stats = {}
        if (allIds.length > 0) {
            const reviewData = await GlobalStats.find({ igdbId: { $in: allIds } })
            reviewData.forEach(s => {
                stats[s.igdbId] = {
                    avgRating: s.avgRating || null,
                    ratingCount: s.ratingCount || 0
                }
            })
        }

        const gamesWithStats = games.map(g => ({
            ...g,
            avgRating: stats[g.igdbId]?.avgRating || null
        }))

        res.json({ success: true, games: gamesWithStats })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch games', error: error.message })
    }
})

// ── GET /api/games/user/:userId ──
router.get('/user/:userId', async (req, res) => {
    try {
        let games = await Game.find({ userId: req.params.userId })
            .select('title cover status genre rating hours platforms igdbId year createdAt updatedAt')
            .sort({ createdAt: -1 })
            .lean()

        // 🛡️ Auto-Healing: Deduplicate by igdbId if multiple entries exist
        const uniqueMap = new Map()
        games.forEach(game => {
            if (!game.igdbId) {
                uniqueMap.set(game._id.toString(), game)
                return
            }
            const existing = uniqueMap.get(game.igdbId)
            if (!existing) {
                uniqueMap.set(game.igdbId, game)
            } else {
                if (!existing.rating && game.rating) {
                    uniqueMap.set(game.igdbId, game)
                }
            }
        })
        games = Array.from(uniqueMap.values())

        // ── FETCH COMMUNITY STATS FOR USER LIBRARY ──
        const allIds = games.map(g => g.igdbId).filter(Boolean)
        let stats = {}
        if (allIds.length > 0) {
            const reviewData = await GlobalStats.find({ igdbId: { $in: allIds } })
            reviewData.forEach(s => {
                stats[s.igdbId] = {
                    avgRating: s.avgRating || null,
                    ratingCount: s.ratingCount || 0
                }
            })
        }

        const gamesWithStats = games.map(g => ({
            ...g,
            avgRating: stats[g.igdbId]?.avgRating || null
        }))

        res.json({ success: true, games: gamesWithStats })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch games', error: error.message })
    }
})

// ── GET /api/games/activity/:userId ──
router.get('/activity/:userId', protect, async (req, res) => {
    try {
        const [games, anime, movies] = await Promise.all([
            Game.find({ userId: req.params.userId }).sort({ updatedAt: -1 }).limit(15).lean(),
            AnimeEntry.find({ userId: req.params.userId }).sort({ updatedAt: -1 }).limit(15).lean(),
            MovieEntry.find({ userId: req.params.userId }).sort({ updatedAt: -1 }).limit(15).lean()
        ]);

        const activity = []

        // ── GAMES ──
        games.forEach(game => {
            const info = { title: game.title, cover: game.cover, id: game._id, igdbId: game.igdbId || null, mediaType: 'game' }
            if (game.status === 'completed') {
                activity.push({ type: 'completed', media: info, rating: game.rating > 0 ? game.rating : null, time: game.updatedAt })
            } else if (game.status === 'playing') {
                activity.push({ type: 'playing', media: info, time: game.updatedAt })
            } else if (game.status === 'dropped') {
                activity.push({ type: 'dropped', media: info, hours: game.hours, time: game.updatedAt })
            } else if (game.status === 'planned') {
                activity.push({ type: 'planned', media: info, time: game.createdAt })
            } else if (game.status === 'paused') {
                activity.push({ type: 'paused', media: info, time: game.updatedAt })
            }
            if (game.rating > 0 && game.status !== 'completed') {
                activity.push({ type: 'rated', media: info, rating: game.rating, time: game.updatedAt })
            }
        })

        // ── ANIME & MANGA ──
        anime.forEach(entry => {
            const info = { title: entry.title, cover: entry.cover || entry.coverImage, id: entry._id, externalId: entry.externalId, mediaType: entry.type }
            const type = entry.type === 'anime' ? 'watching' : 'reading';
            
            if (entry.status === 'completed') {
                activity.push({ type: 'completed', media: info, rating: entry.rating > 0 ? entry.rating : null, time: entry.updatedAt })
            } else if (entry.status === 'playing') {
                activity.push({ type: entry.type === 'manga' ? 'reading' : 'watching', media: info, time: entry.updatedAt })
            } else if (entry.status === 'dropped') {
                activity.push({ type: 'dropped', media: info, time: entry.updatedAt })
            } else if (entry.status === 'planned') {
                activity.push({ type: 'planned', media: info, time: entry.createdAt })
            } else if (entry.status === 'paused') {
                activity.push({ type: 'paused', media: info, time: entry.updatedAt })
            }
            if (entry.rating > 0 && entry.status !== 'completed') {
                activity.push({ type: 'rated', media: info, rating: entry.rating, time: entry.updatedAt })
            }
        })

        // ── MOVIES & TV ──
        movies.forEach(entry => {
            const info = { title: entry.title, cover: entry.cover || entry.coverImage, id: entry._id, externalId: entry.externalId, mediaType: entry.type }
            
            if (entry.status === 'completed' || entry.status === 'watched') {
                activity.push({ type: 'completed', media: info, rating: entry.rating > 0 ? entry.rating : null, time: entry.updatedAt })
            } else if (entry.status === 'watching') {
                activity.push({ type: 'watching', media: info, time: entry.updatedAt })
            } else if (entry.status === 'dropped') {
                activity.push({ type: 'dropped', media: info, time: entry.updatedAt })
            } else if (entry.status === 'planned' || entry.status === 'plan_to_watch') {
                activity.push({ type: 'planned', media: info, time: entry.createdAt })
            } else if (entry.status === 'on_hold') {
                activity.push({ type: 'paused', media: info, time: entry.updatedAt })
            }
            if (entry.rating > 0 && entry.status !== 'completed' && entry.status !== 'watched') {
                activity.push({ type: 'rated', media: info, rating: entry.rating, time: entry.updatedAt })
            }
        })

        activity.sort((a, b) => new Date(b.time) - new Date(a.time))
        res.json({ success: true, activity: activity.slice(0, 30) })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch activity', error: error.message })
    }
})

// ── GET /api/games/stats/:igdbId ── O(1) Lookup (Optimized)
router.get('/stats/:igdbId', async (req, res) => {
    try {
        const igdbId = Number(req.params.igdbId)
        if (isNaN(igdbId)) return res.status(400).json({ success: false, message: 'Invalid IGDB ID' })
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
        if (isNaN(igdbId)) return res.status(400).json({ success: false, message: 'Invalid IGDB ID' })
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

        // Log view engagement for trending
        logEngagement(igdbId, 'game', 'view', userId);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/games/stats/batch ── O(N) where N is batch size (Optimized)
router.post('/stats/batch', async (req, res) => {
    try {
        const { igdbIds } = req.body
        if (!igdbIds?.length) return res.json({ success: true, stats: {} })
        const ids = igdbIds.map(Number).filter(id => !isNaN(id))
        
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
        const session = await mongoose.startSession()
        session.startTransaction()
        try {
            // 🛡️ Prevent Duplicates: Use findOneAndUpdate with upsert for atomicity
            const searchId = igdbId ? Number(igdbId) : null
            let query = { userId: req.user._id }
            
            if (searchId) {
                query.igdbId = searchId
            } else {
                query.title = { $regex: new RegExp(`^${title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
            }

            const existing = await Game.findOne(query).session(session)
            const isNew = !existing

            const updateData = {
                userId: req.user._id,
                title, genre, status, rating, hours, platforms, steamId, notes, cover, summary, igdbId: searchId
            }

            const savedGame = await Game.findOneAndUpdate(
                query,
                { $set: updateData },
                { upsert: true, returnDocument: 'after', session }
            )

            const statsUpdate = { loggedCount: isNew ? 1 : 0 }
            const oldRating = existing?.rating || 0
            const ratingDelta = Number(rating) - oldRating
            const countDelta = (isNew && rating > 0) ? 1 : (!isNew && oldRating === 0 && rating > 0) ? 1 : (!isNew && oldRating > 0 && rating === 0) ? -1 : 0

            if (ratingDelta !== 0 || countDelta !== 0) {
                statsUpdate.ratingCount = countDelta
                statsUpdate.totalRatingSum = ratingDelta
            }

            if (searchId) {
                await updateGlobalStats(searchId, statsUpdate, session)
            }

            const userStatsUpdate = {
                'gameStats.total': isNew ? 1 : 0,
                'gameStats.totalHours': (Number(hours) || 0) - (existing?.hours || 0)
            }
            if (isNew) {
                userStatsUpdate[`gameStats.${status}`] = 1
            } else if (existing.status !== status) {
                userStatsUpdate[`gameStats.${existing.status}`] = -1
                userStatsUpdate[`gameStats.${status}`] = 1
            }
            
            if (ratingDelta !== 0 || countDelta !== 0) {
                userStatsUpdate['gameStats.ratingCount'] = countDelta
                userStatsUpdate['gameStats.totalRatingSum'] = ratingDelta
            }

            await updateUserStats(req.user._id, userStatsUpdate, session)

            let updatedUser = req.user
            let xpGained = 0

            if (isNew) {
                updatedUser = await awardXP(req.user._id, 1, session)
                xpGained += 1
            }

            if (countDelta === 1) {
                updatedUser = await awardXP(req.user._id, 1, session)
                xpGained += 1
                if (searchId) await logEngagement(searchId, 'game', 'rating', req.user._id, session)
            } else if (countDelta === -1) {
                updatedUser = await deductXP(req.user._id, 1, session)
                xpGained -= 1
            }

            await session.commitTransaction()
            session.endSession()
            res.status(isNew ? 201 : 200).json({
                success: true,
                message: isNew ? 'Game added successfully' : 'Game updated successfully',
                game: savedGame,
                xpGained,
                xp: updatedUser.xp,
                level: updatedUser.level,
                badge: updatedUser.badge
            })
        } catch (innerErr) {
            await session.abortTransaction()
            session.endSession()
            throw innerErr
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to add game', error: error.message })
    }
})



router.put('/:id', protect, async (req, res) => {
    try {
        const existingGame = await Game.findOne({ _id: req.params.id, userId: req.user._id })
        if (!existingGame) return res.status(404).json({ success: false, message: 'Game not found or not authorized' })
        const oldRating = existingGame.rating || 0
        const hadRatingBefore = oldRating > 0
        const hasRatingNow = req.body.rating > 0
        const session = await mongoose.startSession()
        session.startTransaction()
        try {
            const game = await Game.findOneAndUpdate(
                { _id: req.params.id, userId: req.user._id },
                { $set: req.body },
                { returnDocument: 'after', session }
            )
            if (game.igdbId) {
                const ratingDelta = (Number(req.body.rating) || 0) - oldRating
                const countDelta = (!hadRatingBefore && hasRatingNow) ? 1 : (hadRatingBefore && !hasRatingNow) ? -1 : 0
                if (ratingDelta !== 0 || countDelta !== 0) {
                    await updateGlobalStats(game.igdbId, {
                        ratingCount: countDelta,
                        totalRatingSum: ratingDelta
                    }, session)
                }
            }
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
                await updateUserStats(req.user._id, userStatsUpdate, session)
            }
            let updatedUser = null
            if (!hadRatingBefore && hasRatingNow) {
                updatedUser = await awardXP(req.user._id, 1, session)
            }
            if (hadRatingBefore && !hasRatingNow) {
                updatedUser = await deductXP(req.user._id, 1, session)
            }
            await session.commitTransaction()
            session.endSession()
            res.json({
                success: true,
                message: 'Game updated',
                game,
                ...(updatedUser && { xp: updatedUser.xp, level: updatedUser.level, badge: updatedUser.badge })
            })
        } catch (innerErr) {
            await session.abortTransaction()
            session.endSession()
            throw innerErr
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update game', error: error.message })
    }
})

router.delete('/:id', protect, async (req, res) => {
    try {
        const result = await withRetryTransaction(async (session) => {
            const game = await Game.findOne({ _id: req.params.id, userId: req.user._id }).session(session)
            if (!game) throw new Error('Game not found or not authorized')

            let xpToDeduct = 1
            if (game.rating > 0) xpToDeduct += 1

            // 1. Delete the game
            await game.deleteOne({ session })

            // 2. Update Media Stats
            if (game.igdbId) {
                await updateGlobalStats(game.igdbId, {
                    loggedCount: -1,
                    ratingCount: game.rating > 0 ? -1 : 0,
                    totalRatingSum: game.rating > 0 ? -game.rating : 0
                }, session)
            }

            // 3. Update User Stats
            const userStatsDelete = {
                'gameStats.total': -1,
                [`gameStats.${game.status}`]: -1,
                'gameStats.totalHours': -(game.hours || 0)
            }
            if (game.rating > 0) {
                userStatsDelete['gameStats.ratingCount'] = -1
                userStatsDelete['gameStats.totalRatingSum'] = -game.rating
            }
            await updateUserStats(req.user._id, userStatsDelete, session)

            // 4. Deduct XP
            const updatedUser = await deductXP(req.user._id, xpToDeduct, session)
            
            return { updatedUser, xpToDeduct }
        })

        res.json({
            success: true,
            message: 'Game deleted',
            xpDeducted: result.xpToDeduct,
            xp: result.updatedUser.xp,
            level: result.updatedUser.level,
            badge: result.updatedUser.badge
        })
    } catch (error) {
        console.error('Delete Game Error:', error)
        res.status(500).json({ success: false, message: 'Failed to delete game', error: error.message })
    }
})

export default router
