import { useState, useMemo, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGamesContext } from '../context/GamesContext'
import { Target, Heart, Search, Gamepad2, TrendingUp, Trophy, Star, Sparkles, Flame, Diamond, Crown, Rocket, Zap, Clock, BarChart3, Check, X } from 'lucide-react'
import { getLevelInfo, getXPProgress, LEVELS } from '../utils/levels'

// ── Constants ─────────────────────────────────────────────────────────────────

function Stats() {
    const { user, loading: authLoading } = useAuth()
    const { games, loading: gamesLoading } = useGamesContext()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'stats')

    useEffect(() => {
        const tab = searchParams.get('tab')
        if (tab && (tab === 'stats' || tab === 'xp')) {
            setActiveTab(tab)
        }
    }, [searchParams])

    const handleTabChange = (tab) => {
        setActiveTab(tab)
        setSearchParams({ tab })
    }

    const xp = user?.xp || 0
    const { current: currentLevel, next: nextLevel } = useMemo(() => getLevelInfo(xp), [xp])
    const xpProgress = useMemo(() => getXPProgress(xp), [xp])

    // ── Computed stats ──
    const { totalGames, totalHours, ratedGames, avgRating, completed, playing, planned, dropped, paused, completionRate } = useMemo(() => {
        const totalGames = games.length
        const totalHours = games.reduce((s, g) => s + (g.hours || 0), 0)
        const ratedGames = games.filter(g => g.rating > 0)
        const avgRating = ratedGames.length > 0
            ? (ratedGames.reduce((s, g) => s + g.rating, 0) / ratedGames.length).toFixed(1)
            : '—'
        const completed = games.filter(g => g.status === 'completed').length
        const playing = games.filter(g => g.status === 'playing').length
        const planned = games.filter(g => g.status === 'planned').length
        const dropped = games.filter(g => g.status === 'dropped').length
        const paused = games.filter(g => g.status === 'paused').length
        const completionRate = totalGames > 0
            ? Math.round((completed / totalGames) * 100)
            : 0

        return { totalGames, totalHours, ratedGames, avgRating, completed, playing, planned, dropped, paused, completionRate }
    }, [games])

    const memberYear = user?.createdAt
        ? new Date(user.createdAt).getFullYear()
        : new Date().getFullYear()

    // ── Genre breakdown ──
    const { genreList, maxGenreCount } = useMemo(() => {
        const genreMap = {}
        games.forEach(game => {
            const genre = game.genre || 'Unknown'
            genreMap[genre] = (genreMap[genre] || 0) + 1
        })
        const genreList = Object.entries(genreMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
        const maxGenreCount = genreList[0]?.[1] || 1
        return { genreList, maxGenreCount }
    }, [games])

    // ── Platform breakdown ──
    const { platformList, maxPlatformCount } = useMemo(() => {
        const platformMap = {}
        games.forEach(game => {
            game.platforms?.forEach(p => {
                platformMap[p] = (platformMap[p] || 0) + 1
            })
        })
        const platformList = Object.entries(platformMap)
            .sort((a, b) => b[1] - a[1])
        const maxPlatformCount = platformList[0]?.[1] || 1
        return { platformList, maxPlatformCount }
    }, [games])

    // ── Rating distribution ──
    const { ratingBuckets, maxRatingCount } = useMemo(() => {
        const buckets = { '9-10': 0, '7-8': 0, '5-6': 0, '1-4': 0 }
        ratedGames.forEach(g => {
            if (g.rating >= 9) buckets['9-10']++
            else if (g.rating >= 7) buckets['7-8']++
            else if (g.rating >= 5) buckets['5-6']++
            else buckets['1-4']++
        })
        const maxRatingCount = Math.max(...Object.values(buckets), 1)
        return { ratingBuckets: buckets, maxRatingCount }
    }, [ratedGames])

    // ── Most played genre (by hours) ──
    const { genreHoursList, maxGenreHours } = useMemo(() => {
        const genreHoursMap = {}
        games.forEach(game => {
            const genre = game.genre || 'Unknown'
            genreHoursMap[genre] = (genreHoursMap[genre] || 0) + (game.hours || 0)
        })
        const genreHoursList = Object.entries(genreHoursMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
        const maxGenreHours = genreHoursList[0]?.[1] || 1
        return { genreHoursList, maxGenreHours }
    }, [games])

    // ── Avg hours per game ──
    const avgHours = useMemo(() => totalGames > 0
        ? (totalHours / totalGames).toFixed(1)
        : 0, [totalHours, totalGames])

    // ── Longest game ──
    const longestGame = useMemo(() => games.reduce((max, g) =>
        (g.hours || 0) > (max?.hours || 0) ? g : max, null), [games])

    // ── Highest rated game ──
    const highestRated = useMemo(() => ratedGames.reduce((max, g) =>
        g.rating > (max?.rating || 0) ? g : max, null), [ratedGames])

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
            <div className="relative overflow-hidden border-b border-[#2a2a35]">

                {/* Blurred avatar background */}
                {user.avatar && (
                    <div className="absolute inset-0 bg-cover bg-center scale-110"
                        style={{
                            backgroundImage: `url(${user.avatar})`,
                            filter: 'blur(60px) brightness(0.2) saturate(1.4)'
                        }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/60 via-[#0a0a0f]/75 to-[#0a0a0f]" />

                <div className="relative max-w-[1200px] mx-auto px-5 md:px-10 py-10">

                    {/* Back button */}
                    <button onClick={() => navigate(-1)}
                        className="flex items-center gap-2 font-mono text-xs text-[#7a7a90]
                                   hover:text-[#c8ff57] transition-colors mb-8">
                        ← BACK
                    </button>

                    <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-8">

                        {/* Left — avatar + name */}
                        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.username}
                                    className="w-20 h-20 rounded-full object-cover flex-shrink-0
                                               ring-2 ring-[#2a2a35] shadow-2xl" />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br
                                                from-[#c8ff57] to-[#5c9fff]
                                                flex items-center justify-center
                                                font-black text-3xl text-black flex-shrink-0"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {user.username.slice(0, 2).toUpperCase()}
                                </div>
                            )}
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
                                { value: totalGames, label: 'Games' },
                                { value: `${totalHours}h`, label: 'Hours' },
                                { value: avgRating, label: 'Avg Score' },
                                { value: `${completionRate}%`, label: 'Completion' },
                            ].map(stat => (
                                <div key={stat.label} className="text-center">
                                    <div className="font-black text-3xl text-[#c8ff57] leading-none"
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

                {activeTab === 'stats' ? (
                    <>
                        {/* ── Stat Cards Grid ── */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
                            {[
                                { value: totalGames, label: 'Total Games', sub: 'Across all platforms' },
                                { value: `${totalHours}h`, label: 'Hours Played', sub: 'Total tracked time' },
                                { value: avgRating, label: 'Average Rating', sub: 'Out of 10' },
                                { value: completed, label: 'Completed', sub: `${completionRate}% completion rate` },
                                { value: playing, label: 'Currently Playing', sub: 'Active now' },
                                { value: planned, label: 'In Backlog', sub: 'Planned to play' },
                                { value: dropped, label: 'Dropped', sub: 'Did not finish' },
                                { value: paused, label: 'Paused', sub: 'On hold' },
                                { value: avgHours, label: 'Avg Hours', sub: 'Per game' },
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
                            ))}
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
                                            { label: 'Playing', value: playing, color: '#c8ff57' },
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
                                                        {totalGames > 0 && <span className="text-[#4a4a5a] ml-1">· {Math.round((s.value / totalGames) * 100)}%</span>}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 bg-[#2a2a35] rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-700"
                                                        style={{
                                                            width: totalGames > 0 ? `${(s.value / totalGames) * 100}%` : '0%',
                                                            background: s.color
                                                        }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Playtime by Genre */}
                                {genreList.length > 0 && (
                                    <div>
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-5">
                                            Playtime by Genre
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

                                {/* Hours by Genre */}
                                {genreHoursList.length > 0 && genreHoursList.some(([, h]) => h > 0) && (
                                    <div>
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-5">
                                            Hours by Genre
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            {genreHoursList.map(([genre, hours]) => {
                                                const pct = Math.round((hours / maxGenreHours) * 100)
                                                return (
                                                    <div key={genre} className="flex items-center gap-4">
                                                        <div className="font-mono text-[11px] text-[#7a7a90] w-28 flex-shrink-0 text-right truncate">
                                                            {genre}
                                                        </div>
                                                        <div className="flex-1 h-2 bg-[#2a2a35] rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-700"
                                                                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #c45cff, #5c9fff)' }} />
                                                        </div>
                                                        <div className="font-mono text-[11px] text-[#7a7a90] w-8 flex-shrink-0">
                                                            {hours}h
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Platform Breakdown */}
                                {platformList.length > 0 && (
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
                                {ratedGames.length > 0 && (
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
                                                            <div className="h-full rounded-full transition-all duration-700"
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

                                {/* Top Rated Games */}
                                {ratedGames.length > 0 && (
                                    <div>
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-5">
                                            Your Top Rated
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {[...ratedGames]
                                                .sort((a, b) => b.rating - a.rating)
                                                .slice(0, 5)
                                                .map((game, index) => {
                                                    const imageUrl = game.cover
                                                        ? game.cover
                                                        : game.steamId
                                                            ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamId}/header.jpg`
                                                            : null
                                                    return (
                                                        <Link key={game._id}
                                                            to={game.igdbId ? `/game/${game.igdbId}` : '#'}
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
                                                                    <div className="w-full h-full flex items-center justify-center text-lg">🎮</div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-white font-semibold text-sm truncate">{game.title}</div>
                                                                <div className="font-mono text-[10px] text-[#7a7a90] mt-1">{game.genre}</div>
                                                            </div>
                                                            <div className="font-black text-2xl text-[#c8ff57] flex-shrink-0"
                                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                                {game.rating}
                                                                <small className="font-mono text-[10px] text-[#7a7a90] font-normal">/10</small>
                                                            </div>
                                                        </Link>
                                                    )
                                                })}
                                        </div>
                                    </div>
                                )}

                                {/* Most Played Games */}
                                {games.some(g => g.hours > 0) && (
                                    <div>
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-5">
                                            Most Played
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {[...games]
                                                .filter(g => g.hours > 0)
                                                .sort((a, b) => b.hours - a.hours)
                                                .slice(0, 5)
                                                .map((game, index) => {
                                                    const imageUrl = game.cover
                                                        ? game.cover
                                                        : game.steamId
                                                            ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamId}/header.jpg`
                                                            : null
                                                    return (
                                                        <Link key={game._id}
                                                            to={game.igdbId ? `/game/${game.igdbId}` : '#'}
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
                                                                    <div className="w-full h-full flex items-center justify-center text-lg">🎮</div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-white font-semibold text-sm truncate">{game.title}</div>
                                                                <div className="font-mono text-[10px] text-[#7a7a90] mt-1">{game.genre}</div>
                                                            </div>
                                                            <div className="font-black text-2xl text-[#5c9fff] flex-shrink-0"
                                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                                {game.hours}
                                                                <small className="font-mono text-[10px] text-[#7a7a90] font-normal">h</small>
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
                                            { label: 'Favourite Platform', value: platformList[0]?.[0] || '—' },
                                            { label: 'Longest Game', value: longestGame ? `${longestGame.title} (${longestGame.hours}h)` : '—' },
                                            { label: 'Highest Rated', value: highestRated ? `${highestRated.title} (${highestRated.rating}/10)` : '—' },
                                            { label: 'Completion Rate', value: `${completionRate}%` },
                                            { label: 'Avg Hours Per Game', value: `${avgHours}h` },
                                            { label: 'Games Rated', value: `${ratedGames.length} of ${totalGames}` },
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
                        {games.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="text-5xl">📊</div>
                                <div className="text-white font-black text-2xl tracking-widest uppercase"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    No data yet
                                </div>
                                <div className="text-[#7a7a90] font-mono text-sm">
                                    Start logging games to see your stats
                                </div>
                                <button onClick={() => navigate('/library')}
                                    className="px-6 py-3 bg-[#c8ff57] text-black font-bold
                                               text-sm rounded hover:bg-[#d4ff6e] transition-all">
                                    + Add to Deck
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
                                        { action: 'Add to deck (any status)', xp: '+1 XP', icon: <Gamepad2 size={16} />, color: '#c8ff57' },
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
