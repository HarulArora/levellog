import User from '../models/User.js'

export const LEVELS = [
    { level: 1, xpRequired: 0, badge: '🔰', title: 'Initiate' },
    { level: 2, xpRequired: 500, badge: '🧭', title: 'Explorer' },
    { level: 3, xpRequired: 2500, badge: '🍿', title: 'Enthusiast' },
    { level: 4, xpRequired: 10000, badge: '✍️', title: 'Critic' },
    { level: 5, xpRequired: 30000, badge: '🍷', title: 'Connoisseur' },
    { level: 6, xpRequired: 70000, badge: '🏛️', title: 'Curator' },
    { level: 7, xpRequired: 100000, badge: '🔮', title: 'Oracle' },
    { level: 8, xpRequired: 150000, badge: '🌠', title: 'Immortal' },
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

/**
 * ⚡ Atomic XP Award
 * Uses $inc to prevent race conditions during high-frequency engagement.
 */
export const awardXP = async (userId, amount = 1, session = null) => {
    if (amount === 0) return await User.findById(userId).session(session);

    const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { xp: amount } },
        { returnDocument: 'after', session }
    )
    if (!user) return

    // Recalculate levels/badges if threshold crossed
    const { current } = getLevelInfo(user.xp)
    if (user.level !== current.level || user.badge !== current.badge) {
        await User.updateOne(
            { _id: userId },
            { $set: { level: current.level, badge: current.badge } },
            { session }
        )
        user.level = current.level
        user.badge = current.badge
    }
    return user
}

/**
 * ⚡ Atomic XP Deduction
 * Uses $inc with negative value and prevents XP from dropping below 0.
 */
export const deductXP = async (userId, amount = 1, session = null) => {
    if (amount === 0) return await User.findById(userId).session(session);

    // 1. Atomically decrement
    let user = await User.findByIdAndUpdate(
        userId,
        { $inc: { xp: -amount } },
        { returnDocument: 'after', session }
    )
    if (!user) return

    // 2. Safety Check: Never go below 0
    if (user.xp < 0) {
        user = await User.findByIdAndUpdate(
            userId,
            { $set: { xp: 0 } },
            { returnDocument: 'after', session }
        )
    }

    // 3. Recalculate levels/badges
    const { current } = getLevelInfo(user.xp)
    if (user.level !== current.level || user.badge !== current.badge) {
        await User.updateOne(
            { _id: userId },
            { $set: { level: current.level, badge: current.badge } },
            { session }
        )
        user.level = current.level
        user.badge = current.badge
    }
    return user
}
