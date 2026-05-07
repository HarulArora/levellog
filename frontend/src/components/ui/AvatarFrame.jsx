import { useLeaderboard } from '../../context/LeaderboardContext'
import './AvatarFrame.css'

const RANK_CONFIG = {
    1: { label: '👑', color: '#ffd700', name: 'Gold Crown' },
    2: { label: '🪽', color: '#B9F2FF', name: 'Silver Wings' },
    3: { label: '🎖️', color: '#cd7f32', name: 'Bronze Medal' },
    4: { label: '⚔️', color: '#94999c', name: 'Iron Guard' },
}

export default function AvatarFrame({ userId, src, size = 40, className = '' }) {
    const { topUsers } = useLeaderboard()
    
    const userRankInfo = topUsers.find(u => u._id === userId)
    const rank = userRankInfo?.rank

    const config = RANK_CONFIG[rank]
    const isTop10 = rank && rank <= 10
    const hasSpecialIcon = rank && rank <= 4

    return (
        <div 
            className={`avatar-frame-container ${hasSpecialIcon ? 'has-crown' : ''} ${isTop10 ? 'is-top-10' : ''} ${className}`}
            style={{ width: `${size}px`, height: `${size}px`, minWidth: `${size}px`, minHeight: `${size}px` }}
        >
            {/* The Actual Avatar */}
            <img 
                src={src || `https://ui-avatars.com/api/?name=${userRankInfo?.username || 'U'}&background=random`} 
                alt="Avatar"
                className="avatar-image"
            />

            {/* Floating Symbol Overlay */}
            {hasSpecialIcon && (
                <div className="rank-crown" style={{ color: config.color }}>
                    {config.label}
                </div>
            )}

            {/* Rank Number Overlay (Visible for all Top 10) */}
            {isTop10 && (
                <div 
                    className="rank-number-overlay" 
                    style={{ 
                        backgroundColor: config?.color || '#c8ff57',
                        color: (rank <= 2 || rank >= 5) ? '#000' : '#fff' // Dark text for bright tiers
                    }}
                >
                    #{rank}
                </div>
            )}

            {/* Glowing Border for Rank 1 */}
            {rank === 1 && <div className="king-glow" />}
        </div>
    )
}
