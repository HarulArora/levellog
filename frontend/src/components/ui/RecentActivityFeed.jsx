import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useGamesContext } from '../../context/GamesContext'
import { useSection } from '../../context/SectionState'
import useCachedFetch from '../../hooks/useCachedFetch'
import { Trophy, Play, Star, ListChecks, X, Pause, Gamepad2, Users, Film, Tv, BookOpen } from 'lucide-react'
import Shuriken from './Shuriken'
import { getIGDBImage, SIZES } from '../../utils/igdb'
import Skeleton from './Skeleton'

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
            icon: <Trophy size={14} />,
            bg: 'bg-[#5c9fff]/15 text-[#5c9fff]',
            getText: (a) => {
                const m = getMedia(a);
                const path = getPath(a);
                const action = m.mediaType === 'manga' ? 'Finished' : 'Completed';
                const displayTitle = m.title_english || m.title;
                return (
                    <>
                        {action}{' '}
                        <span
                            onClick={() => path !== '#' && navigate(path)}
                            className={`text-[#c8ff57] font-bold ${path !== '#' ? 'cursor-pointer hover:underline' : ''}`}
                        >
                            {displayTitle}
                        </span>
                        {a.rating ? ` — rated it ${a.rating}/10` : ''}
                    </>
                );
            }
        },
        playing: {
            icon: <Play size={14} fill="currentColor" />,
            bg: 'bg-[#c8ff57]/15 text-[#c8ff57]',
            getText: (a) => {
                const m = getMedia(a);
                const path = getPath(a);
                let action = 'Started playing';
                if (m.mediaType === 'movie' || m.mediaType === 'tv' || m.mediaType === 'anime') action = 'Started watching';
                if (m.mediaType === 'manga') action = 'Started reading';
                const displayTitle = m.title_english || m.title;
                return (
                    <>
                        {action}{' '}
                        <span
                            onClick={() => path !== '#' && navigate(path)}
                            className={`text-[#c8ff57] font-bold ${path !== '#' ? 'cursor-pointer hover:underline' : ''}`}
                        >
                            {displayTitle}
                        </span>
                    </>
                );
            }
        },
        rated: {
            icon: <Star size={14} fill="currentColor" />,
            bg: 'bg-[#ff9f5c]/15 text-[#ff9f5c]',
            getText: (a) => {
                const m = getMedia(a);
                const path = getPath(a);
                const displayTitle = m.title_english || m.title;
                return (
                    <>
                        Rated{' '}
                        <span
                            onClick={() => path !== '#' && navigate(path)}
                            className={`text-[#c8ff57] font-bold ${path !== '#' ? 'cursor-pointer hover:underline' : ''}`}
                        >
                            {displayTitle}
                        </span>
                        {` ${a.rating}/10`}
                    </>
                );
            }
        },
        planned: {
            icon: <ListChecks size={14} />,
            bg: 'bg-[#2a2a35] text-[#e8e8f0]',
            getText: (a) => {
                const m = getMedia(a);
                const path = getPath(a);
                const displayTitle = m.title_english || m.title;
                return (
                    <>
                        Added{' '}
                        <span
                            onClick={() => path !== '#' && navigate(path)}
                            className={`text-[#c8ff57] font-bold ${path !== '#' ? 'cursor-pointer hover:underline' : ''}`}
                        >
                            {displayTitle}
                        </span>
                        {' to library'}
                    </>
                );
            }
        },
        dropped: {
            icon: <X size={14} strokeWidth={3} />,
            bg: 'bg-[#ff5c5c]/15 text-[#ff5c5c]',
            getText: (a) => {
                const m = getMedia(a);
                const path = getPath(a);
                const displayTitle = m.title_english || m.title;
                return (
                    <>
                        Dropped{' '}
                        <span
                            onClick={() => path !== '#' && navigate(path)}
                            className={`text-[#c8ff57] font-bold ${path !== '#' ? 'cursor-pointer hover:underline' : ''}`}
                        >
                            {displayTitle}
                        </span>
                        {a.hours ? ` after ${a.hours}h` : ''}
                    </>
                );
            }
        },
        paused: {
            icon: <Pause size={14} fill="currentColor" />,
            bg: 'bg-[#c45cff]/15 text-[#c45cff]',
            getText: (a) => {
                const m = getMedia(a);
                const path = getPath(a);
                const displayTitle = m.title_english || m.title;
                return (
                    <>
                        Paused{' '}
                        <span
                            onClick={() => path !== '#' && navigate(path)}
                            className={`text-[#c8ff57] font-bold ${path !== '#' ? 'cursor-pointer hover:underline' : ''}`}
                        >
                            {displayTitle}
                        </span>
                    </>
                );
            }
        }
    };
};

const SUB_TABS = [
    { id: 'all', label: 'All', icon: <Star size={12} /> },
    { id: 'game', label: 'Games', icon: <Gamepad2 size={12} /> },
    { id: 'movie', label: 'Movies', icon: <Film size={12} /> },
    { id: 'tv', label: 'TV Shows', icon: <Tv size={12} /> },
    { id: 'anime', label: 'Anime', icon: <Shuriken size={12} /> },
    { id: 'manga', label: 'Manga', icon: <BookOpen size={12} /> },
]

