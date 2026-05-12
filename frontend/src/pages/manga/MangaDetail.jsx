import { useState, useEffect, useCallback, memo } from 'react'
import DeleteConfirmModal from '../../components/ui/DeleteConfirmModal'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import useCachedFetch from '../../hooks/useCachedFetch'
import { ThumbsUp, ThumbsDown, MessageSquare, Plus, Check, Heart, Share, Play, Layers, ListChecks, ShoppingBag, ExternalLink, ChevronRight, Star, Users, Target, Gamepad2, Trash2, Edit2 } from 'lucide-react'
import AddAnimeModal from '../../components/library/AddAnimeModal'
import Skeleton from '../../components/ui/Skeleton'
import Avatar from '../../components/ui/Avatar'
import { useLeaderboard } from '../../context/LeaderboardContext'
import AvatarFrame from '../../components/ui/AvatarFrame'
import GifPicker from '../../components/ui/GifPicker'


const GifIcon = ({ size = 16, className = "" }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <text 
            x="50%" 
            y="50%" 
            fontSize="9" 
            fontWeight="900" 
            fontFamily="system-ui" 
            textAnchor="middle" 
            dy=".3em" 
            fill="currentColor" 
            stroke="none"
        >GIF</text>
    </svg>
)

const RANK_TITLES = {
    1: { label: 'KING', color: 'text-yellow-400' },
    2: { label: 'TOP CHALLENGER', color: 'text-[#B9F2FF]' },
    3: { label: 'ELITE HUNTER', color: 'text-[#cd7f32]' },
    4: { label: 'IRON GUARD', color: 'text-[#94999c]' },
}

