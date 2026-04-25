import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Loader2 } from 'lucide-react'

// Using a more reliable way to handle the API key
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || 'dc6zaTOxFJmzC'

const GifPicker = ({ onSelect, onClose }) => {
    const [search, setSearch] = useState('')
    const [gifs, setGifs] = useState([])
    const [loading, setLoading] = useState(false)
    const [trending, setTrending] = useState([])
    const [error, setError] = useState(null)
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    
    const abortControllerRef = useRef(null)
    const searchTimeoutRef = useRef(null)
    const containerRef = useRef(null)
    const observerTarget = useRef(null)

    // Handle clicks outside to close
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    const fetchGifs = useCallback(async (query = '', isTrending = false, isLoadMore = false) => {
        if (!isLoadMore && abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        if (!isLoadMore) {
            setLoading(true)
            setOffset(0)
            setHasMore(true)
        }
        
        setError(null)
        const currentOffset = isLoadMore ? offset + 40 : 0
        abortControllerRef.current = new AbortController()

        const endpoint = isTrending ? 'trending' : 'search'
        const params = new URLSearchParams({
            api_key: GIPHY_API_KEY,
            limit: '40',
            offset: currentOffset.toString(),
            rating: 'pg-13', // Expanded rating for more results
            lang: 'en'
        })

        if (!isTrending) {
            params.append('q', query)
        }

        try {
            const res = await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${params.toString()}`, {
                signal: abortControllerRef.current.signal
            })
            
            if (res.status === 429) {
                setError('Rate limit reached. Try again in a bit.')
                return
            }

            if (!res.ok) throw new Error('Giphy API error')
            
            const data = await res.json()
            const results = data.data || []
            
            if (results.length < 40) setHasMore(false)

            if (isLoadMore) {
                setGifs(prev => [...prev, ...results])
                setOffset(currentOffset)
            } else {
                setGifs(results)
                if (isTrending) setTrending(results)
            }
            
        } catch (err) {
            if (err.name === 'AbortError') return
            console.error('Giphy error:', err)
            setError('Failed to load GIFs')
        } finally {
            if (!isLoadMore) setLoading(false)
        }
    }, [offset])

    // Initial fetch
    useEffect(() => {
        fetchGifs('', true)
    }, []) // Only on mount

    // Handle search with debounce
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        if (!search.trim()) {
            if (trending.length > 0) {
                setGifs(trending)
                setOffset(0)
                setHasMore(true)
                setLoading(false)
            } else {
                fetchGifs('', true)
            }
            return
        }

        searchTimeoutRef.current = setTimeout(() => {
            fetchGifs(search)
        }, 400)

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
        }
    }, [search, trending])

    // Intersection Observer for Infinite Scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loading && gifs.length > 0) {
                    fetchGifs(search, !search, true)
                }
            },
            { threshold: 0.1 }
        )

        if (observerTarget.current) {
            observer.observe(observerTarget.current)
        }

        return () => observer.disconnect()
    }, [hasMore, loading, gifs.length, search, fetchGifs])

    return (
        <div 
            ref={containerRef}
            className="gif-picker-container absolute bottom-full mb-3 right-0 w-80 bg-[#0d0d12] border border-[#2a2a35] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
            {/* Header / Search */}
            <div className="p-4 border-b border-[#2a2a35] bg-[#111118]/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 group">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search magic..."
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded-xl pl-10 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#c8ff57]/50 focus:ring-1 focus:ring-[#c8ff57]/20 transition-all placeholder:text-[#505060]"
                            autoFocus
                        />
                        <Search 
                            size={16} 
                            strokeWidth={2.5}
                            className={`absolute left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none transition-colors ${loading ? 'text-[#c8ff57]' : 'text-white'}`} 
                        />
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-[#7a7a90] hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="h-72 overflow-y-auto p-3 custom-scrollbar bg-[#0d0d12]">
                {loading && gifs.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 size={24} className="text-[#c8ff57] animate-spin opacity-40" />
                            <span className="text-[10px] font-mono text-[#505060] uppercase tracking-widest animate-pulse">Loading Gifs...</span>
                        </div>
                    </div>
                ) : error && gifs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-[#ff5c5c]/60">
                        <span className="text-xl">⚠️</span>
                        <span className="text-[10px] font-mono text-center px-4">{error}</span>
                        <button 
                            onClick={() => search ? fetchGifs(search) : fetchGifs('', true)}
                            className="text-[9px] underline hover:text-[#ff5c5c] transition-colors mt-2"
                        >
                            Try again
                        </button>
                    </div>
                ) : gifs.length === 0 && !loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-[#505060]">
                        <div className="w-12 h-12 rounded-full bg-[#18181f] flex items-center justify-center mb-1">
                            <Search size={20} className="opacity-20" />
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-widest">No results found</span>
                    </div>
                ) : (
                    <>
                        {!search && trending.length > 0 && (
                            <div className="flex items-center gap-1.5 mb-3 px-1">
                                <div className="w-1 h-1 rounded-full bg-[#c8ff57]" />
                                <span className="text-[10px] font-bold text-[#7a7a90] uppercase tracking-wider">Trending Now</span>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                            {gifs.map((gif, idx) => (
                                <button
                                    key={`${gif.id}-${idx}`}
                                    onClick={() => onSelect(gif.images.fixed_height.url)}
                                    className="relative aspect-video group overflow-hidden rounded-xl bg-[#18181f] border border-transparent hover:border-[#c8ff57]/30 transition-all"
                                >
                                    <img
                                        src={gif.images.fixed_height_downsampled?.url || gif.images.fixed_height_small.url}
                                        alt={gif.title}
                                        className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:rotate-1"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                        <span className="text-[8px] text-white/70 truncate font-mono uppercase tracking-tighter">
                                            {gif.title || 'View GIF'}
                                        </span>
                                    </div>
                                    <div className="absolute inset-0 bg-[#c8ff57]/5 opacity-0 group-active:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                        
                        {/* Load More Trigger */}
                        {hasMore && (
                            <div ref={observerTarget} className="py-4 flex justify-center">
                                <Loader2 size={16} className="text-[#c8ff57] animate-spin opacity-40" />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-[#0a0a0f] border-t border-[#2a2a35] flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c8ff57] animate-pulse" />
                    <span className="text-[9px] font-mono text-[#505060] uppercase tracking-tighter">API Live</span>
                </div>
                <span className="text-[9px] font-mono text-[#303040] uppercase tracking-tighter select-none">Powered by GIPHY</span>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes progress-indeterminate {
                    0% { transform: translateX(-100%); width: 30%; }
                    50% { transform: translateX(0%); width: 40%; }
                    100% { transform: translateX(100%); width: 30%; }
                }
                .animate-progress-indeterminate {
                    animation: progress-indeterminate 1.5s infinite linear;
                }
            `}} />
        </div>
    )
}

export default GifPicker


