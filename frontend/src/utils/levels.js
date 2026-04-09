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

export const getXPProgress = (xp) => {
    const { current, next } = getLevelInfo(xp)
    if (!next) return 100
    return ((xp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100
}
