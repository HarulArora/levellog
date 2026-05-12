import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { invalidateCache } from '../utils/cache'
import { useFollow } from '../context/FollowContext'
import { useLeaderboard } from '../context/LeaderboardContext'
import AvatarFrame from '../components/ui/AvatarFrame'
import FollowListModal from '../components/profile/FollowListModal'
import { Frown, Gamepad2, Lock, Globe, Pencil, BarChart2, List, Trophy, Heart, Bookmark, ChevronDown, Monitor, Film, Tv, BookOpen, Layers, Star, History } from 'lucide-react'
import { getIGDBImage, SIZES } from '../utils/igdb'

function Profile() {
    const { username } = useParams()
    const navigate = useNavigate()
    const { user: currentUser, updateUser, refreshUser } = useAuth()

    const [privacyLoading, setPrivacyLoading] = useState(false)
    const [followModal, setFollowModal] = useState(null)
    const [xpToast, setXpToast] = useState(null)
    const [activeTab, setActiveTab] = useState('recent')
    const [selectedList, setSelectedList] = useState(null)
    const [profileMediaType, setProfileMediaType] = useState('game')
    const { topUsers } = useLeaderboard()

    // ── CACHED FETCHES ──
    const { data: profileData, loading: profileLoading, error: profileError, refetch: refetchProfile } = useCachedFetch(
        `profile_${username}`,
        `/auth/profile/${username}`,
        { ttl: 5 * 6 * 1000, deps: [username] }
    )

    const user = profileData?.user
    const isOwnProfile = currentUser?.username?.toLowerCase() === username?.toLowerCase()
    const { getFollowStatus, handleFollowToggle, loadingMap } = useFollow()

    const followStatus = getFollowStatus(user)
    const isFollowing = followStatus === 'following'
    const requestSent = followStatus === 'requested'
    const canSeeGames = !user?.isPrivate || isOwnProfile || isFollowing

    const baseEndpoint = profileMediaType === 'game' ? 'games' :
        (profileMediaType === 'anime' || profileMediaType === 'manga') ? 'anime' : 'movies';

    const { data: gamesData } = useCachedFetch(
        user?._id && canSeeGames ? `profile_items_${user._id}_${baseEndpoint}` : null,
        user?._id && canSeeGames ? `/${baseEndpoint}/user/${user._id}` : null,
        { enabled: !!user?._id && canSeeGames, deps: [user?._id, baseEndpoint] }
    )


    const { data: likesData } = useCachedFetch(
        user?._id && canSeeGames ? `profile_likes_${user._id}_${profileMediaType}` : null,
        user?._id && canSeeGames ? `/lists/user/${user._id}/likes?mediaType=${profileMediaType}` : null,
        { enabled: !!user?._id && canSeeGames, deps: [user?._id, profileMediaType] }
    )

    const { data: wishlistData } = useCachedFetch(
        user?._id && canSeeGames ? `profile_wishlist_${user._id}_${profileMediaType}` : null,
        user?._id && canSeeGames ? `/lists/user/${user._id}/wishlist?mediaType=${profileMediaType}` : null,
        { enabled: !!user?._id && canSeeGames, deps: [user?._id, profileMediaType] }
    )

    const loading = profileLoading
    const error = profileError
    const rawItems = useMemo(() => gamesData?.games || [], [gamesData])
    const games = useMemo(() => {
        if (profileMediaType === 'game') return rawItems;
        return rawItems.filter(item => {
            const itemType = item.type || item.mediaType;
            return itemType === profileMediaType;
        });
    }, [rawItems, profileMediaType])
    const likes = useMemo(() => likesData?.likes || [], [likesData])
    const wishlist = useMemo(() => wishlistData?.wishlist || [], [wishlistData])
    const followLoading = user ? loadingMap[user._id] : false

    const showXpToast = (msg, type = 'gain') => {
        setXpToast({ msg, type })
        setTimeout(() => setXpToast(null), 3000)
    }

    const statusConfig = {
        playing: { 
            color: 'text-[#c8ff57]', 
            bg: 'bg-[#c8ff57]/15', 
            label: profileMediaType === 'manga' ? 'Reading' : (profileMediaType === 'game' ? 'Playing' : 'Watching') 
        },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
    }




    const prefix = profileMediaType === 'game' ? '' : (profileMediaType === 'tv' ? 'TV' : profileMediaType.charAt(0).toUpperCase() + profileMediaType.slice(1))
    const likesField = prefix ? `is${prefix}LikesPublic` : 'isLikesPublic'
    const wishField = prefix ? `is${prefix}WishlistPublic` : 'isWishlistPublic'

    const specialLists = useMemo(() => {
        const result = []

        // Liked Items
        if (isOwnProfile || user?.[likesField]) {
            result.push({
                _id: 'liked',
                name: `Liked ${profileMediaType === 'game' ? 'Games' : profileMediaType === 'tv' ? 'Shows' : profileMediaType.charAt(0).toUpperCase() + profileMediaType.slice(1)}`,
                description: `${profileMediaType === 'game' ? 'Games' : profileMediaType === 'tv' ? 'Shows' : profileMediaType.charAt(0).toUpperCase() + profileMediaType.slice(1)} ${user?.username} has liked`,
                isPublic: user?.[likesField],
                games: likes,
                gameCount: likes.length,
                isSpecial: true,
                icon: Heart,
                color: 'text-[#ff5c5c]',
                bg: 'bg-[#ff5c5c]/15'
            })
        }

        // Wishlist
        if (isOwnProfile || user?.[wishField]) {
            const isWatchlist = profileMediaType === 'anime' || profileMediaType === 'movie' || profileMediaType === 'tv'
            const label = isWatchlist ? 'Watchlist' : 'Wishlist'
            const mediaLabel = profileMediaType === 'game' ? 'Games' : profileMediaType === 'tv' ? 'Shows' : profileMediaType.charAt(0).toUpperCase() + profileMediaType.slice(1)

            result.push({
                _id: 'wishlist',
                name: profileMediaType === 'game' ? 'Wishlist' : `${mediaLabel} ${label}`,
                description: `${mediaLabel} ${user?.username} wants to ${isWatchlist ? 'watch' : 'play'}`,
                isPublic: user?.[wishField],
                games: wishlist,
                gameCount: wishlist.length,
                isSpecial: true,
                icon: Bookmark,
                color: 'text-[#5c9fff]',
                bg: 'bg-[#5c9fff]/15'
            })
        }

        return result
    }, [user, isOwnProfile, likes, wishlist])

    const allCollections = useMemo(() => [...specialLists], [specialLists])


    const handleInvalidateAndRefetch = useCallback(() => {
        invalidateCache(`profile_${username}`)
        if (user?._id) {
            invalidateCache(`profile_games_${user._id}`)

            // Invalidate for all media types to ensure consistency
            const mediaTypes = ['game', 'anime', 'manga', 'movie', 'tv']
            mediaTypes.forEach(m => {
                invalidateCache(`profile_likes_${user._id}_${m}`)
                invalidateCache(`profile_wishlist_${user._id}_${m}`)
            })
        }

        if (isOwnProfile) {
            refreshUser()
        }

        refetchProfile(true) // 🚀 Silent refetch (background)
    }, [username, user?._id, refetchProfile, isOwnProfile, refreshUser])

    // ── STATS ──
    const stats = useMemo(() => {
        const isGame = profileMediaType === 'game';
        
        // For Games, we calculate from the actual loaded games array to ensure 100% accuracy
        // even if the backend counters get out of sync.
        const total = games.length;
        const completed = games.filter(g => g.status === 'completed').length;
        const playing = games.filter(g => g.status === 'playing').length;
        const planned = games.filter(g => g.status === 'planned').length;
        const dropped = games.filter(g => g.status === 'dropped').length;
        const paused = games.filter(g => g.status === 'paused').length;

        let secondaryMetric = 0;
        const s = user?.gameStats || {};
        if (profileMediaType === 'game') secondaryMetric = s.totalHours ?? games.reduce((sum, g) => sum + (g.hours || 0), 0);
        else if (profileMediaType === 'anime') secondaryMetric = games.reduce((sum, g) => sum + (g.episodesWatched || 0), 0);
        else if (profileMediaType === 'manga') secondaryMetric = games.reduce((sum, g) => sum + (g.chaptersRead || 0), 0);

        const ratedItems = games.filter(g => g.rating > 0);
        const avgRating = isGame && s.avgRating ? s.avgRating : (ratedItems.length > 0
            ? (ratedItems.reduce((sum, g) => sum + g.rating, 0) / ratedItems.length).toFixed(1)
            : null);

        return {
            total,
            completed,
            playing,
            planned,
            dropped,
            paused,
            secondaryMetric,
            avgRating,
            rated: ratedItems.length,
        }
    }, [user, games, profileMediaType])

    const recentGames = games.slice(0, 10)
    const location = useLocation();

    // Auto-switch tab based on URL param
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'collections') {
            setActiveTab('lists');
        } else if (tab === 'stats') {
            setActiveTab('stats');
        } else if (tab === 'recent') {
            setActiveTab('recent');
        }
    }, [location.search]);

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

    const userRankInfo = topUsers.find(u => u._id === user?._id)
    const rank = userRankInfo?.rank

    const rankThemes = {
        1: { border: 'border-[#ffd700]', bg: 'bg-gradient-to-r from-[#ffd700]/30 to-[#111118]', label: 'KING', color: '#ffd700' },
        2: { border: 'border-[#B9F2FF]', bg: 'bg-gradient-to-r from-[#B9F2FF]/20 to-[#111118]', label: 'TOP CHALLENGER', color: '#B9F2FF' },
        3: { border: 'border-[#ff9f5c]', bg: 'bg-gradient-to-r from-[#cd7f32]/25 to-[#111118]', label: 'ELITE HUNTER', color: '#cd7f32' },
        4: { border: 'border-[#71797E]', bg: 'bg-gradient-to-r from-[#8d9194]/20 to-[#111118]', label: 'IRON GUARD', color: '#94999c' },
    }
    const theme = rankThemes[rank]

    return (
        <div className="w-full max-w-[1200px] mx-auto px-5 md:px-10 pt-4 md:pt-6 pb-12 min-h-[80vh]">
            <Helmet>
                <title>{user.username}'s Profile | QuestDuck</title>
                <meta name="description" content={`Check out ${user.username}'s gaming library, stats, and lists on QuestDuck.`} />
                <meta property="og:title" content={`${user.username}'s Gaming Odyssey - QuestDuck`} />
                <meta property="og:description" content={`See ${user.username}'s gaming stats and library.`} />
                {user.avatar && <meta property="og:image" content={user.avatar} />}
            </Helmet>

            {/* XP Toast */}
            {xpToast && (
                <div className={`fixed bottom-22 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-2xl font-mono text-sm border shadow-2xl backdrop-blur-xl transition-all animate-in slide-in-from-bottom-5 duration-300 w-[calc(100%-40px)] max-w-[320px] text-center flex items-center justify-center gap-2
                                ${xpToast.type === 'loss'
                        ? 'bg-[#ff5c5c]/20 border-[#ff5c5c]/40 text-[#ff5c5c]'
                        : xpToast.type === 'pending'
                            ? 'bg-[#ff9f5c]/20 border-[#ff9f5c]/40 text-[#ff9f5c]'
                            : 'bg-[#c8ff57]/20 border-[#c8ff57]/40 text-[#c8ff57]'}`}>
                    {xpToast.msg}
                </div>
            )}

            {/* ── Profile Header ── */}
            <div className={`relative border rounded-lg p-6 md:p-8 mb-6 overflow-hidden transition-all duration-700
                           ${theme ? `${theme.bg} ${theme.border} shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)]` : 'bg-[#111118] border-[#2a2a35]'}`}>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">

                    {/* Avatar with Ranking System */}
                    <AvatarFrame userId={user._id} src={user.avatar} size={100} className="profile-avatar" />

                    {/* Info */}
                    <div className="flex-1 text-center sm:text-left min-w-0 w-full">
                        {theme && (
                            <div className="font-mono text-[10px] font-black tracking-[0.4em] mb-1 pl-1" style={{ color: theme.color }}>
                                {theme.label}
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mb-1">
                            <h1 className="font-black text-3xl md:text-4xl tracking-widest text-white flex flex-col sm:flex-row items-center sm:items-start gap-x-3 gap-y-2 min-w-0">
                                <span className="break-all leading-tight">{user.username}</span>
                                {user.followsMe && (
                                    <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm
                                                     bg-[#7a7a90]/15 text-[#7a7a90] border border-[#7a7a90]/30 select-none whitespace-nowrap sm:mt-1">
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

                        {/* ── Followers / Following counts ── */}
                        <div className="flex gap-4 mt-3 justify-center sm:justify-start">
                            <button
                                onClick={() => canSeeGames ? setFollowModal('followers') : null}
                                className={`text-left transition-all ${canSeeGames ? 'hover:opacity-70 cursor-pointer' : 'cursor-default group'}`}
                            >
                                <span className="font-black text-lg text-white"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {user.followerCount ?? 0}
                                </span>
                                <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider ml-1 inline-flex items-center gap-1">
                                    Followers
                                    {!canSeeGames && <Lock size={10} className="text-[#3a3a4a] group-hover:text-[#ff5c5c] transition-colors" />}
                                </span>
                            </button>
                            <button
                                onClick={() => canSeeGames ? setFollowModal('following') : null}
                                className={`text-left transition-all ${canSeeGames ? 'hover:opacity-70 cursor-pointer' : 'cursor-default group'}`}
                            >
                                <span className="font-black text-lg text-white"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {user.followingCount ?? 0}
                                </span>
                                <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider ml-1 inline-flex items-center gap-1">
                                    Following
                                    {!canSeeGames && <Lock size={10} className="text-[#3a3a4a] group-hover:text-[#ff5c5c] transition-colors" />}
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
                            {
                                label: profileMediaType === 'game' ? 'Games' : profileMediaType === 'tv' ? 'Shows' : profileMediaType.charAt(0).toUpperCase() + profileMediaType.slice(1),
                                value: stats.total,
                                color: 'text-[#c8ff57]'
                            },
                            {
                                label: 'Completed',
                                value: stats.completed,
                                color: 'text-[#5c9fff]'
                            },
                            {
                                label: profileMediaType === 'manga' ? 'Reading' : (profileMediaType === 'game' ? 'Playing' : 'Watching'),
                                value: stats.playing,
                                color: 'text-[#c8ff57]'
                            },
                            {
                                label: profileMediaType === 'game' ? 'Hours' : profileMediaType === 'anime' ? 'Episodes' : profileMediaType === 'manga' ? 'Chapters' : 'Rated',
                                value: profileMediaType === 'game' ? stats.secondaryMetric : (profileMediaType === 'anime' || profileMediaType === 'manga') ? stats.secondaryMetric : stats.rated,
                                color: 'text-[#ff9f5c]'
                            },
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
            <div className="flex gap-1 mb-4 flex-wrap">
                {[
                    {
                        id: 'recent',
                        label: (
                            <>
                                <History size={14} className="mr-1" />
                                Recent
                            </>
                        )
                    },
                    { id: 'stats', label: <><BarChart2 size={14} className="mr-1" /> Stats</> },
                    ...(canSeeGames ? [{ id: 'lists', label: <><Layers size={14} className="mr-1" /> Collections</> }] : []),
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

            {/* ── Games Tab ── */}
            {(!canSeeGames || activeTab === 'recent') && (
                <div className="flex flex-col gap-6">
                    {/* Media Type Selector */}
                    {canSeeGames && (
                        <div className="flex gap-2 p-1 bg-[#111118] border border-[#2a2a35] rounded-xl self-start">
                            {[
                                { id: 'game', label: 'Games', icon: Gamepad2 },
                                { id: 'movie', label: 'Movies', icon: Film },
                                { id: 'tv', label: 'TV Shows', icon: Tv },
                                { id: 'anime', label: 'Anime', icon: Monitor },
                                { id: 'manga', label: 'Manga', icon: BookOpen }
                            ].map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => { setProfileMediaType(m.id); setSelectedList(null) }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all
                                            ${profileMediaType === m.id
                                            ? 'bg-[#c8ff57] text-black font-bold shadow-[0_0_15px_rgba(200,255,87,0.3)]'
                                            : 'text-[#7a7a90] hover:text-white hover:bg-[#18181f]'}`}
                                >
                                    <m.icon size={14} />
                                    <span className="hidden sm:inline">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                        <h2 className="font-black text-xl tracking-widest uppercase text-white mb-5"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            Recent {profileMediaType === 'game' ? 'Games' : profileMediaType === 'tv' ? 'Shows' : profileMediaType.charAt(0).toUpperCase() + profileMediaType.slice(1)}
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
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {recentGames.map(item => {
                                    const sc = statusConfig[item.status] || statusConfig.planned
                                    const isGame = profileMediaType === 'game'
                                    const imageUrl = isGame
                                        ? getIGDBImage(item.cover || (item.steamId ? `https://cdn.akamai.steamstatic.com/steam/apps/${item.steamId}/header.jpg` : null), SIZES.COVER_BIG)
                                        : (item.cover || item.coverImage)

                                    const itemId = item.igdbId || item.externalId
                                    const pathMap = {
                                        game: `/game/${itemId}`,
                                        anime: `/anime/${itemId}`,
                                        manga: `/manga/${itemId}`,
                                        movie: `/movies/${itemId}`,
                                        tv: `/tv/${itemId}`
                                    }
                                    const detailPath = pathMap[profileMediaType] || '#'

                                    return (
                                        <Link
                                            key={item._id}
                                            to={detailPath}
                                            className="bg-[#18181f] border border-[#2a2a35] rounded-lg overflow-hidden
                                                   hover:border-[#c8ff57]/50 transition-all group"
                                        >
                                            <div className="h-[120px] bg-cover bg-center bg-[#2a2a35] relative flex items-center justify-center"
                                                style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'none' }}>
                                                {!imageUrl && (
                                                    isGame ? <Gamepad2 size={32} className="text-[#3a3a4a]" /> : <Film size={32} className="text-[#3a3a4a]" />
                                                )}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
                                            </div>
                                            <div className="p-2">
                                                <div className="text-white font-semibold text-xs truncate mb-1 group-hover:text-[#c8ff57] transition-colors">
                                                    {item.title_english || item.title}
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
                                No {profileMediaType}s logged yet
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Stats Tab ── */}
            {canSeeGames && activeTab === 'stats' && (
                <div className="flex flex-col gap-6">
                    {/* Media Type Selector */}
                    <div className="flex gap-2 p-1 bg-[#111118] border border-[#2a2a35] rounded-xl self-start">
                        {[
                            { id: 'game', label: 'Games', icon: Gamepad2 },
                            { id: 'movie', label: 'Movies', icon: Film },
                            { id: 'tv', label: 'TV Shows', icon: Tv },
                            { id: 'anime', label: 'Anime', icon: Monitor },
                            { id: 'manga', label: 'Manga', icon: BookOpen }
                        ].map(m => (
                            <button
                                key={m.id}
                                onClick={() => { setProfileMediaType(m.id); setSelectedList(null) }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all
                                           ${profileMediaType === m.id
                                        ? 'bg-[#c8ff57] text-black font-bold shadow-[0_0_15px_rgba(200,255,87,0.3)]'
                                        : 'text-[#7a7a90] hover:text-white hover:bg-[#18181f]'}`}
                            >
                                <m.icon size={14} />
                                <span className="hidden sm:inline">{m.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest">Overview</div>
                            {isOwnProfile && (
                                <button onClick={() => navigate(`/stats?tab=stats&media=${profileMediaType}`)}
                                    className="font-mono text-[10px] text-[#c8ff57] hover:underline uppercase tracking-wider">
                                    View Full Stats →
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { label: `Total ${profileMediaType === 'game' ? 'Games' : profileMediaType === 'tv' ? 'Shows' : profileMediaType.charAt(0).toUpperCase() + profileMediaType.slice(1)}`, value: stats.total, color: 'text-[#c8ff57]' },
                                {
                                    label: profileMediaType === 'game' ? 'Hours Played' : profileMediaType === 'anime' ? 'Episodes' : profileMediaType === 'manga' ? 'Chapters' : 'Avg Rating',
                                    value: profileMediaType === 'game' ? `${stats.secondaryMetric}h` : (profileMediaType === 'anime' || profileMediaType === 'manga') ? stats.secondaryMetric : (stats.avgRating ? `${stats.avgRating}/10` : '—'),
                                    color: 'text-[#ff9f5c]'
                                },
                                {
                                    label: (profileMediaType === 'movie' || profileMediaType === 'tv') ? 'Rated' : 'Avg Rating',
                                    value: (profileMediaType === 'movie' || profileMediaType === 'tv') ? stats.rated : (stats.avgRating ? `${stats.avgRating}/10` : '—'),
                                    color: 'text-[#5c9fff]'
                                },
                                {
                                    label: (profileMediaType === 'movie' || profileMediaType === 'tv') ? 'Top Genre' : 'Rated',
                                    value: (profileMediaType === 'movie' || profileMediaType === 'tv') ? (games.length > 0 ? (games[0].genre || 'N/A') : '—') : stats.rated,
                                    color: 'text-[#c45cff]'
                                },
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
                                { label: profileMediaType === 'manga' ? 'Reading' : (profileMediaType === 'game' ? 'Playing' : 'Watching'), value: stats.playing, color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]' },
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

            {/* ── Collections Tab ── */}
            {canSeeGames && activeTab === 'lists' && (
                <div className="flex flex-col gap-6">
                    {/* Media Type Selector */}
                    <div className="flex gap-2 p-1 bg-[#111118] border border-[#2a2a35] rounded-xl self-start">
                        {[
                            { id: 'game', label: 'Games', icon: Gamepad2 },
                            { id: 'movie', label: 'Movies', icon: Film },
                            { id: 'tv', label: 'TV Shows', icon: Tv },
                            { id: 'anime', label: 'Anime', icon: Monitor },
                            { id: 'manga', label: 'Manga', icon: BookOpen }
                        ].map(m => (
                            <button
                                key={m.id}
                                onClick={() => { setProfileMediaType(m.id); setSelectedList(null) }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all
                                           ${profileMediaType === m.id
                                        ? 'bg-[#c8ff57] text-black font-bold shadow-[0_0_15px_rgba(200,255,87,0.3)]'
                                        : 'text-[#7a7a90] hover:text-white hover:bg-[#18181f]'}`}
                            >
                                <m.icon size={14} />
                                <span className="hidden sm:inline">{m.label}</span>
                            </button>
                        ))}
                    </div>

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
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                                            <h2 className="font-black text-xl text-white tracking-widest uppercase break-all w-full"
                                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                {selectedList.name}
                                            </h2>
                                            {selectedList.isSpecial ? (
                                                <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm bg-[#c8ff57]/15 text-[#c8ff57]`}>
                                                    System List
                                                </span>
                                            ) : (
                                                <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm
                                                                 ${selectedList.isPublic ? 'bg-[#c8ff57]/15 text-[#c8ff57]' : 'bg-[#2a2a35] text-[#7a7a90]'}`}>
                                                    {selectedList.isPublic ? 'Public' : 'Private'}
                                                </span>
                                            )}
                                        </div>
                                        {selectedList.description && (
                                            <div className="font-mono text-xs text-[#7a7a90] mt-1 break-all w-full">{selectedList.description}</div>
                                        )}
                                        <div className="font-mono text-[10px] text-[#7a7a90] mt-1">
                                            {selectedList.games?.length || 0} {profileMediaType === 'game' ? 'games' : 'items'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {selectedList.games?.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {selectedList.games.map((game, i) => {
                                        const gameId = game.igdbId || game.externalId
                                        const detailPath = profileMediaType === 'game' ? `/game/${gameId}` : `/${profileMediaType === 'tv' ? 'tv' : profileMediaType === 'movie' ? 'movies' : profileMediaType}/${gameId}`

                                        return (
                                            <Link key={`${gameId}-${i}`} to={detailPath}
                                                className="bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden hover:border-[#c8ff57]/50 transition-all group">
                                                <div className="relative">
                                                    {game.gameCover ? (
                                                        <img src={game.gameCover} alt={game.gameTitle}
                                                            className="w-full h-[140px] object-cover group-hover:opacity-90 transition-opacity" />
                                                    ) : (
                                                        <div className="w-full h-[140px] bg-[#18181f] flex items-center justify-center">
                                                            <Gamepad2 size={40} className="text-[#3a3a4a]" />
                                                        </div>
                                                    )}

                                                    {/* Community Average Rating Badge */}
                                                    {game.avgRating > 0 && (
                                                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/80 backdrop-blur-md border border-[#5c9fff]/30 rounded px-1.5 py-0.5 shadow-xl z-10">
                                                            <Star size={10} style={{ color: '#5c9fff', fill: '#5c9fff' }} />
                                                            <span className="font-black text-[10px] text-[#5c9fff]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{game.avgRating}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-2">
                                                    <div className="text-white font-semibold text-xs truncate group-hover:text-[#c8ff57] transition-colors">
                                                        {game.title_english || game.gameTitle}
                                                    </div>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 gap-3 bg-[#111118] border border-[#2a2a35] rounded-lg">
                                    <List size={40} className="text-[#2a2a35] mb-2" strokeWidth={1.5} />
                                    <div className="text-[#7a7a90] font-mono text-sm">No games in this list yet</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        allCollections.length > 0 ? (
                            allCollections.map(list => (
                                <div key={list._id} onClick={() => setSelectedList(list)}
                                    className="bg-[#111118] border border-[#2a2a35] rounded-lg hover:border-[#c8ff57]/30 transition-all overflow-hidden cursor-pointer min-w-0">
                                    <div className="flex items-center gap-3 p-3 md:gap-4 md:p-4 min-w-0">
                                        <div className={`w-12 h-12 rounded-lg ${list.bg || 'bg-[#c8ff57]/15'} flex items-center justify-center flex-shrink-0`}>
                                            {list.icon ? <list.icon size={20} className={list.color || 'text-[#c8ff57]'} /> : <List size={20} className="text-[#c8ff57]" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="text-white font-semibold text-xs md:text-sm truncate flex-1 min-w-0">{list.name}</div>
                                                {list.isSpecial ? (
                                                    <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm bg-[#c8ff57]/15 text-[#c8ff57]">
                                                        System
                                                    </span>
                                                ) : (
                                                    <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm
                                                                     ${list.isPublic ? 'bg-[#c8ff57]/15 text-[#c8ff57]' : 'bg-[#2a2a35] text-[#7a7a90]'}`}>
                                                        {list.isPublic ? 'Public' : 'Private'}
                                                    </span>
                                                )}
                                            </div>
                                            {list.description && (
                                                <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5 truncate">{list.description}</div>
                                            )}
                                            <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5">
                                                {list.gameCount || 0} {profileMediaType === 'game' ? 'games' : 'items'}
                                            </div>
                                        </div>
                                        <span className="font-mono text-[10px] text-[#7a7a90]">→</span>
                                    </div>
                                    {list.games?.length > 0 && (
                                        <div className="px-4 pb-4 flex gap-2 flex-wrap">
                                            {list.games.slice(0, 6).map((item, i) => (
                                                item.gameCover ? (
                                                    <img key={`${item.igdbId || item.externalId}-img-${i}`} src={item.gameCover} alt={item.gameTitle}
                                                        className="w-10 h-14 object-cover rounded hover:opacity-80 transition-all" />
                                                ) : (
                                                    <div key={`${item.igdbId || item.externalId}-none-${i}`} className="w-10 h-14 bg-[#2a2a35] rounded flex items-center justify-center">
                                                        <Gamepad2 size={16} className="text-[#7a7a90]" />
                                                    </div>
                                                )
                                            ))}
                                            {list.gameCount > 6 && (
                                                <div className="w-10 h-14 bg-[#2a2a35] rounded flex items-center justify-center font-mono text-[9px] text-[#7a7a90]">
                                                    +{list.gameCount - 6}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-[#111118] border border-[#2a2a35] rounded-lg">
                                <Layers size={40} className="text-[#2a2a35] mb-2" strokeWidth={1.5} />
                                <div className="text-white font-semibold text-sm">No collections found</div>
                                <div className="text-[#7a7a90] font-mono text-[10px] text-center px-4">
                                    No public {profileMediaType} collections are available to show.
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