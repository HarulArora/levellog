import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { Search as SearchIcon } from 'lucide-react'

function Search() {
    const { user: currentUser } = useAuth()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [followStates, setFollowStates] = useState({})
    const [suggestions, setSuggestions] = useState([])
    const [loadingSuggestions, setLoadingSuggestions] = useState(false)

    const searchUsers = useCallback(async (q) => {
        if (q.trim().length < 2) {
            setResults([])
            return
        }
        setLoading(true)
        try {
            const res = await api.get(`/auth/search?q=${q.trim()}`)
            const users = res.data.users
            const filtered = users.filter(u => u.username !== currentUser?.username)
            setResults(filtered)

            if (currentUser) {
                // ── check follow state per user via API ──────────────────
                const states = {}
                await Promise.all(
                    filtered.map(async (u) => {
                        try {
                            const profileRes = await api.get(`/auth/profile/${u.username}`)
                            const profileData = profileRes.data.user
                            if (profileData.isFollowedByMe) {
                                states[u._id] = 'following'
                            } else if (profileData.isRequestedByMe) {
                                states[u._id] = 'requested'
                            } else {
                                states[u._id] = 'none'
                            }
                        } catch {
                            states[u._id] = 'none'
                        }
                    })
                )
                setFollowStates(states)
            }
        } catch (err) {
            console.error('Search error:', err)
        } finally {
            setLoading(false)
        }
    }, [currentUser])

    useEffect(() => {
        const timer = setTimeout(() => {
            searchUsers(query)
        }, 400)
        return () => clearTimeout(timer)
    }, [query, searchUsers])

    useEffect(() => {
        if (!currentUser) return
        const fetchSuggestions = async () => {
            setLoadingSuggestions(true)
            try {
                const res = await api.get('/auth/suggestions')
                setSuggestions(res.data.users || [])
            } catch (err) {
                console.error('Failed to fetch suggestions:', err)
            } finally {
                setLoadingSuggestions(false)
            }
        }
        fetchSuggestions()
    }, [currentUser])

    const handleFollow = async (targetUser) => {
        if (!currentUser) return
        const prevState = followStates[targetUser._id]
        try {
            if (prevState === 'following') {
                await api.post(`/auth/unfollow/${targetUser._id}`)
                setFollowStates(prev => ({ ...prev, [targetUser._id]: 'none' }))
                setResults(prev => prev.map(u =>
                    u._id === targetUser._id
                        ? { ...u, followerCount: Math.max(0, (u.followerCount || 0) - 1) }
                        : u
                ))
            } else if (prevState === 'requested') {
                await api.delete(`/auth/follow-request/cancel/${targetUser._id}`)
                setFollowStates(prev => ({ ...prev, [targetUser._id]: 'none' }))
            } else if (prevState === 'none') {
                const res = await api.post(`/auth/follow/${targetUser._id}`)
                if (res.data.type === 'request_sent') {
                    setFollowStates(prev => ({ ...prev, [targetUser._id]: 'requested' }))
                } else {
                    setFollowStates(prev => ({ ...prev, [targetUser._id]: 'following' }))
                    setResults(prev => prev.map(u =>
                        u._id === targetUser._id
                            ? { ...u, followerCount: (u.followerCount || 0) + 1 }
                            : u
                    ))
                }
            }
        } catch (err) {
            console.error('Follow error:', err)
        }
    }

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
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7a90] font-mono text-xs">
                        searching...
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
                        const state = followStates[u._id] || 'none'
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
                                        onClick={() => handleFollow(u)}
                                        className={`px-4 py-2 text-xs font-bold rounded transition-all flex-shrink-0
                                                   ${state === 'following'
                                                ? 'border border-[#2a2a35] text-[#7a7a90] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'
                                                : state === 'requested'
                                                    ? 'border border-[#ff9f5c]/50 text-[#ff9f5c] cursor-not-allowed'
                                                    : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e]'}`}
                                    >
                                        {state === 'following'
                                            ? 'Unfollow'
                                            : state === 'requested'
                                                ? 'Cancel Req.'
                                                : u.isPrivate ? '+ Request' : '+ Follow'}
                                    </button>
                                ) : (
                                    <Link to="/login">
                                        <button className="px-4 py-2 text-xs font-bold rounded bg-[#c8ff57] text-black hover:bg-[#d4ff6e] transition-all flex-shrink-0">
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
                                    const state = followStates[u._id] || 'none'
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
                                                        Popular on LevelLog
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => handleFollow(u)}
                                                className={`w-full py-2.5 text-xs font-bold rounded-lg transition-all mt-auto
                                                           ${state === 'following'
                                                                ? 'border border-[#2a2a35] bg-transparent text-[#7a7a90] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'
                                                                : state === 'requested'
                                                                    ? 'border border-[#ff9f5c]/50 bg-transparent text-[#ff9f5c] cursor-not-allowed'
                                                                    : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e] hover:shadow-[0_0_15px_rgba(200,255,87,0.3)]'}`}
                                            >
                                                {state === 'following' ? 'Unfollow' : state === 'requested' ? 'Cancel Req.' : u.isPrivate ? 'Request' : 'Follow'}
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
                                    Find Your Friends
                                </div>
                                <div className="text-[#7a7a90] font-mono text-sm text-center max-w-sm">
                                    Search for other gamers by their username and follow them
                                    to see their games in your activity feed
                                </div>
                            </div>
                        )
                    )}
                </>
            )}
        </div>
    )
}

export default Search