import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGamesContext } from '../context/GamesContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { Trophy, Play, Star, ListChecks, X, Pause, Gamepad2, Users, ArrowLeft, Film, Tv, BookOpen } from 'lucide-react'
import Shuriken from '../components/ui/Shuriken'

const SUB_TABS = [
    { id: 'all', label: 'All', icon: <Star size={12} /> },
    { id: 'game', label: 'Games', icon: <Gamepad2 size={12} /> },
    { id: 'movie', label: 'Movies', icon: <Film size={12} /> },
    { id: 'tv', label: 'TV Shows', icon: <Tv size={12} /> },
    { id: 'anime', label: 'Anime', icon: <Shuriken size={12} /> },
    { id: 'manga', label: 'Manga', icon: <BookOpen size={12} /> },
]

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

const makeActivityConfig = (navigate) => {
    const getPath = (item) => {
        const media = item.game || item.movie || item.anime || item.manga;
        if (!media) return '#';
        const id = media.igdbId || media.externalId;
        const type = media.mediaType || 'game';
        
        if (type === 'game') return `/game/${id}`;
        if (type === 'anime') return `/anime/${id}`;
        if (type === 'manga') return `/manga/${id}`;
        if (type === 'tv') return `/tv/${id}`;
        if (type === 'movie') return `/movies/${id}`;
        return '#';
    };

    const getMedia = (a) => a.game || a.movie || a.anime || a.manga;

    const config = {
        completed: {
            icon: <Trophy size={16} />,
            bg: 'bg-[#5c9fff]/15 text-[#5c9fff]',
            getText: (a) => {
                const m = getMedia(a);
                const path = getPath(a);
                const action = m.mediaType === 'manga' ? 'Finished' : 'Completed';
                return (
                    <>
                        {action}{' '}
                        <span
                            onClick={() => path !== '#' && navigate(path)}
                            className={`text-[#c8ff57] font-bold ${path !== '#' ? 'cursor-pointer hover:underline' : ''}`}
                        >
                            {m.title}
                        </span>
                        {a.rating ? ` — rated it ${a.rating}/10` : ''}
                    </>
                );
            }
        },
        playing: {
            icon: <Play size={16} fill="currentColor" />,
            bg: 'bg-[#c8ff57]/15 text-[#c8ff57]',
            getText: (a) => {
                const m = getMedia(a);
                const path = getPath(a);
                let action = 'Started playing';
                if (m.mediaType === 'movie' || m.mediaType === 'tv' || m.mediaType === 'anime') action = 'Started watching';
                if (m.mediaType === 'manga') action = 'Started reading';
                return (
                    <>
                        {action}{' '}
                        <span
                            onClick={() => path !== '#' && navigate(path)}
                            className={`text-[#c8ff57] font-bold ${path !== '#' ? 'cursor-pointer hover:underline' : ''}`}
                        >
                            {m.title}
                        </span>
                    </>
                );
            }
        },
        rated: {
            icon: <Star size={16} fill="currentColor" />,
            bg: 'bg-[#ff9f5c]/15 text-[#ff9f5c]',
            getText: (a) => {
                const m = getMedia(a);
                const path = getPath(a);
                return (
                    <>
                        Rated{' '}
                        <span
                            onClick={() => path !== '#' && navigate(path)}
                            className={`text-[#c8ff57] font-bold ${path !== '#' ? 'cursor-pointer hover:underline' : ''}`}
                        >
                            {m.title}
                        </span>
                        {` ${a.rating}/10`}
                    </>
                );
            }
        },
        planned: {
            icon: <ListChecks size={16} />,
            bg: 'bg-[#2a2a35] text-[#e8e8f0]',
            getText: (a) => {
                const m = getMedia(a);
                const path = getPath(a);
                return (
                    <>
                        Added{' '}
                        <span
                            onClick={() => path !== '#' && navigate(path)}
                            className={`text-[#c8ff57] font-bold ${path !== '#' ? 'cursor-pointer hover:underline' : ''}`}
                        >
                            {m.title}
                        </span>
                        {' to planned list'}
                    </>
                );
            }
        },
        dropped: {
            icon: <X size={16} strokeWidth={3} />,
            bg: 'bg-[#ff5c5c]/15 text-[#ff5c5c]',
            getText: (a) => {
                const m = getMedia(a);
                const path = getPath(a);
                return (
                    <>
                        Dropped{' '}
                        <span
                            onClick={() => path !== '#' && navigate(path)}
                            className={`text-[#c8ff57] font-bold ${path !== '#' ? 'cursor-pointer hover:underline' : ''}`}
                        >
                            {m.title}
                        </span>
                        {a.hours ? ` after ${a.hours}h` : ''}
                    </>
                );
            }
        },
        paused: {
            icon: <Pause size={16} fill="currentColor" />,
            bg: 'bg-[#c45cff]/15 text-[#c45cff]',
            getText: (a) => {
                const m = getMedia(a);
                const path = getPath(a);
                return (
                    <>
                        Paused{' '}
                        <span
                            onClick={() => path !== '#' && navigate(path)}
                            className={`text-[#c8ff57] font-bold ${path !== '#' ? 'cursor-pointer hover:underline' : ''}`}
                        >
                            {m.title}
                        </span>
                    </>
                );
            }
        }
    };
    config.watching = config.playing;
    config.reading = config.playing;
    return config;
};

