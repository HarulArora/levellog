import { Link, useNavigate } from 'react-router-dom'
import AvatarFrame from './AvatarFrame'
import { getXPProgress } from '../../utils/levels'

const BAR_THEMES = {
    1: 'bg-gradient-to-r from-[#ffd700]/15 to-[#111118] border-y-[#ffd700]/40 shadow-[0_0_40px_rgba(255,215,0,0.05)]',
    2: 'bg-gradient-to-r from-[#B9F2FF]/15 to-[#111118] border-y-[#B9F2FF]/30',
    3: 'bg-gradient-to-r from-[#cd7f32]/15 to-[#111118] border-y-[#cd7f32]/30',
    4: 'bg-gradient-to-r from-[#94999c]/15 to-[#111118] border-y-[#94999c]/30',
}

const StatsBar = ({ user, userRank, stats, mediaType }) => {
    const navigate = useNavigate()

    if (!user) return null

    const mediaLabel = {
        game: 'Games',
        anime: 'Anime',
        manga: 'Manga',
        movie: 'Movies',
        tv: 'TV Shows'
    }[mediaType] || 'Items'

    const activeLabel = {
        game: 'Playing',
        anime: 'Watching',
        manga: 'Reading',
        movie: 'Watching',
        tv: 'Watching'
    }[mediaType] || 'Active'

    return (
        <section 
            className={`border-y border-[#2a2a35] cursor-pointer hover:brightness-110 transition-all duration-500
                        ${BAR_THEMES[userRank] || 'bg-[#111118] hover:bg-[#18181f]'}`} 
            onClick={() => navigate(`/stats?media=${mediaType}`)}
        >
            <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-5">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="flex items-center gap-3">
                        <AvatarFrame 
                            userId={user?._id || user?.id} 
                            src={user?.avatar} 
                            size={42} 
                            className="home-stats-avatar" 
                        />
                        <div className="flex flex-col gap-1 min-w-0">
                            <div className="text-white font-bold text-sm truncate">{user.username}</div>
                            <div className="font-mono text-[10px] text-[#7a7a90]">@{user.username} · {mediaLabel} Stats</div>
                            <div className="flex items-center gap-2.5 mt-2" onClick={(e) => { e.stopPropagation(); navigate('/stats?tab=xp') }}>
                                <div className="flex items-center gap-1.5 bg-[#0a0a0f]/60 rounded-full px-2.5 py-1 border border-[#2a2a35] w-fit shadow-inner shadow-black/60 shadow-[0_1px_4px_rgba(0,0,0,0.5)] hover:border-[#c8ff57]/50 transition-colors">
                                    <span className="flex items-center justify-center text-xs leading-none relative -top-[1.8px] flex-shrink-0">{user.badge || '🎮'}</span>
                                    <span className="font-mono text-[10px] text-[#c8ff57] uppercase font-black tracking-widest flex-shrink-0 leading-none">Lv.{user.level || 1}</span>
                                </div>
                                <div className="flex items-center gap-2 group/xp cursor-pointer">
                                    <div className="w-16 h-1 bg-[#2a2a35] rounded-full flex-shrink-0 overflow-hidden">
                                        <div className="h-full rounded-full bg-gradient-to-r from-[#c8ff57] to-[#5c9fff] transition-all group-hover/xp:shadow-[0_0_8px_rgba(200,255,87,0.5)]"
                                            style={{ width: `${getXPProgress(user.xp || 0)}%` }} />
                                    </div>
                                    <span className="font-mono text-[10px] text-[#7a7a90] group-hover/xp:text-[#c8ff57] flex-shrink-0 tabular-nums font-bold tracking-tight whitespace-nowrap leading-none transition-colors">{user.xp || 0} XP</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="hidden sm:block w-px h-8 bg-[#2a2a35]" />
                    <div className="flex gap-6">
                        { [
                            { value: stats.total, label: 'Total' },
                            { value: stats.active, label: activeLabel },
                            { value: stats.completed, label: 'Completed' },
                            { value: stats.planned, label: 'Planned' },
                        ].map(stat => (
                            <div key={stat.label} className="flex flex-col text-center sm:text-left min-w-[60px]">
                                <div className="font-black text-2xl text-white leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{stat.value ?? 0}</div>
                                <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider mt-1">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="sm:ml-auto">
                        <Link to={`/stats?media=${mediaType}`} onClick={(e) => e.stopPropagation()}>
                            <button className="font-mono text-xs text-[#94a3b8] hover:text-[#c8ff57] transition-colors">View Full Stats →</button>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default StatsBar
