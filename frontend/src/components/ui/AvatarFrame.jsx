import { useLeaderboard } from '../../context/LeaderboardContext'
import './AvatarFrame.css'

const RANK_CONFIG = {
    1: { label: '👑', color: '#ffd700', name: 'Gold Crown' },
    2: { label: '👑', color: '#c0c0c0', name: 'Silver Crown' },
    3: { label: '👑', color: '#cd7f32', name: 'Bronze Crown' },
    4: { label: '⚔️', color: '#8d9194', name: 'Iron Guard' },
}

export default function AvatarFrame({ userId, src, size = 40, className = '' }) {
    const { topUsers } = useLeaderboard()
    
    const userRankInfo = topUsers.find(u => u._id === userId)
    const rank = userRankInfo?.rank

    const config = RANK_CONFIG[rank]
    const isTop10 = rank && rank <= 10
    const hasSpecialCrown = rank && rank <= 4

    return (
        <div 
            className={`avatar-frame-container ${hasSpecialCrown ? 'has-crown' : ''} ${isTop10 ? 'is-top-10' : ''} ${className}`}
            style={{ width: size, height: size }}
        >
            {/* The Actual Avatar */}
            <img 
                src={src || `https://ui-avatars.com/api/?name=${userRankInfo?.username || 'U'}&background=random`} 
                alt="Avatar"
                className="avatar-image"
            />

            {/* Crown / Badge Overlay */}
            {hasSpecialCrown && (
                <div className="rank-crown" style={{ color: config.color }}>
                    {config.label}
                </div>
            )}

            {isTop10 && !hasSpecialCrown && (
                <div className="rank-badge">
                    #{rank}
                </div>
            )}

            {/* Glowing Border for Rank 1 */}
            {rank === 1 && <div className="king-glow" />}
        </div>
    )
}
