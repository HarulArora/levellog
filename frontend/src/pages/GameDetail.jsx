import { useState, useEffect, useCallback, memo, useRef } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useGamesContext } from '../context/GamesContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { ThumbsUp, ThumbsDown, MessageSquare, Plus, Check, ListChecks, Heart, Share, Play, Star, Users, Target, Gamepad2 } from 'lucide-react'
import AddGameModal from '../components/library/AddGameModal'
import Skeleton from '../components/ui/Skeleton'
import Avatar from '../components/ui/Avatar'
import { getIGDBImage, SIZES } from '../utils/igdb'
import { useLeaderboard } from '../context/LeaderboardContext'
import AvatarFrame from '../components/ui/AvatarFrame'
import GifPicker from '../components/ui/GifPicker'
import { invalidateCache } from '../utils/cache'

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

const CommentItem = memo(({ comment, currentUser, igdbId, onRefresh, onXpToast, setAllComments, depth = 0, gameTitle = '' }) => {
    const navigate = useNavigate()
    const { topUsers } = useLeaderboard()
    
    // Find rank dynamically
    const userRankInfo = topUsers.find(u => u._id === comment.userId?._id || u._id === comment.userId?.id)
    const rank = userRankInfo?.rank

    const currentUserRankInfo = topUsers.find(u => u._id === currentUser?.id || u._id === currentUser?._id)
    const currentUserRank = currentUserRankInfo?.rank

    const [showReplyBox, setShowReplyBox] = useState(false)
    const [showGifPicker, setShowGifPicker] = useState(false)
    const [replyText, setReplyText] = useState('')
    const [submittingReply, setSubmittingReply] = useState(false)
    const [editingText, setEditingText] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [submittingEdit, setSubmittingEdit] = useState(false)
    const [isEdited, setIsEdited] = useState(comment.edited || false)
    const [repliesVisible, setRepliesVisible] = useState(true)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showBurst, setShowBurst] = useState(false)

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
        if (!currentUser || comment._id.toString().startsWith('temp_')) return
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
    }, [comment._id, currentUser, comment.likes, comment.dislikes])

    const isOwn = currentUser && (
        comment.userId?._id === currentUser.id ||
        comment.userId?._id === currentUser._id
    )

    const indentClass = depth > 0 ? 'ml-4 md:ml-8 mt-2' : ''
    const replyCount = comment.replies?.length || 0

    const handleLike = async () => {
        if (!currentUser) { navigate('/login'); return }
        hasInteracted.current = true

        const prevLiked = liked
        const prevDisliked = disliked
        const prevLikes = likes
        const prevDislikes = dislikes

        // Truly instant optimistic update
        setLiked(prev => {
            const nowLiked = !prev
            setLikes(l => nowLiked ? l + 1 : l - 1)
            if (nowLiked && prevDisliked) {
                setDisliked(false)
                setDislikes(d => d - 1)
            }
            if (nowLiked) {
                setShowBurst(true)
                setTimeout(() => setShowBurst(false), 800)
            }
            return nowLiked
        })

        try {
            const res = await api.post(`/comments/${comment._id}/like`)
            setLikes(res.data.likes)
            setDislikes(res.data.dislikes)
            setLiked(res.data.liked)
            setDisliked(res.data.disliked)
        } catch (err) {
            setLiked(prevLiked); setDisliked(prevDisliked)
            setLikes(prevLikes); setDislikes(prevDislikes)
            console.error('Like error:', err)
        }
    }

    const handleDislike = async () => {
        if (!currentUser) { navigate('/login'); return }
        hasInteracted.current = true

        const prevLiked = liked
        const prevDisliked = disliked
        const prevLikes = likes
        const prevDislikes = dislikes

        setDisliked(prev => {
            const nowDisliked = !prev
            setDislikes(d => nowDisliked ? d + 1 : d - 1)
            if (nowDisliked && prevLiked) {
                setLiked(false)
                setLikes(l => l - 1)
            }
            return nowDisliked
        })

        try {
            const res = await api.post(`/comments/${comment._id}/dislike`)
            setLikes(res.data.likes)
            setDislikes(res.data.dislikes)
            setLiked(res.data.liked)
            setDisliked(res.data.disliked)
        } catch (err) {
            setLiked(prevLiked); setDisliked(prevDisliked)
            setLikes(prevLikes); setDislikes(prevDislikes)
            console.error('Dislike error:', err)
        }
    }

    const handleDelete = async () => {
        try {
            const res = await api.delete(`/comments/${comment._id}`)
            onXpToast(res.data.message || '🗑 Comment deleted · -1 XP', 'loss')
            onRefresh(true)
        } catch (err) { console.error('Delete error:', err) }
        finally { setShowDeleteConfirm(false) }
    }

    const handleEdit = async () => {
        if (!editingText.trim()) return
        setSubmittingEdit(true)
        try {
            await api.put(`/comments/${comment._id}`, { text: editingText })
            setIsEditing(false); setIsEdited(true)
            onRefresh(true)
        } catch (err) { console.error('Edit error:', err) }
        finally { setSubmittingEdit(false) }
    }

    const handleReply = async () => {
        if (!replyText.trim() || submittingReply) return
        
        const text = replyText.trim()
        const tempId = 'temp-' + Date.now()
        const tempReply = {
            _id: tempId,
            text,
            userId: currentUser,
            createdAt: new Date().toISOString(),
            likes: [],
            dislikes: [],
            likeCount: 0,
            dislikeCount: 0,
            replies: [],
            isOptimistic: true
        }

        // Optimistic update for replies
        setAllComments(prev => {
            const updateReplies = (comments) => {
                return comments.map(c => {
                    if (c._id === comment._id) {
                        return { ...c, replies: [...(c.replies || []), tempReply] }
                    }
                    if (c.replies && c.replies.length > 0) {
                        return { ...c, replies: updateReplies(c.replies) }
                    }
                    return c
                })
            }
            return updateReplies(prev)
        })

        setReplyText('')
        setShowReplyBox(false)
        setRepliesVisible(true)
        setSubmittingReply(true)
        
        try {
            const topParentId = comment.parentId || comment._id
            const res = await api.post(`/comments/${igdbId}`, {
                text, parentId: topParentId, replyToId: comment._id,
                replyToUserId: comment.userId?._id, gameTitle,
            })
            
            // Replace temp reply with real one
            setAllComments(prev => {
                const replaceReply = (comments) => {
                    return comments.map(c => {
                        if (c.replies && c.replies.length > 0) {
                            return { ...c, replies: c.replies.map(r => r._id === tempId ? res.data.comment : r) }
                        }
                        return c
                    })
                }
                const updated = replaceReply(prev)
                // If it wasn't found in immediate children, try deeper
                return updated
            })
            
            onXpToast(res.data.message || '💬 Reply posted · +1 XP', 'gain')
            onRefresh(true) 
        } catch (err) { 
            console.error('Reply error:', err)
            // Revert optimistic update
            setAllComments(prev => {
                const removeReply = (comments) => {
                    return comments.map(c => {
                        if (c.replies && c.replies.length > 0) {
                            return { ...c, replies: c.replies.filter(r => r._id !== tempId) }
                        }
                        return c
                    })
                }
                return removeReply(prev)
            })
            setReplyText(text)
            setShowReplyBox(true)
            onXpToast('Failed to post reply', 'loss')
        }
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
        
        // Match mentions (@username) and URLs (http/https)
        const parts = text.split(/(@\w+)|(https?:\/\/[^\s]+)/g)
        
        return parts.map((part, i) => {
            if (!part) return null
            
            if (part.startsWith('@')) {
                return <Link key={i} to={`/user/${part.slice(1)}`} className="text-[#c8ff57] font-semibold hover:underline">{part}</Link>
            }
            
            if (part.startsWith('http')) {
                // Check if it's an image/gif
                const isImage = /\.(jpg|jpeg|png|webp|gif)$|giphy\.com\/media/i.test(part)
                if (isImage) {
                    // Optimize Giphy URLs to use downsized versions for performance
                    let optimizedPart = part
                    if (part.includes('giphy.com')) {
                        optimizedPart = part.replace(/\/giphy\.gif$/, '/giphy-downsized.gif')
                            .replace(/\/200\.gif$/, '/200w.gif')
                    }

                    return (
                        <div key={i} className="mt-2 mb-1 max-w-full">
                            <img 
                                src={optimizedPart} 
                                alt="GIF" 
                                loading="lazy"
                                className="rounded-lg max-h-64 object-contain border border-[#2a2a35] hover:border-[#c8ff57]/50 transition-all bg-[#0a0a0f]" 
                            />
                        </div>
                    )
                }
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
                    
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                        <Link to={profilePath || '#'} className={`flex-shrink-0 ${!profilePath && 'pointer-events-none'}`}>
                            <AvatarFrame userId={comment.userId?._id || comment.userId?.id} src={comment.userId?.avatar} size={28} className="comment-avatar" />
                        </Link>
                        <Link to={profilePath || '#'} className={`font-bold text-xs hover:underline 
                            ${rank === 1 ? 'text-yellow-400' : 
                              rank === 2 ? 'text-[#B9F2FF]' : 
                              rank === 3 ? 'text-[#cd7f32]' : 
                              rank === 4 ? 'text-[#94999c]' : 
                              isOwn ? 'text-[#c8ff57]' : 'text-white'} 
                            ${!profilePath && 'pointer-events-none'}`}
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

                    {/* Body */}
                    {isEditing ? (
                        <div className="mt-2">
                            <textarea 
                                value={editingText} 
                                onChange={e => setEditingText(e.target.value)} 
                                rows={2}
                                maxLength={1000}
                                className="w-full bg-[#18181f] border border-[#c8ff57]/30 rounded px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-[#c8ff57] transition-colors" 
                            />
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-[10px] text-[#505060] font-mono">{editingText.length}/1000</span>
                                <div className="flex gap-2">
                                    <button onClick={handleEdit} disabled={submittingEdit || !editingText.trim()} className="px-3 py-1 bg-[#c8ff57] text-black font-bold text-[10px] rounded hover:bg-[#d4ff6e] transition-all disabled:opacity-50">Save</button>
                                    <button onClick={() => setIsEditing(false)} className="px-3 py-1 border border-[#2a2a35] text-[#7a7a90] font-mono text-[10px] rounded hover:border-white hover:text-white transition-all">Cancel</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[#c8c8d8] text-sm leading-relaxed break-words whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{renderText(comment.text)}</div>
                    )}

                    {/* Actions */}
                    {!isEditing && (
                        <div className="flex items-center gap-2 mt-3">
                            <div className="flex bg-[#18181f] rounded-xl border border-[#2a2a35] p-0.5 shadow-sm relative">
                                {showBurst && (
                                    <div className="rank-like-burst">
                                        {currentUserRank === 1 ? '👑' : currentUserRank === 2 ? '🪽' : currentUserRank === 3 ? '🎖️' : currentUserRank === 4 ? '⚔️' : '🍿'}
                                    </div>
                                )}
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
                            <div className="flex-1 flex flex-col gap-1">
                                <textarea 
                                    value={replyText} 
                                    onChange={e => setReplyText(e.target.value)} 
                                    placeholder={`Reply to @${comment.userId?.username}...`} 
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

                {/* Replies — collapsible */}
                {replyCount > 0 && (
                    <div className={`overflow-hidden transition-all duration-300 ${repliesVisible ? 'opacity-100 max-h-[9999px]' : 'opacity-0 max-h-0'}`}>
                        <div className="mt-2 flex flex-col gap-2">
                            {comment.replies.map(reply => (
                                <CommentItem key={reply._id} comment={reply} currentUser={currentUser} igdbId={igdbId} onRefresh={onRefresh} onXpToast={onXpToast} setAllComments={setAllComments} depth={Math.min(depth + 1, 2)} gameTitle={gameTitle} />
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
    const { user, updateUser } = useAuth()
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
    const [showGifPicker, setShowGifPicker] = useState(false)
    const [submittingComment, setSubmittingComment] = useState(false)
    const [xpToast, setXpToast] = useState(null)
    const [lightboxIndex, setLightboxIndex] = useState(null)
    const [shareCopied, setShareCopied] = useState(false)
    const [commentPage, setCommentPage] = useState(1)
    const [allComments, setAllComments] = useState([])
    const [hasMoreComments, setHasMoreComments] = useState(false)
    const [loadingMoreComments, setLoadingMoreComments] = useState(false)
    const location = useLocation()

    // ── Deep Linking for Tabs ──
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const tab = params.get('tab')
        if (tab === 'comments' || tab === 'overview') {
            setActiveTab(tab)
        }
    }, [location.search])

    // ── CACHED CONTEXT FETCH (Optimized) ──
    // Combines: Game Info + Global Stats + User Like/Wishlist status in ONE request
    const { data: contextData, loading: loadingContext, error: contextError, refetch: refetchContext, setData: setContextData } = useCachedFetch(
        `game_context_${user?.id || user?._id || 'anon'}_${igdbId}`,
        `/games/context/${igdbId}`,
        { deps: [igdbId, user?.id || user?._id], ttl: 5 * 60 * 1000 }
    )

    useEffect(() => {
        if (contextData?.userStatus) {
            setLiked(contextData.userStatus.liked)
            setWishlisted(contextData.userStatus.wishlisted)
        }
    }, [contextData])

    const { data: commentsData, loading: loadingComments, refetch: refetchComments } = useCachedFetch(
        `game_comments_${igdbId}_${commentPage}`,
        `/comments/${igdbId}?page=${commentPage}&limit=10`,
        { ttl: 1 * 60 * 1000, deps: [igdbId, commentPage] } 
    )

    useEffect(() => {
        if (commentsData?.comments) {
            if (commentPage === 1) {
                setAllComments(commentsData.comments)
            } else {
                setAllComments(prev => {
                    // Avoid duplicates
                    const existingIds = new Set(prev.map(c => c._id))
                    const newComments = commentsData.comments.filter(c => !existingIds.has(c._id))
                    return [...prev, ...newComments]
                })
            }
            setHasMoreComments(commentsData.pagination?.hasMore || false)
            setLoadingMoreComments(false)
        }
    }, [commentsData, commentPage])

    const game = contextData?.game
    const stats = contextData?.stats
    const loading = loadingContext && !game
    const error = contextError
    const comments = allComments

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

    const myGame = userGames.find(g => {
        const pageId = Number(igdbId)
        const entryId = Number(g.igdbId)
        if (pageId && entryId) return pageId === entryId
        if (pageId || entryId) return false
        return g.title?.toLowerCase() === game?.title?.toLowerCase()
    })

    const fetchPlatformStats = refetchContext
    // const fetchComments = refetchComments

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
        const oldData = contextData
        setLiked(!wasLiked)
        setLiking(true)

        // Optimistically update counts and status
        if (oldData) {
            setContextData({
                ...oldData,
                stats: oldData.stats ? {
                    ...oldData.stats,
                    likeCount: Math.max(0, (oldData.stats.likeCount || 0) + (wasLiked ? -1 : 1))
                } : oldData.stats,
                userStatus: {
                    ...(oldData.userStatus || {}),
                    liked: !wasLiked
                }
            })
        }
        
        try {
            const res = await api.post('/lists/like', {
                igdbId: parseInt(igdbId), gameTitle: game.title, gameCover: game.cover, genre: game.genre
            })
            setLiked(res.data.liked)
            if (res.data.liked) {
                showXpToast('❤️ Liked! +1 XP', 'gain')
                if (res.data.xp) updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
            }
            else showXpToast('💔 Unliked · -1 XP', 'loss')
            
            // Silent refetch to sync stats (counts etc) in background
            await refetchContext(true) 
        } catch (err) {
            console.error('Like error:', err)
            setLiked(wasLiked) // Revert on failure
            if (oldData) setContextData(oldData)
        } finally { setLiking(false) }
    }

    const handleWishlist = async () => {
        if (!user) { navigate('/login'); return }
        if (wishing) return
 
        // Optimistic Update
        const wasWishlisted = wishlisted
        const oldData = contextData
        setWishlisted(!wasWishlisted)
        setWishing(true)

        // Optimistically update counts and status
        if (oldData) {
            setContextData({
                ...oldData,
                stats: oldData.stats ? {
                    ...oldData.stats,
                    wishlistCount: Math.max(0, (oldData.stats.wishlistCount || 0) + (wasWishlisted ? -1 : 1))
                } : oldData.stats,
                userStatus: {
                    ...(oldData.userStatus || {}),
                    wishlisted: !wasWishlisted
                }
            })
        }

        try {
            const res = await api.post('/lists/wishlist', {
                igdbId: parseInt(igdbId), gameTitle: game.title,
                gameCover: game.cover, genre: game.genre, releaseYear: game.releaseYear || ''
            })
            setWishlisted(res.data.wishlisted)
            if (res.data.wishlisted) showXpToast('🎯 Wishlisted!', 'gain')
            
            await refetchContext(true)
        } catch (err) {
            console.error('Wishlist error:', err)
            setWishlisted(wasWishlisted) // Revert on failure
            if (oldData) setContextData(oldData)
        } finally { setWishing(false) }
    }

    const handleOpenListModal = async () => {
        setShowListModal(true)
        setLoadingLists(true)
        try {
            const res = await api.get('/lists/me')
            setCustomLists(res.data.customLists || [])
        } catch (err) {
            console.error('Error fetching context:', err)
        } finally { setLoadingLists(false) }
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
        } catch (err) { 
            console.error('Add to list error:', err)
            showListToast('Failed to add to list', 'error') 
        }
    }

    const handlePostComment = async () => {
        if (!commentText.trim() || submittingComment) return
        const text = commentText.trim()
        
        // Optimistic Update
        const tempId = 'temp-' + Date.now()
        const tempComment = {
            _id: tempId,
            text,
            userId: user,
            createdAt: new Date().toISOString(),
            likes: [],
            dislikes: [],
            likeCount: 0,
            dislikeCount: 0,
            replies: [],
            isOptimistic: true // To show a "posting" style if needed
        }
        
        setAllComments(prev => [tempComment, ...prev])
        setCommentText('')
        setSubmittingComment(true)

        try {
            const res = await api.post(`/comments/${igdbId}`, {
                text,
                gameTitle: game?.title,
            })
            
            // Replace temp comment with real one
            setAllComments(prev => prev.map(c => c._id === tempId ? res.data.comment : c))
            showXpToast(res.data.message || '💬 Comment posted · +1 XP', 'gain')
            
            // Still sync with server to ensure everything is correct
            await refetchComments(true)
        } catch (err) { 
            console.error('Comment error:', err)
            // Revert optimistic update
            setAllComments(prev => prev.filter(c => c._id !== tempId))
            setCommentText(text)
            showXpToast('Failed to post comment', 'loss')
        }
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
                <title>{game.title || game.name} | QuestDuck</title>
                <meta name="description" content={game.summary?.slice(0, 160) || `View community stats and reviews for ${game.title} on QuestDuck.`} />
                <meta property="og:title" content={`${game.title} - QuestDuck Community`} />
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

                            {/* Apple-style Stats Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-10">
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
                                    <div className="text-[10px] text-[#7a7a90] uppercase tracking-[0.1em] font-bold mt-1">Avg Rating</div>
                                </div>

                                {/* My Rating */}
                                {user && myGame?.rating > 0 && (
                                    <div className="bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a25]/80 hover:border-[#c8ff57]/30 transition-all duration-300 shadow-lg">
                                        <div className="w-8 h-8 rounded-full bg-[#c8ff57]/10 flex items-center justify-center text-[#c8ff57] mb-2 group-hover:scale-110 transition-transform">
                                            <Star size={16} fill="currentColor" />
                                        </div>
                                        <div className="flex items-baseline gap-0.5">
                                            <span className="text-2xl font-bold text-[#c8ff57] tracking-tight">{myGame.rating}</span>
                                            <span className="text-[10px] text-[#7a7a90] font-medium">/10</span>
                                        </div>
                                        <div className="text-[10px] text-[#7a7a90] uppercase tracking-[0.1em] font-bold mt-1">My Rating</div>
                                    </div>
                                )}

                                {/* In Pond */}
                                <div className="bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a25]/80 hover:border-[#ff9f5c]/30 transition-all duration-300 shadow-lg">
                                    <div className="w-8 h-8 rounded-full bg-[#ff9f5c]/10 flex items-center justify-center text-[#ff9f5c] mb-2 group-hover:scale-110 transition-transform">
                                        <Gamepad2 size={16} />
                                    </div>
                                    <span className="text-2xl font-bold text-white tracking-tight">{stats?.loggedCount ?? '—'}</span>
                                    <div className="text-[10px] text-[#7a7a90] uppercase tracking-[0.1em] font-bold mt-1">In Pond</div>
                                </div>

                                {/* Likes */}
                                <div className="bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a25]/80 hover:border-[#ff5c5c]/30 transition-all duration-300 shadow-lg">
                                    <div className="w-8 h-8 rounded-full bg-[#ff5c5c]/10 flex items-center justify-center text-[#ff5c5c] mb-2 group-hover:scale-110 transition-transform">
                                        <Heart size={16} fill="currentColor" />
                                    </div>
                                    <span className="text-2xl font-bold text-white tracking-tight">{stats?.likeCount ?? '—'}</span>
                                    <div className="text-[10px] text-[#7a7a90] uppercase tracking-[0.1em] font-bold mt-1">Likes</div>
                                </div>

                                {/* Wishlists */}
                                <div className="bg-[#111118]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a25]/80 hover:border-[#5c9fff]/30 transition-all duration-300 shadow-lg">
                                    <div className="w-8 h-8 rounded-full bg-[#5c9fff]/10 flex items-center justify-center text-[#5c9fff] mb-2 group-hover:scale-110 transition-transform">
                                        <Target size={16} />
                                    </div>
                                    <span className="text-2xl font-bold text-white tracking-tight">{stats?.wishlistCount ?? '—'}</span>
                                    <div className="text-[10px] text-[#7a7a90] uppercase tracking-[0.1em] font-bold mt-1">Wishlists</div>
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
                                            {statusConfig[myGame.status]?.label || 'In Library'} · Update Data
                                        </button>
                                    ) : (
                                        <button onClick={() => setShowAddModal(true)} className="btn-apple btn-apple-primary px-5 py-2.5 gap-1.5">
                                            <Plus size={16} strokeWidth={3} /> Add to Pond
                                        </button>
                                    )
                                ) : (
                                    <Link to="/login">
                                        <button className="btn-apple btn-apple-primary px-5 py-2.5">
                                            Join QuestDuck
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

                                {comments.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {comments.map(comment => (
                                            <CommentItem key={comment._id} comment={comment}
                                                currentUser={user} igdbId={igdbId}
                                                onRefresh={refetchComments} onXpToast={showXpToast}
                                                setAllComments={setAllComments}
                                                depth={0}
                                                gameTitle={game?.title}
                                            />
                                        ))}

                                        {hasMoreComments && (
                                            <button 
                                                onClick={() => { setLoadingMoreComments(true); setCommentPage(p => p + 1) }}
                                                disabled={loadingMoreComments || loadingComments}
                                                className="w-full py-4 mt-2 border border-[#2a2a35] text-[#7a7a90] font-mono text-xs uppercase tracking-widest rounded-lg hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all bg-[#111118]/50 disabled:opacity-50"
                                            >
                                                {loadingMoreComments ? 'Loading more...' : 'Load More Comments ↓'}
                                            </button>
                                        )}
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
                                                <div className="flex items-center gap-1 font-black text-lg text-[#5c9fff] flex-shrink-0"
                                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>

                                                    <span>{similarStats[sg.id].avgRating}</span>
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
                            await fetchPlatformStats(true) // Silent reload to update counts
                            return { success: true }
                        } catch (err) { 
                            console.error('Log error:', err)
                            return { success: false } 
                        }
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
                            {user?.level < 2 ? (
                                <div className="flex flex-col items-center gap-4 py-8 text-center">
                                    <div className="w-14 h-14 bg-[#1a1a25] border border-[#3a3a4a] rounded-full flex items-center justify-center mb-2">
                                        <span className="text-2xl">🔒</span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="font-black text-white uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Feature Locked</div>
                                        <div className="font-mono text-[10px] text-[#7a7a90] max-w-[200px] leading-relaxed">Reach Level 2 to create and use custom collections.</div>
                                    </div>
                                    <button onClick={() => setShowListModal(false)}
                                        className="mt-2 px-6 py-2 border border-[#2a2a35] text-[#7a7a90] font-mono text-[10px] rounded hover:text-white hover:border-white transition-all">
                                        GOT IT
                                    </button>
                                </div>
                            ) : loadingLists ? (
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