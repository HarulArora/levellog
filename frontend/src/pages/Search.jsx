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

    const searchUsers = useCallback(async (q) => {
        if (q.trim().length < 2) {
            setResults([])
            return
        }
        setLoading(true)
        try {
            const res = await api.get(`/auth/search?q=${q.trim()}`)
            const users = res.data.users
            const filtered = users.filter(
                u => u.username !== currentUser?.username
            )
            setResults(filtered)

            if (currentUser) {
                const states = {}
                filtered.forEach(u => {
                    const currentId = (currentUser.id || currentUser._id || '').toString()
                    const isFollowing = u.followers?.some(
                        id => id.toString() === currentId
                    )
                    states[u._id] = isFollowing ? 'following' : 'none'
                })
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

    const handleFollow = async (targetUser) => {
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
                <h2
                    className="font-black text-2xl md:text-3xl tracking-widest uppercase text-white"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                    Find Friends
                </h2>
            </div>

            {/* Search bar */}
            <div className="relative mb-6">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a7a90]">
                    🔍
                </span>
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search by username..."
                    className="w-full bg-[#111118] border border-[#2a2a35] rounded-lg
                     pl-9 pr-4 py-3 text-white text-sm font-mono
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
                            <div
                                key={u._id}
                                className="bg-[#111118] border border-[#2a2a35] rounded-lg
                           p-4 flex items-center gap-4
                           hover:border-[#c8ff57]/30 transition-all"
                            >
                                {/* Avatar */}
                                <Link to={`/user/${u.username}`}>
                                    <div
                                        className="w-12 h-12 rounded-full bg-gradient-to-br
                                from-[#c8ff57] to-[#5c9fff]
                                flex items-center justify-center
                                font-black text-lg text-black flex-shrink-0
                                hover:opacity-80 transition-opacity"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                    >
                                        {u.username.charAt(0).toUpperCase()}
                                    </div>
                                </Link>

                                {/* Info */}
                               
                                <div className="flex-1 min-w-0">
                                    <Link to={`/user/${u.username}`}>
                                        <div className="text-white font-bold text-sm
                    hover:text-[#c8ff57] transition-colors">
                                            {u.username}
                                        </div>
                                    </Link>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs">{u.badge || '🎮'}</span>
                                        <span className="font-mono text-[9px] text-[#c8ff57] uppercase tracking-wider">
                                            Lv.{u.level || 1}
                                        </span>
                                        <span className="font-mono text-[9px] text-[#7a7a90]">·</span>
                                        <span className="font-mono text-[9px] text-[#7a7a90]">
                                            {u.followers?.length || 0} followers
                                        </span>
                                        {u.isPrivate && (
                                            <span className="font-mono text-[9px] text-[#ff5c5c]">
                                                🔒
                                            </span>
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
                                        {state === 'following'
                                            ? 'Unfollow'
                                            : state === 'requested'
                                                ? '⏳ Requested'
                                                : u.isPrivate ? '+ Request' : '+ Follow'
                                        }
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

            {/* Empty state */}
            {query.trim().length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="text-5xl">🎮</div>
                    <div
                        className="text-white font-black text-xl tracking-widest uppercase"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                        Find Your Friends
                    </div>
                    <div className="text-[#7a7a90] font-mono text-sm text-center max-w-sm">
                        Search for other gamers by their username and follow them
                        to see their games in your activity feed
                    </div>
                </div>
            )}

        </div>
    )
}

export default Search