import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import useGames from '../hooks/useGames'

const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric'
    })
}

const makeActivityConfig = (navigate) => ({
    completed: {
        icon: '🏆',
        bg: 'bg-[#5c9fff]/15',
        getText: (a) => (
            <>
                Completed{' '}
                <span
                    onClick={() => a.game.igdbId && navigate(`/game/${a.game.igdbId}`)}
                    className={`text-[#c8ff57] font-bold ${a.game.igdbId ? 'cursor-pointer hover:underline' : ''}`}
                >
                    {a.game.title}
                </span>
                {a.rating ? ` — rated it ${a.rating}/10` : ''}
            </>
        )
    },
    playing: {
        icon: '▶',
        bg: 'bg-[#c8ff57]/15',
        getText: (a) => (
            <>
                Started playing{' '}
                <span
                    onClick={() => a.game.igdbId && navigate(`/game/${a.game.igdbId}`)}
                    className={`text-[#c8ff57] font-bold ${a.game.igdbId ? 'cursor-pointer hover:underline' : ''}`}
                >
                    {a.game.title}
                </span>
            </>
        )
    },
    rated: {
        icon: '⭐',
        bg: 'bg-[#ff9f5c]/15',
        getText: (a) => (
            <>
                Rated{' '}
                <span
                    onClick={() => a.game.igdbId && navigate(`/game/${a.game.igdbId}`)}
                    className={`text-[#c8ff57] font-bold ${a.game.igdbId ? 'cursor-pointer hover:underline' : ''}`}
                >
                    {a.game.title}
                </span>
                {` ${a.rating}/10`}
            </>
        )
    },
    planned: {
        icon: '📋',
        bg: 'bg-[#2a2a35]',
        getText: (a) => (
            <>
                Added{' '}
                <span
                    onClick={() => a.game.igdbId && navigate(`/game/${a.game.igdbId}`)}
                    className={`text-[#c8ff57] font-bold ${a.game.igdbId ? 'cursor-pointer hover:underline' : ''}`}
                >
                    {a.game.title}
                </span>
                {' to planned list'}
            </>
        )
    },
    dropped: {
        icon: '✕',
        bg: 'bg-[#ff5c5c]/15',
        getText: (a) => (
            <>
                Dropped{' '}
                <span
                    onClick={() => a.game.igdbId && navigate(`/game/${a.game.igdbId}`)}
                    className={`text-[#c8ff57] font-bold ${a.game.igdbId ? 'cursor-pointer hover:underline' : ''}`}
                >
                    {a.game.title}
                </span>
                {a.hours ? ` after ${a.hours}h` : ''}
            </>
        )
    },
    paused: {
        icon: '⏸',
        bg: 'bg-[#c45cff]/15',
        getText: (a) => (
            <>
                Paused{' '}
                <span
                    onClick={() => a.game.igdbId && navigate(`/game/${a.game.igdbId}`)}
                    className={`text-[#c8ff57] font-bold ${a.game.igdbId ? 'cursor-pointer hover:underline' : ''}`}
                >
                    {a.game.title}
                </span>
            </>
        )
    }
})

