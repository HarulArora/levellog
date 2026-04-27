import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGamesContext } from '../context/GamesContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { Trophy, Play, Star, ListChecks, X, Pause, Gamepad2, Users } from 'lucide-react'
import { getIGDBImage, SIZES } from '../utils/igdb'

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

    return {
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
};

function Activity() {
    const { user } = useAuth()
    const { games: myGames } = useGamesContext()
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('mine')

    const activityConfig = makeActivityConfig(navigate)

    const userId = user?.id || user?._id

    // Cached — instant on return within 2 min
    const { data: activityData, loading: loadingActivity } = useCachedFetch(
        userId ? `activity_${userId}` : null,
        userId ? `/auth/activity/${userId}` : null,
        { enabled: !!userId, ttl: 2 * 60 * 1000 }
    )
    const { data: feedData, loading: loadingFeed } = useCachedFetch(
        userId ? `feed_${userId}` : null,
        userId ? '/auth/feed' : null,
        { enabled: !!userId, ttl: 2 * 60 * 1000 }
    )

    const loading = loadingActivity || loadingFeed
    const activity = activityData?.activity ?? []
    const feed     = feedData?.games ?? []

    const statusConfig = {
        playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Playing' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
        // TitleCase variants for robustness
        Playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Playing' },
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

    if (loading && activity.length === 0 && feed.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-[#7a7a90] font-mono text-sm">Loading...</div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-[800px] mx-auto px-3 sm:px-6 md:px-10 py-6 md:py-10 overflow-x-hidden">

            {/* Header */}
            <div className="flex items-baseline gap-4 mb-6 pb-4 border-b border-[#2a2a35]">
                <h2
                    className="font-black text-2xl md:text-3xl tracking-widest uppercase text-white"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                    Activity
                </h2>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5 mb-5">
                <button
                    onClick={() => setActiveTab('mine')}
                    className={`px-4 py-2 rounded font-mono text-xs uppercase
                     tracking-wider border transition-all
                     ${activeTab === 'mine'
                            ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/06'
                            : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'
                        }`}
                >
                    My Activity
                </button>
                <button
                    onClick={() => setActiveTab('feed')}
                    className={`px-4 py-2 rounded font-mono text-xs uppercase
                     tracking-wider border transition-all
                     ${activeTab === 'feed'
                            ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/06'
                            : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'
                        }`}
                >
                    Following Feed
                </button>
            </div>

            {/* ── My Activity Tab ── */}
            {activeTab === 'mine' && (
                <>
                    {activity.length > 0 ? (
                        <div className="flex flex-col divide-y divide-[#2a2a35]
                            border border-[#2a2a35] rounded-lg overflow-hidden">
                            {activity.map((item, index) => {
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
                    ) : (
                        <div className="text-center py-16 flex flex-col items-center">
                            <Gamepad2 size={48} className="text-[#2a2a35] mb-4" />
                            <div className="text-[#7a7a90] font-mono text-sm mb-4">
                                No activity yet. Start your odyssey!
                            </div>
                            <Link to="/library">
                                <button className="btn-apple btn-apple-primary px-6 py-2.5">
                                    + Add to Pond
                                </button>
                            </Link>
                        </div>
                    )}
                </>
            )}

            {/* ── Following Feed Tab ── */}
            {activeTab === 'feed' && (
                <>
                    {feed.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            {feed.map(item => {
                                const sc = statusConfig[item.status] || statusConfig.planned
                                const isGame = item.mediaType === 'game'
                                const imageUrl = isGame 
                                    ? getIGDBImage(item.cover || (item.steamId ? `https://cdn.akamai.steamstatic.com/steam/apps/${item.steamId}/header.jpg` : null), SIZES.THUMB)
                                    : item.cover

                                const myRating = getMyRating(item.title)
                                const id = item.igdbId || item.externalId
                                const pathMap = {
                                    game: `/game/${id}`,
                                    anime: `/anime/${id}`,
                                    manga: `/manga/${id}`,
                                    movie: `/movies/${id}`,
                                    tv: `/tv/${id}`
                                }
                                const detailPath = pathMap[item.mediaType] || '#'

                                return (
                                    <div
                                        key={item._id}
                                        className="bg-[#111118] border border-[#2a2a35] rounded-lg
                               overflow-hidden hover:border-[#c8ff57]/30 transition-all w-full"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4 p-3 md:p-4">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">

                                            {/* Cover — clickable if ID exists */}
                                            <div
                                                onClick={() => detailPath !== '#' && navigate(detailPath)}
                                                className={`w-10 h-7.5 md:w-16 md:h-12 bg-cover bg-center bg-[#18181f]
                                   rounded-sm flex-shrink-0 relative
                                   ${detailPath !== '#' ? 'cursor-pointer' : ''}`}
                                                style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'none' }}
                                            >
                                                {!imageUrl && (
                                                    <div className="w-full h-full flex items-center
                                          justify-center text-xl">{isGame ? '🎮' : '🎬'}</div>
                                                )}
                                                
                                                {/* Community Average Rating Badge */}
                                                {item.avgRating > 0 && (
                                                    <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5 bg-black/80 backdrop-blur-md border border-[#5c9fff]/30 rounded px-0.5 py-0.2 shadow-lg z-10">
                                                        <Star size={7} className="text-[#5c9fff] fill-current" />
                                                        <span className="font-black text-[9px] text-[#5c9fff]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.avgRating}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div
                                                    onClick={() => detailPath !== '#' && navigate(detailPath)}
                                                    className={`text-white font-semibold text-[13px] md:text-sm truncate mb-1
                                      ${detailPath !== '#' ? 'cursor-pointer hover:text-[#c8ff57] transition-colors' : ''}`}
                                                >
                                                    {item.title}
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`font-mono text-[9px] uppercase
                                           tracking-wider px-2 py-[2px]
                                           rounded-sm ${sc.bg} ${sc.color}`}>
                                                        {sc.label}
                                                    </span>
                                                    {item.userId?.username && (
                                                        <span className="font-mono text-[9px] md:text-[10px] text-[#7a7a90]">
                                                            by{' '}
                                                            <Link
                                                                to={`/user/${item.userId.username}`}
                                                                className="text-[#7a7a90] hover:text-[#c8ff57] transition-colors truncate max-w-[40px] md:max-w-none inline-block align-bottom"
                                                            >
                                                                {item.userId.username}
                                                            </Link>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                            {/* Ratings column — stacks on mobile, row on desktop */}
                                                                                        {!(item.rating > 0 && myRating) && (
                                                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 md:gap-1 flex-shrink-0 pt-2 sm:pt-0 border-t border-[#2a2a35]/40 sm:border-t-0">

                                                {/* Friend's rating — BLUE */}
                                                {item.rating > 0 && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-[8px] md:text-[9px] text-[#7a7a90]
                                             uppercase tracking-wider max-w-[60px] md:max-w-none truncate text-right">
                                                            {item.userId?.username
                                                                ? `${item.userId.username}'s`
                                                                : "friend's"}
                                                        </span>
                                                        <div
                                                            className="font-black text-sm md:text-xl text-[#5c9fff] leading-none"
                                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                                        >
                                                            {item.rating}
                                                            <small className="font-mono text-[8px] md:text-[9px] text-[#7a7a90] font-normal">
                                                                /10
                                                            </small>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* My rating — GREEN */}
                                                {myRating ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-[8px] md:text-[9px] text-[#7a7a90]
                                             uppercase tracking-wider">
                                                            my rating
                                                        </span>
                                                        <div
                                                            className="font-black text-sm md:text-xl text-[#c8ff57] leading-none"
                                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                                        >
                                                            {myRating}
                                                            <small className="font-mono text-[8px] md:text-[9px] text-[#7a7a90] font-normal">
                                                                /10
                                                            </small>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="font-mono text-[8px] md:text-[9px] text-[#2a2a35]
                                          uppercase tracking-wider">
                                                        not rated
                                                    </div>
                                                )}

                                                </div>
                                            )}

                                            {/* Date */}
                                            <div className="font-mono text-[10px] text-[#7a7a90]
                                     flex-shrink-0 hidden sm:block ml-2">
                                                {new Date(item.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric'
                                                })}
                                            </div>

                                        </div>

                                        {/* Comparison bars — only if both rated */}
                                        {item.rating > 0 && myRating && (
                                            <div className="px-3 md:px-4 pb-3 flex flex-col gap-1">

                                                {/* Friend bar — BLUE */}
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[8px] md:text-[9px] text-[#7a7a90] w-10 md:w-14 text-right truncate">
                                                        {item.userId?.username?.slice(0, 8) || 'friend'}
                                                    </span>
                                                    <div className="flex-1 relative h-1 md:h-1.5 bg-[#2a2a35] rounded-full">
                                                        <div
                                                            className="absolute left-0 top-0 h-full rounded-full bg-[#5c9fff]"
                                                            style={{ width: `${(item.rating / 10) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="font-mono text-[8px] md:text-[9px] text-[#5c9fff] w-4 text-right">
                                                        {item.rating}
                                                    </span>
                                                </div>

                                                {/* My bar — GREEN */}
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[8px] md:text-[9px] text-[#7a7a90] w-10 md:w-14 text-right">
                                                        you
                                                    </span>
                                                    <div className="flex-1 relative h-1 md:h-1.5 bg-[#2a2a35] rounded-full">
                                                        <div
                                                            className="absolute left-0 top-0 h-full rounded-full bg-[#c8ff57]"
                                                            style={{ width: `${(myRating / 10) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="font-mono text-[8px] md:text-[9px] text-[#c8ff57] w-3 md:w-4 text-right flex-shrink-0">
                                                        {myRating}
                                                    </span>
                                                </div>

                                            </div>
                                        )}

                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Users size={56} className="text-[#2a2a35] mb-2" strokeWidth={1.5} />
                            <div
                                className="text-white font-black text-xl tracking-widest uppercase"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                                No Activity Yet
                            </div>
                            <div className="text-[#7a7a90] font-mono text-sm text-center max-w-sm mb-2">
                                Follow other gamers to see their games here
                            </div>
                            <Link to="/search">
                                <button className="btn-apple btn-apple-primary px-6 py-2.5">
                                    Find Friends
                                </button>
                            </Link>
                        </div>
                    )}
                </>
            )}

        </div>
    )
}

export default Activity
