import { useState, useEffect, useCallback, memo } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import useCachedFetch from '../../hooks/useCachedFetch'
import { ThumbsUp, ThumbsDown, MessageSquare, Plus, Check, ListChecks, Heart, Share, Play, Film, Tv, Flame, ChevronRight, CreditCard, ShoppingBag, Layers } from 'lucide-react'
import AddMovieModal from '../../components/library/AddMovieModal'
import Skeleton from '../../components/ui/Skeleton'
import Avatar from '../../components/ui/Avatar'
import { useLeaderboard } from '../../context/LeaderboardContext'
import AvatarFrame from '../../components/ui/AvatarFrame'
import GifPicker from '../../components/ui/GifPicker'

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

const getFlagEmoji = (countryCode) => {
    if (!countryCode) return '🌐';
    return countryCode.toUpperCase().replace(/./g, char => 
        String.fromCodePoint(char.charCodeAt(0) + 127397)
    );
}

const getProviderLink = (providerName, title, tmdbFallback) => {
    if (!providerName || !title) return tmdbFallback;
    const q = encodeURIComponent(title);
    const p = providerName.toLowerCase();
    
    if (p.includes('netflix')) return `https://www.netflix.com/search?q=${q}`;
    if (p.includes('amazon') || p.includes('prime')) return `https://www.amazon.com/s?k=${q}&i=instant-video`;
    if (p.includes('apple')) return `https://tv.apple.com/search?term=${q}`;
    if (p.includes('disney')) return `https://www.disneyplus.com/search?q=${q}`;
    if (p.includes('google play')) return `https://play.google.com/store/search?q=${q}&c=movies`;
    if (p.includes('youtube')) return `https://www.youtube.com/results?search_query=${q}`;
    if (p.includes('hulu')) return `https://www.hulu.com/search?q=${q}`;
    if (p.includes('hbo') || p.includes('max')) return `https://www.max.com/search?q=${q}`;
    if (p.includes('hotstar')) return `https://www.hotstar.com/in/search?q=${q}`;
    if (p.includes('jiocinema')) return `https://www.jiocinema.com/search/${q}`;
    if (p.includes('zee5')) return `https://www.zee5.com/search?q=${q}`;
    if (p.includes('mubi')) return `https://mubi.com/en/search?q=${q}`;
    
    return tmdbFallback;
}

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

