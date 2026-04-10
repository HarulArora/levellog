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
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        )

        // Recalculate average if rating changed
        if (updates.ratingCount || updates.ratingValue) {
            const newAvg = stats.ratingCount > 0 
                ? parseFloat((stats.totalRatingSum / stats.ratingCount).toFixed(1))
                : 0
            
            await GlobalStats.updateOne({ igdbId }, { avgRating: newAvg })
        }
    } catch (err) {
        console.error(`[Stats] Error updating global stats for ${igdbId}:`, err)
    }
}
