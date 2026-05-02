import { useState, useEffect, memo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Star } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import api from '../../api/axios'
import useCachedFetch from '../../hooks/useCachedFetch'
import { GameCardSkeleton } from '../../components/ui/Skeleton'
import SubSectionToggle from '../../components/ui/SubSectionToggle'

const ANIME_GENRES = [
    { label: 'Action', mal: 1, emoji: '🤺' },
    { label: 'Adventure', mal: 2, emoji: '🗺️' },
    { label: 'Comedy', mal: 4, emoji: '😂' },
    { label: 'Drama', mal: 8, emoji: '🎭' },
    { label: 'Fantasy', mal: 10, emoji: '🪄' },
    { label: 'Horror', mal: 14, emoji: '👻' },
    { label: 'Mystery', mal: 7, emoji: '🕵️' },
    { label: 'Romance', mal: 22, emoji: '💖' },
    { label: 'Sci-Fi', mal: 24, emoji: '🚀' },
    { label: 'Sports', mal: 30, emoji: '⚽' },
    { label: 'Slice of Life', mal: 36, emoji: '🏘️' },
    { label: 'Supernatural', mal: 37, emoji: '🧿' },
    { label: 'Suspense', mal: 41, emoji: '😰' },
    { label: 'Gourmet', mal: 47, emoji: '🍳' },
    { label: 'Award Winning', mal: 46, emoji: '🏆' },
    { label: 'Movies', mal: 'movie', emoji: '🎬' },
];

