import { useState, useRef, useMemo, useEffect, lazy, Suspense, memo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useGamesContext } from '../context/GamesContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { Trophy, Play, Star, ListChecks, X, Pause, Search, Gamepad2, Flame, Plus, ChevronRight, Calendar } from 'lucide-react'
import Skeleton, { GameCardSkeleton } from '../components/ui/Skeleton'
import Toast from '../components/ui/Toast'
import AvatarFrame from '../components/ui/AvatarFrame'
import { getIGDBImage, SIZES } from '../utils/igdb'
import { useLeaderboard } from '../context/LeaderboardContext'
import { Helmet } from 'react-helmet-async'
import StatsBar from '../components/ui/StatsBar'



const AddGameModal = lazy(() => import('../components/library/AddGameModal'))

const RatingDisplay = memo(({ myRating, platformAvg, hasUser }) => {
    return (
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {myRating ? (
                <div className="flex items-center gap-1.5 bg-[#c8ff57]/10 border border-[#c8ff57]/20 rounded px-1.5 py-0.5 shadow-sm">
                    <span className="font-mono text-[8px] text-[#c8ff57] uppercase font-bold">me</span>
                    <div className="font-black text-sm text-[#c8ff57] leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {myRating}
                    </div>
                </div>
            ) : hasUser ? (
                <div className="font-mono text-[8px] text-[#3a3a4a] uppercase tracking-wider">no rate</div>
            ) : null}
            {platformAvg ? (
                <div className="flex items-center gap-1.5 bg-[#5c9fff]/10 border border-[#5c9fff]/20 rounded px-1.5 py-0.5 shadow-sm mt-1">
                    <div className="font-black text-sm text-[#5c9fff] leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {platformAvg}
                    </div>
                </div>
            ) : null}
        </div>
    )
})

const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const makeActivityConfig = (navigate) => ({
    completed: {
        icon: <Trophy size={16} />, bg: 'bg-[#5c9fff]/15 text-[#5c9fff]',
        getText: (a) => (<>Completed{' '}<span onClick={() => a.game.igdbId && navigate(`/game/${a.game.igdbId}`)} className={`text-[#c8ff57] font-bold ${a.game.igdbId ? 'cursor-pointer hover:underline' : ''}`}>{a.game.title}</span>{a.rating ? ` — rated it ${a.rating}/10` : ''}</>)
    },
    playing: {
        icon: <Play size={16} fill="currentColor" />, bg: 'bg-[#c8ff57]/15 text-[#c8ff57]',
        getText: (a) => (<>Started playing{' '}<span onClick={() => a.game.igdbId && navigate(`/game/${a.game.igdbId}`)} className={`text-[#c8ff57] font-bold ${a.game.igdbId ? 'cursor-pointer hover:underline' : ''}`}>{a.game.title}</span></>)
    },
    rated: {
        icon: <Star size={16} fill="currentColor" />, bg: 'bg-[#ff9f5c]/15 text-[#ff9f5c]',
        getText: (a) => (<>Rated{' '}<span onClick={() => a.game.igdbId && navigate(`/game/${a.game.igdbId}`)} className={`text-[#c8ff57] font-bold ${a.game.igdbId ? 'cursor-pointer hover:underline' : ''}`}>{a.game.title}</span>{` ${a.rating}/10`}</>)
    },
    planned: {
        icon: <ListChecks size={16} />, bg: 'bg-[#2a2a35] text-[#e8e8f0]',
        getText: (a) => (<>Added{' '}<span onClick={() => a.game.igdbId && navigate(`/game/${a.game.igdbId}`)} className={`text-[#c8ff57] font-bold ${a.game.igdbId ? 'cursor-pointer hover:underline' : ''}`}>{a.game.title}</span>{' to planned list'}</>)
    },
    dropped: {
        icon: <X size={16} strokeWidth={3} />, bg: 'bg-[#ff5c5c]/15 text-[#ff5c5c]',
        getText: (a) => (<>Dropped{' '}<span onClick={() => a.game.igdbId && navigate(`/game/${a.game.igdbId}`)} className={`text-[#c8ff57] font-bold ${a.game.igdbId ? 'cursor-pointer hover:underline' : ''}`}>{a.game.title}</span>{a.hours ? ` after ${a.hours}h` : ''}</>)
    },
    paused: {
        icon: <Pause size={16} fill="currentColor" />, bg: 'bg-[#c45cff]/15 text-[#c45cff]',
        getText: (a) => (<>Paused{' '}<span onClick={() => a.game.igdbId && navigate(`/game/${a.game.igdbId}`)} className={`text-[#c8ff57] font-bold ${a.game.igdbId ? 'cursor-pointer hover:underline' : ''}`}>{a.game.title}</span></>)
    },
})

