import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Search as SearchIcon } from 'lucide-react'
import useCachedFetch from '../hooks/useCachedFetch'
import { useFollow } from '../context/FollowContext'

function Search() {
    const { user: currentUser } = useAuth()
    const navigate = useNavigate()
    const [query, setQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const { getFollowStatus, handleFollowToggle, loadingMap } = useFollow()

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query)
        }, 300)
        return () => clearTimeout(timer)
    }, [query])

    // ── CACHED FETCHES ──
    const { data: suggestionsData, loading: loadingSuggestions, refetch: refetchSuggestions } = useCachedFetch(
        currentUser ? 'friend_suggestions' : null,
        '/auth/suggestions',
        { enabled: !!currentUser, ttl: 10 * 60 * 1000 }
    )

    const [localSuggestions, setLocalSuggestions] = useState([])

    useEffect(() => {
        if (suggestionsData?.users) {
            setLocalSuggestions(suggestionsData.users)
        }
    }, [suggestionsData])

    // If we've followed everyone on the local list, get more!
    useEffect(() => {
        if (currentUser && localSuggestions.length === 0 && !loadingSuggestions) {
            refetchSuggestions()
        }
    }, [localSuggestions, loadingSuggestions, currentUser, refetchSuggestions])

    const trimmed = debouncedQuery.trim()
    const searchKey = trimmed.length >= 2 ? `user_search_${trimmed.toLowerCase()}` : null
    const { data: searchData, loading: loadingSearch } = useCachedFetch(
        searchKey,
        searchKey ? `/auth/search?q=${encodeURIComponent(trimmed)}` : null,
        { enabled: !!searchKey, ttl: 5 * 60 * 1000 }
    )

    const suggestions = localSuggestions
    const results     = (searchData?.users || []).filter(u => u.username !== currentUser?.username)

    // 🚀 Improved Loading Logic: show indicator immediately when typing
    const isWaitingForDebounce = query.trim().length >= 2 && query.trim() !== debouncedQuery.trim()
    const isAwaitingResults = trimmed.length >= 2 && searchData?.query !== trimmed
    const loading = loadingSearch || isWaitingForDebounce || isAwaitingResults

    return (
        <div className="max-w-[800px] mx-auto px-5 md:px-10 py-8 md:py-10">

            {/* Header */}
            <div className="flex items-baseline gap-4 mb-6 pb-4 border-b border-[#2a2a35]">
                <h2 className="font-black text-2xl md:text-3xl tracking-widest uppercase text-white"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    Find Friends
                </h2>
            </div>

            {/* Search bar */}
            <div className="relative mb-6">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a7a90] pointer-events-none">
                    <SearchIcon size={16} strokeWidth={2.5} />
                </span>
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search by username..."
                    className="w-full bg-[#111118] border border-[#2a2a35] rounded-lg
                               pl-10 pr-24 py-3 text-white text-sm font-mono
                               focus:outline-none focus:border-[#c8ff57]
                               transition-colors placeholder:text-[#7a7a90]"
                />
                {loading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#c8ff57] font-mono text-[9px] uppercase tracking-widest animate-pulse">
                        Searching...
                    </span>
                )}
            </div>

            {/* Too short */}
            {query.trim().length > 0 && query.trim().length < 2 && (
                <div className="text-center text-[#7a7a90] font-mono text-sm py-8">
                    Type at least 2 characters to search
                </div>
            )}

            {/* No results */}
            {query.trim().length >= 2 && !loading && results.length === 0 && (
                <div className="text-center py-16">
                    <div className="text-4xl mb-3">😕</div>
                    <div className="text-[#7a7a90] font-mono text-sm">
                        No users found for "{query}"
                    </div>
                </div>
            )}

            {/* Results */}
            {results.length > 0 && (
                <div className="flex flex-col gap-3">
                    {results.map(u => {
                        const state = getFollowStatus(u)
                        const isBtnLoading = loadingMap[u._id] || false
                        return (
                            <div key={u._id}
                                className="bg-[#111118] border border-[#2a2a35] rounded-lg p-4
                                           flex items-center gap-3 hover:border-[#c8ff57]/30 transition-all">

                                {/* Avatar */}
                                <Link to={`/user/${u.username}`} className="flex-shrink-0">
                                    {u.avatar ? (
                                        <img src={u.avatar} alt={u.username}
                                            className="w-10 h-10 rounded-full object-cover ring-2 ring-[#2a2a35] hover:opacity-80 transition-opacity" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c8ff57] to-[#5c9fff]
                                                        flex items-center justify-center font-black text-base text-black
                                                        hover:opacity-80 transition-opacity"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {u.username.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </Link>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <Link to={`/user/${u.username}`}>
                                        <div className="text-white font-bold text-sm hover:text-[#c8ff57] transition-colors truncate flex items-center gap-1.5">
                                            {u.username}
                                            {u.followsMe && (
                                                <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-[1px] rounded-[2px]
                                                                 bg-[#7a7a90]/15 text-[#7a7a90] border border-[#7a7a90]/20 scale-90 origin-left">
                                                    Follows you
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <div className="flex items-center gap-1.5 bg-[#111118] rounded-full px-2 py-0.5 border border-[#2a2a35] shadow-sm shadow-black/40">
                                            <span className="flex items-center justify-center text-[10px] leading-none relative -top-[1.8px]">{u.badge || '🎮'}</span>
                                            <span className="font-mono text-[9px] text-[#c8ff57] uppercase font-black tracking-widest leading-none">Lv.{u.level || 1}</span>
                                        </div>
                                        <span className="font-mono text-[9px] text-[#7a7a90] opacity-50">·</span>
                                        <span className="font-mono text-[9px] text-[#7a7a90] font-bold">
                                            {u.followerCount || 0} followers
                                        </span>
                                        {u.isPrivate && (
                                            <span className="font-mono text-[9px] text-[#ff5c5c] font-black uppercase tracking-widest ml-1">Private 🔒</span>
                                        )}
                                    </div>
                                    {u.bio && (
                                        <div className="text-[#7a7a90] text-xs mt-1 truncate">{u.bio}</div>
                                    )}
                                </div>

                                {/* Follow button */}
                                {currentUser ? (
                                    <button
                                        onClick={() => handleFollowToggle(u)}
                                        disabled={isBtnLoading}
                                        className={`px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex-shrink-0
                                                   ${state === 'following'
                                                ? 'border border-[#2a2a35] text-[#7a7a90] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'
                                                : state === 'requested'
                                                    ? 'border border-[#ff9f5c]/50 text-[#ff9f5c] hover:bg-[#ff9f5c]/10'
                                                    : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e] hover:shadow-[0_4px_12px_rgba(200,255,87,0.2)]'}
                                                   disabled:opacity-50`}
                                    >
                                        {isBtnLoading ? '...' : 
                                         state === 'following' ? 'Unfollow' : 
                                         state === 'requested' ? 'Cancel Req.' : 
                                         u.isPrivate ? '+ Request' : '+ Follow'}
                                    </button>
                                ) : (
                                    <Link to="/login">
                                        <button className="px-6 py-2.5 text-xs font-bold rounded-lg bg-[#c8ff57] text-black hover:bg-[#d4ff6e] transition-all flex-shrink-0">
                                            Follow
                                        </button>
                                    </Link>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* People You May Know / Empty state */}
            {query.trim().length === 0 && (
                <>
                    {currentUser && suggestions.length > 0 ? (
                        <div className="mt-8 mb-12">
                            <h3 className="font-black text-xl tracking-widest uppercase text-white mb-6 flex items-center gap-2"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                People You May Know
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {suggestions.map(u => {
                                    const state = getFollowStatus(u)
                                    const isBtnLoading = loadingMap[u._id] || false
                                    return (
                                        <div key={u._id} className="bg-[#111118] border border-[#2a2a35] rounded-xl p-5 flex flex-col items-center text-center hover:border-[#c8ff57]/30 transition-all shadow-lg group">
                                            <Link to={`/user/${u.username}`} className="mb-4 relative">
                                                {u.avatar ? (
                                                    <img src={u.avatar} alt={u.username} className="w-20 h-20 rounded-full object-cover ring-4 ring-[#18181f] group-hover:ring-[#c8ff57]/20 transition-all duration-300" />
                                                ) : (
                                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#c8ff57] to-[#5c9fff] flex items-center justify-center font-black text-3xl text-black ring-4 ring-[#18181f] group-hover:ring-[#c8ff57]/20 transition-all duration-300 shadow-xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                        {u.username.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="absolute -bottom-1 -right-1 bg-[#18181f] rounded-full p-[2px]">
                                                    <div className="bg-[#2a2a35] rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                                                        <span className="text-[10px] leading-none">{u.badge || '🎮'}</span>
                                                    </div>
                                                </div>
                                            </Link>
                                            
                                            <Link to={`/user/${u.username}`} className="text-white font-bold text-sm hover:text-[#c8ff57] transition-colors truncate w-full mb-1">
                                                {u.username}
                                            </Link>

                                            {/* Subtitle / Context */}
                                            <div className="h-6 flex items-center justify-center w-full mb-4">
                                                {u.mutualCount > 0 ? (
                                                    <div className="font-mono text-[10px] text-[#5c9fff] bg-[#5c9fff]/10 px-2 py-0.5 rounded-sm truncate w-auto inline-block">
                                                        {u.mutualCount} mutual match{u.mutualCount !== 1 ? 'es' : ''}
                                                    </div>
                                                ) : u.followsMe ? (
                                                    <div className="font-mono text-[10px] text-[#7a7a90] bg-[#7a7a90]/15 border border-[#7a7a90]/30 px-2 py-0.5 rounded-sm truncate select-none inline-block">
                                                        Follows you
                                                    </div>
                                                ) : (
                                                    <div className="font-mono text-[10px] text-[#7a7a90] truncate inline-block">
                                                        Popular on QuestDuck
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                onClick={async () => {
                                                    await handleFollowToggle(u)
                                                    // Immediately remove from local suggestions
                                                    setLocalSuggestions(prev => prev.filter(item => item._id !== u._id))
                                                }}
                                                disabled={isBtnLoading}
                                                className={`w-full py-3 text-xs font-bold rounded-lg transition-all mt-auto
                                                           ${state === 'following'
                                                                ? 'border border-[#2a2a35] bg-transparent text-[#7a7a90] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'
                                                                 : state === 'requested'
                                                                     ? 'border border-[#ff9f5c]/50 bg-transparent text-[#ff9f5c] hover:bg-[#ff9f5c]/10'
                                                                     : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e] hover:shadow-[0_0_15px_rgba(200,255,87,0.3)]'}
                                                             disabled:opacity-50`}
                                            >
                                                {isBtnLoading ? '...' : 
                                                 state === 'following' ? 'Unfollow' : 
                                                 state === 'requested' ? 'Cancel Req.' : 
                                                 u.isPrivate ? 'Request' : 'Follow'}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        loadingSuggestions ? (
                            <div className="py-20 text-center text-[#7a7a90] font-mono text-sm animate-pulse">
                                Finding players...
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="text-5xl">🎮</div>
                                <div className="text-white font-black text-xl tracking-widest uppercase"
                                     style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    Find Playmates
                                </div>
                                <p className="text-[#7a7a90] font-mono text-xs text-center max-w-xs">
                                    Search for other gamers to build your community and see their odyssey.
                                </p>
                            </div>
                        )
                    )}
                </>
            )}

        </div>
    )
}

export default Search