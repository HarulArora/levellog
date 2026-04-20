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
    ttl: 1000 * 10, // 10-second "heartbeat" cache for live feel
})

router.get('/top', async (req, res) => {
    try {
        if (leaderboardCache.has('top10')) {
            return res.json({ success: true, leaderboard: leaderboardCache.get('top10') })
        }

        /**
         * 🏆 GLOBAL XP LEADERS
         * We rank users based on their total XP and Level.
         */
        const topUsers = await User.find({
            isEmailVerified: true,
            xp: { $gt: 0 }
        })
        .sort({ xp: -1, level: -1 })
        .limit(10)
        .select('username avatar level badge xp')

        // Construct final leaderboard with rank
        const leaderboard = topUsers.map((user, index) => {
            return {
                ...user.toObject(),
                rank: index + 1
            }
        })

        leaderboardCache.set('top10', leaderboard)
        res.json({ success: true, leaderboard })

    } catch (err) {
        logger.error('Leaderboard Fetch Error:', err)
        res.status(500).json({ success: false, message: 'Failed to generate leaderboard' })
    }
})

export default router
