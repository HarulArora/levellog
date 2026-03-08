import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import useGames from '../hooks/useGames'
import AddGameModal from '../components/library/AddGameModal'

// ── Single comment + replies ──
function CommentItem({ comment, currentUser, igdbId, onRefresh }) {
    const [showReplyBox, setShowReplyBox] = useState(false)
    const [replyText, setReplyText] = useState('')
    const [submittingReply, setSubmittingReply] = useState(false)
    const [editingText, setEditingText] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [submittingEdit, setSubmittingEdit] = useState(false)
    const [likes, setLikes] = useState(comment.likes?.length || 0)
    const [dislikes, setDislikes] = useState(comment.dislikes?.length || 0)
    const [isEdited, setIsEdited] = useState(comment.edited || false)
    const [liked, setLiked] = useState(
        currentUser ? comment.likes?.some(id =>
            id === currentUser.id || id === currentUser._id ||
            id?._id === currentUser.id || id?._id === currentUser._id
        ) : false
    )
    const [disliked, setDisliked] = useState(
        currentUser ? comment.dislikes?.some(id =>
            id === currentUser.id || id === currentUser._id ||
            id?._id === currentUser.id || id?._id === currentUser._id
        ) : false
    )

    const isOwn = currentUser && (
        comment.userId?._id === currentUser.id ||
        comment.userId?._id === currentUser._id
    )

    const handleLike = async () => {
        if (!currentUser) return
        try {
            const res = await api.post(`/comments/${comment._id}/like`)
            setLikes(res.data.likes)
            setDislikes(res.data.dislikes)
            setLiked(res.data.liked)
            setDisliked(res.data.disliked)
        } catch (err) { console.error('Like error:', err) }
    }

    const handleDislike = async () => {
        if (!currentUser) return
        try {
            const res = await api.post(`/comments/${comment._id}/dislike`)
            setLikes(res.data.likes)
            setDislikes(res.data.dislikes)
            setLiked(res.data.liked)
            setDisliked(res.data.disliked)
        } catch (err) { console.error('Dislike error:', err) }
    }

    const handleDelete = async () => {
        if (!window.confirm('Delete this comment?')) return
        try {
            await api.delete(`/comments/${comment._id}`)
            onRefresh()
        } catch (err) { console.error('Delete error:', err) }
    }

    const handleEdit = async () => {
        if (!editingText.trim()) return
        setSubmittingEdit(true)
        try {
            await api.put(`/comments/${comment._id}`, { text: editingText })
            setIsEditing(false)
            setIsEdited(true)
            onRefresh()
        } catch (err) { console.error('Edit error:', err) }
        finally { setSubmittingEdit(false) }
    }

    const handleReply = async () => {
        if (!replyText.trim()) return
        setSubmittingReply(true)
        try {
            await api.post(`/comments/${igdbId}`, { text: replyText, parentId: comment._id })
            setReplyText('')
            setShowReplyBox(false)
            onRefresh()
        } catch (err) { console.error('Reply error:', err) }
        finally { setSubmittingReply(false) }
    }

    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000)
        if (seconds < 60) return 'just now'
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        if (days < 7) return `${days}d ago`
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    return (
        <div className={comment.parentId ? 'ml-8 mt-3' : ''}>
            <div className={`bg-[#111118] border rounded-lg p-4 ${isOwn ? 'border-[#c8ff57]/20' : 'border-[#2a2a35]'}`}>

                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                    {comment.userId?.avatar ? (
                        <img src={comment.userId.avatar} alt={comment.userId.username}
                            className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-1 ring-[#2a2a35]" />
                    ) : (
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0
                                        ${isOwn ? 'bg-gradient-to-br from-[#c8ff57] to-[#5c9fff] text-black' : 'bg-[#2a2a35] text-white'}`}
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            {comment.userId?.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                    )}
                    <span className={`font-bold text-xs ${isOwn ? 'text-[#c8ff57]' : 'text-white'}`}>
                        {comment.userId?.username || 'User'}
                        {isOwn && <span className="ml-1 font-mono text-[9px] text-[#7a7a90] normal-case font-normal">· you</span>}
                    </span>
                    <span className="font-mono text-[9px] text-[#7a7a90] border border-[#2a2a35] rounded px-1 py-0.5">
                        Lv.{comment.userId?.level || 1}
                    </span>
                    <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                        {/* Edited badge */}
                        {isEdited && (
                            <span className="font-mono text-[9px] text-[#7a7a90] italic">edited</span>
                        )}
                        <span className="font-mono text-[9px] text-[#7a7a90]">
                            {timeAgo(comment.createdAt)}
                        </span>
                    </div>
                </div>

                {/* Body */}
                {isEditing ? (
                    <div className="mt-2">
                        <textarea value={editingText} onChange={e => setEditingText(e.target.value)} rows={2}
                            className="w-full bg-[#18181f] border border-[#c8ff57]/30 rounded px-3 py-2
                                       text-sm text-white resize-none focus:outline-none focus:border-[#c8ff57] transition-colors" />
                        <div className="flex gap-2 mt-2">
                            <button onClick={handleEdit} disabled={submittingEdit || !editingText.trim()}
                                className="px-3 py-1 bg-[#c8ff57] text-black font-bold text-[10px] rounded
                                           hover:bg-[#d4ff6e] transition-all disabled:opacity-50">
                                {submittingEdit ? 'Saving...' : 'Save'}
                            </button>
                            <button onClick={() => setIsEditing(false)}
                                className="px-3 py-1 border border-[#2a2a35] text-[#7a7a90] font-mono text-[10px] rounded
                                           hover:border-white hover:text-white transition-all">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-[#c8c8d8] text-sm leading-relaxed">{comment.text}</p>
                )}

                {/* Actions */}
                {!isEditing && (
                    <div className="flex items-center gap-3 mt-3">
                        <button onClick={handleLike}
                            className={`flex items-center gap-1 font-mono text-[10px] transition-colors
                                       ${liked ? 'text-[#c8ff57]' : 'text-[#7a7a90] hover:text-[#c8ff57]'}
                                       ${!currentUser ? 'cursor-default' : 'cursor-pointer'}`}>
                            👍 {likes > 0 && <span>{likes}</span>}
                        </button>
                        <button onClick={handleDislike}
                            className={`flex items-center gap-1 font-mono text-[10px] transition-colors
                                       ${disliked ? 'text-[#ff5c5c]' : 'text-[#7a7a90] hover:text-[#ff5c5c]'}
                                       ${!currentUser ? 'cursor-default' : 'cursor-pointer'}`}>
                            👎 {dislikes > 0 && <span>{dislikes}</span>}
                        </button>
                        {currentUser && !comment.parentId && (
                            <button onClick={() => setShowReplyBox(!showReplyBox)}
                                className="font-mono text-[10px] text-[#7a7a90] hover:text-white transition-colors">
                                ↩ Reply
                            </button>
                        )}
                        {isOwn && (
                            <>
                                <button onClick={() => { setIsEditing(true); setEditingText(comment.text) }}
                                    className="font-mono text-[10px] text-[#7a7a90] hover:text-[#c8ff57] transition-colors ml-auto">
                                    ✏ Edit
                                </button>
                                <button onClick={handleDelete}
                                    className="font-mono text-[10px] text-[#7a7a90] hover:text-[#ff5c5c] transition-colors">
                                    🗑 Delete
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Reply box */}
            {showReplyBox && (
                <div className="ml-8 mt-2">
                    <div className="flex gap-2">
                        <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                            placeholder="Write a reply..." rows={2}
                            className="flex-1 bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2
                                       text-sm text-white resize-none focus:outline-none focus:border-[#c8ff57]
                                       placeholder:text-[#7a7a90] transition-colors" />
                        <div className="flex flex-col gap-1">
                            <button onClick={handleReply} disabled={!replyText.trim() || submittingReply}
                                className="px-3 py-1.5 bg-[#c8ff57] text-black font-bold text-[10px] rounded
                                           hover:bg-[#d4ff6e] transition-all disabled:opacity-50">
                                {submittingReply ? '...' : 'Reply'}
                            </button>
                            <button onClick={() => { setShowReplyBox(false); setReplyText('') }}
                                className="px-3 py-1.5 border border-[#2a2a35] text-[#7a7a90] font-mono text-[10px] rounded
                                           hover:border-white transition-all">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Replies */}
            {comment.replies?.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                    {comment.replies.map(reply => (
                        <CommentItem key={reply._id} comment={reply} currentUser={currentUser}
                            igdbId={igdbId} onRefresh={onRefresh} />
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Main GameDetail ──
function GameDetail() {
    const { igdbId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { games, addGame, updateGame } = useGames()

    const [game, setGame] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
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

    const [comments, setComments] = useState([])
    const [commentText, setCommentText] = useState('')
    const [submittingComment, setSubmittingComment] = useState(false)

    const [xpToast, setXpToast] = useState(null)
    const [platformStats, setPlatformStats] = useState(null)
    const [similarStats, setSimilarStats] = useState({})
    const [lightboxIndex, setLightboxIndex] = useState(null)
    const [shareCopied, setShareCopied] = useState(false)

    const showXpToast = (msg) => { setXpToast(msg); setTimeout(() => setXpToast(null), 3000) }
    const showListToast = (msg, type = 'success') => { setListToast({ msg, type }); setTimeout(() => setListToast(null), 3000) }

    const myGame = games.find(g =>
        g.igdbId === parseInt(igdbId) || g.title?.toLowerCase() === game?.title?.toLowerCase()
    )

    const fetchPlatformStats = async () => {
        try {
            const res = await api.get(`/games/stats/${igdbId}`)
            setPlatformStats(res.data.stats)
        } catch (err) { }
    }

    const fetchSimilarStats = async (similarGames) => {
        if (!similarGames?.length) return
        try {
            const ids = similarGames.map(g => g.id).filter(Boolean)
            const res = await api.post('/games/stats/batch', { igdbIds: ids })
            setSimilarStats(res.data.stats || {})
        } catch (err) { }
    }

    const fetchComments = async () => {
        try {
            const res = await api.get(`/comments/${igdbId}`)
            setComments(res.data.comments || [])
        } catch (err) { }
    }

    useEffect(() => {
        const fetchGame = async () => {
            try {
                setLoading(true)
                setError(null)
                const res = await api.get(`/igdb/game/${igdbId}`)
                setGame(res.data.game)
                await fetchPlatformStats()
                fetchSimilarStats(res.data.game.similarGames)
            } catch (err) {
                setError('Failed to load game details')
            } finally {
                setLoading(false)
            }
        }
        fetchGame()
        fetchComments()
    }, [igdbId])

    useEffect(() => {
        if (!game || !user) return
        const fetchSocial = async () => {
            try {
                const [likeRes, wishRes] = await Promise.all([
                    api.get(`/lists/like/${igdbId}`),
                    api.get(`/lists/wishlist/${igdbId}`)
                ])
                setLiked(likeRes.data.liked)
                setWishlisted(wishRes.data.wishlisted)
            } catch (err) { }
        }
        fetchSocial()
    }, [game, user])

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
        if (!user || liking) return
        setLiking(true)
        try {
            const res = await api.post('/lists/like', {
                igdbId: parseInt(igdbId), gameTitle: game.title, gameCover: game.cover, genre: game.genre
            })
            setLiked(res.data.liked)
            if (res.data.liked) showXpToast('❤️ Liked! +1 XP')
            await fetchPlatformStats()
        } catch (err) { } finally { setLiking(false) }
    }

    const handleWishlist = async () => {
        if (!user || wishing) return
        setWishing(true)
        try {
            const res = await api.post('/lists/wishlist', {
                igdbId: parseInt(igdbId), gameTitle: game.title,
                gameCover: game.cover, genre: game.genre, releaseYear: game.releaseYear || ''
            })
            setWishlisted(res.data.wishlisted)
            if (res.data.wishlisted) showXpToast('🎯 Wishlisted! +1 XP')
        } catch (err) { } finally { setWishing(false) }
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
            setShowListModal(false)
        } catch (err) { showListToast('Failed to add to list', 'error') }
    }

    const handlePostComment = async () => {
        if (!commentText.trim() || submittingComment) return
        setSubmittingComment(true)
        try {
            await api.post(`/comments/${igdbId}`, { text: commentText.trim() })
            setCommentText('')
            await fetchComments()
        } catch (err) { console.error('Comment error:', err) }
        finally { setSubmittingComment(false) }
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#7a7a90] font-mono text-sm">Loading...</div>
        </div>
    )

    if (error || !game) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="text-5xl">😵</div>
            <div className="text-white font-mono text-sm">{error || 'Game not found'}</div>
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

    const getLargeScreenshot = (url) => url.replace('t_screenshot_big', 't_screenshot_huge')
    const totalComments = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)

    return (
        <div className="min-h-screen">

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
                <div className="fixed top-5 right-5 z-[100] px-4 py-3 rounded-lg font-mono text-sm
                                bg-[#c8ff57]/15 border border-[#c8ff57]/50 text-[#c8ff57] animate-pulse">
                    {xpToast}
                </div>
            )}

            {/* List Toast */}
            {listToast && (
                <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-lg font-mono text-sm border
                                ${listToast.type === 'error' ? 'bg-[#ff5c5c]/15 border-[#ff5c5c]/50 text-[#ff5c5c]'
                        : 'bg-[#c8ff57]/15 border-[#c8ff57]/50 text-[#c8ff57]'}`}>
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
                                <img src={game.cover} alt={game.title}
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
                                        {platformStats?.avgRating ?? '—'}
                                        {platformStats?.avgRating && <small className="font-mono text-[10px] text-[#a0a0b8] font-normal">/10</small>}
                                    </div>
                                    <div className="font-mono text-[10px] text-[#a0a0b8] uppercase tracking-wider mt-1">
                                        Avg Rating {platformStats?.ratingCount > 0 && <span className="ml-1 text-[#7a7a90]">({platformStats.ratingCount})</span>}
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
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{platformStats?.loggedCount ?? '—'}</div>
                                    <div className="font-mono text-[10px] text-[#a0a0b8] uppercase tracking-wider mt-1">Logged</div>
                                </div>
                                <div>
                                    <div className="font-black text-4xl text-[#ff5c5c] leading-none"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{platformStats?.likeCount ?? '—'}</div>
                                    <div className="font-mono text-[10px] text-[#a0a0b8] uppercase tracking-wider mt-1">Likes</div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-3">
                                {user ? (
                                    myGame ? (
                                        <button onClick={() => setShowAddModal(true)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-xs border transition-all
                                                       ${statusConfig[myGame.status]?.bg || 'bg-[#c8ff57]/15'}
                                                       ${statusConfig[myGame.status]?.color || 'text-[#c8ff57]'}
                                                       border-current hover:opacity-80`}>
                                            {statusConfig[myGame.status]?.label || 'In Library'} · Update Log
                                        </button>
                                    ) : (
                                        <button onClick={() => setShowAddModal(true)}
                                            className="px-4 py-2 bg-[#c8ff57] text-black font-bold text-xs rounded hover:bg-[#d4ff6e] transition-all">
                                            + Log This Game
                                        </button>
                                    )
                                ) : (
                                    <Link to="/login">
                                        <button className="px-4 py-2 bg-[#c8ff57] text-black font-bold text-xs rounded hover:bg-[#d4ff6e] transition-all">
                                            Login to Track
                                        </button>
                                    </Link>
                                )}

                                {user && (
                                    <button onClick={handleLike} disabled={liking}
                                        className={`px-4 py-2 border font-mono text-xs rounded transition-all flex items-center gap-1.5
                                                   ${liked ? 'border-[#ff5c5c] text-[#ff5c5c] bg-[#ff5c5c]/10' : 'border-white/15 text-[#a0a0b8] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'}`}>
                                        {liked ? '❤️' : '🤍'} {liked ? 'Liked' : 'Like'}
                                    </button>
                                )}

                                {user && (
                                    <button onClick={handleWishlist} disabled={wishing}
                                        className={`px-4 py-2 border font-mono text-xs rounded transition-all flex items-center gap-1.5
                                                   ${wishlisted ? 'border-[#5c9fff] text-[#5c9fff] bg-[#5c9fff]/10' : 'border-white/15 text-[#a0a0b8] hover:border-[#5c9fff] hover:text-[#5c9fff]'}`}>
                                        {wishlisted ? '🎯' : '＋'} {wishlisted ? 'Wishlisted' : 'Wishlist'}
                                    </button>
                                )}

                                {user && (
                                    <button onClick={handleOpenListModal}
                                        className="px-4 py-2 border border-white/15 text-[#a0a0b8] font-mono text-xs rounded
                                                   hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all flex items-center gap-1.5">
                                        📋 Add to List
                                    </button>
                                )}

                                <button onClick={handleShare}
                                    className={`px-4 py-2 border font-mono text-xs rounded transition-all
                                               ${shareCopied ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/10' : 'border-white/15 text-[#a0a0b8] hover:border-[#c8ff57] hover:text-[#c8ff57]'}`}>
                                    {shareCopied ? '✓ Copied!' : '↗ Share'}
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

                                {/* Comment input — always visible when logged in */}
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

                                {/* Comments list */}
                                {comments.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {comments.map(comment => (
                                            <CommentItem key={comment._id} comment={comment}
                                                currentUser={user} igdbId={igdbId} onRefresh={fetchComments} />
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

                        {/* My Log */}
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

                        {/* Game Info */}
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

                        {/* Platforms */}
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

                        {/* Similar Games */}
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

            {/* Add to Library Modal */}
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
                        title: game.title, genres: [game.genre || ''], cover: game.cover || '',
                        summary: game.summary || '', igdbId: game.id, platforms: game.platforms || []
                    }}
                />
            )}

            {/* Add to List Modal */}
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
