import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useGames from '../hooks/useGames'

function Stats() {

    const { user } = useAuth()
    const { games } = useGames()
    const navigate = useNavigate()

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

    // ── Computed stats ──
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

    const memberYear = user.createdAt
        ? new Date(user.createdAt).getFullYear()
        : new Date().getFullYear()

    // ── Genre breakdown ──
    const genreMap = {}
    games.forEach(game => {
        const genre = game.genre || 'Unknown'
        genreMap[genre] = (genreMap[genre] || 0) + 1
    })
    const genreList = Object.entries(genreMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
    const maxGenreCount = genreList[0]?.[1] || 1

    // ── Platform breakdown ──
    const platformMap = {}
    games.forEach(game => {
        game.platforms?.forEach(p => {
            platformMap[p] = (platformMap[p] || 0) + 1
        })
    })
    const platformList = Object.entries(platformMap)
        .sort((a, b) => b[1] - a[1])
    const maxPlatformCount = platformList[0]?.[1] || 1

    // ── Rating distribution ──
    const ratingBuckets = { '9-10': 0, '7-8': 0, '5-6': 0, '1-4': 0 }
    ratedGames.forEach(g => {
        if (g.rating >= 9) ratingBuckets['9-10']++
        else if (g.rating >= 7) ratingBuckets['7-8']++
        else if (g.rating >= 5) ratingBuckets['5-6']++
        else ratingBuckets['1-4']++
    })
    const maxRatingCount = Math.max(...Object.values(ratingBuckets), 1)

    // ── Most played genre (by hours) ──
    const genreHoursMap = {}
    games.forEach(game => {
        const genre = game.genre || 'Unknown'
        genreHoursMap[genre] = (genreHoursMap[genre] || 0) + (game.hours || 0)
    })
    const genreHoursList = Object.entries(genreHoursMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    const maxGenreHours = genreHoursList[0]?.[1] || 1

    // ── Avg hours per game ──
    const avgHours = totalGames > 0
        ? (totalHours / totalGames).toFixed(1)
        : 0

    // ── Longest game ──
    const longestGame = games.reduce((max, g) =>
        (g.hours || 0) > (max?.hours || 0) ? g : max, null)

    // ── Highest rated game ──
    const highestRated = ratedGames.reduce((max, g) =>
        g.rating > (max?.rating || 0) ? g : max, null)

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

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">

                        {/* Left — avatar + name */}
                        <div className="flex items-center gap-5">
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
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm">{user.badge || '🎮'}</span>
                                    <span className="font-mono text-xs text-[#c8ff57] uppercase tracking-wider">
                                        Level {user.level || 1}
                                    </span>
                                    <span className="font-mono text-xs text-[#7a7a90]">·</span>
                                    <span className="font-mono text-xs text-[#7a7a90]">
                                        {user.xp || 0} XP
                                    </span>
                                </div>
                                <div className="font-mono text-xs text-[#7a7a90] mt-1">
                                    Member since {memberYear} · All platforms
                                </div>
                            </div>
                        </div>

                        {/* Right — header stats */}
                        <div className="flex gap-8 sm:gap-10">
                            {[
                                { value: totalGames, label: 'Games' },
                                { value: `${totalHours}h`, label: 'Hours' },
                                { value: avgRating, label: 'Avg Score' },
                                { value: `${completionRate}%`, label: 'Completion' },
                            ].map(stat => (
                                <div key={stat.label} className="text-center sm:text-right">
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
                            + Log a Game
                        </button>
                    </div>
                )}

            </div>
        </div>
    )
}

export default Stats