const RelationItem = memo(({ item, label, colorClass, icon }) => {
    // Priority 1: Use pre-bundled cover if available
    // Priority 2: Fetch via useCachedFetch as fallback
    const { data: coverData } = useCachedFetch(
        !item.cover ? `anime_cover_${item.type}_${item.id}` : null,
        !item.cover ? `/anime/cover/${item.type}/${item.id}` : null,
        { ttl: 24 * 60 * 60 * 1000, enabled: !item.cover } 
    )

    const coverUrl = item.cover || coverData?.cover
    const route = item.type === 'manga' ? `/manga/${item.id}?type=manga` : `/anime/${item.id}?type=anime`

    return (
        <Link to={route} className={`flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-${colorClass}/30 transition-all group overflow-hidden`}>
            <div className={`w-14 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-white/10 group-hover:border-${colorClass}/50 transition-all bg-[#0a0a0f]`}>
                {coverUrl ? (
                    <img src={coverUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full bg-[#1a1a25] flex items-center justify-center text-xl">{icon}</div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`font-mono text-[9px] text-${colorClass} uppercase tracking-widest px-1.5 py-0.5 rounded bg-${colorClass}/10`}>{label}</span>
                    <span className="font-mono text-[9px] text-[#7a7a90] uppercase tracking-widest">{item.type?.toUpperCase()}</span>
                </div>
                <div className={`text-white font-bold text-[15px] truncate group-hover:text-${colorClass} transition-colors`}>{item.name}</div>
                <div className="text-[#5c5c6c] text-[10px] mt-1 font-mono uppercase tracking-tighter">View Details →</div>
            </div>
        </Link>
    )
})

const CommentItem = memo(({ comment, currentUser, externalId, type, onRefresh, onXpToast, setAllComments, depth = 0, title = '' }) => {
    const navigate = useNavigate()
    const location = useLocation()
    const { topUsers } = useLeaderboard()
    
    const userRankInfo = topUsers.find(u => u._id === comment.userId?._id || u._id === comment.userId?.id)
    const rank = userRankInfo?.rank

    const [showReplyBox, setShowReplyBox] = useState(false)
    const [showGifPicker, setShowGifPicker] = useState(false)
    const [replyText, setReplyText] = useState('')
    const [submittingReply, setSubmittingReply] = useState(false)
    const [editingText, setEditingText] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [isEdited, setIsEdited] = useState(comment.edited || false)
    const [repliesVisible] = useState(true)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showBurst, setShowBurst] = useState(false)

    const [likes, setLikes] = useState(comment.likeCount ?? comment.likes?.length ?? 0)
    const [dislikes, setDislikes] = useState(comment.dislikeCount ?? comment.dislikes?.length ?? 0)
    const [liked, setLiked] = useState(false)
    const [disliked, setDisliked] = useState(false)

    const isOwn = currentUser && (
        comment.userId?._id === currentUser.id ||
        comment.userId?._id === currentUser._id
    )

    const indentClass = depth > 0 ? 'ml-4 md:ml-8 mt-2' : ''
    const replyCount = comment.replies?.length || 0
    const handleLike = async () => {
        if (!currentUser) { navigate('/login', { state: { from: location } }); return }
        
        const prevLiked = liked
        const prevDisliked = disliked
        const prevLikes = likes
        const prevDislikes = dislikes

        // Optimistic Update
        const nowLiked = !prevLiked
        setLiked(nowLiked)
        setLikes(prev => nowLiked ? prev + 1 : prev - 1)

        if (nowLiked && prevDisliked) {
            setDisliked(false)
            setDislikes(prev => prev - 1)
        }

        if (nowLiked) {
            setShowBurst(true)
            setTimeout(() => setShowBurst(false), 800)
        }

        try {
            await api.post(`/anime/comments/${comment._id}/like`, { type: 'like' })
            // We rely on the optimistic update; only revert on failure
        } catch (err) { 
            setLiked(prevLiked); setDisliked(prevDisliked)
            setLikes(prevLikes); setDislikes(prevDislikes)
            console.error('Like error:', err) 
        }
    }

    const handleDislike = async () => {
        if (!currentUser) { navigate('/login', { state: { from: location } }); return }
        
        const prevLiked = liked
        const prevDisliked = disliked
        const prevLikes = likes
        const prevDislikes = dislikes

        // Optimistic Update
        const nowDisliked = !prevDisliked
        setDisliked(nowDisliked)
        setDislikes(prev => nowDisliked ? prev + 1 : prev - 1)

        if (nowDisliked && prevLiked) {
            setLiked(false)
            setLikes(prev => prev - 1)
        }

        try {
            await api.post(`/anime/comments/${comment._id}/like`, { type: 'dislike' })
            // We rely on the optimistic update; only revert on failure
        } catch (err) {
            setLiked(prevLiked); setDisliked(prevDisliked)
            setLikes(prevLikes); setDislikes(prevDislikes)
            console.error('Dislike error:', err)
        }
    }


    const handleDelete = async () => {
        try {
            setSubmittingReply(true)
            const res = await api.delete(`/anime/comments/${comment._id}`)
            onXpToast(res.data.message || '🗑 Comment deleted', 'loss')
            onRefresh(true)
        } catch (err) { 
            console.error('Delete error:', err)
            onXpToast('Failed to delete comment', 'error')
        }
        finally { 
            setSubmittingReply(false)
            setShowDeleteConfirm(false) 
        }
    }

    const handleEdit = async () => {
        if (!editingText.trim()) return
        try {
            await api.put(`/anime/comments/${comment._id}`, { text: editingText })
            setIsEditing(false); setIsEdited(true)
            onXpToast('✏️ Comment updated', 'gain')
            onRefresh(true)
        } catch (err) { console.error(err) }
    }

    const handleReply = async () => {
        if (!currentUser) { navigate('/login', { state: { from: location } }); return }
        if (!replyText.trim() || submittingReply) return
        const text = replyText.trim()
        setReplyText('')
        setShowReplyBox(false)
        setSubmittingReply(true)
        try {
            await api.post(`/anime/comments/${externalId}`, {
                text, parentId: comment._id, type
            })
            onXpToast('💬 Reply posted', 'gain')
            onRefresh(true) 
        } catch (err) { console.error(err) }
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
        const parts = text.split(/(@\w+)|(https?:\/\/[^\s]+)/g)
        return parts.map((part, i) => {
            if (!part) return null
            if (part.startsWith('@')) return <Link key={i} to={`/user/${part.slice(1)}`} className="text-[#c8ff57] font-semibold hover:underline">{part}</Link>
            if (part.startsWith('http')) {
                const isImage = /\.(jpg|jpeg|png|webp|gif)$|giphy\.com\/media/i.test(part)
                if (isImage) return <div key={i} className="mt-2 mb-1 max-w-full"><img src={part} alt="GIF" loading="lazy" className="rounded-lg max-h-64 object-contain border border-[#2a2a35] transition-all bg-[#0a0a0f]" /></div>
                return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-[#5c9fff] hover:underline break-all">{part}</a>
            }
            return <span key={i}>{part}</span>
        })
    }

    const username = comment.userId?.username
    const profilePath = username ? `/user/${username}` : null

    return (
        <div className={indentClass}>
            <div className={depth > 0 ? 'border-l-2 border-[#2a2a35] pl-3 md:pl-4' : ''}>
                <div className={`bg-[#111118] border rounded-lg p-3 md:p-4 transition-all 
                    ${isOwn ? 'border-[#c8ff57]/20 shadow-[0_0_15px_rgba(200,255,87,0.03)]' : 'border-[#2a2a35]'}
                    ${rank === 1 ? 'bg-yellow-400/8 border-yellow-400/40 border-l-[4px]' : ''}
                    ${rank === 2 ? 'bg-[#B9F2FF]/8 border-[#B9F2FF]/40 border-l-[4px]' : ''}
                    ${rank === 3 ? 'bg-[#cd7f32]/8 border-[#cd7f32]/40 border-l-[4px]' : ''}
                    ${rank === 4 ? 'bg-[#94999c]/8 border-[#94999c]/40 border-l-[4px]' : ''}
                `}>
                    <div className="flex items-center gap-2 mb-2">
                        <Link to={profilePath || '#'} className="flex-shrink-0"><AvatarFrame userId={comment.userId?._id || comment.userId?.id} src={comment.userId?.avatar} size={32} className="comment-avatar" /></Link>
                        <Link to={profilePath || '#'} className={`font-bold text-xs hover:underline 
                            ${rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-[#B9F2FF]' : rank === 3 ? 'text-[#cd7f32]' : rank === 4 ? 'text-[#94999c]' : isOwn ? 'text-[#c8ff57]' : 'text-white'}`}
                        >
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
                    {isEditing ? (
                        <div className="mt-2">
                            <textarea value={editingText} onChange={e => setEditingText(e.target.value)} rows={2} className="w-full bg-[#18181f] border border-[#c8ff57]/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8ff57]" />
                            <div className="flex justify-end gap-2 mt-1">
                                <button onClick={handleEdit} className="px-3 py-1 bg-[#c8ff57] text-black font-bold text-[10px] rounded">Save</button>
                                <button onClick={() => setIsEditing(false)} className="px-3 py-1 border border-[#2a2a35] text-[#7a7a90] font-mono text-[10px] rounded">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[#c8c8d8] text-sm leading-relaxed break-words whitespace-pre-wrap">{renderText(comment.text)}</div>
                    )}
                    <div className="flex items-center gap-3 mt-4">
                        <div className="flex items-center bg-[#18181f] rounded-lg border border-[#2a2a35] p-0.5 shadow-sm relative">
                            {showBurst && (
                                <div className="rank-like-burst">
                                    {rank === 1 ? '👑' : rank === 2 ? '🪽' : rank === 3 ? '🎖️' : rank === 4 ? '⚔️' : '📖'}
                                </div>
                            )}
                            <button onClick={handleLike} className={`px-2.5 py-1.5 flex items-center gap-2 font-bold text-[10px] rounded-md transition-all ${liked ? 'bg-[#c8ff57]/20 text-[#c8ff57]' : 'text-[#7a7a90] hover:text-white hover:bg-white/5'}`}><ThumbsUp size={14} /> {likes > 0 && <span>{likes}</span>}</button>
                            <div className="w-[1px] h-3 bg-[#2a2a35] mx-0.5" />
                            <button onClick={handleDislike} className={`px-2.5 py-1.5 flex items-center gap-2 font-bold text-[10px] rounded-md transition-all ${disliked ? 'bg-[#ff5c5c]/20 text-[#ff5c5c]' : 'text-[#7a7a90] hover:text-white hover:bg-white/5'}`}><ThumbsDown size={14} /> {dislikes > 0 && <span>{dislikes}</span>}</button>
                        </div>
                        
                        {currentUser && (
                            <button 
                                onClick={() => { setReplyText(`@${username} `); setShowReplyBox(true) }} 
                                className="px-3 py-1.5 flex items-center gap-2 font-bold text-[10px] text-[#7a7a90] hover:text-white bg-[#18181f]/50 rounded-lg border border-[#2a2a35]/50 hover:border-[#2a2a35] transition-all"
                            >
                                <MessageSquare size={14} /> 
                                Reply
                            </button>
                        )}

                        {isOwn && (
                            <div className="ml-auto flex items-center gap-1">
                                <button 
                                    onClick={() => { setIsEditing(true); setEditingText(comment.text) }} 
                                    className="p-2 text-[#7a7a90] hover:text-[#c8ff57] transition-all rounded-lg"
                                    title="Edit"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button 
                                    onClick={() => setShowDeleteConfirm(true)} 
                                    className="p-2 text-[#7a7a90] hover:text-[#ff5c5c] transition-all rounded-lg"
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    <DeleteConfirmModal 
                        isOpen={showDeleteConfirm}
                        onClose={() => setShowDeleteConfirm(false)}
                        onConfirm={handleDelete}
                        isLoading={submittingReply}
                        title="Delete Comment"
                        message="Are you sure you want to delete this comment? This action will also remove all associated XP and cannot be undone."
                    />
                </div>
                {showReplyBox && (
                    <div className="mt-2 ml-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex gap-2">
                            <div className="flex-1 flex flex-col gap-1">
                                <textarea 
                                    value={replyText} 
                                    onChange={e => setReplyText(e.target.value)} 
                                    placeholder={`Reply to @${username}...`} 
                                    rows={2} 
                                    autoFocus
                                    maxLength={1000}
                                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply() }}
                                    className="w-full bg-[#18181f] border border-[#2a2a35] rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-[#c8ff57] placeholder:text-[#7a7a90] transition-colors shadow-inner" 
                                />
                                <div className="flex justify-end">
                                    <span className="text-[9px] text-[#505060] font-mono">{replyText.length}/1000</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex gap-1">
                                    <button onClick={handleReply} disabled={!replyText.trim() || submittingReply} className="px-3 py-1.5 bg-[#c8ff57] text-black font-bold text-[10px] rounded hover:bg-[#d4ff6e] transition-all disabled:opacity-50 h-full">Post</button>
                                    <div className="relative">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setShowGifPicker(!showGifPicker) }} 
                                            className={`p-1.5 border rounded hover:bg-white/5 transition-all h-full flex items-center justify-center ${showGifPicker ? 'border-[#c8ff57] text-[#c8ff57]' : 'border-[#2a2a35] text-[#7a7a90]'}`}
                                            title="Add GIF"
                                        >
                                            <GifIcon size={14} />
                                        </button>
                                        {showGifPicker && (
                                            <GifPicker 
                                                onSelect={(url) => { setReplyText(prev => prev + (prev ? ' ' : '') + url); setShowGifPicker(false) }} 
                                                onClose={() => setShowGifPicker(false)} 
                                            />
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => { setShowReplyBox(false); setReplyText(''); setShowGifPicker(false) }} className="px-3 py-1 border border-[#2a2a35] text-[#7a7a90] font-mono text-[10px] rounded hover:bg-white/5 transition-all">✕</button>
                            </div>
                        </div>
                    </div>
                )}
                {replyCount > 0 && repliesVisible && (
                    <div className="mt-2 flex flex-col gap-2">
                        {comment.replies.map(reply => (
                            <CommentItem key={reply._id} comment={reply} currentUser={currentUser} externalId={externalId} type={type} onRefresh={onRefresh} onXpToast={onXpToast} setAllComments={setAllComments} depth={Math.min(depth + 1, 2)} title={title} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
})

function MangaDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const { user, updateUser } = useAuth()
    const type = 'manga'

    const [activeTab, setActiveTab] = useState('overview')
    const [expanded, setExpanded] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [userLibrary, setUserLibrary] = useState([])
    const [liked, setLiked] = useState(false)
    const [wishlisted, setWishlisted] = useState(false)
    const [liking, setLiking] = useState(false)
    const [wishing, setWishing] = useState(false)
    const [commentText, setCommentText] = useState('')
    const [showGifPicker, setShowGifPicker] = useState(false)
    const [submittingComment, setSubmittingComment] = useState(false)
    const [xpToast, setXpToast] = useState(null)
    const [allComments, setAllComments] = useState([])
    const [commentPage, setCommentPage] = useState(1)
    const [shareCopied, setShareCopied] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(-1)


    const { data: contextData, loading, error, refetch: refetchContext, setData: setContextData } = useCachedFetch(
        `anime_context_${id}_${type}_${user?.id || 'anon'}`,
        `/anime/detail/${id}?type=${type}`,
        { deps: [id, type, user?.id], ttl: 5 * 60 * 1000 }
    )

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [id])

    useEffect(() => {
        if (contextData?.userStatus) {
            setLiked(contextData.userStatus.liked)
            setWishlisted(contextData.userStatus.wishlisted)
        }
        const fetchLib = async () => {
            if (user) {
                const res = await api.get('/anime/library')
                setUserLibrary(res.data.library || [])
            }
        }
        fetchLib()
    }, [contextData, user])

    const { data: commentsData, refetch: refetchComments } = useCachedFetch(
        `anime_comments_${id}_${commentPage}`,
        `/anime/comments/${id}?page=${commentPage}&limit=10&type=${type}`,
        { ttl: 1 * 60 * 1000, deps: [id, commentPage, type] }
    )

    useEffect(() => {
        if (commentsData?.comments) {
            if (commentPage === 1) setAllComments(commentsData.comments)
            else setAllComments(prev => [...prev, ...commentsData.comments])
        }
    }, [commentsData, commentPage])

    const anime = contextData?.anime
    const stats = contextData?.stats
    const myEntry = userLibrary.find(a => String(a.externalId) === String(id))

    const showXpToast = useCallback((msg, type = 'gain') => {
        setXpToast({ msg, type })
        setTimeout(() => setXpToast(null), 3000)
    }, [])

    const handleLike = async () => {
        if (!user) { navigate('/login', { state: { from: location } }); return }
        if (liking) return
        const wasLiked = liked
        const oldData = contextData
        setLiked(!wasLiked)
        setLiking(true)
        if (oldData) setContextData({
            ...oldData,
            stats: { ...oldData.stats, likeCount: Math.max(0, (oldData.stats.likeCount || 0) + (wasLiked ? -1 : 1)) },
            userStatus: { ...(oldData.userStatus || {}), liked: !wasLiked }
        })
        try {
            const res = await api.post('/lists/like', { 
                externalId: id, 
                gameTitle: anime.title, 
                gameCover: anime.cover || anime.coverImage, 
                mediaType: type, 
                genre: anime.genres?.[0] 
            })
            setLiked(res.data.liked)
            if (res.data.liked) {
                showXpToast('❤️ Liked! +1 XP', 'gain')
                if (res.data.xp) updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
            }
            else showXpToast('💔 Unliked', 'loss')
            refetchContext(true)
        } catch (err) {
            console.error('Like error:', err)
            setLiked(wasLiked)
            if (oldData) setContextData(oldData)
        } finally { setLiking(false) }
    }

    const handleWishlist = async () => {
        if (!user) { navigate('/login', { state: { from: location } }); return }
        if (wishing) return
        const wasWishlisted = wishlisted
        const oldData = contextData
        setWishlisted(!wasWishlisted)
        setWishing(true)
        if (oldData) setContextData({
            ...oldData,
            stats: { ...oldData.stats, wishlistCount: Math.max(0, (oldData.stats.wishlistCount || 0) + (wasWishlisted ? -1 : 1)) },
            userStatus: { ...(oldData.userStatus || {}), wishlisted: !wasWishlisted }
        })
        try {
            const res = await api.post('/lists/wishlist', { 
                externalId: id, 
                gameTitle: anime.title, 
                gameCover: anime.cover || anime.coverImage, 
                mediaType: type, 
                genre: anime.genres?.[0] 
            })
            setWishlisted(res.data.wishlisted)
            if (res.data.wishlisted) showXpToast('🎯 Wishlisted!', 'gain')
            refetchContext(true)
        } catch (err) {
            console.error('Wishlist error:', err)
            setWishlisted(wasWishlisted)
            if (oldData) setContextData(oldData)
        } finally { setWishing(false) }
    }


    const handlePostComment = async () => {
        if (!user) { navigate('/login', { state: { from: location } }); return }
        if (!commentText.trim() || submittingComment) return
        const text = commentText.trim()
        setCommentText('')
        setSubmittingComment(true)
        try {
            await api.post(`/anime/comments/${id}`, { text, title: anime?.title, type })
            showXpToast('💬 Comment posted', 'gain')
            refetchComments(true)
        } catch (err) {
            console.error('Comment error:', err)
            setCommentText(text)
            showXpToast('Failed to post comment', 'loss')
        } finally { setSubmittingComment(false) }
    }

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
    }

    if (loading && !anime) return (
        <div className="min-h-screen bg-[#0a0a0f] p-10">
            <Skeleton variant="block" width="200px" height="300px" />
            <Skeleton variant="line" width="60%" height="48px" className="mt-8" />
        </div>
    )

    if (error || !anime) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
            <div className="text-5xl">😵</div>
            <div className="text-[#7a7a90] font-mono text-sm">Media not found</div>
            <button onClick={() => navigate(-1)} className="px-5 py-2 border border-[#2a2a35] text-[#7a7a90] rounded hover:border-[#c8ff57] hover:text-[#c8ff57]">← BACK</button>
        </div>
    )

    const summaryText = anime.summary || ''
    const isLong = summaryText.length > 300
    const displayText = isLong && !expanded ? summaryText.slice(0, 300) + '...' : summaryText

    const statusConfig = {
        watching: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: '▶ Watching' },
        reading: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: '📖 Reading' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: '✓ Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: '📋 Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: '✕ Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: '⏸ Paused' },
    }

    let currentStatusKey = myEntry?.status
    if (currentStatusKey === 'playing') {
        currentStatusKey = type === 'manga' ? 'reading' : 'watching'
    }

    return (
        <div className="min-h-screen">
            <Helmet>
                <title>{anime.title} | QuestDuck</title>
                <meta name="description" content={anime.summary?.slice(0, 160)} />
            </Helmet>

            {xpToast && (
                <div className={`fixed bottom-22 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-2xl font-mono text-sm border shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 
                                ${xpToast.type === 'loss' ? 'bg-[#ff5c5c]/20 border-[#ff5c5c]/40 text-[#ff5c5c]' : 'bg-[#c8ff57]/20 border-[#c8ff57]/40 text-[#c8ff57]'}`}>
                    {xpToast.msg}
                </div>
            )}

            {/* HERO */}
            <div className="relative overflow-hidden min-h-[420px]">
                <div className="absolute inset-0 bg-cover bg-center scale-110" style={{ backgroundImage: `url(${anime.cover || anime.coverImage})`, filter: 'blur(60px) brightness(0.35)' }} />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/40 via-[#0a0a0f]/55 to-[#0a0a0f]" />
                <div className="relative max-w-[1200px] mx-auto px-5 md:px-10 pt-10 pb-10">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-mono text-xs text-[#7a7a90] hover:text-[#c8ff57] mb-8 transition-colors">← BACK</button>
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="flex gap-4 md:gap-8 items-stretch md:items-start w-full md:w-auto">
                            <div className="relative flex-shrink-0">
                                <img 
                                    src={anime.cover || anime.coverImage} 
                                    alt={anime.title} 
                                    className="w-40 md:w-64 aspect-[3/4] object-cover rounded-lg shadow-2xl ring-1 ring-white/10 transition-transform duration-500 hover:scale-[1.02]" 
                                />
                            </div>

                            {/* Mobile Stats (Right of thumbnail) */}
                            <div className="flex md:hidden flex-col gap-1.5 flex-1 min-w-0">
                                <div className="grid grid-cols-2 gap-1.5">
                                    {/* Avg Rating */}
                                    <div className="bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-lg p-1.5 flex flex-col items-center justify-center text-center">
                                        <div className="w-5 h-5 rounded-full bg-[#5c9fff]/10 flex items-center justify-center text-[#5c9fff] mb-1">
                                            <Star size={11} fill="currentColor" />
                                        </div>
                                        <div className="flex items-baseline gap-0.5">
                                            <span className="text-[11px] font-bold text-white">{stats?.avgRating > 0 ? stats.avgRating : '—'}</span>
                                            {stats?.avgRating > 0 && <span className="text-[7px] text-[#7a7a90]">/10</span>}
                                        </div>
                                        <div className="text-[7px] text-[#7a7a90] uppercase font-bold tracking-wider">Avg</div>
                                    </div>

                                    {/* Logged (Pond) */}
                                    <div className="bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-lg p-1.5 flex flex-col items-center justify-center text-center">
                                        <div className="w-5 h-5 rounded-full bg-[#ff9f5c]/10 flex items-center justify-center text-[#ff9f5c] mb-1">
                                            <ShoppingBag size={11} />
                                        </div>
                                        <span className="text-[11px] font-bold text-white">{stats?.loggedCount ?? '0'}</span>
                                        <div className="text-[7px] text-[#7a7a90] uppercase font-bold tracking-wider">Pond</div>
                                    </div>

                                    {/* Likes */}
                                    <div className="bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-lg p-1.5 flex flex-col items-center justify-center text-center">
                                        <div className="w-5 h-5 rounded-full bg-[#ff5c5c]/10 flex items-center justify-center text-[#ff5c5c] mb-1">
                                            <Heart size={11} fill="currentColor" />
                                        </div>
                                        <span className="text-[11px] font-bold text-white">{stats?.likeCount ?? '0'}</span>
                                        <div className="text-[7px] text-[#7a7a90] uppercase font-bold tracking-wider">Likes</div>
                                    </div>

                                    {/* Watchlisted */}
                                    <div className="bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-lg p-1.5 flex flex-col items-center justify-center text-center">
                                        <div className="w-5 h-5 rounded-full bg-[#5c9fff]/10 flex items-center justify-center text-[#5c9fff] mb-1">
                                            <Target size={11} />
                                        </div>
                                        <span className="text-[11px] font-bold text-white">{stats?.wishlistCount ?? '0'}</span>
                                        <div className="text-[7px] text-[#7a7a90] uppercase font-bold tracking-wider">Watchlisted</div>
                                    </div>
                                </div>

                                {/* My Rating (Inside Stats Column) */}
                                <div className={`bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-lg p-1.5 flex flex-col items-center justify-center gap-1 mt-1.5 flex-1 ${(!user || !(myEntry?.rating > 0)) ? 'opacity-30' : ''}`}>
                                    <div className="w-5 h-5 rounded-full bg-[#c8ff57]/10 flex items-center justify-center text-[#c8ff57]">
                                        <Star size={11} fill="currentColor" />
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="flex items-baseline gap-0.5">
                                            <span className={`text-[11px] font-bold ${myEntry?.rating > 0 ? 'text-[#c8ff57]' : 'text-white'}`}>{myEntry?.rating > 0 ? myEntry.rating : '—'}</span>
                                            {myEntry?.rating > 0 && <span className="text-[7px] text-[#7a7a90]">/10</span>}
                                        </div>
                                        <div className="text-[7px] text-[#7a7a90] uppercase font-bold tracking-wider">My Rating</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-w-0 w-full">
                            <h1 className="font-black text-4xl md:text-6xl text-white uppercase tracking-wide leading-none mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{anime.title}</h1>
                            <div className="flex flex-wrap gap-2 mb-6">
                                {[type.toUpperCase(), anime.year, anime.episodes ? `${anime.episodes} Eps` : null, anime.chapters ? `${anime.chapters} Chs` : null].filter(Boolean).map(tag => (
                                    <span key={tag} className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-white/15 text-[#a0a0b8] rounded bg-black/20">{tag}</span>
                                ))}
                            </div>

                            {/* Desktop Stats Grid */}
                            <div className="hidden md:grid grid-cols-5 gap-4 mb-10 overflow-hidden">
                                {/* Avg Rating */}
                                <div className="bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a25]/80 hover:border-[#5c9fff]/30 transition-all duration-300 shadow-lg">
                                    <div className="w-8 h-8 rounded-full bg-[#5c9fff]/10 flex items-center justify-center text-[#5c9fff] mb-2 group-hover:scale-110 transition-transform">
                                        <Star size={16} fill="currentColor" />
                                    </div>
                                    <div className="flex items-baseline gap-0.5">
                                        <span className="text-2xl font-bold text-white tracking-tight">
                                            {stats?.avgRating > 0 ? stats.avgRating : '—'}
                                        </span>
                                        {stats?.avgRating > 0 && <span className="text-[10px] text-[#7a7a90] font-medium">/10</span>}
                                    </div>
                                    <div className="text-[10px] text-[#7a7a90] uppercase tracking-[0.1em] font-bold mt-1">Avg</div>
                                </div>

                                {/* My Rating */}
                                <div className={`bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a25]/80 hover:border-[#c8ff57]/30 transition-all duration-300 shadow-lg ${(!user || !(myEntry?.rating > 0)) ? 'opacity-30 grayscale' : ''}`}>
                                    <div className={`w-8 h-8 rounded-full bg-[#c8ff57]/10 flex items-center justify-center text-[#c8ff57] mb-2 group-hover:scale-110 transition-transform`}>
                                        <Star size={16} fill="currentColor" />
                                    </div>
                                    <div className="flex items-baseline gap-0.5">
                                        <span className={`text-2xl font-bold tracking-tight ${myEntry?.rating > 0 ? 'text-[#c8ff57]' : 'text-white/40'}`}>
                                            {myEntry?.rating > 0 ? myEntry.rating : '—'}
                                        </span>
                                        {myEntry?.rating > 0 && <span className="text-[10px] text-[#7a7a90] font-medium">/10</span>}
                                    </div>
                                    <div className="text-[10px] text-[#7a7a90] uppercase tracking-[0.1em] font-bold mt-1">My Rating</div>
                                </div>

                                {/* Logged */}
                                <div className="bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a25]/80 hover:border-[#ff9f5c]/30 transition-all duration-300 shadow-lg">
                                    <div className="w-8 h-8 rounded-full bg-[#ff9f5c]/10 flex items-center justify-center text-[#ff9f5c] mb-2 group-hover:scale-110 transition-transform">
                                        <ShoppingBag size={16} />
                                    </div>
                                    <span className="text-2xl font-bold text-white tracking-tight">{stats?.loggedCount ?? '0'}</span>
                                    <div className="text-[10px] text-[#7a7a90] uppercase tracking-[0.1em] font-bold mt-1">Pond</div>
                                </div>

                                {/* Likes */}
                                <div className="bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a25]/80 hover:border-[#ff5c5c]/30 transition-all duration-300 shadow-lg">
                                    <div className="w-8 h-8 rounded-full bg-[#ff5c5c]/10 flex items-center justify-center text-[#ff5c5c] mb-2 group-hover:scale-110 transition-transform">
                                        <Heart size={16} fill="currentColor" />
                                    </div>
                                    <span className="text-2xl font-bold text-white tracking-tight">{stats?.likeCount ?? '0'}</span>
                                    <div className="text-[10px] text-[#7a7a90] uppercase tracking-[0.1em] font-bold mt-1">Likes</div>
                                </div>

                                {/* Watchlisted */}
                                <div className="bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a25]/80 hover:border-[#5c9fff]/30 transition-all duration-300 shadow-lg">
                                    <div className="w-8 h-8 rounded-full bg-[#5c9fff]/10 flex items-center justify-center text-[#5c9fff] mb-2 group-hover:scale-110 transition-transform">
                                        <Target size={16} />
                                    </div>
                                    <span className="text-2xl font-bold text-white tracking-tight">{stats?.wishlistCount ?? '0'}</span>
                                    <div className="text-[10px] text-[#7a7a90] uppercase tracking-[0.1em] font-bold mt-1">Watchlisted</div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {user ? (
                                    <button 
                                        onClick={() => setShowAddModal(true)} 
                                        className={`btn-apple px-5 py-2.5 flex items-center gap-2 border ${myEntry ? (statusConfig[currentStatusKey]?.bg || 'bg-[#c8ff57]/10') : 'bg-[#c8ff57] text-black shadow-lg'} ${myEntry ? (statusConfig[currentStatusKey]?.color || 'text-[#c8ff57]') : ''} border-current hover:brightness-110 transition-all font-bold text-sm`}
                                    >
                                        {myEntry ? `${statusConfig[currentStatusKey]?.label} · Update` : <><Plus size={16} /> Add to Pond</>}
                                    </button>
                                ) : (
                                    <Link to="/login" state={{ from: location }}>
                                        <button className="btn-apple btn-apple-primary px-5 py-2.5">
                                            Join QuestDuck
                                        </button>
                                    </Link>
                                )}

                                {user && (
                                    <button onClick={handleLike} disabled={liking} className={`btn-apple px-4 py-2.5 flex items-center gap-1.5 border backdrop-blur-md ${liked ? 'border-[#ff5c5c] text-[#ff5c5c] bg-[#ff5c5c]/10' : 'border-white/10 text-[#c8c8d8] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'} transition-all`}>
                                        <Heart size={16} className={liked ? 'fill-current' : ''} /> {liked ? 'Liked' : 'Like'}
                                    </button>
                                )}

                                {user && (
                                    <button onClick={handleWishlist} disabled={wishing} className={`btn-apple px-4 py-2.5 flex items-center gap-1.5 border backdrop-blur-md ${wishlisted ? 'border-[#5c9fff] text-[#5c9fff] bg-[#5c9fff]/10' : 'border-white/10 text-[#c8c8d8] hover:border-[#5c9fff] hover:text-[#5c9fff]'} transition-all`}>
                                        {wishlisted ? <Check size={16} /> : <Plus size={16} />} {wishlisted ? 'Wishlisted' : 'Wishlist'}
                                    </button>
                                )}
                                <button onClick={handleShare} className={`btn-apple px-4 py-2.5 flex items-center gap-1.5 border transition-all ${shareCopied ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/10' : 'border-white/10 text-[#c8c8d8] hover:border-[#c8ff57] hover:text-[#c8ff57]'}`}>
                                    {shareCopied ? <Check size={16} /> : <Share size={16} />} {shareCopied ? 'Copied!' : 'Share'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="border-b border-[#2a2a35] bg-[#0a0a0f] sticky top-[80px] z-40">
                <div className="max-w-[1200px] mx-auto px-5 md:px-10">
                    <div className="flex gap-6">
                        {['overview', 'comments', 'cast'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} 
                                className={`font-mono text-xs uppercase tracking-widest py-4 border-b-2 transition-all 
                                           ${activeTab === tab ? 'border-[#c8ff57] text-[#c8ff57]' : 'border-transparent text-[#7a7a90] hover:text-white'}`}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)} {tab === 'comments' && allComments.length > 0 && <span className="opacity-60 ml-1.5 font-mono text-[10px]">({allComments.length})</span>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
                    <div className="flex flex-col gap-6">
                        {activeTab === 'overview' && (
                            <>
                                {summaryText && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6 shadow-sm">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">About</div>
                                        <p className="text-[#c8c8d8] text-sm leading-relaxed">{displayText}</p>
                                        {isLong && <button onClick={() => setExpanded(!expanded)} className="mt-3 font-mono text-xs text-[#c8ff57] hover:underline transition-all">{expanded ? 'Show less ↑' : 'Read more ↓'}</button>}
                                    </div>
                                )}

                                {/* Relations & Timeline (Visual List) */}
                                {(() => {
                                    const relations = anime.relations || [];
                                    
                                    const prequelItems = relations.find(r => r.relation?.toUpperCase() === 'PREQUEL')?.items || [];
                                    const sequelItems = relations.find(r => r.relation?.toUpperCase() === 'SEQUEL')?.items || [];
                                    
                                    // Logic: Prefer main Manga over one-shots/specials
                                    const prequel = prequelItems.find(i => i.type?.toLowerCase() === 'manga') || prequelItems[0];
                                    const sequel = sequelItems.find(i => i.type?.toLowerCase() === 'manga') || sequelItems[0];
                                    const source = relations.find(r => r.relation?.toUpperCase() === 'SOURCE')?.items?.[0];

                                    if (!prequel && !sequel && !source) return null;

                                    return (
                                        <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6 shadow-sm">
                                            <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">Timeline & Relations</div>
                                            <div className="flex flex-col gap-3">
                                                {source && (
                                                    <RelationItem item={source} label="Original Source" colorClass="[#c8ff57]" icon="📖" />
                                                )}
                                                {prequel && (
                                                    <RelationItem item={prequel} label="Story Prequel" colorClass="[#5c9fff]" icon="⏪" />
                                                )}
                                                {sequel && (
                                                    <RelationItem item={sequel} label="Story Sequel" colorClass="[#c8ff57]" icon="⏩" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                                {anime.screenshots?.length > 0 && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">
                                            Screenshots <span className="ml-2 text-[#2a2a35] normal-case font-normal">· click to enlarge</span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {anime.screenshots.slice(0, 6).map((url, i) => (
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
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'cast' && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-6">Characters & Voice Actors</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {anime.cast?.map((char, i) => (
                                        <div key={i} className="flex flex-col gap-3 p-4 rounded-xl bg-black/20 border border-white/5 hover:border-[#c8ff57]/30 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <img src={char.image} alt={char.name} className="w-16 h-16 rounded-xl object-cover ring-1 ring-white/10 group-hover:ring-[#c8ff57]/50 transition-all shadow-lg" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-white font-bold text-sm truncate">{char.name}</div>
                                                    <div className="font-mono text-[9px] text-[#7a7a90] uppercase tracking-widest mb-1.5">{char.role}</div>
                                                </div>
                                            </div>
                                            {char.va && (
                                                <div className="mt-1 pt-3 border-t border-white/5 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <img src={char.va.image} alt={char.va.name} className="w-6 h-6 rounded-lg object-cover grayscale opacity-60 group-hover:opacity-100 group-hover:grayscale-0 transition-all" />
                                                        <div className="flex flex-col">
                                                            <div className="text-[10px] text-[#a0a0b8] font-medium leading-none mb-0.5">{char.va.name}</div>
                                                            <div className="text-[8px] text-[#5c5c6c] uppercase tracking-tighter">Voice Actor</div>
                                                        </div>
                                                    </div>
                                                    <div className="font-mono text-[8px] text-[#3a3a4a] bg-white/5 px-1.5 py-0.5 rounded">JPN</div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {(!anime.cast || anime.cast.length === 0) && (
                                        <div className="col-span-full py-10 text-center font-mono text-xs text-[#3a3a4a]">No character information available</div>
                                    )}
                                </div>

                                {anime.staff?.length > 0 && (
                                    <>
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mt-12 mb-6">Production Staff</div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {anime.staff.map((s, i) => (
                                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-black/10 border border-white/5 hover:border-[#5c9fff]/30 transition-all group">
                                                    {s.image ? (
                                                        <img src={s.image} alt={s.name} className="w-10 h-10 rounded-lg object-cover ring-1 ring-white/10 group-hover:ring-[#5c9fff]/50 transition-all" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-[#18181f] flex items-center justify-center text-[10px] text-[#3a3a4a] font-black border border-white/5">?</div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-white font-bold text-[13px] truncate">{s.name}</div>
                                                        <div className="font-mono text-[8px] text-[#7a7a90] uppercase tracking-tighter truncate">{s.positions?.join(', ')}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'comments' && (
                            <div className="flex flex-col gap-4">
                                {user ? (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-3">Leave a Comment</div>
                                        <div className="flex gap-3 items-start">
                                            <AvatarFrame userId={user.id || user._id} src={user.avatar} size={32} className="flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <textarea 
                                                    value={commentText} 
                                                    onChange={e => setCommentText(e.target.value)}
                                                    placeholder="Share your thoughts..."
                                                    rows={3}
                                                    maxLength={1000}
                                                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePostComment() }}
                                                    className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2.5
                                                               text-sm text-white resize-none focus:outline-none focus:border-[#c8ff57]
                                                               placeholder:text-[#7a7a90] transition-colors" 
                                                />
                                                <div className="flex items-center justify-between mt-2">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono text-[9px] text-[#505060]">{commentText.length}/1000</span>
                                                        <span className="font-mono text-[9px] text-[#7a7a90]">Ctrl+Enter to post</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setShowGifPicker(!showGifPicker) }}
                                                                className={`p-1.5 border rounded hover:bg-white/5 transition-all flex items-center justify-center ${showGifPicker ? 'border-[#c8ff57] text-[#c8ff57]' : 'border-[#2a2a35] text-[#7a7a90]'}`}
                                                                title="Add GIF"
                                                            >
                                                                <GifIcon size={16} />
                                                            </button>
                                                            {showGifPicker && (
                                                                <GifPicker 
                                                                    onSelect={(url) => { setCommentText(prev => prev + (prev ? ' ' : '') + url); setShowGifPicker(false) }} 
                                                                    onClose={() => setShowGifPicker(false)} 
                                                                />
                                                            )}
                                                        </div>
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
                                <div className="flex flex-col gap-3">
                                    {allComments.map(c => (
                                        <CommentItem key={c._id} comment={c} currentUser={user} externalId={id} type={type} onRefresh={() => refetchComments(true)} onXpToast={showXpToast} setAllComments={setAllComments} title={anime.title} />
                                    ))}

                                    {commentsData?.pagination?.hasMore && (
                                        <button 
                                            onClick={() => setCommentPage(p => p + 1)}
                                            className="w-full py-4 mt-2 border border-[#2a2a35] text-[#7a7a90] font-mono text-xs uppercase tracking-widest rounded-lg hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all bg-[#111118]/50"
                                        >
                                            Load More Comments ↓
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SIDEBAR */}
                    <div className="flex flex-col gap-6">
                        {user && myEntry && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5 shadow-sm">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">My Log</div>
                                <div className="flex flex-col divide-y divide-[#2a2a35]">
                                    <div className="flex justify-between py-2.5">
                                        <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">Status</span>
                                        <span className={`font-mono text-[10px] uppercase tracking-wider font-bold ${statusConfig[currentStatusKey]?.color}`}>
                                            {statusConfig[currentStatusKey]?.label?.replace(/^[^\s]+\s/, '') || myEntry.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2.5">
                                        <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">{type === 'manga' ? 'Chapters' : 'Episodes'}</span>
                                        <span className="font-mono text-[10px] text-white font-bold">{type === 'manga' ? myEntry.chaptersRead : myEntry.episodesWatched}</span>
                                    </div>
                                    {myEntry.rating > 0 && (
                                        <div className="flex justify-between py-2.5">
                                            <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">My Rating</span>
                                            <span className="font-mono text-[10px] text-[#c8ff57] font-bold">{myEntry.rating}/10</span>
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

                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5 shadow-sm">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">{type === 'manga' ? 'MANGA' : 'ANIME'} INFO</div>
                                <div className="flex flex-col divide-y divide-[#2a2a35]">
                                    <div className="flex justify-between py-2.5 gap-4"><span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">Type</span><span className="font-mono text-[11px] text-white uppercase font-bold text-right">{type}</span></div>
                                <div className="flex justify-between py-2.5 gap-4"><span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">Mangaka</span><span className="font-mono text-[11px] text-white font-bold text-right">{anime.studios || 'TBA'}</span></div>
                                <div className="flex justify-between py-2.5 gap-4"><span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">Year</span><span className="font-mono text-[11px] text-white font-bold text-right">{anime.year || 'TBA'}</span></div>
                                <div className="flex justify-between py-2.5 gap-4"><span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">Source</span><span className="font-mono text-[11px] text-white font-bold text-right uppercase">{anime.source || '—'}</span></div>
                                <div className="flex justify-between py-2.5 gap-4"><span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">Rating</span><span className="font-mono text-[11px] text-white font-bold text-right">{anime.rating || '—'}</span></div>
                                <div className="flex justify-between py-2.5 gap-4"><span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">Status</span><span className="font-mono text-[11px] text-white font-bold text-right">{anime.status || 'TBA'}</span></div>
                            </div>
                        </div>

                        {anime.genres?.length > 0 && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5 shadow-sm">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">Genres</div>
                                <div className="flex flex-wrap gap-2">
                                    {[...new Set((anime.genres || []).map(g => String(g)))].map(g => <span key={g} className="font-mono text-[10px] uppercase px-3 py-1 bg-[#2a2a35] text-[#7a7a90] rounded-full hover:bg-[#c8ff57]/10 hover:text-[#c8ff57] transition-all cursor-default">{g}</span>)}
                                </div>
                            </div>
                        )}

                        {anime.similar?.length > 0 && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5 shadow-sm">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">Similar {type === 'manga' ? 'Manga' : 'Anime'}</div>
                                <div className="flex flex-col gap-3">
                                    {anime.similar.map(sg => (
                                        <Link key={sg.id} to={`/manga/${sg.id}`}
                                            className="flex items-center gap-3 hover:opacity-80 transition-opacity group">
                                            <img src={sg.cover || sg.coverImage} alt={sg.title} className="w-10 h-14 object-cover rounded flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white text-xs font-semibold truncate group-hover:text-[#c8ff57] transition-colors">{sg.title}</div>
                                                <div className="font-mono text-[9px] text-[#7a7a90] mt-1 uppercase">View Details</div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {showAddModal && (
                <AddAnimeModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={async (formData) => {
                        try {
                            const res = await api.post('/anime/log', formData)
                            if (res.data.xp) {
                                updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
                            }
                            setShowAddModal(false)
                            refetchContext(true)
                            const libRes = await api.get('/anime/library')
                            setUserLibrary(libRes.data.library || [])
                            return { success: true }
                        } catch (err) {
                            console.error('Log error:', err)
                            return { success: false }
                        }
                    }}
                    preselectedAnime={anime}
                    existingEntry={myEntry}
                />
            )}

            {/* LIGHTBOX */}
            {lightboxIndex >= 0 && (
                <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-10"
                    onClick={() => setLightboxIndex(-1)}>
                    <img src={anime.screenshots[lightboxIndex]} alt="Screenshot Full" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-200" />
                    <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors text-2xl font-mono">✕</button>
                    
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/40 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
                        <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev - 1 + anime.screenshots.length) % anime.screenshots.length) }} className="text-white/50 hover:text-[#c8ff57] transition-colors text-xl font-mono">←</button>
                        <span className="font-mono text-xs text-white/50">{lightboxIndex + 1} / {anime.screenshots.length}</span>
                        <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev + 1) % anime.screenshots.length) }} className="text-white/50 hover:text-[#c8ff57] transition-colors text-xl font-mono">→</button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default MangaDetail
