import express from 'express'
import User from '../models/User.js'
import Game from '../models/Game.js'
import { LRUCache } from 'lru-cache'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * 👑 THE THRONE CACHE
 * We cache the leaderboard for 10 minutes to prevent massive DB load
 */
const leaderboardCache = new LRUCache({
    max: 10,
    ttl: 1000 * 60 * 10, // 10 minutes
})

router.get('/top', async (req, res) => {
    try {
        if (leaderboardCache.has('top10')) {
            return res.json({ success: true, leaderboard: leaderboardCache.get('top10') })
        }

        /**
         * 🏆 QUALITY PROGRESS SCORING (Last 7 Days)
         * We look for active progress in the last week.
         */
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        // 1. Get all games updated/created in last 7 days
        const activeGames = await Game.find({
            updatedAt: { $gte: sevenDaysAgo }
        }).select('userId status hours')

        // 2. Aggregate scores per user
        const scores = {}
        activeGames.forEach(game => {
            if (!game.userId) return
            const uid = game.userId.toString()
            if (!scores[uid]) scores[uid] = 0
            
            // Score Logic:
            // - Every hour played = 1 pt
            // - Completion bonus = 25 pts
            scores[uid] += (game.hours || 0)
            if (game.status === 'completed') scores[uid] += 25
        })

        // 3. Get user details for the top scorers
        const sortedUids = Object.keys(scores).sort((a, b) => scores[b] - scores[a]).slice(0, 10)
        
        const topUsers = await User.find({
            _id: { $in: sortedUids }
        }).select('username avatar level badge xp')

        // 4. Construct final leaderboard with rank and score
        const leaderboard = sortedUids.map((id, index) => {
            const user = topUsers.find(u => u._id.toString() === id)
            if (!user) return null
            return {
                ...user.toObject(),
                rank: index + 1,
                weeklyScore: Math.round(scores[id])
            }
        }).filter(Boolean)

        leaderboardCache.set('top10', leaderboard)
        res.json({ success: true, leaderboard })

    } catch (err) {
        logger.error('Leaderboard Fetch Error:', err)
        res.status(500).json({ success: false, message: 'Failed to generate leaderboard' })
    }
})

export default router
