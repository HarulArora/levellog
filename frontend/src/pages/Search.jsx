import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Search as SearchIcon, Users, UserPlus } from 'lucide-react'
import useCachedFetch from '../hooks/useCachedFetch'
import { useFollow } from '../context/FollowContext'
import AvatarFrame from '../components/ui/AvatarFrame'
import { useLeaderboard } from '../context/LeaderboardContext'
import Skeleton from '../components/ui/Skeleton'

const RANK_CARD_STYLES = {
    1: 'bg-gradient-to-b from-[#ffd700]/20 to-[#111118] border-[#ffd700]/50 shadow-[0_0_20px_rgba(255,215,0,0.1)]',
    2: 'bg-gradient-to-b from-[#B9F2FF]/20 to-[#111118] border-[#B9F2FF]/40 shadow-[0_0_20px_rgba(185,242,255,0.05)]',
    3: 'bg-gradient-to-b from-[#cd7f32]/20 to-[#111118] border-[#cd7f32]/40 shadow-[0_0_20px_rgba(205,127,50,0.05)]',
    4: 'bg-gradient-to-b from-[#94999c]/25 to-[#111118] border-[#94999c]/40 shadow-[0_0_20px_rgba(148,153,156,0.05)]',
}

const RANK_TITLES = {
    1: { label: 'KING', color: 'text-[#ffd700]' },
    2: { label: 'TOP CHALLENGER', color: 'text-[#B9F2FF]' },
    3: { label: 'ELITE HUNTER', color: 'text-[#cd7f32]' },
    4: { label: 'IRON GUARD', color: 'text-[#94999c]' },
}

