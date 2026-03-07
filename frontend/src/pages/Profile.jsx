import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import FollowListModal from '../components/profile/FollowListModal'

function Profile() {

    const { username } = useParams()
    const { user: currentUser } = useAuth()

    const [user, setUser] = useState(null)
    const [games, setGames] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [followLoading, setFollowLoading] = useState(false)
    const [privacyLoading, setPrivacyLoading] = useState(false)
    const [requestSent, setRequestSent] = useState(false)
    const [followModal, setFollowModal] = useState(null)

    const statusConfig = {
        playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Playing' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
    }

    const isOwnProfile = currentUser?.username === username

    const isFollowing = useMemo(() => {
        if (!currentUser || !user) return false
        const currentId = (currentUser.id || currentUser._id || '').toString()
        return user.followers?.some(id => id.toString() === currentId) || false
    }, [currentUser, user])

    const canSeeGames = useMemo(() => {
        if (!user) return false
        if (!user.isPrivate) return true
        if (isOwnProfile) return true
        if (isFollowing) return true
        return false
    }, [user, isOwnProfile, isFollowing])

    // ── FETCH PROFILE ──
    const fetchProfile = useCallback(async () => {
        try {
            const userRes = await api.get(`/auth/profile/${username}`)
            const fetchedUser = userRes.data.user
            setUser(fetchedUser)

            const currentId = (currentUser?.id || currentUser?._id || '').toString()
            const following = fetchedUser.followers?.some(
                id => id.toString() === currentId
            ) || false

            const canSee = !fetchedUser.isPrivate ||
                currentUser?.username === username ||
                following

            if (canSee) {
                const gamesRes = await api.get(`/games/user/${fetchedUser._id}`)
                setGames(gamesRes.data.games)
            } else {
                setGames([])
            }

        } catch (err) {
            setError(err.response?.data?.message || 'User not found')
        }
    }, [username, currentUser])

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            setRequestSent(false)
            setUser(null)
            setGames([])
            setError(null)
            await fetchProfile()
            setLoading(false)
        }
        load()
    }, [fetchProfile])

    // ── STATS ──
    const stats = useMemo(() => ({
        total: games.length,
        completed: games.filter(g => g.status === 'completed').length,
        playing: games.filter(g => g.status === 'playing').length,
        hours: games.reduce((sum, g) => sum + (g.hours || 0), 0),
    }), [games])

    const recentGames = games.slice(0, 6)

    // ── FOLLOW / UNFOLLOW ──
    const handleFollow = async () => {
        if (!currentUser) return
        setFollowLoading(true)
        try {
            if (isFollowing) {
                await api.post(`/auth/unfollow/${user._id}`)
                setRequestSent(false)
                await fetchProfile()
            } else {
                const res = await api.post(`/auth/follow/${user._id}`)
                if (res.data.type === 'request_sent') {
                    setRequestSent(true)
                } else {
                    await fetchProfile()
                }
            }
        } catch (err) {
            console.error('Follow error:', err)
        } finally {
            setFollowLoading(false)
        }
    }

    // ── TOGGLE PRIVACY ──
    const handlePrivacyToggle = async () => {
        setPrivacyLoading(true)
        try {
            const res = await api.patch('/auth/privacy')
            setUser(prev => ({ ...prev, isPrivate: res.data.isPrivate }))
        } catch (err) {
            console.error('Privacy error:', err)
        } finally {
            setPrivacyLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-[#7a7a90] font-mono text-sm">Loading profile...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">😕</div>
                <div
                    className="text-white font-black text-2xl tracking-widest uppercase"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                    User Not Found
                </div>
                <div className="text-[#7a7a90] font-mono text-sm">
                    No user with username "{username}" exists
                </div>
                <Link to="/">
                    <button className="px-4 py-2 bg-[#c8ff57] text-black font-bold
                             text-sm rounded hover:bg-[#d4ff6e] transition-all">
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

            {/* ── Profile Header ── */}
            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6 md:p-8 mb-6">

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

                    {/* Avatar */}
                    <div
                        className="w-20 h-20 rounded-full bg-gradient-to-br
                        from-[#c8ff57] to-[#5c9fff]
                        flex items-center justify-center
                        font-black text-3xl text-black flex-shrink-0"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                        {user.username.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-center sm:text-left">

                        <div className="flex flex-col sm:flex-row items-center
                            sm:items-start gap-3 mb-2">
                            <h1
                                className="font-black text-3xl md:text-4xl tracking-widest
                           uppercase text-white"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                                {user.username}
                            </h1>
                            {user.isPrivate && (
                                <span className="font-mono text-[10px] uppercase tracking-wider
                                 px-2 py-1 rounded-sm bg-[#ff5c5c]/15
                                 text-[#ff5c5c] border border-[#ff5c5c]/30">
                                    🔒 Private
                                </span>
                            )}
                        </div>

                        {user.bio && (
                            <p className="text-[#7a7a90] text-sm mt-1 max-w-md">{user.bio}</p>
                        )}

                        <p className="text-[#7a7a90] font-mono text-xs mt-2">
                            Joined {new Date(user.createdAt).toLocaleDateString('en-US', {
                                month: 'long', year: 'numeric'
                            })}
                        </p>

                        {/* Followers / Following — clickable */}
                        <div className="flex gap-4 mt-3 justify-center sm:justify-start">
                            <button
                                onClick={() => setFollowModal('followers')}
                                className="text-left hover:opacity-70 transition-opacity"
                            >
                                <span
                                    className="font-black text-lg text-white"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                    {user.followers?.length || 0}
                                </span>
                                <span className="font-mono text-[10px] text-[#7a7a90]
                                 uppercase tracking-wider ml-1">
                                    Followers
                                </span>
                            </button>
                            <button
                                onClick={() => setFollowModal('following')}
                                className="text-left hover:opacity-70 transition-opacity"
                            >
                                <span
                                    className="font-black text-lg text-white"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                    {user.following?.length || 0}
                                </span>
                                <span className="font-mono text-[10px] text-[#7a7a90]
                                 uppercase tracking-wider ml-1">
                                    Following
                                </span>
                            </button>
                        </div>

                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2">

                        {isOwnProfile && (
                            <button
                                onClick={handlePrivacyToggle}
                                disabled={privacyLoading}
                                className={`px-4 py-2 text-sm font-semibold rounded
                           border transition-all disabled:opacity-50
                           ${user.isPrivate
                                        ? 'border-[#c8ff57]/50 text-[#c8ff57] hover:bg-[#c8ff57]/10'
                                        : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57] hover:text-[#c8ff57]'
                                    }`}
                            >
                                {privacyLoading
                                    ? 'Updating...'
                                    : user.isPrivate ? '🔒 Private' : '🌐 Public'
                                }
                            </button>
                        )}

                        {!isOwnProfile && currentUser && (
                            <button
                                onClick={handleFollow}
                                disabled={followLoading || requestSent}
                                className={`px-6 py-2 text-sm font-bold rounded
                           transition-all disabled:opacity-70
                           ${isFollowing
                                        ? 'border border-[#2a2a35] text-[#7a7a90] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'
                                        : requestSent
                                            ? 'border border-[#ff9f5c]/50 text-[#ff9f5c] cursor-not-allowed'
                                            : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e]'
                                    }`}
                            >
                                {followLoading
                                    ? '...'
                                    : isFollowing
                                        ? 'Unfollow'
                                        : requestSent
                                            ? '⏳ Requested'
                                            : 'Follow'
                                }
                            </button>
                        )}

                        {!isOwnProfile && !currentUser && (
                            <Link to="/login">
                                <button className="px-6 py-2 text-sm font-bold rounded
                                   bg-[#c8ff57] text-black hover:bg-[#d4ff6e]
                                   transition-all">
                                    Login to Follow
                                </button>
                            </Link>
                        )}

                    </div>

                </div>

                {/* Stats row */}
                {canSeeGames && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6
                          pt-6 border-t border-[#2a2a35]">
                        {[
                            { label: 'Games', value: stats.total, color: 'text-[#c8ff57]' },
                            { label: 'Completed', value: stats.completed, color: 'text-[#5c9fff]' },
                            { label: 'Playing', value: stats.playing, color: 'text-[#c8ff57]' },
                            { label: 'Hours', value: stats.hours, color: 'text-[#ff9f5c]' },
                        ].map(stat => (
                            <div key={stat.label} className="text-center">
                                <div
                                    className={`font-black text-3xl leading-none tracking-wider ${stat.color}`}
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

            {/* ── Games Section ── */}
            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">

                <h2
                    className="font-black text-xl tracking-widest uppercase text-white mb-5"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                    Recent Games
                    {canSeeGames && (
                        <span className="font-mono text-xs text-[#7a7a90] ml-3
                             normal-case tracking-normal">
                            {games.length} total
                        </span>
                    )}
                </h2>

                {!canSeeGames ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <div className="text-5xl">🔒</div>
                        <div
                            className="text-white font-black text-xl tracking-widest uppercase"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            Private Profile
                        </div>
                        <div className="text-[#7a7a90] font-mono text-sm text-center max-w-xs">
                            {requestSent
                                ? `Your follow request is pending. Wait for ${user.username} to accept.`
                                : `Follow ${user.username} to see their games`
                            }
                        </div>
                        {!currentUser && (
                            <Link to="/login">
                                <button className="px-4 py-2 bg-[#c8ff57] text-black
                                   font-bold text-sm rounded mt-2
                                   hover:bg-[#d4ff6e] transition-all">
                                    Login to Follow
                                </button>
                            </Link>
                        )}
                    </div>

                ) : recentGames.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
                                    className="bg-[#18181f] border border-[#2a2a35] rounded-lg
                             overflow-hidden hover:border-[#c8ff57]/50 transition-all"
                                >
                                    <div
                                        className="h-[80px] bg-cover bg-center bg-[#2a2a35]"
                                        style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'none' }}
                                    >
                                        {!imageUrl && (
                                            <div className="w-full h-full flex items-center
                                      justify-center text-2xl">🎮</div>
                                        )}
                                    </div>
                                    <div className="p-2">
                                        <div className="text-white font-semibold text-xs truncate mb-1">
                                            {game.title}
                                        </div>
                                        <span className={`font-mono text-[9px] uppercase tracking-wider
                                     px-1 py-[1px] rounded-sm ${sc.bg} ${sc.color}`}>
                                            {sc.label}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10 text-[#7a7a90] font-mono text-sm">
                        No games logged yet
                    </div>
                )}

            </div>

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