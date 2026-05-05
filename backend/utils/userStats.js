import User from '../models/User.js'

/**
 * Update a specific user's game statistics atomically.
 * @param {string} userId 
 * @param {object} updates - e.g. { 'gameStats.total': 1, 'gameStats.completed': 1 }
 */
export const updateUserStats = async (userId, updates = {}, session = null) => {
    if (!userId) return

    try {
        const user = await User.findByIdAndUpdate(
            userId,
            { $inc: updates },
            { returnDocument: 'after', session }
        )

        // Recalculate average rating if rating stats changed
        const stats = user.gameStats
        if (updates['gameStats.ratingCount'] || updates['gameStats.totalRatingSum']) {
            const newAvg = stats.ratingCount > 0 
                ? parseFloat((stats.totalRatingSum / stats.ratingCount).toFixed(1))
                : 0
            
            await User.findByIdAndUpdate(userId, { 'gameStats.avgRating': newAvg }, { session })
        }
    } catch (err) {
        console.error(`[UserStats] Error updating stats for user ${userId}:`, err)
    }
}
