import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import useGames from '../hooks/useGames'

function GameDetail() {

    const { igdbId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { games, addGame, updateGame } = useGames()

    const [game, setGame] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [activeTab, setActiveTab] = useState('overview')
    const [expanded, setExpanded] = useState(false)

    // My status state
    const [myStatus, setMyStatus] = useState('')
    const [myHours, setMyHours] = useState('')
    const [myRating, setMyRating] = useState('')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Find if this game is in my library
    const myGame = games.find(g =>
        g.igdbId === parseInt(igdbId) ||
        g.title?.toLowerCase() === game?.title?.toLowerCase()
    )

    // Populate my status from library
    useEffect(() => {
        if (myGame) {
            setMyStatus(myGame.status || '')
            setMyHours(myGame.hours || '')
            setMyRating(myGame.rating || '')
        }
    }, [myGame])

    // Fetch game details from IGDB
    useEffect(() => {
        const fetchGame = async () => {
            try {
                setLoading(true)
                setError(null)
                const res = await api.get(`/igdb/game/${igdbId}`)
                setGame(res.data.game)
            } catch (err) {
                console.error('Game detail error:', err)
                setError('Failed to load game details')
            } finally {
                setLoading(false)
            }
        }
        fetchGame()
    }, [igdbId])

    // Save status to library
    const handleSaveStatus = async () => {
        if (!user || !myStatus) return
        setSaving(true)
        try {
            if (myGame) {
                // Update existing
                await updateGame(myGame._id, {
                    status: myStatus,
                    hours: parseInt(myHours) || 0,
                    rating: parseFloat(myRating) || 0,
                })
            } else {
                // Add new game
                await addGame({
                    title: game.title,
                    genre: game.genre,
                    status: myStatus,
                    hours: parseInt(myHours) || 0,
                    rating: parseFloat(myRating) || 0,
                    cover: game.cover,
                    summary: game.summary,
                    igdbId: game.id,
                    platforms: game.platforms,
                })
            }
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            console.error('Save error:', err)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-[#7a7a90] font-mono text-sm">Loading...</div>
            </div>
        )
    }

    if (error || !game) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">😵</div>
                <div className="text-white font-mono text-sm">{error || 'Game not found'}</div>
                <button
                    onClick={() => navigate(-1)}
                    className="px-5 py-2 border border-[#2a2a35] text-[#7a7a90]
                     font-mono text-xs rounded hover:border-[#c8ff57]
                     hover:text-[#c8ff57] transition-all"
                >
                    ← Go Back
                </button>
            </div>
        )
    }

    const summaryText = game.summary || game.storyline || ''
    const isLong = summaryText.length > 300
    const displayText = isLong && !expanded
        ? summaryText.slice(0, 300) + '...'
        : summaryText

    const allTags = [
        ...game.keywords,
        ...game.themes
    ].filter(Boolean).slice(0, 12)

    const statusOptions = [
        { value: '', label: 'Select status...' },
        { value: 'playing', label: '▶  Playing' },
        { value: 'completed', label: '✓  Completed' },
        { value: 'planned', label: '📋  Planned' },
        { value: 'paused', label: '⏸  Paused' },
        { value: 'dropped', label: '✕  Dropped' },
    ]

    const statusConfig = {
        playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: '▶ Playing' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: '✓ Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: '📋 Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: '✕ Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: '⏸ Paused' },
    }

    return (
        <div className="min-h-screen">

            {/* ══════════════════════════════════
          HERO SECTION
      ══════════════════════════════════ */}
            <div className="relative overflow-hidden">

                {/* Blurred background */}
                {game.cover && (
                    <div
                        className="absolute inset-0 bg-cover bg-center scale-110"
                        style={{
                            backgroundImage: `url(${game.cover})`,
                            filter: 'blur(40px) brightness(0.15)',
                        }}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-b
                        from-transparent via-[#0a0a0f]/60 to-[#0a0a0f]" />

                {/* Content */}
                <div className="relative max-w-[1200px] mx-auto px-5 md:px-10 py-10">

                    {/* Back button */}
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 font-mono text-xs text-[#7a7a90]
                       hover:text-[#c8ff57] transition-colors mb-8"
                    >
                        ← BACK
                    </button>

                    <div className="flex flex-col md:flex-row gap-8 items-start">

                        {/* Cover */}
                        {game.cover && (
                            <div className="flex-shrink-0">
                                <img
                                    src={game.cover}
                                    alt={game.title}
                                    className="w-36 md:w-48 rounded-lg shadow-2xl"
                                />
                            </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">

                            {/* Title */}
                            <h1
                                className="font-black text-4xl md:text-6xl text-white
                           uppercase tracking-wide leading-none mb-2"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                                {game.title}
                            </h1>

                            {/* Tagline */}
                            {game.storyline && (
                                <p className="font-mono text-sm text-[#7a7a90] italic mb-4 max-w-xl">
                                    {game.storyline.slice(0, 100)}
                                    {game.storyline.length > 100 ? '...' : ''}
                                </p>
                            )}

                            {/* Tags row */}
                            <div className="flex flex-wrap gap-2 mb-6">
                                {game.genre && (
                                    <span className="font-mono text-[10px] uppercase tracking-wider
                                   px-2 py-1 border border-[#2a2a35] text-[#7a7a90] rounded">
                                        {game.genre}
                                    </span>
                                )}
                                {game.releaseYear && (
                                    <span className="font-mono text-[10px] uppercase tracking-wider
                                   px-2 py-1 border border-[#2a2a35] text-[#7a7a90] rounded">
                                        {game.releaseYear}
                                    </span>
                                )}
                                {game.developer && (
                                    <span className="font-mono text-[10px] uppercase tracking-wider
                                   px-2 py-1 border border-[#2a2a35] text-[#7a7a90] rounded">
                                        {game.developer}
                                    </span>
                                )}
                                {game.ageRating && (
                                    <span className="font-mono text-[10px] uppercase tracking-wider
                                   px-2 py-1 border border-[#2a2a35] text-[#7a7a90] rounded">
                                        {game.ageRating}
                                    </span>
                                )}
                                {game.modes && (
                                    <span className="font-mono text-[10px] uppercase tracking-wider
                                   px-2 py-1 border border-[#2a2a35] text-[#7a7a90] rounded">
                                        {game.modes}
                                    </span>
                                )}
                            </div>

                            {/* Scores row */}
                            <div className="flex gap-8 mb-8">
                                {game.criticScore && (
                                    <div>
                                        <div
                                            className="font-black text-4xl text-[#c8ff57] leading-none"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                        >
                                            {game.criticScore}
                                        </div>
                                        <div className="font-mono text-[10px] text-[#7a7a90]
                                    uppercase tracking-wider mt-1">
                                            Critic Score
                                        </div>
                                    </div>
                                )}
                                {game.userScore && (
                                    <div>
                                        <div
                                            className="font-black text-4xl text-[#5c9fff] leading-none"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                        >
                                            {game.userScore}
                                        </div>
                                        <div className="font-mono text-[10px] text-[#7a7a90]
                                    uppercase tracking-wider mt-1">
                                            AVG RATING
                                        </div>
                                    </div>
                                )}
                                {game.ratingCount > 0 && (
                                    <div>
                                        <div
                                            className="font-black text-4xl text-[#ff9f5c] leading-none"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                        >
                                            {game.ratingCount > 1000
                                                ? `${(game.ratingCount / 1000).toFixed(1)}K`
                                                : game.ratingCount}
                                        </div>
                                        <div className="font-mono text-[10px] text-[#7a7a90]
                                    uppercase tracking-wider mt-1">
                                            Logged
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-3">
                                {user ? (
                                    myGame ? (
                                        <div className={`flex items-center gap-2 px-4 py-2 rounded
                                    font-mono text-xs border
                                    ${statusConfig[myGame.status]?.bg || 'bg-[#c8ff57]/15'}
                                    ${statusConfig[myGame.status]?.color || 'text-[#c8ff57]'}
                                    border-current`}>
                                            {statusConfig[myGame.status]?.label || 'In Library'}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setMyStatus('planned')}
                                            className="px-4 py-2 bg-[#c8ff57] text-black font-bold
                                 text-xs rounded hover:bg-[#d4ff6e] transition-all"
                                        >
                                            + Add to Library
                                        </button>
                                    )
                                ) : (
                                    <Link to="/login">
                                        <button className="px-4 py-2 bg-[#c8ff57] text-black font-bold
                                       text-xs rounded hover:bg-[#d4ff6e] transition-all">
                                            Login to Track
                                        </button>
                                    </Link>
                                )}

                                <button
                                    onClick={() => navigator.clipboard.writeText(window.location.href)}
                                    className="px-4 py-2 border border-[#2a2a35] text-[#7a7a90]
                             font-mono text-xs rounded hover:border-[#c8ff57]
                             hover:text-[#c8ff57] transition-all"
                                >
                                    ↗ Share
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════
          TAB BAR
      ══════════════════════════════════ */}
            <div className="border-b border-[#2a2a35] bg-[#0a0a0f] sticky top-[65px] z-40">
                <div className="max-w-[1200px] mx-auto px-5 md:px-10">
                    <div className="flex gap-6">
                        {['overview', 'ratings'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`font-mono text-xs uppercase tracking-widest
                           py-4 border-b-2 transition-all
                           ${activeTab === tab
                                        ? 'border-[#c8ff57] text-[#c8ff57]'
                                        : 'border-transparent text-[#7a7a90] hover:text-white'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════ */}
            <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">

                    {/* ── Left Column ── */}
                    <div className="flex flex-col gap-6">

                        {/* About */}
                        {summaryText && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase
                                tracking-widest mb-4">
                                    About
                                </div>
                                <p className="text-[#c8c8d8] text-sm leading-relaxed">
                                    {displayText}
                                </p>
                                {isLong && (
                                    <button
                                        onClick={() => setExpanded(!expanded)}
                                        className="mt-3 font-mono text-xs text-[#c8ff57]
                               hover:underline transition-all"
                                    >
                                        {expanded ? 'Show less ↑' : 'Read more ↓'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Tags */}
                        {allTags.length > 0 && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase
                                tracking-widest mb-4">
                                    Tags
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {allTags.map(tag => (
                                        <span
                                            key={tag}
                                            className="font-mono text-[10px] uppercase tracking-wider
                                 px-3 py-1.5 border border-[#2a2a35] text-[#7a7a90]
                                 rounded hover:border-[#c8ff57] hover:text-[#c8ff57]
                                 transition-all cursor-default"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Screenshots */}
                        {game.screenshots?.length > 0 && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase
                                tracking-widest mb-4">
                                    Screenshots
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {game.screenshots.slice(0, 4).map((url, i) => (
                                        <img
                                            key={i}
                                            src={url}
                                            alt={`Screenshot ${i + 1}`}
                                            className="w-full rounded-lg object-cover h-32"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>

                    {/* ── Right Column ── */}
                    <div className="flex flex-col gap-6">

                        {/* My Status */}
                        {user && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase
                                tracking-widest mb-4">
                                    My Status
                                </div>

                                {/* Status dropdown */}
                                <select
                                    value={myStatus}
                                    onChange={e => setMyStatus(e.target.value)}
                                    className="w-full bg-[#18181f] border border-[#2a2a35] text-white
                             font-mono text-xs rounded px-3 py-2.5 mb-3
                             focus:outline-none focus:border-[#c8ff57] transition-all"
                                >
                                    {statusOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>

                                {/* Hours */}
                                <div className="flex items-center gap-3 mb-3">
                                    <label className="font-mono text-[10px] text-[#7a7a90]
    uppercase tracking-wider w-12 flex-shrink-0">
                                        Hours
                                    </label>
                                    <input
                                        type="number"
                                        value={myHours}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value)
                                            if (isNaN(val)) setMyHours('')
                                            else setMyHours(Math.max(0, val))
                                        }}
                                        placeholder="0"
                                        min="0"
                                        className="flex-1 bg-[#18181f] border border-[#2a2a35] text-white
                   font-mono text-xs rounded px-3 py-2.5
                   focus:outline-none focus:border-[#c8ff57] transition-all"
                                    />
                                </div>

                                {/* Rating */}
                                <div className="flex items-center gap-3 mb-4">
                                    <label className="font-mono text-[10px] text-[#7a7a90]
                                    uppercase tracking-wider w-12 flex-shrink-0">
                                        Rating
                                    </label>
                                    <input
                                        type="number"
                                        value={myRating}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value)
                                            if (isNaN(val)) setMyRating('')
                                            else setMyRating(Math.min(10, Math.max(0, val)))
                                        }}
                                        placeholder="0–10"
                                        min="0"
                                        max="10"
                                        step="0.5"
                                        className="flex-1 bg-[#18181f] border border-[#2a2a35] text-white
               font-mono text-xs rounded px-3 py-2.5
               focus:outline-none focus:border-[#c8ff57] transition-all"
                                    />
                                </div>

                                {/* Save button */}
                                <button
                                    onClick={handleSaveStatus}
                                    disabled={!myStatus || saving}
                                    className={`w-full py-3 font-bold text-xs font-mono uppercase
                             tracking-wider rounded transition-all
                             ${saved
                                            ? 'bg-[#5c9fff] text-white'
                                            : myStatus
                                                ? 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e]'
                                                : 'bg-[#2a2a35] text-[#7a7a90] cursor-not-allowed'
                                        }`}
                                >
                                    {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Status'}
                                </button>
                            </div>
                        )}

                        {/* Game Info */}
                        <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                            <div className="font-mono text-xs text-[#7a7a90] uppercase
                              tracking-widest mb-4">
                                Game Info
                            </div>
                            <div className="flex flex-col divide-y divide-[#2a2a35]">
                                {[
                                    { label: 'Developer', value: game.developer },
                                    { label: 'Publisher', value: game.publisher },
                                    { label: 'Release Year', value: game.releaseYear },
                                    { label: 'Engine', value: game.engine },
                                    { label: 'Modes', value: game.modes },
                                    { label: 'Rating', value: game.ageRating },
                                ].filter(i => i.value).map(item => (
                                    <div key={item.label}
                                        className="flex justify-between py-2.5 gap-4">
                                        <span className="font-mono text-[10px] text-[#7a7a90]
                                     uppercase tracking-wider flex-shrink-0">
                                            {item.label}
                                        </span>
                                        <span className="font-mono text-[11px] text-white
                                     text-right">
                                            {item.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Platforms */}
                        {game.platforms?.length > 0 && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase
                                tracking-widest mb-4">
                                    Platforms
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {game.platforms.map(p => (
                                        <span
                                            key={p}
                                            className="font-mono text-[10px] uppercase tracking-wider
                                 px-2.5 py-1 bg-[#2a2a35] text-[#7a7a90] rounded"
                                        >
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Similar Games */}
                        {game.similarGames?.length > 0 && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase
                                tracking-widest mb-4">
                                    Similar Games
                                </div>
                                <div className="flex flex-col gap-3">
                                    {game.similarGames.map(sg => (
                                        <Link
                                            key={sg.id}
                                            to={`/game/${sg.id}`}
                                            className="flex items-center gap-3
                                 hover:opacity-80 transition-opacity group"
                                        >
                                            {sg.cover ? (
                                                <img
                                                    src={sg.cover}
                                                    alt={sg.title}
                                                    className="w-10 h-14 object-cover rounded flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-10 h-14 bg-[#2a2a35] rounded
                                        flex-shrink-0 flex items-center
                                        justify-center text-sm">🎮</div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white text-xs font-semibold
                                        truncate group-hover:text-[#c8ff57]
                                        transition-colors">
                                                    {sg.title}
                                                </div>
                                                <div className="font-mono text-[9px] text-[#7a7a90] mt-1">
                                                    View details
                                                </div>
                                            </div>
                                            {sg.rating && (
                                                <div
                                                    className="font-black text-lg text-[#c8ff57] flex-shrink-0"
                                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                                >
                                                    {sg.rating}
                                                </div>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>

        </div>
    )
}

export default GameDetail