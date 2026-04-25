import GlobalStats from '../models/GlobalStats.js'

/**
 * Update global stats for a game using atomic operations.
 * @param {number} igdbId 
 * @param {object} updates - e.g. { loggedCount: 1, wishlistCount: -1 }
 */
export const updateGlobalStats = async (igdbId, updates = {}) => {
    if (!igdbId) return

    const inc = {}
    if (updates.loggedCount) inc.loggedCount = updates.loggedCount
    if (updates.wishlistCount) inc.wishlistCount = updates.wishlistCount
    if (updates.likeCount) inc.likeCount = updates.likeCount
    if (updates.ratingCount) inc.ratingCount = updates.ratingCount
    if (updates.ratingValue) {
        // ratingValue should be the raw rating to add/subtract from sum
        inc.totalRatingSum = updates.ratingValue
    }

    try {
        const stats = await GlobalStats.findOneAndUpdate(
            { igdbId: Number(igdbId) },
            { $inc: inc },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
        )

        // Recalculate average if rating changed
        if (updates.ratingCount || updates.ratingValue) {
            const newAvg = stats.ratingCount > 0 
                ? parseFloat((stats.totalRatingSum / stats.ratingCount).toFixed(1))
                : null
            
            // Also ensure totalRatingSum doesn't get messed up (failsafe)
            const finalRatingSum = Math.max(0, stats.totalRatingSum)
            
            await GlobalStats.updateOne(
                { igdbId }, 
                { 
                    avgRating: newAvg,
                    totalRatingSum: finalRatingSum 
                }
            )
        }
    } catch (err) {
        // If we hit a min: 0 constraint error, it means a count tried to go negative.
        // We'll catch it and "fix" the stat to 0.
        if (err.name === 'ValidationError') {
            const repair = {}
            if (updates.loggedCount) repair.loggedCount = 0
            if (updates.wishlistCount) repair.wishlistCount = 0
            if (updates.likeCount) repair.likeCount = 0
            if (updates.ratingCount) repair.ratingCount = 0
            
            await GlobalStats.updateOne({ igdbId: Number(igdbId) }, { $set: repair })
        }
        console.error(`[Stats] Error updating global stats for ${igdbId}:`, err)
    }
}

/**
 * Perform a full recalculation of stats for a single game.
 * Useful for self-healing when inconsistencies are detected.
 * @param {number} igdbId 
 */
export const syncGlobalStats = async (igdbId) => {
    if (!igdbId) return;
    
    // Dynamic imports to avoid circular dependencies if any
    const Game = (await import('../models/Game.js')).default;
    const GameLike = (await import('../models/GameLike.js')).default;
    const Wishlist = (await import('../models/Wishlist.js')).default;

    try {
        const [realLogged, realLikes, realWishlist, ratingData] = await Promise.all([
            Game.countDocuments({ igdbId }),
            GameLike.countDocuments({ igdbId }),
            Wishlist.countDocuments({ igdbId }),
            Game.aggregate([
                { $match: { igdbId, rating: { $gt: 0 } } },
                { $group: { _id: '$igdbId', avg: { $avg: '$rating' }, count: { $sum: 1 }, sum: { $sum: '$rating' } } }
            ])
        ]);

        const r = ratingData[0] || { avg: 0, count: 0, sum: 0 };
        const newAvg = r.count > 0 ? parseFloat(r.avg.toFixed(1)) : null;

        await GlobalStats.findOneAndUpdate(
            { igdbId: Number(igdbId) },
            { 
                loggedCount: realLogged,
                likeCount: realLikes,
                wishlistCount: realWishlist,
                ratingCount: r.count,
                totalRatingSum: r.sum,
                avgRating: newAvg
            },
            { upsert: true }
        );
    } catch (err) {
        console.error(`[Stats] Error syncing global stats for ${igdbId}:`, err);
    }
};
