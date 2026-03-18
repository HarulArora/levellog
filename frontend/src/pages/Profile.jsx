import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import FollowListModal from '../components/profile/FollowListModal'

function Profile() {
    const { username } = useParams()
    const navigate = useNavigate()
    const { user: currentUser } = useAuth()

    const [user, setUser] = useState(null)
    const [games, setGames] = useState([])
    const [lists, setLists] = useState([])
    const [selectedList, setSelectedList] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [followLoading, setFollowLoading] = useState(false)
    const [privacyLoading, setPrivacyLoading] = useState(false)
    const [requestSent, setRequestSent] = useState(false)
    const [followModal, setFollowModal] = useState(null)
    const [xpToast, setXpToast] = useState(null)
    const [activeTab, setActiveTab] = useState('games')

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

    const isOwnProfile = currentUser?.username === username

    // ── Uses isFollowedByMe from backend instead of searching arrays ──
    const isFollowing = useMemo(() => {
        if (!currentUser || !user) return false
        return user.isFollowedByMe || false
    }, [currentUser, user])

    const canSeeGames = useMemo(() => {
        if (!user) return false
        if (!user.isPrivate) return true
        if (isOwnProfile) return true
        if (isFollowing) return true
        return false
    }, [user, isOwnProfile, isFollowing])

    const canSeeLists = useMemo(() => {
        if (!user) return false
        if (isOwnProfile) return true
        if (user.isPrivate) return isFollowing
        return true
    }, [user, isOwnProfile, isFollowing])

    const visibleLists = useMemo(() => {
        if (!lists.length) return []
        if (isOwnProfile) return lists
        return lists.filter(l => l.isPublic)
    }, [lists, isOwnProfile])

    // ── FETCH PROFILE ──
    const fetchProfile = useCallback(async () => {
        try {
            const userRes = await api.get(`/auth/profile/${username}`)
            const fetchedUser = userRes.data.user
            setUser(fetchedUser)

            // use isFollowedByMe from backend — no more array scanning
            const following = fetchedUser.isFollowedByMe || false

            const canSee = !fetchedUser.isPrivate ||
                currentUser?.username === username ||
                following

            if (canSee) {
                const gamesRes = await api.get(`/games/user/${fetchedUser._id}`)
                setGames(gamesRes.data.games)
                try {
                    const listsRes = await api.get(`/lists/user/${fetchedUser._id}`)
                    setLists(listsRes.data.lists || [])
                } catch {
                    setLists([])
                }
            } else {
                setGames([])
                setLists([])
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
            setLists([])
            setSelectedList(null)
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
        planned: games.filter(g => g.status === 'planned').length,
        dropped: games.filter(g => g.status === 'dropped').length,
        paused: games.filter(g => g.status === 'paused').length,
        hours: games.reduce((sum, g) => sum + (g.hours || 0), 0),
        avgRating: games.filter(g => g.rating > 0).length > 0
            ? (games.filter(g => g.rating > 0).reduce((sum, g) => sum + g.rating, 0) /
                games.filter(g => g.rating > 0).length).toFixed(1)
            : null,
        rated: games.filter(g => g.rating > 0).length,
    }), [games])

    const recentGames = games.slice(0, 6)

    // ── FOLLOW / UNFOLLOW ──
    const handleFollow = async () => {
        if (!currentUser) return
        setFollowLoading(true)
        try {
            if (isFollowing) {
                const res = await api.post(`/auth/unfollow/${user._id}`)
                setRequestSent(false)
                showXpToast(res.data.message || 'Unfollowed · -1 XP', 'loss')
                await fetchProfile()
            } else {
                const res = await api.post(`/auth/follow/${user._id}`)
                if (res.data.type === 'request_sent') {
                    setRequestSent(true)
                    showXpToast('Follow request sent · XP awarded on accept', 'pending')
                } else {
                    showXpToast(res.data.message || 'Following · +1 XP', 'gain')
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
                <div className="text-white font-black text-2xl tracking-widest uppercase"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    User Not Found
                </div>
                <div className="text-[#7a7a90] font-mono text-sm">
                    No user with username "{username}" exists
                </div>
                <Link to="/">
                    <button className="px-4 py-2 bg-[#c8ff57] text-black font-bold text-sm rounded hover:bg-[#d4ff6e] transition-all">
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

            {/* XP Toast */}
            {xpToast && (
                <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-lg font-mono text-sm border transition-all
                                ${xpToast.type === 'loss'
                        ? 'bg-[#ff5c5c]/15 border-[#ff5c5c]/50 text-[#ff5c5c]'
                        : xpToast.type === 'pending'
                            ? 'bg-[#ff9f5c]/15 border-[#ff9f5c]/50 text-[#ff9f5c]'
                            : 'bg-[#c8ff57]/15 border-[#c8ff57]/50 text-[#c8ff57]'}`}>
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
                    <div className="flex-1 text-center sm:text-left">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mb-2">
                            <h1 className="font-black text-3xl md:text-4xl tracking-widest text-white">
                                {user.username}
                            </h1>
                            {user.isPrivate && (
                                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm
                                                 bg-[#ff5c5c]/15 text-[#ff5c5c] border border-[#ff5c5c]/30">
                                    🔒 Private
                                </span>
                            )}
                        </div>

                        {/* XP + Level */}
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-base">{user.badge || '🎮'}</span>
                            <span className="font-mono text-xs text-[#c8ff57] uppercase tracking-wider">
                                Level {user.level || 1}
                            </span>
                            <span className="font-mono text-xs text-[#7a7a90]">·</span>
                            <span className="font-mono text-xs text-[#7a7a90]">{user.xp || 0} XP</span>
                        </div>

                        {user.bio && (
                            <p className="text-[#7a7a90] text-sm mt-1 max-w-md">{user.bio}</p>
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
                    <div className="flex flex-col gap-2">
                        {isOwnProfile && (
                            <>
                                <button
                                    onClick={handlePrivacyToggle}
                                    disabled={privacyLoading}
                                    className={`px-4 py-2 text-sm font-semibold rounded border transition-all disabled:opacity-50
                                               ${user.isPrivate
                                            ? 'border-[#c8ff57]/50 text-[#c8ff57] hover:bg-[#c8ff57]/10'
                                            : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57] hover:text-[#c8ff57]'}`}
                                >
                                    {privacyLoading ? 'Updating...' : user.isPrivate ? '🔒 Private' : '🌐 Public'}
                                </button>
                                <button
                                    onClick={() => navigate('/edit-profile')}
                                    className="px-4 py-2 text-sm font-semibold rounded border border-[#2a2a35]
                                               text-[#7a7a90] hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all"
                                >
                                    ✏️ Edit Profile
                                </button>
                            </>
                        )}

                        {!isOwnProfile && currentUser && (
                            <button
                                onClick={handleFollow}
                                disabled={followLoading || requestSent}
                                className={`px-6 py-2 text-sm font-bold rounded transition-all disabled:opacity-70
                                           ${isFollowing
                                        ? 'border border-[#2a2a35] text-[#7a7a90] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'
                                        : requestSent
                                            ? 'border border-[#ff9f5c]/50 text-[#ff9f5c] cursor-not-allowed'
                                            : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e]'}`}
                            >
                                {followLoading
                                    ? '...'
                                    : isFollowing
                                        ? 'Unfollow'
                                        : requestSent
                                            ? '⏳ Requested'
                                            : 'Follow'}
                            </button>
                        )}

                        {!isOwnProfile && !currentUser && (
                            <Link to="/login">
                                <button className="px-6 py-2 text-sm font-bold rounded bg-[#c8ff57] text-black hover:bg-[#d4ff6e] transition-all">
                                    Login to Follow
                                </button>
                            </Link>
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
                <div className="flex gap-1 mb-4">
                    {[
                        { id: 'games', label: '🎮 Recent Games' },
                        { id: 'stats', label: '📊 Stats' },
                        ...(canSeeLists ? [{ id: 'lists', label: '📋 Lists' }] : []),
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
                            <div className="text-5xl">🔒</div>
                            <div className="text-white font-black text-xl tracking-widest uppercase"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Private Profile
                            </div>
                            <div className="text-[#7a7a90] font-mono text-sm text-center max-w-xs">
                                {requestSent
                                    ? `Your follow request is pending. Wait for ${user.username} to accept.`
                                    : `Follow ${user.username} to see their games`}
                            </div>
                            {!currentUser && (
                                <Link to="/login">
                                    <button className="px-4 py-2 bg-[#c8ff57] text-black font-bold text-sm rounded mt-2 hover:bg-[#d4ff6e] transition-all">
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
                                    <Link
                                        key={game._id}
                                        to={game.igdbId ? `/game/${game.igdbId}` : '#'}
                                        className="bg-[#18181f] border border-[#2a2a35] rounded-lg overflow-hidden
                                                   hover:border-[#c8ff57]/50 transition-all group"
                                    >
                                        <div className="h-[120px] bg-cover bg-center bg-[#2a2a35] relative"
                                            style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'none' }}>
                                            {!imageUrl && (
                                                <div className="w-full h-full flex items-center justify-center text-2xl">🎮</div>
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
                            No games logged yet
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
                                    <div className="w-12 h-12 rounded-lg bg-[#c8ff57]/15 flex items-center justify-center text-2xl flex-shrink-0">📋</div>
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
                                                <div className="w-full h-[140px] bg-[#18181f] flex items-center justify-center text-3xl">🎮</div>
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
                                    <div className="text-4xl">📋</div>
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
                                        <div className="w-12 h-12 rounded-lg bg-[#c8ff57]/15 flex items-center justify-center text-2xl flex-shrink-0">📋</div>
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
                                                    <div key={game.igdbId} className="w-10 h-14 bg-[#2a2a35] rounded flex items-center justify-center text-sm">🎮</div>
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
                                <div className="text-4xl">📋</div>
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