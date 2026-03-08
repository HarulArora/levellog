import User from '../models/User.js'

const LEVELS = [
    { level: 1, xpRequired: 0, badge: '🎮', title: 'Newbie' },
    { level: 2, xpRequired: 5, badge: '🕹️', title: 'Gamer' },
    { level: 3, xpRequired: 15, badge: '⭐', title: 'Enthusiast' },
    { level: 4, xpRequired: 30, badge: '🔥', title: 'Veteran' },
    { level: 5, xpRequired: 50, badge: '💎', title: 'Legend' },
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

    // Recalculate level
    const { current } = getLevelInfo(user.xp)
    user.level = current.level
    user.badge = current.badge

    await user.save()
    return user
}