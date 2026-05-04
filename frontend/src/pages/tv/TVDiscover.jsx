import { useState, useEffect, memo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Search, Flame, Star, Trophy, LayoutGrid, Film, Tv } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import api from '../../api/axios'
import useCachedFetch from '../../hooks/useCachedFetch'
import { GameCardSkeleton } from '../../components/ui/Skeleton'
import SubSectionToggle from '../../components/ui/SubSectionToggle'

const GENRE_EMOJIS = {
    'Action & Adventure': '🗺️',
    'Animation': '🎨',
    'Comedy': '😂',
    'Crime': '🚔',
    'Documentary': '📹',
    'Drama': '🎭',
    'Family': '👨',
    'Kids': '🧒',
    'Mystery': '🕵️',
    'News': '📰',
    'Reality': '📺',
    'Sci-Fi & Fantasy': '🚀',
    'Soap': '🧼',
    'Talk': '💬',
    'War & Politics': '🏛️',
    'Western': '🤠'
};

const TVCard = memo(({ item }) => {
    const navigate = useNavigate()
    
    return (
        <div 
            onClick={() => navigate(`/tv/${item.externalId}`)}
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
                
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                    {item.avgRating && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#5c9fff]/30 rounded px-2 py-1 flex items-center gap-1.5 shadow-xl min-w-[45px] justify-center">
                            <Star size={10} style={{ color: '#5c9fff', fill: '#5c9fff' }} />
                            <span className="font-black text-xs text-[#5c9fff]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.avgRating}</span>
                        </div>
                    )}
                    {item.rating > 0 && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#c8ff57]/30 rounded px-2 py-1 flex items-center gap-1 shadow-xl min-w-[45px] justify-center">
                            <span className="font-black text-[8px] text-[#c8ff57] mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>ME</span>
                            <span className="font-black text-xs text-[#c8ff57]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.rating}</span>
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
                    <span className="font-mono text-[9px] text-[#c8ff57] uppercase tracking-widest truncate">
                        {item.genres?.[0] || 'TV Show'}
                    </span>
                </div>
            </div>
        </div>
    )
})

