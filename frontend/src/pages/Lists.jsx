import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { invalidateCache } from '../utils/cache'
import { Search as SearchIcon, X, Check, Loader2, List, Trash2, Heart, Target, Sparkles, Flame, Star, Rocket, Gamepad2, Diamond, Crown, Joystick } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 12

const MAX_CUSTOM_LISTS = 2

// ── Pure helpers (defined outside components — never recreated) ───────────────
const filterByQuery = (items, query, key = 'gameTitle') => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(item => item[key]?.toLowerCase().includes(q))
}

const paginate = (items, page) =>
    items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

const totalPages = (items) => Math.max(1, Math.ceil(items.length / PAGE_SIZE))

// ── Shared sub-components ─────────────────────────────────────────────────────

function SearchBar({ value, onChange, placeholder = 'Search...' }) {
    return (
        <div className="relative flex-1 group">
            <SearchIcon size={16} strokeWidth={2.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a90] z-10 transition-colors pointer-events-none" />
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-[#111118]/80 backdrop-blur-sm border border-[#2a2a35] rounded-xl
                           px-3 py-2.5 pl-10 text-sm text-white font-mono
                           focus:outline-none focus:border-[#c8ff57]/50
                           placeholder:text-[#7a7a90] transition-all shadow-sm focus:shadow-[#c8ff57]/5"
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7a7a90] hover:text-[#ff5c5c] transition-colors"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    )
}

function Pagination({ currentPage, total, onPageChange }) {
    const pages = totalPages({ length: total })
    if (pages <= 1) return null

    const getPageNumbers = () => {
        if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
        const left = Math.max(currentPage - 1, 1)
        const right = Math.min(currentPage + 1, pages)
        const showLeft = left > 3
        const showRight = right < pages - 2
        if (!showLeft && showRight) return [...Array.from({ length: 5 }, (_, i) => i + 1), '...', pages]
        if (showLeft && !showRight) return [1, '...', ...Array.from({ length: 5 }, (_, i) => pages - 4 + i)]
        return [1, '...', left, currentPage, right, '...', pages]
    }

    const nums = getPageNumbers()
    const base = `flex items-center justify-center h-9 px-3 font-mono text-sm rounded border transition-all duration-150`
    const inactive = `text-[#7a7a90] border-[#2a2a35] bg-transparent hover:text-white hover:border-[#7a7a90]`
    const active = `text-black bg-[#c8ff57] border-[#c8ff57] font-bold`
    const disabled = `text-[#3a3a50] border-[#1e1e28] bg-transparent cursor-not-allowed`
    const nav = `text-[#7a7a90] border-[#2a2a35] bg-transparent hover:text-white hover:border-[#7a7a90] px-4`

    return (
        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-[#2a2a35] flex-wrap">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
                className={`${base} ${currentPage === 1 ? disabled : nav}`}>← Prev</button>

            {nums.map((n, i) => n === '...'
                ? <span key={`d${i}`} className="font-mono text-sm text-[#3a3a50] px-1 select-none">...</span>
                : <button key={n} onClick={() => onPageChange(n)}
                    className={`${base} min-w-[36px] ${n === currentPage ? active : inactive}`}>{n}</button>
            )}

            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === pages}
                className={`${base} ${currentPage === pages ? disabled : nav}`}>Next →</button>
        </div>
    )
}

function GameGrid({ games, onRemove, removeLabel = '✕', navigate }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {games.map(game => (
                <div key={game.igdbId ?? game._id} className="relative group">
                    <div
                        onClick={() => game.igdbId && navigate(`/game/${game.igdbId}`)}
                        className="bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden
                                   hover:border-[#c8ff57]/50 transition-all cursor-pointer"
                    >
                        {game.gameCover ? (
                            <img src={game.gameCover.replace('t_cover_small', 't_cover_big').replace('t_thumb', 't_cover_big')} alt={game.gameTitle}
                                loading="lazy"
                                className="w-full h-[140px] object-cover" />
                        ) : (
                            <div className="w-full h-[140px] bg-[#18181f] flex items-center justify-center text-3xl">🎮</div>
                        )}
                        <div className="p-2 text-center">
                            <div className="text-white font-semibold text-[10px] leading-tight line-clamp-2 h-[28px]">{game.gameTitle}</div>
                            {game.releaseYear && <div className="font-mono text-[8px] text-[#7a7a90] mt-1">{game.releaseYear}</div>}
                        </div>
                    </div>
                    {onRemove && (
                        <button
                            onClick={() => onRemove(game.igdbId)}
                            className="absolute top-1 right-1 w-6 h-6 bg-[#ff5c5c] rounded-full text-white
                                       text-[10px] hidden group-hover:flex items-center justify-center font-bold"
                        >{removeLabel}</button>
                    )}
                </div>
            ))}
        </div>
    )
}

function EmptyState({ icon, text }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-4xl">{icon}</div>
            <div className="text-[#7a7a90] font-mono text-sm text-center">{text}</div>
        </div>
    )
}

// ── ListDetail ────────────────────────────────────────────────────────────────
function ListDetail({ list, onBack, onUpdate, showToast, deleteConfirmGame, setDeleteConfirmGame }) {
    const navigate = useNavigate()
    const [editMode, setEditMode] = useState(false)
    const [editForm, setEditForm] = useState({ name: list.name, description: list.description || '', isPublic: list.isPublic })
    const [saving, setSaving] = useState(false)
    const [showAddGame, setShowAddGame] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [currentList, setCurrentList] = useState(list)
    const [loadingGames, setLoadingGames] = useState(false)

    // Search + pagination within the list's existing games
    const [listSearch, setListSearch] = useState('')
    const [listPage, setListPage] = useState(1)

    // Fetch full list content on mount if it's only a preview
    useEffect(() => {
        const loadFull = async () => {
            if (list.gameCount > (list.games?.length || 0)) {
                setLoadingGames(true)
                try {
                    const res = await api.get(`/lists/custom/${list._id}/game`)
                    if (res.data.success) {
                        setCurrentList(res.data.list)
                    }
                } catch { showToast('Failed to load full list', 'error') }
                finally { setLoadingGames(false) }
            } else {
                setCurrentList(list)
            }
        }
        loadFull()
    }, [list, showToast])

    // Reset page when search changes
    useEffect(() => { setListPage(1) }, [listSearch])

    const filteredGames = useMemo(
        () => filterByQuery(currentList.games || [], listSearch),
        [currentList.games, listSearch]
    )
    const pagedGames = useMemo(() => paginate(filteredGames, listPage), [filteredGames, listPage])

    const handleSaveEdit = useCallback(async () => {
        if (!editForm.name.trim()) return
        setSaving(true)
        try {
            const res = await api.put(`/lists/custom/${currentList._id}`, editForm)
            if (res.data.success) {
                setCurrentList(prev => ({ ...prev, ...editForm }))
                setEditMode(false)
                showToast('List updated!')
                onUpdate()
            }
        } catch { showToast('Failed to update list', 'error') }
        finally { setSaving(false) }
    }, [editForm, currentList._id, showToast, onUpdate])

    const handleRemoveGame = useCallback(async () => {
        if (!deleteConfirmGame) return
        const { igdbId } = deleteConfirmGame
        try {
            await api.put(`/lists/custom/${currentList._id}/game`, { igdbId, action: 'remove' })
            setCurrentList(prev => ({ ...prev, games: prev.games.filter(g => g.igdbId !== igdbId) }))
            showToast('Game removed')
            onUpdate()
            invalidateCache('lists_')
        } catch { showToast('Failed to remove game', 'error') }
        finally { setDeleteConfirmGame(null) }
    }, [currentList._id, deleteConfirmGame, showToast, onUpdate, setDeleteConfirmGame])

    // Debounced IGDB search
    const searchTimer = useMemo(() => ({ id: null }), [])
    const handleSearchGames = useCallback((q) => {
        setSearchQuery(q)
        clearTimeout(searchTimer.id)
        if (q.trim().length < 2) { setSearchResults([]); return }
        searchTimer.id = setTimeout(async () => {
            setSearching(true)
            try {
                const res = await api.get(`/igdb/search?q=${encodeURIComponent(q)}`)
                const alreadyInList = new Set(currentList.games.map(g => String(g.igdbId)))
                setSearchResults(
                    (res.data.games || [])
                        .map(g => ({ igdbId: g.igdbId, gameTitle: g.title, gameCover: g.cover }))
                        .filter(g => !alreadyInList.has(String(g.igdbId)))
                )
            } catch { setSearchResults([]) }
            finally { setSearching(false) }
        }, 300)
    }, [currentList.games, searchTimer])

    const handleAddGame = useCallback(async (game) => {
        // Optimistic update
        setCurrentList(prev => ({ ...prev, games: [...prev.games, game] }))
        setSearchResults(prev => prev.filter(g => g.igdbId !== game.igdbId))
        showToast('Game added!')

        try {
            await api.put(`/lists/custom/${currentList._id}/game`, {
                igdbId: game.igdbId, gameTitle: game.gameTitle,
                gameCover: game.gameCover, action: 'add'
            })
            onUpdate()
            invalidateCache('lists_')
        } catch { 
            // Rollback on failure
            setCurrentList(prev => ({ ...prev, games: prev.games.filter(g => g.igdbId !== game.igdbId) }))
            showToast('Failed to add game', 'error') 
        }
    }, [currentList._id, showToast, onUpdate])

    return (
        <div className="flex flex-col gap-4">
            <button onClick={onBack}
                className="text-[#7a7a90] hover:text-[#c8ff57] transition-colors font-mono text-xs flex items-center gap-1 mb-2">
                ← Back
            </button>

            {/* List Header */}
            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                {editMode ? (
                    <div className="flex flex-col gap-3">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="font-mono text-[9px] text-[#7a7a90] uppercase tracking-widest">Name</label>
                                <span className={`font-mono text-[9px] ${editForm.name.length >= 50 ? 'text-[#ff5c5c]' : 'text-[#7a7a90]'}`}>{editForm.name.length}/50</span>
                            </div>
                            <input type="text" value={editForm.name}
                                maxLength={50}
                                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white
                                           focus:outline-none focus:border-[#c8ff57] placeholder:text-[#7a7a90]"
                                placeholder="List name" />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="font-mono text-[9px] text-[#7a7a90] uppercase tracking-widest">Description</label>
                                <span className={`font-mono text-[9px] ${editForm.description.length >= 200 ? 'text-[#ff5c5c]' : 'text-[#7a7a90]'}`}>{editForm.description.length}/200</span>
                            </div>
                            <textarea value={editForm.description} rows={2}
                                maxLength={200}
                                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                                className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white resize-none
                                           focus:outline-none focus:border-[#c8ff57] placeholder:text-[#7a7a90]"
                                placeholder="Description (optional)" />
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setEditForm(p => ({ ...p, isPublic: !p.isPublic }))}
                                className={`w-10 h-5 rounded-full transition-all flex-shrink-0 ${editForm.isPublic ? 'bg-[#c8ff57]' : 'bg-[#2a2a35]'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white transition-all mx-0.5 ${editForm.isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                            <span className="font-mono text-xs text-[#7a7a90]">{editForm.isPublic ? 'Public' : 'Private'}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSaveEdit} disabled={saving}
                                className="px-4 py-2 bg-[#c8ff57] text-black font-bold text-xs rounded hover:bg-[#d4ff6e] transition-all disabled:opacity-40">
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button onClick={() => setEditMode(false)}
                                className="px-4 py-2 border border-[#2a2a35] text-[#7a7a90] font-mono text-xs rounded hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 min-w-0">
                            <div className="w-12 h-12 rounded-lg bg-[#c8ff57]/15 flex items-center justify-center text-2xl flex-shrink-0">📋</div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="font-black text-xl text-white tracking-widest uppercase break-words overflow-hidden"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{currentList.name}</h2>
                                    <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm flex-shrink-0
                                                     ${currentList.isPublic ? 'bg-[#c8ff57]/15 text-[#c8ff57]' : 'bg-[#2a2a35] text-[#7a7a90]'}`}>
                                        {currentList.isPublic ? 'Public' : 'Private'}
                                    </span>
                                </div>
                                {currentList.description && (
                                    <p className="text-[#a0a0b8] font-mono text-xs leading-relaxed max-w-2xl break-words whitespace-pre-wrap mt-1">{currentList.description}</p>
                                )}
                                <div className="font-mono text-[10px] text-[#7a7a90] mt-1">{currentList.games?.length || 0} games</div>
                            </div>
                        </div>
                        <button onClick={() => setEditMode(true)}
                            className="text-[#7a7a90] hover:text-[#c8ff57] transition-colors font-mono text-xs border border-[#2a2a35]
                                       hover:border-[#c8ff57] rounded px-3 py-1.5 flex-shrink-0">
                            ✏ Edit
                        </button>
                    </div>
                )}
            </div>

            {/* Add Games */}
            <button onClick={() => setShowAddGame(v => !v)}
                className="w-full py-3 border border-dashed border-[#c8ff57]/40 text-[#c8ff57]
                           font-mono text-xs rounded-lg hover:border-[#c8ff57] hover:bg-[#c8ff57]/05
                           transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> {showAddGame ? 'Close Search' : 'Add Games'}
            </button>

            {showAddGame && (
                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-4 flex flex-col gap-3">
                    <div className="mb-1">
                        <SearchBar
                            value={searchQuery}
                            onChange={handleSearchGames}
                            placeholder="Search in Database..."
                        />
                    </div>
                    {searching && <div className="font-mono text-[10px] text-[#7a7a90]">Searching...</div>}
                    {!searching && searchResults.length > 0 && (
                        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                            {searchResults.map(game => (
                                <div key={game.igdbId}
                                    className="flex items-center gap-3 p-2 bg-[#18181f] border border-[#2a2a35] rounded-lg hover:border-[#c8ff57]/30 transition-all">
                                    {game.gameCover
                                        ? <img src={game.gameCover} alt={game.gameTitle} loading="lazy" className="w-10 h-14 object-cover rounded" />
                                        : <div className="w-10 h-14 bg-[#2a2a35] rounded flex items-center justify-center text-lg">🎮</div>
                                    }
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white text-xs font-semibold truncate">{game.gameTitle}</div>
                                    </div>
                                    <button onClick={() => handleAddGame(game)}
                                        className="px-3 py-1.5 bg-[#c8ff57] text-black font-bold text-[10px] rounded hover:bg-[#d4ff6e] transition-all flex-shrink-0">
                                        + Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                        <div className="font-mono text-[10px] text-[#7a7a90]">No results found.</div>
                    )}
                </div>
            )}

            {/* Games in list — search + pagination */}
            {loadingGames ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="animate-spin text-[#c8ff57]" />
                    <div className="text-[#7a7a90] font-mono text-sm">Loading full list...</div>
                </div>
            ) : (currentList.games?.length > 0) ? (
                <>
                    <div className="mb-4">
                        <SearchBar
                            value={listSearch}
                            onChange={setListSearch}
                            placeholder="Search in this list..."
                        />
                    </div>
                    {filteredGames.length > 0 ? (
                        <>
                            <GameGrid games={pagedGames} onRemove={(igdbId) => setDeleteConfirmGame({ igdbId, context: 'custom' })} navigate={navigate} />
                            <Pagination
                                currentPage={listPage}
                                total={filteredGames.length}
                                onPageChange={setListPage}
                            />
                        </>
                    ) : (
                        <EmptyState icon={<SearchIcon size={40} className="text-[#2a2a35]" strokeWidth={1} />} text={`No games match "${listSearch}"`} />
                    )}
                </>
            ) : (
                <EmptyState icon="📋" text='No games in this list yet. Use "Add Games" above.' />
            )}
        </div>
    )
}

// ── Main Lists ────────────────────────────────────────────────────────────────
function Lists() {
    const { user } = useAuth()
    const navigate = useNavigate()

    const [activeTab, setActiveTab] = useState('lists')
    const [selectedListId, setSelectedListId] = useState(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [createError, setCreateError] = useState('')
    const [toast, setToast] = useState(null)

    // Data for tabs
    const [fullLikes, setFullLikes] = useState(null)
    const [fullWish, setFullWish] = useState(null)
    const [loadingTab, setLoadingTab] = useState(false)

    // Per-tab search + pagination state
    const [likedSearch, setLikedSearch] = useState('')
    const [likedPage, setLikedPage] = useState(1)
    const [wishSearch, setWishSearch] = useState('')
    const [wishPage, setWishPage] = useState(1)

    // Reset pages on search change
    useEffect(() => { setLikedPage(1) }, [likedSearch])
    useEffect(() => { setWishPage(1) }, [wishSearch])

    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }, [])

    const userId = user?.id || user?._id
    const { data: listBundle, loading, refetch: refetchLists, setData: setListBundle } = useCachedFetch(
        userId ? `lists_${userId}` : null,
        userId ? '/lists/me' : null,
        { enabled: !!userId, ttl: 60 * 1000 } 
    )

    const fetchData = useCallback(async (silent = true) => {
        invalidateCache(userId ? `lists_${userId}` : '')
        // Reset full tab data to force fresh fetch
        setFullLikes(null)
        setFullWish(null)
        await refetchLists(silent)
    }, [userId, refetchLists])

    const { 
        customLists = [], 
        likesCount = 0, 
        wishlistCount = 0, 
        likesPreview = [], 
        wishlistPreview = [], 
        user: userData 
    } = listBundle || {}

    const selectedList = useMemo(() => 
        selectedListId ? customLists.find(l => l._id === selectedListId) : null
    , [selectedListId, customLists])

    const filteredLikes = useMemo(() => filterByQuery(likes, likedSearch), [likes, likedSearch])
    const pagedLikes = useMemo(() => paginate(filteredLikes, likedPage), [filteredLikes, likedPage])

    const filteredWish = useMemo(() => filterByQuery(wishlist, wishSearch), [wishlist, wishSearch])
    const pagedWish = useMemo(() => paginate(filteredWish, wishPage), [filteredWish, wishPage])

    const xp = userData?.xp || 0
    const userLevel = userData?.level || 1
    const canCreateList = userLevel >= 2
    const atListLimit = customLists.length >= MAX_CUSTOM_LISTS

    const handleCreateList = useCallback(async () => {
        if (!createForm.name.trim()) { setCreateError('List name is required'); return }
        setCreating(true)
        setCreateError('')
        try {
            const res = await api.post('/lists/custom', createForm)
            if (res.data.success) {
                showToast('List created!')
                setShowCreateModal(false)
                setCreateForm({ name: '', description: '', isPublic: true })
                fetchData()
            }
        } catch (err) {
            setCreateError(err.response?.data?.message || 'Failed to create list')
        } finally { setCreating(false) }
    }, [createForm, showToast, fetchData])

    const handleDeleteList = useCallback(async (id) => {
        try {
            await api.delete(`/lists/custom/${id}`)
            showToast('List deleted')
            setDeleteConfirmList(null)
            if (selectedListId === id) setSelectedListId(null)
            fetchData()
        } catch { showToast('Failed to delete', 'error') }
    }, [selectedListId, showToast, fetchData])

    const handleRemoveLike = useCallback(async () => {
        if (!deleteConfirmGame) return
        const { igdbId } = deleteConfirmGame
        const previousLikes = likes
        
        try {
            // OPTIMISTIC REMOVE
            setListBundle({ ...listBundle, likes: likes.filter(g => g.igdbId !== igdbId) })
            
            await api.post('/lists/like', { igdbId })
            showToast('Like removed')
            invalidateCache(`game_stats_v2_${igdbId}`)
        } catch { 
            setListBundle({ ...listBundle, likes: previousLikes })
            showToast('Failed to remove like', 'error') 
        }
        finally { setDeleteConfirmGame(null) }
    }, [deleteConfirmGame, listBundle, likes, setListBundle, showToast])

    const handleRemoveWishlist = useCallback(async () => {
        if (!deleteConfirmGame) return
        const { igdbId } = deleteConfirmGame
        const previousWishlist = wishlist
        
        try {
            // OPTIMISTIC REMOVE
            setListBundle({ ...listBundle, wishlist: wishlist.filter(g => g.igdbId !== igdbId) })

            await api.post('/lists/wishlist', { igdbId })
            showToast('Wishlist updated')
            invalidateCache(`game_stats_v2_${igdbId}`)
        } catch { 
            setListBundle({ ...listBundle, wishlist: previousWishlist })
            showToast('Failed to update wishlist', 'error') 
        }
        finally { setDeleteConfirmGame(null) }
    }, [deleteConfirmGame, listBundle, wishlist, setListBundle, showToast])

    const handleRemoveGameFromCustom = useCallback(async () => {
        if (!deleteConfirmGame || !selectedListId) return
        const { igdbId } = deleteConfirmGame
        try {
            await api.put(`/lists/custom/${selectedListId}/game`, { igdbId, action: 'remove' })
            showToast('Game removed')
            fetchData()
        } catch { showToast('Failed to remove game', 'error') }
        finally { setDeleteConfirmGame(null) }
    }, [deleteConfirmGame, selectedListId, showToast, fetchData])

    const handleTabChange = useCallback(async (id) => {
        setActiveTab(id)
        setSelectedListId(null)

        if (id === 'liked' && !fullLikes) {
            setLoadingTab(true)
            try {
                const res = await api.get('/lists/likes')
                if (res.data.success) setFullLikes(res.data.likes)
            } catch { showToast('Failed to load likes', 'error') }
            finally { setLoadingTab(true) }
        }

        if (id === 'wishlist' && !fullWish) {
            setLoadingTab(true)
            try {
                const res = await api.get('/lists/wishlist')
                if (res.data.success) setFullWish(res.data.wishlist)
            } catch { showToast('Failed to load wishlist', 'error') }
            finally { setLoadingTab(false) }
        }
    }, [fullLikes, fullWish, showToast])

    if (!user) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="text-5xl">📋</div>
            <div className="text-white font-black text-2xl tracking-widest uppercase"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Login to view your lists</div>
            <button onClick={() => navigate('/login')}
                className="px-6 py-3 bg-[#c8ff57] text-black font-bold text-sm rounded hover:bg-[#d4ff6e] transition-all">
                Login
            </button>
        </div>
    )

    if (loading && !listBundle) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#7a7a90] font-mono text-sm">Loading...</div>
        </div>
    )

    const tabs = [
        { id: 'lists', label: 'My Lists', count: customLists.length + 2 },
        { id: 'liked', label: 'Liked Games', count: likes.length },
        { id: 'wishlist', label: 'Wishlist', count: wishlist.length },
    ]

    return (
        <div className="max-w-[900px] mx-auto px-5 md:px-10 py-8 md:py-10">

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-2xl font-mono text-sm border shadow-2xl backdrop-blur-xl transition-all animate-in slide-in-from-bottom-5 duration-300 w-[calc(100%-40px)] max-w-[320px] text-center flex items-center justify-center gap-2
                                ${toast.type === 'error'
                        ? 'bg-[#ff5c5c]/20 border-[#ff5c5c]/40 text-[#ff5c5c]'
                        : 'bg-[#c8ff57]/20 border-[#c8ff57]/40 text-[#c8ff57]'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2a2a35]">
                <div className="flex items-center gap-4">
                    <h2 className="font-black text-2xl md:text-3xl tracking-widest uppercase text-white"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {selectedList ? selectedList.name : 'My Lists'}
                    </h2>
                </div>
            </div>

            {/* List detail view */}
            {selectedList && activeTab === 'lists' ? (
                <ListDetail list={selectedList} onBack={() => setSelectedListId(null)} onUpdate={fetchData} showToast={showToast} deleteConfirmGame={deleteConfirmGame} setDeleteConfirmGame={setDeleteConfirmGame} />
            ) : (
                <>
                    {/* Tabs */}
                    <div className="flex gap-2 mb-6 flex-wrap">
                        {tabs.map(tab => (
                            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                                className={`px-4 py-2 rounded font-mono text-xs uppercase tracking-wider border transition-all
                                           ${activeTab === tab.id
                                        ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/06'
                                        : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'}`}>
                                {tab.label}
                                {tab.count !== null && <span className="ml-1.5 opacity-60">({tab.count})</span>}
                            </button>
                        ))}
                    </div>

                    {/* ══ MY LISTS ══ */}
                    {activeTab === 'lists' && (
                        <div className="flex flex-col gap-4">
                            {/* Built-ins */}
                            {[
                                { id: 'liked', icon: '❤️', bg: 'bg-[#ff5c5c]/15', label: 'Liked Games', count: likes.length },
                                { id: 'wishlist', icon: '🎯', bg: 'bg-[#5c9fff]/15', label: 'Wishlist', count: wishlist.length },
                            ].map(b => (
                                <div key={b.id} onClick={() => handleTabChange(b.id)}
                                    className="flex items-center gap-4 p-4 bg-[#111118] border border-[#2a2a35]
                                               rounded-lg hover:border-[#c8ff57]/30 transition-all cursor-pointer">
                                    <div className={`w-12 h-12 rounded-lg ${b.bg} flex items-center justify-center text-2xl flex-shrink-0`}>{b.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white font-semibold text-sm">{b.label}</div>
                                        <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5">{b.count} games · Always available</div>
                                    </div>
                                    <div className="font-mono text-[10px] text-[#2a2a35] uppercase tracking-wider border border-[#2a2a35] rounded px-2 py-1">Built-in</div>
                                </div>
                            ))}

                            {/* Custom lists */}
                            {customLists.map(list => (
                                <div key={list._id}
                                    className="bg-[#111118] border border-[#2a2a35] rounded-lg hover:border-[#c8ff57]/30 transition-all overflow-hidden">
                                    <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setSelectedListId(list._id)}>
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
                                                <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5 line-clamp-2 break-words">{list.description}</div>
                                            )}
                                            <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5">{list.games?.length || 0} games · tap to open</div>
                                        </div>
                                        <button onClick={e => { e.stopPropagation(); setDeleteConfirmList(list._id) }}
                                            className="text-[#7a7a90] hover:text-[#ff5c5c] transition-colors font-mono text-xs px-2 py-1 flex-shrink-0">✕</button>
                                    </div>
                                    {list.games?.length > 0 && (
                                        <div className="px-4 pb-4 flex gap-2 flex-wrap">
                                            {list.games.slice(0, 6).map(game => (
                                                game.gameCover
                                                    ? <img key={game.igdbId} src={game.gameCover} alt={game.gameTitle} loading="lazy"
                                                        onClick={() => setSelectedListId(list._id)}
                                                        className="w-12 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-all" />
                                                    : <div key={game.igdbId} className="w-12 h-16 bg-[#2a2a35] rounded flex items-center justify-center text-sm">🎮</div>
                                            ))}
                                            {list.games.length > 6 && (
                                                <div onClick={() => setSelectedListId(list._id)}
                                                    className="w-12 h-16 bg-[#2a2a35] rounded flex items-center justify-center font-mono text-[10px] text-[#7a7a90] cursor-pointer hover:bg-[#3a3a45] transition-all">
                                                    +{list.games.length - 6}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Create CTA */}
                            {canCreateList ? (
                                atListLimit ? (
                                    <div className="w-full py-4 border border-dashed border-[#2a2a35] rounded-lg flex flex-col items-center gap-2 p-5">
                                        <div className="text-2xl">📋</div>
                                        <div className="text-white font-semibold text-sm">List limit reached</div>
                                        <div className="font-mono text-[10px] text-[#7a7a90] text-center">
                                            You can have up to {MAX_CUSTOM_LISTS} custom lists.
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowCreateModal(true)}
                                        className="w-full py-4 border border-dashed border-[#c8ff57]/40 text-[#c8ff57]
                                                   font-mono text-xs rounded-lg hover:border-[#c8ff57] hover:bg-[#c8ff57]/05
                                                   transition-all flex items-center justify-center gap-2">
                                        <span className="text-lg">+</span> Create Custom List ({customLists.length}/{MAX_CUSTOM_LISTS})
                                    </button>
                                )
                            ) : (
                                <div className="w-full py-5 border border-dashed border-[#2a2a35] rounded-lg flex flex-col items-center gap-2 p-5">
                                    <div className="text-2xl">🔒</div>
                                    <div className="text-white font-semibold text-sm">Custom List Locked</div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] text-center max-w-xs">
                                        Reach <span className="text-[#c8ff57]">Level 2 (5 XP)</span> to unlock.
                                        You have <span className="text-[#c8ff57]">{xp} XP</span> — need <span className="text-[#c8ff57]">{Math.max(0, 5 - xp)} more</span>.
                                    </div>
                                    <div className="w-full max-w-xs bg-[#2a2a35] rounded-full h-1.5 mt-2">
                                        <div className="h-full rounded-full bg-[#c8ff57] transition-all"
                                            style={{ width: `${Math.min((xp / 5) * 100, 100)}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══ LIKED GAMES ══ */}
                    {activeTab === 'liked' && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <Heart size={20} className="text-[#ff5c5c]" />
                                <h3 className="font-black text-lg tracking-widest uppercase text-white"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Liked Games</h3>
                                <div className="w-1.5 h-1.5 rounded-full bg-[#2a2a35] mx-1" />
                                <span className="font-mono text-[10px] text-[#7a7a90] font-bold uppercase tracking-wider">{likesCount} games</span>
                            </div>
                            {loadingTab ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Loader2 className="animate-spin text-[#c8ff57]" />
                                    <div className="text-[#7a7a90] font-mono text-sm">Loading likes...</div>
                                </div>
                            ) : (fullLikes || []).length > 0 || likesPreview.length > 0 ? (
                                <>
                                    <div className="mb-4">
                                        <SearchBar value={likedSearch} onChange={setLikedSearch} placeholder="Search liked games..." />
                                    </div>
                                    {(fullLikes || []).length > 0 ? (
                                        filteredLikes.length > 0 ? (
                                            <>
                                                <GameGrid games={pagedLikes} onRemove={(igdbId) => setDeleteConfirmGame({ igdbId, context: 'like' })} navigate={navigate} />
                                                <Pagination currentPage={likedPage} total={filteredLikes.length} onPageChange={setLikedPage} />
                                            </>
                                        ) : (
                                            <EmptyState icon="🔍" text={`No liked games match "${likedSearch}"`} />
                                        )
                                    ) : (
                                        <GameGrid games={likesPreview} navigate={navigate} />
                                    )}
                                </>
                            ) : (
                                <EmptyState icon="❤️" text="No liked games yet." />
                            )}
                        </div>
                    )}

                    {/* ══ WISHLIST ══ */}
                    {activeTab === 'wishlist' && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <Target size={20} className="text-[#5c9fff]" />
                                <h3 className="font-black text-lg tracking-widest uppercase text-white"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Wishlist</h3>
                                <div className="w-1.5 h-1.5 rounded-full bg-[#2a2a35] mx-1" />
                                <span className="font-mono text-[10px] text-[#7a7a90] font-bold uppercase tracking-wider">{wishlistCount} games</span>
                            </div>
                            {loadingTab ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Loader2 className="animate-spin text-[#c8ff57]" />
                                    <div className="text-[#7a7a90] font-mono text-sm">Loading wishlist...</div>
                                </div>
                            ) : (fullWish || []).length > 0 || wishlistPreview.length > 0 ? (
                                <>
                                    <div className="mb-4">
                                        <SearchBar value={wishSearch} onChange={setWishSearch} placeholder="Search wishlist..." />
                                    </div>
                                    {(fullWish || []).length > 0 ? (
                                        filteredWish.length > 0 ? (
                                            <>
                                                <GameGrid games={pagedWish} onRemove={(igdbId) => setDeleteConfirmGame({ igdbId, context: 'wishlist' })} navigate={navigate} />
                                                <Pagination currentPage={wishPage} total={filteredWish.length} onPageChange={setWishPage} />
                                            </>
                                        ) : (
                                            <EmptyState icon="🔍" text={`No wishlist games match "${wishSearch}"`} />
                                        )
                                    ) : (
                                        <GameGrid games={wishlistPreview} navigate={navigate} />
                                    )}
                                </>
                            ) : (
                                <EmptyState icon="🎯" text="No games wishlisted yet." />
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ══ CREATE LIST MODAL ══ */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}>
                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b border-[#2a2a35]">
                            <h3 className="font-black text-lg tracking-widest uppercase text-white"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Create List</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-[#7a7a90] hover:text-white text-xl">✕</button>
                        </div>
                        <div className="p-5 flex flex-col gap-4">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest">List Name</label>
                                    <span className={`font-mono text-[10px] opacity-60 ${createForm.name.length >= 50 ? 'text-[#ff5c5c]' : 'text-[#7a7a90]'}`}>
                                        {createForm.name.length}/50
                                    </span>
                                </div>
                                <input type="text" placeholder="e.g. My Favorite RPGs"
                                    value={createForm.name}
                                    maxLength={50}
                                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                                    className="w-full bg-[#111118] border border-[#2a2a35] rounded px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c8ff57]" />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest">Description</label>
                                    <span className={`font-mono text-[10px] opacity-60 ${createForm.description.length >= 200 ? 'text-[#ff5c5c]' : 'text-[#7a7a90]'}`}>
                                        {createForm.description.length}/200
                                    </span>
                                </div>
                                <textarea placeholder="Tell us more about this list..."
                                    value={createForm.description}
                                    maxLength={200}
                                    onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                                    className="w-full bg-[#111118] border border-[#2a2a35] rounded px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c8ff57] h-24 resize-none" />
                            </div>

                            <div className="flex items-center gap-3">
                                <button onClick={() => setCreateForm(p => ({ ...p, isPublic: !p.isPublic }))}
                                    className={`w-10 h-5 rounded-full transition-all flex-shrink-0 ${createForm.isPublic ? 'bg-[#c8ff57]' : 'bg-[#2a2a35]'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white transition-all mx-0.5 ${createForm.isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                                <span className="font-mono text-xs text-[#7a7a90]">{createForm.isPublic ? 'Public list' : 'Private list'}</span>
                            </div>
                            {createError && (
                                <div className="font-mono text-xs text-[#ff5c5c] bg-[#ff5c5c]/10 border border-[#ff5c5c]/20 rounded px-3 py-2">
                                    {createError}
                                </div>
                            )}
                            <button onClick={handleCreateList} disabled={creating}
                                className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm rounded
                                           hover:bg-[#d4ff6e] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                {creating ? 'Creating...' : '+ Create List'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ DELETE CONFIRM (LIST) ══ */}
            {deleteConfirmList && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={e => e.target === e.currentTarget && setDeleteConfirmList(null)}>
                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl">
                        <div className="text-center">
                            <div className="text-3xl mb-2">🗑️</div>
                            <div className="text-white font-semibold text-sm">Delete this list?</div>
                            <div className="font-mono text-[10px] text-[#7a7a90] mt-1">This cannot be undone. All games in this list will be un-categorized.</div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirmList(null)}
                                className="flex-1 py-2 border border-[#2a2a35] text-[#7a7a90] font-mono text-xs rounded
                                           hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">Cancel</button>
                            <button onClick={() => handleDeleteList(deleteConfirmList)}
                                className="flex-1 py-2 bg-[#ff5c5c] text-white font-bold text-xs rounded hover:bg-[#ff3333] transition-all shadow-[0_4px_10px_rgba(255,92,92,0.2)]">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ DELETE CONFIRM (GAME FROM LIST) ══ */}
            {deleteConfirmGame && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={e => e.target === e.currentTarget && setDeleteConfirmGame(null)}>
                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl">
                        <div className="text-center">
                            <div className="text-3xl mb-2">🧊</div>
                            <div className="text-white font-semibold text-sm">
                                {deleteConfirmGame.context === 'like' ? 'Remove from Liked?'
                                    : deleteConfirmGame.context === 'wishlist' ? 'Remove from Wishlist?'
                                        : 'Remove from this list?'}
                            </div>
                            <div className="font-mono text-[10px] text-[#7a7a90] mt-1">This will remove the game from your current selection.</div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirmGame(null)}
                                className="flex-1 py-2 border border-[#2a2a35] text-[#7a7a90] font-mono text-xs rounded
                                           hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">Cancel</button>
                            <button onClick={() => {
                                if (deleteConfirmGame.context === 'like') handleRemoveLike()
                                else if (deleteConfirmGame.context === 'wishlist') handleRemoveWishlist()
                                else handleRemoveGameFromCustom()
                            }}
                                className="flex-1 py-2 bg-[#ff5c5c] text-white font-bold text-xs rounded hover:bg-[#ff3333] transition-all shadow-[0_4px_10px_rgba(255,92,92,0.2)]">
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Lists