const AnimeCard = memo(({ item }) => {
    const navigate = useNavigate()
    
    return (
        <div 
            onClick={() => navigate(`/anime/${item.externalId}`)}
            className="group relative bg-[#111118] border border-[#2a2a35] rounded-xl overflow-hidden cursor-pointer hover:border-[#c8ff57] hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
        >
            <div className="aspect-[3/4] relative overflow-hidden">
                {item.cover ? (
                    <img 
                        src={item.cover} 
                        alt={item.title} 
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    />
                ) : (
                    <div className="w-full h-full bg-[#18181f] flex items-center justify-center text-4xl">
                        📺
                    </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d14] via-transparent to-transparent opacity-60" />
                
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    {item.avgRating && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#5c9fff]/30 rounded px-2 py-1 flex items-center gap-1.5 shadow-xl">
                            <Star size={10} style={{ color: '#5c9fff', fill: '#5c9fff' }} />
                            <span className="font-black text-xs text-[#5c9fff]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.avgRating}</span>
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
                    {item.title}
                </h3>
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">{item.year || 'TBA'}</span>
                    <span className="w-1 h-1 rounded-full bg-[#3a3a4a]" />
                    <span className="font-mono text-[9px] text-[#c8ff57] uppercase tracking-widest truncate max-w-[100px]">
                        {item.genres?.[0] || 'Anime'}
                    </span>
                </div>
            </div>
        </div>
    )
})

function AnimeDiscover() {
    const [searchParams, setSearchParams] = useSearchParams()
    const type = 'anime'
    
    // Genre State from URL
    const genreParam = searchParams.get('genre')
    const initialGenre = genreParam ? ANIME_GENRES.find(g => g.label === genreParam) : null
    const [activeGenre, setActiveGenre] = useState(initialGenre)
    
    // Page State from URL
    const pageParam = parseInt(searchParams.get('page')) || 1
    const [page, setPage] = useState(pageParam)

    // Search State
    const [query, setQuery] = useState(searchParams.get('q') || '')
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchPerformed, setSearchPerformed] = useState(!!searchParams.get('q'))

    // Discovery Data
    const genreKey = activeGenre?.mal || 'all'
    const { data: discoverData, loading } = useCachedFetch(
        `anime_discover_v5_anime_${genreKey}_${page}`,
        `/anime/discover?type=anime&page=${page}&limit=24${activeGenre ? `&genre=${activeGenre.mal}` : ''}`,
        { ttl: 15 * 60 * 1000, deps: [genreKey, page] }
    )

    const items = discoverData?.items || []
    const totalPages = discoverData?.totalPages || 1
    const totalCount = discoverData?.total || 0

    // Sync URL with state
    useEffect(() => {
        const newParams = new URLSearchParams()
        if (query.trim()) newParams.set('q', query)
        if (activeGenre) newParams.set('genre', activeGenre.label)
        if (page > 1) newParams.set('page', page.toString())
        setSearchParams(newParams, { replace: true })
    }, [query, activeGenre, page, setSearchParams])

    const handleSearch = async (e) => {
        e?.preventDefault()
        if (!query.trim()) return
        
        setIsSearching(true)
        setSearchPerformed(true)
        setActiveGenre(null) // Clear genre when searching
        setPage(1)
        
        try {
            const res = await api.get(`/anime/search?q=${encodeURIComponent(query)}&type=${type}&limit=24`)
            setSearchResults(res.data.results.map(r => ({ ...r, avgRating: res.data.stats[r.externalId]?.avgRating })) || [])
        } catch (err) {
            console.error(err)
            setSearchResults([])
        } finally {
            setIsSearching(false)
        }
    }

    const selectGenre = (genre) => {
        if (activeGenre?.mal === genre.mal) {
            setActiveGenre(null)
        } else {
            setActiveGenre(genre)
            setQuery('') // Clear search when selecting genre
            setSearchPerformed(false)
        }
        setPage(1)
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
                <title>Discover Anime | QuestDuck</title>
            </Helmet>

            {/* Header */}
            <section className="bg-[#111118] border-b border-[#2a2a35] pt-24 pb-12">
                <div className="max-w-[1200px] mx-auto px-5 md:px-10">
                    <SubSectionToggle 
                        current="anime"
                        type="anime"
                        options={[
                            { label: 'Anime', value: 'anime', path: '/anime/discover' },
                            { label: 'Manga', value: 'manga', path: '/manga/discover' }
                        ]}
                    />
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div className="max-w-xl">
                            <h1 className="font-black text-5xl md:text-6xl text-white uppercase mb-4" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Discover <span className="text-[#c8ff57]">{activeGenre ? activeGenre.label : 'Anime'}</span>
                            </h1>
                            <p className="text-[#7a7a90] text-sm font-mono uppercase tracking-wider">
                                Browse thousands of anime series by popularity and genres.
                            </p>
                        </div>

                        <form onSubmit={handleSearch} className="w-full md:w-96 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7a7a90]" size={18} />
                            <input 
                                type="text"
                                placeholder="Search anime..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-[#c8ff57] transition-all shadow-inner"
                            />
                            {query && (
                                <button 
                                    type="submit" 
                                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#c8ff57] text-black font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded hover:bg-[#d4ff6e] transition-colors"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                    Find
                                </button>
                            )}
                        </form>
                    </div>
                </div>
            </section>

            <div className="max-w-[1200px] mx-auto px-5 md:px-10 mt-12">
                
                {/* ── Browse by Genre ── */}
                {!searchPerformed && (
                    <>
                        <div className="flex items-center justify-between mb-8 border-b border-[#2a2a35] pb-4">
                            <span className="font-black text-2xl tracking-[2px] uppercase text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                BROWSE BY GENRE
                            </span>
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-8 gap-3 mb-16">
                            {ANIME_GENRES.map(genre => {
                                const isActive = activeGenre?.mal === genre.mal
                                return (
                                    <div
                                        key={genre.mal}
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
                        </div>
                    </>
                )}

                {/* ── Main Feed Header ── */}
                <div className="flex items-center justify-between mb-8 border-b border-[#2a2a35] pb-4">
                    <div className="flex items-center gap-4">
                        <span className="font-black text-2xl tracking-[2px] uppercase text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            {searchPerformed ? 'SEARCH RESULTS' : (activeGenre ? activeGenre.label.toUpperCase() : 'ALL')}
                        </span>
                        {!searchPerformed && totalCount > 0 && (
                            <span className="font-mono text-[10px] text-[#7a7a90] mt-1">{totalCount.toLocaleString()}</span>
                        )}
                    </div>
                    {(searchPerformed || activeGenre) && (
                        <button 
                            onClick={() => { setSearchPerformed(false); setQuery(''); setActiveGenre(null); setPage(1); }}
                            className="text-[#7a7a90] hover:text-white font-mono text-[10px] uppercase tracking-widest transition-colors"
                        >
                            ✕ Clear Filter
                        </button>
                    )}
                </div>

                {/* ── Grid ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {loading || isSearching ? (
                        Array.from({ length: 24 }).map((_, i) => <GameCardSkeleton key={i} />)
                    ) : (searchPerformed ? searchResults : items).map(item => (
                        <AnimeCard 
                            key={item.externalId} 
                            item={searchPerformed ? item : { ...item, avgRating: discoverData?.stats?.[item.externalId]?.avgRating }} 
                        />
                    ))}
                </div>

                {/* ── No Results ── */}
                {!loading && !isSearching && (searchPerformed ? searchResults.length === 0 : items.length === 0) && (
                    <div className="py-24 text-center bg-[#111118] border border-[#2a2a35] border-dashed rounded-3xl">
                        <div className="text-5xl mb-6">🛸</div>
                        <h3 className="text-white font-black text-2xl uppercase mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>No anime found</h3>
                        <p className="text-[#7a7a90] font-mono text-sm">Try exploring a different genre or search term</p>
                    </div>
                )}

                {/* ── Pagination ── */}
                {!loading && !searchPerformed && totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-16 flex-wrap">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 rounded bg-[#111118] border border-[#2a2a35] text-[#7a7a90] font-mono text-xs uppercase tracking-widest hover:border-[#c8ff57] hover:text-[#c8ff57] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            ← Prev
                        </button>
                        
                        {pageNumbers.map((n, i) => {
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

                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 rounded bg-[#111118] border border-[#2a2a35] text-[#7a7a90] font-mono text-xs uppercase tracking-widest hover:border-[#c8ff57] hover:text-[#c8ff57] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default AnimeDiscover
