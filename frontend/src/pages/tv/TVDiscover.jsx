import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Flame, Star, Trophy, ChevronRight } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import api from '../../api/axios'
import useCachedFetch from '../../hooks/useCachedFetch'
import { GameCardSkeleton } from '../../components/ui/Skeleton'
import SubSectionToggle from '../../components/ui/SubSectionToggle'

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
                
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    {item.avgRating && (
                        <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded px-2 py-1 flex items-center gap-1.5 shadow-xl">
                            <Star size={10} className="text-[#5c9fff] fill-current" />
                            <span className="font-black text-xs text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.avgRating}</span>
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
                        {item.genres?.[0] || 'TV Show'}
                    </span>
                </div>
            </div>
        </div>
    )
})

function TVDiscover() {
    const navigate = useNavigate()
    const location = useLocation()
    
    const [activeGenre, setActiveGenre] = useState(null)
    const [genres, setGenres] = useState([])
    const [genreItems, setGenreItems] = useState([])
    const [loadingGenre, setLoadingGenre] = useState(false)
    const [totalCount, setTotalCount] = useState(0)
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

    const fetchByGenre = useCallback(async (genreId) => {
        setLoadingGenre(true)
        setSearchPerformed(false)
        try {
            const res = await api.get(`/movies/discover?type=tv&genre=${genreId}`)
            setGenreItems(res.data.items.map(i => ({ ...i, avgRating: res.data.stats[i.externalId]?.avgRating })) || [])
            setTotalCount(res.data.total || 0)
        } catch (err) {
            console.error(err)
            setGenreItems([])
        } finally {
            setLoadingGenre(false)
        }
    }, [])

    useEffect(() => {
        if (activeGenre) fetchByGenre(activeGenre.id)
    }, [activeGenre, fetchByGenre])

    const { data: discoverData, loading } = useCachedFetch(
        'tv_discover_v2',
        '/movies/discover?type=tv',
        { ttl: 10 * 60 * 1000 }
    )

    const sections = discoverData?.sections ?? []

    const handleSearch = async (e) => {
        e?.preventDefault()
        if (!query.trim()) return
        
        setIsSearching(true)
        setSearchPerformed(true)
        setActiveGenre(null)
        try {
            const res = await api.get(`/movies/search?q=${encodeURIComponent(query)}&type=tv&limit=24`)
            setSearchResults(res.data.results.map(r => ({ ...r, avgRating: res.data.stats[r.externalId]?.avgRating })) || [])
        } catch (err) {
            console.error(err)
            setSearchResults([])
        } finally {
            setIsSearching(false)
        }
    }

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
                            { label: 'Movies', value: 'movie', path: '/movies/discover' },
                            { label: 'TV Shows', value: 'tv', path: '/tv/discover' }
                        ]}
                    />
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div className="max-w-xl">
                            <h1 className="font-black text-5xl md:text-6xl text-white uppercase mb-4" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Discover <span className="text-[#c8ff57]">Series</span>
                            </h1>
                            <p className="text-[#7a7a90] text-sm font-mono uppercase tracking-wider">
                                Browse trending and popular TV shows from all networks.
                            </p>
                        </div>

                        <form onSubmit={handleSearch} className="w-full md:w-96 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7a7a90]" size={18} />
                            <input 
                                type="text"
                                placeholder="Search TV Shows..."
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

                    {/* Genre Browsing */}
                    <div className="mt-12 flex flex-wrap gap-2">
                        <button
                            onClick={() => setActiveGenre(null)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!activeGenre && !searchPerformed ? 'bg-[#c8ff57] text-black shadow-[0_0_20px_rgba(200,255,87,0.2)]' : 'bg-[#1a1a25] text-[#7a7a90] hover:text-white border border-white/5'}`}
                            style={{ fontFamily: 'DM Mono, monospace' }}
                        >
                            All
                        </button>
                        {genres.map(genre => (
                            <button
                                key={genre.id}
                                onClick={() => { setActiveGenre(genre); setSearchPerformed(false); }}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeGenre?.id === genre.id ? 'bg-[#c8ff57] text-black shadow-[0_0_20px_rgba(200,255,87,0.2)]' : 'bg-[#1a1a25] text-[#7a7a90] hover:text-white border border-white/5'}`}
                                style={{ fontFamily: 'DM Mono, monospace' }}
                            >
                                {genre.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <div className="max-w-[1200px] mx-auto px-5 md:px-10 mt-12">
                {(searchPerformed || activeGenre) ? (
                    <div>
                        <div className="flex items-center justify-between mb-8 border-b border-[#2a2a35] pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#c8ff57]/10 rounded-lg">
                                    {searchPerformed ? <Search size={20} className="text-[#c8ff57]" /> : <Star size={20} className="text-[#c8ff57]" />}
                                </div>
                                <h2 className="font-black text-2xl uppercase text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {searchPerformed ? `Results for "${query}"` : activeGenre.label.toUpperCase()}
                                </h2>
                                {!searchPerformed && totalCount > 0 && (
                                    <span className="font-mono text-[10px] text-[#7a7a90] mt-1">{totalCount.toLocaleString()}</span>
                                )}
                            </div>
                            <button onClick={() => { setSearchPerformed(false); setActiveGenre(null); setQuery(''); }} className="text-[#7a7a90] hover:text-white font-mono text-[10px] uppercase tracking-widest">
                                ✕ Clear
                            </button>
                        </div>

                        {(isSearching || loadingGenre) ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {Array.from({ length: 12 }).map((_, i) => <GameCardSkeleton key={i} />)}
                            </div>
                        ) : (searchPerformed ? searchResults : genreItems).length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {(searchPerformed ? searchResults : genreItems).map(item => <TVCard key={item.externalId} item={item} />)}
                            </div>
                        ) : (
                            <div className="py-20 text-center bg-[#111118] border border-[#2a2a35] border-dashed rounded-2xl">
                                <div className="text-4xl mb-4">👽</div>
                                <h3 className="text-white font-bold mb-2">No results found</h3>
                                <p className="text-[#7a7a90] text-sm">Try exploring other categories</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-16">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i}>
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="w-10 h-10 bg-[#111118] border border-[#2a2a35] rounded-lg animate-pulse" />
                                        <div className="w-48 h-8 bg-[#111118] border border-[#2a2a35] rounded animate-pulse" />
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                        {Array.from({ length: 6 }).map((_, j) => <GameCardSkeleton key={j} />)}
                                    </div>
                                </div>
                            ))
                        ) : (
                            sections.map(section => (
                                <div key={section.title}>
                                    <div className="flex items-center justify-between mb-8 group">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-[#111118] border border-[#2a2a35] rounded-lg text-[#c8ff57] group-hover:bg-[#c8ff57] group-hover:text-black transition-all duration-300 shadow-lg">
                                                {section.title.toLowerCase().includes('trending') ? <Flame size={20} /> : 
                                                 section.title.toLowerCase().includes('popular') ? <Trophy size={20} /> : 
                                                 <Star size={20} />}
                                            </div>
                                            <h2 className="font-black text-2xl uppercase text-white tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                {section.title}
                                            </h2>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                        {section.items.map(item => (
                                            <TVCard 
                                                key={item.externalId} 
                                                item={{ ...item, avgRating: discoverData?.stats?.[item.externalId]?.avgRating }} 
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default TVDiscover
