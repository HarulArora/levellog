import User from '../models/User.js'

export const LEVELS = [
    { level: 1, xpRequired: 0, badge: '🎮', title: 'Newbie' },
    { level: 2, xpRequired: 5, badge: '🕹️', title: 'Gamer' },
    { level: 3, xpRequired: 25, badge: '⭐', title: 'Enthusiast' },
    { level: 4, xpRequired: 60, badge: '🔥', title: 'Veteran' },
    { level: 5, xpRequired: 100, badge: '💎', title: 'Legend' },
    { level: 6, xpRequired: 150, badge: '👑', title: 'Elite' },
    { level: 7, xpRequired: 500, badge: '🚀', title: 'Master' },
    { level: 8, xpRequired: 1000, badge: '🌟', title: 'Immortal' },
]

export const getLevelInfo = (xp) => {
    let current = LEVELS[0]
    let next = LEVELS[1]
    for (let i = 0; i < LEVELS.length; i++) {
        if (xp >= LEVELS[i].xpRequired) {
            current = LEVELS[i]
            next = LEVELS[i + 1] || null
        }
    }
    return { current, next }
}

export const awardXP = async (userId, amount = 1) => {
    // Atomic increment to prevent race conditions
    const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { xp: amount } },
        { returnDocument: 'after' }
    )
    if (!user) return

    // Ensure level and badge are in sync
    const { current } = getLevelInfo(user.xp)
    if (user.level !== current.level || user.badge !== current.badge) {
        // Use updateOne to bypass full document validation (avoids legacy data validation errors)
        await User.updateOne(
            { _id: userId },
            { $set: { level: current.level, badge: current.badge } }
        )
        user.level = current.level
        user.badge = current.badge
    }
    return user
}

// XP never goes below 0. Level recalculates automatically.
// Unlocked content is preserved in DB but locked in route-level checks.
export const deductXP = async (userId, amount = 1) => {
    // We fetch first to ensure we don't go below 0
    const user = await User.findById(userId)
    if (!user) return

    const newXP = Math.max(0, (user.xp || 0) - amount)
    
    // Update atomically
    await User.updateOne({ _id: userId }, { $set: { xp: newXP } })
    
    const { current } = getLevelInfo(newXP)
    if (user.level !== current.level || user.badge !== current.badge) {
        await User.updateOne(
            { _id: userId },
            { $set: { level: current.level, badge: current.badge } }
        )
    }
    
    // Return updated user (minimal)
    user.xp = newXP
    user.level = current.level
    user.badge = current.badge
    return user
}
