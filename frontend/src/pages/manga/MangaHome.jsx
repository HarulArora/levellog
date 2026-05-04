import { useState, useRef, useMemo, useEffect, lazy, Suspense, memo, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { useSection } from '../../context/SectionState'
import useCachedFetch from '../../hooks/useCachedFetch'
import { Trophy, Play, Star, ListChecks, X, Pause, Search, BookOpen, Flame, Plus, Tv, ChevronRight } from 'lucide-react'
import Skeleton, { GameCardSkeleton } from '../../components/ui/Skeleton'
import Toast from '../../components/ui/Toast'
import AvatarFrame from '../../components/ui/AvatarFrame'
import { useLeaderboard } from '../../context/LeaderboardContext'
import { Helmet } from 'react-helmet-async'
import SubSectionToggle from '../../components/ui/SubSectionToggle'
import StatsBar from '../../components/ui/StatsBar'
import RecentActivityFeed from '../../components/ui/RecentActivityFeed'

const MangaCard = memo(({ item }) => {
    const navigate = useNavigate()
    
    const displayTitle = item.title_english || item.title

    return (
        <div 
            onClick={() => navigate(`/manga/${item.externalId}?type=manga`)}
            className="group relative bg-[#111118] border border-[#2a2a35] rounded-xl overflow-hidden cursor-pointer hover:border-[#c8ff57] hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
        >
            <div className="aspect-[3/4] relative overflow-hidden">
                {item.cover ? (
                    <img 
                        src={item.cover} 
                        alt={displayTitle} 
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    />
                ) : (
                    <div className="w-full h-full bg-[#18181f] flex items-center justify-center text-[#2a2a35]">
                        <BookOpen size={48} strokeWidth={1} />
                    </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d14] via-transparent to-transparent opacity-60" />
                
                <div className="absolute top-2 right-2 flex flex-col gap-1.5 items-end z-10">
                    {Number(item.avgRating) > 0 && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#5c9fff]/30 rounded px-2 py-1 flex items-center gap-1.5 shadow-xl">
                            <Star size={10} className="text-[#5c9fff] fill-[#5c9fff]" />
                            <span className="font-black text-xs text-[#5c9fff]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.avgRating}</span>
                        </div>
                    )}
                    {Number(item.myRating) > 0 && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#c8ff57]/30 rounded px-2 py-1 flex items-center gap-1.5 shadow-xl">
                            <span className="font-mono text-[8px] text-[#c8ff57] uppercase font-bold">ME</span>
                            <span className="font-black text-xs text-[#c8ff57]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.myRating}</span>
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
                    {displayTitle}
                </h3>
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">{item.year || 'TBA'}</span>
                    <span className="w-1 h-1 rounded-full bg-[#3a3a4a]" />
                    <span className="font-mono text-[9px] text-[#c8ff57] uppercase tracking-widest truncate">
                        {item.genres?.[0] || 'Manga'}
                    </span>
                </div>
            </div>
        </div>
    )
})



const AnimeLogModal = lazy(() => import('../../components/anime/AnimeLogModal'))





const HeroBanner = memo(({ animes }) => {
    const isMobile = window.innerWidth < 768
    const getSmallCover = (url) => {
        if (!url) return url;
        if (url.includes('myanimelist.net')) return url.replace('l.webp', '.webp').replace('l.jpg', '.jpg');
        return url;
    }

    const covers = useMemo(() => {
        if (!Array.isArray(animes)) return []
        return [...new Set(animes.filter(a => a?.cover).map(a => getSmallCover(a.cover)))]
    }, [animes])

    
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
                <div className="flex gap-3 items-end will-change-transform" style={{ animation: `mosaicLeft ${isMobile ? '25s' : '40s'} linear infinite`, width: 'max-content', backfaceVisibility: 'hidden' }}>
                    {(Array.isArray(row1Tiles) ? [...row1Tiles, ...row1Tiles] : []).map((tile, i) => (
                        <img 
                            key={i} 
                            src={tile.img} 
                            alt="Trending Manga Collection" 
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
                    {(Array.isArray(row2Tiles) ? [...row2Tiles, ...row2Tiles] : []).map((tile, i) => (
                        <img 
                            key={i} 
                            src={tile.img} 
                            alt="Trending Manga Collection" 
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

function MangaSearchBar({ id = 'manga-search' }) {
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
                const res = await api.get(`/anime/search?q=${encodeURIComponent(val)}&type=manga&limit=10`)
                setResults(res.data.results || [])
            } catch {
                setResults([])
            } finally {
                setLoading(false)
            }
        }, 350)
    }

    const handleSelect = (item) => {
        setQuery('')
        setResults([])
        setOpen(false)
        navigate(`/manga/${item.externalId}`)
    }

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a90] pointer-events-none z-10">
                    <Search size={18} strokeWidth={2.5} />
                </span>
                <input
                    id={id}
                    type="text"
                    placeholder="Search any manga..."
                    value={query}
                    onChange={handleChange}
                    className="w-full bg-[#111118] border border-[#2a2a35] rounded-xl
                                pl-12 pr-32 py-4 text-white text-sm
                                focus:outline-none focus:border-[#c8ff57]
                                placeholder:text-[#94999c] transition-all shadow-inner"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[#a0a0b8] pointer-events-none">
                    {loading ? <span className="text-[#c8ff57] animate-pulse font-bold">searching…</span> : 'QuestDuck'}
                </span>
            </div>

            {open && (
                <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-[60] bg-[#111118] border border-[#2a2a35] rounded-2xl shadow-2xl overflow-hidden">
                    {results.length > 0 ? (
                        <>
                                <div style={{ maxHeight: '256px', overflowY: 'auto' }} className="overscroll-contain">
                                    {(results || []).map((item) => {
                                        const displayTitle = item.title_english || item.title
                                        return (
                                            <div
                                                key={item.externalId}
                                                onClick={() => handleSelect(item)}
                                                className="flex items-center gap-3 px-4 py-3 hover:bg-[#1a1a25] cursor-pointer border-b border-[#2a2a35] last:border-b-0 transition-colors group"
                                            >
                                                <div className="w-8 h-11 rounded bg-[#18181f] flex-shrink-0 overflow-hidden">
                                                    {item.cover ? (
                                                        <img src={item.cover} alt={displayTitle} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[#3a3a4a]">
                                                            <BookOpen size={14} />
                                                        </div>
                                                    )}
                                                </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-semibold text-sm truncate group-hover:text-[#c8ff57] transition-colors">
                                                    {displayTitle}
                                                </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {item.year && (
                                                    <span className="font-mono text-[10px] text-[#7a7a90]">{item.year}</span>
                                                )}
                                                {item.genres?.[0] && (
                                                    <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-1 rounded-sm bg-[#2a2a35] text-[#94999c]">
                                                        {item.genres[0]}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-[#3a3a4a] group-hover:text-[#c8ff57] transition-colors flex-shrink-0">→</span>
                                    </div>
                                )})}
                            </div>
                        </>
                    ) : !loading ? (
                        <div className="px-4 py-5 text-center font-mono text-xs text-[#7a7a90]">No manga found</div>
                    ) : (
                        <div className="px-4 py-5 text-center font-mono text-xs text-[#7a7a90] animate-pulse">Searching...</div>
                    )}
                </div>
            )}
        </div>
    )
}

function MangaHome() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const { topUsers } = useLeaderboard()
    const { setAnimeSubSection } = useSection()

    useEffect(() => {
        setAnimeSubSection('manga')
    }, [setAnimeSubSection])
    
    const [showAddModal, setShowAddModal] = useState(false)
    const [toast, setToast] = useState(null)
    const [userAnime, setUserAnime] = useState([])

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }, [])

    // ── Fetch user library ──
    useEffect(() => {
        const fetchLibrary = async () => {
            if (!user) return
            try {
                const res = await api.get('/anime/library')
                setUserAnime(res.data.library || [])
            } catch (err) { console.error(err) }
        }
        fetchLibrary()
    }, [user, location.key])

    const handleAddAnime = useCallback(async (data) => {
        setShowAddModal(false)
        try {
            const res = await api.post('/anime/log', data)
            if (res.data.success) {
                showToast(res.data.updated ? `"${data.title}" updated!` : `"${data.title}" added!`)
                // Refresh local list
                const libRes = await api.get('/anime/library')
                setUserAnime(libRes.data.library || [])
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to log', 'error')
        }
    }, [showToast])

    const { data: homeData, loading, error, refetch: refetchHome } = useCachedFetch(
        'manga_home_manga',
        '/anime/home?type=manga',
        { ttl: 10 * 60 * 1000 }
    )



    const sections = useMemo(() => homeData?.sections || [], [homeData?.sections])

    const userStats = useMemo(() => {
        const filtered = userAnime.filter(a => (a.type || a.mediaType) === 'manga')
        return {
            total: filtered.length,
            watching: filtered.filter(a => a.status === 'playing').length,
            completed: filtered.filter(a => a.status === 'completed').length,
            planned: filtered.filter(a => a.status === 'planned').length,
            progress: filtered.reduce((s, a) => s + (a.chaptersRead || 0), 0),
            avgRating: filtered.filter(a => a.rating > 0).length > 0
                ? (filtered.filter(a => a.rating > 0).reduce((s, a) => s + a.rating, 0) / filtered.filter(a => a.rating > 0).length).toFixed(1)
                : '—'
        }
    }, [userAnime])

    const getMyRating = useCallback((externalId) => {
        if (!user) return null
        const match = userAnime.find(a => String(a.externalId) === String(externalId) && (a.type === 'manga' || a.mediaType === 'manga'))
        return match?.rating > 0 ? match.rating : null
    }, [user, userAnime])

    const userRank = useMemo(() => {
        if (!user) return null
        return topUsers.find(tu => tu._id === (user.id || user._id))?.rank
    }, [topUsers, user])

    const recentAnime = useMemo(() => userAnime.filter(a => (a.type || a.mediaType) === 'manga').slice(0, 4), [userAnime])

    const statusConfig = useMemo(() => ({
        playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Reading' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
    }), [])

    const allManga = useMemo(() => {
        if (!Array.isArray(sections)) return []
        return sections.flatMap(s => Array.isArray(s.items) ? s.items : [])
    }, [sections])

    return (
        <div className="min-h-screen">
            <Helmet>
                <title>QuestDuck | Track Manga</title>
            </Helmet>

            {/* Mobile Search */}
            <div className="md:hidden sticky top-[57px] z-40 bg-[#0d0d14]/95 backdrop-blur-sm border-b border-[#2a2a35] px-4 py-3 flex items-center gap-2">
                <div className="flex-1">
                    <MangaSearchBar id="manga-search-mobile" />
                </div>
            </div>

            {/* Hero */}
            <section className="relative pt-20 pb-16 md:pt-24 md:pb-24 overflow-hidden min-h-[600px] flex items-center">
                {(allManga.length > 0 || !loading) && <HeroBanner animes={allManga} />}

                <div className="relative z-10 max-w-[1200px] mx-auto px-5 md:px-10 w-full">
                    <SubSectionToggle 
                         current="manga"
                         type="anime"
                         options={[
                             { label: 'Anime', value: 'anime', path: '/anime', icon: Tv },
                             { label: 'Manga', value: 'manga', path: '/manga', icon: BookOpen }
                         ]}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                        <div>

                            <h1 className="font-black uppercase leading-none tracking-wide text-[#c8ff57] mb-2" style={{ fontSize: '14px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.2em' }}>
                                Hatch Your Collection
                            </h1>
                            <h2 className="font-black uppercase leading-none tracking-wide text-white mb-6" style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', fontFamily: 'Bebas Neue, sans-serif' }}>
                                The Manga<br />
                                <span className="text-[#c8ff57]">Shelf.</span>
                            </h2>

                            <p className="text-[#a0a0b8] text-sm leading-relaxed mb-8 max-w-md">
                                Track every volume and chapter of your favorite manga series. 
                                Rate titles, manage your backlog, and discover what to read next.
                            </p>



                            <div className="flex flex-wrap gap-3 mb-10">
                                {user ? (
                                    <>
                                        <button onClick={() => setShowAddModal(true)} className="btn-apple btn-apple-primary px-6 py-3 gap-1.5">
                                            <Plus size={16} strokeWidth={2.5} /> Log Manga
                                        </button>
                                        <button onClick={() => navigate('/manga/library')} className="btn-apple btn-apple-secondary px-6 py-3 gap-1.5">
                                            My Library →
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <Link to="/signup">
                                            <button className="btn-apple btn-apple-primary px-8 py-4 w-full sm:w-auto text-sm">
                                                Get Started Free
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

                            {user && userAnime.length > 0 ? (
                                <div className="flex gap-8">
                                    {[
                                        { value: userStats.total, label: 'Items' },
                                        { value: userStats.progress, label: 'Chapters' },
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
                                        { value: '∞', label: 'Indexed' },
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

                        <div className="hidden md:flex flex-col gap-3">
                            <div className="mb-1">
                                <MangaSearchBar id="manga-search-desktop" />
                            </div>
                            <div className="border-t border-[#2a2a35] my-1" />

                            {recentAnime.length > 0 ? (
                                <>
                                    <div className="font-mono text-[10px] text-[#3a3a4a] uppercase tracking-widest">Recent Activity</div>
                                    {(recentAnime || []).map(item => {
                                        const sc = statusConfig[item.status] || statusConfig.planned
                                        return (
                                            <div key={item._id} onClick={() => navigate(`/manga/${item.externalId}?type=manga`)} className="flex items-center gap-4 bg-[#111118]/80 border border-[#2a2a35] rounded-lg p-3 hover:border-[#c8ff57]/30 transition-all cursor-pointer">
                                                <div className="w-14 h-10 rounded bg-[#18181f] bg-cover bg-center flex-shrink-0" style={{ backgroundImage: `url(${item.cover || item.coverImage})` }} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-white font-semibold text-sm truncate">
                                                        {item.title_english || item.title}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-1 rounded-sm ${sc.bg} ${sc.color}`}>{sc.label}</span>
                                                        <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-1 rounded-sm bg-[#2a2a35] text-[#94999c]">{item.type || item.mediaType}</span>
                                                    </div>
                                                </div>
                                                {item.rating > 0 && (
                                                    <div className="font-black text-xl text-[#c8ff57] flex-shrink-0" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.rating}<small className="font-mono text-[9px] text-[#7a7a90] font-normal">/10</small></div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </>
                            ) : (
                                <div className="p-10 border border-dashed border-[#2a2a35] rounded-lg text-center">
                                    <div className="text-[#3a3a4a] font-mono text-xs uppercase tracking-widest">No activity yet</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            <StatsBar 
                user={user} 
                userRank={userRank} 
                mediaType="manga"
                stats={{
                    total: userStats.total,
                    active: userStats.watching,
                    completed: userStats.completed,
                    planned: userStats.planned
                }}
            />

            {error && (
                <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-12">
                    <div className="bg-[#1a1111] border border-red-500/20 rounded-xl p-10 text-center">
                        <div className="text-red-400 font-mono text-xs uppercase tracking-[0.2em] mb-4">Connection Error</div>
                        <h3 className="text-white font-black text-2xl uppercase mb-4" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            The Scroll Pond is Ripple-y
                        </h3>
                        <p className="text-[#7a7a90] text-sm max-w-md mx-auto mb-8 font-mono">
                            We're having trouble reaching the Jikan database. This is usually due to high traffic or connection reset.
                        </p>
                        <button 
                            onClick={() => refetchHome()}
                            className="bg-white text-black px-8 py-3 rounded font-black uppercase text-xs tracking-widest hover:bg-[#c8ff57] transition-all"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}

            {/* Grid Sections (Discover Style) */}
            <div className="max-w-[1200px] mx-auto px-5 md:px-10 mt-12 mb-20">
                <div className="flex flex-col gap-20">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i}>
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 bg-[#111118] border border-[#2a2a35] rounded-lg animate-pulse" />
                                    <div className="w-48 h-8 bg-[#111118] border border-[#2a2a35] rounded animate-pulse" />
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                    {Array.from({ length: 6 }).map((_, j) => <GameCardSkeleton key={j} />)}
                                </div>
                            </div>
                        ))
                    ) : (
                        (sections || []).map(section => (
                            <div key={section.title}>
                                <div className="flex items-center justify-between mb-8 group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-[#111118] border border-[#2a2a35] rounded-lg text-[#c8ff57] group-hover:bg-[#c8ff57] group-hover:text-black transition-all duration-300 shadow-lg">
                                            {section.title.toLowerCase().includes('trending') ? <Flame size={20} /> : 
                                             section.title.toLowerCase().includes('top') ? <Trophy size={20} /> : 
                                             <Star size={20} />}
                                        </div>
                                        <h2 className="font-black text-2xl uppercase text-white tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {section.title}
                                        </h2>
                                    </div>
                                    <div 
                                        onClick={() => {
                                            const lowerTitle = section.title.toLowerCase();
                                            const type = lowerTitle.includes('trending') ? 'trending' : 
                                                         (lowerTitle.includes('top') || lowerTitle.includes('popular')) ? 'top_rated' : 'coming_soon';
                                            navigate(`/explore/manga/${type}`);
                                        }}
                                        className="flex items-center gap-2 text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest group-hover:text-white transition-colors cursor-pointer"
                                    >
                                        Explore All <ChevronRight size={14} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                    {(section.items || []).slice(0, 15).map((item, idx) => (
                                        <MangaCard 
                                            key={`${section.title}-${item.externalId}-${idx}`} 
                                            item={{ 
                                                ...item, 
                                                avgRating: homeData?.stats?.[item.externalId]?.avgRating,
                                                myRating: getMyRating(item.externalId)
                                            }} 
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <RecentActivityFeed defaultMedia="manga" />

            {showAddModal && (
                <Suspense fallback={null}>
                    <AnimeLogModal onClose={() => setShowAddModal(false)} onAdd={handleAddAnime} items={userAnime} />
                </Suspense>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    )
}

export default MangaHome

