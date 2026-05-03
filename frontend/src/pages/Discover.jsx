import { useState, useEffect, useMemo, useRef, memo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { useGamesContext } from '../context/GamesContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { Search, Star } from 'lucide-react'
import { GameCardSkeleton } from '../components/ui/Skeleton'
import { getIGDBImage, SIZES } from '../utils/igdb'

const GENRE_CARDS = [
    { label: 'Action RPG', igdb: 'Role-playing (RPG)', emoji: '⚔️' },
    { label: 'FPS', igdb: 'Shooter', emoji: '🔫' },
    { label: 'RPG', igdb: 'Role-playing (RPG)', emoji: '🧙' },
    { label: 'Roguelite', igdb: "Hack and slash/Beat 'em up", emoji: '🎲' },
    { label: 'Platformer', igdb: 'Platform', emoji: '🏃' },
    { label: 'Simulation', igdb: 'Simulator', emoji: '🏗️' },
    { label: 'JRPG', igdb: 'Role-playing (RPG)', emoji: '⚡' },
    { label: 'Sandbox', igdb: 'Adventure', emoji: '🧱' },
    { label: 'Adventure', igdb: 'Adventure', emoji: '🗺️' },
    { label: 'Fighting', igdb: 'Fighting', emoji: '🥊' },
    { label: 'Horror', igdb: 'Horror', emoji: '👻' },
    { label: 'Racing', igdb: 'Racing', emoji: '🏎️' },
    { label: 'Strategy', igdb: 'Strategy', emoji: '♟️' },
]

const MORE_GENRES = [
    { label: 'Puzzle', igdb: 'Puzzle', emoji: '🧩' },
    { label: 'Sports', igdb: 'Sport', emoji: '⚽' },
    { label: 'Indie', igdb: 'Indie', emoji: '🌱' },
    { label: 'Arcade', igdb: 'Arcade', emoji: '🕹️' },
    { label: 'MOBA', igdb: 'MOBA', emoji: '⚔️' },
    { label: 'Stealth', igdb: 'Stealth', emoji: '🥷' },
    { label: 'Survival', igdb: 'Survival', emoji: '🏕️' },
    { label: 'Music', igdb: 'Music', emoji: '🎵' },
    { label: 'Visual Novel', igdb: 'Visual Novel', emoji: '📖' },
    { label: 'Tactical', igdb: 'Tactical', emoji: '🎯' },
    { label: 'Card Game', igdb: 'Card & Board Game', emoji: '🃏' },
    { label: 'Pinball', igdb: 'Pinball', emoji: '🎱' },
    { label: 'Quiz', igdb: 'Quiz/Trivia', emoji: '❓' },
]

// Platform badge colors — exact same as the HTML sample
const PLAT_COLORS = {
    PC: { bg: 'rgba(92,159,255,0.18)', color: '#5c9fff', border: 'rgba(92,159,255,0.35)' },
    PS5: { bg: 'rgba(0,117,255,0.15)', color: '#5daeff', border: 'rgba(0,117,255,0.35)' },
    PS4: { bg: 'rgba(0,117,255,0.15)', color: '#5daeff', border: 'rgba(0,117,255,0.35)' },
    PS3: { bg: 'rgba(0,117,255,0.15)', color: '#5daeff', border: 'rgba(0,117,255,0.35)' },
    'Xbox Series': { bg: 'rgba(16,121,50,0.18)', color: '#5dc55d', border: 'rgba(16,121,50,0.35)' },
    'Xbox One': { bg: 'rgba(16,121,50,0.18)', color: '#5dc55d', border: 'rgba(16,121,50,0.35)' },
    Xbox: { bg: 'rgba(16,121,50,0.18)', color: '#5dc55d', border: 'rgba(16,121,50,0.35)' },
    Switch: { bg: 'rgba(230,0,20,0.15)', color: '#ff6464', border: 'rgba(230,0,20,0.35)' },
    Mobile: { bg: 'rgba(196,92,255,0.15)', color: '#c45cff', border: 'rgba(196,92,255,0.35)' },
    Mac: { bg: 'rgba(255,255,255,0.06)', color: '#aaa', border: 'rgba(255,255,255,0.12)' },
}

const STATUS_COLORS = {
    playing: { color: '#c8ff57', label: 'Playing' },
    completed: { color: '#5c9fff', label: 'Completed' },
    dropped: { color: '#ff5c5c', label: 'Dropped' },
    wishlist: { color: '#c45cff', label: 'Wishlist' },
    backlog: { color: '#ff9f5c', label: 'Backlog' },
    paused: { color: '#c45cff', label: 'Paused' },
    planned: { color: '#ff9f5c', label: 'Planned' },   // ← ADD THIS
    // Title Case duplicates
    Playing: { color: '#c8ff57', label: 'Playing' },
    Completed: { color: '#5c9fff', label: 'Completed' },
    Dropped: { color: '#ff5c5c', label: 'Dropped' },
    Wishlist: { color: '#c45cff', label: 'Wishlist' },
    Backlog: { color: '#ff9f5c', label: 'Backlog' },
    Paused: { color: '#c45cff', label: 'Paused' },
    Planned: { color: '#ff9f5c', label: 'Planned' },   // ← ADD THIS
}

const PlatBadge = memo(({ name }) => {
    const s = PLAT_COLORS[name] || { bg: 'rgba(255,255,255,0.06)', color: '#888', border: 'rgba(255,255,255,0.1)' }
    const short = name === 'Xbox Series' ? 'X|S' : name === 'Xbox One' ? 'XOne' : name
    return (
        <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 9,
            fontWeight: 500,
            padding: '1px 5px',
            borderRadius: 2,
            border: `1px solid ${s.border}`,
            background: s.color,
            color: '#000',
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
        }}>{short}</span>
    )
})