// ── Mosaic banner ──
const HeroBanner = memo(({ games }) => {
    // Detect mobile for tile reduction
    const isMobile = window.innerWidth < 768

    const covers = useMemo(() => 
        games.filter(g => g.cover).map(g => g.cover).filter((v, i, a) => a.indexOf(v) === i),
        [games]
    )
    
    const sizePatterns = useMemo(() => [
        { w: 'w-[180px]', h: 'h-[240px]' }, { w: 'w-[130px]', h: 'h-[170px]' },
        { w: 'w-[160px]', h: 'h-[210px]' }, { w: 'w-[140px]', h: 'h-[185px]' },
        { w: 'w-[175px]', h: 'h-[230px]' }, { w: 'w-[120px]', h: 'h-[160px]' },
        { w: 'w-[155px]', h: 'h-[205px]' }, { w: 'w-[145px]', h: 'h-[195px]' },
        { w: 'w-[165px]', h: 'h-[220px]' }, { w: 'w-[135px]', h: 'h-[180px]' },
    ], [])

    const shuffled = useMemo(() => (covers.length > 0 ? [...covers].sort(() => 0.5 - Math.random()) : []), [covers])

    const row2Tiles = useMemo(() => {
        if (!shuffled.length) return []
        const count = isMobile ? 8 : 15
        const offset = Math.ceil(shuffled.length / 2)
        return Array.from({ length: count }, (_, i) => ({
            img: shuffled[(offset + i) % shuffled.length],
            ...sizePatterns[(i + 5) % sizePatterns.length]
        }))
    }, [shuffled, sizePatterns, isMobile])

    const row1Tiles = useMemo(() => {
        if (!shuffled.length) return []
        const count = isMobile ? 8 : 15
        return Array.from({ length: count }, (_, i) => ({
            img: shuffled[i % shuffled.length],
            ...sizePatterns[i % sizePatterns.length]
        }))
    }, [shuffled, sizePatterns, isMobile])

    if (covers.length === 0) return null

    return (
        <div className="absolute inset-0 z-0 overflow-hidden select-none pointer-events-none">
            <div className="absolute top-0 left-0 right-0 h-[55%] flex items-end gap-3 pb-2">
                <div className="flex gap-3 items-end will-change-transform" style={{ animation: `mosaicLeft ${isMobile ? '25s' : '40s'} linear infinite`, width: 'max-content' }}>
                    {[...row1Tiles, ...row1Tiles].map((tile, i) => (
                        <img 
                            key={i} 
                            src={getIGDBImage(tile.img, SIZES.COVER_SMALL)} 
                            alt="Game Cover Mosaic" 
                            width={tile.w.match(/\d+/)[0]}
                            height={tile.h.match(/\d+/)[0]}
                            fetchPriority={i < 4 ? "high" : "low"}
                            decoding="async"
                            className={`${tile.w} ${tile.h} object-contain rounded-lg flex-shrink-0`} 
                        />
                    ))}
                </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-[55%] flex items-start gap-3 pt-2">
                <div className="flex gap-3 items-start will-change-transform" style={{ animation: `mosaicRight ${isMobile ? '20s' : '32s'} linear infinite`, width: 'max-content' }}>
                    {[...row2Tiles, ...row2Tiles].map((tile, i) => (
                        <img 
                            key={i} 
                            src={getIGDBImage(tile.img, SIZES.COVER_SMALL)} 
                            alt="Trending Game Collection" 
                            width={tile.w.match(/\d+/)[0]}
                            height={tile.h.match(/\d+/)[0]}
                            decoding="async"
                            loading="lazy"
                            className={`${tile.w} ${tile.h} object-contain rounded-lg flex-shrink-0`} 
                        />
                    ))}
                </div>
            </div>
            <div className="absolute inset-0 backdrop-blur-[3px]" />
            <div className="absolute inset-0 bg-[#0a0a0f]/80" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0f] to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-[#0a0a0f] to-transparent" />
            <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-[#0a0a0f] to-transparent" />
            <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-[#0a0a0f] to-transparent" />
        </div>
    )
})

// normalizeGame removed because it was unused.


// ── IGDB Search Bar ──
function GameSearchBar({ id = 'game-search' }) {
    const navigate = useNavigate()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const wrapperRef = useRef(null)
    const debounceRef = useRef(null)

    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target))
                setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleChange = (e) => {
        const val = e.target.value
        setQuery(val)
        clearTimeout(debounceRef.current)
        if (!val.trim()) { setResults([]); setOpen(false); return }
        debounceRef.current = setTimeout(async () => {
            try {
                setLoading(true)
                setOpen(true)
                const res = await api.get(`/igdb/search?q=${encodeURIComponent(val)}&limit=10`)
                setResults(res.data.games || [])
            } catch {
                setResults([])
            } finally {
                setLoading(false)
            }
        }, 350)
    }

    const handleSelect = (game) => {
        setQuery('')
        setResults([])
        setOpen(false)
        navigate(`/game/${game.igdbId || game.id}`)
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }

    return (
        <div ref={wrapperRef} className="relative w-full">
            {/* Input */}
            <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a90] pointer-events-none z-10">
                    <Search size={18} strokeWidth={2.5} />
                </span>
                <input
                    id={id}
                    name={id}
                    type="text"
                    placeholder="Search any game..."
                    value={query}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    className="w-full bg-[#111118] border border-[#2a2a35] rounded-lg
                               pl-11 pr-24 py-3.5 text-white text-sm
                               focus:outline-none focus:border-[#c8ff57]
                               placeholder:text-[#94999c] transition-all"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[#a0a0b8] pointer-events-none">
                    {loading ? <span className="text-[#c8ff57] animate-pulse font-bold">searching…</span> : 'QuestDuck'}
                </span>
            </div>

            {/* Dropdown — max 4 rows visible, scroll for more */}
            {open && (
                <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-[60]
                                bg-[#111118] border border-[#2a2a35] rounded-xl
                                shadow-2xl overflow-hidden">
                    {results.length > 0 ? (
                        <>
                            {/* Scrollable list — 4 items × ~64px each */}
                                <div style={{ maxHeight: '256px', overflowY: 'auto' }} className="overscroll-contain">
                                    {results.map((game) => (
                                        <div
                                            key={game.id}
                                            onClick={() => handleSelect(game)}
                                            className="flex items-center gap-3 px-4 py-3
                                                       hover:bg-[#1a1a25] cursor-pointer
                                                       border-b border-[#2a2a35] last:border-b-0
                                                       transition-colors group"
                                        >
                                            <div className="w-8 h-11 rounded bg-[#18181f] flex-shrink-0 overflow-hidden">
                                                {game.cover ? (
                                                    <img src={getIGDBImage(game.cover, SIZES.THUMB)} alt={game.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-[#3a3a4a]">🎮</div>
                                                )}
                                            </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white font-semibold text-sm truncate group-hover:text-[#c8ff57] transition-colors">
                                                {game.title}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {game.releaseYear && (
                                                    <span className="font-mono text-[10px] text-[#7a7a90]">{game.releaseYear}</span>
                                                )}
                                                {game.genre && (
                                                    <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-1 rounded-sm bg-[#2a2a35] text-[#94999c]">
                                                        {game.genre}
                                                    </span>
                                                )}

                                            </div>
                                        </div>
                                        <span className="text-[#3a3a4a] group-hover:text-[#c8ff57] transition-colors flex-shrink-0">→</span>
                                    </div>
                                ))}
                            </div>
                            {results.length > 4 && (
                                <div className="px-4 py-2 bg-[#0d0d14] border-t border-[#2a2a35] text-center">
                                    <span className="font-mono text-[10px] text-[#3a3a4a]">scroll for more results</span>
                                </div>
                            )}
                        </>
                    ) : !loading ? (
                        <div className="px-4 py-5 text-center font-mono text-xs text-[#7a7a90]">
                            No games found for "<span className="text-white">{query}</span>"
                        </div>
                    ) : (
                        <div className="px-4 py-5 text-center font-mono text-xs text-[#7a7a90] animate-pulse">
                            Searching Database...
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

const TrendingGameCard = memo(({ game, stats, myRating, showFullDate }) => {
    const navigate = useNavigate()
    const avgRating = stats?.avgRating || 0

    return (
        <div 
            onClick={() => navigate(`/game/${game.id}`)}
            className="group relative bg-[#111118] border border-[#2a2a35] rounded-xl overflow-hidden cursor-pointer hover:border-[#c8ff57] hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
        >
            <div className="aspect-[3/4] relative overflow-hidden">
                {game.cover ? (
                    <img 
                        src={getIGDBImage(game.cover, SIZES.COVER_BIG)} 
                        alt={game.title} 
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    />
                ) : (
                    <div className="w-full h-full bg-[#18181f] flex items-center justify-center text-4xl">
                        🎮
                    </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d14] via-transparent to-transparent opacity-60" />
                
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    {avgRating > 0 && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#5c9fff]/30 rounded px-2 py-1 flex items-center gap-1.5 shadow-xl">
                            <Star size={10} className="text-[#5c9fff] fill-[#5c9fff]" />
                            <span className="font-black text-xs text-[#5c9fff]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{avgRating}</span>
                        </div>
                    )}
                    {myRating && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#c8ff57]/30 rounded px-2 py-1 flex items-center gap-1.5 shadow-xl">
                            <span className="font-mono text-[8px] text-[#c8ff57] uppercase font-bold">ME</span>
                            <span className="font-black text-xs text-[#c8ff57]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{myRating}</span>
                        </div>
                    )}
                </div>
                
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <div className="bg-[#c8ff57] text-black px-4 py-2 rounded font-black uppercase text-xs tracking-widest shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        View Details
                    </div>
                </div>
            </div>

            <div className="p-4">
                <h3 className="font-bold text-sm text-white truncate mb-1 group-hover:text-[#c8ff57] transition-colors">
                    {game.title}
                </h3>
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">
                        {game.year || (game.releaseDate ? (showFullDate ? game.releaseDate : game.releaseDate.split(',').pop().trim()) : 'TBA')}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-[#3a3a4a]" />
                    <span className="font-mono text-[9px] text-[#c8ff57] uppercase tracking-widest truncate">
                        {game.genre || 'Game'}
                    </span>
                </div>
            </div>
        </div>
    )
})

function Home() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { games, addGame } = useGamesContext()
    const { topUsers } = useLeaderboard()
    const [showAddModal, setShowAddModal] = useState(false)
    const [toast, setToast] = useState(null)
    const activityConfig = useMemo(() => makeActivityConfig(navigate), [navigate])

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }, [])

    const handleAddGame = useCallback(async (gameData) => {
        // Optimistic UI closed immediately
        setShowAddModal(false)
        const res = await addGame(gameData)
        if (res.success) {
            showToast(res.updated ? `"${res.game.title}" updated!` : `"${res.game.title}" added to pond!`)
        } else {
            showToast(res.error || 'Failed to log game', 'error')
        }
    }, [addGame, showToast])

    // ── Cached fetches — instant on return visits ──────────────────────────────
    const { data: homeData, loading } = useCachedFetch(
        'home_data',
        '/igdb/home',
        { ttl: 10 * 60 * 1000 } // home data is stable — cache 10 min
    )
    const userId = user?.id || user?._id
    const { data: activityData } = useCachedFetch(
        userId ? `activity_${userId}` : null,
        userId ? `/games/activity/${userId}` : null,
        { enabled: !!userId, ttl: 2 * 60 * 1000 }
    )

    const trending   = useMemo(() => homeData?.trending   ?? [], [homeData?.trending])
    const topRated   = useMemo(() => homeData?.topRated   ?? [], [homeData?.topRated])
    const comingSoon = useMemo(() => homeData?.comingSoon ?? [], [homeData?.comingSoon])
    const gameStats  = homeData?.gameStats  ?? {}
    const activity   = activityData?.activity ?? []

    const userStats = useMemo(() => ({
        total: games.length,
        playing: games.filter(g => g.status === 'playing').length,
        completed: games.filter(g => g.status === 'completed').length,
        planned: games.filter(g => g.status === 'planned').length,
        totalHours: games.reduce((s, g) => s + (g.hours || 0), 0),
        avgRating: games.filter(g => g.rating > 0).length > 0
            ? (games.filter(g => g.rating > 0).reduce((s, g) => s + g.rating, 0) / games.filter(g => g.rating > 0).length).toFixed(1)
            : '—'
    }), [games])

    const userRank = useMemo(() => {
        if (!user) return null
        return topUsers.find(tu => tu._id === (user.id || user._id))?.rank
    }, [topUsers, user])

    const recentGames = useMemo(() => games.slice(0, 4), [games])

    const statusConfig = useMemo(() => ({
        playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Playing' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
    }), [])
    const getMyRating = (igdbId) => {
        if (!igdbId || !user) return null
        const match = games.find(g => g.igdbId && Number(g.igdbId) === Number(igdbId))
        return match?.rating > 0 ? match.rating : null
    }

    const allGames = useMemo(() => [...trending, ...topRated, ...comingSoon], [trending, topRated, comingSoon])

    return (
        <div className="min-h-screen">
            <Helmet>
                <title>QuestDuck | The Ultimate Gaming Log, Tracker & Community</title>
                <meta name="description" content="QuestDuck: The ultimate gaming log & tracker. Log hours, rate games, manage backlogs, and find deals across PC, Xbox, PS5 & Switch." />
                <link rel="canonical" href="https://questduck.com/" />
                
                {/* Open Graph / Facebook */}
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://questduck.com/" />
                <meta property="og:title" content="QuestDuck | The Ultimate Game Tracker & Community" />
                <meta property="og:description" content="Hatch your ultimate game library. Track, rate, and discover games across all platforms." />
                <meta property="og:image" content="https://questduck.com/og-image.png" />

                {/* Twitter */}
                <meta property="twitter:card" content="summary_large_image" />
                <meta property="twitter:url" content="https://questduck.com/" />
                <meta property="twitter:title" content="QuestDuck | The Ultimate Game Tracker & Community" />
                <meta property="twitter:description" content="Hatch your ultimate game library. Track, rate, and discover games across all platforms." />
                <meta property="twitter:image" content="https://questduck.com/og-image.png" />

                {/* AI / Google Structured Data (JSON-LD) */}
                <script type="application/ld+json">
                    {`
                    {
                      "@context": "https://schema.org",
                      "@type": "WebApplication",
                      "name": "QuestDuck",
                      "url": "https://questduck.com",
                      "description": "The ultimate platform to track your game backlog, rate titles, and join a community of gamers. Support for PC, PS5, Xbox, Switch and more.",
                      "applicationCategory": "GameTracker",
                      "operatingSystem": "All",
                      "offers": {
                        "@type": "Offer",
                        "price": "0",
                        "priceCurrency": "USD"
                      },
                      "featureList": [
                        "Game Backlog Management",
                        "Personalized Game Ratings",
                        "Real-time Gaming Leaderboards",
                        "Gaming Community Social Features",
                        "Price Drop Alerts & Deals"
                      ],
                      "screenshot": "https://questduck.com/og-image.png",
                      "creator": {
                        "@type": "Organization",
                        "name": "QuestDuck Team"
                      }
                    }
                    `}
                </script>
            </Helmet>
 
            {/* Mobile search bar — sticky just below navbar, hidden on desktop */}
            <div className="md:hidden sticky top-[57px] z-40 bg-[#0d0d14]/95 backdrop-blur-sm border-b border-[#2a2a35] px-4 py-3 flex items-center">
                <div className="w-full">
                    <GameSearchBar id="game-search-mobile" />
                </div>
            </div>

            {/* ══════════════════════════
                HERO
            ══════════════════════════ */}
            <section className="relative py-16 md:py-24 overflow-hidden min-h-[500px] flex items-center">
                {(allGames.length > 0 || !loading) && (
                    <HeroBanner games={allGames} />
                )}

                <div className="relative z-10 max-w-[1200px] mx-auto px-5 md:px-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">

                        {/* Left */}
                        <div>
                            <div className="inline-flex items-center gap-2 border border-[#2a2a35] rounded px-3 py-1 mb-6">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff57]" />
                                <span className="font-mono text-[11px] text-[#7a7a90] uppercase tracking-widest">
                                    Beta · Free Forever · All Platforms
                                </span>
                            </div>

                                                         <h1
                                className="font-black uppercase leading-none tracking-wide text-[#c8ff57] mb-2"
                                style={{ fontSize: '14px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.2em' }}
                            >
                                QuestDuck: The Ultimate Gaming Log & Tracker
                            </h1>
                            <h2
                                className="font-black uppercase leading-none tracking-wide text-white mb-6"
                                style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                                Your Quest<br />
                                <span className="text-[#c8ff57]">Pond.</span>
                            </h2>

                            <p className="text-[#a0a0b8] text-sm leading-relaxed mb-8 max-w-md">
                                Track every game across PC, PlayStation, Xbox, Switch,
                                Mobile and more. Rate them, manage your backlog, find
                                deals, and discover what to play next.
                            </p>

                            <div className="flex flex-wrap gap-3 mb-10">
                                {user ? (
                                    <>
                                        <button onClick={() => setShowAddModal(true)}
                                            className="btn-apple btn-apple-primary px-6 py-3 gap-1.5">
                                            <Plus size={16} strokeWidth={2.5} /> Add to Pond
                                        </button>
                                        <button onClick={() => navigate('/library')}
                                            className="btn-apple btn-apple-secondary px-6 py-3 gap-1.5">
                                            My Library →
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <Link to={user ? "/library" : "/signup"}>
                                            <button className="btn-apple btn-apple-primary px-8 py-4 w-full sm:w-auto text-sm">
                                                {user ? "View My Pond" : "Get Started Free"}
                                            </button>
                                        </Link>
                                        <Link to="/login">
                                            <button className="btn-apple btn-apple-secondary px-6 py-3">
                                                Login →
                                            </button>
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {user && games.length > 0 ? (
                                <div className="flex gap-8">
                                    {[
                                        { value: userStats.total, label: 'In the Pond' },
                                        { value: userStats.totalHours, label: 'Hours Played' },
                                        { value: userStats.avgRating, label: 'Avg Rating' }
                                    ].map(stat => (
                                        <div key={stat.label}>
                                            <div className="font-black text-3xl text-white leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{stat.value}</div>
                                            <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider mt-1">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : !user && (
                                <div className="flex gap-8">
                                    {[
                                        { value: '∞', label: 'Games Supported' },
                                        { value: 'Free', label: 'Forever' },
                                        { value: 'All', label: 'Platforms' },
                                    ].map(stat => (
                                        <div key={stat.label}>
                                            <div className="font-black text-3xl text-[#c8ff57] leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{stat.value}</div>
                                            <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider mt-1">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right — Search bar at top + recent games below */}
                        <div className="hidden md:flex flex-col gap-3">

                            {/* Search bar — top of right column */}
                            <div className="mb-1">
                                {/* <div className="font-mono text-[10px] text-[#3a3a4a] uppercase tracking-widest mb-2">
                                    🔍 Search any game
                                </div> */}
                                <GameSearchBar id="game-search-desktop" />
                            </div>

                            {/* Divider */}
                            <div className="border-t border-[#2a2a35] my-1" />

                            {/* Recent games */}
                            {recentGames.length > 0 ? (
                                <>
                                    <div className="font-mono text-[10px] text-[#3a3a4a] uppercase tracking-widest">
                                        Recent Quests
                                    </div>
                                    {recentGames.map(game => {
                                        const sc = statusConfig[game.status] || statusConfig.planned
                                        const imageUrl = game.cover
                                            ? getIGDBImage(game.cover, SIZES.COVER_SMALL)
                                            : game.steamId
                                                ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamId}/header.jpg`
                                                : null
                                        return (
                                            <div
                                                key={game._id}
                                                onClick={() => game.igdbId && navigate(`/game/${game.igdbId}`)}
                                                className={`flex items-center gap-4 bg-[#111118]/80 border border-[#2a2a35] rounded-lg p-3 hover:border-[#c8ff57]/30 transition-all ${game.igdbId ? 'cursor-pointer' : ''}`}
                                            >
                                                <div className="w-14 h-10 rounded bg-[#18181f] bg-cover bg-center flex-shrink-0"
                                                    style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'none' }}>
                                                    {!imageUrl && <div className="w-full h-full flex items-center justify-center text-lg">🎮</div>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-white font-semibold text-sm truncate">{game.title}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-1 rounded-sm ${sc.bg} ${sc.color}`}>{sc.label}</span>
                                                        {game.platforms?.slice(0, 2).map(p => (
                                                            <span key={p} className="font-mono text-[9px] uppercase tracking-wider px-2 py-1 rounded-sm bg-[#2a2a35] text-[#94999c]">{p}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {game.rating > 0 && (
                                                    <div className="font-black text-xl text-[#c8ff57] flex-shrink-0" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                        {game.rating}<small className="font-mono text-[9px] text-[#7a7a90] font-normal">/10</small>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                    <button onClick={() => navigate('/library')}
                                        className="w-full py-3 border border-dashed border-[#2a2a35] text-[#7a7a90] font-mono text-xs rounded-lg hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">
                                        + Add More Games →
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="font-mono text-[10px] text-[#3a3a4a] uppercase tracking-widest">
                                        Recent Quests
                                    </div>
                                    {['Elden Ring', 'Hollow Knight', 'Hades', 'Celeste'].map((title, i) => (
                                        <div key={title} 
                                            onClick={() => navigate('/library')}
                                            className="flex items-center gap-4 bg-[#111118]/80 border border-[#2a2a35] rounded-lg p-3 opacity-40 cursor-pointer hover:opacity-60 transition-all hover:border-[#c8ff57]/30">
                                            <div className="w-14 h-10 rounded bg-[#18181f] flex-shrink-0 flex items-center justify-center text-lg">🎮</div>
                                            <div className="flex-1">
                                                <div className="text-white font-semibold text-sm">{title}</div>
                                                <div className="mt-1">
                                                    <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm bg-[#c8ff57]/15 text-[#c8ff57]">
                                                        {['Playing', 'Completed', 'Planned', 'Completed'][i]}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <Link to={user ? '/library' : '/signup'}>
                                        <button className="w-full py-3 border border-dashed border-[#2a2a35] text-[#7a7a90] font-mono text-xs rounded-lg hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">
                                            + Build Your Quest Pond
                                        </button>
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════
                USER STATS BAR
            ══════════════════════════ */}
            <StatsBar 
                user={user} 
                userRank={userRank} 
                mediaType="game"
                stats={{
                    total: userStats.total,
                    active: userStats.playing,
                    completed: userStats.completed,
                    planned: userStats.planned
                }}
            />

            {/* ══════════════════════════
                GRID SECTIONS (TRENDING & TOP RATED)
            ══════════════════════════ */}
            <div className="max-w-[1200px] mx-auto px-5 md:px-10 mt-12 mb-20">
                <div className="flex flex-col gap-20">
                    {/* Trending Section */}
                    <div>
                        <div className="flex items-center justify-between mb-8 group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#111118] border border-[#2a2a35] rounded-lg text-[#ff5c5c] group-hover:bg-[#ff5c5c] group-hover:text-white transition-all duration-300 shadow-lg">
                                    <Flame size={20} />
                                </div>
                                <div>
                                    <h2 className="font-black text-2xl uppercase text-white tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                        Trending Games
                                    </h2>
                                    <p className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-[0.2em]">Most ponded this week</p>
                                </div>
                            </div>
                            <div 
                                onClick={() => navigate('/explore/game/trending')}
                                className="flex items-center gap-2 text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest group-hover:text-white transition-colors cursor-pointer"
                            >
                                Explore All <ChevronRight size={14} />
                            </div>
                        </div>

                        {loading && trending.length === 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                {Array.from({ length: 5 }).map((_, i) => <GameCardSkeleton key={i} />)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                {trending.map((game) => (
                                    <TrendingGameCard 
                                        key={game.id} 
                                        game={game} 
                                        stats={gameStats[game.id]}
                                        myRating={getMyRating(game.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Top Rated Section */}
                    <div>
                        <div className="flex items-center justify-between mb-8 group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#111118] border border-[#2a2a35] rounded-lg text-[#ffd700] group-hover:bg-[#ffd700] group-hover:text-black transition-all duration-300 shadow-lg">
                                    <Trophy size={20} />
                                </div>
                                <div>
                                    <h2 className="font-black text-2xl uppercase text-white tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                        Top Rated Games
                                    </h2>
                                    <p className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-[0.2em]">Highest rated this month</p>
                                </div>
                            </div>
                            <div 
                                onClick={() => navigate('/explore/game/top_rated')}
                                className="flex items-center gap-2 text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest group-hover:text-white transition-colors cursor-pointer"
                            >
                                Explore All <ChevronRight size={14} />
                            </div>
                        </div>

                        {loading && topRated.length === 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                {Array.from({ length: 5 }).map((_, i) => <GameCardSkeleton key={i} />)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                {topRated.map((game) => (
                                    <TrendingGameCard 
                                        key={game.id} 
                                        game={game} 
                                        stats={gameStats[game.id]}
                                        myRating={getMyRating(game.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════
                COMING SOON
            ══════════════════════════ */}
            <div className="max-w-[1200px] mx-auto px-5 md:px-10 mb-20">
                <div className="flex items-center justify-between mb-8 group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#111118] border border-[#2a2a35] rounded-lg text-[#5c9fff] group-hover:bg-[#5c9fff] group-hover:text-white transition-all duration-300 shadow-lg">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <h2 className="font-black text-2xl uppercase text-white tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Coming Soon
                            </h2>
                            <p className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-[0.2em]">Upcoming & announced</p>
                        </div>
                    </div>
                    <div 
                        onClick={() => navigate('/explore/game/coming_soon')}
                        className="flex items-center gap-2 text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest group-hover:text-white transition-colors cursor-pointer"
                    >
                        Explore All <ChevronRight size={14} />
                    </div>
                </div>

                {loading && comingSoon.length === 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {Array.from({ length: 5 }).map((_, i) => <GameCardSkeleton key={i} />)}
                    </div>
                ) : comingSoon.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {comingSoon.map((game) => (
                            <TrendingGameCard 
                                key={game.id} 
                                game={game} 
                                stats={gameStats[game.id]}
                                myRating={getMyRating(game.id)}
                                showFullDate={true}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-[#7a7a90] font-mono text-sm">No upcoming games found</div>
                )}
            </div>

            {/* ══════════════════════════
                RECENT ACTIVITY
            ══════════════════════════ */}
            {user && (
                <section className="max-w-[1200px] mx-auto px-5 md:px-10 py-12 border-t border-[#2a2a35]">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="font-black text-2xl tracking-widest uppercase text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Recent Activity</h2>
                    </div>
                    {loading && activity.length === 0 ? (
                        <div className="flex flex-col gap-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 px-5 py-4 bg-[#111118] border border-[#2a2a35] rounded-lg">
                                    <Skeleton variant="block" width="36px" height="36px" />
                                    <div className="flex-1">
                                        <Skeleton variant="line" width="60%" height="12px" />
                                    </div>
                                    <Skeleton variant="line" width="40px" height="10px" />
                                </div>
                            ))}
                        </div>
                    ) : activity.length > 0 ? (
                        <>
                            <div className="flex flex-col divide-y divide-[#2a2a35] border border-[#2a2a35] rounded-lg overflow-hidden">
                                {activity.slice(0, 5).map((item, index) => {
                                    const config = activityConfig[item.type] || activityConfig.planned
                                    return (
                                        <div key={index} className="flex items-center gap-4 px-5 py-4 bg-[#111118] hover:bg-[#18181f] transition-all">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${config.bg}`}>{config.icon}</div>
                                            <div className="flex-1 text-sm text-[#7a7a90]">{config.getText(item)}</div>
                                            <div className="font-mono text-[10px] text-[#7a7a90] flex-shrink-0">{timeAgo(item.time)}</div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="mt-4 text-center">
                                <Link to="/activity">
                                    <button className="px-6 py-3 border border-[#2a2a35] text-[#7a7a90] font-mono text-xs rounded-lg hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">
                                        Show More Activity →
                                    </button>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-10 flex flex-col items-center">
                            <Gamepad2 size={48} className="text-[#2a2a35] mb-4" />
                            <div className="text-[#7a7a90] font-mono text-sm mb-4">No activity yet. Start adding games!</div>
                            <button 
                                onClick={() => setShowAddModal(true)}
                                className="btn-apple btn-apple-primary px-6 py-2.5"
                            >
                                + Add to Pond
                            </button>
                        </div>
                    )}
                </section>
            )}

            {/* ── Add Game Modal ── */}
            {showAddModal && (
                <Suspense fallback={null}>
                    <AddGameModal 
                        onClose={() => setShowAddModal(false)}
                        onAdd={handleAddGame}
                        games={games}
                    />
                </Suspense>
            )}

            {/* ── Toast ── */}
            {toast && (
                <Toast 
                    message={toast.message} 
                    type={toast.type} 
                    onClose={() => setToast(null)} 
                />
            )}
                    {/* ══════════════════════════
                FAQ / KNOWLEDGE BASE (SEO BOOST)
            ══════════════════════════ */}
            <section className="max-w-[1200px] mx-auto px-5 md:px-10 py-20 border-t border-[#2a2a35]/50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div className="flex flex-col gap-4">
                        <h3 className="font-black text-xl text-white uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            What is QuestDuck?
                        </h3>
                        <p className="text-[#7a7a90] text-xs leading-relaxed">
                            QuestDuck is the ultimate gaming log and discovery platform designed for gamers who want to organize their digital lives. Whether you play on PC, PlayStation 5, Xbox Series X, or Nintendo Switch, our tracker helps you maintain a personal gaming diary, rate titles, and log your precious hours played. Join the "QuestPond" and transform your backlog into a completed masterpiece.
                        </p>
                    </div>
                    <div className="flex flex-col gap-4">
                        <h3 className="font-black text-xl text-white uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            How to track games?
                        </h3>
                        <p className="text-[#7a7a90] text-xs leading-relaxed">
                            Log games instantly using our integrated database. Simply search for any title, select your platform, and update your status to "Playing," "Completed," or "Planned." You can record your play sessions, set personal ratings out of 10, and see how your tastes compare to the rest of the gaming community. Our system acts as your permanent gaming record and backlog manager.
                        </p>
                    </div>
                    <div className="flex flex-col gap-4">
                        <h3 className="font-black text-xl text-white uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            Discovery & Deals
                        </h3>
                        <p className="text-[#7a7a90] text-xs leading-relaxed">
                            Beyond simple tracking, QuestDuck is a powerful game discovery tool. Explore "Trending Now" sections to see what the community is playing, or browse "Coming Soon" for upcoming releases. Our integrated deals tracker surfaces the best discounts across digital storefronts, ensuring you never miss a bargain. Level up your profile, earn gaming XP, and climb the leaderboard as you log more adventures.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    )
}
export default Home