import { useState, useMemo, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGamesContext } from '../context/GamesContext'
import { Target, Heart, Search, Gamepad2, TrendingUp, Trophy, Star, Sparkles, Flame, Diamond, Crown, Rocket, Zap, Clock, BarChart3, Check, X, Film, BookOpen, Tv as TvIcon, Play } from 'lucide-react'
import Shuriken from '../components/ui/Shuriken'
import { getLevelInfo, getXPProgress, LEVELS } from '../utils/levels'
import AvatarFrame from '../components/ui/AvatarFrame'
import { useLeaderboard } from '../context/LeaderboardContext'
import api from '../api/axios'

const HEADER_THEMES = {
    1: { bg: 'from-[#ffd700]/15', border: 'border-b-[#ffd700]/30', accent: 'text-[#ffd700]', glow: 'shadow-[0_4px_30px_rgba(255,215,0,0.1)]' },
    2: { bg: 'from-[#B9F2FF]/15', border: 'border-b-[#B9F2FF]/30', accent: 'text-[#B9F2FF]', glow: 'shadow-[0_4px_30px_rgba(185,242,255,0.1)]' },
    3: { bg: 'from-[#cd7f32]/15', border: 'border-b-[#cd7f32]/30', accent: 'text-[#cd7f32]', glow: 'shadow-[0_4px_30px_rgba(205,127,50,0.1)]' },
    4: { bg: 'from-[#94999c]/15', border: 'border-b-[#94999c]/30', accent: 'text-[#94999c]', glow: 'shadow-[0_4px_30px_rgba(148,153,156,0.1)]' },
}

// ── Constants ─────────────────────────────────────────────────────────────────