function Activity() {
    const { user } = useAuth()
    const { games: myGames } = useGamesContext()
    const navigate = useNavigate()

    const activityConfig = makeActivityConfig(navigate)
    const [subTab, setSubTab] = useState('all')
    const [visibleCount, setVisibleCount] = useState(10)
    const observerTarget = useRef(null)

    const userId = user?.id || user?._id

    // Cached — instant on return within 2 min
    const { data: activityData, loading } = useCachedFetch(
        userId ? `activity_${userId}` : null,
        userId ? `/auth/activity/${userId}` : null,
        { enabled: !!userId, ttl: 2 * 60 * 1000 }
    )

    const activity = activityData?.activity ?? []

    const filteredActivity = useMemo(() => {
        if (subTab === 'all') return activity
        return activity.filter(a => {
            const m = a.game || a.movie || a.anime || a.manga;
            return m?.mediaType === subTab;
        })
    }, [activity, subTab])

    // Reset visibility when category changes
    useEffect(() => {
        setVisibleCount(10)
    }, [subTab])

    // Progressive Lazy Loading / Infinite Scroll
    useEffect(() => {
        const limit = Math.min(100, filteredActivity.length)
        if (!filteredActivity.length || visibleCount >= limit) return

        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting) {
                    setVisibleCount(prev => Math.min(prev + 10, limit))
                }
            },
            { threshold: 0.1, rootMargin: '150px' }
        )

        if (observerTarget.current) observer.observe(observerTarget.current)
        return () => observer.disconnect()
    }, [filteredActivity.length, visibleCount])

    const statusConfig = {
        playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Playing' },
        watching: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Watching' },
        reading: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Reading' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
        // TitleCase variants for robustness
        Playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Playing' },
        Watching: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Watching' },
        Reading: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Reading' },
        Completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        Planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        Dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        Paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
    }

    const getMyRating = (gameTitle) => {
        const match = myGames.find(
            g => g.title.toLowerCase() === gameTitle.toLowerCase()
        )
        return match?.rating > 0 ? match.rating : null
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-[#c8ff57] mb-2"><Gamepad2 size={56} strokeWidth={1.5} /></div>
                <div
                    className="text-white font-black text-2xl tracking-widest uppercase"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                    Login to see activity
                </div>
                <Link to="/login">
                    <button className="btn-apple btn-apple-primary px-8 py-3">
                        Login
                    </button>
                </Link>
            </div>
        )
    }

    if (loading && activity.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-[#7a7a90] font-mono text-sm">Loading...</div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-[800px] mx-auto px-3 sm:px-6 md:px-10 pt-4 pb-10 overflow-x-hidden">

            {/* Header */}
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-[#2a2a35]">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#2a2a35] text-[#7a7a90] hover:text-[#c8ff57] hover:border-[#c8ff57]/30 bg-[#111118] transition-all"
                >
                    <ArrowLeft size={16} />
                </button>
                <h2
                    className="font-black text-2xl md:text-3xl tracking-widest uppercase text-white"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                    Activity <span className="text-[#c8ff57]">Odyssey</span>
                </h2>
            </div>

            {/* Media Sub-Tabs */}
            <div className="flex flex-wrap gap-2 mb-8 p-1 bg-[#111118] border border-[#2a2a35] rounded-lg inline-flex">
                {SUB_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSubTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-[9px] uppercase tracking-widest transition-all
                                   ${subTab === tab.id ? 'bg-[#c8ff57] text-black font-bold' : 'text-[#7a7a90] hover:text-white'}`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── My Activity ── */}
            {filteredActivity.length > 0 ? (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col divide-y divide-[#2a2a35]
                        border border-[#2a2a35] rounded-lg overflow-hidden">
                        {filteredActivity.slice(0, visibleCount).map((item, index) => {
                            const config = activityConfig[item.type] || activityConfig.planned
                            return (
                                <div
                                    key={index}
                                    className="flex items-center gap-2 md:gap-4 px-2 md:px-5 py-3 md:py-4 bg-[#111118]
                           hover:bg-[#18181f] transition-all"
                                >
                                    <div className={`w-9 h-9 rounded-lg flex items-center
                                 justify-center text-sm flex-shrink-0
                                 ${config.bg}`}>
                                        {config.icon}
                                    </div>
                                    <div className="flex-1 text-[13px] md:text-sm text-[#7a7a90]">
                                        {config.getText(item)}
                                    </div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] flex-shrink-0">
                                        {timeAgo(item.time)}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {visibleCount < Math.min(100, filteredActivity.length) && (
                        <div ref={observerTarget} className="flex items-center justify-center py-6 text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest animate-pulse mt-4">
                            Loading more activity...
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-16 flex flex-col items-center">
                    <Gamepad2 size={48} className="text-[#2a2a35] mb-4" />
                    <div className="text-[#7a7a90] font-mono text-sm mb-4">
                        No activity found in this category.
                    </div>
                </div>
            )}

        </div>
    )
}

export default Activity
