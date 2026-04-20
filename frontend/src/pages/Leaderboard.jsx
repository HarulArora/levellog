import { useState, useEffect } from 'react'
import { useLeaderboard } from '../context/LeaderboardContext'
import AvatarFrame from '../components/ui/AvatarFrame'
import { Trophy, TrendingUp, Zap, Crown } from 'lucide-react'
import { Helmet } from 'react-helmet-async'

const RANK_UI = {
    1: { label: 'GRAND CHAMPION', bgColor: 'bg-gradient-to-r from-[#ffd700]/20 to-transparent', textColor: 'text-[#ffd700]' },
    2: { label: 'CHALLENGER', bgColor: 'bg-[#c0c0c0]/10', textColor: 'text-[#c0c0c0]' },
    3: { label: 'ELITE', bgColor: 'bg-[#cd7f32]/10', textColor: 'text-[#cd7f32]' },
}

export default function Leaderboard() {
    const { topUsers, loading } = useLeaderboard()

    return (
        <div className="max-w-[1000px] mx-auto px-5 md:px-10 py-12">
            <Helmet>
                <title>Leaderboard | QuestDuck</title>
                <meta name="description" content="Check out the top contributors and best gamers of the week on QuestDuck." />
            </Helmet>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <div className="flex items-center gap-3 text-[#c8ff57] mb-2">
                        <Trophy size={20} />
                        <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em]">Hall of Fame</span>
                    </div>
                    <h1 className="font-black text-5xl md:text-7xl uppercase tracking-widest text-white leading-none" 
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        THE <span className="text-[#c8ff57]">THRONE</span>
                    </h1>
                    <p className="text-[#7a7a90] text-sm mt-4 font-medium max-w-md">
                        Only the top 10 hunters who showed pure dedication this week earn a seat at the table. Crowns are awarded live.
                    </p>
                </div>
                
                <div className="flex items-center gap-4 bg-[#111118] border border-[#2a2a35] p-3 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-[#c8ff57]/10 flex items-center justify-center text-[#c8ff57]">
                        <Zap size={20} className="fill-current" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-[#7a7a90] uppercase tracking-widest">Next Refresh</div>
                        <div className="text-white font-mono font-bold">LIVE</div>
                    </div>
                </div>
            </div>

            {/* Top 3 Visual Podium */}
            {!loading && topUsers.length >= 3 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {[2, 1, 3].map(pos => {
                        const user = topUsers.find(u => u.rank === pos)
                        if (!user) return null
                        return (
                            <div key={pos} className={`relative p-6 rounded-2xl border ${pos === 1 ? 'border-[#ffd700]/50 bg-[#ffd700]/5 order-first md:order-none scale-105 z-10' : 'border-[#2a2a35] bg-[#111118]'}`}>
                                {pos === 1 && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#ffd700] text-black text-[10px] font-black rounded-full shadow-lg">CURRENT KING</div>}
                                <div className="flex flex-col items-center text-center gap-4">
                                    <AvatarFrame userId={user._id} src={user.avatar} size={pos === 1 ? 100 : 80} />
                                    <div>
                                        <div className={`font-black text-2xl uppercase tracking-wider ${pos === 1 ? 'text-[#ffd700]' : 'text-white'}`}>{user.username}</div>
                                        <div className="text-[#7a7a90] font-mono text-[10px] uppercase font-bold mt-1">LV.{user.level} · {user.weeklyScore} PTS</div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* The List (Remaining 10) */}
            <div className="bg-[#111118] border border-[#2a2a35] rounded-2xl overflow-hidden shadow-2xl">
                <div className="grid grid-cols-[60px_1fr_100px] px-6 py-4 border-b border-[#2a2a35] text-[#7a7a90] font-mono text-[10px] font-black uppercase tracking-widest bg-[#1a1a25]/50">
                    <div>Rank</div>
                    <div>User</div>
                    <div className="text-right">Activity</div>
                </div>

                {loading ? (
                    <div className="p-10 text-center text-[#7a7a90] animate-pulse font-mono py-20 text-sm">SCANNING THE POND...</div>
                ) : (
                    topUsers.map((user) => {
                        const style = RANK_UI[user.rank] || { bgColor: '', textColor: 'text-white' }
                        return (
                            <div key={user._id} className={`grid grid-cols-[60px_1fr_100px] items-center px-6 py-4 border-b border-[#2a2a35]/50 last:border-0 hover:bg-[#c8ff57]/5 transition-colors group ${style.bgColor}`}>
                                <div className={`font-mono font-black text-xl ${style.textColor}`}>#{user.rank}</div>
                                <div className="flex items-center gap-4">
                                    <AvatarFrame userId={user._id} src={user.avatar} size={42} />
                                    <div>
                                        <div className="text-white font-bold tracking-tight group-hover:text-[#c8ff57] transition-colors">{user.username}</div>
                                        <div className="text-[#7a7a90] text-[10px] font-medium uppercase tracking-widest flex items-center gap-2">
                                            <span>{user.badge || '🎮'}</span>
                                            <span>Lv.{user.level}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-white font-mono font-bold">{user.weeklyScore}</div>
                                    <div className="text-[#7a7a90] text-[8px] font-black uppercase tracking-widest">Score</div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