function Stats() {
    const { user, loading: authLoading } = useAuth()
    const { games, loading: gamesLoading } = useGamesContext()
    const { topUsers } = useLeaderboard()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'stats')
    const [mediaType, setMediaType] = useState(searchParams.get('media') || 'game')
    const [mediaData, setMediaData] = useState({
        anime: [],
        manga: [],
        movie: [],
        tv: []
    })
    const [mediaLoading, setMediaLoading] = useState(false)

    useEffect(() => {
        const tab = searchParams.get('tab')
        if (tab && (tab === 'stats' || tab === 'xp')) {
            setActiveTab(tab)
        }
        const media = searchParams.get('media')
        if (media && ['game', 'anime', 'manga', 'movie', 'tv'].includes(media)) {
            setMediaType(media)
        }
    }, [searchParams])

    const fetchMediaData = async (type) => {
        if (type === 'game' || mediaData[type].length > 0) return
        try {
            setMediaLoading(true)
            const endpoint = (type === 'movie' || type === 'tv') ? '/movies/library' : '/anime/library'
            const res = await api.get(endpoint)
            const allItems = res.data.library || []
            
            if (type === 'movie' || type === 'tv') {
                setMediaData(prev => ({
                    ...prev,
                    movie: allItems.filter(i => i.type === 'movie'),
                    tv: allItems.filter(i => i.type === 'tv')
                }))
            } else {
                setMediaData(prev => ({
                    ...prev,
                    anime: allItems.filter(i => i.type === 'anime'),
                    manga: allItems.filter(i => i.type === 'manga')
                }))
            }
        } catch (err) {
            console.error(`Failed to fetch ${type} stats:`, err)
        } finally {
            setMediaLoading(false)
        }
    }

    useEffect(() => {
        if (user && activeTab === 'stats' && mediaType !== 'game') {
            fetchMediaData(mediaType)
        }
    }, [user, activeTab, mediaType])

    const handleMediaTypeChange = (type) => {
        setMediaType(type)
        const params = { tab: activeTab, media: type }
        setSearchParams(params)
    }

    const currentData = useMemo(() => {
        if (mediaType === 'game') return games
        return mediaData[mediaType] || []
    }, [mediaType, games, mediaData])

    const handleTabChange = (tab) => {
        setActiveTab(tab)
        setSearchParams({ tab })
    }

    const xp = user?.xp || 0
    const { current: currentLevel, next: nextLevel } = useMemo(() => getLevelInfo(xp), [xp])
    const xpProgress = useMemo(() => getXPProgress(xp), [xp])

    const mediaLabel = useMemo(() => ({
        game: 'Games',
        anime: 'Anime',
        manga: 'Manga',
        movie: 'Movies',
        tv: 'TV Shows'
    })[mediaType] || 'Items', [mediaType])

    const mediaLabelSingular = useMemo(() => ({
        game: 'Game',
        anime: 'Anime',
        manga: 'Manga',
        movie: 'Movie',
        tv: 'TV Show'
    })[mediaType] || 'Item', [mediaType])

    const userRank = useMemo(() => {
        if (!user) return null
        return topUsers.find(tu => tu._id === (user?._id || user?.id))?.rank
    }, [topUsers, user])
    
    const theme = HEADER_THEMES[userRank] || null

    // ── Computed stats ──
    const { totalItems, totalUnits, ratedItems, avgRating, completed, playing, planned, dropped, paused, completionRate, unitLabel } = useMemo(() => {
        const totalItems = currentData.length
        
        let totalUnits = 0
        let unitLabel = 'Hours'
        
        if (mediaType === 'game') {
            totalUnits = currentData.reduce((s, g) => s + (g.hours || 0), 0)
            unitLabel = 'Hours'
        } else if (mediaType === 'anime') {
            totalUnits = currentData.reduce((s, g) => s + (g.episodesWatched || 0), 0)
            unitLabel = 'Episodes'
        } else if (mediaType === 'manga') {
            totalUnits = currentData.reduce((s, g) => s + (g.chaptersRead || 0), 0)
            unitLabel = 'Chapters'
        } else if (mediaType === 'movie') {
            totalUnits = currentData.reduce((s, g) => s + (g.runtime || 0), 0)
            unitLabel = 'Minutes'
        } else if (mediaType === 'tv') {
            totalUnits = currentData.reduce((s, g) => s + (g.episodesWatched || 0), 0)
            unitLabel = 'Episodes'
        }

        const ratedItems = currentData.filter(g => g.rating > 0)
        const avgRating = ratedItems.length > 0
            ? (ratedItems.reduce((s, g) => s + g.rating, 0) / ratedItems.length).toFixed(1)
            : '—'
            
        const normalizeStatus = (status) => {
            if (['playing', 'watching'].includes(status)) return 'playing'
            if (['completed', 'watched'].includes(status)) return 'completed'
            if (['planned', 'plan_to_watch'].includes(status)) return 'planned'
            if (['paused', 'on_hold', 'on-hold'].includes(status)) return 'paused'
            if (status === 'dropped') return 'dropped'
            return 'planned'
        }

        const completed = currentData.filter(g => normalizeStatus(g.status) === 'completed').length
        const playing = currentData.filter(g => normalizeStatus(g.status) === 'playing').length
        const planned = currentData.filter(g => normalizeStatus(g.status) === 'planned').length
        const dropped = currentData.filter(g => normalizeStatus(g.status) === 'dropped').length
        const paused = currentData.filter(g => normalizeStatus(g.status) === 'paused').length
        const completionRate = totalItems > 0
            ? Math.round((completed / totalItems) * 100)
            : 0

        return { totalItems, totalUnits, ratedItems, avgRating, completed, playing, planned, dropped, paused, completionRate, unitLabel }
    }, [currentData, mediaType])

    const memberYear = user?.createdAt
        ? new Date(user.createdAt).getFullYear()
        : new Date().getFullYear()

    // ── Genre breakdown ──
    const { genreList, maxGenreCount } = useMemo(() => {
        const genreMap = {}
        currentData.forEach(item => {
            const genre = item.genre || 'Unknown'
            genreMap[genre] = (genreMap[genre] || 0) + 1
        })
        const genreList = Object.entries(genreMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
        const maxGenreCount = genreList[0]?.[1] || 1
        return { genreList, maxGenreCount }
    }, [currentData])

    // ── Platform breakdown ──
    const { platformList, maxPlatformCount } = useMemo(() => {
        if (mediaType !== 'game') return { platformList: [], maxPlatformCount: 1 }
        const platformMap = {}
        currentData.forEach(game => {
            game.platforms?.forEach(p => {
                platformMap[p] = (platformMap[p] || 0) + 1
            })
        })
        const platformList = Object.entries(platformMap)
            .sort((a, b) => b[1] - a[1])
        const maxPlatformCount = platformList[0]?.[1] || 1
        return { platformList, maxPlatformCount }
    }, [currentData, mediaType])

    // ── Rating distribution ──
    const { ratingBuckets, maxRatingCount } = useMemo(() => {
        const buckets = { '9-10': 0, '7-8': 0, '5-6': 0, '1-4': 0 }
        ratedItems.forEach(g => {
            if (g.rating >= 9) buckets['9-10']++
            else if (g.rating >= 7) buckets['7-8']++
            else if (g.rating >= 5) buckets['5-6']++
            else buckets['1-4']++
        })
        const maxRatingCount = Math.max(...Object.values(buckets), 1)
        return { ratingBuckets: buckets, maxRatingCount }
    }, [ratedItems])

    // ── Most played genre (by units) ──
    const { genreUnitsList, maxGenreUnits } = useMemo(() => {
        const genreUnitsMap = {}
        currentData.forEach(item => {
            const genre = item.genre || 'Unknown'
            let val = 0
            if (mediaType === 'game') val = item.hours || 0
            else if (mediaType === 'movie') val = item.runtime || 0
            else if (mediaType === 'manga') val = item.chaptersRead || 0
            else val = item.episodesWatched || 0
            
            genreUnitsMap[genre] = (genreUnitsMap[genre] || 0) + val
        })
        const genreUnitsList = Object.entries(genreUnitsMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
        const maxGenreUnits = genreUnitsList[0]?.[1] || 1
        return { genreUnitsList, maxGenreUnits }
    }, [currentData, mediaType])

    // ── Avg units per item ──
    const avgUnits = useMemo(() => totalItems > 0
        ? (totalUnits / totalItems).toFixed(1)
        : 0, [totalUnits, totalItems])

    // ── Longest item ──
    const longestItem = useMemo(() => {
        return currentData.reduce((max, g) => {
            let val = 0
            if (mediaType === 'game') val = g.hours || 0
            else if (mediaType === 'movie') val = g.runtime || 0
            else if (mediaType === 'manga') val = g.chaptersRead || 0
            else val = g.episodesWatched || 0
            
            let maxVal = 0
            if (mediaType === 'game') maxVal = max?.hours || 0
            else if (mediaType === 'movie') maxVal = max?.runtime || 0
            else if (mediaType === 'manga') maxVal = max?.chaptersRead || 0
            else maxVal = max?.episodesWatched || 0

            return val > maxVal ? g : max
        }, null)
    }, [currentData, mediaType])

    // ── Highest rated item ──
    const highestRated = useMemo(() => ratedItems.reduce((max, g) =>
        g.rating > (max?.rating || 0) ? g : max, null), [ratedItems])

    if (authLoading || (gamesLoading && games.length === 0)) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-[#7a7a90] font-mono text-sm animate-pulse">Loading stats...</div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">📊</div>
                <div
                    className="text-white font-black text-2xl tracking-widest uppercase"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                    Login to see your stats
                </div>
                <Link to="/login">
                    <button className="px-6 py-3 bg-[#c8ff57] text-black font-bold
                             text-sm rounded hover:bg-[#d4ff6e] transition-all">
                        Login
                    </button>
                </Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen">

            {/* ══ HERO HEADER ══ */}
            <div className={`relative overflow-hidden border-b transition-all duration-700 ${theme ? `${theme.border} ${theme.glow}` : 'border-[#2a2a35]'}`}>

                {/* Blurred avatar background */}
                {user.avatar && (
                    <div className="absolute inset-0 bg-cover bg-center scale-110"
                        style={{
                            backgroundImage: `url(${user.avatar})`,
                            filter: 'blur(60px) brightness(0.2) saturate(1.4)'
                        }} />
                )}
                <div className={`absolute inset-0 bg-gradient-to-b via-[#0a0a0f]/75 to-[#0a0a0f] 
                                ${theme ? theme.bg : 'from-[#0a0a0f]/60'}`} />

                <div className="relative max-w-[1200px] mx-auto px-5 md:px-10 pt-10 pb-10">

                    {/* Back button */}
                    <button onClick={() => navigate(-1)}
                        className="flex items-center gap-2 font-mono text-xs text-[#7a7a90]
                                   hover:text-[#c8ff57] transition-colors mb-8">
                        ← BACK
                    </button>

                    <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-8">

                        {/* Left — avatar + name */}
                        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                            <AvatarFrame 
                                userId={user?._id || user?.id} 
                                src={user?.avatar} 
                                size={80} 
                                className="stats-header-avatar" 
                            />
                            <div>
                                <div className="font-black text-3xl md:text-4xl text-white
                                                uppercase tracking-widest"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {user.username}
                                </div>
                                <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                                    <span className="text-sm">{currentLevel.badge || '🎮'}</span>
                                    <span className="font-mono text-xs text-[#c8ff57] uppercase tracking-wider">
                                        Level {currentLevel.level || 1}
                                    </span>
                                    <span className="font-mono text-xs text-[#7a7a90]">·</span>
                                    <span className="font-mono text-xs text-[#7a7a90]">
                                        {xp} XP
                                    </span>
                                </div>
                                <div className="font-mono text-xs text-[#7a7a90] mt-1">
                                    Member since {memberYear} · All platforms
                                </div>
                            </div>
                        </div>

                        {/* Right — header stats */}
                        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-8 gap-y-4">
                            {[
                                { value: totalItems, label: mediaLabel },
                                { value: `${totalUnits}${unitLabel === 'Hours' ? 'h' : unitLabel === 'Minutes' ? 'm' : ''}`, label: unitLabel },
                                { value: avgRating, label: 'Avg Score' },
                                { value: `${completionRate}%`, label: 'Completion' },
                            ].map(stat => (
                                <div key={stat.label} className="text-center">
                                    <div className={`font-black text-3xl leading-none transition-colors ${theme ? theme.accent : 'text-[#c8ff57]'}`}
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                        {stat.value}
                                    </div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider mt-1">
                                        {stat.label}
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            </div>

            {/* ══ MAIN CONTENT ══ */}
            <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-8">

                {/* ── Tabs ── */}
                <div className="flex gap-2 mb-8 border-b border-[#2a2a35] pb-px">
                    <button
                        onClick={() => handleTabChange('stats')}
                        className={`flex items-center gap-2 px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all relative
                                   ${activeTab === 'stats' ? 'text-[#c8ff57]' : 'text-[#7a7a90] hover:text-white'}`}
                    >
                        <BarChart3 size={14} />
                        Stats
                        {activeTab === 'stats' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c8ff57]" />}
                    </button>
                    <button
                        onClick={() => handleTabChange('xp')}
                        className={`flex items-center gap-2 px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all relative
                                   ${activeTab === 'xp' ? 'text-[#c8ff57]' : 'text-[#7a7a90] hover:text-white'}`}
                    >
                        <Zap size={14} />
                        XP & Level
                        {activeTab === 'xp' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c8ff57]" />}
                    </button>
                </div>

                {activeTab === 'stats' && (
                    <div className="flex flex-wrap items-center gap-2 mb-8 p-1 bg-[#111118] border border-[#2a2a35] rounded-2xl w-fit">
                        {[
                            { id: 'game', label: 'Games', icon: <Gamepad2 size={14} /> },
                            { id: 'anime', label: 'Anime', icon: <Shuriken size={14} /> },
                            { id: 'manga', label: 'Manga', icon: <BookOpen size={14} /> },
                            { id: 'movie', label: 'Movies', icon: <Film size={14} /> },
                            { id: 'tv', label: 'TV Shows', icon: <TvIcon size={14} /> },
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => handleMediaTypeChange(t.id)}
                                className={`flex items-center gap-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest rounded-xl transition-all
                                           ${mediaType === t.id ? 'bg-[#c8ff57] text-black font-bold' : 'text-[#7a7a90] hover:text-white hover:bg-[#1a1a25]'}`}
                            >
                                {t.icon}
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}

                {activeTab === 'stats' ? (
                    <>
                        {/* ── Stat Cards Grid ── */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
                            {mediaLoading ? (
                                Array.from({ length: 10 }).map((_, i) => (
                                    <div key={i} className="h-24 bg-[#111118] border border-[#2a2a35] rounded-lg animate-pulse" />
                                ))
                            ) : (
                                [
                                    { value: totalItems, label: `Total ${mediaLabel}`, sub: 'Across your pond' },
                                    { value: `${totalUnits}${unitLabel === 'Hours' ? 'h' : unitLabel === 'Minutes' ? 'm' : ''}`, label: `${unitLabel} ${mediaType === 'game' ? 'Played' : mediaType === 'movie' ? 'Watched' : 'Tracked'}`, sub: 'Total engagement' },
                                    { value: avgRating, label: 'Average Rating', sub: 'Out of 10' },
                                    { value: completed, label: 'Completed', sub: `${completionRate}% completion rate` },
                                    { value: playing, label: mediaType === 'game' ? 'Currently Playing' : 'Currently Watching', sub: 'Active now' },
                                    { value: planned, label: 'Planned', sub: 'To experience later' },
                                    { value: dropped, label: 'Dropped', sub: 'Did not finish' },
                                    { value: paused, label: 'Paused', sub: 'On hold' },
                                    { value: avgUnits, label: `Avg ${unitLabel}`, sub: `Per ${mediaType === 'game' ? 'game' : 'entry'}` },
                                ].map(card => (
                                    <div key={card.label}
                                        className="bg-[#111118] border border-[#2a2a35] rounded-lg
                                                   p-5 hover:border-[#c8ff57]/30 transition-all">
                                        <div className="font-black text-3xl text-[#c8ff57] leading-none mb-2"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {card.value}
                                        </div>
                                        <div className="font-mono text-[10px] text-white uppercase tracking-widest mb-1">
                                            {card.label}
                                        </div>
                                        <div className="font-mono text-[10px] text-[#7a7a90]">
                                            {card.sub}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

                            {/* ── Left column ── */}
                            <div className="flex flex-col gap-10">

                                {/* Status Breakdown */}
                                <div>
                                    <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-5">
                                        Status Breakdown
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {[
                                            { label: mediaType === 'game' ? 'Playing' : 'Watching', value: playing, color: '#c8ff57' },
                                            { label: 'Completed', value: completed, color: '#5c9fff' },
                                            { label: 'Planned', value: planned, color: '#ff9f5c' },
                                            { label: 'Paused', value: paused, color: '#c45cff' },
                                            { label: 'Dropped', value: dropped, color: '#ff5c5c' },
                                        ].map(s => (
                                            <div key={s.label}>
                                                <div className="flex justify-between mb-1">
                                                    <span className="font-mono text-xs text-[#7a7a90] uppercase tracking-wider">{s.label}</span>
                                                    <span className="font-mono text-xs text-[#7a7a90]">
                                                        {s.value}
                                                        {totalItems > 0 && <span className="text-[#4a4a5a] ml-1">· {Math.round((s.value / totalItems) * 100)}%</span>}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 bg-[#2a2a35] rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-700"
                                                        style={{
                                                            width: totalItems > 0 ? `${(s.value / totalItems) * 100}%` : '0%',
                                                            background: s.color
                                                        }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Genre Distribution */}
                                {genreList.length > 0 && (
                                    <div>
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-5">
                                            Genre Distribution
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            {genreList.map(([genre, count]) => {
                                                const pct = Math.round((count / maxGenreCount) * 100)
                                                return (
                                                    <div key={genre} className="flex items-center gap-4">
                                                        <div className="font-mono text-[11px] text-[#7a7a90] w-28 flex-shrink-0 text-right truncate">
                                                            {genre}
                                                        </div>
                                                        <div className="flex-1 h-2 bg-[#2a2a35] rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-700"
                                                                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #5c9fff, #c8ff57)' }} />
                                                        </div>
                                                        <div className="font-mono text-[11px] text-[#7a7a90] w-4 flex-shrink-0">
                                                            {count}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Units by Genre */}
                                {genreUnitsList.length > 0 && genreUnitsList.some(([, h]) => h > 0) && (
                                    <div>
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-5">
                                            {unitLabel} by Genre
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            {genreUnitsList.map(([genre, units]) => {
                                                const pct = Math.round((units / maxGenreUnits) * 100)
                                                return (
                                                    <div key={genre} className="flex items-center gap-4">
                                                        <div className="font-mono text-[11px] text-[#7a7a90] w-28 flex-shrink-0 text-right truncate">
                                                            {genre}
                                                        </div>
                                                        <div className="flex-1 h-2 bg-[#2a2a35] rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-700"
                                                                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #c45cff, #5c9fff)' }} />
                                                        </div>
                                                        <div className="font-mono text-[11px] text-[#7a7a90] w-12 flex-shrink-0">
                                                            {units}{unitLabel === 'Hours' ? 'h' : unitLabel === 'Minutes' ? 'm' : ''}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Platform Breakdown (Games Only) */}
                                {mediaType === 'game' && platformList.length > 0 && (
                                    <div>
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-5">
                                            Platform Breakdown
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            {platformList.map(([platform, count]) => {
                                                const pct = Math.round((count / maxPlatformCount) * 100)
                                                return (
                                                    <div key={platform} className="flex items-center gap-4">
                                                        <div className="font-mono text-[11px] text-[#7a7a90] w-28 flex-shrink-0 text-right">
                                                            {platform}
                                                        </div>
                                                        <div className="flex-1 h-2 bg-[#2a2a35] rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-700"
                                                                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #ff9f5c, #c8ff57)' }} />
                                                        </div>
                                                        <div className="font-mono text-[11px] text-[#7a7a90] w-4 flex-shrink-0">
                                                            {count}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Rating Distribution */}
                                {ratedItems.length > 0 && (
                                    <div>
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-5">
                                            Rating Distribution
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            {Object.entries(ratingBuckets).map(([range, count]) => {
                                                const pct = Math.round((count / maxRatingCount) * 100)
                                                return (
                                                    <div key={range} className="flex items-center gap-4">
                                                        <div className="font-mono text-[11px] text-[#7a7a90] w-28 flex-shrink-0 text-right">
                                                            {range} / 10
                                                        </div>
                                                        <div className="flex-1 h-2 bg-[#2a2a35] rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-1000"
                                                                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #ff5c5c, #ff9f5c)' }} />
                                                        </div>
                                                        <div className="font-mono text-[11px] text-[#7a7a90] w-4 flex-shrink-0">
                                                            {count}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Right column ── */}
                            <div className="flex flex-col gap-10">

                                {/* Top Rated Items */}
                                {ratedItems.length > 0 && (
                                    <div>
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-5">
                                            Your Top Rated
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {[...ratedItems]
                                                .sort((a, b) => b.rating - a.rating)
                                                .slice(0, 5)
                                                .map((item, index) => {
                                                    const imageUrl = item.cover || item.coverImage
                                                    let detailPath = '#'
                                                    if (mediaType === 'game' && item.igdbId) detailPath = `/game/${item.igdbId}`
                                                    else if (mediaType === 'anime' && item.externalId) detailPath = `/anime/${item.externalId}`
                                                    else if (mediaType === 'manga' && item.externalId) detailPath = `/manga/${item.externalId}`
                                                    else if (mediaType === 'movie' && item.externalId) detailPath = `/movies/${item.externalId}`
                                                    else if (mediaType === 'tv' && item.externalId) detailPath = `/tv/${item.externalId}`

                                                    return (
                                                        <Link key={item._id}
                                                            to={detailPath}
                                                            className="flex items-center gap-4 bg-[#111118] border
                                                                       border-[#2a2a35] rounded-lg p-3
                                                                       hover:border-[#c8ff57]/30 transition-all">
                                                            <div className="font-black text-2xl text-[#2a2a35] w-6 text-center flex-shrink-0"
                                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                                {index + 1}
                                                            </div>
                                                            <div className="w-10 h-14 rounded bg-[#18181f] bg-cover bg-center flex-shrink-0"
                                                                style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'none' }}>
                                                                {!imageUrl && (
                                                                    <div className="w-full h-full flex items-center justify-center text-lg">
                                                                        {mediaType === 'game' ? '🎮' : mediaType === 'manga' ? '📖' : '🎬'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-white font-semibold text-sm truncate">{item.title}</div>
                                                                <div className="font-mono text-[10px] text-[#7a7a90] mt-1">{item.genre}</div>
                                                            </div>
                                                            <div className="font-black text-2xl text-[#c8ff57] flex-shrink-0"
                                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                                {item.rating}
                                                            </div>
                                                        </Link>
                                                    )
                                                })}
                                        </div>
                                    </div>
                                )}

                                {/* Most Engaged Items */}
                                {currentData.some(g => {
                                    if (mediaType === 'game') return (g.hours || 0) > 0
                                    if (mediaType === 'movie') return (g.runtime || 0) > 0
                                    if (mediaType === 'manga') return (g.chaptersRead || 0) > 0
                                    return (g.episodesWatched || 0) > 0
                                }) && (
                                    <div>
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-5">
                                            Most {mediaType === 'game' ? 'Played' : mediaType === 'movie' ? 'Watched' : 'Engaged'}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {[...currentData]
                                                .filter(g => {
                                                    if (mediaType === 'game') return (g.hours || 0) > 0
                                                    if (mediaType === 'movie') return (g.runtime || 0) > 0
                                                    if (mediaType === 'manga') return (g.chaptersRead || 0) > 0
                                                    return (g.episodesWatched || 0) > 0
                                                })
                                                .sort((a, b) => {
                                                    let valA = 0, valB = 0
                                                    if (mediaType === 'game') { valA = a.hours || 0; valB = b.hours || 0 }
                                                    else if (mediaType === 'movie') { valA = a.runtime || 0; valB = b.runtime || 0 }
                                                    else if (mediaType === 'manga') { valA = a.chaptersRead || 0; valB = b.chaptersRead || 0 }
                                                    else { valA = a.episodesWatched || 0; valB = b.episodesWatched || 0 }
                                                    return valB - valA
                                                })
                                                .slice(0, 5)
                                                .map((item, index) => {
                                                    const imageUrl = item.cover || item.coverImage
                                                    let val = 0
                                                    if (mediaType === 'game') val = item.hours || 0
                                                    else if (mediaType === 'movie') val = item.runtime || 0
                                                    else if (mediaType === 'manga') val = item.chaptersRead || 0
                                                    else val = item.episodesWatched || 0

                                                    let detailPath = '#'
                                                    if (mediaType === 'game' && item.igdbId) detailPath = `/game/${item.igdbId}`
                                                    else if (mediaType === 'anime' && item.externalId) detailPath = `/anime/${item.externalId}`
                                                    else if (mediaType === 'manga' && item.externalId) detailPath = `/manga/${item.externalId}`
                                                    else if (mediaType === 'movie' && item.externalId) detailPath = `/movies/${item.externalId}`
                                                    else if (mediaType === 'tv' && item.externalId) detailPath = `/tv/${item.externalId}`

                                                    return (
                                                        <Link key={item._id}
                                                            to={detailPath}
                                                            className="flex items-center gap-4 bg-[#111118] border
                                                                       border-[#2a2a35] rounded-lg p-3
                                                                       hover:border-[#c8ff57]/30 transition-all">
                                                            <div className="font-black text-2xl text-[#2a2a35] w-6 text-center flex-shrink-0"
                                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                                {index + 1}
                                                            </div>
                                                            <div className="w-10 h-14 rounded bg-[#18181f] bg-cover bg-center flex-shrink-0"
                                                                style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'none' }}>
                                                                {!imageUrl && (
                                                                    <div className="w-full h-full flex items-center justify-center text-lg">
                                                                        {mediaType === 'game' ? '🎮' : mediaType === 'manga' ? '📖' : '🎬'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-white font-semibold text-sm truncate">{item.title}</div>
                                                                <div className="font-mono text-[10px] text-[#7a7a90] mt-1">{item.genre}</div>
                                                            </div>
                                                            <div className="font-black text-2xl text-[#5c9fff] flex-shrink-0"
                                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                                {val}
                                                                <small className="font-mono text-[10px] text-[#7a7a90] font-normal">{unitLabel === 'Hours' ? 'h' : unitLabel === 'Minutes' ? 'm' : ''}</small>
                                                            </div>
                                                        </Link>
                                                    )
                                                })}
                                        </div>
                                    </div>
                                )}

                                {/* Quick Insights */}
                                <div>
                                    <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-5">
                                        Quick Insights
                                    </div>
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden">
                                        {[
                                            { label: 'Favourite Genre', value: genreList[0]?.[0] || '—' },
                                            { label: mediaType === 'game' ? 'Favourite Platform' : `Total ${mediaLabel}`, value: mediaType === 'game' ? (platformList[0]?.[0] || '—') : totalItems },
                                            { label: `Longest ${mediaLabelSingular}`, value: longestItem ? `${longestItem.title}` : '—' },
                                            { label: 'Highest Rated', value: highestRated ? `${highestRated.title} (${highestRated.rating}/10)` : '—' },
                                            { label: 'Completion Rate', value: `${completionRate}%` },
                                            { label: `Avg ${unitLabel} Per Entry`, value: `${avgUnits}${unitLabel === 'Hours' ? 'h' : unitLabel === 'Minutes' ? 'm' : ''}` },
                                            { label: 'Entries Rated', value: `${ratedItems.length} of ${totalItems}` },
                                            { label: 'Total Genres Explored', value: genreList.length },
                                        ].map((item, i, arr) => (
                                            <div key={item.label}
                                                className={`flex items-center justify-between px-5 py-3
                                                   ${i < arr.length - 1 ? 'border-b border-[#2a2a35]' : ''}
                                                   hover:bg-[#18181f] transition-all`}>
                                                <span className="font-mono text-[11px] text-[#7a7a90] uppercase tracking-wider">
                                                    {item.label}
                                                </span>
                                                <span className="font-mono text-[11px] text-[#c8ff57] font-bold text-right max-w-[180px] truncate">
                                                    {item.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Empty state */}
                        {!mediaLoading && currentData.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="text-5xl">📊</div>
                                <div className="text-white font-black text-2xl tracking-widest uppercase"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    No {mediaType} data yet
                                </div>
                                <div className="text-[#7a7a90] font-mono text-sm">
                                    Start logging {mediaType === 'game' ? 'games' : mediaType} to see your stats
                                </div>
                                <button onClick={() => navigate(mediaType === 'game' ? '/library' : `/${mediaType}/library`)}
                                    className="px-6 py-3 bg-[#c8ff57] text-black font-bold
                                               text-sm rounded hover:bg-[#d4ff6e] transition-all">
                                    + Add to Pond
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col gap-6">
                        {/* ══ XP & LEVEL CONTENT ══ */}
                        <div className="bg-[#111118] border border-[#2a2a35] rounded-xl p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-[#c8ff57]/5 blur-[80px] -mr-32 -mt-32 pointer-events-none" />
                            <div className="flex flex-col md:flex-row items-center gap-8 mb-8 relative z-10">
                                <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-[#1c1c28] to-[#111118] border border-[#2a2a35] flex items-center justify-center text-6xl shadow-2xl transform transition-transform group-hover:scale-105 duration-500">
                                    {currentLevel.badge}
                                </div>
                                <div className="text-center md:text-left">
                                    <div className="font-black text-4xl text-white tracking-widest uppercase mb-2"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                        Level {currentLevel.level} — {currentLevel.title}
                                    </div>
                                    <div className="flex items-center justify-center md:justify-start gap-3">
                                        <div className="px-3 py-1 bg-[#c8ff57]/10 border border-[#c8ff57]/20 rounded-full font-mono text-sm text-[#c8ff57] font-black">
                                            {xp} XP TOTAL
                                        </div>
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest">
                                            Current Rank
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {nextLevel ? (
                                <div className="relative z-10">
                                    <div className="flex justify-between items-end mb-3">
                                        <div className="flex flex-col">
                                            <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest mb-1">Progress to Level {nextLevel.level}</span>
                                            <span className="font-black text-xl text-white font-mono">{Math.round(xpProgress)}%</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-mono text-xs text-[#7a7a90] block">{xp} / {nextLevel.xpRequired} XP</span>
                                            <span className="font-mono text-[10px] text-[#c8ff57] uppercase tracking-wider">{nextLevel.xpRequired - xp} XP to go</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-[#1c1c28] rounded-full h-3 p-0.5 border border-[#2a2a35] shadow-inner">
                                        <div className="h-full rounded-full bg-gradient-to-r from-[#c8ff57] via-[#5c9fff] to-[#c45cff] transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(200,255,87,0.3)]"
                                            style={{ width: `${Math.min(xpProgress, 100)}%` }} />
                                    </div>
                                    <div className="mt-4 flex items-center gap-2 text-[#7a7a90]">
                                        <Zap size={12} className="text-[#c8ff57]" />
                                        <span className="font-mono text-[10px] uppercase tracking-wide">Next Unlock: {nextLevel.badge} {nextLevel.title}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-[#c8ff57]/5 border border-[#c8ff57]/20 rounded-lg p-4 flex items-center gap-4">
                                    <Trophy className="text-[#c8ff57]" size={24} />
                                    <div className="font-black text-lg text-[#c8ff57] tracking-widest uppercase" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                        MAX LEVEL REACHED — YOU ARE IMMORTAL!
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* All Levels List */}
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-xl overflow-hidden flex flex-col">
                                <div className="px-6 py-4 border-b border-[#2a2a35] bg-[#18181f]/50 flex items-center justify-between">
                                    <div className="font-mono text-xs text-white uppercase tracking-widest flex items-center gap-2">
                                        <Star size={14} className="text-[#c8ff57]" />
                                        Level Hierarchy
                                    </div>
                                    <span className="font-mono text-[10px] text-[#7a7a90]">Global Progression</span>
                                </div>
                                <div className="divide-y divide-[#2a2a35]">
                                    {LEVELS.map(lvl => {
                                        const isReached = xp >= lvl.xpRequired
                                        const isCurrent = currentLevel.level === lvl.level
                                        return (
                                            <div key={lvl.level}
                                                className={`flex items-center gap-5 px-6 py-4 transition-colors
                                                           ${isCurrent ? 'bg-[#c8ff57]/05' : 'hover:bg-[#18181f]'}`}>
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border transition-all duration-500
                                                               ${isReached ? 'bg-[#1c1c28] border-[#c8ff57]/30' : 'bg-[#0a0a0f] border-transparent grayscale opacity-20'}`}>
                                                    {lvl.badge}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className={`font-black text-sm tracking-widest uppercase truncate ${isReached ? 'text-white' : 'text-[#4a4a5a]'}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                        {lvl.title}
                                                    </div>
                                                    <div className="font-mono text-[10px] text-[#7a7a90] tracking-tight">{lvl.xpRequired} XP required</div>
                                                </div>
                                                {isCurrent ? (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="font-mono text-[8px] text-[#c8ff57] bg-[#c8ff57]/10 border border-[#c8ff57]/30 px-2 py-0.5 rounded uppercase tracking-widest font-black">Current</span>
                                                        <span className="font-mono text-[9px] text-[#7a7a90]">Lv. {lvl.level}</span>
                                                    </div>
                                                ) : isReached ? (
                                                    <div className="flex items-center gap-1.5 text-[#5c9fff]">
                                                        <Check size={14} strokeWidth={3} />
                                                        <span className="font-mono text-[9px] uppercase tracking-tighter font-bold">Unlocked</span>
                                                    </div>
                                                ) : (
                                                    <div className="font-mono text-[9px] text-[#2a2a35] font-black italic">Locked</div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* How to Earn XP */}
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-xl overflow-hidden flex flex-col h-fit">
                                <div className="px-6 py-4 border-b border-[#2a2a35] bg-[#18181f]/50">
                                    <div className="font-mono text-xs text-white uppercase tracking-widest flex items-center gap-2">
                                        <TrendingUp size={14} className="text-[#5c9fff]" />
                                        Earning Guide
                                    </div>
                                </div>
                                <div className="p-2">
                                    {[
                                        { action: 'Add to pond (any status)', xp: '+1 XP', icon: <Gamepad2 size={16} />, color: '#c8ff57' },
                                        { action: 'Rate a game', xp: '+1 XP', icon: <Star size={16} />, color: '#ff9f5c' },
                                        { action: 'Like a game', xp: '+1 XP', icon: <Heart size={16} />, color: '#ff5c5c' },
                                        { action: 'Follow someone', xp: '+1 XP', icon: <Zap size={16} />, color: '#5c9fff' },
                                        { action: 'Get followed', xp: '+1 XP', icon: <Sparkles size={16} />, color: '#c45cff' },
                                        { action: 'Comment on a game', xp: '+1 XP', icon: <Zap size={16} />, color: '#5c9fff' },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-4 p-4 rounded-lg hover:bg-[#18181f] transition-all group">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#2a2a35] text-[#7a7a90] group-hover:text-white transition-colors"
                                                 style={{ color: item.color }}>
                                                {item.icon}
                                            </div>
                                            <div className="flex-1 font-mono text-xs text-[#7a7a90] group-hover:text-white transition-colors">{item.action}</div>
                                            <div className="font-black text-lg text-[#c8ff57]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.xp}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mx-6 mb-6 p-4 bg-[#ff5c5c]/05 border border-[#ff5c5c]/10 rounded-lg flex items-start gap-3">
                                    <X size={14} className="text-[#ff5c5c] mt-0.5" />
                                    <div className="font-mono text-[10px] text-[#7a7a90] leading-relaxed">
                                        <span className="text-[#ff5c5c] font-bold uppercase mr-1">Penalty Note:</span>
                                        Undoing any action (e.g. unliking or unfollowing) will deduct the XP points previously awarded for that action.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}

export default Stats
