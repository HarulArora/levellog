import { useState, useEffect, useMemo, useRef, memo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { useGamesContext } from '../context/GamesContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { Search, Star, Plus } from 'lucide-react'
import { GameCardSkeleton } from '../components/ui/Skeleton'
import { getIGDBImage, SIZES } from '../utils/igdb'
import { Helmet } from 'react-helmet-async'

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

                {/* Rating Badges */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                    {game.avgRating && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#5c9fff]/30 rounded px-2 py-1 flex items-center gap-1 shadow-xl w-[48px] justify-center">
                            <Star size={10} className="text-[#5c9fff] fill-[#5c9fff]" />
                            <span className="font-black text-xs text-[#5c9fff]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{game.avgRating}</span>
                        </div>
                    )}
                    {userRating && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#c8ff57]/30 rounded px-2 py-1 flex items-center gap-1 shadow-xl w-[48px] justify-center">
                            <span className="font-black text-[8px] text-[#c8ff57] mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>ME</span>
                            <span className="font-black text-xs text-[#c8ff57]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{userRating}</span>
                        </div>
                    )}
                </div>

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


    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchPerformed, setSearchPerformed] = useState(!!searchParams.get('q'))
    
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

    const handleSearch = async (e) => {
        e?.preventDefault()
        const q = searchQuery.trim()
        if (!q) return

        setIsSearching(true)
        setSearchPerformed(true)
        setActiveGenre(null)

        try {
            const res = await api.get(`/igdb/search?q=${encodeURIComponent(q)}&page=${page}&limit=${LIMIT}`)
            const fetchedSearchedGames = res.data.games || []
            
            const ids = fetchedSearchedGames.map(g => g.id).filter(Boolean)
            if (ids.length > 0) {
                try {
                    const statsRes = await api.post('/games/stats/batch', { igdbIds: ids })
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
                    setSearchResults(fetchedSearchedGames)
                }
            } else {
                setSearchResults(fetchedSearchedGames)
            }
        } catch (err) {
            console.error('Search error:', err)
            setSearchResults([])
        } finally {
            setIsSearching(false)
        }
    }

    // Trigger search on page change
    useEffect(() => {
        if (searchPerformed && searchQuery.trim()) {
            handleSearch()
        }
    }, [page])

    // Handle clearing search manually
    const clearSearch = () => {
        setSearchQuery('')
        setSearchPerformed(false)
        setSearchResults([])
        setPage(1)
    }

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
        <div className="min-h-screen pb-20">
            <Helmet>
                <title>Discover Games | QuestDuck</title>
            </Helmet>

            {/* ── Header ── */}
            <section className="bg-[#111118] border-b border-[#2a2a35] pt-24 pb-12">
                <div className="max-w-[1200px] mx-auto px-5 md:px-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div className="max-w-xl">
                            <h1 className="font-black text-5xl md:text-6xl text-white uppercase leading-none mb-3" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Discover <span className="text-[#c8ff57]">{activeGenre ? activeGenre.label : 'Games'}</span>
                            </h1>
                            <p className="text-[#7a7a90] text-sm font-mono uppercase tracking-wider">
                                Browse thousands of titles across all platforms.
                            </p>
                        </div>

                        <form onSubmit={handleSearch} className="w-full md:w-96 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c8ff57] z-10" size={18} />
                            <input 
                                type="text"
                                placeholder="Search games..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-xl pl-12 pr-32 py-4 text-white focus:outline-none focus:border-[#c8ff57] transition-all shadow-inner placeholder:text-[#7a7a90]"
                            />
                            {searchQuery && (
                                <button 
                                    type="submit" 
                                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#c8ff57] text-black font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded hover:bg-[#d4ff6e] transition-colors"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                    {isSearching ? '...' : 'Find'}
                                </button>
                            )}
                        </form>
                    </div>
                </div>
            </section>

            <div className="max-w-[1200px] mx-auto px-5 md:px-10 mt-12">
                
                {/* ── Browse by Genre ── */}
                {!searchQuery && (
                    <>
                        <div className="flex items-center justify-between mb-8 border-b border-[#2a2a35] pb-4">
                            <span className="font-black text-2xl tracking-[2px] uppercase text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                BROWSE BY GENRE
                            </span>
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-8 gap-3 mb-16">
                            {GENRE_CARDS.map(genre => {
                                const isActive = activeGenre?.label === genre.label
                                return (
                                    <div
                                        key={genre.label}
                                        onClick={() => selectGenre(genre)}
                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer text-center group
                                            ${isActive ? 'bg-[#c8ff57]/10 border-[#c8ff57] scale-105' : 'bg-[#111118] border-[#2a2a35] hover:border-[#c8ff57] hover:-translate-y-1'}
                                        `}
                                    >
                                        <div className="text-2xl mb-2">{genre.emoji}</div>
                                        <div className={`font-black text-[11px] uppercase tracking-wider leading-tight ${isActive ? 'text-[#c8ff57]' : 'text-[#7a7a90] group-hover:text-white'}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {genre.label}
                                        </div>
                                    </div>
                                )
                            })}
                            <div
                                onClick={() => setShowMore(true)}
                                className="flex flex-col items-center justify-center p-4 rounded-xl border border-[#2a2a35] bg-[#111118] hover:border-[#c8ff57] transition-all cursor-pointer text-center group hover:-translate-y-1"
                            >
                                <div className="text-2xl mb-2">➕</div>
                                <div className="font-black text-[11px] uppercase tracking-wider text-[#7a7a90] group-hover:text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    More
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ── Main Feed Header ── */}
                <div className="flex items-center justify-between mb-8 border-b border-[#2a2a35] pb-4">
                    <div className="flex items-center gap-4">
                        <span className="font-black text-2xl tracking-[2px] uppercase text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            {searchPerformed ? 'SEARCH RESULTS' : (activeGenre ? activeGenre.label.toUpperCase() : 'TRENDING NOW')}
                        </span>
                        {total > 0 && !searchQuery && (
                            <span className="font-mono text-[10px] text-[#7a7a90] mt-1">{total.toLocaleString()}</span>
                        )}
                    </div>
                    {(searchQuery || activeGenre) && (
                        <button 
                            onClick={clearSearch}
                            className="text-[#7a7a90] hover:text-white font-mono text-[10px] uppercase tracking-widest transition-colors"
                        >
                            ✕ Clear Filter
                        </button>
                    )}
                </div>

                {/* ── Grid ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {loading || isSearching ? (
                        Array.from({ length: 20 }).map((_, i) => <GameCardSkeleton key={i} />)
                    ) : (searchPerformed ? searchResults : games).map(game => (
                        <GameCard 
                            key={game.id} 
                            game={game} 
                            entry={libraryMap[game.id]}
                            onClick={() => navigate(`/game/${game.id}`)}
                        />
                    ))}
                </div>

                {/* ── No Results ── */}
                {!loading && !isSearching && (searchPerformed ? searchResults.length === 0 : games.length === 0) && (
                    <div className="py-24 text-center bg-[#111118] border border-[#2a2a35] border-dashed rounded-3xl">
                        <div className="text-5xl mb-6">🛰️</div>
                        <h3 className="text-white font-black text-2xl uppercase mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>No games found</h3>
                        <p className="text-[#7a7a90] font-mono text-sm">Try a different search or genre</p>
                    </div>
                )}

                {/* ── Pagination ── */}
                {!loading && (searchPerformed ? searchResults.length > 0 : totalPages > 1) && (
                    <div className="flex items-center justify-center gap-2 mt-16 flex-wrap">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 rounded bg-[#111118] border border-[#2a2a35] text-[#7a7a90] font-mono text-xs uppercase tracking-widest hover:border-[#c8ff57] hover:text-[#c8ff57] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            ← Prev
                        </button>
                        
                        {/* Only show page numbers for non-search (where we have totalPages) */}
                        {!searchPerformed && pageNumbers.map((n, i) => {
                            const prev = pageNumbers[i - 1]
                            const ellipsis = prev && n - prev > 1
                            return (
                                <div key={n} className="flex items-center gap-2">
                                    {ellipsis && <span className="text-[#3a3a4a] font-mono">...</span>}
                                    <button
                                        onClick={() => setPage(n)}
                                        className={`w-10 h-10 rounded border font-mono text-xs transition-all ${n === page ? 'bg-[#c8ff57]/10 border-[#c8ff57] text-[#c8ff57]' : 'bg-[#111118] border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57] hover:text-white'}`}
                                    >
                                        {n}
                                    </button>
                                </div>
                            )
                        })}

                        {/* If searching, we don't always know totalPages, so we just show Next if we got a full page of results */}
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={searchPerformed ? searchResults.length < LIMIT : page === totalPages}
                            className="px-4 py-2 rounded bg-[#111118] border border-[#2a2a35] text-[#7a7a90] font-mono text-xs uppercase tracking-widest hover:border-[#c8ff57] hover:text-[#c8ff57] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            Next →
                        </button>
                    </div>
                )}

                {/* ── More Genres Modal ── */}
                {showMore && (
                    <div
                        onClick={() => setShowMore(false)}
                        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            className="bg-[#111118] border border-[#2a2a35] rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-8 border-b border-[#2a2a35] pb-4">
                                <span className="font-black text-2xl tracking-[3px] uppercase text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    ALL GENRES
                                </span>
                                <button onClick={() => setShowMore(false)} className="text-[#7a7a90] hover:text-white transition-colors">✕</button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[...GENRE_CARDS, ...MORE_GENRES].map(genre => {
                                    const isActive = activeGenre?.label === genre.label
                                    return (
                                        <div
                                            key={genre.label}
                                            onClick={() => { selectGenre(genre); setShowMore(false) }}
                                            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer text-center group
                                                ${isActive ? 'bg-[#c8ff57]/10 border-[#c8ff57]' : 'bg-[#0d0d14] border-[#2a2a35] hover:border-[#c8ff57]'}
                                            `}
                                        >
                                            <div className="text-2xl mb-2">{genre.emoji}</div>
                                            <div className={`font-black text-[11px] uppercase tracking-wider leading-tight ${isActive ? 'text-[#c8ff57]' : 'text-[#7a7a90] group-hover:text-white'}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                {genre.label}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
