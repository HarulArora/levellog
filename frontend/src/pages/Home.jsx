import { useState, useRef, useMemo, useEffect, lazy, Suspense, memo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useGamesContext } from '../context/GamesContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { Trophy, Play, Star, ListChecks, X, Pause, Search, Gamepad2, Flame, Plus } from 'lucide-react'
import Skeleton, { GameCardSkeleton } from '../components/ui/Skeleton'
import Toast from '../components/ui/Toast'
import { getXPProgress } from '../utils/levels'
import { getIGDBImage, SIZES } from '../utils/igdb'

const AddGameModal = lazy(() => import('../components/library/AddGameModal'))

const RatingDisplay = memo(({ myRating, platformAvg, hasUser }) => {
    return (
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {myRating ? (
                <div className="flex items-center gap-1">
                    <span className="font-mono text-[8px] text-[#7a7a90] uppercase tracking-wider">me</span>
                    <div className="font-black text-lg text-[#c8ff57] leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {myRating}<small className="font-mono text-[8px] text-[#7a7a90] font-normal">/10</small>
                    </div>
                </div>
            ) : hasUser ? (
                <div className="font-mono text-[8px] text-[#2a2a35] uppercase tracking-wider">not rated</div>
            ) : null}
            {platformAvg ? (
                <div className="flex items-center gap-1">
                    <span className="font-mono text-[8px] text-[#7a7a90] uppercase tracking-wider">avg</span>
                    <div className="font-black text-lg text-[#5c9fff] leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {platformAvg}<small className="font-mono text-[8px] text-[#7a7a90] font-normal">/10</small>
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
                        <img key={i} src={getIGDBImage(tile.img, SIZES.COVER_BIG)} alt="" className={`${tile.w} ${tile.h} object-contain rounded-lg flex-shrink-0`} />
                    ))}
                </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-[55%] flex items-start gap-3 pt-2">
                <div className="flex gap-3 items-start will-change-transform" style={{ animation: `mosaicRight ${isMobile ? '20s' : '32s'} linear infinite`, width: 'max-content' }}>
                    {[...row2Tiles, ...row2Tiles].map((tile, i) => (
                        <img key={i} src={getIGDBImage(tile.img, SIZES.COVER_BIG)} alt="" className={`${tile.w} ${tile.h} object-contain rounded-lg flex-shrink-0`} />
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

// ── Normalize IGDB search result (handles both field naming conventions) ──
const normalizeGame = (g) => ({
    id: g.id,
    title: g.title || g.name || 'Unknown',
    cover: g.cover
        ? (g.cover.startsWith('http') ? g.cover : `https:${g.cover}`)
        : null,
    genre: g.genre || g.genres?.[0]?.name || null,
    releaseYear: g.releaseYear || (g.first_release_date
        ? new Date(g.first_release_date * 1000).getFullYear()
        : null),
    rating: g.rating ?? g.igdbRating ?? null,
})

// ── IGDB Search Bar ──
function GameSearchBar() {
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
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a90] pointer-events-none text-base"><Search size={16} /></span>
                <input
                    type="text"
                    placeholder="Search any game..."
                    value={query}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    className="w-full bg-[#111118] border border-[#2a2a35] rounded-lg
                               pl-10 pr-24 py-3 text-white text-sm
                               focus:outline-none focus:border-[#c8ff57]
                               placeholder:text-[#3a3a4a] transition-all"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[#3a3a4a] pointer-events-none">
                    {loading ? <span className="text-[#7a7a90] animate-pulse">searching…</span> : 'QuestDeck'}
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
                                                    <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm bg-[#2a2a35] text-[#7a7a90]">
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

function Home() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { games, addGame } = useGamesContext()
    const [showAddModal, setShowAddModal] = useState(false)
    const [toast, setToast] = useState(null)
    const activityConfig = useMemo(() => makeActivityConfig(navigate), [navigate])

    const showToast = useCallback((message, type = 'success') => setToast({ message, type }), [])

    const handleAddGame = useCallback(async (gameData) => {
        // Optimistic UI closed immediately
        setShowAddModal(false)
        const res = await addGame(gameData)
        if (res.success) {
            showToast(res.updated ? `"${res.game.title}" updated!` : `"${res.game.title}" added to deck!`)
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

    const trending  = homeData?.trending   ?? []
    const topRated  = homeData?.topRated   ?? []
    const comingSoon = homeData?.comingSoon ?? []
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


    return (
        <div className="min-h-screen">

            {/* Mobile search bar — sticky just below navbar, hidden on desktop */}
            <div className="md:hidden sticky top-[57px] z-40 bg-[#0d0d14]/95 backdrop-blur-sm border-b border-[#2a2a35] px-4 py-3 flex items-center">
                <div className="w-full">
                    <GameSearchBar />
                </div>
            </div>

            {/* ══════════════════════════
                HERO
            ══════════════════════════ */}
            <section className="relative py-12 md:py-20 overflow-hidden">
                {(trending.length > 0 || (!loading && trending.length > 0)) && (
                    <HeroBanner games={[...trending, ...topRated, ...comingSoon]} />
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
                                className="font-black uppercase leading-none tracking-wide text-white mb-6"
                                style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                                Your Quest<br />
                                <span className="text-[#c8ff57]">Deck.</span>
                            </h1>

                            <p className="text-[#7a7a90] text-sm leading-relaxed mb-6 max-w-md">
                                Track every game across PC, PlayStation, Xbox, Switch,
                                Mobile and more. Rate them, manage your backlog, find
                                deals, and discover what to play next.
                            </p>

                            <div className="flex flex-wrap gap-3 mb-10">
                                {user ? (
                                    <>
                                        <button onClick={() => setShowAddModal(true)}
                                            className="btn-apple btn-apple-primary px-6 py-3 gap-1.5">
                                            <Plus size={16} strokeWidth={2.5} /> Add to Deck
                                        </button>
                                        <button onClick={() => navigate('/library')}
                                            className="btn-apple btn-apple-secondary px-6 py-3 gap-1.5">
                                            My Library →
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Link to="/signup">
                                            <button className="btn-apple btn-apple-primary px-6 py-3">
                                                Get Started Free
                                            </button>
                                        </Link>
                                        <Link to="/login">
                                            <button className="btn-apple btn-apple-secondary px-6 py-3">
                                                Login →
                                            </button>
                                        </Link>
                                    </>
                                )}
                            </div>

                            {user && games.length > 0 ? (
                                <div className="flex gap-8">
                                    {[
                                        { value: userStats.total, label: 'Games Decked' },
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
                                <GameSearchBar />
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
                                            ? game.cover
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
                                                        <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm ${sc.bg} ${sc.color}`}>{sc.label}</span>
                                                        {game.platforms?.slice(0, 2).map(p => (
                                                            <span key={p} className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm bg-[#2a2a35] text-[#7a7a90]">{p}</span>
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
                                            + Build Your Quest Deck
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
            {user && (
                <section className="border-y border-[#2a2a35] bg-[#111118] cursor-pointer hover:bg-[#18181f] transition-colors" onClick={() => navigate('/stats')}>
                    <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-5">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <div className="flex items-center gap-3">
                                {user.avatar ? (
                                    <img src={user.avatar} alt={user.username} className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-[#2a2a35]" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c8ff57] to-[#5c9fff] flex items-center justify-center font-black text-sm text-black flex-shrink-0" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                        {user.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 min-w-0">
                                    <div className="text-white font-bold text-sm truncate">{user.username}</div>
                                    <div className="font-mono text-[10px] text-[#7a7a90]">@{user.username} · All platforms</div>
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
                            <div className="flex gap-8">
                                {[
                                    { value: userStats.total, label: 'Total' },
                                    { value: userStats.playing, label: 'Playing' },
                                    { value: userStats.completed, label: 'Completed' },
                                    { value: userStats.planned, label: 'Planned' },
                                ].map(stat => (
                                    <div key={stat.label} className="text-center sm:text-left">
                                        <div className="font-black text-2xl text-white leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{stat.value}</div>
                                        <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="sm:ml-auto">
                                <Link to="/stats">
                                    <button className="font-mono text-xs text-[#7a7a90] hover:text-[#c8ff57] transition-colors">View Full Stats →</button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ══════════════════════════
                TRENDING NOW
            ══════════════════════════ */}
            <section className="max-w-[1200px] mx-auto px-5 md:px-10 py-12">
                <div className="flex items-center gap-3 mb-6">
                    <span className="text-2xl"><Flame className="text-[#ff5c5c] fill-current" size={24} /></span>
                    <h2 className="font-black text-2xl tracking-widest uppercase text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Trending Now</h2>
                    <span className="font-mono text-xs text-[#7a7a90] hidden sm:block">Most decked this week</span>
                </div>
                {loading && trending.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-[#2a2a35] bg-[#111118]">
                                    <Skeleton variant="block" width="24px" height="24px" />
                                    <Skeleton variant="block" width="40px" height="56px" />
                                    <div className="flex-1">
                                        <Skeleton variant="line" width="60%" height="14px" />
                                        <Skeleton variant="line" width="30%" height="9px" style={{ marginTop: 4 }} />
                                    </div>
                                    <Skeleton variant="block" width="40px" height="30px" />
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col gap-2">
                             {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-[#2a2a35] bg-[#111118]">
                                    <Skeleton variant="block" width="24px" height="24px" />
                                    <Skeleton variant="block" width="40px" height="56px" />
                                    <div className="flex-1">
                                        <Skeleton variant="line" width="60%" height="14px" />
                                        <Skeleton variant="line" width="30%" height="9px" style={{ marginTop: 4 }} />
                                    </div>
                                    <Skeleton variant="block" width="40px" height="30px" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                            {trending.map((game, index) => (
                                <div key={game.id} onClick={() => navigate(`/game/${game.id}`)}
                                    className="flex items-center gap-4 p-3 rounded-lg border border-[#2a2a35] bg-[#111118] hover:border-[#c8ff57]/30 transition-all cursor-pointer">
                                    <div className="font-black text-2xl text-[#2a2a35] w-6 text-center flex-shrink-0" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{index + 1}</div>
                                    {game.cover ? (
                                        <img src={game.cover} alt={game.title} className="w-10 h-14 object-cover rounded flex-shrink-0" />
                                    ) : (
                                        <div className="w-10 h-14 bg-[#2a2a35] rounded flex-shrink-0 flex items-center justify-center text-sm">🎮</div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white font-semibold text-sm truncate">{game.title}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm bg-[#2a2a35] text-[#7a7a90]">{game.genre}</span>
                                            {index < 2 && <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm bg-[#ff5c5c]/15 text-[#ff5c5c]">HOT</span>}
                                        </div>
                                    </div>
                                    <RatingDisplay 
                                        myRating={getMyRating(game.id)} 
                                        platformAvg={gameStats[game.id]?.avgRating}
                                        hasUser={!!user} 
                                    />
                                </div>
                            ))}
                        </div>
                        <div>
                            <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">Top Rated This Month</div>
                            <div className="flex flex-col gap-2">
                                {topRated.map((game, index) => (
                                    <div key={game.id} onClick={() => navigate(`/game/${game.id}`)}
                                        className="flex items-center gap-4 p-3 rounded-lg border border-[#2a2a35] bg-[#111118] hover:border-[#c8ff57]/30 transition-all cursor-pointer">
                                        <div className="font-black text-2xl text-[#2a2a35] w-6 text-center flex-shrink-0" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{index + 1}</div>
                                        {game.cover ? (
                                            <img src={game.cover} alt={game.title} className="w-10 h-14 object-cover rounded flex-shrink-0" />
                                        ) : (
                                            <div className="w-10 h-14 bg-[#2a2a35] rounded flex-shrink-0 flex items-center justify-center text-sm">🎮</div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white font-semibold text-sm truncate">{game.title}</div>
                                            <div className="mt-1">
                                                <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm bg-[#2a2a35] text-[#7a7a90]">{game.genre}</span>
                                            </div>
                                        </div>
                                        <RatingDisplay 
                                        myRating={getMyRating(game.id)} 
                                        platformAvg={gameStats[game.id]?.avgRating}
                                        hasUser={!!user} 
                                    />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* ══════════════════════════
                COMING SOON
            ══════════════════════════ */}
            <section className="max-w-[1200px] mx-auto px-5 md:px-10 py-12 border-t border-[#2a2a35]">
                <div className="flex items-center gap-3 mb-6">
                    <h2 className="font-black text-2xl tracking-widest uppercase text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Coming Soon</h2>
                    <span className="font-mono text-xs text-[#7a7a90] hidden sm:block">Upcoming &amp; announced</span>
                </div>
                {loading && comingSoon.length === 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => <GameCardSkeleton key={i} />)}
                    </div>
                ) : comingSoon.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        {comingSoon.map(game => (
                            <div key={game.id} onClick={() => navigate(`/game/${game.id}`)}
                                className="bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden hover:border-[#c8ff57]/50 transition-all cursor-pointer">
                                <div className="relative">
                                    {game.cover ? (
                                        <img src={game.cover} alt={game.title} className="w-full h-[160px] object-cover" />
                                    ) : (
                                        <div className="w-full h-[160px] bg-[#18181f] flex items-center justify-center text-3xl">🎮</div>
                                    )}
                                    <div className="absolute top-2 left-2">
                                        <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm bg-[#5c9fff]/90 text-white">Upcoming</span>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <div className="text-white font-semibold text-xs truncate mb-1">{game.title}</div>
                                    <div className="font-mono text-[9px] text-[#7a7a90]">{game.releaseDate}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-[#7a7a90] font-mono text-sm">No upcoming games found</div>
                )}
            </section>

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
                                + Add to Deck
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
        </div>
    )
}

export default Home