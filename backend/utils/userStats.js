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

/**
 * Perform a full recalculation of user game statistics from the Game collection.
 * This is the ultimate 'permanent fix' for out-of-sync counters.
 */
export const syncUserStats = async (userId) => {
    if (!userId) return;
    try {
        const Game = (await import('../models/Game.js')).default;
        
        const [statsAgg] = await Game.aggregate([
            { $match: { userId: new (await import('mongoose')).default.Types.ObjectId(userId) } },
            { $group: {
                _id: null,
                total: { $sum: 1 },
                playing: { $sum: { $cond: [{ $eq: ['$status', 'playing'] }, 1, 0] } },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                planned: { $sum: { $cond: [{ $eq: ['$status', 'planned'] }, 1, 0] } },
                dropped: { $sum: { $cond: [{ $eq: ['$status', 'dropped'] }, 1, 0] } },
                paused: { $sum: { $cond: [{ $eq: ['$status', 'paused'] }, 1, 0] } },
                totalHours: { $sum: { $cond: [{ $gt: ['$hours', 0] }, '$hours', 0] } },
                ratingCount: { $sum: { $cond: [{ $gt: ['$rating', 0] }, 1, 0] } },
                totalRatingSum: { $sum: { $cond: [{ $gt: ['$rating', 0] }, '$rating', 0] } }
            }}
        ]);

        const s = statsAgg || { 
            total: 0, playing: 0, completed: 0, planned: 0, dropped: 0, paused: 0, 
            totalHours: 0, ratingCount: 0, totalRatingSum: 0 
        };

        const avgRating = s.ratingCount > 0 ? parseFloat((s.totalRatingSum / s.ratingCount).toFixed(1)) : 0;

        await User.findByIdAndUpdate(userId, {
            $set: {
                'gameStats.total': s.total,
                'gameStats.playing': s.playing,
                'gameStats.completed': s.completed,
                'gameStats.planned': s.planned,
                'gameStats.dropped': s.dropped,
                'gameStats.paused': s.paused,
                'gameStats.totalHours': s.totalHours,
                'gameStats.ratingCount': s.ratingCount,
                'gameStats.totalRatingSum': s.totalRatingSum,
                'gameStats.avgRating': avgRating
            }
        });
        
        console.log(`[UserStats] Synced stats for user ${userId}`);
    } catch (err) {
        console.error(`[UserStats] Error syncing stats for user ${userId}:`, err);
    }
};
