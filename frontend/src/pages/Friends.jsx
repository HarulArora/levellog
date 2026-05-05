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

function Friends() {
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
        navigate(`/friends?${params.toString()}`, { replace: true })
    }, [debouncedQuery, navigate])

    const trimmed = debouncedQuery.trim()
    const isSearchable = trimmed.length >= 2

    const { data: userData, loading } = useCachedFetch(
        isSearchable ? `user_search_${trimmed.toLowerCase()}` : null,
        isSearchable ? `/auth/search?q=${encodeURIComponent(trimmed)}` : null,
        { enabled: isSearchable, ttl: 5 * 60 * 1000 }
    )

    const { data: suggestionsData, loading: suggestionsLoading } = useCachedFetch(
        !isSearchable && currentUser ? 'user_suggestions' : null,
        !isSearchable && currentUser ? '/auth/suggestions' : null,
        { enabled: !isSearchable && !!currentUser, ttl: 10 * 60 * 1000 }
    )

    const results = (userData?.users || []).filter(u => u.username !== currentUser?.username)
    const suggestions = suggestionsData?.users || []

    return (
        <div className="w-full max-w-[1200px] mx-auto px-5 md:px-10 py-8 md:py-10 min-h-[70vh]">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-[#2a2a35] pb-8">
                <div>
                    <h2 className="font-black text-4xl md:text-5xl tracking-widest uppercase text-white mb-2"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        Friends <span className="text-[#c8ff57]">& Discovery</span>
                    </h2>
                    <p className="text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest">
                        Connect with other players to follow their odyssey
                    </p>
                </div>

                <div className="relative w-full md:w-96">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none z-10">
                        <SearchIcon size={20} strokeWidth={2.5} />
                    </span>
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search for players..."
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

            {/* Content */}
            <div className="space-y-16">
                {/* People You May Know Section — Prominent at the top */}
                {!isSearchable && currentUser && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#c8ff57]/10 rounded-xl flex items-center justify-center text-[#c8ff57] shadow-inner shadow-[#c8ff57]/5">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-wider leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                        People You May Know
                                    </h3>
                                    <p className="text-[#7a7a90] font-mono text-[9px] uppercase tracking-[0.2em] mt-1">Discover players in the multiverse</p>
                                </div>
                            </div>
                        </div>

                        {suggestionsLoading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="bg-[#111118] border border-[#2a2a35] rounded-xl p-6 flex flex-col items-center">
                                        <Skeleton variant="block" width="80px" height="80px" className="rounded-full mb-4" />
                                        <Skeleton variant="line" width="60%" height="16px" className="mb-2" />
                                        <Skeleton variant="line" width="40%" height="12px" className="mb-6" />
                                        <Skeleton variant="block" width="100%" height="40px" className="rounded-lg" />
                                    </div>
                                ))}
                            </div>
                        ) : suggestions.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {suggestions.map(item => (
                                    <UserResultCard 
                                        key={item._id} 
                                        u={item} 
                                        getFollowStatus={getFollowStatus} 
                                        handleFollowToggle={handleFollowToggle} 
                                        loadingMap={loadingMap} 
                                        topUsers={topUsers} 
                                        currentUser={currentUser} 
                                        isSuggestion={true}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-[#111118]/30 border border-[#2a2a35] border-dashed rounded-3xl">
                                <p className="text-[#7a7a90] font-mono text-[10px] uppercase tracking-[0.2em] leading-relaxed max-w-sm mx-auto">
                                    No suggestions right now. Follow more people to discover new friends!
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Search Results Section */}
                {isSearchable && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-[#c8ff57]/10 rounded-xl flex items-center justify-center text-[#c8ff57]">
                                <SearchIcon size={20} />
                            </div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Search Results <span className="text-[#7a7a90] ml-2 text-sm font-mono tracking-widest">"{trimmed}"</span>
                            </h3>
                        </div>

                        {loading ? (
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
                            <div className="text-center py-24 bg-[#111118] border border-[#2a2a35] border-dashed rounded-[2rem]">
                                <div className="text-6xl mb-6 grayscale opacity-50">🛸</div>
                                <h3 className="text-white font-bold text-2xl mb-2">Player not found</h3>
                                <p className="text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest">
                                    We couldn't find any players matching "{trimmed}"
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                )}

                {/* Empty State when not searching and no suggestions */}
                {!isSearchable && !currentUser && (
                    <div className="flex flex-col items-center justify-center py-24 gap-6 bg-[#111118]/30 border border-[#2a2a35] border-dashed rounded-[3rem]">
                        <div className="w-24 h-24 bg-[#1a1a25] border border-[#2a2a35] rounded-3xl flex items-center justify-center text-[#2a2a35] rotate-3">
                            <Users size={40} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-white font-black text-3xl uppercase tracking-widest mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Search the Multiverse</h3>
                            <p className="text-[#7a7a90] font-mono text-[10px] uppercase tracking-[0.2em]">
                                Enter at least 2 characters to find players
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function UserResultCard({ u, getFollowStatus, handleFollowToggle, loadingMap, topUsers, currentUser, isSuggestion = false }) {
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
                {u.followsMe ? (
                    <span className="font-mono text-[8px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-sm bg-[#c8ff57]/10 text-[#c8ff57] border border-[#c8ff57]/20 mt-1.5">
                        Follows you
                    </span>
                ) : isSuggestion && u.mutualCount > 0 ? (
                    <span className="font-mono text-[8px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-sm bg-[#5c9fff]/10 text-[#5c9fff] border border-[#5c9fff]/20 mt-1.5">
                        {u.mutualCount} {u.mutualCount === 1 ? 'Mutual Friend' : 'Mutual Friends'}
                    </span>
                ) : null}
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
                            : state === 'requested'
                            ? 'border border-[#c8ff57]/20 bg-[#c8ff57]/5 text-[#c8ff57] hover:bg-[#c8ff57]/10'
                            : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e] shadow-[0_8px_20px_rgba(200,255,87,0.15)]'}
                               disabled:opacity-50`}
                >
                    {isBtnLoading ? (
                        <span className="animate-pulse">Processing...</span>
                    ) : state === 'following' ? (
                        'Unfollow'
                    ) : state === 'requested' ? (
                        'Cancel Request'
                    ) : u.isPrivate ? (
                        <><UserPlus size={14} /> Request</>
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

export default Friends