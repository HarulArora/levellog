import { useState, useRef, useMemo, useEffect, lazy, Suspense, memo, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import useCachedFetch from '../../hooks/useCachedFetch'
import { Trophy, Play, Star, ListChecks, X, Pause, Search, Flame, Plus, Tv, ChevronRight } from 'lucide-react'
import Skeleton, { GameCardSkeleton } from '../../components/ui/Skeleton'
import Toast from '../../components/ui/Toast'
import AvatarFrame from '../../components/ui/AvatarFrame'
import { useLeaderboard } from '../../context/LeaderboardContext'
import { Helmet } from 'react-helmet-async'
import SubSectionToggle from '../../components/ui/SubSectionToggle'

const BAR_THEMES = {
    1: 'bg-gradient-to-r from-[#ffd700]/15 to-[#111118] border-y-[#ffd700]/40 shadow-[0_0_40px_rgba(255,215,0,0.05)]',
    2: 'bg-gradient-to-r from-[#B9F2FF]/15 to-[#111118] border-y-[#B9F2FF]/30',
    3: 'bg-gradient-to-r from-[#cd7f32]/15 to-[#111118] border-y-[#cd7f32]/30',
    4: 'bg-gradient-to-r from-[#94999c]/15 to-[#111118] border-y-[#94999c]/30',
}

const MovieLogModal = lazy(() => import('../../components/movies/MovieLogModal'))

const RatingDisplay = memo(({ myRating, platformAvg, hasUser }) => {
    return (
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {myRating ? (
                <div className="flex items-center gap-1">
                    <span className="font-mono text-[9px] text-[#94a3b8] uppercase tracking-wider">me</span>
                    <div className="font-black text-lg text-[#c8ff57] leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {myRating}<small className="font-mono text-[9px] text-[#94a3b8] font-normal">/10</small>
                    </div>
                </div>
            ) : hasUser ? (
                <div className="font-mono text-[9px] text-[#3a3a4a] uppercase tracking-wider">not rated</div>
            ) : null}
            {platformAvg ? (
                <div className="flex items-center gap-1">
                    <span className="font-mono text-[9px] text-[#94a3b8] uppercase tracking-wider">avg</span>
                    <div className="font-black text-lg text-[#5c9fff] leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {platformAvg}<small className="font-mono text-[9px] text-[#94a3b8] font-normal">/10</small>
                    </div>
                </div>
            ) : null}
        </div>
    )
})

const HeroBanner = memo(({ movies }) => {
    const isMobile = window.innerWidth < 768
    const covers = useMemo(() => 
        movies.filter(m => m.cover).map(m => m.cover).filter((v, i, a) => a.indexOf(v) === i),
        [movies]
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
        const count = isMobile ? 6 : 10
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
                            src={tile.img} 
                            alt="TV Cover Mosaic" 
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
                            src={tile.img} 
                            alt="Trending TV Collection" 
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

function TVSearchBar({ id = 'tv-search' }) {
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
                const res = await api.get(`/movies/search?q=${encodeURIComponent(val)}&type=tv&limit=10`)
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
        navigate(`/tv/${item.externalId}`)
    }

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 pointer-events-none z-10">
                    <Search size={18} strokeWidth={2.5} />
                </span>
                <input
                    id={id}
                    type="text"
                    placeholder="Search any TV show..."
                    value={query}
                    onChange={handleChange}
                    className="w-full bg-[#111118] border border-[#2a2a35] rounded-lg
                                pl-11 pr-24 py-3.5 text-white text-sm
                                focus:outline-none focus:border-[#c8ff57]
                                placeholder:text-[#94999c] transition-all"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[#a0a0b8] pointer-events-none">
                    {loading ? <span className="text-[#c8ff57] animate-pulse font-bold">searching…</span> : 'QuestDuck'}
                </span>
            </div>

            {open && (
                <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-[60] bg-[#111118] border border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden">
                    {results.length > 0 ? (
                        <>
                                <div style={{ maxHeight: '256px', overflowY: 'auto' }} className="overscroll-contain">
                                    {results.map((item) => (
                                        <div
                                            key={item.externalId}
                                            onClick={() => handleSelect(item)}
                                            className="flex items-center gap-3 px-4 py-3 hover:bg-[#1a1a25] cursor-pointer border-b border-[#2a2a35] last:border-b-0 transition-colors group"
                                        >
                                            <div className="w-8 h-11 rounded bg-[#18181f] flex-shrink-0 overflow-hidden">
                                                {item.cover ? (
                                                    <img src={item.cover} alt={item.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-[#3a3a4a]">📺</div>
                                                )}
                                            </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white font-semibold text-sm truncate group-hover:text-[#c8ff57] transition-colors">
                                                {item.title}
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
                                ))}
                            </div>
                        </>
                    ) : !loading ? (
                        <div className="px-4 py-5 text-center font-mono text-xs text-[#7a7a90]">No TV shows found</div>
                    ) : (
                        <div className="px-4 py-5 text-center font-mono text-xs text-[#7a7a90] animate-pulse">Searching...</div>
                    )}
                </div>
            )}
        </div>
    )
}

function TVHome() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const { topUsers } = useLeaderboard()
    
    const [showAddModal, setShowAddModal] = useState(false)
    const [toast, setToast] = useState(null)
    const [userMovies, setUserMovies] = useState([])
    const [loadingLibrary, setLoadingLibrary] = useState(true)

    const showToast = useCallback((message, type = 'success') => setToast({ message, type }), [])

    useEffect(() => {
        const fetchLibrary = async () => {
            if (!user) { setLoadingLibrary(false); return }
            try {
                const res = await api.get('/movies/library')
                setUserMovies(res.data.library || [])
            } catch (err) { console.error(err) }
            finally { setLoadingLibrary(false) }
        }
        fetchLibrary()
    }, [user, location.key])

    const handleAddMovie = useCallback(async (data) => {
        setShowAddModal(false)
        try {
            const res = await api.post('/movies/log', data)
            if (res.data.success) {
                showToast(res.data.updated ? `"${data.title}" updated!` : `"${data.title}" added!`)
                const libRes = await api.get('/movies/library')
                setUserMovies(libRes.data.library || [])
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to log', 'error')
        }
    }, [showToast])

    const { data: homeData, loading, error, refetch: refetchHome } = useCachedFetch(
        'tv_home_v2',
        '/movies/home?type=tv',
        { ttl: 10 * 60 * 1000, deps: [location.key] }
    )
    
    const stats = homeData?.stats ?? {}

    const userStats = useMemo(() => {
        const filtered = userMovies.filter(m => (m.type || m.mediaType) === 'tv')
        return {
            total: filtered.length,
            watching: filtered.filter(m => m.status === 'playing').length,
            completed: filtered.filter(m => m.status === 'completed').length,
            planned: filtered.filter(m => m.status === 'planned').length,
            progress: filtered.reduce((s, m) => s + (m.episodesWatched || 0), 0),
            avgRating: filtered.filter(m => m.rating > 0).length > 0
                ? (filtered.filter(m => m.rating > 0).reduce((s, m) => s + m.rating, 0) / filtered.filter(m => m.rating > 0).length).toFixed(1)
                : '—'
        }
    }, [userMovies])

    const userRank = useMemo(() => {
        if (!user) return null
        return topUsers.find(tu => tu._id === (user.id || user._id))?.rank
    }, [topUsers, user])

    const recentMovies = useMemo(() => userMovies.filter(m => (m.type || m.mediaType) === 'tv').slice(0, 4), [userMovies])

    const statusConfig = useMemo(() => ({
        playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Watching' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
    }), [])

    const getMyRating = (externalId) => {
        if (!externalId || !user) return null
        const match = userMovies.find(m => String(m.externalId) === String(externalId))
        return match?.rating > 0 ? match.rating : null
    }

    const allMovies = useMemo(() => homeData?.sections?.flatMap(s => s.items) || [], [homeData])

    return (
        <div className="min-h-screen">
            <Helmet>
                <title>QuestDuck | Track TV Shows</title>
            </Helmet>

            <div className="md:hidden sticky top-[57px] z-40 bg-[#0d0d14]/95 backdrop-blur-sm border-b border-[#2a2a35] px-4 py-3 flex items-center gap-2">
                <div className="flex-1">
                    <TVSearchBar id="tv-search-mobile" />
                </div>
            </div>

            <section className="relative py-16 md:py-24 overflow-hidden min-h-[500px] flex items-center">
                {(allMovies.length > 0 || !loading) && <HeroBanner movies={allMovies} />}

                <div className="relative z-10 max-w-[1200px] mx-auto px-5 md:px-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                        <div>
                            <SubSectionToggle 
                                current="tv"
                                type="cinema"
                                options={[
                                    { label: 'Movies', value: 'movie', path: '/movies' },
                                    { label: 'TV Shows', value: 'tv', path: '/tv' }
                                ]}
                            />

                            <h1 className="font-black uppercase leading-none tracking-wide text-[#c8ff57] mb-2" style={{ fontSize: '14px', fontFamily: 'DM Mono, monospace', letterSpacing: '0.2em' }}>
                                Hatch Your Watchlist
                            </h1>
                            <h2 className="font-black uppercase leading-none tracking-wide text-white mb-6" style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', fontFamily: 'Bebas Neue, sans-serif' }}>
                                The TV<br />
                                <span className="text-[#c8ff57]">Pond.</span>
                            </h2>

                            <p className="text-[#a0a0b8] text-sm leading-relaxed mb-8 max-w-md">
                                Track every episode of your favorite TV series. 
                                Log progress, rate seasons, and see what's trending.
                            </p>
                            <div className="flex flex-wrap gap-3 mb-10">
                                {user ? (
                                    <>
                                        <button onClick={() => setShowAddModal(true)} className="btn-apple btn-apple-primary px-6 py-3 gap-1.5">
                                            <Plus size={16} strokeWidth={2.5} /> Log TV Show
                                        </button>
                                        <button onClick={() => navigate('/tv/library')} className="btn-apple btn-apple-secondary px-6 py-3 gap-1.5">
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

                            {user && userMovies.length > 0 ? (
                                <div className="flex gap-8">
                                    {[
                                        { value: userStats.total, label: '' },
                                        { value: userStats.progress, label: 'Episodes' },
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
                                        { value: '∞', label: 'Shows Indexed' },
                                        { value: 'Free', label: 'Forever' },
                                        { value: 'All', label: 'Networks' },
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
                                <TVSearchBar id="tv-search-desktop" />
                            </div>
                            <div className="border-t border-[#2a2a35] my-1" />

                            {recentMovies.length > 0 ? (
                                <>
                                    <div className="font-mono text-[10px] text-[#3a3a4a] uppercase tracking-widest">Recently Tracked</div>
                                    {recentMovies.map(item => {
                                        const sc = statusConfig[item.status] || statusConfig.planned
                                        return (
                                            <div key={item._id} onClick={() => navigate(`/tv/${item.externalId}`)} className="flex items-center gap-4 bg-[#111118]/80 border border-[#2a2a35] rounded-lg p-3 hover:border-[#c8ff57]/30 transition-all cursor-pointer">
                                                <div className="w-14 h-10 rounded bg-[#18181f] bg-cover bg-center flex-shrink-0" style={{ backgroundImage: `url(${item.cover})` }} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-white font-semibold text-sm truncate">{item.title}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-1 rounded-sm ${sc.bg} ${sc.color}`}>{sc.label}</span>
                                                        <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-1 rounded-sm bg-[#2a2a35] text-[#94999c]">TV Show</span>
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
                                    <div className="text-[#3a3a4a] font-mono text-xs uppercase tracking-widest">No history yet</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {user && (
                <section className={`border-y border-[#2a2a35] cursor-pointer hover:brightness-110 transition-all duration-500 ${BAR_THEMES[userRank] || 'bg-[#111118] hover:bg-[#18181f]'}`} onClick={() => navigate('/stats')}>
                    <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-5">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <div className="flex items-center gap-3">
                                <AvatarFrame userId={user?._id || user?.id} src={user?.avatar} size={42} className="home-stats-avatar" />
                                <div className="flex flex-col gap-1 min-w-0">
                                    <div className="text-white font-bold text-sm truncate">{user.username}</div>
                                    <div className="font-mono text-[10px] text-[#7a7a90]">@{user.username} · Viewer</div>
                                    <div className="flex items-center gap-2.5 mt-2">
                                        <div className="flex items-center gap-1.5 bg-[#0a0a0f]/60 rounded-full px-2.5 py-1 border border-[#2a2a35]">
                                            <span className="font-mono text-[10px] text-[#c8ff57] uppercase font-black tracking-widest leading-none">Lv.{user.level || 1}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="hidden sm:block w-px h-8 bg-[#2a2a35]" />
                            <div className="flex gap-8">
                                {[{ value: userStats.total, label: 'Total' }, { value: userStats.watching, label: 'Watching' }, { value: userStats.completed, label: 'Completed' }].map(stat => (
                                    <div key={stat.label}>
                                        <div className="font-black text-2xl text-white leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{stat.value}</div>
                                        <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            )}
            
            {error && (
                <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-12">
                    <div className="bg-[#1a1111] border border-red-500/20 rounded-xl p-10 text-center">
                        <div className="text-red-400 font-mono text-xs uppercase tracking-[0.2em] mb-4">Connection Error</div>
                        <h3 className="text-white font-black text-2xl uppercase mb-4" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            The TV Pond is Ripple-y
                        </h3>
                        <p className="text-[#7a7a90] text-sm max-w-md mx-auto mb-8 font-mono">
                            We're having trouble reaching the TV database. This is usually a temporary connection reset.
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
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                    {Array.from({ length: 6 }).map((_, j) => <GameCardSkeleton key={j} />)}
                                </div>
                            </div>
                        ))
                    ) : (
                        homeData?.sections?.map(section => (
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
                                    <div 
                                        onClick={() => navigate('/tv/discover')}
                                        className="flex items-center gap-2 text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest group-hover:text-white transition-colors cursor-pointer"
                                    >
                                        View More <ChevronRight size={14} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                    {section.items.map(item => (
                                        <div 
                                            key={item.externalId} 
                                            onClick={() => navigate(`/tv/${item.externalId}`)}
                                            className="group relative bg-[#111118] border border-[#2a2a35] rounded-xl overflow-hidden cursor-pointer hover:border-[#c8ff57] hover:-translate-y-1 transition-all duration-300 shadow-lg"
                                        >
                                            <div className="aspect-[3/4] relative overflow-hidden">
                                                {item.cover ? (
                                                    <img src={item.cover} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                ) : (
                                                    <div className="w-full h-full bg-[#18181f] flex items-center justify-center text-4xl">📺</div>
                                                )}

                                                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                                                    {stats[item.externalId]?.avgRating && (
                                                        <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded px-2 py-1 flex items-center gap-1.5 shadow-xl">
                                                            <Star size={10} className="text-[#5c9fff] fill-current" />
                                                            <span className="font-black text-xs text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{stats[item.externalId].avgRating}</span>
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
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <h3 className="text-white font-bold text-sm truncate group-hover:text-[#c8ff57] transition-colors">{item.title}</h3>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[10px] text-[#7a7a90]">{item.year}</span>
                                                    <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#2a2a35] text-[#94999c]">TV Show</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {showAddModal && (
                <Suspense fallback={null}>
                    <MovieLogModal onClose={() => setShowAddModal(false)} onAdd={handleAddMovie} items={userMovies} />
                </Suspense>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    )
}

export default TVHome