function Search() {
    const { user: currentUser } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const searchParams = new URLSearchParams(location.search)
    
    const initialQuery = searchParams.get('q') || ''

    const [query, setQuery] = useState(initialQuery)
    const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)
    
    const { getFollowStatus, handleFollowToggle, loadingMap } = useFollow()
    const { topUsers } = useLeaderboard()

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query)
        }, 300)
        return () => clearTimeout(timer)
    }, [query])

    useEffect(() => {
        const params = new URLSearchParams()
        if (debouncedQuery) params.set('q', debouncedQuery)
        navigate(`/search?${params.toString()}`, { replace: true })
    }, [debouncedQuery, navigate])

    const trimmed = debouncedQuery.trim()
    const isSearchable = trimmed.length >= 2

    const { data: userData, loading } = useCachedFetch(
        isSearchable ? `user_search_${trimmed.toLowerCase()}` : null,
        isSearchable ? `/auth/search?q=${encodeURIComponent(trimmed)}` : null,
        { enabled: isSearchable, ttl: 5 * 60 * 1000 }
    )

    const results = (userData?.users || []).filter(u => u.username !== currentUser?.username)

    return (
        <div className="w-full max-w-[1200px] mx-auto px-5 md:px-10 py-8 md:py-10 min-h-[70vh]">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-[#2a2a35] pb-8">
                <div>
                    <h2 className="font-black text-4xl md:text-5xl tracking-widest uppercase text-white mb-2"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        Find <span className="text-[#c8ff57]">Friends</span>
                    </h2>
                    <p className="text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest">
                        Search for other players to follow their odyssey
                    </p>
                </div>

                <div className="relative w-full md:w-96">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7a7a90] pointer-events-none">
                        <SearchIcon size={20} strokeWidth={2.5} />
                    </span>
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Enter username..."
                        className="w-full bg-[#111118] border border-[#2a2a35] rounded-xl
                                   pl-12 pr-24 py-4 text-white text-sm font-mono
                                   focus:outline-none focus:border-[#c8ff57]
                                   transition-all placeholder:text-[#7a7a90] shadow-inner shadow-black/20"
                    />
                    {loading && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#c8ff57] font-mono text-[10px] uppercase tracking-widest animate-pulse">
                            Searching...
                        </span>
                    )}
                </div>
            </div>

            {/* Results */}
            {!isSearchable ? (
                <div className="flex flex-col items-center justify-center py-24 gap-6">
                    <div className="w-20 h-20 bg-[#111118] border border-[#2a2a35] rounded-full flex items-center justify-center text-[#2a2a35]">
                        <Users size={32} />
                    </div>
                    <div className="text-center">
                        <h3 className="text-white font-bold text-lg mb-1">Search the Multiverse</h3>
                        <p className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest">
                            Enter at least 2 characters to find players
                        </p>
                    </div>
                </div>
            ) : loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="bg-[#111118] border border-[#2a2a35] rounded-xl p-6 flex flex-col items-center">
                            <Skeleton variant="block" width="80px" height="80px" className="rounded-full mb-4" />
                            <Skeleton variant="line" width="60%" height="16px" className="mb-2" />
                            <Skeleton variant="line" width="40%" height="12px" className="mb-6" />
                            <Skeleton variant="block" width="100%" height="40px" className="rounded-lg" />
                        </div>
                    ))}
                </div>
            ) : results.length === 0 ? (
                <div className="text-center py-24 bg-[#111118] border border-[#2a2a35] border-dashed rounded-2xl">
                    <div className="text-5xl mb-6">🛸</div>
                    <h3 className="text-white font-bold text-xl mb-2">Player not found</h3>
                    <p className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest">
                        We couldn't find any players matching "{trimmed}"
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {results.map(item => (
                        <UserResultCard 
                            key={item._id} 
                            u={item} 
                            getFollowStatus={getFollowStatus} 
                            handleFollowToggle={handleFollowToggle} 
                            loadingMap={loadingMap} 
                            topUsers={topUsers} 
                            currentUser={currentUser} 
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function UserResultCard({ u, getFollowStatus, handleFollowToggle, loadingMap, topUsers, currentUser }) {
    const rank = topUsers.find(tu => tu._id === u._id)?.rank
    const rankClass = RANK_CARD_STYLES[rank] || 'bg-[#111118] border-[#2a2a35]'
    const state = getFollowStatus(u)
    const isBtnLoading = loadingMap[u._id] || false

    return (
        <div className={`${rankClass} border rounded-xl p-6 flex flex-col items-center text-center hover:border-[#c8ff57]/40 transition-all shadow-lg group relative overflow-hidden`}>
            {/* Background Glow for High Ranks */}
            {rank && rank <= 1 && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#ffd700] via-yellow-200 to-[#ffd700]" />
            )}

            <Link to={`/user/${u.username}`} className="mb-4 relative">
                <AvatarFrame userId={u._id} src={u.avatar} size={80} className="suggestion-avatar group-hover:scale-105 transition-transform duration-300" />
            </Link>

            <div className="flex flex-col items-center w-full min-h-[44px] mb-2">
                <Link to={`/user/${u.username}`} className="text-white font-bold text-base hover:text-[#c8ff57] transition-colors truncate w-full">
                    {u.username}
                </Link>
                {u.followsMe && (
                    <span className="font-mono text-[8px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-sm bg-[#c8ff57]/10 text-[#c8ff57] border border-[#c8ff57]/20 mt-1.5">
                        Follows you
                    </span>
                )}
            </div>

            <div className="h-6 flex items-center justify-center w-full mb-6">
                {rank && rank <= 4 ? (
                    <div className={`font-mono text-[9px] font-black uppercase tracking-[0.15em] px-2 py-1 rounded bg-black/20 border border-white/5 ${RANK_TITLES[rank].color}`}>
                        ✨ {RANK_TITLES[rank].label}
                    </div>
                ) : (
                    <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest">
                        {u.followerCount || 0} followers
                    </div>
                )}
            </div>

            {currentUser ? (
                <button
                    onClick={() => handleFollowToggle(u)}
                    disabled={isBtnLoading}
                    className={`w-full py-3.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2
                               ${state === 'following'
                            ? 'border border-[#2a2a35] bg-transparent text-[#7a7a90] hover:border-[#ff5c5c] hover:text-[#ff5c5c] hover:bg-[#ff5c5c]/5'
                            : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e] shadow-[0_8px_20px_rgba(200,255,87,0.15)]'}
                               disabled:opacity-50`}
                >
                    {isBtnLoading ? (
                        <span className="animate-pulse">Processing...</span>
                    ) : state === 'following' ? (
                        'Unfollow'
                    ) : (
                        <><UserPlus size={14} /> Follow</>
                    )}
                </button>
            ) : (
                <Link to="/login" className="w-full">
                    <button className="w-full py-3.5 text-xs font-bold rounded-lg bg-[#c8ff57] text-black shadow-lg">
                        Follow
                    </button>
                </Link>
            )}
        </div>
    )
}

export default Search