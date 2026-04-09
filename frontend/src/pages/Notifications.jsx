import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { invalidateCache } from '../utils/cache'
import { Bell, UserPlus, Check, MessageSquare, Trash2, X, Plus, Users } from 'lucide-react'

function Notifications() {

    const { user } = useAuth()
    const navigate = useNavigate()

    const userId = user?.id || user?._id

    // Cached fetches — fast on return visits within 30s
    const { data: notifData, loading: loadingNotif, refetch: refetchNotifs } = useCachedFetch(
        userId ? `notif_${userId}` : null,
        userId ? '/notifications' : null,
        { enabled: !!userId, ttl: 30 * 1000 }
    )
    const { data: reqData, loading: loadingReq, refetch: refetchReqs } = useCachedFetch(
        userId ? `notif_req_${userId}` : null,
        userId ? '/notifications/requests' : null,
        { enabled: !!userId, ttl: 30 * 1000 }
    )
    const loading = loadingNotif || loadingReq

    // Local shadows allow optimistic UI mutations without breaking cache
    const [localNotifs, setLocalNotifs] = useState(null)
    const [localRequests, setLocalRequests] = useState(null)
    const notifications = localNotifs ?? (notifData?.notifications || [])
    const requests      = localRequests ?? (reqData?.requests || [])

    const [activeTab, setActiveTab] = useState('notifications')
    const [selected, setSelected] = useState(new Set())
    const [selectMode, setSelectMode] = useState(false)

    // Full refetch — invalidates cache, fetches fresh, clears shadows
    const fetchAll = useCallback(async () => {
        invalidateCache(userId ? `notif_${userId}` : '')
        invalidateCache(userId ? `notif_req_${userId}` : '')
        setLocalNotifs(null)
        setLocalRequests(null)
        await Promise.all([refetchNotifs(), refetchReqs()])
    }, [userId, refetchNotifs, refetchReqs])

    // ── Mark all as read ──
    const handleMarkAllRead = async () => {
        try {
            await api.patch('/notifications/mark-read')
            setLocalNotifs(prev => (prev ?? notifications).map(n => ({ ...n, read: true })))
        } catch (err) {
            console.error('Mark read error:', err)
        }
    }

    // ── Mark single as read ──
    const handleMarkOneRead = async (id) => {
        try {
            await api.patch(`/notifications/mark-read/${id}`)
            setLocalNotifs(prev => (prev ?? notifications).map(n => n._id === id ? { ...n, read: true } : n))
        } catch (err) {
            console.error('Mark one read error:', err)
        }
    }

    // ── Delete selected ──
    const handleDeleteSelected = async () => {
        if (selected.size === 0) return
        try {
            await api.delete('/notifications/delete-selected', {
                data: { ids: Array.from(selected) }
            })
            setLocalNotifs(prev => (prev ?? notifications).filter(n => !selected.has(n._id)))
            setSelected(new Set())
            setSelectMode(false)
        } catch (err) {
            console.error('Delete selected error:', err)
        }
    }

    // ── Delete all ──
    const handleDeleteAll = async () => {
        try {
            await api.delete('/notifications/delete-all')
            setLocalNotifs([])
            setSelected(new Set())
            setSelectMode(false)
        } catch (err) {
            console.error('Delete all error:', err)
        }
    }

    // ── Toggle select one ──
    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    // ── Select all ──
    const handleSelectAll = () => {
        if (selected.size === notifications.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(notifications.map(n => n._id)))
        }
    }

    // ── Follow request actions ──
    const handleAccept = async (id) => {
        try {
            await api.post(`/notifications/requests/${id}/accept`)
            setLocalRequests(prev => (prev ?? requests).filter(r => r._id !== id))
        } catch (err) {
            console.error('Accept error:', err)
        }
    }

    const handleDecline = async (id) => {
        try {
            await api.post(`/notifications/requests/${id}/decline`)
            setLocalRequests(prev => (prev ?? requests).filter(r => r._id !== id))
        } catch (err) {
            console.error('Decline error:', err)
        }
    }

    // ── Notification config ──
    const notifConfig = {
        follow: {
            icon: <UserPlus size={16} strokeWidth={2.5} />,
            bg: 'bg-[#c8ff57]/15 text-[#c8ff57]',
            getText: (n) => (
                <>
                    <span className="text-[#c8ff57] font-bold hover:underline">{n.sender?.username}</span>
                    {' started following you'}
                </>
            ),
            getLink: (n) => n.sender?.username ? `/user/${n.sender.username}` : null,
        },
        follow_request: {
            icon: <Bell size={16} strokeWidth={2.5} />,
            bg: 'bg-[#5c9fff]/15 text-[#5c9fff]',
            getText: (n) => (
                <>
                    <span className="text-[#c8ff57] font-bold hover:underline">{n.sender?.username}</span>
                    {' sent you a follow request'}
                </>
            ),
            getLink: (n) => n.sender?.username ? `/user/${n.sender.username}` : null,
        },
        request_accepted: {
            icon: <Check size={16} strokeWidth={3} />,
            bg: 'bg-[#c8ff57]/15 text-[#c8ff57]',
            getText: (n) => (
                <>
                    <span className="text-[#c8ff57] font-bold hover:underline">{n.sender?.username}</span>
                    {' accepted your follow request'}
                </>
            ),
            getLink: (n) => n.sender?.username ? `/user/${n.sender.username}` : null,
        },
        // ✅ NEW — reply notification
        comment_reply: {
            icon: <MessageSquare size={16} />,
            bg: 'bg-[#ff9f5c]/15 text-[#ff9f5c]',
            getText: (n) => (
                <>
                    <span className="text-[#c8ff57] font-bold">{n.sender?.username}</span>
                    {' replied to your comment'}
                    {/* ✅ show game name */}
                    {n.meta?.gameTitle && (
                        <span className="text-[#7a7a90]"> on </span>
                    )}
                    {n.meta?.gameTitle && (
                        <span className="text-white font-semibold">{n.meta.gameTitle}</span>
                    )}
                    {n.meta?.preview && (
                        <span className="block font-mono text-[10px] text-[#7a7a90] mt-0.5 truncate max-w-[300px]">
                            "{n.meta.preview}"
                        </span>
                    )}
                </>
            ),
            getLink: (n) => n.meta?.igdbId ? `/game/${n.meta.igdbId}` : null,
        },
    }

    const unreadCount = notifications.filter(n => !n.read).length

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Bell size={56} className="text-[#c8ff57] mb-2" strokeWidth={1.5} />
                <div className="text-white font-black text-2xl tracking-widest uppercase"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    Login to see notifications
                </div>
                <Link to="/login">
                    <button className="btn-apple btn-apple-primary px-8 py-3">
                        Login
                    </button>
                </Link>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-[#7a7a90] font-mono text-sm">Loading...</div>
            </div>
        )
    }

    return (
        <div className="max-w-[700px] mx-auto px-5 md:px-10 py-8 md:py-10">

            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2a2a35]">
                <div className="flex items-center gap-3">
                    <h2 className="font-black text-2xl md:text-3xl tracking-widest uppercase text-white"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        Notifications
                    </h2>
                    {unreadCount > 0 && (
                        <span className="bg-[#ff5c5c] text-white font-mono text-xs font-bold px-2 py-0.5 rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-2 mb-5">
                <button
                    onClick={() => { setActiveTab('notifications'); setSelectMode(false); setSelected(new Set()) }}
                    className={`px-4 py-2 rounded font-mono text-xs uppercase tracking-wider border transition-all
                     ${activeTab === 'notifications'
                            ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/06'
                            : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'}`}
                >
                    Notifications
                    {unreadCount > 0 && (
                        <span className="ml-2 bg-[#ff5c5c] text-white text-[9px] px-1.5 py-0.5 rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => { setActiveTab('requests'); setSelectMode(false); setSelected(new Set()) }}
                    className={`px-4 py-2 rounded font-mono text-xs uppercase tracking-wider border transition-all
                     ${activeTab === 'requests'
                            ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/06'
                            : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'}`}
                >
                    Follow Requests
                    {requests.length > 0 && (
                        <span className="ml-2 bg-[#5c9fff] text-white text-[9px] px-1.5 py-0.5 rounded-full">
                            {requests.length}
                        </span>
                    )}
                </button>
            </div>

            {/* ══ NOTIFICATIONS TAB ══ */}
            {activeTab === 'notifications' && (
                <>
                    {notifications.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <button
                                onClick={() => { setSelectMode(!selectMode); setSelected(new Set()) }}
                                className={`btn-apple px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider border rounded transition-all
                           ${selectMode ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/10' : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'}`}
                            >
                                {selectMode ? <><X size={12} className="mr-1" /> Cancel</> : <><Check size={12} className="mr-1" /> Select</>}
                            </button>

                            {selectMode && (
                                <button onClick={handleSelectAll}
                                    className="btn-apple px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider border border-[#2a2a35] text-[#7a7a90] bg-[#18181f]/80 rounded hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">
                                    {selected.size === notifications.length ? 'Deselect All' : 'Select All'}
                                </button>
                            )}

                            {selectMode && selected.size > 0 && (
                                <button onClick={handleDeleteSelected}
                                    className="btn-apple px-3 py-1.5 flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider border border-[#ff5c5c]/40 text-[#ff5c5c] hover:bg-[#ff5c5c] hover:text-white transition-all">
                                    <Trash2 size={12} /> Delete ({selected.size})
                                </button>
                            )}

                            {unreadCount > 0 && (
                                <button onClick={handleMarkAllRead}
                                    className="btn-apple px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider border border-[#2a2a35] text-[#7a7a90] hover:border-[#5c9fff] hover:text-[#5c9fff] transition-all">
                                    <Check size={12} className="mr-1" /> Mark All Read
                                </button>
                            )}

                            <button onClick={handleDeleteAll}
                                className="btn-apple px-3 py-1.5 flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider border border-[#ff5c5c]/30 text-[#ff5c5c]/70 hover:bg-[#ff5c5c] hover:text-white transition-all ml-auto">
                                <Trash2 size={12} /> Delete All
                            </button>
                        </div>
                    )}

                    {notifications.length > 0 ? (
                        <div className="flex flex-col divide-y divide-[#2a2a35] border border-[#2a2a35] rounded-lg overflow-hidden">
                            {notifications.map(notif => {
                                const config = notifConfig[notif.type] || notifConfig.follow
                                const isSelected = selected.has(notif._id)
                                const isUnread = !notif.read
                                const link = config.getLink?.(notif)

                                // Wrap in Link if there's a destination (e.g. comment_reply → game page)
                                const WrapperEl = link ? Link : 'div'
                                const wrapperProps = link ? { to: link } : {}

                                return (
                                    <WrapperEl
                                        key={notif._id}
                                        {...wrapperProps}
                                        onClick={(e) => {
                                            if (selectMode) {
                                                if (link) e.preventDefault()
                                                toggleSelect(notif._id)
                                            } else if (isUnread) {
                                                handleMarkOneRead(notif._id)
                                            }
                                        }}
                                        className={`flex items-center gap-4 px-5 py-4 transition-all no-underline
                               ${selectMode ? 'cursor-pointer' : link ? 'cursor-pointer' : ''}
                               ${isSelected
                                                ? 'bg-[#c8ff57]/08 border-l-2 border-l-[#c8ff57]'
                                                : isUnread
                                                    ? 'bg-[#18181f] border-l-2 border-l-[#5c9fff]'
                                                    : 'bg-[#111118] border-l-2 border-l-transparent hover:bg-[#18181f]'
                                            }`}
                                    >
                                        {/* Checkbox (select mode) */}
                                        {selectMode && (
                                            <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all
                                       ${isSelected ? 'bg-[#c8ff57] border-[#c8ff57]' : 'border-[#2a2a35]'}`}>
                                                {isSelected && <span className="text-black text-[10px] font-bold">✓</span>}
                                            </div>
                                        )}

                                        {/* Unread dot */}
                                        {!selectMode && (
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-all ${isUnread ? 'bg-[#5c9fff]' : 'bg-transparent'}`} />
                                        )}

                                        {/* Icon */}
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${config.bg}`}>
                                            {config.icon}
                                        </div>

                                        {/* Text */}
                                        <div className="flex-1 text-sm text-[#7a7a90] min-w-0">
                                            {config.getText(notif)}
                                            {isUnread && (
                                                <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-[#5c9fff]">
                                                    New
                                                </span>
                                            )}
                                        </div>

                                        {/* Time */}
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className="font-mono text-[10px] text-[#7a7a90]">
                                                {new Date(notif.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    </WrapperEl>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Bell size={56} className="text-[#2a2a35] mb-2" strokeWidth={1.5} />
                            <div className="text-white font-black text-xl tracking-widest uppercase"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                All Clear
                            </div>
                            <div className="text-[#7a7a90] font-mono text-sm">No notifications yet</div>
                        </div>
                    )}
                </>
            )}

            {/* ══ FOLLOW REQUESTS TAB ══ */}
            {activeTab === 'requests' && (
                <>
                    {requests.length > 0 ? (
                        <div className="flex flex-col divide-y divide-[#2a2a35] border border-[#2a2a35] rounded-lg overflow-hidden">
                            {requests.map(req => (
                                <div key={req._id}
                                    className="flex items-center gap-4 px-5 py-4 bg-[#111118] hover:bg-[#18181f] transition-all">
                                    {req.sender?.avatar ? (
                                        <img src={req.sender.avatar} alt={req.sender.username}
                                            className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-[#2a2a35]" />
                                    ) : (
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c8ff57] to-[#5c9fff] flex items-center justify-center font-black text-sm text-black flex-shrink-0"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {req.sender?.username?.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 text-sm text-[#7a7a90] min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <Link to={`/user/${req.sender?.username}`}
                                                className="text-[#c8ff57] font-bold hover:underline truncate">
                                                {req.sender?.username}
                                            </Link>
                                            <div className="flex items-center gap-1.5 bg-[#0a0a0f]/60 rounded-full px-2 py-0.5 border border-[#2a2a35] shadow-sm shadow-black/40">
                                                <span className="flex items-center justify-center text-[10px] leading-none relative -top-[1.8px]">{req.sender?.badge || '🎮'}</span>
                                                <span className="font-mono text-[8px] text-[#c8ff57] uppercase font-black tracking-widest leading-none">Lv.{req.sender?.level || 1}</span>
                                            </div>
                                        </div>
                                        <div className="text-[11px] opacity-70">wants to follow you</div>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button onClick={() => handleAccept(req._id)}
                                            className="btn-apple btn-apple-primary px-4 py-2">
                                            Accept
                                        </button>
                                        <button onClick={() => handleDecline(req._id)}
                                            className="btn-apple btn-apple-secondary px-4 py-2 hover:bg-[#ff5c5c]/20 hover:text-[#ff5c5c] hover:border-[#ff5c5c]/50">
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Users size={56} className="text-[#2a2a35] mb-2" strokeWidth={1.5} />
                            <div className="text-white font-black text-xl tracking-widest uppercase"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                No Requests
                            </div>
                            <div className="text-[#7a7a90] font-mono text-sm">No pending follow requests</div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default Notifications