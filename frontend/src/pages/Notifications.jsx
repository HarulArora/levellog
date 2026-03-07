import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

function Notifications() {

    const { user } = useAuth()
    const navigate = useNavigate()

    const [notifications, setNotifications] = useState([])
    const [requests, setRequests] = useState([])
    const [activeTab, setActiveTab] = useState('notifications')
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState(new Set())
    const [selectMode, setSelectMode] = useState(false)

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const [notifRes, reqRes] = await Promise.all([
                api.get('/notifications'),
                api.get('/notifications/requests')
            ])
            setNotifications(notifRes.data.notifications || [])
            setRequests(reqRes.data.requests || [])
        } catch (err) {
            console.error('Notifications error:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!user) return
        fetchAll()
    }, [user, fetchAll])

    // ── Mark all as read ──
    const handleMarkAllRead = async () => {
        try {
            await api.patch('/notifications/mark-read')
            setNotifications(prev =>
                prev.map(n => ({ ...n, read: true }))
            )
        } catch (err) {
            console.error('Mark read error:', err)
        }
    }

    // ── Mark single as read ──
    const handleMarkOneRead = async (id) => {
        try {
            await api.patch(`/notifications/mark-read/${id}`)
            setNotifications(prev =>
                prev.map(n => n._id === id ? { ...n, read: true } : n)
            )
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
            setNotifications(prev =>
                prev.filter(n => !selected.has(n._id))
            )
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
            setNotifications([])
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
            setRequests(prev => prev.filter(r => r._id !== id))
        } catch (err) {
            console.error('Accept error:', err)
        }
    }

    const handleDecline = async (id) => {
        try {
            await api.post(`/notifications/requests/${id}/decline`)
            setRequests(prev => prev.filter(r => r._id !== id))
        } catch (err) {
            console.error('Decline error:', err)
        }
    }

    // ── Notification icon config ──
    const notifConfig = {
        follow: {
            icon: '👤',
            bg: 'bg-[#c8ff57]/15',
            getText: (n) => (
                <>
                    <span className="text-[#c8ff57] font-bold">
                        {n.sender?.username}
                    </span>
                    {' started following you'}
                </>
            )
        },
        follow_request: {
            icon: '🔔',
            bg: 'bg-[#5c9fff]/15',
            getText: (n) => (
                <>
                    <span className="text-[#c8ff57] font-bold">
                        {n.sender?.username}
                    </span>
                    {' sent you a follow request'}
                </>
            )
        },
        request_accepted: {
            icon: '✅',
            bg: 'bg-[#c8ff57]/15',
            getText: (n) => (
                <>
                    <span className="text-[#c8ff57] font-bold">
                        {n.sender?.username}
                    </span>
                    {' accepted your follow request'}
                </>
            )
        }
    }

    const unreadCount = notifications.filter(n => !n.read).length

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">🔔</div>
                <div
                    className="text-white font-black text-2xl tracking-widest uppercase"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                    Login to see notifications
                </div>
                <Link to="/login">
                    <button className="px-6 py-3 bg-[#c8ff57] text-black font-bold
                             text-sm rounded hover:bg-[#d4ff6e] transition-all">
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
            <div className="flex items-center justify-between mb-6
                      pb-4 border-b border-[#2a2a35]">
                <div className="flex items-center gap-3">
                    <h2
                        className="font-black text-2xl md:text-3xl tracking-widest
                       uppercase text-white"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                        Notifications
                    </h2>
                    {unreadCount > 0 && (
                        <span className="bg-[#ff5c5c] text-white font-mono text-xs
                             font-bold px-2 py-0.5 rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-2 mb-5">
                <button
                    onClick={() => { setActiveTab('notifications'); setSelectMode(false); setSelected(new Set()) }}
                    className={`px-4 py-2 rounded font-mono text-xs uppercase
                     tracking-wider border transition-all
                     ${activeTab === 'notifications'
                            ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/06'
                            : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'
                        }`}
                >
                    Notifications
                    {unreadCount > 0 && (
                        <span className="ml-2 bg-[#ff5c5c] text-white
                             text-[9px] px-1.5 py-0.5 rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => { setActiveTab('requests'); setSelectMode(false); setSelected(new Set()) }}
                    className={`px-4 py-2 rounded font-mono text-xs uppercase
                     tracking-wider border transition-all
                     ${activeTab === 'requests'
                            ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/06'
                            : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'
                        }`}
                >
                    Follow Requests
                    {requests.length > 0 && (
                        <span className="ml-2 bg-[#5c9fff] text-white
                             text-[9px] px-1.5 py-0.5 rounded-full">
                            {requests.length}
                        </span>
                    )}
                </button>
            </div>

            {/* ══════════════════════════════════
          NOTIFICATIONS TAB
      ══════════════════════════════════ */}
            {activeTab === 'notifications' && (
                <>
                    {notifications.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mb-4">

                            {/* Select mode toggle */}
                            <button
                                onClick={() => {
                                    setSelectMode(!selectMode)
                                    setSelected(new Set())
                                }}
                                className={`px-3 py-1.5 font-mono text-[11px] uppercase
                           tracking-wider border rounded transition-all
                           ${selectMode
                                        ? 'border-[#c8ff57] text-[#c8ff57]'
                                        : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'
                                    }`}
                            >
                                {selectMode ? '✕ Cancel' : '☑ Select'}
                            </button>

                            {/* Select all (only in select mode) */}
                            {selectMode && (
                                <button
                                    onClick={handleSelectAll}
                                    className="px-3 py-1.5 font-mono text-[11px] uppercase
                             tracking-wider border border-[#2a2a35]
                             text-[#7a7a90] rounded hover:border-[#c8ff57]
                             hover:text-[#c8ff57] transition-all"
                                >
                                    {selected.size === notifications.length
                                        ? 'Deselect All'
                                        : 'Select All'
                                    }
                                </button>
                            )}

                            {/* Delete selected (only if something selected) */}
                            {selectMode && selected.size > 0 && (
                                <button
                                    onClick={handleDeleteSelected}
                                    className="px-3 py-1.5 font-mono text-[11px] uppercase
                             tracking-wider border border-[#ff5c5c]/40
                             text-[#ff5c5c] rounded hover:border-[#ff5c5c]
                             transition-all"
                                >
                                    🗑 Delete ({selected.size})
                                </button>
                            )}

                            {/* Mark all read */}
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="px-3 py-1.5 font-mono text-[11px] uppercase
                             tracking-wider border border-[#2a2a35]
                             text-[#7a7a90] rounded hover:border-[#5c9fff]
                             hover:text-[#5c9fff] transition-all"
                                >
                                    ✓ Mark All Read
                                </button>
                            )}

                            {/* Delete all */}
                            <button
                                onClick={handleDeleteAll}
                                className="px-3 py-1.5 font-mono text-[11px] uppercase
                           tracking-wider border border-[#ff5c5c]/30
                           text-[#ff5c5c]/70 rounded hover:border-[#ff5c5c]
                           hover:text-[#ff5c5c] transition-all ml-auto"
                            >
                                🗑 Delete All
                            </button>

                        </div>
                    )}

                    {notifications.length > 0 ? (
                        <div className="flex flex-col divide-y divide-[#2a2a35]
                            border border-[#2a2a35] rounded-lg overflow-hidden">
                            {notifications.map(notif => {
                                const config = notifConfig[notif.type] || notifConfig.follow
                                const isSelected = selected.has(notif._id)
                                const isUnread = !notif.read

                                return (
                                    <div
                                        key={notif._id}
                                        onClick={() => {
                                            if (selectMode) {
                                                toggleSelect(notif._id)
                                            } else if (isUnread) {
                                                handleMarkOneRead(notif._id)
                                            }
                                        }}
                                        className={`flex items-center gap-4 px-5 py-4 transition-all
                               ${selectMode ? 'cursor-pointer' : ''}
                               ${isSelected
                                                ? 'bg-[#c8ff57]/08 border-l-2 border-l-[#c8ff57]'
                                                : isUnread
                                                    ? 'bg-[#18181f] border-l-2 border-l-[#5c9fff]'
                                                    : 'bg-[#111118] border-l-2 border-l-transparent hover:bg-[#18181f]'
                                            }`}
                                    >

                                        {/* Checkbox (select mode) */}
                                        {selectMode && (
                                            <div className={`w-4 h-4 rounded border flex-shrink-0
                                       flex items-center justify-center transition-all
                                       ${isSelected
                                                    ? 'bg-[#c8ff57] border-[#c8ff57]'
                                                    : 'border-[#2a2a35]'
                                                }`}>
                                                {isSelected && (
                                                    <span className="text-black text-[10px] font-bold">✓</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Unread dot (not in select mode) */}
                                        {!selectMode && (
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-all
                                       ${isUnread
                                                    ? 'bg-[#5c9fff]'
                                                    : 'bg-transparent'
                                                }`}
                                            />
                                        )}

                                        {/* Icon */}
                                        <div className={`w-9 h-9 rounded-lg flex items-center
                                     justify-center text-sm flex-shrink-0
                                     ${config.bg}`}>
                                            {config.icon}
                                        </div>

                                        {/* Text */}
                                        <div className="flex-1 text-sm text-[#7a7a90]">
                                            {config.getText(notif)}
                                            {isUnread && (
                                                <span className="ml-2 font-mono text-[9px] uppercase
                                         tracking-wider text-[#5c9fff]">
                                                    New
                                                </span>
                                            )}
                                        </div>

                                        {/* Time + actions */}
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className="font-mono text-[10px] text-[#7a7a90]">
                                                {new Date(notif.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric'
                                                })}
                                            </span>
                                        </div>

                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <div className="text-5xl">🔔</div>
                            <div
                                className="text-white font-black text-xl tracking-widest uppercase"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                                All Clear
                            </div>
                            <div className="text-[#7a7a90] font-mono text-sm">
                                No notifications yet
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ══════════════════════════════════
          FOLLOW REQUESTS TAB
      ══════════════════════════════════ */}
            {activeTab === 'requests' && (
                <>
                    {requests.length > 0 ? (
                        <div className="flex flex-col divide-y divide-[#2a2a35]
                            border border-[#2a2a35] rounded-lg overflow-hidden">
                            {requests.map(req => (
                                <div
                                    key={req._id}
                                    className="flex items-center gap-4 px-5 py-4
                             bg-[#111118] hover:bg-[#18181f] transition-all"
                                >
                                    {/* Avatar */}
                                    <div
                                        className="w-9 h-9 rounded-full bg-gradient-to-br
                               from-[#c8ff57] to-[#5c9fff]
                               flex items-center justify-center
                               font-black text-sm text-black flex-shrink-0"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                    >
                                        {req.sender?.username?.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Text */}
                                    <div className="flex-1 text-sm text-[#7a7a90]">
                                        <Link
                                            to={`/user/${req.sender?.username}`}
                                            className="text-[#c8ff57] font-bold hover:underline"
                                        >
                                            {req.sender?.username}
                                        </Link>
                                        {' wants to follow you'}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleAccept(req._id)}
                                            className="px-3 py-1 bg-[#c8ff57] text-black font-bold
                                 text-xs rounded hover:bg-[#d4ff6e] transition-all"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            onClick={() => handleDecline(req._id)}
                                            className="px-3 py-1 border border-[#ff5c5c]/40 text-[#ff5c5c]
                                 text-xs font-semibold rounded
                                 hover:border-[#ff5c5c] transition-all"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <div className="text-5xl">👤</div>
                            <div
                                className="text-white font-black text-xl tracking-widest uppercase"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                                No Requests
                            </div>
                            <div className="text-[#7a7a90] font-mono text-sm">
                                No pending follow requests
                            </div>
                        </div>
                    )}
                </>
            )}

        </div>
    )
}

export default Notifications