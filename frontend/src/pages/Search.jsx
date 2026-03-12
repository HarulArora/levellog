import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

function Search() {
    const { user: currentUser } = useAuth()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [followStates, setFollowStates] = useState({})
    const [suggestions, setSuggestions] = useState([])
    const [suggestionsLoading, setSuggestionsLoading] = useState(true)

    // ─── Suggestion logic ────────────────────────────────────────────────────
    // Strategy (mirrors Instagram):
    //  1. Fetch the full user list from the server (or a dedicated suggestions endpoint)
    //  2. For each candidate, count how many of their followers also follow currentUser
    //     OR are followed by currentUser  → "mutuals"
    //  3. Filter out: yourself, already-following, already-requested
    //  4. Sort by mutual count desc, then follower count desc as tiebreaker
    //  5. Take top N
    // ─────────────────────────────────────────────────────────────────────────
    const fetchSuggestions = useCallback(async () => {
        if (!currentUser) { setSuggestionsLoading(false); return }
        setSuggestionsLoading(true)
        try {
            // Try a dedicated endpoint first; fall back to a broad search
            // Your backend should expose GET /auth/suggestions OR GET /auth/search?q=
            // We'll use the suggestions endpoint if available, else search with empty/common query
            let users = []
            try {
                const res = await api.get('/auth/suggestions')
                users = res.data.users || res.data || []
            } catch {
                // fallback: broad search — tweak the query to whatever returns many users
                const res = await api.get('/auth/search?q=')
                users = res.data.users || []
            }

            const currentId = (currentUser.id || currentUser._id || '').toString()
            // IDs that currentUser already follows
            const followingSet = new Set(
                (currentUser.following || []).map(id => id.toString())
            )
            // IDs currentUser has requested
            const requestedSet = new Set(
                (currentUser.followRequests || []).map(id => id.toString())
            )

            const candidates = users.filter(u => {
                const uid = u._id.toString()
                return uid !== currentId && !followingSet.has(uid) && !requestedSet.has(uid)
            })

            // Count mutuals: followers of candidate that are also in currentUser.following
            const scored = candidates.map(u => {
                const candidateFollowers = (u.followers || []).map(id => id.toString())
                const mutualCount = candidateFollowers.filter(id => followingSet.has(id)).length
                // Also include mutual followings (people candidate follows who also follow you)
                const candidateFollowing = (u.following || []).map(id => id.toString())
                const mutualFollowingCount = candidateFollowing.filter(id =>
                    (currentUser.followers || []).map(i => i.toString()).includes(id)
                ).length
                const totalMutuals = mutualCount + mutualFollowingCount

                // Gather mutual usernames for display (top 2)
                const mutualUserObjs = users.filter(uu => {
                    const uid = uu._id.toString()
                    return candidateFollowers.includes(uid) && followingSet.has(uid)
                }).slice(0, 2)

                return {
                    ...u,
                    _mutualCount: totalMutuals,
                    _mutualUsers: mutualUserObjs,
                    _followerCount: (u.followers || []).length,
                }
            })

            scored.sort((a, b) => {
                if (b._mutualCount !== a._mutualCount) return b._mutualCount - a._mutualCount
                return b._followerCount - a._followerCount
            })

            const top = scored.slice(0, 8)

            // Initialise follow states
            const states = {}
            top.forEach(u => { states[u._id] = 'none' })
            setFollowStates(prev => ({ ...prev, ...states }))
            setSuggestions(top)
        } catch (err) {
            console.error('Suggestions error:', err)
        } finally {
            setSuggestionsLoading(false)
        }
    }, [currentUser])

    useEffect(() => { fetchSuggestions() }, [fetchSuggestions])

    // ─── Search ───────────────────────────────────────────────────────────────
    const searchUsers = useCallback(async (q) => {
        if (q.trim().length < 2) { setResults([]); return }
        setLoading(true)
        try {
            const res = await api.get(`/auth/search?q=${q.trim()}`)
            const users = res.data.users
            const filtered = users.filter(u => u.username !== currentUser?.username)
            setResults(filtered)

            if (currentUser) {
                const states = {}
                filtered.forEach(u => {
                    const currentId = (currentUser.id || currentUser._id || '').toString()
                    const isFollowing = u.followers?.some(id => id.toString() === currentId)
                    states[u._id] = isFollowing ? 'following' : 'none'
                })
                setFollowStates(prev => ({ ...prev, ...states }))
            }
        } catch (err) {
            console.error('Search error:', err)
        } finally {
            setLoading(false)
        }
    }, [currentUser])

    useEffect(() => {
        const timer = setTimeout(() => { searchUsers(query) }, 400)
        return () => clearTimeout(timer)
    }, [query, searchUsers])

    // ─── Follow / Unfollow ────────────────────────────────────────────────────
    const handleFollow = async (targetUser, fromSuggestions = false) => {
        if (!currentUser) return
        const prevState = followStates[targetUser._id]
        try {
            if (prevState === 'following') {
                await api.post(`/auth/unfollow/${targetUser._id}`)
                setFollowStates(prev => ({ ...prev, [targetUser._id]: 'none' }))
            } else if (prevState === 'none') {
                const res = await api.post(`/auth/follow/${targetUser._id}`)
                if (res.data.type === 'request_sent') {
                    setFollowStates(prev => ({ ...prev, [targetUser._id]: 'requested' }))
                } else {
                    setFollowStates(prev => ({ ...prev, [targetUser._id]: 'following' }))
                    // Remove from suggestions after following
                    if (fromSuggestions) {
                        setSuggestions(prev => prev.filter(u => u._id !== targetUser._id))
                    }
                }
            }
        } catch (err) {
            console.error('Follow error:', err)
        }
    }

    const dismissSuggestion = (userId) => {
        setSuggestions(prev => prev.filter(u => u._id !== userId))
    }

    // ─── Reusable follow button ───────────────────────────────────────────────
    const FollowButton = ({ user, fromSuggestions = false, compact = false }) => {
        const state = followStates[user._id] || 'none'
        return currentUser ? (
            <button
                onClick={() => handleFollow(user, fromSuggestions)}
                disabled={state === 'requested'}
                className={`font-bold rounded transition-all flex-shrink-0 disabled:opacity-70
                    ${compact ? 'px-3 py-1.5 text-[10px]' : 'px-4 py-2 text-xs'}
                    ${state === 'following'
                        ? 'border border-[#2a2a35] text-[#7a7a90] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'
                        : state === 'requested'
                            ? 'border border-[#ff9f5c]/50 text-[#ff9f5c] cursor-not-allowed'
                            : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e]'
                    }`}
            >
                {state === 'following' ? 'Unfollow'
                    : state === 'requested' ? '⏳ Requested'
                        : user.isPrivate ? '+ Request' : '+ Follow'}
            </button>
        ) : (
            <Link to="/login">
                <button className={`font-bold rounded bg-[#c8ff57] text-black hover:bg-[#d4ff6e]
                    transition-all flex-shrink-0
                    ${compact ? 'px-3 py-1.5 text-[10px]' : 'px-4 py-2 text-xs'}`}>
                    Follow
                </button>
            </Link>
        )
    }

    // ─── Avatar helper ────────────────────────────────────────────────────────
    const Avatar = ({ user, size = 'md' }) => {
        const sizeClass = size === 'sm' ? 'w-6 h-6 text-[9px]'
            : size === 'lg' ? 'w-14 h-14 text-lg'
                : 'w-10 h-10 text-base'
        return user.avatar ? (
            <img src={user.avatar} alt={user.username}
                className={`${sizeClass} rounded-full object-cover ring-2 ring-[#2a2a35]`} />
        ) : (
            <div className={`${sizeClass} rounded-full bg-gradient-to-br from-[#c8ff57] to-[#5c9fff]
                flex items-center justify-center font-black text-black`}
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {user.username.charAt(0).toUpperCase()}
            </div>
        )
    }

    const showSuggestions = query.trim().length === 0

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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a7a90] text-sm pointer-events-none">
                    🔍
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
                    <span className="absolute right-3 top-1/2 -translate-y-1/2
                                     text-[#7a7a90] font-mono text-xs">
                        searching...
                    </span>
                )}
            </div>

            {/* ── SUGGESTED PROFILES (shown when search is empty) ── */}
            {showSuggestions && (
                <>
                    {suggestionsLoading ? (
                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="font-black text-sm tracking-widest uppercase text-[#7a7a90]"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    Suggested For You
                                </span>
                            </div>
                            {/* Skeleton cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="bg-[#111118] border border-[#2a2a35] rounded-xl p-4 animate-pulse">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-12 h-12 rounded-full bg-[#2a2a35]" />
                                            <div className="flex-1">
                                                <div className="h-3 bg-[#2a2a35] rounded w-24 mb-2" />
                                                <div className="h-2 bg-[#2a2a35] rounded w-16" />
                                            </div>
                                        </div>
                                        <div className="h-2 bg-[#2a2a35] rounded w-full mb-2" />
                                        <div className="h-7 bg-[#2a2a35] rounded w-full mt-3" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : suggestions.length > 0 ? (
                        <div className="mb-8">
                            {/* Section header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-[#c8ff57] rounded-sm inline-block" />
                                    <span className="font-black text-sm tracking-widest uppercase text-white"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                        Suggested For You
                                    </span>
                                </div>
                                <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">
                                    {/* Based on people you know */}
                                </span>
                            </div>

                            {/* Suggestion cards grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {suggestions.map(u => {
                                    const state = followStates[u._id] || 'none'
                                    return (
                                        <div key={u._id}
                                            className="bg-[#111118] border border-[#2a2a35] rounded-xl p-4
                                                       hover:border-[#c8ff57]/30 transition-all group relative">

                                            {/* Dismiss button */}
                                            <button
                                                onClick={() => dismissSuggestion(u._id)}
                                                className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center
                                                           text-[#7a7a90] hover:text-white transition-colors
                                                           opacity-0 group-hover:opacity-100 text-xs"
                                                title="Dismiss"
                                            >
                                                ✕
                                            </button>

                                            {/* Top row: avatar + info */}
                                            <div className="flex items-start gap-3 mb-3">
                                                <Link to={`/user/${u.username}`} className="flex-shrink-0">
                                                    <div className="relative">
                                                        {u.avatar ? (
                                                            <img src={u.avatar} alt={u.username}
                                                                className="w-12 h-12 rounded-full object-cover
                                                                           ring-2 ring-[#2a2a35] group-hover:ring-[#c8ff57]/30
                                                                           transition-all" />
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br
                                                                           from-[#c8ff57] to-[#5c9fff]
                                                                           flex items-center justify-center
                                                                           font-black text-lg text-black
                                                                           ring-2 ring-[#2a2a35] group-hover:ring-[#c8ff57]/30
                                                                           transition-all"
                                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                                {u.username.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        {/* Online-style accent dot */}
                                                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5
                                                                        bg-[#111118] rounded-full flex items-center justify-center">
                                                            <div className="w-2 h-2 rounded-full bg-[#c8ff57]" />
                                                        </div>
                                                    </div>
                                                </Link>

                                                <div className="flex-1 min-w-0 pr-6">
                                                    <Link to={`/user/${u.username}`}>
                                                        <div className="text-white font-bold text-sm
                                                                        hover:text-[#c8ff57] transition-colors truncate">
                                                            {u.username}
                                                        </div>
                                                    </Link>
                                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                        <span className="text-xs">{u.badge || '🎮'}</span>
                                                        <span className="font-mono text-[9px] text-[#c8ff57] uppercase tracking-wider">
                                                            Lv.{u.level || 1}
                                                        </span>
                                                        {u.isPrivate && (
                                                            <span className="font-mono text-[9px] text-[#ff5c5c]">🔒</span>
                                                        )}
                                                    </div>
                                                    {u.bio && (
                                                        <div className="text-[#7a7a90] text-[11px] mt-1 truncate">
                                                            {u.bio}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Mutuals row */}
                                            {u._mutualCount > 0 && u._mutualUsers?.length > 0 ? (
                                                <div className="flex items-center gap-2 mb-3
                                                                bg-[#1a1a24] rounded-lg px-3 py-2">
                                                    {/* Stacked avatars */}
                                                    <div className="flex -space-x-1.5 flex-shrink-0">
                                                        {u._mutualUsers.map(mu => (
                                                            <div key={mu._id}
                                                                className="w-5 h-5 rounded-full ring-1 ring-[#111118] overflow-hidden">
                                                                {mu.avatar ? (
                                                                    <img src={mu.avatar} alt={mu.username}
                                                                        className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full bg-gradient-to-br
                                                                                   from-[#c8ff57] to-[#5c9fff]
                                                                                   flex items-center justify-center
                                                                                   font-black text-[7px] text-black">
                                                                        {mu.username.charAt(0).toUpperCase()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <span className="font-mono text-[10px] text-[#7a7a90] leading-tight">
                                                        Followed by{' '}
                                                        <span className="text-white font-semibold">
                                                            {u._mutualUsers[0]?.username}
                                                        </span>
                                                        {u._mutualCount > 1 && (
                                                            <> + <span className="text-white font-semibold">
                                                                {u._mutualCount - 1} mutual{u._mutualCount - 1 > 1 ? 's' : ''}
                                                            </span></>
                                                        )}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 mb-3
                                                                bg-[#1a1a24] rounded-lg px-3 py-2">
                                                    <span className="font-mono text-[10px] text-[#7a7a90]">
                                                        🌟 <span className="text-white">{u._followerCount}</span> followers
                                                        {u.isPrivate ? ' · Private account' : ' · Popular gamer'}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Follow button full width */}
                                            <button
                                                onClick={() => handleFollow(u, true)}
                                                disabled={state === 'requested'}
                                                className={`w-full py-2 text-xs font-bold rounded transition-all disabled:opacity-70
                                                    ${state === 'following'
                                                        ? 'border border-[#2a2a35] text-[#7a7a90] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'
                                                        : state === 'requested'
                                                            ? 'border border-[#ff9f5c]/50 text-[#ff9f5c] cursor-not-allowed'
                                                            : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e]'
                                                    }`}
                                            >
                                                {state === 'following' ? 'Unfollow'
                                                    : state === 'requested' ? '⏳ Requested'
                                                        : u.isPrivate ? '+ Send Request' : '+ Follow'}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        /* Empty state — no suggestions */
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
                    )}

                    {/* Search prompt below suggestions */}
                    {suggestions.length > 0 && (
                        <div className="text-center text-[#7a7a90] font-mono text-xs py-2 mb-4">
                            or search by username above
                        </div>
                    )}
                </>
            )}

            {/* ── SEARCH RESULTS ── */}
            {!showSuggestions && (
                <>
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
                                        className="bg-[#111118] border border-[#2a2a35] rounded-lg
                                                   p-4 flex items-center gap-3
                                                   hover:border-[#c8ff57]/30 transition-all">
                                        {/* Avatar */}
                                        <Link to={`/user/${u.username}`} className="flex-shrink-0">
                                            {u.avatar ? (
                                                <img src={u.avatar} alt={u.username}
                                                    className="w-10 h-10 rounded-full object-cover
                                                               ring-2 ring-[#2a2a35] hover:opacity-80 transition-opacity" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br
                                                               from-[#c8ff57] to-[#5c9fff]
                                                               flex items-center justify-center
                                                               font-black text-base text-black
                                                               hover:opacity-80 transition-opacity"
                                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                    {u.username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </Link>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <Link to={`/user/${u.username}`}>
                                                <div className="text-white font-bold text-sm
                                                                hover:text-[#c8ff57] transition-colors truncate">
                                                    {u.username}
                                                </div>
                                            </Link>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                <span className="text-xs">{u.badge || '🎮'}</span>
                                                <span className="font-mono text-[9px] text-[#c8ff57] uppercase tracking-wider">
                                                    Lv.{u.level || 1}
                                                </span>
                                                <span className="font-mono text-[9px] text-[#7a7a90]">·</span>
                                                <span className="font-mono text-[9px] text-[#7a7a90]">
                                                    {u.followers?.length || 0} followers
                                                </span>
                                                {u.isPrivate && (
                                                    <span className="font-mono text-[9px] text-[#ff5c5c]">🔒</span>
                                                )}
                                            </div>
                                            {u.bio && (
                                                <div className="text-[#7a7a90] text-xs mt-1 truncate">
                                                    {u.bio}
                                                </div>
                                            )}
                                        </div>

                                        {/* Follow button */}
                                        {currentUser ? (
                                            <button
                                                onClick={() => handleFollow(u)}
                                                disabled={state === 'requested'}
                                                className={`px-4 py-2 text-xs font-bold rounded
                                                           transition-all flex-shrink-0 disabled:opacity-70
                                                           ${state === 'following'
                                                        ? 'border border-[#2a2a35] text-[#7a7a90] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'
                                                        : state === 'requested'
                                                            ? 'border border-[#ff9f5c]/50 text-[#ff9f5c] cursor-not-allowed'
                                                            : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e]'
                                                    }`}
                                            >
                                                {state === 'following' ? 'Unfollow'
                                                    : state === 'requested' ? '⏳ Requested'
                                                        : u.isPrivate ? '+ Request' : '+ Follow'}
                                            </button>
                                        ) : (
                                            <Link to="/login">
                                                <button className="px-4 py-2 text-xs font-bold rounded
                                                                   bg-[#c8ff57] text-black hover:bg-[#d4ff6e]
                                                                   transition-all flex-shrink-0">
                                                    Follow
                                                </button>
                                            </Link>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default Search