const StatusPill = memo(({ status }) => {
    const s = STATUS_COLORS[status]
    if (!s) return null
    return (
        <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            padding: '3px 8px',
            borderRadius: 3,
            background: s.color,
            color: '#000',
            display: 'inline-block',
        }}>{status}</span>
    )
})



const GameCard = memo(({ game, entry, onClick }) => {
    const status = entry?.status
    const userRating = entry?.rating
    const statusStyle = status ? STATUS_COLORS[status] : null

    return (
        <div 
            onClick={onClick}
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

                {/* Rating Badge */}
                {game.avgRating && (
                    <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md border border-[#5c9fff]/30 rounded px-2 py-1 flex items-center gap-1.5 shadow-xl">
                        <Star size={10} className="text-[#5c9fff] fill-[#5c9fff]" />
                        <span className="font-black text-xs text-[#5c9fff]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{game.avgRating}</span>
                    </div>
                )}

                {/* Status Badge */}
                {status && statusStyle && (
                    <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/80 border border-[#c8ff57]/30 shadow-xl">
                        <div className="font-mono text-[8px] font-bold text-[#c8ff57] uppercase tracking-wider">{statusStyle.label}</div>
                    </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <div className="bg-[#c8ff57] text-black px-4 py-2 rounded font-black uppercase text-xs tracking-widest shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        View Details
                    </div>
                </div>
            </div>

            {/* Info Section - Outside of Aspect Ratio div to match Anime/Manga cards */}
            <div className="p-4">
                <h3 className="font-bold text-sm text-white truncate mb-1 group-hover:text-[#c8ff57] transition-colors">
                    {game.title}
                </h3>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">
                            {game.year || 'TBA'}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-[#3a3a4a] flex-shrink-0" />
                        <span className="font-mono text-[9px] text-[#c8ff57] uppercase tracking-widest truncate">
                            {game.genre || 'Game'}
                        </span>
                    </div>
                    {userRating && (
                        <div className="flex items-baseline gap-0.5 ml-2">
                            <span className="font-mono text-[11px] font-bold text-[#c8ff57]">{userRating}</span>
                            <span className="font-mono text-[7px] text-[#c8ff57]/50">/10</span>
                        </div>
                    )}
                </div>
                {/* Platform Tags - Small and subtle */}
                <div className="flex gap-1 mt-2 overflow-hidden">
                    {(game.platforms || []).slice(0, 3).map(p => (
                        <span key={p} className="font-mono text-[7px] text-[#505060] uppercase border border-white/5 px-1 rounded">
                            {p === 'Xbox Series' ? 'X|S' : p === 'Xbox One' ? 'XOne' : p}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
})

export default function Discover() {
    const navigate = useNavigate()
    const { games: userLibrary } = useGamesContext()

    const [searchParams, setSearchParams] = useSearchParams()
    
    const genreParam = searchParams.get('genre')
    const initialGenre = genreParam ? [...GENRE_CARDS, ...MORE_GENRES].find(g => g.label === genreParam) : null
    const [activeGenre, setActiveGenre] = useState(initialGenre)
    
    const pageParam = parseInt(searchParams.get('page'))
    const [page, setPage] = useState(pageParam || 1)
    const [showMore, setShowMore] = useState(false)


    // Search Mode State
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const abortControllerRef = useRef(null)

    const LIMIT = 24

    // Map library for quick lookups
    const libraryMap = useMemo(() => {
        const map = {}
        for (const g of userLibrary || []) {
            if (g.igdbId) {
                map[String(g.igdbId)] = { status: g.status, rating: g.rating }
                map[Number(g.igdbId)] = { status: g.status, rating: g.rating }
            }
        }
        return map
    }, [userLibrary])

    // Cached discovery data
    const genreKey = activeGenre?.label || 'all'
    const { data: discoverData, loading } = useCachedFetch(
        `discover_${genreKey}_${page}`,
        `/igdb/discover?page=${page}&limit=${LIMIT}${activeGenre ? `&genre=${encodeURIComponent(activeGenre.igdb)}` : ''}`,
        { ttl: 15 * 60 * 1000, deps: [genreKey, page] }
    )

    const games = discoverData?.games || []
    const totalPages = discoverData?.totalPages || 1
    const total = discoverData?.total || 0

    // Enrichment — average ratings per platform
    // Note: We could build a more complex hook if we wanted to cache enrichment too,
    // but the discovery endpoint itself usually returns what's needed for the feed.
    // If enriched stats are needed, the backend discover endpoint should preferrably bundle them.


    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [page, genreKey])

    // Sync URL with all filters
    useEffect(() => {
        const newParams = new URLSearchParams(searchParams)
        
        if (searchQuery.trim()) {
            newParams.set('q', searchQuery)
        } else {
            newParams.delete('q')
        }

        if (activeGenre) {
            newParams.set('genre', activeGenre.label)
        } else {
            newParams.delete('genre')
        }

        if (page > 1) {
            newParams.set('page', page)
        } else {
            newParams.delete('page')
        }

        setSearchParams(newParams, { replace: true })
    }, [searchQuery, activeGenre, page, searchParams, setSearchParams])

    useEffect(() => {
        const q = searchQuery.trim()
        if (q.length < 2) {
            setSearchResults([])
            setIsSearching(false)
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
                abortControllerRef.current = null
            }
            return
        }

        setIsSearching(true)

        const timer = setTimeout(async () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
            abortControllerRef.current = new AbortController()
            try {
                const res = await api.get(`/igdb/search?q=${encodeURIComponent(q)}`, {
                    signal: abortControllerRef.current.signal
                })
                const fetchedSearchedGames = res.data.games || []
                
                const ids = fetchedSearchedGames.map(g => g.id).filter(Boolean)
                if (ids.length > 0) {
                    try {
                        const statsRes = await api.post('/games/stats/batch', { igdbIds: ids }, {
                            signal: abortControllerRef.current.signal
                        })
                        const stats = statsRes.data.stats || {}
                        const enriched = fetchedSearchedGames.map(g => {
                            const igdbId = g.igdbId || g.id
                            return {
                                ...g,
                                id: igdbId,
                                igdbId: igdbId,
                                avgRating: stats[igdbId]?.avgRating || null
                            }
                        })
                        setSearchResults(enriched)
                    } catch (err) {
                        if (err.name !== 'CanceledError' && err.message !== 'canceled') {
                            setSearchResults(fetchedSearchedGames)
                        }
                    }
                } else {
                    setSearchResults(fetchedSearchedGames)
                }
            } catch (err) {
                if (err.name !== 'CanceledError' && err.message !== 'canceled') {
                    console.error('Search error:', err)
                    setSearchResults([])
                }
            } finally {
                setIsSearching(false)
            }
        }, 400)

        return () => clearTimeout(timer)
    }, [searchQuery])

    const selectGenre = (card) => {
        setActiveGenre(prev => prev?.label === card.label ? null : card)
        setPage(1)
        setShowMore(false)
    }

    const getPageNumbers = () => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
        const s = new Set([1, totalPages, page])
        if (page > 1) s.add(page - 1)
        if (page < totalPages) s.add(page + 1)
        return [...s].sort((a, b) => a - b)
    }

    const pageNumbers = getPageNumbers()

    return (
        <div style={{ minHeight: '100vh', color: '#e8e8f0', paddingBottom: 60 }}>
            <style>{`
        .discover-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          margin-bottom: 40px;
        }
        @media (min-width: 640px) {
          .discover-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 768px) {
          .discover-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (min-width: 1024px) {
          .discover-grid { grid-template-columns: repeat(5, 1fr); }
        }
        .genre-grid-responsive {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 40px;
        }
        @media (min-width: 480px) {
          .genre-grid-responsive { grid-template-columns: repeat(4, 1fr); gap: 10px; }
        }
        @media (min-width: 768px) {
          .genre-grid-responsive { grid-template-columns: repeat(7, 1fr); gap: 12px; }
        }
        @media (min-width: 1024px) {
          .genre-grid-responsive { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
        }
        .discover-page-padding {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 16px 0;
        }
        @media (min-width: 768px) {
          .discover-page-padding { padding: 40px 40px 0; }
        }
        .game-card-body-inner {
          padding: 8px 10px 10px;
        }
        @media (min-width: 480px) {
          .game-card-body-inner { padding: 12px 14px 14px; }
        }
        .game-card-title-text {
          font-weight: 600;
          font-size: 11px;
          color: #e8e8f0;
          margin-bottom: 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (min-width: 480px) {
          .game-card-title-text { font-size: 13px; }
        }
      `}</style>
            <div className="discover-page-padding">

                {/* ── Browse by Genre ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 28, paddingBottom: 16, borderBottom: '1px solid #2a2a35', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3 }}>BROWSE BY GENRE</span>
                    
                    {/* Native Search Input */}
                    <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7a7a90', display: 'flex', alignItems: 'center' }}>
                            <Search size={16} strokeWidth={2.5} />
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search games..."
                            style={{
                                width: '100%',
                                background: '#111118',
                                border: '1px solid #2a2a35',
                                borderRadius: 8,
                                padding: '10px 14px 10px 42px',
                                color: '#fff',
                                fontFamily: "'DM Mono', monospace",
                                fontSize: 13,
                                transition: 'all 0.2s',
                                outline: 'none',
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = '#c8ff57'}
                            onBlur={e => e.currentTarget.style.borderColor = '#2a2a35'}
                        />
                        {isSearching && (
                            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#7a7a90', fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
                                loading...
                            </span>
                        )}
                        {searchQuery.length > 0 && !isSearching && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#7a7a90', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12 }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {searchQuery.trim().length < 2 && (
                    <>
                        {/* Genre cards */}
                <div className="genre-grid-responsive">
                    {GENRE_CARDS.map(card => {
                        const isActive = activeGenre?.label === card.label
                        return (
                            <div
                                key={card.label}
                                onClick={() => selectGenre(card)}
                                style={{
                                    background: isActive ? 'rgba(200,255,87,0.06)' : '#111118',
                                    border: `1px solid ${isActive ? '#c8ff57' : '#2a2a35'}`,
                                    borderRadius: 8,
                                    padding: '20px 16px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textAlign: 'center',
                                }}
                                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = '#c8ff57'; e.currentTarget.style.transform = 'translateY(-2px)' } }}
                                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = '#2a2a35'; e.currentTarget.style.transform = 'translateY(0)' } }}
                            >
                                <div style={{ fontSize: 28, marginBottom: 8 }}>{card.emoji}</div>
                                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 2, color: isActive ? '#c8ff57' : '#e8e8f0', marginBottom: 2 }}>
                                    {card.label.toUpperCase()}
                                </div>
                            </div>
                        )
                    })}

                    {/* + More */}
                    <div
                        onClick={() => setShowMore(true)}
                        style={{
                            background: '#111118',
                            border: '1px solid #2a2a35',
                            borderRadius: 8,
                            padding: '20px 16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#c8ff57'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a35'; e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                        <div style={{ fontSize: 28 }}>＋</div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 2, color: '#7a7a90' }}>MORE</div>
                    </div>
                </div>

                {/* More Genres Modal */}
                {showMore && (
                    <div
                        onClick={() => setShowMore(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{ background: '#111118', border: '1px solid #2a2a35', borderRadius: 12, padding: 32, width: 520, maxWidth: '92vw' }}
                        >
                            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 3, marginBottom: 20 }}>MORE GENRES</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                                {MORE_GENRES.map(card => {
                                    const isActive = activeGenre?.label === card.label
                                    return (
                                        <button
                                            key={card.label}
                                            onClick={() => { selectGenre(card); setShowMore(false) }}
                                            style={{
                                                background: isActive ? 'rgba(200,255,87,0.06)' : 'transparent',
                                                border: `1px solid ${isActive ? '#c8ff57' : '#2a2a35'}`,
                                                borderRadius: 8,
                                                padding: '14px 10px',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s',
                                                textAlign: 'center',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: 6,
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#c8ff57'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = '#2a2a35'; e.currentTarget.style.transform = 'translateY(0)' } }}
                                        >
                                            <span style={{ fontSize: 22 }}>{card.emoji}</span>
                                            <span style={{
                                                fontFamily: "'Bebas Neue', sans-serif",
                                                fontSize: 12,
                                                letterSpacing: 2,
                                                color: isActive ? '#c8ff57' : '#e8e8f0',
                                            }}>{card.label.toUpperCase()}</span>
                                        </button>
                                    )
                                })}
                            </div>
                            <button
                                onClick={() => setShowMore(false)}
                                style={{ marginTop: 20, background: 'transparent', border: 'none', color: '#7a7a90', cursor: 'pointer', fontSize: 12, fontFamily: "'DM Mono', monospace" }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}

                        {/* All Games header */}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #2a2a35' }}>
                            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3 }}>
                                {activeGenre ? activeGenre.label.toUpperCase() : 'ALL GAMES'}
                            </span>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#7a7a90' }}>
                                {total > 0 ? `${total.toLocaleString()} games` : ''}
                            </span>
                            {activeGenre && (
                                <button
                                    onClick={() => { setActiveGenre(null); setPage(1) }}
                                    style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#7a7a90', cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}
                                >
                                    ✕ Clear filter
                                </button>
                            )}
                        </div>
                    </>
                )}

                {searchQuery.trim().length >= 2 && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #2a2a35' }}>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3 }}>
                            SEARCH RESULTS
                        </span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#7a7a90' }}>
                            "{searchQuery}"
                        </span>
                    </div>
                )}

                {/* Games Grid — 6 cols */}
                <div className="discover-grid">
                    {(searchQuery.trim().length >= 2 ? (isSearching && searchResults.length === 0) : (loading && games.length === 0))
                        ? Array.from({ length: LIMIT }).map((_, i) => <GameCardSkeleton key={i} />)
                        : (searchQuery.trim().length >= 2 ? searchResults : games).map(game => (
                            <GameCard
                                key={game.id}
                                game={game}
                                entry={libraryMap[game.id]}
                                onClick={() => navigate(`/game/${game.id}`)}
                            />
                        ))
                    }
                </div>

                {/* No Results Empty State */}
                {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#7a7a90', fontFamily: "'DM Mono', monospace", fontSize: 14 }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
                        No games found for "{searchQuery}"
                    </div>
                )}

                {/* Pagination */}
                {!loading && totalPages > 1 && searchQuery.trim().length < 2 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', paddingBottom: 16 }}>
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            style={{
                                padding: '6px 14px', borderRadius: 4,
                                border: '1px solid #2a2a35',
                                background: 'transparent',
                                color: page === 1 ? '#3a3a4a' : '#7a7a90',
                                fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                                cursor: page === 1 ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { if (page !== 1) { e.currentTarget.style.borderColor = '#c8ff57'; e.currentTarget.style.color = '#c8ff57' } }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a35'; e.currentTarget.style.color = page === 1 ? '#3a3a4a' : '#7a7a90' }}
                        >← Prev</button>

                        {pageNumbers.map((n, i) => {
                            const prev = pageNumbers[i - 1]
                            const ellipsis = prev && n - prev > 1
                            return (
                                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {ellipsis && <span style={{ color: '#3a3a4a', fontSize: 13 }}>…</span>}
                                    <button
                                        onClick={() => setPage(n)}
                                        style={{
                                            width: 34, height: 34, borderRadius: 4,
                                            border: `1px solid ${n === page ? '#c8ff57' : '#2a2a35'}`,
                                            background: n === page ? 'rgba(200,255,87,0.08)' : 'transparent',
                                            color: n === page ? '#c8ff57' : '#7a7a90',
                                            fontFamily: "'DM Mono', monospace", fontSize: 13,
                                            fontWeight: n === page ? 600 : 400,
                                            cursor: 'pointer', transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => { if (n !== page) { e.currentTarget.style.borderColor = '#c8ff57'; e.currentTarget.style.color = '#c8ff57' } }}
                                        onMouseLeave={e => { if (n !== page) { e.currentTarget.style.borderColor = '#2a2a35'; e.currentTarget.style.color = '#7a7a90' } }}
                                    >{n}</button>
                                </div>
                            )
                        })}

                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            style={{
                                padding: '6px 14px', borderRadius: 4,
                                border: '1px solid #2a2a35',
                                background: 'transparent',
                                color: page === totalPages ? '#3a3a4a' : '#7a7a90',
                                fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                                cursor: page === totalPages ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { if (page !== totalPages) { e.currentTarget.style.borderColor = '#c8ff57'; e.currentTarget.style.color = '#c8ff57' } }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a35'; e.currentTarget.style.color = page === totalPages ? '#3a3a4a' : '#7a7a90' }}
                        >Next →</button>
                    </div>
                )}

            </div>
        </div>
    )
}
