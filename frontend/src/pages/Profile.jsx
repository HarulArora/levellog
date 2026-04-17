import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { invalidateCache } from '../utils/cache'
import { useFollow } from '../context/FollowContext'
import FollowListModal from '../components/profile/FollowListModal'
import { Frown, Gamepad2, Lock, Globe, Pencil, BarChart2, List } from 'lucide-react'
import { getIGDBImage, SIZES } from '../utils/igdb'

function Profile() {
    const { username } = useParams()
    const navigate = useNavigate()
    const { user: currentUser } = useAuth()

    const [privacyLoading, setPrivacyLoading] = useState(false)
    const [followModal, setFollowModal] = useState(null)
    const [xpToast, setXpToast] = useState(null)
    const [activeTab, setActiveTab] = useState('games')
    const [selectedList, setSelectedList] = useState(null)

    // ── CACHED FETCHES ──
    const { data: profileData, loading: profileLoading, error: profileError, refetch: refetchProfile } = useCachedFetch(
        `profile_${username}`,
        `/auth/profile/${username}`,
        { ttl: 5 * 6 * 1000, deps: [username] }
    )

    const user = profileData?.user
    const isOwnProfile = currentUser?.username === username
    const { getFollowStatus, handleFollowToggle, loadingMap } = useFollow()
    
    const followStatus = getFollowStatus(user)
    const isFollowing = followStatus === 'following'
    const requestSent = followStatus === 'requested'
    const canSeeGames = !user?.isPrivate || isOwnProfile || isFollowing

    const { data: gamesData } = useCachedFetch(
        user?._id && canSeeGames ? `profile_games_${user._id}` : null,
        user?._id && canSeeGames ? `/games/user/${user._id}` : null,
        { enabled: !!user?._id && canSeeGames, deps: [user?._id] }
    )

    const { data: listsData } = useCachedFetch(
        user?._id && canSeeGames ? `profile_lists_${user._id}` : null,
        user?._id && canSeeGames ? `/lists/user/${user._id}` : null,
        { enabled: !!user?._id && canSeeGames, deps: [user?._id] }
    )

    const loading = profileLoading
    const error = profileError
    const games = gamesData?.games || []
    const lists = listsData?.lists || []
    const followLoading = user ? loadingMap[user._id] : false

    const showXpToast = (msg, type = 'gain') => {
        setXpToast({ msg, type })
        setTimeout(() => setXpToast(null), 3000)
    }

    const statusConfig = {
        playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Playing' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
    }



    const visibleLists = useMemo(() => {
        if (!lists.length) return []
        if (isOwnProfile) return lists
        return lists.filter(l => l.isPublic)
    }, [lists, isOwnProfile])

    const handleInvalidateAndRefetch = useCallback(() => {
        invalidateCache(`profile_${username}`)
        if (user?._id) {
            invalidateCache(`profile_games_${user._id}`)
            invalidateCache(`profile_lists_${user._id}`)
        }
        refetchProfile(true) // 🚀 Silent refetch (background)
    }, [username, user?._id, refetchProfile])

    // ── STATS ──
    const stats = useMemo(() => {
        // Fallback to manual calculation if gameStats is missing (legacy support)
        const s = user?.gameStats || {}
        return {
            total: s.total ?? games.length,
            completed: s.completed ?? games.filter(g => g.status === 'completed').length,
            playing: s.playing ?? games.filter(g => g.status === 'playing').length,
            planned: s.planned ?? games.filter(g => g.status === 'planned').length,
            dropped: s.dropped ?? games.filter(g => g.status === 'dropped').length,
            paused: s.paused ?? games.filter(g => g.status === 'paused').length,
            hours: s.totalHours ?? games.reduce((sum, g) => sum + (g.hours || 0), 0),
            avgRating: s.avgRating ?? (games.filter(g => g.rating > 0).length > 0
                ? (games.filter(g => g.rating > 0).reduce((sum, g) => sum + g.rating, 0) /
                    games.filter(g => g.rating > 0).length).toFixed(1)
                : null),
            rated: s.ratingCount ?? games.filter(g => g.rating > 0).length,
        }
    }, [user, games])

    const recentGames = games.slice(0, 6)

    // ── FOLLOW / UNFOLLOW ──
    const handleFollow = async () => {
        if (!user) return
        const result = await handleFollowToggle(user)
        if (result.success) {
            if (result.type === 'unfollowed') showXpToast('Unfollowed · -1 XP', 'loss')
            else if (result.type === 'cancelled') showXpToast('Follow request cancelled', 'loss')
            else if (result.type === 'requested') showXpToast('Follow request sent · XP awarded on accept', 'pending')
            else showXpToast('Following · +1 XP', 'gain')
            handleInvalidateAndRefetch()
        } else {
            showXpToast(result.message, 'loss')
        }
    }

    // ── TOGGLE PRIVACY ──
    const handlePrivacyToggle = async () => {
        setPrivacyLoading(true)
        try {
            await api.patch('/auth/privacy')
            handleInvalidateAndRefetch()
        } catch (err) {
            console.error('Privacy error:', err)
        } finally {
            setPrivacyLoading(false)
        }
    }

    if (loading && !user) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-[#7a7a90] font-mono text-sm">Loading profile...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Frown size={56} className="text-[#ff5c5c] mb-2" strokeWidth={1.5} />
                <div className="text-white font-black text-2xl tracking-widest uppercase"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    User Not Found
                </div>
                <div className="text-[#7a7a90] font-mono text-sm">
                    No user with username "{username}" exists
                </div>
                <Link to="/">
                    <button className="btn-apple btn-apple-primary px-6 py-2.5 mt-2">
                        Go Home
                    </button>
                </Link>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-[#7a7a90] font-mono text-sm">
                    Something went wrong. Please refresh.
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-8 md:py-10">
            <Helmet>
                <title>{user.username}'s Profile | QuestDuck</title>
                <meta name="description" content={`Check out ${user.username}'s gaming library, stats, and lists on QuestDuck.`} />
                <meta property="og:title" content={`${user.username}'s Gaming Odyssey - QuestDuck`} />
                <meta property="og:description" content={`See ${user.username}'s gaming stats and library.`} />
                {user.avatar && <meta property="og:image" content={user.avatar} />}
            </Helmet>

            {/* XP Toast */}
            {xpToast && (
                <div className={`fixed bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-2xl font-mono text-sm border shadow-2xl backdrop-blur-xl transition-all animate-in slide-in-from-bottom-5 duration-300 w-[calc(100%-40px)] max-w-[320px] text-center flex items-center justify-center gap-2
                                ${xpToast.type === 'loss'
                        ? 'bg-[#ff5c5c]/20 border-[#ff5c5c]/40 text-[#ff5c5c]'
                        : xpToast.type === 'pending'
                            ? 'bg-[#ff9f5c]/20 border-[#ff9f5c]/40 text-[#ff9f5c]'
                            : 'bg-[#c8ff57]/20 border-[#c8ff57]/40 text-[#c8ff57]'}`}>
                    {xpToast.msg}
                </div>
            )}

            {/* ── Profile Header ── */}
            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6 md:p-8 mb-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

                    {/* Avatar */}
                    {user.avatar ? (
                        <img src={user.avatar} alt={user.username}
                            className="w-20 h-20 rounded-full object-cover flex-shrink-0 ring-2 ring-[#2a2a35]" />
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#c8ff57] to-[#5c9fff]
                                        flex items-center justify-center font-black text-3xl text-black flex-shrink-0"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 text-center sm:text-left min-w-0 w-full">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mb-2">
                            <h1 className="font-black text-3xl md:text-4xl tracking-widest text-white flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 min-w-0">
                                <span className="break-all leading-tight">{user.username}</span>
                                {user.followsMe && (
                                    <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm
                                                     bg-[#7a7a90]/15 text-[#7a7a90] border border-[#7a7a90]/30 select-none whitespace-nowrap">
                                        Follows you
                                    </span>
                                )}
                            </h1>
                        </div>

                        {/* XP + Level */}
                        <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                            <span className="text-base flex items-center justify-center relative -top-[1px]">{user.badge || <Gamepad2 size={16} strokeWidth={2.5} className="text-[#c8ff57]" />}</span>
                            {isOwnProfile ? (
                                <Link to="/stats?tab=xp" className="flex items-center gap-2 leading-none hover:opacity-80 transition-opacity cursor-pointer group">
                                    <span className="font-mono text-xs text-[#c8ff57] font-black uppercase tracking-widest group-hover:underline">
                                        Level {user.level || 1}
                                    </span>
                                    <span className="font-mono text-xs text-[#7a7a90] opacity-50">·</span>
                                    <span className="font-mono text-xs text-[#7a7a90] font-bold group-hover:text-white transition-colors">{user.xp || 0} XP</span>
                                </Link>
                            ) : (
                                <div className="flex items-center gap-2 leading-none">
                                    <span className="font-mono text-xs text-[#c8ff57] font-black uppercase tracking-widest">
                                        Level {user.level || 1}
                                    </span>
                                    <span className="font-mono text-xs text-[#7a7a90] opacity-50">·</span>
                                    <span className="font-mono text-xs text-[#7a7a90] font-bold">{user.xp || 0} XP</span>
                                </div>
                            )}
                        </div>

                        {user.bio && (
                            <p className="text-[#7a7a90] text-sm mt-1 max-w-md break-words whitespace-pre-wrap">{user.bio}</p>
                        )}

                        <p className="text-[#7a7a90] font-mono text-xs mt-2">
                            Joined {new Date(user.createdAt).toLocaleDateString('en-US', {
                                month: 'long', year: 'numeric'
                            })}
                        </p>

                        {/* ── Followers / Following counts — now uses followerCount/followingCount ── */}
                        <div className="flex gap-4 mt-3 justify-center sm:justify-start">
                            <button
                                onClick={() => setFollowModal('followers')}
                                className="text-left hover:opacity-70 transition-opacity"
                            >
                                <span className="font-black text-lg text-white"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {user.followerCount ?? 0}
                                </span>
                                <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider ml-1">
                                    Followers
                                </span>
                            </button>
                            <button
                                onClick={() => setFollowModal('following')}
                                className="text-left hover:opacity-70 transition-opacity"
                            >
                                <span className="font-black text-lg text-white"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {user.followingCount ?? 0}
                                </span>
                                <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider ml-1">
                                    Following
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 items-center">
                        {isOwnProfile && (
                            <>
                                <button
                                    onClick={handlePrivacyToggle}
                                    disabled={privacyLoading}
                                    className={`btn-apple px-5 py-2.5 text-xs font-semibold border transition-all disabled:opacity-50
                                               ${user.isPrivate
                                            ? 'border-[#c8ff57]/50 text-[#c8ff57] bg-[#c8ff57]/10 hover:bg-[#c8ff57]/20'
                                            : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57] hover:text-[#c8ff57]'}`}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        {privacyLoading ? 'Updating...' : user.isPrivate ? <><Lock size={14} /> Private</> : <><Globe size={14} /> Public</>}
                                    </div>
                                </button>
                                <button
                                    onClick={() => navigate('/edit-profile')}
                                    className="btn-apple btn-apple-secondary px-5 py-2.5 flex items-center justify-center gap-1.5"
                                >
                                    <Pencil size={14} /> Edit Profile
                                </button>
                            </>
                        )}

                        {!isOwnProfile && currentUser && (
                            <button
                                onClick={handleFollow}
                                disabled={followLoading}
                                className={`btn-apple px-8 py-3 text-sm font-bold transition-all disabled:opacity-70
                                           ${isFollowing
                                        ? 'btn-apple-secondary hover:border-[#ff5c5c] hover:text-[#ff5c5c] hover:bg-[#ff5c5c]/10'
                                        : requestSent
                                            ? 'btn-apple-secondary border-[#ff9f5c]/50 text-[#ff9f5c] hover:border-[#ff9f5c] hover:bg-[#ff9f5c]/10'
                                            : 'btn-apple-primary'}`}
                            >
                                {followLoading
                                    ? '...'
                                    : isFollowing
                                        ? 'Unfollow'
                                        : requestSent
                                            ? 'Cancel Request'
                                            : user.isPrivate ? 'Request' : 'Follow'}
                            </button>
                        )}

                        {!isOwnProfile && !currentUser && (
                            <Link to="/login">
                                <button className="btn-apple btn-apple-primary px-6 py-2 w-full">
                                    Login to Follow
                                </button>
                            </Link>
                        )}

                        {/* Private Badge - Moved here for others' profiles */}
                        {!isOwnProfile && user.isPrivate && (
                            <div className="mt-1 flex justify-center">
                                <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded
                                                 bg-[#ff5c5c]/10 text-[#ff5c5c] border border-[#ff5c5c]/20 flex items-center gap-1.5">
                                    <Lock size={10} /> Private Profile
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats row */}
                {canSeeGames && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#2a2a35]">
                        {[
                            { label: 'Games', value: stats.total, color: 'text-[#c8ff57]' },
                            { label: 'Completed', value: stats.completed, color: 'text-[#5c9fff]' },
                            { label: 'Playing', value: stats.playing, color: 'text-[#c8ff57]' },
                            { label: 'Hours', value: stats.hours, color: 'text-[#ff9f5c]' },
                        ].map(stat => (
                            <div key={stat.label} className="text-center">
                                <div className={`font-black text-3xl leading-none tracking-wider ${stat.color}`}
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {stat.value}
                                </div>
                                <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider mt-1">
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Tab Bar ── */}
            {canSeeGames && (
                <div className="flex gap-1 mb-4 flex-wrap">
                    {[
                        { id: 'games', label: <><Gamepad2 size={14} className="mr-1" /> Recent Games</> },
                        { id: 'stats', label: <><BarChart2 size={14} className="mr-1" /> Stats</> },
                        ...(canSeeGames ? [{ id: 'lists', label: <><List size={14} className="mr-1" /> Lists</> }] : []),
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSelectedList(null) }}
                            className={`font-mono text-xs uppercase tracking-widest px-5 py-2.5 rounded-lg border transition-all
                                       ${activeTab === tab.id
                                    ? 'bg-[#c8ff57]/10 border-[#c8ff57]/40 text-[#c8ff57]'
                                    : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]/30 hover:text-[#c8ff57]'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Games Tab ── */}
            {(!canSeeGames || activeTab === 'games') && (
                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                    <h2 className="font-black text-xl tracking-widest uppercase text-white mb-5"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        Recent Games
                        {canSeeGames && (
                            <span className="font-mono text-xs text-[#7a7a90] ml-3 normal-case tracking-normal">
                                {games.length} total
                            </span>
                        )}
                    </h2>

                    {!canSeeGames ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <Lock size={48} strokeWidth={1.5} className="text-[#2a2a35]" />
                            <div className="text-white font-black text-xl tracking-widest uppercase"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Private Profile
                            </div>
                            <div className="text-[#7a7a90] font-mono text-sm text-center max-w-xs mb-2">
                                {requestSent
                                    ? `Your follow request is pending. Wait for ${user.username} to accept.`
                                    : `Follow ${user.username} to see their games`}
                            </div>
                            {!currentUser && (
                                <Link to="/login">
                                    <button className="btn-apple btn-apple-primary px-6 py-2.5">
                                        Login to Follow
                                    </button>
                                </Link>
                            )}
                        </div>
                    ) : recentGames.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            {recentGames.map(game => {
                                const sc = statusConfig[game.status] || statusConfig.planned
                                const imageUrl = getIGDBImage(game.cover || (game.steamId ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamId}/header.jpg` : null), SIZES.COVER_BIG)
                                return (
                                    <Link
                                        key={game._id}
                                        to={game.igdbId ? `/game/${game.igdbId}` : '#'}
                                        className="bg-[#18181f] border border-[#2a2a35] rounded-lg overflow-hidden
                                                   hover:border-[#c8ff57]/50 transition-all group"
                                    >
                                        <div className="h-[120px] bg-cover bg-center bg-[#2a2a35] relative flex items-center justify-center"
                                            style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'none' }}>
                                            {!imageUrl && (
                                                <Gamepad2 size={32} className="text-[#3a3a4a]" />
                                            )}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
                                        </div>
                                        <div className="p-2">
                                            <div className="text-white font-semibold text-xs truncate mb-1 group-hover:text-[#c8ff57] transition-colors">
                                                {game.title}
                                            </div>
                                            <span className={`font-mono text-[9px] uppercase tracking-wider px-1 py-[1px] rounded-sm ${sc.bg} ${sc.color}`}>
                                                {sc.label}
                                            </span>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-[#7a7a90] font-mono text-sm">
                            No games ponded yet
                        </div>
                    )}
                </div>
            )}

            {/* ── Stats Tab ── */}
            {canSeeGames && activeTab === 'stats' && (
                <div className="flex flex-col gap-4">
                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest">Overview</div>
                            {isOwnProfile && (
                                <button onClick={() => navigate('/stats')}
                                    className="font-mono text-[10px] text-[#c8ff57] hover:underline uppercase tracking-wider">
                                    View Full Stats →
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Games', value: stats.total, color: 'text-[#c8ff57]' },
                                { label: 'Hours Played', value: `${stats.hours}h`, color: 'text-[#ff9f5c]' },
                                { label: 'Avg Rating', value: stats.avgRating ? `${stats.avgRating}/10` : '—', color: 'text-[#5c9fff]' },
                                { label: 'Rated', value: stats.rated, color: 'text-[#c45cff]' },
                            ].map(s => (
                                <div key={s.label} className="text-center bg-[#18181f] border border-[#2a2a35] rounded-lg p-4">
                                    <div className={`font-black text-3xl leading-none tracking-wider ${s.color}`}
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                        {s.value}
                                    </div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider mt-1">
                                        {s.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-5">By Status</div>
                        <div className="flex flex-col gap-3">
                            {[
                                { label: 'Playing', value: stats.playing, color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]' },
                                { label: 'Completed', value: stats.completed, color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]' },
                                { label: 'Planned', value: stats.planned, color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]' },
                                { label: 'Paused', value: stats.paused, color: 'text-[#c45cff]', bg: 'bg-[#c45cff]' },
                                { label: 'Dropped', value: stats.dropped, color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]' },
                            ].map(s => (
                                <div key={s.label}>
                                    <div className="flex justify-between mb-1">
                                        <span className={`font-mono text-xs uppercase tracking-wider ${s.color}`}>{s.label}</span>
                                        <span className="font-mono text-xs text-[#7a7a90]">
                                            {s.value}
                                            {stats.total > 0 && (
                                                <span className="text-[#4a4a5a] ml-1">· {Math.round((s.value / stats.total) * 100)}%</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-[#2a2a35] rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${s.bg} transition-all duration-500`}
                                            style={{ width: stats.total > 0 ? `${(s.value / stats.total) * 100}%` : '0%' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Lists Tab ── */}
            {canSeeGames && activeTab === 'lists' && (
                <div className="flex flex-col gap-4">
                    {selectedList && (
                        <button onClick={() => setSelectedList(null)}
                            className="text-[#7a7a90] hover:text-[#c8ff57] transition-colors font-mono text-xs flex items-center gap-1 self-start">
                            ← Back to Lists
                        </button>
                    )}

                    {selectedList ? (
                        <div className="flex flex-col gap-4">
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-[#c8ff57]/15 flex items-center justify-center flex-shrink-0">
                                        <List size={24} className="text-[#c8ff57]" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="font-black text-xl text-white tracking-widest uppercase"
                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                {selectedList.name}
                                            </h2>
                                            <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm
                                                             ${selectedList.isPublic ? 'bg-[#c8ff57]/15 text-[#c8ff57]' : 'bg-[#2a2a35] text-[#7a7a90]'}`}>
                                                {selectedList.isPublic ? 'Public' : 'Private'}
                                            </span>
                                        </div>
                                        {selectedList.description && (
                                            <div className="font-mono text-xs text-[#7a7a90] mt-1">{selectedList.description}</div>
                                        )}
                                        <div className="font-mono text-[10px] text-[#7a7a90] mt-1">
                                            {selectedList.games?.length || 0} games
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {selectedList.games?.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {selectedList.games.map(game => (
                                        <Link key={game.igdbId} to={game.igdbId ? `/game/${game.igdbId}` : '#'}
                                            className="bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden hover:border-[#c8ff57]/50 transition-all group">
                                            {game.gameCover ? (
                                                <img src={game.gameCover} alt={game.gameTitle}
                                                    className="w-full h-[140px] object-cover group-hover:opacity-90 transition-opacity" />
                                            ) : (
                                                <div className="w-full h-[140px] bg-[#18181f] flex items-center justify-center">
                                                    <Gamepad2 size={40} className="text-[#3a3a4a]" />
                                                </div>
                                            )}
                                            <div className="p-2">
                                                <div className="text-white font-semibold text-xs truncate group-hover:text-[#c8ff57] transition-colors">
                                                    {game.gameTitle}
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 gap-3 bg-[#111118] border border-[#2a2a35] rounded-lg">
                                    <List size={40} className="text-[#2a2a35] mb-2" strokeWidth={1.5} />
                                    <div className="text-[#7a7a90] font-mono text-sm">No games in this list yet</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        visibleLists.length > 0 ? (
                            visibleLists.map(list => (
                                <div key={list._id} onClick={() => setSelectedList(list)}
                                    className="bg-[#111118] border border-[#2a2a35] rounded-lg hover:border-[#c8ff57]/30 transition-all overflow-hidden cursor-pointer">
                                    <div className="flex items-center gap-4 p-4">
                                        <div className="w-12 h-12 rounded-lg bg-[#c8ff57]/15 flex items-center justify-center flex-shrink-0">
                                            <List size={20} className="text-[#c8ff57]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div className="text-white font-semibold text-sm truncate">{list.name}</div>
                                                <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm
                                                                 ${list.isPublic ? 'bg-[#c8ff57]/15 text-[#c8ff57]' : 'bg-[#2a2a35] text-[#7a7a90]'}`}>
                                                    {list.isPublic ? 'Public' : 'Private'}
                                                </span>
                                            </div>
                                            {list.description && (
                                                <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5 truncate">{list.description}</div>
                                            )}
                                            <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5">
                                                {list.games?.length || 0} games
                                            </div>
                                        </div>
                                        <span className="font-mono text-[10px] text-[#7a7a90]">→</span>
                                    </div>
                                    {list.games?.length > 0 && (
                                        <div className="px-4 pb-4 flex gap-2 flex-wrap">
                                            {list.games.slice(0, 6).map(game => (
                                                game.gameCover ? (
                                                    <img key={game.igdbId} src={game.gameCover} alt={game.gameTitle}
                                                        className="w-10 h-14 object-cover rounded hover:opacity-80 transition-all" />
                                                ) : (
                                                    <div key={game.igdbId} className="w-10 h-14 bg-[#2a2a35] rounded flex items-center justify-center">
                                                        <Gamepad2 size={16} className="text-[#7a7a90]" />
                                                    </div>
                                                )
                                            ))}
                                            {list.games.length > 6 && (
                                                <div className="w-10 h-14 bg-[#2a2a35] rounded flex items-center justify-center font-mono text-[9px] text-[#7a7a90]">
                                                    +{list.games.length - 6}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-[#111118] border border-[#2a2a35] rounded-lg">
                                <List size={40} className="text-[#2a2a35] mb-2" strokeWidth={1.5} />
                                <div className="text-white font-semibold text-sm">No public lists</div>
                                <div className="text-[#7a7a90] font-mono text-[10px] text-center">
                                    {user.username} hasn't made any public lists yet
                                </div>
                            </div>
                        )
                    )}
                </div>
            )}

            {/* Follow List Modal */}
            {followModal && (
                <FollowListModal
                    userId={user._id}
                    type={followModal}
                    onClose={() => setFollowModal(null)}
                />
            )}
        </div>
    )
}

export default Profile