function TVDiscover() {
    const { user } = useAuth()
    const [activeGenre, setActiveGenre] = useState(null)
    const [genres, setGenres] = useState([])
    const [page, setPage] = useState(1)
    const [libraryMap, setLibraryMap] = useState({})

    // Fetch library to show personal ratings/status
    useEffect(() => {
        const fetchLibrary = async () => {
            if (!user) return
            try {
                const res = await api.get('/movies/library') // TV is in movies library too
                const map = {}
                res.data.library.forEach(entry => {
                    if (entry.externalId && (entry.type === 'tv' || entry.mediaType === 'tv')) {
                        map[entry.externalId] = entry
                    }
                })
                setLibraryMap(map)
            } catch (err) {
                console.error('Failed to fetch library for discovery mapping:', err)
            }
        }
        fetchLibrary()
    }, [user])
    
    const [query, setQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchPerformed, setSearchPerformed] = useState(false)

    useEffect(() => {
        const fetchGenres = async () => {
            try {
                const res = await api.get('/movies/genres?type=tv')
                setGenres(res.data.genres || [])
            } catch (err) { console.error(err) }
        }
        fetchGenres()
    }, [])

    const genreKey = activeGenre?.id || 'all'
    const { data: discoverData, loading } = useCachedFetch(
        `tv_discover_v4_tv_${genreKey}_${page}_24`,
        `/movies/discover?type=tv&page=${page}&limit=24${activeGenre ? `&genre=${activeGenre.id}` : ''}`,
        { ttl: 15 * 60 * 1000, deps: [genreKey, page] }
    )

    const items = discoverData?.items || []
    const totalPages = discoverData?.totalPages || 1
    const totalCount = discoverData?.total || 0

    const [searchTotalPages, setSearchTotalPages] = useState(1)

    const handleSearch = async (e) => {
        e?.preventDefault()
        if (!query.trim()) return
        
        setIsSearching(true)
        setSearchPerformed(true)
        setActiveGenre(null)
        
        try {
            const res = await api.get(`/movies/search?q=${encodeURIComponent(query)}&type=tv&limit=24&page=${page}`)
            setSearchResults(res.data.results.map(r => ({ ...r, avgRating: res.data.stats?.[r.externalId]?.avgRating })) || [])
            setSearchTotalPages(res.data.totalPages || 1)
        } catch (err) {
            console.error(err)
            setSearchResults([])
        } finally {
            setIsSearching(false)
        }
    }

    // Trigger search on page change
    useEffect(() => {
        if (searchPerformed && query.trim()) {
            handleSearch()
        }
    }, [page])

    // Reset page on query change
    useEffect(() => {
        if (query.trim()) setPage(1)
    }, [query])

    const getPageNumbers = () => {
        const effectiveTotalPages = searchPerformed ? searchTotalPages : totalPages
        if (effectiveTotalPages <= 7) return Array.from({ length: effectiveTotalPages }, (_, i) => i + 1)
        const s = new Set([1, effectiveTotalPages, page])
        if (page > 1) s.add(page - 1)
        if (page < effectiveTotalPages) s.add(page + 1)
        return [...s].sort((a, b) => a - b)
    }

    const pageNumbers = getPageNumbers()

    return (
        <div className="min-h-screen pb-20">
            <Helmet>
                <title>Discover TV Shows | QuestDuck</title>
            </Helmet>

            <section className="bg-[#111118] border-b border-[#2a2a35] pt-24 pb-12">
                <div className="max-w-[1200px] mx-auto px-5 md:px-10">
                    <SubSectionToggle 
                        current="tv"
                        type="cinema"
                        options={[
                            { label: 'Movies', value: 'movie', path: '/movies/discover', icon: Film },
                            { label: 'TV Shows', value: 'tv', path: '/tv/discover', icon: Tv }
                        ]}
                    />
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div className="max-w-xl">
                            <h1 className="font-black text-5xl md:text-6xl text-white uppercase mb-4" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Discover <span className="text-[#c8ff57]">{activeGenre ? activeGenre.label : 'Series'}</span>
                            </h1>
                            <p className="text-[#7a7a90] text-sm font-mono uppercase tracking-wider">
                                Browse thousands of TV shows by popularity and genres.
                            </p>
                        </div>

                        <form onSubmit={handleSearch} className="w-full md:w-96 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7a7a90] z-10" size={18} />
                            <input 
                                type="text"
                                placeholder="Search TV shows..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-xl pl-12 pr-32 py-4 text-white focus:outline-none focus:border-[#c8ff57] transition-all shadow-inner placeholder:text-[#7a7a90]"
                            />
                            {query && (
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
                {!searchPerformed && (
                    <>
                        <div className="flex items-center justify-between mb-8 border-b border-[#2a2a35] pb-4">
                            <span className="font-black text-2xl tracking-[2px] uppercase text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                BROWSE BY GENRE
                            </span>
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-8 gap-3 mb-16">
                            {genres.map(genre => {
                                const isActive = activeGenre?.id === genre.id
                                return (
                                    <div
                                        key={genre.id}
                                        onClick={() => { setActiveGenre(isActive ? null : genre); setPage(1); }}
                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer text-center group
                                            ${isActive ? 'bg-[#c8ff57]/10 border-[#c8ff57] scale-105' : 'bg-[#111118] border-[#2a2a35] hover:border-[#c8ff57] hover:-translate-y-1'}
                                        `}
                                    >
                                        <div className="text-2xl mb-2">{GENRE_EMOJIS[genre.label] || '📺'}</div>
                                        <div className={`font-black text-[11px] uppercase tracking-wider leading-tight ${isActive ? 'text-[#c8ff57]' : 'text-[#7a7a90] group-hover:text-white'}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {genre.label}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}

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
                            onClick={() => { setSearchPerformed(false); setActiveGenre(null); setQuery(''); setPage(1); }} 
                            className="text-[#7a7a90] hover:text-white font-mono text-[10px] uppercase tracking-widest transition-colors"
                        >
                            ✕ Clear Filter
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {loading || isSearching ? (
                        Array.from({ length: 24 }).map((_, i) => <GameCardSkeleton key={i} />)
                    ) : (searchPerformed ? searchResults : items).length > 0 ? (
                        (searchPerformed ? searchResults : items).map(item => (
                            <TVCard 
                                key={item.externalId} 
                                item={searchPerformed ? { ...item, ...libraryMap[item.externalId] } : { ...item, ...libraryMap[item.externalId], avgRating: discoverData?.stats?.[item.externalId]?.avgRating }} 
                            />
                        ))
                    ) : (
                        <div className="col-span-full py-24 text-center bg-[#111118] border border-[#2a2a35] border-dashed rounded-3xl">
                            <div className="text-5xl mb-6">🛸</div>
                            <h3 className="text-white font-black text-2xl uppercase mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>No series found</h3>
                            <p className="text-[#7a7a90] font-mono text-sm">Try exploring a different genre or search term</p>
                        </div>
                    )}
                </div>

                {/* ── Pagination ── */}
                {!loading && (searchPerformed ? searchTotalPages > 1 : totalPages > 1) && (
                    <div className="flex items-center justify-center gap-2 mt-16 flex-wrap">
                        <button
                            onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0, 400); }}
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
                                        onClick={() => { setPage(n); window.scrollTo(0, 400); }}
                                        className={`w-10 h-10 rounded border font-mono text-xs transition-all ${n === page ? 'bg-[#c8ff57]/10 border-[#c8ff57] text-[#c8ff57]' : 'bg-[#111118] border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57] hover:text-white'}`}
                                    >
                                        {n}
                                    </button>
                                </div>
                            )
                        })}

                        <button
                            onClick={() => { setPage(p => Math.min(searchPerformed ? searchTotalPages : totalPages, p + 1)); window.scrollTo(0, 400); }}
                            disabled={page === (searchPerformed ? searchTotalPages : totalPages)}
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

export default TVDiscover
