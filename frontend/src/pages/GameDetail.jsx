import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import useGames from '../hooks/useGames'
import AddGameModal from '../components/library/AddGameModal'


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


    // Add to library modal
    const [showAddModal, setShowAddModal] = useState(false)

    // Add to list modal
    const [showListModal, setShowListModal] = useState(false)
    const [customLists, setCustomLists] = useState([])
    const [loadingLists, setLoadingLists] = useState(false)
    const [listToast, setListToast] = useState(null)

    // Like / Wishlist state
    const [liked, setLiked] = useState(false)
    const [wishlisted, setWishlisted] = useState(false)
    const [liking, setLiking] = useState(false)
    const [wishing, setWishing] = useState(false)

    // Review state
    const [reviews, setReviews] = useState([])
    const [myReview, setMyReview] = useState('')
    const [reviewRating, setReviewRating] = useState('')
    const [submittingReview, setSubmittingReview] = useState(false)
    const [reviewSaved, setReviewSaved] = useState(false)
    const [existingReview, setExistingReview] = useState(null)

    // XP toast
    const [xpToast, setXpToast] = useState(null)

    const showXpToast = (msg) => {
        setXpToast(msg)
        setTimeout(() => setXpToast(null), 3000)
    }

    const showListToast = (msg, type = 'success') => {
        setListToast({ msg, type })
        setTimeout(() => setListToast(null), 3000)
    }

    const myGame = games.find(g =>
        g.igdbId === parseInt(igdbId) ||
        g.title?.toLowerCase() === game?.title?.toLowerCase()
    )

    useEffect(() => {
        const fetchGame = async () => {
            try {
                setLoading(true)
                setError(null)
                const res = await api.get(`/igdb/game/${igdbId}`)
                setGame(res.data.game)
            } catch (err) {
                setError('Failed to load game details')
            } finally {
                setLoading(false)
            }
        }
        fetchGame()
    }, [igdbId])

    useEffect(() => {
        if (!game || !user) return
        const fetchSocial = async () => {
            try {
                const [likeRes, wishRes, reviewRes] = await Promise.all([
                    api.get(`/lists/like/${igdbId}`),
                    api.get(`/lists/wishlist/${igdbId}`),
                    api.get(`/lists/review/${igdbId}`)
                ])
                setLiked(likeRes.data.liked)
                setWishlisted(wishRes.data.wishlisted)
                setReviews(reviewRes.data.reviews || [])
                const mine = reviewRes.data.reviews?.find(
                    r => r.userId?._id === user.id || r.userId?._id === user._id
                )
                if (mine) {
                    setExistingReview(mine)
                    setMyReview(mine.review)
                    setReviewRating(mine.rating || '')
                }
            } catch (err) {
                console.error('Social fetch error:', err)
            }
        }
        fetchSocial()
    }, [game, user])

    useEffect(() => {
        if (!game || user) return
        api.get(`/lists/review/${igdbId}`)
            .then(res => setReviews(res.data.reviews || []))
            .catch(() => { })
    }, [game])

    // Open add to library modal
    // const handleOpenAddModal = () => {
    //     setAddForm({ status: 'planned', hours: '', rating: '', notes: '' })
    //     setAddSaved(false)
    //     setShowAddModal(true)
    // }

    // // Save from add modal
    // const handleAddToLibrary = async () => {
    //     if (!addForm.status) return
    //     setAddSaving(true)
    //     try {
    //         await addGame({
    //             title: game.title,
    //             genre: game.genre,
    //             status: addForm.status,
    //             hours: parseInt(addForm.hours) || 0,
    //             rating: parseFloat(addForm.rating) || 0,
    //             notes: addForm.notes || '',
    //             cover: game.cover,
    //             summary: game.summary,
    //             igdbId: game.id,
    //             platforms: game.platforms,
    //         })
    //         setAddSaved(true)
    //         setTimeout(() => {
    //             setShowAddModal(false)
    //             setAddSaved(false)
    //         }, 1200)
    //     } catch (err) {
    //         console.error('Add error:', err)
    //     } finally {
    //         setAddSaving(false)
    //     }
    // }

    const handleOpenAddModal = () => setShowAddModal(true)


    const handleLike = async () => {
        if (!user || liking) return
        setLiking(true)
        try {
            const res = await api.post('/lists/like', {
                igdbId: parseInt(igdbId),
                gameTitle: game.title,
                gameCover: game.cover,
                genre: game.genre
            })
            setLiked(res.data.liked)
            if (res.data.liked) showXpToast('❤️ Liked! +1 XP')
        } catch (err) {
            console.error('Like error:', err)
        } finally {
            setLiking(false)
        }
    }

    const handleWishlist = async () => {
        if (!user || wishing) return
        setWishing(true)
        try {
            const res = await api.post('/lists/wishlist', {
                igdbId: parseInt(igdbId),
                gameTitle: game.title,
                gameCover: game.cover,
                genre: game.genre,
                releaseYear: game.releaseYear || ''
            })
            setWishlisted(res.data.wishlisted)
            if (res.data.wishlisted) showXpToast('🎯 Wishlisted! +1 XP')
        } catch (err) {
            console.error('Wishlist error:', err)
        } finally {
            setWishing(false)
        }
    }

    // Open add to list modal — fetch custom lists
    const handleOpenListModal = async () => {
        setShowListModal(true)
        setLoadingLists(true)
        try {
            const res = await api.get('/lists/me')
            setCustomLists(res.data.customLists || [])
        } catch (err) {
            console.error('Lists fetch error:', err)
        } finally {
            setLoadingLists(false)
        }
    }

    const handleAddToList = async (listId, listName) => {
        try {
            await api.put(`/lists/custom/${listId}/game`, {
                igdbId: parseInt(igdbId),
                gameTitle: game.title,
                gameCover: game.cover,
                genre: game.genre,
                action: 'add'
            })
            showListToast(`Added to "${listName}"`)
            setShowListModal(false)
        } catch (err) {
            showListToast('Failed to add to list', 'error')
        }
    }

    const handleSubmitReview = async () => {
        if (!user || !myReview.trim()) return
        setSubmittingReview(true)
        try {
            const res = await api.post('/lists/review', {
                igdbId: parseInt(igdbId),
                gameTitle: game.title,
                gameCover: game.cover,
                review: myReview.trim(),
                rating: parseFloat(reviewRating) || 0
            })
            const reviewRes = await api.get(`/lists/review/${igdbId}`)
            setReviews(reviewRes.data.reviews || [])
            const mine = reviewRes.data.reviews?.find(
                r => r.userId?._id === user.id || r.userId?._id === user._id
            )
            if (mine) setExistingReview(mine)
            setReviewSaved(true)
            setTimeout(() => setReviewSaved(false), 2000)
            if (res.data.xp !== undefined) showXpToast('✍️ Review posted! +1 XP')
        } catch (err) {
            console.error('Review error:', err)
        } finally {
            setSubmittingReview(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-[#7a7a90] font-mono text-sm">Loading...</div>
            </div>
        )
    }

    if (error || !game) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">😵</div>
                <div className="text-white font-mono text-sm">{error || 'Game not found'}</div>
                <button onClick={() => navigate(-1)}
                    className="px-5 py-2 border border-[#2a2a35] text-[#7a7a90]
                               font-mono text-xs rounded hover:border-[#c8ff57]
                               hover:text-[#c8ff57] transition-all">
                    ← Go Back
                </button>
            </div>
        )
    }

    const summaryText = game.summary || game.storyline || ''
    const isLong = summaryText.length > 300
    const displayText = isLong && !expanded
        ? summaryText.slice(0, 300) + '...'
        : summaryText

    const allTags = [...(game.keywords || []), ...(game.themes || [])]
        .filter(Boolean).slice(0, 12)

    const statusOptions = [
        { value: 'playing', label: '▶  Playing' },
        { value: 'completed', label: '✓  Completed' },
        { value: 'planned', label: '📋  Planned' },
        { value: 'paused', label: '⏸  Paused' },
        { value: 'dropped', label: '✕  Dropped' },
    ]

    const statusConfig = {
        playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: '▶ Playing' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: '✓ Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: '📋 Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: '✕ Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: '⏸ Paused' },
    }

    const otherReviews = reviews.filter(
        r => r.userId?._id !== user?.id && r.userId?._id !== user?._id
    )

    return (
        <div className="min-h-screen">

            {/* XP Toast */}
            {xpToast && (
                <div className="fixed top-5 right-5 z-[100] px-4 py-3 rounded-lg font-mono text-sm
                                bg-[#c8ff57]/15 border border-[#c8ff57]/50 text-[#c8ff57] animate-pulse">
                    {xpToast}
                </div>
            )}

            {/* List Toast */}
            {listToast && (
                <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-lg font-mono text-sm
                                border ${listToast.type === 'error'
                        ? 'bg-[#ff5c5c]/15 border-[#ff5c5c]/50 text-[#ff5c5c]'
                        : 'bg-[#c8ff57]/15 border-[#c8ff57]/50 text-[#c8ff57]'}`}>
                    {listToast.msg}
                </div>
            )}

            {/* ══ HERO ══ */}
            <div className="relative overflow-hidden min-h-[420px]">

                {/* Background — brighter blur */}
                {game.cover && (
                    <div className="absolute inset-0 bg-cover bg-center scale-110"
                        style={{
                            backgroundImage: `url(${game.cover})`,
                            filter: 'blur(60px) brightness(0.35) saturate(1.4)',
                        }}
                    />
                )}
                {/* Gradient overlay — lighter so bg colour shows through */}
                <div className="absolute inset-0 bg-gradient-to-b
                                from-[#0a0a0f]/40 via-[#0a0a0f]/55 to-[#0a0a0f]" />
                {/* Bottom fade */}
                <div className="absolute bottom-0 left-0 right-0 h-32
                                bg-gradient-to-t from-[#0a0a0f] to-transparent" />

                <div className="relative max-w-[1200px] mx-auto px-5 md:px-10 py-10">
                    <button onClick={() => navigate(-1)}
                        className="flex items-center gap-2 font-mono text-xs text-[#7a7a90]
                                   hover:text-[#c8ff57] transition-colors mb-8">
                        ← BACK
                    </button>

                    <div className="flex flex-col md:flex-row gap-8 items-start">

                        {/* Cover */}
                        {game.cover && (
                            <div className="flex-shrink-0 drop-shadow-2xl">
                                <img src={game.cover} alt={game.title}
                                    className="w-36 md:w-48 rounded-lg shadow-2xl
                                               ring-1 ring-white/10" />
                            </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">

                            <h1 className="font-black text-4xl md:text-6xl text-white
                                           uppercase tracking-wide leading-none mb-2"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {game.title}
                            </h1>

                            {game.storyline && (
                                <p className="font-mono text-sm text-[#a0a0b8] italic mb-4 max-w-xl">
                                    {game.storyline.slice(0, 100)}
                                    {game.storyline.length > 100 ? '...' : ''}
                                </p>
                            )}

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2 mb-6">
                                {[game.genre, game.releaseYear, game.developer, game.ageRating, game.modes]
                                    .filter(Boolean).map(tag => (
                                        <span key={tag}
                                            className="font-mono text-[10px] uppercase tracking-wider
                                                       px-2 py-1 border border-white/15
                                                       text-[#a0a0b8] rounded bg-black/20">
                                            {tag}
                                        </span>
                                    ))}
                            </div>

                            {/* Scores */}
                            <div className="flex gap-8 mb-8">
                                {game.criticScore && (
                                    <div>
                                        <div className="font-black text-4xl text-[#c8ff57] leading-none"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {game.criticScore}
                                        </div>
                                        <div className="font-mono text-[10px] text-[#a0a0b8] uppercase tracking-wider mt-1">
                                            Critic Score
                                        </div>
                                    </div>
                                )}
                                {game.userScore && (
                                    <div>
                                        <div className="font-black text-4xl text-[#5c9fff] leading-none"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {game.userScore}
                                        </div>
                                        <div className="font-mono text-[10px] text-[#a0a0b8] uppercase tracking-wider mt-1">
                                            AVG RATING
                                        </div>
                                    </div>
                                )}
                                {game.ratingCount > 0 && (
                                    <div>
                                        <div className="font-black text-4xl text-[#ff9f5c] leading-none"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            {game.ratingCount > 1000
                                                ? `${(game.ratingCount / 1000).toFixed(1)}K`
                                                : game.ratingCount}
                                        </div>
                                        <div className="font-mono text-[10px] text-[#a0a0b8] uppercase tracking-wider mt-1">
                                            Logged
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-3">

                                {/* Add to Library / status badge */}
                                {user ? (
                                    myGame ? (
                                        <button
                                            onClick={handleOpenAddModal}
                                            className={`flex items-center gap-2 px-4 py-2 rounded
                font-mono text-xs border transition-all
                ${statusConfig[myGame.status]?.bg || 'bg-[#c8ff57]/15'}
                ${statusConfig[myGame.status]?.color || 'text-[#c8ff57]'}
                border-current hover:opacity-80`}>
                                            {statusConfig[myGame.status]?.label || 'In Library'} · Update Log
                                        </button>
                                    ) : (
                                        <button onClick={handleOpenAddModal}
                                            className="px-4 py-2 bg-[#c8ff57] text-black font-bold
               text-xs rounded hover:bg-[#d4ff6e] transition-all">
                                            + Log This Game
                                        </button>
                                    )
                                ) : (
                                    <Link to="/login">
                                        <button className="px-4 py-2 bg-[#c8ff57] text-black font-bold
                                                           text-xs rounded hover:bg-[#d4ff6e] transition-all">
                                            Login to Track
                                        </button>
                                    </Link>
                                )}

                                {/* Like */}
                                {user && (
                                    <button onClick={handleLike} disabled={liking}
                                        className={`px-4 py-2 border font-mono text-xs rounded
                                                   transition-all flex items-center gap-1.5
                                                   ${liked
                                                ? 'border-[#ff5c5c] text-[#ff5c5c] bg-[#ff5c5c]/10'
                                                : 'border-white/15 text-[#a0a0b8] hover:border-[#ff5c5c] hover:text-[#ff5c5c]'
                                            }`}>
                                        {liked ? '❤️' : '🤍'} {liked ? 'Liked' : 'Like'}
                                    </button>
                                )}

                                {/* Wishlist */}
                                {user && (
                                    <button onClick={handleWishlist} disabled={wishing}
                                        className={`px-4 py-2 border font-mono text-xs rounded
                                                   transition-all flex items-center gap-1.5
                                                   ${wishlisted
                                                ? 'border-[#5c9fff] text-[#5c9fff] bg-[#5c9fff]/10'
                                                : 'border-white/15 text-[#a0a0b8] hover:border-[#5c9fff] hover:text-[#5c9fff]'
                                            }`}>
                                        {wishlisted ? '🎯' : '＋'} {wishlisted ? 'Wishlisted' : 'Wishlist'}
                                    </button>
                                )}

                                {/* Add to List */}
                                {user && (
                                    <button onClick={handleOpenListModal}
                                        className="px-4 py-2 border border-white/15 text-[#a0a0b8]
                                                   font-mono text-xs rounded hover:border-[#c8ff57]
                                                   hover:text-[#c8ff57] transition-all flex items-center gap-1.5">
                                        📋 Add to List
                                    </button>
                                )}

                                {/* Share */}
                                <button
                                    onClick={() => navigator.clipboard.writeText(window.location.href)}
                                    className="px-4 py-2 border border-white/15 text-[#a0a0b8]
                                               font-mono text-xs rounded hover:border-[#c8ff57]
                                               hover:text-[#c8ff57] transition-all">
                                    ↗ Share
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
                        {['overview', 'reviews'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`font-mono text-xs uppercase tracking-widest
                                           py-4 border-b-2 transition-all
                                           ${activeTab === tab
                                        ? 'border-[#c8ff57] text-[#c8ff57]'
                                        : 'border-transparent text-[#7a7a90] hover:text-white'
                                    }`}>
                                {tab}
                                {tab === 'reviews' && reviews.length > 0 && (
                                    <span className="ml-1.5 opacity-60">({reviews.length})</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══ MAIN CONTENT ══ */}
            <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">

                    {/* ── Left Column ── */}
                    <div className="flex flex-col gap-6">

                        {activeTab === 'overview' && (
                            <>
                                {summaryText && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase
                                                        tracking-widest mb-4">About</div>
                                        <p className="text-[#c8c8d8] text-sm leading-relaxed">
                                            {displayText}
                                        </p>
                                        {isLong && (
                                            <button onClick={() => setExpanded(!expanded)}
                                                className="mt-3 font-mono text-xs text-[#c8ff57]
                                                           hover:underline transition-all">
                                                {expanded ? 'Show less ↑' : 'Read more ↓'}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {allTags.length > 0 && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase
                                                        tracking-widest mb-4">Tags</div>
                                        <div className="flex flex-wrap gap-2">
                                            {allTags.map(tag => (
                                                <span key={tag}
                                                    className="font-mono text-[10px] uppercase tracking-wider
                                                               px-3 py-1.5 border border-[#2a2a35] text-[#7a7a90]
                                                               rounded hover:border-[#c8ff57] hover:text-[#c8ff57]
                                                               transition-all cursor-default">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {game.screenshots?.length > 0 && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase
                                                        tracking-widest mb-4">Screenshots</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {game.screenshots.slice(0, 4).map((url, i) => (
                                                <img key={i} src={url} alt={`Screenshot ${i + 1}`}
                                                    className="w-full rounded-lg object-cover h-32" />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'reviews' && (
                            <div className="flex flex-col gap-4">
                                {user && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                                        <div className="font-mono text-xs text-[#7a7a90] uppercase
                                                        tracking-widest mb-4">
                                            {existingReview ? 'Edit Your Review' : 'Write a Review'}
                                            <span className="ml-2 text-[#c8ff57] normal-case">
                                                {!existingReview && '· +1 XP'}
                                            </span>
                                        </div>
                                        <textarea value={myReview}
                                            onChange={e => setMyReview(e.target.value)}
                                            placeholder="Share your thoughts on this game..."
                                            rows={4}
                                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                                       px-3 py-2.5 text-sm text-white resize-none mb-3
                                                       focus:outline-none focus:border-[#c8ff57]
                                                       placeholder:text-[#7a7a90] transition-colors" />
                                        <div className="flex items-center gap-3 mb-4">
                                            <label className="font-mono text-[10px] text-[#7a7a90]
                      uppercase tracking-wider w-12 flex-shrink-0">Rating</label>
                                            <input type="number" value={reviewRating}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value)
                                                    if (isNaN(val)) setReviewRating('')
                                                    else setReviewRating(Math.min(10, Math.max(0, val)))
                                                }}
                                                placeholder="0–10" min="0" max="10" step="0.5"
                                                className="w-24 bg-[#18181f] border border-[#2a2a35] text-white
               font-mono text-xs rounded px-3 py-2
               focus:outline-none focus:border-[#c8ff57] transition-all" />
                                        </div>
                                        <button onClick={handleSubmitReview}
                                            disabled={!myReview.trim() || submittingReview}
                                            className={`px-5 py-2.5 font-bold text-xs font-mono uppercase
                                                       tracking-wider rounded transition-all
                                                       ${reviewSaved
                                                    ? 'bg-[#5c9fff] text-white'
                                                    : myReview.trim()
                                                        ? 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e]'
                                                        : 'bg-[#2a2a35] text-[#7a7a90] cursor-not-allowed'
                                                }`}>
                                            {submittingReview ? 'Posting...' : reviewSaved ? '✓ Posted!' : existingReview ? 'Update Review' : 'Post Review'}
                                        </button>
                                    </div>
                                )}

                                {!user && (
                                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5
                                                    flex items-center gap-4">
                                        <div className="text-2xl">✍️</div>
                                        <div>
                                            <div className="text-white font-semibold text-sm">
                                                Want to write a review?
                                            </div>
                                            <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5">
                                                <Link to="/login" className="text-[#c8ff57] hover:underline">
                                                    Login
                                                </Link>{' '}
                                                to share your thoughts and earn XP
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {otherReviews.length > 0 ? (
                                    otherReviews.map(review => (
                                        <div key={review._id}
                                            className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-8 h-8 rounded-full bg-[#2a2a35]
                                                                flex items-center justify-center text-sm">
                                                    {review.userId?.badge || '🎮'}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-semibold text-sm">
                                                            {review.userId?.username || 'User'}
                                                        </span>
                                                        <span className="font-mono text-[9px] text-[#7a7a90]
                                                                        border border-[#2a2a35] rounded px-1.5 py-0.5">
                                                            Lv.{review.userId?.level || 1}
                                                        </span>
                                                    </div>
                                                    <div className="font-mono text-[9px] text-[#7a7a90] mt-0.5">
                                                        {new Date(review.createdAt).toLocaleDateString('en-US', {
                                                            month: 'short', day: 'numeric', year: 'numeric'
                                                        })}
                                                    </div>
                                                </div>
                                                {review.rating > 0 && (
                                                    <div className="ml-auto font-black text-xl text-[#c8ff57]"
                                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                        {review.rating}
                                                        <small className="font-mono text-[9px] text-[#7a7a90] font-normal">/10</small>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[#c8c8d8] text-sm leading-relaxed">
                                                {review.review}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    !user || existingReview ? null : (
                                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                                            <div className="text-4xl">💬</div>
                                            <div className="text-[#7a7a90] font-mono text-sm">
                                                No reviews yet. Be the first!
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Right Column ── */}
                    <div className="flex flex-col gap-6">

                        {/* Game Info */}
                        <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                            <div className="font-mono text-xs text-[#7a7a90] uppercase
                                            tracking-widest mb-4">Game Info</div>
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
                                        <span className="font-mono text-[10px] text-[#7a7a90]
                                                         uppercase tracking-wider flex-shrink-0">
                                            {item.label}
                                        </span>
                                        <span className="font-mono text-[11px] text-white text-right">
                                            {item.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Platforms */}
                        {game.platforms?.length > 0 && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase
                                                tracking-widest mb-4">Platforms</div>
                                <div className="flex flex-wrap gap-2">
                                    {game.platforms.map(p => (
                                        <span key={p}
                                            className="font-mono text-[10px] uppercase tracking-wider
                                                       px-2.5 py-1 bg-[#2a2a35] text-[#7a7a90] rounded">
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Similar Games */}
                        {game.similarGames?.length > 0 && (
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                                <div className="font-mono text-xs text-[#7a7a90] uppercase
                                                tracking-widest mb-4">Similar Games</div>
                                <div className="flex flex-col gap-3">
                                    {game.similarGames.map(sg => (
                                        <Link key={sg.id} to={`/game/${sg.id}`}
                                            className="flex items-center gap-3
                                                       hover:opacity-80 transition-opacity group">
                                            {sg.cover ? (
                                                <img src={sg.cover} alt={sg.title}
                                                    className="w-10 h-14 object-cover rounded flex-shrink-0" />
                                            ) : (
                                                <div className="w-10 h-14 bg-[#2a2a35] rounded flex-shrink-0
                                                                flex items-center justify-center text-sm">🎮</div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white text-xs font-semibold truncate
                                                                group-hover:text-[#c8ff57] transition-colors">
                                                    {sg.title}
                                                </div>
                                                <div className="font-mono text-[9px] text-[#7a7a90] mt-1">
                                                    View details
                                                </div>
                                            </div>
                                            {sg.rating && (
                                                <div className="font-black text-lg text-[#c8ff57] flex-shrink-0"
                                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                                    {sg.rating}
                                                </div>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* ══ ADD TO LIBRARY MODAL ══ */}
            {showAddModal && (
                <AddGameModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={async (formData) => {
                        try {
                            if (myGame) {
                                await updateGame(myGame._id, formData)
                            } else {
                                await addGame(formData)
                            }
                            setShowAddModal(false)
                            return { success: true }
                        } catch (err) {
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
                />
            )}

            {/* ══ ADD TO LIST MODAL ══ */}
            {showListModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50
                                flex items-center justify-center p-4"
                    onClick={e => e.target === e.currentTarget && setShowListModal(false)}>
                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg w-full max-w-sm">

                        <div className="flex items-center justify-between p-5 border-b border-[#2a2a35]">
                            <div>
                                <div className="font-black text-lg text-white tracking-widest uppercase"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    Add to List
                                </div>
                                <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5 truncate max-w-[220px]">
                                    {game.title}
                                </div>
                            </div>
                            <button onClick={() => setShowListModal(false)}
                                className="text-[#7a7a90] hover:text-white transition-colors text-xl">
                                ✕
                            </button>
                        </div>

                        <div className="p-5">
                            {loadingLists ? (
                                <div className="text-center py-8 font-mono text-xs text-[#7a7a90]">
                                    Loading lists...
                                </div>
                            ) : customLists.length === 0 ? (
                                <div className="flex flex-col items-center gap-3 py-8">
                                    <div className="text-3xl">📋</div>
                                    <div className="font-mono text-xs text-[#7a7a90] text-center">
                                        No custom lists yet.
                                    </div>
                                    <button onClick={() => { setShowListModal(false); navigate('/lists') }}
                                        className="px-4 py-2 bg-[#c8ff57] text-black font-bold
                                                   text-xs rounded hover:bg-[#d4ff6e] transition-all">
                                        Create a List →
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {customLists.map(list => (
                                        <button key={list._id}
                                            onClick={() => handleAddToList(list._id, list.name)}
                                            className="flex items-center gap-3 p-3 rounded-lg
                                                       border border-[#2a2a35] hover:border-[#c8ff57]
                                                       hover:bg-[#c8ff57]/05 transition-all text-left group">
                                            <div className="w-8 h-8 rounded bg-[#c8ff57]/15
                                                            flex items-center justify-center text-sm flex-shrink-0">
                                                📋
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-semibold text-sm truncate
                                                                group-hover:text-[#c8ff57] transition-colors">
                                                    {list.name}
                                                </div>
                                                <div className="font-mono text-[9px] text-[#7a7a90] mt-0.5">
                                                    {list.games?.length || 0} games
                                                    · {list.isPublic ? 'Public' : 'Private'}
                                                </div>
                                            </div>
                                            <span className="font-mono text-[10px] text-[#c8ff57]
                                                             opacity-0 group-hover:opacity-100 transition-opacity">
                                                + Add
                                            </span>
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