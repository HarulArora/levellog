import { useState, useEffect, useCallback, memo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useGamesContext } from '../context/GamesContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { invalidateCache } from '../utils/cache'
import { ThumbsUp, ThumbsDown, MessageSquare, Plus, Check, ListChecks, Heart, Share, Play } from 'lucide-react'
import AddGameModal from '../components/library/AddGameModal'
import Skeleton from '../components/ui/Skeleton'
import { getIGDBImage, SIZES } from '../utils/igdb'

// ── Single comment + replies ──
const CommentItem = memo(({ comment, currentUser, igdbId, onRefresh, onXpToast, depth = 0, gameTitle = '' }) => {
    const navigate = useNavigate()
    const [showReplyBox, setShowReplyBox] = useState(false)
    const [replyText, setReplyText] = useState('')
    const [submittingReply, setSubmittingReply] = useState(false)
    const [editingText, setEditingText] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [submittingEdit, setSubmittingEdit] = useState(false)
    const [isEdited, setIsEdited] = useState(comment.edited || false)
    const [repliesVisible, setRepliesVisible] = useState(true)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // ── Use likeCount/dislikeCount from new backend ──────────────────
    const [likes, setLikes] = useState(
        comment.likeCount ?? comment.likes?.length ?? 0
    )
    const [dislikes, setDislikes] = useState(
        comment.dislikeCount ?? comment.dislikes?.length ?? 0
    )
    const [liked, setLiked] = useState(false)
    const [disliked, setDisliked] = useState(false)

    const hasInteracted = useRef(false)

    useEffect(() => {
        if (!currentUser) return
        const fetchLikeState = async () => {
            try {
                const res = await api.get(`/comments/${comment._id}/like-status`)
                // Only sync if the user hasn't interacted yet to avoid race conditions
                if (!hasInteracted.current) {
                    setLiked(res.data.liked || false)
                    setDisliked(res.data.disliked || false)
                }
            } catch {
                if (!hasInteracted.current && comment.likes) {
                    const uid = currentUser.id || currentUser._id
                    setLiked(comment.likes.some(id => id === uid || id?._id === uid || id?.toString() === uid?.toString()))
                }
                if (!hasInteracted.current && comment.dislikes) {
                    const uid = currentUser.id || currentUser._id
                    setDisliked(comment.dislikes.some(id => id === uid || id?._id === uid || id?.toString() === uid?.toString()))
                }
            }
        }
        fetchLikeState()
    }, [comment._id, currentUser])

    const isOwn = currentUser && (
        comment.userId?._id === currentUser.id ||
        comment.userId?._id === currentUser._id
    )

    const indentClass = depth > 0 ? 'ml-4 md:ml-8 mt-2' : ''
    const replyCount = comment.replies?.length || 0

    const handleLike = async () => {
        if (!currentUser) { navigate('/login'); return }
        hasInteracted.current = true

        // Capture current state for potential revert
        const prevLiked = liked
        const prevDisliked = disliked
        const prevLikes = likes
        const prevDislikes = dislikes

        // Use functional updates to ensure we are using the most recent state in case of rapid clicks
        setLiked(prev => !prev)
        setDisliked(false)
        setLikes(prev => liked ? prev - 1 : prev + 1)
        if (disliked) setDislikes(prev => prev - 1)

        try {
            const res = await api.post(`/comments/${comment._id}/like`)
            // Sync with final server state
            setLikes(res.data.likes)
            setDislikes(res.data.dislikes)
            setLiked(res.data.liked)
            setDisliked(res.data.disliked)
        } catch (err) {
            // Revert on error
            setLiked(prevLiked)
            setDisliked(prevDisliked)
            setLikes(prevLikes)
            setDislikes(prevDislikes)
            console.error('Like error:', err)
        }
    }

    const handleDislike = async () => {
        if (!currentUser) { navigate('/login'); return }
        hasInteracted.current = true

        // Capture current state for potential revert
        const prevLiked = liked
        const prevDisliked = disliked
        const prevLikes = likes
        const prevDislikes = dislikes

        setDisliked(prev => !prev)
        setLiked(false)
        setDislikes(prev => disliked ? prev - 1 : prev + 1)
        if (liked) setLikes(prev => prev - 1)

        try {
            const res = await api.post(`/comments/${comment._id}/dislike`)
            // Sync with final server state
            setLikes(res.data.likes)
            setDislikes(res.data.dislikes)
            setLiked(res.data.liked)
            setDisliked(res.data.disliked)
        } catch (err) {
            // Revert on error
            setLiked(prevLiked)
            setDisliked(prevDisliked)
            setLikes(prevLikes)
            setDislikes(prevDislikes)
            console.error('Dislike error:', err)
        }
    }

    const handleDelete = async () => {
        try {
            const res = await api.delete(`/comments/${comment._id}`)
            onXpToast(res.data.message || '🗑 Comment deleted · -1 XP', 'loss')
            onRefresh()
        } catch (err) { console.error('Delete error:', err) }
        finally { setShowDeleteConfirm(false) }
    }

    const handleEdit = async () => {
        if (!editingText.trim()) return
        setSubmittingEdit(true)
        try {
            await api.put(`/comments/${comment._id}`, { text: editingText })
            setIsEditing(false); setIsEdited(true)
            onRefresh()
        } catch (err) { console.error('Edit error:', err) }
        finally { setSubmittingEdit(false) }
    }

    const handleReply = async () => {
        if (!replyText.trim()) return
        setSubmittingReply(true)
        try {
            const topParentId = comment.parentId || comment._id
            const res = await api.post(`/comments/${igdbId}`, {
                text: replyText, parentId: topParentId, replyToId: comment._id,
                replyToUserId: comment.userId?._id, gameTitle,
            })
            onXpToast(res.data.message || '💬 Reply posted · +1 XP', 'gain')
            setReplyText(''); setShowReplyBox(false); setRepliesVisible(true)
            onRefresh()
        } catch (err) { console.error('Reply error:', err) }
        finally { setSubmittingReply(false) }
    }

    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000)
        if (seconds < 60) return 'just now'
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h`
        const days = Math.floor(hours / 24)
        if (days < 7) return `${days}d`
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const renderText = (text) => {
        if (!text) return null
        const parts = text.split(/(@\w+)/g)
        return parts.map((part, i) =>
            part.startsWith('@')
                ? <Link key={i} to={`/user/${part.slice(1)}`} className="text-[#c8ff57] font-semibold hover:underline">{part}</Link>
                : <span key={i}>{part}</span>
        )
    }

    const username = comment.userId?.username
    const profilePath = username ? `/user/${username}` : null

    return (
        <div className={indentClass}>
            <div className={depth > 0 ? 'border-l-2 border-[#2a2a35] pl-3 md:pl-4' : ''}>
                <div className={`bg-[#111118] border rounded-lg p-3 md:p-4 transition-all ${isOwn ? 'border-[#c8ff57]/20 shadow-[0_0_15px_rgba(200,255,87,0.03)]' : 'border-[#2a2a35]'}`}>
                    
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                        <Link to={profilePath || '#'} className={`flex-shrink-0 ${!profilePath && 'pointer-events-none'}`}>
                            {comment.userId?.avatar ? (
                                <img src={comment.userId.avatar} alt={username} className="w-7 h-7 rounded-full object-cover ring-1 ring-[#2a2a35]" />
                            ) : (
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black
                                                ${isOwn ? 'bg-gradient-to-br from-[#c8ff57] to-[#5c9fff] text-black' : 'bg-[#2a2a35] text-white'}`}
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {username?.charAt(0).toUpperCase() || '?'}
                                </div>
                            )}
                        </Link>
                        <Link to={profilePath || '#'} className={`font-bold text-xs hover:underline ${isOwn ? 'text-[#c8ff57]' : 'text-white'} ${!profilePath && 'pointer-events-none'}`}>
                            {username || 'User'}
                        </Link>
                        <div className="flex items-center gap-1.5 bg-[#18181f] rounded-full px-2 py-0.5 border border-[#2a2a35] shadow-sm">
                            <span className="flex items-center justify-center text-[10px] leading-none relative -top-[1.8px]">{comment.userId?.badge || '🎮'}</span>
                            <span className="font-mono text-[8px] text-[#c8ff57] uppercase font-black tracking-widest leading-none">Lv.{comment.userId?.level || 1}</span>
                        </div>
                        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                            {isEdited && <span className="font-mono text-[8px] text-[#505060] italic">edited</span>}
                            <span className="font-mono text-[9px] text-[#7a7a90]">{timeAgo(comment.createdAt)}</span>
                        </div>
                    </div>

                    {/* Body */}
                    {isEditing ? (
                        <div className="mt-2">
                            <textarea value={editingText} onChange={e => setEditingText(e.target.value)} rows={2}
                                className="w-full bg-[#18181f] border border-[#c8ff57]/30 rounded px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-[#c8ff57] transition-colors" />
                            <div className="flex gap-2 mt-2">
                                <button onClick={handleEdit} disabled={submittingEdit || !editingText.trim()} className="px-3 py-1 bg-[#c8ff57] text-black font-bold text-[10px] rounded hover:bg-[#d4ff6e] transition-all disabled:opacity-50">Save</button>
                                <button onClick={() => setIsEditing(false)} className="px-3 py-1 border border-[#2a2a35] text-[#7a7a90] font-mono text-[10px] rounded hover:border-white hover:text-white transition-all">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-[#c8c8d8] text-sm leading-relaxed break-words">{renderText(comment.text)}</p>
                    )}

                    {/* Actions */}
                    {!isEditing && (
                        <div className="flex items-center gap-2 mt-3">
                            <div className="flex bg-[#18181f] rounded-xl border border-[#2a2a35] p-0.5 shadow-sm">
                                <button onClick={handleLike} className={`px-2 py-1 flex items-center gap-1.5 font-bold text-[10px] rounded-lg transition-all active:scale-95
                                    ${liked ? 'bg-[#c8ff57]/20 text-[#c8ff57]' : 'text-[#7a7a90] hover:bg-white/10 hover:text-white'}`}>
                                    <ThumbsUp size={12} strokeWidth={2.5} className={liked ? 'fill-current' : ''} /> {likes > 0 && <span>{likes}</span>}
                                </button>
                                <div className="w-[1px] bg-[#2a2a35] my-1 mx-0.5" />
                                <button onClick={handleDislike} className={`px-2 py-1 flex items-center gap-1.5 font-bold text-[10px] rounded-lg transition-all active:scale-95
                                    ${disliked ? 'bg-[#ff5c5c]/20 text-[#ff5c5c]' : 'text-[#7a7a90] hover:bg-white/10 hover:text-white'}`}>
                                    <ThumbsDown size={12} strokeWidth={2.5} className={disliked ? 'fill-current' : ''} /> {dislikes > 0 && <span>{dislikes}</span>}
                                </button>
                            </div>

                            {currentUser && (
                                <button onClick={() => { const mention = comment.userId?.username; if (mention) setReplyText(`@${mention} `); setShowReplyBox(true) }}
                                    className="px-2 py-1 flex items-center gap-1 font-bold text-[10px] text-[#7a7a90] hover:text-white transition-colors bg-[#18181f]/50 rounded-lg border border-transparent hover:border-[#2a2a35] active:scale-95 shadow-sm">
                                    <MessageSquare size={12} /> Reply
                                </button>
                            )}

                            {depth === 0 && replyCount > 0 && (
                                <button onClick={() => setRepliesVisible(v => !v)}
                                    className="font-bold text-[10px] text-[#7a7a90] hover:text-[#c8ff57] transition-all bg-[#18181f]/30 px-2 py-1 rounded-lg ml-1 active:scale-95">
                                    {repliesVisible ? `Hide Replies` : `Show ${replyCount} ${replyCount === 1 ? 'Reply' : 'Replies'}`}
                                </button>
                            )}

                            {isOwn && !showDeleteConfirm && (
                                <div className="ml-auto flex gap-1.5">
                                    <button onClick={() => { setIsEditing(true); setEditingText(comment.text) }} className="px-2.5 py-1 text-[#7a7a90] hover:text-black hover:bg-[#c8ff57] transition-all rounded-lg font-bold text-[10px] active:scale-95 shadow-sm">Edit</button>
                                    <button onClick={() => setShowDeleteConfirm(true)} className="px-2.5 py-1 text-[#7a7a90] hover:text-white hover:bg-[#ff5c5c] transition-all rounded-lg font-bold text-[10px] active:scale-95 shadow-sm">Delete</button>
                                </div>
                            )}

                            {/* Inline Delete Confirmation */}
                            {showDeleteConfirm && (
                                <div className="ml-auto flex items-center gap-2 bg-[#ff5c5c]/10 border border-[#ff5c5c]/30 rounded-md px-2 py-1 animate-in fade-in slide-in-from-right-2 duration-200">
                                    <span className="font-mono text-[9px] text-[#ff5c5c] font-bold uppercase tracking-tighter">DELETE?</span>
                                    <button onClick={handleDelete} className="px-2 py-0.5 bg-[#ff5c5c] text-white font-bold text-[9px] rounded uppercase">YES</button>
                                    <button onClick={() => setShowDeleteConfirm(false)} className="px-2 py-0.5 border border-[#ff5c5c]/30 text-[#ff5c5c] font-mono text-[9px] rounded">NO</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Reply box */}
                {showReplyBox && (
                    <div className="mt-2 ml-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex gap-2">
                            <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={`Reply to @${comment.userId?.username}...`} rows={2} autoFocus
                                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply() }}
                                className="flex-1 bg-[#18181f] border border-[#2a2a35] rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-[#c8ff57] placeholder:text-[#7a7a90] transition-colors shadow-inner" />
                            <div className="flex flex-col gap-1">
                                <button onClick={handleReply} disabled={!replyText.trim() || submittingReply} className="px-3 py-1.5 bg-[#c8ff57] text-black font-bold text-[10px] rounded hover:bg-[#d4ff6e] transition-all disabled:opacity-50 h-full">Post</button>
                                <button onClick={() => { setShowReplyBox(false); setReplyText('') }} className="px-3 py-1 border border-[#2a2a35] text-[#7a7a90] font-mono text-[10px] rounded hover:bg-white/5 transition-all">✕</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Replies — collapsible */}
                {replyCount > 0 && (
                    <div className={`overflow-hidden transition-all duration-300 ${repliesVisible ? 'opacity-100 max-h-[9999px]' : 'opacity-0 max-h-0'}`}>
                        <div className="mt-2 flex flex-col gap-2">
                            {comment.replies.map(reply => (
                                <CommentItem key={reply._id} comment={reply} currentUser={currentUser} igdbId={igdbId} onRefresh={onRefresh} onXpToast={onXpToast} depth={Math.min(depth + 1, 2)} gameTitle={gameTitle} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
})

// ── Main GameDetail ──
function GameDetail() {
    const { igdbId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { games: userGames, addGame, updateGame } = useGamesContext()

    const [activeTab, setActiveTab] = useState('overview')
    const [expanded, setExpanded] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showListModal, setShowListModal] = useState(false)
    const [customLists, setCustomLists] = useState([])
    const [loadingLists, setLoadingLists] = useState(false)
    const [listToast, setListToast] = useState(null)

    const [liked, setLiked] = useState(false)
    const [wishlisted, setWishlisted] = useState(false)
    const [liking, setLiking] = useState(false)
    const [wishing, setWishing] = useState(false)

    const [commentText, setCommentText] = useState('')
    const [submittingComment, setSubmittingComment] = useState(false)
    const [xpToast, setXpToast] = useState(null)
    const [lightboxIndex, setLightboxIndex] = useState(null)
    const [shareCopied, setShareCopied] = useState(false)

    // ── CACHED FETCHES ──
    const { data: gameData, loading: loadingGame, error: gameError } = useCachedFetch(
        `game_${igdbId}`,
        `/igdb/game/${igdbId}`,
        { ttl: 30 * 60 * 1000, deps: [igdbId] } // Cache game info for 30m
    )

    const { data: statsData, refetch: refetchStats } = useCachedFetch(
        `game_stats_v2_${igdbId}`,
        `/games/stats/${igdbId}`,
        { enabled: !!igdbId, ttl: 5 * 60 * 1000 }
    )

    const { data: likeData, refetch: refetchLike } = useCachedFetch(
        user ? `game_like_${user.id || user._id}_${igdbId}` : null,
        `/lists/like/${igdbId}`,
        { enabled: !!igdbId && !!user, ttl: 0 }
    )

    const { data: wishData, refetch: refetchWish } = useCachedFetch(
        user ? `game_wish_${user.id || user._id}_${igdbId}` : null,
        `/lists/wishlist/${igdbId}`,
        { enabled: !!igdbId && !!user, ttl: 0 }
    )

    useEffect(() => {
        if (likeData) setLiked(likeData.liked)
    }, [likeData])

    useEffect(() => {
        if (wishData) setWishlisted(wishData.wishlisted)
    }, [wishData])

    const { data: commentsData, refetch: refetchComments } = useCachedFetch(
        `game_comments_${igdbId}`,
        `/comments/${igdbId}`,
        { ttl: 1 * 60 * 1000, deps: [igdbId] } // Comments cache shorter
    )

    const game = gameData?.game
    const loading = loadingGame
    const error = gameError
    const stats = statsData?.stats // Renamed from platformStats to avoid conflict
    const comments = commentsData?.comments || []

    const [similarStats, setSimilarStats] = useState({})
    useEffect(() => {
        if (game?.similarGames?.length) {
            const ids = game.similarGames.map(g => g.id).filter(Boolean)
            api.post('/games/stats/batch', { igdbIds: ids })
                .then(res => setSimilarStats(res.data.stats || {}))
                .catch(() => { })
        }
    }, [game])

    const showXpToast = useCallback((msg, type = 'gain') => {
        setXpToast({ msg, type })
        setTimeout(() => setXpToast(null), 3000)
    }, [])

    const showListToast = useCallback((msg, type = 'success') => { 
        setListToast({ msg, type })
        setTimeout(() => setListToast(null), 3000) 
    }, [])

    const myGame = userGames.find(g =>
        g.igdbId === parseInt(igdbId) || g.title?.toLowerCase() === game?.title?.toLowerCase()
    )

    const fetchPlatformStats = refetchStats
    const fetchComments = refetchComments



    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') setLightboxIndex(null)
            if (e.key === 'ArrowRight' && lightboxIndex !== null)
                setLightboxIndex(i => Math.min(i + 1, (game?.screenshots?.length || 1) - 1))
            if (e.key === 'ArrowLeft' && lightboxIndex !== null)
                setLightboxIndex(i => Math.max(i - 1, 0))
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [lightboxIndex, game])

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
    }

    const handleLike = async () => {
        if (!user) { navigate('/login'); return }
        if (liking) return
        
        // Optimistic Update
        const wasLiked = liked
        setLiked(!wasLiked)
        setLiking(true)
        
        try {
            const res = await api.post('/lists/like', {
                igdbId: parseInt(igdbId), gameTitle: game.title, gameCover: game.cover, genre: game.genre
            })
            setLiked(res.data.liked)
            if (res.data.liked) showXpToast('❤️ Liked! +1 XP', 'gain')
            else showXpToast('💔 Unliked · -1 XP', 'loss')
            invalidateCache(`lists_${user.id || user._id}`)
            invalidateCache(`game_stats_v2_${igdbId}`)
            invalidateCache(`game_like_${user.id || user._id}_${igdbId}`)
            await fetchPlatformStats()
            if (typeof refetchLike === 'function') await refetchLike()
        } catch (err) {
            setLiked(wasLiked) // Revert on failure
        } finally { setLiking(false) }
    }

    const handleWishlist = async () => {
        if (!user) { navigate('/login'); return }
        if (wishing) return

        // Optimistic Update
        const wasWishlisted = wishlisted
        setWishlisted(!wasWishlisted)
        setWishing(true)

        try {
            const res = await api.post('/lists/wishlist', {
                igdbId: parseInt(igdbId), gameTitle: game.title,
                gameCover: game.cover, genre: game.genre, releaseYear: game.releaseYear || ''
            })
            setWishlisted(res.data.wishlisted)
            if (res.data.wishlisted) showXpToast('🎯 Wishlisted!', 'gain')
            invalidateCache(`lists_${user.id || user._id}`)
            invalidateCache(`game_stats_v2_${igdbId}`)
            invalidateCache(`game_wish_${user.id || user._id}_${igdbId}`)
            await fetchPlatformStats()
            if (typeof refetchWish === 'function') await refetchWish()
        } catch (err) {
            setWishlisted(wasWishlisted) // Revert on failure
        } finally { setWishing(false) }
    }

    const handleOpenListModal = async () => {
        setShowListModal(true)
        setLoadingLists(true)
        try {
            const res = await api.get('/lists/me')
            setCustomLists(res.data.customLists || [])
        } catch (err) { } finally { setLoadingLists(false) }
    }

    const handleAddToList = async (listId, listName) => {
        try {
            await api.put(`/lists/custom/${listId}/game`, {
                igdbId: parseInt(igdbId), gameTitle: game.title,
                gameCover: game.cover, genre: game.genre, action: 'add'
            })
            showListToast(`Added to "${listName}"`)
            invalidateCache(`lists_${user.id || user._id}`)
            setShowListModal(false)
        } catch (err) { showListToast('Failed to add to list', 'error') }
    }

    const handlePostComment = async () => {
        if (!commentText.trim() || submittingComment) return
        setSubmittingComment(true)
        try {
            const res = await api.post(`/comments/${igdbId}`, {
                text: commentText.trim(),
                gameTitle: game?.title,
            })
            showXpToast(res.data.message || '💬 Comment posted · +1 XP', 'gain')
            setCommentText('')
            invalidateCache(`game_comments_${igdbId}`)
            await fetchComments()
        } catch (err) { console.error('Comment error:', err) }
        finally { setSubmittingComment(false) }
    }

    if (loading) return (
        <div className="min-h-screen bg-[#0a0a0f] text-[#7a7a90]">
            <div className="relative overflow-hidden min-h-[420px] bg-[#111118]">
                <div className="relative max-w-[1200px] mx-auto px-5 md:px-10 py-10">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <Skeleton variant="block" width="192px" height="280px" style={{ borderRadius: 12 }} />
                        <div className="flex-1 min-w-0 w-full">
                            <Skeleton variant="line" width="60%" height="48px" style={{ marginBottom: 16 }} />
                            <Skeleton variant="line" width="40%" height="16px" style={{ marginBottom: 24 }} />
                            <div className="flex gap-2">
                                <Skeleton variant="block" width="80px" height="24px" />
                                <Skeleton variant="block" width="60px" height="24px" />
                                <Skeleton variant="block" width="100px" height="24px" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-12">
                <Skeleton variant="line" width="200px" height="24px" style={{ marginBottom: 24 }} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-8">
                        <Skeleton variant="block" width="100%" height="200px" />
                        <Skeleton variant="block" width="100%" height="300px" />
                    </div>
                    <div className="space-y-6">
                        <Skeleton variant="block" width="100%" height="400px" />
                    </div>
                </div>
            </div>
        </div>
    )

    if (error || !game) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="text-5xl">😵</div>
            <div className="text-white font-mono text-sm">{(error?.message || error || 'Game not found').toString()}</div>
            <button onClick={() => navigate(-1)}
                className="px-5 py-2 border border-[#2a2a35] text-[#7a7a90] font-mono text-xs rounded
                           hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">← Go Back</button>
        </div>
    )

    const summaryText = game.summary || game.storyline || ''
    const isLong = summaryText.length > 300
    const displayText = isLong && !expanded ? summaryText.slice(0, 300) + '...' : summaryText
    const allTags = [...(game.keywords || []), ...(game.themes || [])].filter(Boolean).slice(0, 12)

    const statusConfig = {
        playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: '▶ Playing' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: '✓ Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: '📋 Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: '✕ Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: '⏸ Paused' },
    }

    const getLargeScreenshot = (url) => getIGDBImage(url, SIZES.HD)
    const totalComments = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)

    return (
        <div className="min-h-screen">
            <Helmet>
                <title>{game.title || game.name} | QuestDeck</title>
                <meta name="description" content={game.summary?.slice(0, 160) || `View community stats and reviews for ${game.title} on QuestDeck.`} />
                <meta property="og:title" content={`${game.title} - QuestDeck Community`} />
                <meta property="og:description" content={game.summary?.slice(0, 200)} />
                {game.cover && <meta property="og:image" content={game.cover} />}
                <meta name="twitter:card" content="summary_large_image" />
            </Helmet>

            {/* Lightbox */}
            {lightboxIndex !== null && game.screenshots?.length > 0 && (
                <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
                    onClick={() => setLightboxIndex(null)}>
                    {lightboxIndex > 0 && (
                        <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => i - 1) }}
                            className="absolute left-4 md:left-8 text-white/60 hover:text-white text-4xl z-10">‹</button>
                    )}
                    <img src={getLargeScreenshot(game.screenshots[lightboxIndex])} alt=""
                        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        onClick={e => e.stopPropagation()} />
                    {lightboxIndex < game.screenshots.length - 1 && (
                        <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => i + 1) }}
                            className="absolute right-4 md:right-8 text-white/60 hover:text-white text-4xl z-10">›</button>
                    )}
                    <div className="absolute top-4 right-4 flex items-center gap-4">
                        <span className="font-mono text-xs text-white/50">{lightboxIndex + 1} / {game.screenshots.length}</span>
                        <button onClick={() => setLightboxIndex(null)} className="text-white/60 hover:text-white text-xl">✕</button>
                    </div>
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto">
                        {game.screenshots.map((url, i) => (
                            <img key={i} src={url} alt=""
                                onClick={e => { e.stopPropagation(); setLightboxIndex(i) }}
                                className={`w-16 h-10 object-cover rounded cursor-pointer flex-shrink-0 transition-all
                                           ${i === lightboxIndex ? 'ring-2 ring-[#c8ff57] opacity-100' : 'opacity-40 hover:opacity-70'}`} />
                        ))}
                    </div>
                </div>
            )}

            {/* XP Toast */}
            {xpToast && (
                <div className={`fixed bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-2xl font-mono text-sm border shadow-2xl backdrop-blur-xl transition-all animate-in slide-in-from-bottom-5 duration-300 w-[calc(100%-40px)] max-w-[320px] text-center flex items-center justify-center gap-2
                                ${xpToast.type === 'loss'
                        ? 'bg-[#ff5c5c]/20 border-[#ff5c5c]/40 text-[#ff5c5c]'
                        : 'bg-[#c8ff57]/20 border-[#c8ff57]/40 text-[#c8ff57]'}`}>
                    {xpToast.msg}
                </div>
            )}

            {/* List Toast */}
            {listToast && (
                <div className={`fixed bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-2xl font-mono text-sm border shadow-2xl backdrop-blur-xl transition-all animate-in slide-in-from-bottom-5 duration-300 w-[calc(100%-40px)] max-w-[320px] text-center flex items-center justify-center gap-2
                                ${listToast.type === 'error' ? 'bg-[#ff5c5c]/20 border-[#ff5c5c]/40 text-[#ff5c5c]'
                        : 'bg-[#c8ff57]/20 border-[#c8ff57]/40 text-[#c8ff57]'}`}>
                    {listToast.msg}
                </div>
            )}

            {/* ══ HERO ══ */}
            <div className="relative overflow-hidden min-h-[420px]">
                {game.cover && (
                    <div className="absolute inset-0 bg-cover bg-center scale-110"
                        style={{ backgroundImage: `url(${game.cover})`, filter: 'blur(60px) brightness(0.35) saturate(1.4)' }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/40 via-[#0a0a0f]/55 to-[#0a0a0f]" />
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0f] to-transparent" />

                <div className="relative max-w-[1200px] mx-auto px-5 md:px-10 py-10">
                    <button onClick={() => navigate(-1)}
                        className="flex items-center gap-2 font-mono text-xs text-[#7a7a90] hover:text-[#c8ff57] transition-colors mb-8">
                        ← BACK
                    </button>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {game.cover && (
                            <div className="flex-shrink-0 drop-shadow-2xl">
                                <img src={getIGDBImage(game.cover, SIZES.COVER_BIG)} alt={game.title}
                                    className="w-36 md:w-48 rounded-lg shadow-2xl ring-1 ring-white/10" />
                            </div>
                        )}

                        <div className="flex-1 min-w-0">
                            <h1 className="font-black text-4xl md:text-6xl text-white uppercase tracking-wide leading-none mb-2"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {game.title}
                            </h1>

                            {game.storyline && (
                                <p className="font-mono text-sm text-[#a0a0b8] italic mb-4 max-w-xl">
                                    {game.storyline.slice(0, 100)}{game.storyline.length > 100 ? '...' : ''}
                                </p>
                            )}

                            <div className="flex flex-wrap gap-2 mb-6">
                                {[game.genre, game.releaseYear, game.developer, game.ageRating, game.modes]
                                    .filter(Boolean).map(tag => (
                                        <span key={tag}
                                            className="font-mono text-[10px] uppercase tracking-wider px-2 py-1
                                                       border border-white/15 text-[#a0a0b8] rounded bg-black/20">
                                            {tag}
                                        </span>
                                    ))}
                            </div>

                            {/* Scores */}
                            <div className="flex flex-wrap gap-8 mb-8">
                                {game.criticScore && (
                                    <div>
                                        <div className="font-black text-4xl text-[#c8ff57] leading-none"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{game.criticScore}</div>
                                        <div className="font-mono text-[10px] text-[#a0a0b8] uppercase tracking-wider mt-1">Critic Score</div>
                                    </div>
                                )}
                                <div>
                                    <div className="font-black text-4xl text-[#5c9fff] leading-none"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                        {stats?.avgRating > 0 ? stats.avgRating : '—'}
                                        {stats?.avgRating > 0 && <small className="font-mono text-[10px] text-[#a0a0b8] font-normal">/10</small>}
                                    </div>
                                    <div className="font-mono text-[10px] text-[#a0a0b8] uppercase tracking-wider mt-1">
                                        Avg Rating {stats?.ratingCount > 0 && <span className="ml-1 text-[#7a7a90]">({stats.ratingCount})</span>}
                                    </div>
                                </div>
                                {user && myGame?.rating > 0 && (
                                    <div>
                                        <div className="font-black text-4xl text-[#c8ff57] leading-none"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {myGame.rating}<small className="font-mono text-[10px] text-[#a0a0b8] font-normal">/10</small>
                                        </div>
                                        <div className="font-mono text-[10px] text-[#a0a0b8] uppercase tracking-wider mt-1">My Rating</div>
                                    </div>
                                )}
                                <div>
                                    <div className="font-black text-4xl text-[#ff9f5c] leading-none"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{stats?.loggedCount ?? '—'}</div>
                                    <div className="font-mono text-[10px] text-[#a0a0b8] uppercase tracking-wider mt-1">Decked</div>
                                </div>
                                <div>
                                    <div className="font-black text-4xl text-[#ff5c5c] leading-none"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{stats?.likeCount ?? '—'}</div>
                                    <div className="font-mono text-[10px] text-[#a0a0b8] uppercase tracking-wider mt-1">Likes</div>
                                </div>
                                <div>
                                    <div className="font-black text-4xl text-[#5c9fff] leading-none"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{stats?.wishlistCount ?? '—'}</div>
                                    <div className="font-mono text-[10px] text-[#a0a0b8] uppercase tracking-wider mt-1">Wishlists</div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-3">
                                {user ? (
                                    myGame ? (
                                        <button onClick={() => setShowAddModal(true)}
                                            className={`btn-apple px-5 py-2.5 flex items-center gap-2 border 
                                                       ${statusConfig[myGame.status]?.bg || 'bg-[#c8ff57]/10'}
                                                       ${statusConfig[myGame.status]?.color || 'text-[#c8ff57]'}
                                                       border-current hover:brightness-125`}>
                                            <Check size={16} strokeWidth={2.5} /> {statusConfig[myGame.status]?.label || 'In Library'} · Update Data
                                        </button>
                                    ) : (
                                        <button onClick={() => setShowAddModal(true)} className="btn-apple btn-apple-primary px-5 py-2.5 gap-1.5">
                                            <Plus size={16} strokeWidth={3} /> Add to Deck
                                        </button>
                                    )
                                ) : (
                                    <Link to="/login">
                                        <button className="btn-apple btn-apple-primary px-5 py-2.5">
                                            Join QuestDeck
                                        </button>
                                    </Link>
                                )}


                                {user && (
                                    <button onClick={handleLike} disabled={liking}
                                        className={`btn-apple px-4 py-2.5 flex items-center gap-1.5 backdrop-blur-md border 
                                                   ${liked ? 'border-[#ff5c5c] text-[#ff5c5c] bg-[#ff5c5c]/10' : 'border-white/10 bg-black/40 text-[#c8c8d8] hover:border-[#ff5c5c] hover:bg-[#ff5c5c]/10 hover:text-[#ff5c5c]'}`}>
                                        <Heart size={16} className={liked ? 'fill-[#ff5c5c]' : ''} /> {liked ? 'Liked' : 'Like'}
                                    </button>
                                )}

                                {user && (
                                    <button onClick={handleWishlist} disabled={wishing}
                                        className={`btn-apple px-4 py-2.5 flex items-center gap-1.5 backdrop-blur-md border 
                                                   ${wishlisted ? 'border-[#5c9fff] text-[#5c9fff] bg-[#5c9fff]/10' : 'border-white/10 bg-black/40 text-[#c8c8d8] hover:border-[#5c9fff] hover:bg-[#5c9fff]/10 hover:text-[#5c9fff]'}`}>
                                        {wishlisted ? <Check size={16} strokeWidth={3} /> : <Plus size={16} />} {wishlisted ? 'Wishlisted' : 'Wishlist'}
                                    </button>
                                )}

                                {user && (
                                    <button onClick={handleOpenListModal} className="btn-apple btn-apple-secondary px-4 py-2.5 gap-1.5">
                                        <ListChecks size={16} /> Add to List
                                    </button>
                                )}

                                <button onClick={handleShare}
                                    className={`btn-apple px-4 py-2.5 flex items-center gap-1.5 backdrop-blur-md border 
                                               ${shareCopied ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/10' : 'border-white/10 bg-black/40 text-[#c8c8d8] hover:border-[#c8ff57] hover:bg-[#c8ff57]/10 hover:text-[#c8ff57]'}`}>
                                    {shareCopied ? <Check size={16} strokeWidth={3} /> : <Share size={16} />} {shareCopied ? 'Copied!' : 'Share'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ══ TAB BAR ══ */}
            <div className="border-b border-[#2a2a35] bg-[#0a0a0f] sticky top-[65px] z-40">
                <div className="max-w-[1200px] mx-auto px-5 md:px-10">
                    <div className="flex gap-6">
                        {['overview', 'comments'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`font-mono text-xs uppercase tracking-widest py-4 border-b-2 transition-all
                                           ${activeTab === tab ? 'border-[#c8ff57] text-[#c8ff57]' : 'border-transparent text-[#7a7a90] hover:text-white'}`}>
                                {tab}
                                {tab === 'comments' && totalComments > 0 && (
                                    <span className="ml-1.5 opacity-60">({totalComments})</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══ MAIN CONTENT ══ */}
            <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">

                    {/* Left Column */}
                    <div className="flex flex-col gap-6">

                        {activeTab === 'overview' && (
                            <>
                                {game.videoId && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">🎬 Trailer</div>
                                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                            <iframe className="absolute inset-0 w-full h-full rounded-lg"
                                                src={`https://www.youtube.com/embed/${game.videoId}?rel=0&modestbranding=1`}
                                                title={`${game.title} Trailer`}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen />
                                        </div>
                                    </div>
                                )}

                                {summaryText && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">About</div>
                                        <p className="text-[#c8c8d8] text-sm leading-relaxed">{displayText}</p>
                                        {isLong && (
                                            <button onClick={() => setExpanded(!expanded)}
                                                className="mt-3 font-mono text-xs text-[#c8ff57] hover:underline">
                                                {expanded ? 'Show less ↑' : 'Read more ↓'}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {game.screenshots?.length > 0 && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">
                                            Screenshots <span className="ml-2 text-[#2a2a35] normal-case font-normal">· click to enlarge</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {game.screenshots.slice(0, 6).map((url, i) => (
                                                <div key={i} onClick={() => setLightboxIndex(i)}
                                                    className="relative cursor-pointer group overflow-hidden rounded-lg">
                                                    <img src={url} alt={`Screenshot ${i + 1}`}
                                                        className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white font-mono text-[10px] uppercase tracking-wider">
                                                            ⤢ Expand
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {game.screenshots.length > 6 && (
                                            <div className="mt-3 font-mono text-[10px] text-[#7a7a90] text-center">
                                                +{game.screenshots.length - 6} more · use arrow keys to navigate
                                            </div>
                                        )}
                                    </div>
                                )}

                                {allTags.length > 0 && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">Tags</div>
                                        <div className="flex flex-wrap gap-2">
                                            {allTags.map(tag => (
                                                <span key={tag}
                                                    className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5
                                                               border border-[#2a2a35] text-[#7a7a90] rounded
                                                               hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all cursor-default">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'comments' && (
                            <div className="flex flex-col gap-4">

                                {user ? (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-3">Leave a Comment</div>
                                        <div className="flex gap-3">
                                            {user.avatar ? (
                                                <img src={user.avatar} alt={user.username}
                                                    className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-[#2a2a35] mt-0.5" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c8ff57] to-[#5c9fff]
                                                                flex items-center justify-center text-sm font-black text-black flex-shrink-0 mt-0.5"
                                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                    {user.username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                                                    placeholder="Share your thoughts..."
                                                    rows={3}
                                                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePostComment() }}
                                                    className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2.5
                                                               text-sm text-white resize-none focus:outline-none focus:border-[#c8ff57]
                                                               placeholder:text-[#7a7a90] transition-colors" />
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="font-mono text-[9px] text-[#7a7a90]">Ctrl+Enter to post</span>
                                                    <button onClick={handlePostComment}
                                                        disabled={!commentText.trim() || submittingComment}
                                                        className="px-4 py-1.5 bg-[#c8ff57] text-black font-bold text-xs rounded
                                                                   hover:bg-[#d4ff6e] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                                        {submittingComment ? 'Posting...' : 'Post'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5 flex items-center gap-4">
                                        <div className="text-2xl">💬</div>
                                        <div>
                                            <div className="text-white font-semibold text-sm">Join the discussion</div>
                                            <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5">
                                                <Link to="/login" className="text-[#c8ff57] hover:underline">Login</Link> to comment
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {comments.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {comments.map(comment => (
                                            <CommentItem key={comment._id} comment={comment}
                                                currentUser={user} igdbId={igdbId}
                                                onRefresh={fetchComments} onXpToast={showXpToast}
                                                depth={0}
                                                gameTitle={game?.title}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                                        <div className="text-4xl">💬</div>
                                        <div className="text-[#7a7a90] font-mono text-sm">No comments yet. Be the first!</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column */}
                    <div className="flex flex-col gap-6">

                        {user && myGame && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">My Log</div>
                                <div className="flex flex-col divide-y divide-[#2a2a35]">
                                    <div className="flex justify-between py-2.5">
                                        <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">Status</span>
                                        <span className={`font-mono text-[10px] uppercase tracking-wider ${statusConfig[myGame.status]?.color || 'text-white'}`}>
                                            {statusConfig[myGame.status]?.label?.replace(/^[^\s]+\s/, '') || myGame.status}
                                        </span>
                                    </div>
                                    {myGame.rating > 0 && (
                                        <div className="flex justify-between py-2.5">
                                            <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">My Rating</span>
                                            <span className="font-mono text-[10px] text-[#c8ff57]">{myGame.rating}/10</span>
                                        </div>
                                    )}
                                    {myGame.hours > 0 && (
                                        <div className="flex justify-between py-2.5">
                                            <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">Hours</span>
                                            <span className="font-mono text-[10px] text-white">{myGame.hours}h</span>
                                        </div>
                                    )}
                                    {myGame.platforms?.length > 0 && (
                                        <div className="flex justify-between py-2.5">
                                            <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">Platform</span>
                                            <span className="font-mono text-[10px] text-white">{myGame.platforms.join(', ')}</span>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => setShowAddModal(true)}
                                    className="mt-3 w-full py-2 border border-[#2a2a35] text-[#7a7a90] font-mono text-[10px]
                                               uppercase tracking-wider rounded hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">
                                    Edit Log
                                </button>
                            </div>
                        )}

                        <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                            <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">Game Info</div>
                            <div className="flex flex-col divide-y divide-[#2a2a35]">
                                {[
                                    { label: 'Developer', value: game.developer },
                                    { label: 'Publisher', value: game.publisher },
                                    { label: 'Release Year', value: game.releaseYear },
                                    { label: 'Engine', value: game.engine },
                                    { label: 'Modes', value: game.modes },
                                    { label: 'Rating', value: game.ageRating },
                                ].filter(i => i.value).map(item => (
                                    <div key={item.label} className="flex justify-between py-2.5 gap-4">
                                        <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">{item.label}</span>
                                        <span className="font-mono text-[11px] text-white text-right">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {game.platforms?.length > 0 && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">Platforms</div>
                                <div className="flex flex-wrap gap-2">
                                    {game.platforms.map(p => (
                                        <span key={p} className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 bg-[#2a2a35] text-[#7a7a90] rounded">
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {game.similarGames?.length > 0 && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">Similar Games</div>
                                <div className="flex flex-col gap-3">
                                    {game.similarGames.map(sg => (
                                        <Link key={sg.id} to={`/game/${sg.id}`}
                                            className="flex items-center gap-3 hover:opacity-80 transition-opacity group">
                                            {sg.cover ? (
                                                <img src={sg.cover} alt={sg.title} className="w-10 h-14 object-cover rounded flex-shrink-0" />
                                            ) : (
                                                <div className="w-10 h-14 bg-[#2a2a35] rounded flex-shrink-0 flex items-center justify-center text-sm">🎮</div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white text-xs font-semibold truncate group-hover:text-[#c8ff57] transition-colors">{sg.title}</div>
                                                <div className="font-mono text-[9px] text-[#7a7a90] mt-1">View details</div>
                                            </div>
                                            {similarStats[sg.id]?.avgRating ? (
                                                <div className="font-black text-lg text-[#5c9fff] flex-shrink-0"
                                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                    {similarStats[sg.id].avgRating}
                                                    <small className="font-mono text-[9px] text-[#7a7a90] font-normal">/10</small>
                                                </div>
                                            ) : null}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── ADD / EDIT MODAL ── */}
            {showAddModal && (
                <AddGameModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={async (formData) => {
                        try {
                            if (myGame) { await updateGame(myGame._id, formData) }
                            else { await addGame(formData) }
                            setShowAddModal(false)
                            await fetchPlatformStats()
                            return { success: true }
                        } catch (err) { return { success: false } }
                    }}
                    preselectedGame={{
                        title: game.title,
                        genres: [game.genre || ''],
                        cover: game.cover || '',
                        summary: game.summary || '',
                        igdbId: game.id,
                        platforms: game.platforms || []
                    }}
                    existingEntry={myGame ?? null}
                />
            )}

            {showListModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={e => e.target === e.currentTarget && setShowListModal(false)}>
                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg w-full max-w-sm">
                        <div className="flex items-center justify-between p-5 border-b border-[#2a2a35]">
                            <div>
                                <div className="font-black text-lg text-white tracking-widest uppercase"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Add to List</div>
                                <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5 truncate max-w-[220px]">{game.title}</div>
                            </div>
                            <button onClick={() => setShowListModal(false)} className="text-[#7a7a90] hover:text-white text-xl">✕</button>
                        </div>
                        <div className="p-5">
                            {loadingLists ? (
                                <div className="text-center py-8 font-mono text-xs text-[#7a7a90]">Loading lists...</div>
                            ) : customLists.length === 0 ? (
                                <div className="flex flex-col items-center gap-3 py-8">
                                    <div className="text-3xl">📋</div>
                                    <div className="font-mono text-xs text-[#7a7a90] text-center">No custom lists yet.</div>
                                    <button onClick={() => { setShowListModal(false); navigate('/lists') }}
                                        className="px-4 py-2 bg-[#c8ff57] text-black font-bold text-xs rounded hover:bg-[#d4ff6e] transition-all">
                                        Create a List →
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {customLists.map(list => (
                                        <button key={list._id} onClick={() => handleAddToList(list._id, list.name)}
                                            className="flex items-center gap-3 p-3 rounded-lg border border-[#2a2a35]
                                                       hover:border-[#c8ff57] hover:bg-[#c8ff57]/05 transition-all text-left group">
                                            <div className="w-8 h-8 rounded bg-[#c8ff57]/15 flex items-center justify-center text-sm flex-shrink-0">📋</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-semibold text-sm truncate group-hover:text-[#c8ff57] transition-colors">{list.name}</div>
                                                <div className="font-mono text-[9px] text-[#7a7a90] mt-0.5">
                                                    {list.games?.length || 0} games · {list.isPublic ? 'Public' : 'Private'}
                                                </div>
                                            </div>
                                            <span className="font-mono text-[10px] text-[#c8ff57] opacity-0 group-hover:opacity-100 transition-opacity">+ Add</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default GameDetail