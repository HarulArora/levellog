import { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useGamesContext } from '../context/GamesContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { Search } from 'lucide-react'
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

    // score color matching the HTML sample
    const scoreColor = (r) => r >= 8 ? '#c8ff57' : r >= 6 ? '#5c9fff' : '#ff5c5c'

    return (
        <div
            onClick={onClick}
            className="game-card-hover"
            style={{
                background: '#111118',
                border: statusStyle ? `1px solid ${statusStyle.color}40` : '1px solid #2a2a35',
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.25s',
                position: 'relative',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#c8ff57'
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.4), 0 0 0 1px rgba(200,255,87,0.1)'
            }}
            onMouseLeave={e => {
                e.currentTarget.style.borderColor = statusStyle ? `${statusStyle.color}40` : '#2a2a35'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
            }}
        >
            {/* Banner image */}
            <div style={{ height: 110, position: 'relative', overflow: 'hidden', background: '#18181f' }}>
                {game.cover ? (
                    <img
                        src={getIGDBImage(game.cover, SIZES.COVER_BIG)}
                        alt={game.title}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                    />
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>🎮</div>
                )}
                {/* gradient fade at bottom like the sample */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 45, background: 'linear-gradient(to top, #111118, transparent)' }} />

            </div>

            {/* Status pill — positioned relative to CARD (not banner) so overflow:hidden doesn't clip it */}
            {status && statusStyle && (
                <div style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: 'rgba(0,0,0,0.72)',
                    border: `1px solid ${statusStyle.color}`,
                    color: statusStyle.color,
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 700,
                    fontSize: 9,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    padding: '3px 7px',
                    borderRadius: 3,
                    zIndex: 10,
                }}>
                    {statusStyle.label}
                </div>
            )}

            {/* Card body */}
            <div style={{ padding: '8px 10px 10px' }}>
                {/* Title */}
                <div style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    color: '#e8e8f0',
                    marginBottom: status ? 6 : 6,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}>
                    {game.title}
                </div>



                {/* Platform badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10, minHeight: 16 }}>
                    {(game.platforms || []).slice(0, 4).map(p => <PlatBadge key={p} name={p} />)}
                </div>

                {/* Bottom: ratings row + genre row — no overlap */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

                    {/* Ratings row */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>

                        {/* Your rating — site green */}
                        {userRating ? (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                                <span style={{
                                    fontFamily: "'Bebas Neue', sans-serif",
                                    fontSize: 20,
                                    color: '#c8ff57',
                                    letterSpacing: 1,
                                    lineHeight: 1,
                                }}>{userRating}</span>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'rgba(200,255,87,0.45)' }}>/10</span>
                            </div>
                        ) : (
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: '#3a3a4a', fontWeight: 600 }}>—</span>
                        )}

                        {/* Avg platform rating — blue */}
                        {game.avgRating && (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                                <span style={{
                                    fontFamily: "'Bebas Neue', sans-serif",
                                    fontSize: userRating ? 15 : 20,
                                    color: '#5c9fff',
                                    letterSpacing: 1,
                                    lineHeight: 1,
                                }}>{game.avgRating}</span>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'rgba(92,159,255,0.45)' }}>/10</span>
                            </div>
                        )}

                    </div>

                    {/* Genre below ratings — full width, no overlap */}
                    {game.genre && (
                        <span style={{
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 9,
                            color: '#7a7a90',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                        }}>
                            {game.genre}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
})

export default function Discover() {
    const { user } = useAuth()
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
        `/igdb/discover?page=${page}&limit=${LIMIT}${activeGenre ? `&genre=${activeGenre.igdb}` : ''}`,
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
    }, [searchQuery, activeGenre, page])

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
          gap: 10px;
          margin-bottom: 40px;
        }
        @media (min-width: 480px) {
          .discover-grid { grid-template-columns: repeat(3, 1fr); gap: 12px; }
        }
        @media (min-width: 768px) {
          .discover-grid { grid-template-columns: repeat(4, 1fr); gap: 14px; }
        }
        @media (min-width: 1024px) {
          .discover-grid { grid-template-columns: repeat(5, 1fr); gap: 16px; }
        }
        @media (min-width: 1280px) {
          .discover-grid { grid-template-columns: repeat(6, 1fr); gap: 16px; }
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