function RecentActivityFeed({ defaultMedia = 'all' }) {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { games: myGames } = useGamesContext()
    
    const activityConfig = useMemo(() => makeActivityConfig(navigate), [navigate])
    const [mainTab, setMainTab] = useState('mine')
    const [subTab, setSubTab] = useState(defaultMedia)

    const userId = user?.id || user?._id

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
    const activityRaw = useMemo(() => activityData?.activity ?? [], [activityData])
    const feedRaw = useMemo(() => feedData?.games ?? [], [feedData])

    const filteredActivity = useMemo(() => {
        if (subTab === 'all') return activityRaw
        return activityRaw.filter(a => {
            const m = a.game || a.movie || a.anime || a.manga;
            return m?.mediaType === subTab;
        })
    }, [activityRaw, subTab])

    const filteredFeed = useMemo(() => {
        if (subTab === 'all') return feedRaw
        return feedRaw.filter(f => f.mediaType === subTab)
    }, [feedRaw, subTab])

    const statusConfig = {
        playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Playing' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
        Playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Playing' },
        Completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        Planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        Dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        Paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
    }

    const getMyRating = (gameTitle) => {
        if (!myGames) return null
        const match = myGames.find(
            g => g.title.toLowerCase() === gameTitle.toLowerCase()
        )
        return match?.rating > 0 ? match.rating : null
    }

    if (!user) return null

    return (
        <section className="max-w-[1200px] mx-auto px-5 md:px-10 py-16 border-t border-[#2a2a35]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h2 className="font-black text-2xl tracking-widest uppercase text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        Quest <span className="text-[#c8ff57]">Feed</span>
                    </h2>
                    <p className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-[0.2em]">Activity across the pond</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setMainTab('mine')}
                        className={`px-4 py-2 rounded font-mono text-[10px] uppercase tracking-wider border transition-all
                                   ${mainTab === 'mine' ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/5' : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'}`}
                    >
                        My Activity
                    </button>
                    <button
                        onClick={() => setMainTab('feed')}
                        className={`px-4 py-2 rounded font-mono text-[10px] uppercase tracking-wider border transition-all
                                   ${mainTab === 'feed' ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/5' : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'}`}
                    >
                        Following
                    </button>
                </div>
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

            {loading ? (
                <div className="flex flex-col gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-5 py-4 bg-[#111118] border border-[#2a2a35] rounded-lg animate-pulse">
                            <div className="w-9 h-9 bg-[#2a2a35] rounded-lg" />
                            <div className="flex-1 h-4 bg-[#2a2a35] rounded" />
                        </div>
                    ))}
                </div>
            ) : mainTab === 'mine' ? (
                <>
                    {filteredActivity.length > 0 ? (
                        <div className="flex flex-col divide-y divide-[#2a2a35] border border-[#2a2a35] rounded-lg overflow-hidden">
                            {filteredActivity.slice(0, 6).map((item, index) => {
                                const config = activityConfig[item.type] || activityConfig.planned
                                return (
                                    <div key={index} className="flex items-center gap-4 px-5 py-4 bg-[#111118] hover:bg-[#18181f] transition-all group">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${config.bg} transition-transform group-hover:scale-110`}>
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
                    ) : (
                        <div className="text-center py-20 bg-[#111118] border border-[#2a2a35] border-dashed rounded-xl">
                            <div className="text-[#3a3a4a] mb-4 flex justify-center"><Star size={40} opacity={0.3} /></div>
                            <div className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest">No activity found for this category</div>
                        </div>
                    )}
                </>
            ) : (
                <>
                    {filteredFeed.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredFeed.slice(0, 6).map(item => {
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

                                const displayTitle = item.title_english || item.title

                                return (
                                    <div key={item._id} className="bg-[#111118] border border-[#2a2a35] rounded-xl p-4 hover:border-[#c8ff57]/30 transition-all flex items-center gap-4">
                                        <div 
                                            onClick={() => detailPath !== '#' && navigate(detailPath)}
                                            className={`w-16 h-12 bg-cover bg-center bg-[#18181f] rounded-lg flex-shrink-0 relative ${detailPath !== '#' ? 'cursor-pointer' : ''}`}
                                            style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'none' }}
                                        >
                                            {!imageUrl && <div className="w-full h-full flex items-center justify-center text-xl">{isGame ? '🎮' : '🎬'}</div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div 
                                                onClick={() => detailPath !== '#' && navigate(detailPath)}
                                                className={`text-white font-bold text-sm truncate mb-1 ${detailPath !== '#' ? 'cursor-pointer hover:text-[#c8ff57]' : ''}`}
                                            >
                                                {displayTitle}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${sc.bg} ${sc.color}`}>{sc.label}</span>
                                                <span className="font-mono text-[9px] text-[#7a7a90]">
                                                    by <Link to={`/user/${item.userId?.username}`} className="text-[#c8ff57] hover:underline">{item.userId?.username}</Link>
                                                </span>
                                            </div>
                                        </div>
                                        {item.rating > 0 && (
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <div className="font-black text-xl text-[#5c9fff] leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                    {item.rating}
                                                </div>
                                                {myRating && (
                                                    <div className="flex items-center gap-1 bg-[#c8ff57]/10 border border-[#c8ff57]/20 rounded px-1 py-0.5">
                                                        <span className="font-mono text-[7px] text-[#c8ff57] font-bold uppercase leading-none">me: {myRating}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-[#111118] border border-[#2a2a35] border-dashed rounded-xl">
                            <div className="text-[#3a3a4a] mb-4 flex justify-center"><Users size={40} opacity={0.3} /></div>
                            <div className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest">No follow activity in this category</div>
                        </div>
                    )}
                </>
            )}

            <div className="mt-8 flex justify-center">
                <Link to="/activity">
                    <button className="px-8 py-3 bg-[#111118] border border-[#2a2a35] text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest rounded-lg hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">
                        View Full Odyssey →
                    </button>
                </Link>
            </div>
        </section>
    )
}

export default RecentActivityFeed

