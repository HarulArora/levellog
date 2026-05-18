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

export const getXPProgress = (xp) => {
    const { current, next } = getLevelInfo(xp)
    if (!next) return 100
    return ((xp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100
}