// ── Mosaic banner background ──
function HeroBanner({ games }) {
    const covers = games
        .filter(g => g.cover)
        .map(g => g.cover)
        .filter((v, i, a) => a.indexOf(v) === i) // deduplicate

    if (covers.length === 0) return null

    const sizePatterns = [
        { w: 'w-[180px]', h: 'h-[240px]' },
        { w: 'w-[130px]', h: 'h-[170px]' },
        { w: 'w-[160px]', h: 'h-[210px]' },
        { w: 'w-[140px]', h: 'h-[185px]' },
        { w: 'w-[175px]', h: 'h-[230px]' },
        { w: 'w-[120px]', h: 'h-[160px]' },
        { w: 'w-[155px]', h: 'h-[205px]' },
        { w: 'w-[145px]', h: 'h-[195px]' },
        { w: 'w-[165px]', h: 'h-[220px]' },
        { w: 'w-[135px]', h: 'h-[180px]' },
        { w: 'w-[150px]', h: 'h-[200px]' },
        { w: 'w-[170px]', h: 'h-[225px]' },
        { w: 'w-[125px]', h: 'h-[165px]' },
        { w: 'w-[158px]', h: 'h-[210px]' },
        { w: 'w-[142px]', h: 'h-[188px]' },
    ]

    // Shuffle covers randomly
    const shuffled = [...covers].sort(() => Math.random() - 0.5)

    // Split into two halves — row1 gets first half, row2 gets second half
    // If not enough covers, cycle through them but keep rows different
    const getRow = (startIndex, count) => {
        const row = []
        for (let i = 0; i < count; i++) {
            const coverIndex = (startIndex + i) % shuffled.length
            row.push({
                img: shuffled[coverIndex],
                ...sizePatterns[i % sizePatterns.length]
            })
        }
        return row
    }

    const mid = Math.ceil(shuffled.length / 2)
    const row1Tiles = getRow(0, 15)
    const row2Tiles = getRow(mid, 15)

    return (
        <div className="absolute inset-0 z-0 overflow-hidden">

            {/* Row 1 — scrolls left */}
            <div className="absolute top-0 left-0 right-0 h-[55%] flex items-end gap-3 pb-2">
                <div
                    className="flex gap-3 items-end"
                    style={{
                        animation: 'mosaicLeft 40s linear infinite',
                        width: 'max-content'
                    }}
                >
                    {/* Double for seamless loop */}
                    {[...row1Tiles, ...row1Tiles].map((tile, i) => (
                        <img
                            key={i}
                            src={tile.img}
                            alt=""
                            className={`${tile.w} ${tile.h} object-contain rounded-lg flex-shrink-0`}
                        />
                    ))}
                </div>
            </div>

            {/* Row 2 — scrolls right */}
            <div className="absolute bottom-0 left-0 right-0 h-[55%] flex items-start gap-3 pt-2">
                <div
                    className="flex gap-3 items-start"
                    style={{
                        animation: 'mosaicRight 32s linear infinite',
                        width: 'max-content'
                    }}
                >
                    {/* Double for seamless loop */}
                    {[...row2Tiles, ...row2Tiles].map((tile, i) => (
                        <img
                            key={i}
                            src={tile.img}
                            alt=""
                            className={`${tile.w} ${tile.h} object-contain rounded-lg flex-shrink-0`}
                        />
                    ))}
                </div>
            </div>

            {/* Blur layer */}
            <div className="absolute inset-0 backdrop-blur-[3px]" />

            {/* Dark overlay */}
            <div className="absolute inset-0 bg-[#0a0a0f]/80" />

            {/* Bottom fade */}
            <div className="absolute bottom-0 left-0 right-0 h-32
                            bg-gradient-to-t from-[#0a0a0f] to-transparent" />

            {/* Top fade */}
            <div className="absolute top-0 left-0 right-0 h-20
                            bg-gradient-to-b from-[#0a0a0f] to-transparent" />

            {/* Left fade */}
            <div className="absolute top-0 left-0 bottom-0 w-24
                            bg-gradient-to-r from-[#0a0a0f] to-transparent" />

            {/* Right fade */}
            <div className="absolute top-0 right-0 bottom-0 w-24
                            bg-gradient-to-l from-[#0a0a0f] to-transparent" />

        </div>
    )
}
function Home() {

    const { user } = useAuth()
    const navigate = useNavigate()
    const { games } = useGames()
    const activityConfig = makeActivityConfig(navigate)

    const [trending, setTrending] = useState([])
    const [topRated, setTopRated] = useState([])
    const [comingSoon, setComingSoon] = useState([])
    const [activity, setActivity] = useState([])
    const [loadingTrending, setLoadingTrending] = useState(true)
    const [loadingComing, setLoadingComing] = useState(true)
    const [loadingActivity, setLoadingActivity] = useState(false)

    useEffect(() => {
        const fetch_ = async () => {
            try {
                setLoadingTrending(true)
                const [trendRes, topRes] = await Promise.all([
                    api.get('/igdb/trending'),
                    api.get('/igdb/top-rated')
                ])
                setTrending(trendRes.data.games.slice(0, 10))
                setTopRated(topRes.data.games.slice(0, 10))
            } catch (err) {
                console.error('Trending error:', err)
            } finally {
                setLoadingTrending(false)
            }
        }
        fetch_()
    }, [])

    useEffect(() => {
        const fetch_ = async () => {
            try {
                setLoadingComing(true)
                const res = await api.get('/igdb/coming-soon')
                setComingSoon(res.data.games)
            } catch (err) {
                console.error('Coming soon error:', err)
            } finally {
                setLoadingComing(false)
            }
        }
        fetch_()
    }, [])

    useEffect(() => {
        if (!user) return
        const fetch_ = async () => {
            try {
                setLoadingActivity(true)
                const res = await api.get(`/games/activity/${user.id || user._id}`)
                setActivity(res.data.activity)
            } catch (err) {
                console.error('Activity error:', err)
            } finally {
                setLoadingActivity(false)
            }
        }
        fetch_()
    }, [user])

    const userStats = {
        total: games.length,
        playing: games.filter(g => g.status === 'playing').length,
        completed: games.filter(g => g.status === 'completed').length,
        planned: games.filter(g => g.status === 'planned').length,
    }

    const recentGames = games.slice(0, 4)

    const statusConfig = {
        playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Playing' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
    }

    const getMyRating = (igdbId) => {
        if (!igdbId || !user) return null
        const match = games.find(g => g.igdbId && Number(g.igdbId) === Number(igdbId))
        return match?.rating > 0 ? match.rating : null
    }

    const RatingDisplay = ({ game }) => {
        const myRating = getMyRating(game.id)
        const avgRating = game.rating
        return (
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {myRating ? (
                    <div className="flex items-center gap-1">
                        <span className="font-mono text-[8px] text-[#7a7a90] uppercase tracking-wider">
                            me
                        </span>
                        <div
                            className="font-black text-lg text-[#c8ff57] leading-none"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            {myRating}
                            <small className="font-mono text-[8px] text-[#7a7a90] font-normal">/10</small>
                        </div>
                    </div>
                ) : user ? (
                    <div className="font-mono text-[8px] text-[#2a2a35] uppercase tracking-wider">
                        not rated
                    </div>
                ) : null}
                {avgRating && (
                    <div className="flex items-center gap-1">
                        <span className="font-mono text-[8px] text-[#7a7a90] uppercase tracking-wider">
                            avg
                        </span>
                        <div
                            className="font-black text-lg text-[#5c9fff] leading-none"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            {avgRating}
                            <small className="font-mono text-[8px] text-[#7a7a90] font-normal">/10</small>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="min-h-screen">

            {/* ══════════════════════════
                HERO
            ══════════════════════════ */}
            <section className="relative py-12 md:py-20 overflow-hidden">

                {/* Mosaic banner background */}
                {!loadingTrending && trending.length > 0 && (
                    <HeroBanner
                        games={[...trending, ...topRated, ...(loadingComing ? [] : comingSoon)]}
                    />
                )}

                {/* Content */}
                <div className="relative z-10 max-w-[1200px] mx-auto px-5 md:px-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">

                        {/* Left */}
                        <div>
                            <div className="inline-flex items-center gap-2 border border-[#2a2a35]
                                            rounded px-3 py-1 mb-6">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff57]" />
                                <span className="font-mono text-[11px] text-[#7a7a90] uppercase tracking-widest">
                                    Beta · Free Forever · All Platforms
                                </span>
                            </div>

                            <h1
                                className="font-black uppercase leading-none tracking-wide text-white mb-6"
                                style={{
                                    fontSize: 'clamp(3rem, 8vw, 6rem)',
                                    fontFamily: 'Bebas Neue, sans-serif'
                                }}
                            >
                                Your Game<br />
                                <span className="text-[#c8ff57]">Diary.</span>
                            </h1>

                            <p className="text-[#7a7a90] text-sm leading-relaxed mb-8 max-w-md">
                                Track every game across PC, PlayStation, Xbox, Switch,
                                Mobile and more. Rate them, manage your backlog, find
                                deals, and discover what to play next.
                            </p>

                            <div className="flex flex-wrap gap-3 mb-10">
                                {user ? (
                                    <>
                                        <button
                                            onClick={() => navigate('/library')}
                                            className="px-5 py-3 bg-[#c8ff57] text-black font-bold
                                                       text-sm rounded hover:bg-[#d4ff6e] transition-all"
                                        >
                                            + Log a Game
                                        </button>
                                        <button
                                            onClick={() => navigate('/library')}
                                            className="px-5 py-3 border border-[#2a2a35] text-white
                                                       font-semibold text-sm rounded hover:border-[#c8ff57]
                                                       hover:text-[#c8ff57] transition-all"
                                        >
                                            My Library →
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Link to="/signup">
                                            <button className="px-5 py-3 bg-[#c8ff57] text-black font-bold
                                                               text-sm rounded hover:bg-[#d4ff6e] transition-all">
                                                Get Started Free
                                            </button>
                                        </Link>
                                        <Link to="/login">
                                            <button className="px-5 py-3 border border-[#2a2a35] text-white
                                                               font-semibold text-sm rounded
                                                               hover:border-[#c8ff57] hover:text-[#c8ff57]
                                                               transition-all">
                                                Login →
                                            </button>
                                        </Link>
                                    </>
                                )}
                            </div>

                            {user && games.length > 0 ? (
                                <div className="flex gap-8">
                                    {[
                                        { value: userStats.total, label: 'Games Logged' },
                                        {
                                            value: games.reduce((s, g) => s + (g.hours || 0), 0),
                                            label: 'Hours Played'
                                        },
                                        {
                                            value: games.filter(g => g.rating > 0).length > 0
                                                ? (games.filter(g => g.rating > 0)
                                                    .reduce((s, g) => s + g.rating, 0) /
                                                    games.filter(g => g.rating > 0).length
                                                ).toFixed(1)
                                                : '—',
                                            label: 'Avg Rating'
                                        }
                                    ].map(stat => (
                                        <div key={stat.label}>
                                            <div
                                                className="font-black text-3xl text-white leading-none"
                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                            >
                                                {stat.value}
                                            </div>
                                            <div className="font-mono text-[10px] text-[#7a7a90]
                                                            uppercase tracking-wider mt-1">
                                                {stat.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : !user && (
                                <div className="flex gap-8">
                                    {[
                                        { value: '∞', label: 'Games Supported' },
                                        { value: 'Free', label: 'Forever' },
                                        { value: 'All', label: 'Platforms' },
                                    ].map(stat => (
                                        <div key={stat.label}>
                                            <div
                                                className="font-black text-3xl text-[#c8ff57] leading-none"
                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                            >
                                                {stat.value}
                                            </div>
                                            <div className="font-mono text-[10px] text-[#7a7a90]
                                                            uppercase tracking-wider mt-1">
                                                {stat.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right — Recent games */}
                        <div className="hidden md:flex flex-col gap-3">
                            {recentGames.length > 0 ? (
                                <>
                                    {recentGames.map(game => {
                                        const sc = statusConfig[game.status] || statusConfig.planned
                                        const imageUrl = game.cover
                                            ? game.cover
                                            : game.steamId
                                                ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamId}/header.jpg`
                                                : null
                                        return (
                                            <div
                                                key={game._id}
                                                onClick={() => game.igdbId && navigate(`/game/${game.igdbId}`)}
                                                className={`flex items-center gap-4 bg-[#111118]/80 border
                                                            border-[#2a2a35] rounded-lg p-3
                                                            hover:border-[#c8ff57]/30 transition-all
                                                            ${game.igdbId ? 'cursor-pointer' : ''}`}
                                            >
                                                <div
                                                    className="w-14 h-10 rounded bg-[#18181f] bg-cover
                                                               bg-center flex-shrink-0"
                                                    style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'none' }}
                                                >
                                                    {!imageUrl && (
                                                        <div className="w-full h-full flex items-center
                                                                        justify-center text-lg">🎮</div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-white font-semibold text-sm truncate">
                                                        {game.title}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`font-mono text-[9px] uppercase
                                                                         tracking-wider px-1.5 py-[2px]
                                                                         rounded-sm ${sc.bg} ${sc.color}`}>
                                                            {sc.label}
                                                        </span>
                                                        {game.platforms?.slice(0, 2).map(p => (
                                                            <span key={p}
                                                                className="font-mono text-[9px] uppercase tracking-wider
                                                                           px-1.5 py-[2px] rounded-sm
                                                                           bg-[#2a2a35] text-[#7a7a90]">
                                                                {p}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {game.rating > 0 && (
                                                    <div
                                                        className="font-black text-xl text-[#c8ff57] flex-shrink-0"
                                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                                    >
                                                        {game.rating}
                                                        <small className="font-mono text-[9px] text-[#7a7a90] font-normal">
                                                            /10
                                                        </small>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}

                                    <button
                                        onClick={() => navigate('/library')}
                                        className="w-full py-3 border border-dashed border-[#2a2a35]
                                                   text-[#7a7a90] font-mono text-xs rounded-lg
                                                   hover:border-[#c8ff57] hover:text-[#c8ff57]
                                                   transition-all"
                                    >
                                        + Log More Games →
                                    </button>
                                </>
                            ) : (
                                <>
                                    {['Elden Ring', 'Hollow Knight', 'Hades', 'Celeste'].map((title, i) => (
                                        <div
                                            key={title}
                                            className="flex items-center gap-4 bg-[#111118]/80 border
                                                       border-[#2a2a35] rounded-lg p-3 opacity-40"
                                        >
                                            <div className="w-14 h-10 rounded bg-[#18181f] flex-shrink-0
                                                            flex items-center justify-center text-lg">
                                                🎮
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-white font-semibold text-sm">{title}</div>
                                                <div className="mt-1">
                                                    <span className="font-mono text-[9px] uppercase tracking-wider
                                                                     px-1.5 py-[2px] rounded-sm
                                                                     bg-[#c8ff57]/15 text-[#c8ff57]">
                                                        {['Playing', 'Completed', 'Planned', 'Completed'][i]}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <Link to={user ? '/library' : '/signup'}>
                                        <button className="w-full py-3 border border-dashed border-[#2a2a35]
                                                           text-[#7a7a90] font-mono text-xs rounded-lg
                                                           hover:border-[#c8ff57] hover:text-[#c8ff57]
                                                           transition-all">
                                            + Start Logging Your Games
                                        </button>
                                    </Link>
                                </>
                            )}
                        </div>

                    </div>
                </div>
            </section>

            {/* ══════════════════════════
                USER STATS BAR
            ══════════════════════════ */}
            {user && (
                <section className="border-y border-[#2a2a35] bg-[#111118]">
                    <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-5">
                        <div className="flex flex-col sm:flex-row items-center gap-6">

                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-full bg-gradient-to-br
                                              from-[#c8ff57] to-[#5c9fff]
                                              flex items-center justify-center
                                              font-black text-sm text-black flex-shrink-0"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="text-white font-bold text-sm">{user.username}</div>
                                    <div className="font-mono text-[10px] text-[#7a7a90]">
                                        @{user.username} · All platforms
                                    </div>
                                </div>
                            </div>

                            <div className="hidden sm:block w-px h-8 bg-[#2a2a35]" />

                            <div className="flex gap-8">
                                {[
                                    { value: userStats.total, label: 'Total' },
                                    { value: userStats.playing, label: 'Playing' },
                                    { value: userStats.completed, label: 'Completed' },
                                    { value: userStats.planned, label: 'Planned' },
                                ].map(stat => (
                                    <div key={stat.label} className="text-center sm:text-left">
                                        <div
                                            className="font-black text-2xl text-white leading-none"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                        >
                                            {stat.value}
                                        </div>
                                        <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">
                                            {stat.label}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="sm:ml-auto">
                                <Link to="/stats">
                                    <button className="font-mono text-xs text-[#7a7a90]
                                                       hover:text-[#c8ff57] transition-colors">
                                        View Full Stats →
                                    </button>
                                </Link>
                            </div>

                        </div>
                    </div>
                </section>
            )}

            {/* ══════════════════════════
                TRENDING NOW
            ══════════════════════════ */}
            <section className="max-w-[1200px] mx-auto px-5 md:px-10 py-12">

                <div className="flex items-center gap-3 mb-6">
                    <span className="text-2xl">🔥</span>
                    <h2
                        className="font-black text-2xl tracking-widest uppercase text-white"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                        Trending Now
                    </h2>
                    <span className="font-mono text-xs text-[#7a7a90] hidden sm:block">
                        Most logged this week
                    </span>
                </div>

                {loadingTrending ? (
                    <div className="text-center py-10 text-[#7a7a90] font-mono text-sm">
                        Loading...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Trending list */}
                        <div className="flex flex-col gap-2">
                            {trending.map((game, index) => (
                                <div
                                    key={game.id}
                                    onClick={() => navigate(`/game/${game.id}`)}
                                    className="flex items-center gap-4 p-3 rounded-lg
                                               border border-[#2a2a35] bg-[#111118]
                                               hover:border-[#c8ff57]/30 transition-all
                                               cursor-pointer"
                                >
                                    <div
                                        className="font-black text-2xl text-[#2a2a35] w-6
                                                   text-center flex-shrink-0"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                    >
                                        {index + 1}
                                    </div>
                                    {game.cover ? (
                                        <img src={game.cover} alt={game.title}
                                            className="w-10 h-14 object-cover rounded flex-shrink-0" />
                                    ) : (
                                        <div className="w-10 h-14 bg-[#2a2a35] rounded flex-shrink-0
                                                        flex items-center justify-center text-sm">🎮</div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white font-semibold text-sm truncate">
                                            {game.title}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="font-mono text-[9px] uppercase tracking-wider
                                                             px-1.5 py-[2px] rounded-sm bg-[#2a2a35] text-[#7a7a90]">
                                                {game.genre}
                                            </span>
                                            {index < 2 && (
                                                <span className="font-mono text-[9px] uppercase tracking-wider
                                                                 px-1.5 py-[2px] rounded-sm
                                                                 bg-[#ff5c5c]/15 text-[#ff5c5c]">
                                                    HOT
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <RatingDisplay game={game} />
                                </div>
                            ))}
                        </div>

                        {/* Top Rated */}
                        <div>
                            <div className="font-mono text-xs text-[#7a7a90] uppercase
                                            tracking-widest mb-4">
                                Top Rated This Month
                            </div>
                            <div className="flex flex-col gap-2">
                                {topRated.map((game, index) => (
                                    <div
                                        key={game.id}
                                        onClick={() => navigate(`/game/${game.id}`)}
                                        className="flex items-center gap-4 p-3 rounded-lg
                                                   border border-[#2a2a35] bg-[#111118]
                                                   hover:border-[#c8ff57]/30 transition-all
                                                   cursor-pointer"
                                    >
                                        <div
                                            className="font-black text-2xl text-[#2a2a35] w-6
                                                       text-center flex-shrink-0"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                        >
                                            {index + 1}
                                        </div>
                                        {game.cover ? (
                                            <img src={game.cover} alt={game.title}
                                                className="w-10 h-14 object-cover rounded flex-shrink-0" />
                                        ) : (
                                            <div className="w-10 h-14 bg-[#2a2a35] rounded flex-shrink-0
                                                            flex items-center justify-center text-sm">🎮</div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white font-semibold text-sm truncate">
                                                {game.title}
                                            </div>
                                            <div className="mt-1">
                                                <span className="font-mono text-[9px] uppercase tracking-wider
                                                                 px-1.5 py-[2px] rounded-sm
                                                                 bg-[#2a2a35] text-[#7a7a90]">
                                                    {game.genre}
                                                </span>
                                            </div>
                                        </div>
                                        <RatingDisplay game={game} />
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}
            </section>

            {/* ══════════════════════════
                COMING SOON
            ══════════════════════════ */}
            <section className="max-w-[1200px] mx-auto px-5 md:px-10 py-12
                                border-t border-[#2a2a35]">

                <div className="flex items-center gap-3 mb-6">
                    <h2
                        className="font-black text-2xl tracking-widest uppercase text-white"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                        Coming Soon
                    </h2>
                    <span className="font-mono text-xs text-[#7a7a90] hidden sm:block">
                        Upcoming &amp; announced
                    </span>
                </div>

                {loadingComing ? (
                    <div className="text-center py-10 text-[#7a7a90] font-mono text-sm">
                        Loading...
                    </div>
                ) : comingSoon.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        {comingSoon.map(game => (
                            <div
                                key={game.id}
                                onClick={() => navigate(`/game/${game.id}`)}
                                className="bg-[#111118] border border-[#2a2a35] rounded-lg
                                           overflow-hidden hover:border-[#c8ff57]/50 transition-all
                                           cursor-pointer"
                            >
                                <div className="relative">
                                    {game.cover ? (
                                        <img src={game.cover} alt={game.title}
                                            className="w-full h-[160px] object-cover" />
                                    ) : (
                                        <div className="w-full h-[160px] bg-[#18181f] flex items-center
                                                        justify-center text-3xl">🎮</div>
                                    )}
                                    <div className="absolute top-2 left-2">
                                        <span className="font-mono text-[9px] uppercase tracking-wider
                                                         px-1.5 py-[2px] rounded-sm bg-[#5c9fff]/90 text-white">
                                            Upcoming
                                        </span>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <div className="text-white font-semibold text-xs truncate mb-1">
                                        {game.title}
                                    </div>
                                    <div className="font-mono text-[9px] text-[#7a7a90]">
                                        {game.releaseDate}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-[#7a7a90] font-mono text-sm">
                        No upcoming games found
                    </div>
                )}
            </section>

            {/* ══════════════════════════
                RECENT ACTIVITY
            ══════════════════════════ */}
            {user && (
                <section className="max-w-[1200px] mx-auto px-5 md:px-10 py-12
                                    border-t border-[#2a2a35]">

                    <div className="flex items-center justify-between mb-6">
                        <h2
                            className="font-black text-2xl tracking-widest uppercase text-white"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            Recent Activity
                        </h2>
                    </div>

                    {loadingActivity ? (
                        <div className="text-center py-10 text-[#7a7a90] font-mono text-sm">
                            Loading...
                        </div>
                    ) : activity.length > 0 ? (
                        <>
                            <div className="flex flex-col divide-y divide-[#2a2a35]
                                            border border-[#2a2a35] rounded-lg overflow-hidden">
                                {activity.slice(0, 5).map((item, index) => {
                                    const config = activityConfig[item.type] || activityConfig.planned
                                    return (
                                        <div
                                            key={index}
                                            className="flex items-center gap-4 px-5 py-4 bg-[#111118]
                                                       hover:bg-[#18181f] transition-all"
                                        >
                                            <div className={`w-9 h-9 rounded-lg flex items-center
                                                            justify-center text-sm flex-shrink-0
                                                            ${config.bg}`}>
                                                {config.icon}
                                            </div>
                                            <div className="flex-1 text-sm text-[#7a7a90]">
                                                {config.getText(item)}
                                            </div>
                                            <div className="font-mono text-[10px] text-[#7a7a90] flex-shrink-0">
                                                {timeAgo(item.time)}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="mt-4 text-center">
                                <Link to="/activity">
                                    <button className="px-6 py-3 border border-[#2a2a35] text-[#7a7a90]
                                                       font-mono text-xs rounded-lg
                                                       hover:border-[#c8ff57] hover:text-[#c8ff57]
                                                       transition-all">
                                        Show More Activity →
                                    </button>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-10">
                            <div className="text-4xl mb-3">🎮</div>
                            <div className="text-[#7a7a90] font-mono text-sm">
                                No activity yet. Start logging games!
                            </div>
                            <Link to="/library">
                                <button className="mt-4 px-5 py-2 bg-[#c8ff57] text-black
                                                   font-bold text-sm rounded
                                                   hover:bg-[#d4ff6e] transition-all">
                                    + Log a Game
                                </button>
                            </Link>
                        </div>
                    )}

                </section>
            )}

        </div>
    )
}

export default Home