const CommentItem = memo(({ comment, currentUser, externalId, type, onRefresh, onXpToast, setAllComments, depth = 0, title = '' }) => {
    const navigate = useNavigate()
    const { topUsers } = useLeaderboard()
    
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
    const [isEdited, setIsEdited] = useState(comment.edited || false)
    const [repliesVisible] = useState(true)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showBurst, setShowBurst] = useState(false)
    const [likes, setLikes] = useState(comment.likeCount || 0)
    const [dislikes, setDislikes] = useState(comment.dislikeCount || 0)
    const [liked, setLiked] = useState(comment.liked || false)
    const [disliked, setDisliked] = useState(comment.disliked || false)

    const isOwn = currentUser && (
        comment.userId?._id === currentUser.id ||
        comment.userId?._id === currentUser._id
    )

    const indentClass = depth > 0 ? 'ml-4 md:ml-8 mt-2' : ''
    const replyCount = comment.replies?.length || 0

    const handleLike = async () => {
        if (!currentUser) { navigate('/login'); return }
        try {
            const res = await api.post(`/movies/comments/${comment._id}/like`, { type: 'like' })
            setLiked(res.data.liked)
            setDisliked(res.data.disliked)
            setLikes(res.data.likeCount)
            setDislikes(res.data.dislikeCount)
            
            if (res.data.liked) {
                setShowBurst(true)
                setTimeout(() => setShowBurst(false), 800)
                onXpToast('❤️ Comment liked!', 'gain')
            } else {
                onXpToast('Removed like', 'loss')
            }
        } catch (err) { console.error('Like error:', err) }
    }

    const handleDislike = async () => {
        if (!currentUser) { navigate('/login'); return }
        try {
            const res = await api.post(`/movies/comments/${comment._id}/like`, { type: 'dislike' })
            setLiked(res.data.liked)
            setDisliked(res.data.disliked)
            setLikes(res.data.likeCount)
            setDislikes(res.data.dislikeCount)
        } catch (err) { console.error('Dislike error:', err) }
    }

    const handleDelete = async () => {
        try {
            const res = await api.delete(`/movies/comments/${comment._id}`)
            onXpToast(res.data.message || '🗑 Comment deleted', 'loss')
            onRefresh(true)
        } catch (err) { console.error(err) }
        finally { setShowDeleteConfirm(false) }
    }

    const handleEdit = async () => {
        if (!editingText.trim()) return
        try {
            await api.put(`/movies/comments/${comment._id}`, { text: editingText })
            setIsEditing(false); setIsEdited(true)
            onRefresh(true)
        } catch (err) { console.error(err) }
    }

    const handleReply = async () => {
        if (!replyText.trim() || submittingReply) return
        const text = replyText.trim()
        setReplyText('')
        setShowReplyBox(false)
        setSubmittingReply(true)
        try {
            await api.post(`/movies/comments/${externalId}`, {
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
                        <Link to={profilePath || '#'}><AvatarFrame userId={comment.userId?._id || comment.userId?.id} src={comment.userId?.avatar} size={28} /></Link>
                        <Link to={profilePath || '#'} className={`font-bold text-xs hover:underline 
                            ${rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-[#B9F2FF]' : rank === 3 ? 'text-[#cd7f32]' : rank === 4 ? 'text-[#94999c]' : isOwn ? 'text-[#c8ff57]' : 'text-white'}`}
                        >
                            {username || 'User'}
                        </Link>
                        <div className="flex items-center gap-1.5 bg-[#18181f] rounded-full px-2 py-0.5 border border-[#2a2a35] shadow-sm">
                            <span className="flex items-center justify-center text-[10px] leading-none relative -top-[1.8px]">{comment.userId?.badge || '🍿'}</span>
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
                    <div className="flex items-center gap-2 mt-3">
                        <div className="flex bg-[#18181f] rounded-xl border border-[#2a2a35] p-0.5 shadow-sm relative">
                            {showBurst && (
                                <div className="rank-like-burst">
                                    {currentUserRank === 1 ? '👑' : currentUserRank === 2 ? '🪽' : currentUserRank === 3 ? '🎖️' : currentUserRank === 4 ? '⚔️' : '🍿'}
                                </div>
                            )}
                            <button onClick={handleLike} className={`px-2 py-1 flex items-center gap-1.5 font-bold text-[10px] rounded-lg ${liked ? 'bg-[#c8ff57]/20 text-[#c8ff57]' : 'text-[#7a7a90] hover:text-white'}`}><ThumbsUp size={12} /> {likes > 0 && <span>{likes}</span>}</button>
                            <div className="w-[1px] bg-[#2a2a35] my-1 mx-0.5" />
                            <button onClick={handleDislike} className={`px-2 py-1 flex items-center gap-1.5 font-bold text-[10px] rounded-lg ${disliked ? 'bg-[#ff5c5c]/20 text-[#ff5c5c]' : 'text-[#7a7a90] hover:text-white'}`}><ThumbsDown size={12} /> {dislikes > 0 && <span>{dislikes}</span>}</button>
                        </div>
                        {currentUser && <button onClick={() => { setReplyText(`@${username} `); setShowReplyBox(true) }} className="px-2 py-1 flex items-center gap-1 font-bold text-[10px] text-[#7a7a90] hover:text-white bg-[#18181f]/50 rounded-lg border border-transparent hover:border-[#2a2a35]"><MessageSquare size={12} /> Reply</button>}
                        {isOwn && !showDeleteConfirm && (
                            <div className="ml-auto flex gap-1.5">
                                <button onClick={() => { setIsEditing(true); setEditingText(comment.text) }} className="px-2.5 py-1 text-[#7a7a90] hover:text-black hover:bg-[#c8ff57] transition-all rounded-lg font-bold text-[10px]">Edit</button>
                                <button onClick={() => setShowDeleteConfirm(true)} className="px-2.5 py-1 text-[#7a7a90] hover:text-white hover:bg-[#ff5c5c] transition-all rounded-lg font-bold text-[10px]">Delete</button>
                            </div>
                        )}
                        {showDeleteConfirm && (
                            <div className="ml-auto flex items-center gap-2 bg-[#ff5c5c]/10 border border-[#ff5c5c]/30 rounded-md px-2 py-1">
                                <button onClick={handleDelete} className="px-2 py-0.5 bg-[#ff5c5c] text-white font-bold text-[9px] rounded uppercase">YES</button>
                                <button onClick={() => setShowDeleteConfirm(false)} className="px-2 py-0.5 border border-[#ff5c5c]/30 text-[#ff5c5c] font-mono text-[9px] rounded">NO</button>
                            </div>
                        )}
                    </div>
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

function MovieDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user, updateUser } = useAuth()
    const type = 'movie'

    const [activeTab, setActiveTab] = useState('overview')
    const [expanded, setExpanded] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showListModal, setShowListModal] = useState(false)
    const [customLists, setCustomLists] = useState([])
    const [loadingLists, setLoadingLists] = useState(false)
    const [listToast, setListToast] = useState(null)
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
    const [watchRegion, setWatchRegion] = useState('IN')
    const [isWatchDropdownOpen, setIsWatchDropdownOpen] = useState(false)


    const { data: contextData, loading, error, refetch: refetchContext, setData: setContextData } = useCachedFetch(
        `movie_context_${id}_${type}_${user?.id || 'anon'}`,
        `/movies/detail/${id}?type=${type}`,
        { deps: [id, type, user?.id], ttl: 5 * 60 * 1000 }
    )

    useEffect(() => {
        if (contextData?.userStatus) {
            setLiked(contextData.userStatus.liked)
            setWishlisted(contextData.userStatus.wishlisted)
        }
        const fetchLib = async () => {
            if (user) {
                const res = await api.get('/movies/library')
                setUserLibrary(res.data.library || [])
            }
        }
        fetchLib()
    }, [contextData, user])

    const { data: commentsData, refetch: refetchComments } = useCachedFetch(
        `movie_comments_${id}_${commentPage}`,
        `/movies/comments/${id}?page=${commentPage}&limit=10&type=${type}`,
        { ttl: 1 * 60 * 1000, deps: [id, commentPage, type] }
    )

    useEffect(() => {
        if (commentsData?.comments) {
            if (commentPage === 1) setAllComments(commentsData.comments)
            else setAllComments(prev => [...prev, ...commentsData.comments])
        }
    }, [commentsData, commentPage])

    const movie = contextData?.movie
    const stats = contextData?.stats
    const myEntry = userLibrary.find(a => String(a.externalId) === String(id))

    const showXpToast = useCallback((msg, type = 'gain') => {
        setXpToast({ msg, type })
        setTimeout(() => setXpToast(null), 3000)
    }, [])

    const handleLike = async () => {
        if (!user) { navigate('/login'); return }
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
                gameTitle: movie.title, 
                gameCover: movie.cover || movie.coverImage, 
                mediaType: type, 
                genre: movie.genres?.[0] 
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
        if (!user) { navigate('/login'); return }
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
                gameTitle: movie.title, 
                gameCover: movie.cover || movie.coverImage, 
                mediaType: type, 
                genre: movie.genres?.[0] 
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

    const handleOpenListModal = async () => {
        if (!user) { navigate('/login'); return }
        setShowListModal(true)
        if (user.level < 2) return
        setLoadingLists(true)
        try {
            const res = await api.get(`/lists/me?mediaType=${type}`)
            setCustomLists(res.data.customLists || [])
        } catch (err) { console.error('Error fetching lists:', err) }
        finally { setLoadingLists(false) }
    }

    const handleAddToList = async (listId, listName) => {
        try {
            await api.put(`/lists/custom/${listId}/game`, {
                externalId: id, gameTitle: movie.title,
                gameCover: movie.cover || movie.coverImage, genre: movie.genres?.[0], action: 'add'
            })
            setListToast({ msg: `Added to "${listName}"`, type: 'success' })
            setTimeout(() => setListToast(null), 3000)
            setShowListModal(false)
        } catch (err) { 
            console.error('Add to list error:', err)
            setListToast({ msg: 'Failed to add to list', type: 'error' }) 
            setTimeout(() => setListToast(null), 3000)
        }
    }

    const handlePostComment = async () => {
        if (!commentText.trim() || submittingComment) return
        const text = commentText.trim()
        setCommentText('')
        setSubmittingComment(true)
        try {
            await api.post(`/movies/comments/${id}`, { text, title: movie?.title, type })
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

    if (loading && !movie) return (
        <div className="min-h-screen bg-[#0a0a0f] p-10">
            <Skeleton variant="block" width="200px" height="300px" />
            <Skeleton variant="line" width="60%" height="48px" className="mt-8" />
        </div>
    )

    if (error || !movie) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
            <div className="text-5xl">😵</div>
            <div className="text-[#7a7a90] font-mono text-sm">Media not found</div>
            <button onClick={() => navigate(-1)} className="px-5 py-2 border border-[#2a2a35] text-[#7a7a90] rounded hover:border-[#c8ff57] hover:text-[#c8ff57]">← BACK</button>
        </div>
    )

    const summaryText = movie.summary || ''
    const isLong = summaryText.length > 300
    const displayText = isLong && !expanded ? summaryText.slice(0, 300) + '...' : summaryText

    const statusConfig = {
        watching: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: '▶ Watching' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: '✓ Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: '📋 Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: '✕ Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: '⏸ Paused' },
    }

    return (
        <div className="min-h-screen">
            <Helmet>
                <title>{movie.title} | QuestDuck</title>
                <meta name="description" content={movie.summary?.slice(0, 160)} />
            </Helmet>

            {xpToast && (
                <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-2xl font-mono text-sm border shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 
                                ${xpToast.type === 'loss' ? 'bg-[#ff5c5c]/20 border-[#ff5c5c]/40 text-[#ff5c5c]' : 'bg-[#c8ff57]/20 border-[#c8ff57]/40 text-[#c8ff57]'}`}>
                    {xpToast.msg}
                </div>
            )}

            {/* HERO */}
            <div className="relative overflow-hidden min-h-[420px]">
                <div className="absolute inset-0 bg-cover bg-center scale-110" style={{ backgroundImage: `url(${movie.cover || movie.coverImage})`, filter: 'blur(60px) brightness(0.35)' }} />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/40 via-[#0a0a0f]/55 to-[#0a0a0f]" />
                <div className="relative max-w-[1200px] mx-auto px-5 md:px-10 py-10">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-mono text-xs text-[#7a7a90] hover:text-[#c8ff57] mb-8 transition-colors">← BACK</button>
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <img src={movie.cover || movie.coverImage} alt={movie.title} className="w-36 md:w-48 rounded-lg shadow-2xl ring-1 ring-white/10" />
                        <div className="flex-1 min-w-0 w-full">
                            <h1 className="font-black text-4xl md:text-6xl text-white uppercase tracking-wide leading-none mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{movie.title}</h1>
                            <div className="flex flex-wrap gap-2 mb-6">
                                {[type.toUpperCase(), movie.year, movie.runtime ? `${movie.runtime}m` : null, movie.seasonsCount ? `${movie.seasonsCount} Seasons` : null].filter(Boolean).map(tag => (
                                    <span key={tag} className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-white/15 text-[#a0a0b8] rounded bg-black/20">{tag}</span>
                                ))}
                            </div>

                            <div className="flex flex-wrap gap-x-12 gap-y-6 mb-10 py-6 border-y border-white/5 backdrop-blur-sm">
                                {/* Avg Rating */}
                                <div className="group transition-all">
                                    <div className="flex items-center gap-2">
                                        <div className="font-black text-5xl text-[#5c9fff] leading-none drop-shadow-[0_0_15px_rgba(92,159,255,0.3)]"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {stats?.avgRating > 0 ? stats.avgRating : '—'}
                                            {stats?.avgRating > 0 && <small className="font-mono text-[10px] text-[#a0a0b8] font-normal align-top ml-1">/10</small>}
                                        </div>
                                    </div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5 group-hover:text-[#5c9fff] transition-colors">
                                        Avg Rating {stats?.ratingCount > 0 && <span className="opacity-60">({stats.ratingCount})</span>}
                                    </div>
                                </div>

                                {myEntry?.rating > 0 && (
                                    <div className="group transition-all">
                                        <div className="font-black text-5xl text-[#c8ff57] leading-none drop-shadow-[0_0_15px_rgba(200,255,87,0.3)]"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {myEntry.rating}<small className="font-mono text-[10px] text-[#a0a0b8] font-normal align-top ml-1">/10</small>
                                        </div>
                                        <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-[0.2em] mt-1 group-hover:text-[#c8ff57] transition-colors">My Rating</div>
                                    </div>
                                )}

                                <div className="group transition-all">
                                    <div className="font-black text-5xl text-[#ff9f5c] leading-none drop-shadow-[0_0_15px_rgba(255,159,92,0.3)]"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{stats?.loggedCount ?? '—'}</div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-[0.2em] mt-1 group-hover:text-[#ff9f5c] transition-colors">In Pond</div>
                                </div>

                                <div className="group transition-all">
                                    <div className="font-black text-5xl text-[#ff5c5c] leading-none drop-shadow-[0_0_15px_rgba(255,92,92,0.3)]"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{stats?.likeCount ?? '—'}</div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-[0.2em] mt-1 group-hover:text-[#ff5c5c] transition-colors">Likes</div>
                                </div>

                                <div className="group transition-all">
                                    <div className="font-black text-5xl text-[#5c9fff] leading-none drop-shadow-[0_0_15px_rgba(92,159,255,0.3)]"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{stats?.wishlistCount ?? '—'}</div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-[0.2em] mt-1 group-hover:text-[#5c9fff] transition-colors">Wishlists</div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button onClick={() => setShowAddModal(true)} className={`btn-apple px-5 py-2.5 flex items-center gap-2 border ${myEntry ? (statusConfig[myEntry.status]?.bg || 'bg-[#c8ff57]/10') : 'bg-[#c8ff57] text-black shadow-lg'} ${myEntry ? (statusConfig[myEntry.status]?.color || 'text-[#c8ff57]') : ''} border-current hover:brightness-110 transition-all font-bold text-sm`}>
                                    {myEntry ? `${statusConfig[myEntry.status]?.label} · Update` : <><Plus size={16} /> Add to Pond</>}
                                </button>
                                <button onClick={handleLike} disabled={liking} className={`btn-apple px-4 py-2.5 flex items-center gap-1.5 border backdrop-blur-md ${liked ? 'border-[#ff5c5c] text-[#ff5c5c] bg-[#ff5c5c]/10' : 'border-white/10 text-[#c8c8d8] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'} transition-all`}>
                                    <Heart size={16} className={liked ? 'fill-current' : ''} /> {liked ? 'Liked' : 'Like'}
                                </button>
                                <button onClick={handleWishlist} disabled={wishing} className={`btn-apple px-4 py-2.5 flex items-center gap-1.5 border backdrop-blur-md ${wishlisted ? 'border-[#5c9fff] text-[#5c9fff] bg-[#5c9fff]/10' : 'border-white/10 text-[#c8c8d8] hover:border-[#5c9fff] hover:text-[#5c9fff]'} transition-all`}>
                                    {wishlisted ? <Check size={16} /> : <Plus size={16} />} {wishlisted ? 'Wishlisted' : 'Wishlist'}
                                </button>
                                <button onClick={handleShare} className={`btn-apple px-4 py-2.5 flex items-center gap-1.5 border transition-all ${shareCopied ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/10' : 'border-white/10 text-[#c8c8d8] hover:border-[#c8ff57] hover:text-[#c8ff57]'}`}>
                                    {shareCopied ? <Check size={16} /> : <Share size={16} />} {shareCopied ? 'Copied!' : 'Share'}
                                </button>
                                <button onClick={handleOpenListModal} className="btn-apple px-4 py-2.5 flex items-center gap-1.5 border border-white/10 text-[#c8c8d8] hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all backdrop-blur-md">
                                    <Layers size={16} /> List
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="border-b border-[#2a2a35] bg-[#0a0a0f] sticky top-[65px] z-40">
                <div className="max-w-[1200px] mx-auto px-5 md:px-10">
                    <div className="flex gap-6">
                        {['overview', 'comments', 'watch', 'cast'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} 
                                className={`font-mono text-xs uppercase tracking-widest py-4 border-b-2 transition-all 
                                           ${activeTab === tab ? 'border-[#c8ff57] text-[#c8ff57]' : 'border-transparent text-[#7a7a90] hover:text-white'}`}>
                                {tab} {tab === 'comments' && allComments.length > 0 && <span className="opacity-60 ml-1.5 font-mono text-[10px]">({allComments.length})</span>}
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
                                {movie.trailer && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">🎬 Trailer</div>
                                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                            <iframe src={`https://www.youtube.com/embed/${movie.trailer}?rel=0&modestbranding=1`} className="absolute inset-0 w-full h-full rounded-lg" allowFullScreen />
                                        </div>
                                    </div>
                                )}
                                {summaryText && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6 shadow-sm">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">About</div>
                                        <p className="text-[#c8c8d8] text-sm leading-relaxed">{displayText}</p>
                                        {isLong && <button onClick={() => setExpanded(!expanded)} className="mt-3 font-mono text-xs text-[#c8ff57] hover:underline transition-all">{expanded ? 'Show less ↑' : 'Read more ↓'}</button>}
                                    </div>
                                )}
                                {movie.screenshots?.length > 0 && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">
                                            Screenshots <span className="ml-2 text-[#2a2a35] normal-case font-normal">· click to enlarge</span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {movie.screenshots.slice(0, 6).map((url, i) => (
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

                        {activeTab === 'watch' && (
                            <div className="flex flex-col gap-6">
                                {(() => {
                                    // Get all available regions from data
                                    const availableRegions = Object.keys(movie.watchProviders || {})
                                        .filter(reg => reg !== 'link' && movie.watchProviders[reg] && (movie.watchProviders[reg].flatrate || movie.watchProviders[reg].rent || movie.watchProviders[reg].buy));
                                    
                                    // Priority regions to show first
                                    const priority = ['IN', 'US', 'GB', 'JP', 'CA', 'AU', 'FR', 'DE'];
                                    availableRegions.sort((a, b) => {
                                        const ai = priority.indexOf(a);
                                        const bi = priority.indexOf(b);
                                        if (ai !== -1 && bi !== -1) return ai - bi;
                                        if (ai !== -1) return -1;
                                        if (bi !== -1) return 1;
                                        return a.localeCompare(b);
                                    });

                                    // Auto-select first available if current selection has no data
                                    const currentReg = movie.watchProviders?.[watchRegion] ? watchRegion : (availableRegions[0] || 'IN');
                                    const providers = movie.watchProviders?.[currentReg];
                                    const hasData = providers && (providers.flatrate || providers.rent || providers.buy);

                                    if (!movie.watchProviders || availableRegions.length === 0) {
                                        return (
                                            <div className="bg-[#111118] border border-[#2a2a35] rounded-xl p-16 text-center shadow-2xl relative overflow-hidden group">
                                                <div className="absolute inset-0 bg-gradient-to-br from-[#c8ff57]/5 via-transparent to-transparent opacity-50" />
                                                <div className="relative z-10">
                                                    <div className="w-20 h-20 rounded-full bg-[#18181f] border border-[#2a2a35] flex items-center justify-center mx-auto mb-6 shadow-2xl group-hover:border-[#c8ff57]/30 transition-colors duration-500">
                                                        <Play size={32} className="text-[#2a2a35] group-hover:text-[#c8ff57] transition-colors duration-500" />
                                                    </div>
                                                    <h3 className="text-white font-bold text-xl mb-2">No Streaming Data</h3>
                                                    <p className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest max-w-xs mx-auto">This title hasn't been added to any major streaming services yet.</p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <>
                                            <div className="relative">
                                                <button 
                                                    onClick={() => setIsWatchDropdownOpen(!isWatchDropdownOpen)}
                                                    className="w-full flex items-center justify-between p-5 bg-[#18181f]/40 border border-white/5 rounded-2xl hover:border-[#c8ff57]/40 transition-all shadow-xl group"
                                                >
                                                        <div className="flex items-center gap-5">
                                                            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner group-hover:scale-105 transition-all duration-500 overflow-hidden">
                                                                <span className="text-white font-black text-xl font-mono tracking-tighter leading-none flex items-center justify-center w-full h-full">
                                                                    {getFlagEmoji(currentReg)}
                                                                </span>
                                                            </div>
                                                            <div className="text-left">
                                                                <div className="text-[10px] font-mono text-[#7a7a90] uppercase tracking-[0.25em] mb-1">Watching From</div>
                                                                <div className="text-white font-black text-lg uppercase tracking-wider truncate max-w-[180px] sm:max-w-none">
                                                                    {currentReg ? regionNames.of(currentReg) : 'Select Region'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white/5 group-hover:bg-[#c8ff57]/10 transition-all duration-500 ${isWatchDropdownOpen ? 'rotate-180' : ''}`}>
                                                        <Plus size={20} className={`text-[#c8ff57] transition-transform duration-500 ${isWatchDropdownOpen ? 'rotate-45' : ''}`} />
                                                    </div>
                                                </button>
                                                
                                                {isWatchDropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-[90]" onClick={() => setIsWatchDropdownOpen(false)} />
                                                        <div className="absolute top-full left-0 right-0 mt-3 bg-[#0a0a0f] border border-white/10 rounded-[2rem] shadow-[0_40px_80px_rgba(0,0,0,0.9)] z-[100] max-h-[450px] overflow-y-auto custom-scrollbar p-3 animate-in fade-in zoom-in-95 slide-in-from-top-6 duration-500">
                                                            <div className="px-5 py-4 border-b border-white/5 mb-3 flex items-center justify-between">
                                                                <div className="font-mono text-[10px] text-[#3a3a4a] uppercase tracking-[0.4em]">Global Availability</div>
                                                                <div className="px-2 py-0.5 bg-black/40 rounded font-mono text-[8px] text-[#c8ff57]">{availableRegions.length} REGIONS</div>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-2">
                                                                {availableRegions.map(reg => (
                                                                    <button 
                                                                        key={reg} 
                                                                        onClick={() => { setWatchRegion(reg); setIsWatchDropdownOpen(false); }}
                                                                        className={`w-full flex items-center gap-5 p-4 rounded-2xl transition-all duration-300
                                                                                   ${currentReg === reg 
                                                                                     ? 'bg-[#c8ff57] text-black shadow-[0_15px_30px_rgba(200,255,87,0.2)] font-black' 
                                                                                     : 'hover:bg-white/5 text-[#7a7a90] hover:text-white group/item'}`}
                                                                    >
                                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 transition-transform duration-300 group-hover/item:scale-110 ${currentReg === reg ? 'bg-black/10' : 'bg-black/40 border border-white/5'}`}>
                                                                            <span className={`font-black text-lg font-mono tracking-tighter ${currentReg === reg ? 'text-black' : 'text-white'}`}>
                                                                                {getFlagEmoji(reg)}
                                                                            </span>
                                                                        </div>
                                                                        <span className="flex-1 text-left font-bold text-sm uppercase tracking-widest truncate">{regionNames.of(reg)}</span>
                                                                        <span className={`font-mono text-[10px] px-2.5 py-1 rounded-lg border transition-colors
                                                                                        ${currentReg === reg ? 'bg-black/10 border-black/10 text-black/60' : 'bg-black/40 border-white/5 text-[#3a3a4a]'}`}>{reg}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {!hasData ? (
                                                <div className="bg-[#111118] border border-[#2a2a35] rounded-xl p-12 text-center shadow-xl">
                                                    <div className="text-[#2a2a35] mb-4"><Play size={40} className="mx-auto opacity-20" /></div>
                                                    <div className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest mb-6">No options available in {currentReg}</div>
                                                    <div className="flex flex-wrap justify-center gap-3">
                                                        {priority.map(p => availableRegions.includes(p) && p !== currentReg && (
                                                            <button 
                                                                key={p}
                                                                onClick={() => setWatchRegion(p)}
                                                                className="px-6 py-2 bg-white/5 border border-white/10 text-[#c8ff57] font-mono text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#c8ff57] hover:text-black hover:border-[#c8ff57] transition-all duration-300"
                                                            >
                                                                Switch to {p}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-6">
                                                    {providers.flatrate && (
                                                        <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                                            <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-6 flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#c8ff57]" /> Stream
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {providers.flatrate.map((p, i) => (
                                                                    <a key={i} href={getProviderLink(p.provider_name, movie.title, providers.link)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-[#c8ff57]/20 transition-all group cursor-pointer">
                                                                        <img src={`https://image.tmdb.org/t/p/original${p.logo_path}`} alt={p.provider_name} className="w-10 h-10 rounded-lg shadow-lg" />
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-white font-bold text-sm truncate">{p.provider_name}</div>
                                                                            <div className="text-[#7a7a90] text-[10px] font-mono uppercase tracking-wider">Subscription</div>
                                                                        </div>
                                                                        <ChevronRight size={14} className="text-[#2a2a35] group-hover:text-white transition-colors" />
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {providers.rent && (
                                                        <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                                            <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-6 flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#ff9f5c]" /> Rent
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {providers.rent.map((p, i) => (
                                                                    <a key={i} href={getProviderLink(p.provider_name, movie.title, providers.link)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-[#ff9f5c]/20 transition-all group cursor-pointer">
                                                                        <img src={`https://image.tmdb.org/t/p/original${p.logo_path}`} alt={p.provider_name} className="w-10 h-10 rounded-lg shadow-lg" />
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-white font-bold text-sm truncate">{p.provider_name}</div>
                                                                            <div className="text-[#7a7a90] text-[10px] font-mono uppercase tracking-wider">Rental</div>
                                                                        </div>
                                                                        <CreditCard size={14} className="text-[#2a2a35] group-hover:text-white transition-colors" />
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {providers.buy && (
                                                        <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                                            <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-6 flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#5c9fff]" /> Buy
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {providers.buy.map((p, i) => (
                                                                    <a key={i} href={getProviderLink(p.provider_name, movie.title, providers.link)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-[#5c9fff]/20 transition-all group cursor-pointer">
                                                                        <img src={`https://image.tmdb.org/t/p/original${p.logo_path}`} alt={p.provider_name} className="w-10 h-10 rounded-lg shadow-lg" />
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-white font-bold text-sm truncate">{p.provider_name}</div>
                                                                            <div className="text-[#7a7a90] text-[10px] font-mono uppercase tracking-wider">Purchase</div>
                                                                        </div>
                                                                        <ShoppingBag size={14} className="text-[#2a2a35] group-hover:text-white transition-colors" />
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {activeTab === 'cast' && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-6">Cast & Characters</div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {movie.cast?.map((person, i) => (
                                        <div key={i} className="bg-[#111118] border border-white/5 rounded-xl p-3 flex flex-col items-center text-center group hover:border-[#c8ff57]/30 hover:bg-[#18181f] transition-all">
                                            <div className="relative mb-3">
                                                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-[#2a2a35] group-hover:border-[#c8ff57] transition-all bg-[#0a0a0f] shadow-xl">
                                                    {person.image ? (
                                                        <img src={person.image} alt={person.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-110 group-hover:scale-100" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[#2a2a35] text-2xl font-black">?</div>
                                                    )}
                                                </div>
                                                {person.popularity > 50 && (
                                                    <div className="absolute -top-1 -right-1 bg-[#c8ff57] text-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                                        <Flame size={10} fill="currentColor" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-white font-bold text-xs leading-tight mb-1 line-clamp-1">{person.name}</div>
                                            <div className="font-mono text-[9px] text-[#7a7a90] uppercase tracking-wider line-clamp-1">{person.role}</div>
                                        </div>
                                    ))}
                                    {(!movie.cast || movie.cast.length === 0) && (
                                        <div className="col-span-full py-10 text-center font-mono text-xs text-[#3a3a4a]">No cast information available</div>
                                    )}
                                </div>
                            </div>
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
                                <div className="flex flex-col gap-3">
                                    {allComments.map(c => (
                                        <CommentItem key={c._id} comment={c} currentUser={user} externalId={id} type={type} onRefresh={() => refetchComments(true)} onXpToast={showXpToast} setAllComments={setAllComments} title={movie.title} />
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
                                        <span className={`font-mono text-[10px] uppercase tracking-wider font-bold ${statusConfig[myEntry.status]?.color}`}>
                                            {statusConfig[myEntry.status]?.label?.replace(/^[^\s]+\s/, '') || myEntry.status}
                                        </span>
                                    </div>
                                    {type === 'tv' && (
                                        <>
                                            <div className="flex justify-between py-2.5">
                                                <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">Seasons</span>
                                                <span className="font-mono text-[10px] text-white font-bold">{myEntry.seasonsWatched}</span>
                                            </div>
                                            <div className="flex justify-between py-2.5">
                                                <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">Episodes</span>
                                                <span className="font-mono text-[10px] text-white font-bold">{myEntry.episodesWatched}</span>
                                            </div>
                                        </>
                                    )}
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
                            <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">{type === 'tv' ? 'TV SHOW' : 'MOVIE'} INFO</div>
                            <div className="flex flex-col divide-y divide-[#2a2a35]">
                                <div className="flex justify-between py-2.5 gap-4"><span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">Type</span><span className="font-mono text-[11px] text-white uppercase font-bold text-right">{type}</span></div>
                                <div className="flex justify-between py-2.5 gap-4"><span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">Production</span><span className="font-mono text-[11px] text-white text-right">{movie.production || 'TBA'}</span></div>
                                <div className="flex justify-between py-2.5 gap-4"><span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">Year</span><span className="font-mono text-[11px] text-white font-bold text-right">{movie.year || 'TBA'}</span></div>
                                {movie.runtime > 0 && <div className="flex justify-between py-2.5 gap-4"><span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">Runtime</span><span className="font-mono text-[11px] text-white font-bold text-right">{movie.runtime}m</span></div>}
                                <div className="flex justify-between py-2.5 gap-4"><span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">Language</span><span className="font-mono text-[11px] text-white font-bold text-right">{movie.language || '—'}</span></div>
                                <div className="flex justify-between py-2.5 gap-4"><span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">Status</span><span className="font-mono text-[11px] text-white font-bold text-right">{movie.status || 'TBA'}</span></div>
                            </div>
                        </div>

                        {movie.genres?.length > 0 && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5 shadow-sm">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">Genres</div>
                                <div className="flex flex-wrap gap-2">
                                    {movie.genres.map(g => <span key={g} className="font-mono text-[10px] uppercase px-3 py-1 bg-[#2a2a35] text-[#7a7a90] rounded-full hover:bg-[#c8ff57]/10 hover:text-[#c8ff57] transition-all cursor-default">{g}</span>)}
                                </div>
                            </div>
                        )}

                        {movie.similar?.length > 0 && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5 shadow-sm">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest mb-4">Similar {type === 'tv' ? 'TV Shows' : 'Movies'}</div>
                                <div className="flex flex-col gap-3">
                                    {movie.similar.map(sg => (
                                        <Link key={sg.id} to={`/movies/${sg.id}`}
                                            className="flex items-center gap-3 hover:opacity-80 transition-opacity group">
                                            {sg.cover ? (
                                                <img src={sg.cover || sg.coverImage} alt={sg.title} className="w-10 h-14 object-cover rounded flex-shrink-0" />
                                            ) : (
                                                <div className="w-10 h-14 bg-[#2a2a35] rounded flex-shrink-0 flex items-center justify-center text-sm">🎬</div>
                                            )}
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

            {showListModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={e => e.target === e.currentTarget && setShowListModal(false)}>
                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-5 border-b border-[#2a2a35]">
                            <div>
                                <div className="font-black text-lg text-white tracking-widest uppercase"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Add to List</div>
                                <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5 truncate max-w-[220px]">{movie.title}</div>
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
                                <div className="flex flex-col items-center gap-3 py-8 text-center">
                                    <div className="text-3xl">📋</div>
                                    <div className="font-mono text-xs text-[#7a7a90]">No {type === 'tv' ? 'TV' : 'Movie'} collections yet.</div>
                                    <button onClick={() => { setShowListModal(false); navigate('/lists') }}
                                        className="px-4 py-2 bg-[#c8ff57] text-black font-bold text-xs rounded hover:bg-[#d4ff6e] transition-all">
                                        Create a Collection →
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                    {customLists.map(list => (
                                        <button key={list._id} onClick={() => handleAddToList(list._id, list.name)}
                                            className="flex items-center gap-3 p-3 rounded-lg border border-[#2a2a35]
                                                       hover:border-[#c8ff57] hover:bg-[#c8ff57]/05 transition-all text-left group">
                                            <div className="w-8 h-8 rounded bg-[#c8ff57]/15 flex items-center justify-center text-sm flex-shrink-0">📋</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-semibold text-sm truncate group-hover:text-[#c8ff57] transition-colors">{list.name}</div>
                                                <div className="font-mono text-[9px] text-[#7a7a90] mt-0.5">
                                                    {list.games?.length || 0} items · {list.isPublic ? 'Public' : 'Private'}
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

            {/* List Toast */}
            {listToast && (
                <div className={`fixed bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-2xl font-mono text-sm border shadow-2xl backdrop-blur-xl transition-all animate-in slide-in-from-bottom-5 duration-300 w-[calc(100%-40px)] max-w-[320px] text-center flex items-center justify-center gap-2
                                ${listToast.type === 'error' ? 'bg-[#ff5c5c]/20 border-[#ff5c5c]/40 text-[#ff5c5c]'
                        : 'bg-[#c8ff57]/20 border-[#c8ff57]/40 text-[#c8ff57]'}`}>
                    {listToast.msg}
                </div>
            )}

            {showAddModal && (
                <AddMovieModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={async (formData) => {
                        try {
                            const res = await api.post('/movies/log', formData)
                            if (res.data.xp) {
                                updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
                            }
                            setShowAddModal(false)
                            refetchContext(true)
                            const libRes = await api.get('/movies/library')
                            setUserLibrary(libRes.data.library || [])
                            return { success: true }
                        } catch (err) {
                            console.error('Log error:', err)
                            return { success: false }
                        }
                    }}
                    preselectedMovie={movie}
                    existingEntry={myEntry}
                />
            )}

            {/* LIGHTBOX */}
            {lightboxIndex >= 0 && (
                <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-10"
                    onClick={() => setLightboxIndex(-1)}>
                    <img src={movie.screenshots[lightboxIndex]} alt="Screenshot Full" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-200" />
                    <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors text-2xl font-mono">✕</button>
                    
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/40 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
                        <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev - 1 + movie.screenshots.length) % movie.screenshots.length) }} className="text-white/50 hover:text-[#c8ff57] transition-colors text-xl font-mono">←</button>
                        <span className="font-mono text-xs text-white/50">{lightboxIndex + 1} / {movie.screenshots.length}</span>
                        <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev + 1) % movie.screenshots.length) }} className="text-white/50 hover:text-[#c8ff57] transition-colors text-xl font-mono">→</button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default MovieDetail
