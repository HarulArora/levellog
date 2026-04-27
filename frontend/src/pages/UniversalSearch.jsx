import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Search as SearchIcon, User as UserIcon, Gamepad2, Tv, Film, BookOpen, Star } from 'lucide-react'
import useCachedFetch from '../hooks/useCachedFetch'
import { useFollow } from '../context/FollowContext'
import AvatarFrame from '../components/ui/AvatarFrame'
import { useLeaderboard } from '../context/LeaderboardContext'
import Skeleton, { GameCardSkeleton } from '../components/ui/Skeleton'

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

const CATEGORIES = [
    { id: 'users', label: 'Players', icon: UserIcon },
    { id: 'games', label: 'Games', icon: Gamepad2 },
    { id: 'anime', label: 'Anime', icon: Tv },
    { id: 'manga', label: 'Manga', icon: BookOpen },
    { id: 'movie', label: 'Movies', icon: Film },
    { id: 'tv', label: 'TV Shows', icon: Tv },
]

function UniversalSearch() {
    const { user: currentUser } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const searchParams = new URLSearchParams(location.search)
    
    const initialQuery = searchParams.get('q') || ''
    const initialTab = searchParams.get('type') || 'users'

    const [query, setQuery] = useState(initialQuery)
    const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)
    const [activeTab, setActiveTab] = useState(initialTab)
    
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
        params.set('type', activeTab)
        navigate(`/universal-search?${params.toString()}`, { replace: true })
    }, [debouncedQuery, activeTab, navigate])

    // ── DATA FETCHING ──
    const trimmed = debouncedQuery.trim()
    const isSearchable = trimmed.length >= 2

    // 1. User Search
    const userSearchKey = activeTab === 'users' && isSearchable ? `user_search_${trimmed.toLowerCase()}` : null
    const { data: userData, loading: loadingUsers } = useCachedFetch(
        userSearchKey,
        userSearchKey ? `/auth/search?q=${encodeURIComponent(trimmed)}` : null,
        { enabled: !!userSearchKey, ttl: 5 * 60 * 1000 }
    )

    // 2. Media Search
    const mediaSearchKey = activeTab !== 'users' && isSearchable ? `${activeTab}_search_${trimmed.toLowerCase()}` : null
    const endpointMap = {
        games: `/igdb/search?q=${encodeURIComponent(trimmed)}`,
        anime: `/anime/search?q=${encodeURIComponent(trimmed)}&type=anime&limit=24`,
        manga: `/anime/search?q=${encodeURIComponent(trimmed)}&type=manga&limit=24`,
        movie: `/movies/search?q=${encodeURIComponent(trimmed)}&type=movie&limit=24`,
        tv: `/movies/search?q=${encodeURIComponent(trimmed)}&type=tv&limit=24`,
    }

    const { data: mediaData, loading: loadingMedia } = useCachedFetch(
        mediaSearchKey,
        mediaSearchKey ? endpointMap[activeTab] : null,
        { enabled: !!mediaSearchKey, ttl: 5 * 60 * 1000 }
    )

    const loading = loadingUsers || loadingMedia || (query.trim() !== debouncedQuery.trim() && isSearchable)
    const results = activeTab === 'users' 
        ? (userData?.users || []).filter(u => u.username !== currentUser?.username)
        : activeTab === 'games' 
            ? (mediaData?.games || []).map(g => ({ 
                ...g, 
                avgRating: mediaData.stats?.[String(g.id)]?.avgRating,
                userRating: mediaData.userRatings?.[String(g.id)]
            }))
            : (mediaData?.results || []).map(r => ({ 
                ...r, 
                avgRating: mediaData.stats?.[String(r.externalId)]?.avgRating,
                userRating: mediaData.userRatings?.[String(r.externalId)]
            }))

    return (
        <div className="w-full max-w-[1200px] mx-auto px-5 md:px-10 py-8 md:py-10 min-h-[70vh]">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-[#2a2a35] pb-6">
                <div>
                    <h2 className="font-black text-3xl md:text-4xl tracking-widest uppercase text-white mb-2"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        Universal <span className="text-[#c8ff57]">Search</span>
                    </h2>
                    <p className="text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest">
                        Search for players, games, and media across the multiverse
                    </p>
                </div>

                <div className="relative w-full md:w-96">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white pointer-events-none">
                        <SearchIcon size={18} strokeWidth={2.5} />
                    </span>
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search anything..."
                        className="w-full bg-[#111118] border border-[#2a2a35] rounded-xl
                                   pl-12 pr-24 py-4 text-white text-sm font-mono
                                   focus:outline-none focus:border-[#c8ff57]
                                   transition-all placeholder:text-[#7a7a90] shadow-inner"
                    />
                    {loading && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#c8ff57] font-mono text-[10px] uppercase tracking-widest animate-pulse">
                            Searching...
                        </span>
                    )}
                </div>
            </div>

            {/* Categories */}
            <div className="flex flex-wrap gap-2 mb-10">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveTab(cat.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-mono text-[10px] uppercase tracking-widest border transition-all
                                   ${activeTab === cat.id 
                                       ? 'bg-[#c8ff57] text-black border-[#c8ff57] shadow-[0_0_15px_rgba(200,255,87,0.2)]' 
                                       : 'bg-[#111118] border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57] hover:text-white'}`}
                    >
                        <cat.icon size={14} />
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Results */}
            {!isSearchable ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                    <div className="text-6xl">🔍</div>
                    <div className="text-[#7a7a90] font-mono text-sm">
                        Enter at least 2 characters to begin
                    </div>
                </div>
            ) : loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {Array.from({ length: 12 }).map((_, i) => <GameCardSkeleton key={i} />)}
                </div>
            ) : results.length === 0 ? (
                <div className="text-center py-20 bg-[#111118] border border-[#2a2a35] border-dashed rounded-2xl">
                    <div className="text-5xl mb-4">🛸</div>
                    <div className="text-white font-bold text-lg mb-2">Nothing found in this sector</div>
                    <div className="text-[#7a7a90] font-mono text-xs">
                        Try searching for something else or switch categories
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {results.map(item => (
                        activeTab === 'users' 
                            ? <UserResultCard key={item._id} u={item} getFollowStatus={getFollowStatus} handleFollowToggle={handleFollowToggle} loadingMap={loadingMap} topUsers={topUsers} currentUser={currentUser} />
                            : <MediaResultCard key={item.id || item.externalId} item={item} type={activeTab} />
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
        <div className={`${rankClass} border rounded-xl p-5 flex flex-col items-center text-center hover:border-[#c8ff57]/30 transition-all shadow-lg group`}>
            <Link to={`/user/${u.username}`} className="mb-4 relative">
                <AvatarFrame userId={u._id} src={u.avatar} size={80} className="suggestion-avatar" />
            </Link>

            <div className="flex flex-col items-center w-full min-h-[40px] mb-1">
                <Link to={`/user/${u.username}`} className="text-white font-bold text-sm hover:text-[#c8ff57] transition-colors truncate w-full">
                    {u.username}
                </Link>
                {u.followsMe && (
                    <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-[#7a7a90]/20 text-[#7a7a90] border border-[#7a7a90]/30 mt-1">
                        Follows you
                    </span>
                )}
            </div>

            <div className="h-6 flex items-center justify-center w-full mb-4">
                {rank && rank <= 4 ? (
                    <div className={`font-mono text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-sm bg-white/5 border border-white/10 ${RANK_TITLES[rank].color}`}>
                        ✨ {RANK_TITLES[rank].label}
                    </div>
                ) : (
                    <div className="font-mono text-[10px] text-[#7a7a90] truncate inline-block">
                        {u.followerCount || 0} followers
                    </div>
                )}
            </div>

            {currentUser ? (
                <button
                    onClick={() => handleFollowToggle(u)}
                    disabled={isBtnLoading}
                    className={`w-full py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2
                               ${state === 'following'
                            ? 'border border-[#2a2a35] bg-transparent text-[#7a7a90] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'
                            : state === 'requested'
                            ? 'border border-[#c8ff57]/20 bg-[#c8ff57]/5 text-[#c8ff57]'
                            : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e] shadow-lg'}
                               disabled:opacity-50`}
                >
                    {isBtnLoading ? (
                        '...'
                    ) : state === 'following' ? (
                        'Unfollow'
                    ) : state === 'requested' ? (
                        'Cancel Request'
                    ) : u.isPrivate ? (
                        'Request'
                    ) : (
                        'Follow'
                    )}
                </button>
            ) : (
                <Link to="/login" className="w-full">
                    <button className="w-full py-3 text-xs font-bold rounded-lg bg-[#c8ff57] text-black">
                        Follow
                    </button>
                </Link>
            )}
        </div>
    )
}

function MediaResultCard({ item, type }) {
    const navigate = useNavigate()
    const id = item.igdbId || item.externalId || item.id
    
    // Normalize properties across different APIs
    const title = item.title || item.name
    const cover = item.cover
    const score = item.rating || item.score
    const year = item.releaseYear || item.year
    const genre = item.genre || (item.genres?.[0])

    const pathMap = {
        games: `/game/${id}`,
        anime: `/anime/${id}`,
        manga: `/manga/${id}`,
        movie: `/movies/${id}`,
        tv: `/tv/${id}`,
    }

    return (
        <div 
            onClick={() => navigate(pathMap[type])}
            className="group relative bg-[#111118] border border-[#2a2a35] rounded-xl overflow-hidden cursor-pointer hover:border-[#c8ff57] hover:-translate-y-1 transition-all duration-300 shadow-lg"
        >
            <div className="aspect-[3/4] relative overflow-hidden">
                {cover ? (
                    <img src={cover} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                    <div className="w-full h-full bg-[#18181f] flex items-center justify-center text-4xl">{type === 'tv' ? '📺' : '🎬'}</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d14] via-transparent to-transparent opacity-60" />
                
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    {item.userRating && (
                        <div className="bg-[#c8ff57]/90 backdrop-blur-md border border-[#c8ff57]/50 rounded px-2 py-1 flex items-center gap-1 shadow-xl">
                            <span className="font-mono text-[8px] text-black/50 uppercase tracking-tighter">YOU</span>
                            <span className="font-black text-xs text-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.userRating}</span>
                        </div>
                    )}
                    {item.avgRating && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#5c9fff]/30 rounded px-2 py-1 flex items-center gap-1.5 shadow-xl">
                            <span className="font-black text-xs text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.avgRating}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4">
                <h3 className="font-bold text-sm text-white truncate mb-1 group-hover:text-[#c8ff57] transition-colors">{title}</h3>
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">{year || 'TBA'}</span>
                    <span className="w-1 h-1 rounded-full bg-[#3a3a4a]" />
                    <span className="font-mono text-[9px] text-[#c8ff57] uppercase tracking-widest truncate">{genre || (type === 'movie' ? 'Movie' : type === 'tv' ? 'TV Show' : type === 'anime' ? 'Anime' : type === 'manga' ? 'Manga' : 'Media')}</span>
                </div>
            </div>
        </div>
    )
}

export default UniversalSearch
