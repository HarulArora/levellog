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
    const user = await User.findById(userId)
    if (!user) return
    user.xp = (user.xp || 0) + amount
    const { current } = getLevelInfo(user.xp)
    user.level = current.level
    user.badge = current.badge
    await user.save()
    return user
}

// XP never goes below 0. Level recalculates automatically.
// Unlocked content is preserved in DB but locked in route-level checks.
export const deductXP = async (userId, amount = 1) => {
    const user = await User.findById(userId)
    if (!user) return
    user.xp = Math.max(0, (user.xp || 0) - amount)
    const { current } = getLevelInfo(user.xp)
    user.level = current.level
    user.badge = current.badge
    await user.save()
    return user
}
