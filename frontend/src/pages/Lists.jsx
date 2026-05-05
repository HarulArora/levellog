import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { invalidateCache } from '../utils/cache'
import { Search as SearchIcon, X, Loader2, Heart, Target, Gamepad2, Tv, Film, BookOpen, Layers, Star } from 'lucide-react'
import { Helmet } from 'react-helmet-async'

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 12
const MAX_CUSTOM_LISTS = 2

const MEDIA_TYPES = [
    { id: 'game', label: 'Games', icon: Gamepad2, color: '#c8ff57' },
    { id: 'anime', label: 'Anime', icon: Tv, color: '#ff5c5c' },
    { id: 'manga', label: 'Manga', icon: BookOpen, color: '#ffbd5c' },
    { id: 'movie', label: 'Movies', icon: Film, color: '#5c9fff' },
    { id: 'tv', label: 'TV Shows', icon: Layers, color: '#bd5cff' },
]

// ── Pure helpers ──────────────────────────────────────────────────────────────
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
                className="w-full bg-[#111118] border border-[#2a2a35] rounded-xl
                           px-3 py-2.5 pl-10 pr-10 text-sm text-white font-mono
                           focus:outline-none focus:border-[#c8ff57]/50
                           placeholder:text-[#7a7a90] transition-all shadow-sm"
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

function MediaGrid({ items, onRemove, mediaType, navigate }) {
    const getPath = (id) => {
        if (mediaType === 'game') return `/game/${id}`
        return `/${mediaType === 'tv' ? 'tv' : mediaType === 'movie' ? 'movies' : mediaType}/${id}`
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map(item => (
                <div key={item.igdbId ?? item._id} className="relative group">
                    <div
                        onClick={() => item.igdbId && navigate(getPath(item.igdbId))}
                        className="bg-[#111118] border border-[#2a2a35] rounded-xl overflow-hidden
                                   hover:border-[#c8ff57]/50 transition-all cursor-pointer group/card"
                    >
                        <div className="aspect-[3/4] relative overflow-hidden">
                            {item.gameCover ? (
                                <img src={item.gameCover.replace('t_cover_small', 't_cover_big').replace('t_thumb', 't_cover_big')} alt={item.gameTitle}
                                    loading="lazy"
                                    className="w-full h-full object-cover transition-transform group-hover/card:scale-110 duration-500" />
                            ) : (
                                <div className="w-full h-full bg-[#18181f] flex items-center justify-center text-3xl opacity-20">
                                    {mediaType === 'game' ? '🎮' : mediaType === 'anime' ? '⛩️' : '🎬'}
                                </div>
                            )}
                            
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex items-end p-3">
                                <span className="text-white font-black uppercase text-[10px] tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>View Detail</span>
                            </div>
                        </div>
                        <div className="p-3">
                            {(() => {
                                const displayTitle = item.title_english || item.gameTitle
                                return (
                                    <div className="text-white font-bold text-xs leading-tight line-clamp-2 h-[32px] group-hover/card:text-[#c8ff57] transition-colors">
                                        {displayTitle}
                                    </div>
                                )
                            })()}
                            <div className="font-mono text-[9px] text-[#4a4a5e] mt-1 uppercase tracking-wider">{item.genre || mediaType}</div>
                        </div>
                    </div>
                    {onRemove && (
                        <button
                            onClick={() => onRemove(item.igdbId)}
                            className="absolute -top-2 -right-2 w-7 h-7 bg-[#ff5c5c] rounded-full text-white
                                       shadow-lg flex items-center justify-center font-bold scale-0 group-hover:scale-100 transition-transform hover:bg-white hover:text-[#ff5c5c]"
                        ><X size={14} /></button>
                    )}
                </div>
            ))}
        </div>
    )
}

function EmptyState({ icon, title, text }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-20 h-20 bg-[#111118] border border-[#2a2a35] border-dashed rounded-full flex items-center justify-center text-4xl mb-2 opacity-50">
                {icon}
            </div>
            <div>
                <h3 className="text-white font-black text-xl uppercase mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{title}</h3>
                <div className="text-[#7a7a90] font-mono text-sm max-w-xs">{text}</div>
            </div>
        </div>
    )
}

function Toggle({ enabled, onToggle, label, sublabel, color = '#c8ff57' }) {
    return (
        <div className="flex items-center justify-between p-4 bg-[#111118]/50 border border-[#2a2a35] rounded-2xl hover:border-[#3a3a4a] transition-all">
            <div>
                <div className="text-white font-bold text-[10px] uppercase tracking-[0.1em]">{label}</div>
                {sublabel && <div className="text-[#4a4a5e] text-[9px] font-mono uppercase mt-0.5">{sublabel}</div>}
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onToggle() }}
                className={`w-10 h-5 rounded-full relative transition-all duration-300 ${enabled ? '' : 'bg-[#2a2a35]'}`}
                style={{ backgroundColor: enabled ? color : '#2a2a35' }}
            >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 shadow-sm ${enabled ? 'left-6' : 'left-1'}`} />
            </button>
        </div>
    )
}

// ── ListDetail ────────────────────────────────────────────────────────────────
function ListDetail({ list, onBack, onUpdate, showToast, mediaType }) {
    const navigate = useNavigate()
    const [editMode, setEditMode] = useState(false)
    const [editForm, setEditForm] = useState({ name: list.name, description: list.description || '', isPublic: list.isPublic })
    const [saving, setSaving] = useState(false)
    const [showAddMedia, setShowAddMedia] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [currentList, setCurrentList] = useState(list)
    const [loadingMedia, setLoadingMedia] = useState(false)
    const [mediaSearch, setMediaSearch] = useState('')
    const [mediaPage, setMediaPage] = useState(1)

    useEffect(() => {
        const loadFull = async () => {
            if (list.gameCount > (list.games?.length || 0)) {
                setLoadingMedia(true)
                try {
                    const res = await api.get(`/lists/custom/${list._id}/game`)
                    if (res.data.success) setCurrentList(res.data.list)
                } catch { showToast('Failed to load full list', 'error') }
                finally { setLoadingMedia(false) }
            } else {
                setCurrentList(list)
            }
        }
        loadFull()
    }, [list, showToast])

    useEffect(() => { setMediaPage(1) }, [mediaSearch])

    const filteredItems = useMemo(() => filterByQuery(currentList.games || [], mediaSearch), [currentList.games, mediaSearch])
    const pagedItems = useMemo(() => paginate(filteredItems, mediaPage), [filteredItems, mediaPage])

    const handleSaveEdit = async () => {
        if (!editForm.name.trim()) return
        setSaving(true)
        try {
            const res = await api.put(`/lists/custom/${currentList._id}`, editForm)
            if (res.data.success) {
                setCurrentList(prev => ({ ...prev, ...editForm }))
                setEditMode(false)
                showToast('Collection updated!')
                onUpdate()
            }
        } catch { showToast('Failed to update collection', 'error') }
        finally { setSaving(false) }
    }

    const handleRemoveItem = async (id) => {
        try {
            await api.put(`/lists/custom/${currentList._id}/game`, { igdbId: id, action: 'remove' })
            setCurrentList(prev => ({ ...prev, games: prev.games.filter(g => g.igdbId !== id) }))
            showToast('Item removed')
            onUpdate()
        } catch { showToast('Failed to remove item', 'error') }
    }

    const handleSearchMedia = useCallback((q) => {
        setSearchQuery(q)
        if (q.trim().length < 2) { setSearchResults([]); return }
        const timer = setTimeout(async () => {
            setSearching(true)
            try {
                let res;
                if (mediaType === 'game') res = await api.get(`/igdb/search?q=${q}`)
                else if (mediaType === 'anime' || mediaType === 'manga') res = await api.get(`/anime/search?q=${q}&type=${mediaType}`)
                else res = await api.get(`/movies/search?q=${q}&type=${mediaType}`)
                
                const alreadyInList = new Set(currentList.games.map(g => String(g.igdbId)))
                const results = (res.data.games || res.data.results || []).map(g => ({
                    igdbId: g.igdbId || g.externalId || g.id,
                    gameTitle: g.title,
                    title_english: g.title_english,
                    gameCover: g.cover
                }))
                setSearchResults(results.filter(g => !alreadyInList.has(String(g.igdbId))))
            } catch { setSearchResults([]) }
            finally { setSearching(false) }
        }, 500)
        return () => clearTimeout(timer)
    }, [currentList.games, mediaType])

    const handleAddItem = async (item) => {
        try {
            await api.put(`/lists/custom/${currentList._id}/game`, {
                igdbId: item.igdbId, gameTitle: item.gameTitle,
                gameCover: item.gameCover, action: 'add'
            })
            setCurrentList(prev => ({ ...prev, games: [...prev.games, item] }))
            setSearchResults(prev => prev.filter(g => g.igdbId !== item.igdbId))
            showToast('Item added!')
            onUpdate()
        } catch { showToast('Failed to add item', 'error') }
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={onBack} className="text-[#7a7a90] hover:text-[#c8ff57] transition-colors font-mono text-xs flex items-center gap-2 group">
                <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Collections
            </button>

            <div className="bg-[#111118] border border-[#2a2a35] rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-05 pointer-events-none">
                    <Layers size={120} />
                </div>
                {editMode ? (
                    <div className="flex flex-col gap-6 relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest mb-2">Collection Name</label>
                                <input type="text" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                    className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c8ff57]" />
                            </div>
                            <div>
                                <label className="block font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest mb-2">Visibility</label>
                                <Toggle 
                                    enabled={editForm.isPublic} 
                                    onToggle={() => setEditForm(p => ({ ...p, isPublic: !p.isPublic }))}
                                    label={editForm.isPublic ? 'Public' : 'Private'}
                                    sublabel="Anyone can view this list"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest mb-2">Description</label>
                            <textarea value={editForm.description} rows={3} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                                className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c8ff57] resize-none" />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleSaveEdit} disabled={saving} className="flex-1 bg-[#c8ff57] text-black font-black uppercase text-xs tracking-widest py-4 rounded-xl hover:bg-[#d4ff6e] transition-all">
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button onClick={() => setEditMode(false)} className="px-8 border border-[#2a2a35] text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest rounded-xl hover:text-white transition-all">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h2 className="font-black text-4xl text-white uppercase tracking-tight" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{currentList.name}</h2>
                                <span className={`px-2 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider
                                                 ${currentList.isPublic ? 'bg-[#c8ff57]/10 text-[#c8ff57] border border-[#c8ff57]/20' : 'bg-[#2a2a35] text-[#7a7a90]'}`}>
                                    {currentList.isPublic ? 'Public' : 'Private'}
                                </span>
                            </div>
                            <p className="text-[#7a7a90] text-sm max-w-2xl">{currentList.description || 'No description provided.'}</p>
                            <div className="flex items-center gap-4 mt-6">
                                <span className="font-mono text-[10px] text-[#c8ff57] uppercase tracking-widest px-2 py-1 bg-[#c8ff57]/10 rounded border border-[#c8ff57]/20">{currentList.games?.length || 0} items</span>
                                <span className="font-mono text-[10px] text-[#4a4a5e] uppercase tracking-widest">Created {new Date(currentList.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <button onClick={() => setEditMode(true)} className="px-6 py-3 border border-[#2a2a35] text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest rounded-xl hover:border-[#c8ff57] hover:text-white transition-all">Edit Details</button>
                    </div>
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <SearchBar value={mediaSearch} onChange={setMediaSearch} placeholder={`Search in this ${mediaType} list...`} />
                <button onClick={() => setShowAddMedia(v => !v)} className={`px-6 py-3 rounded-xl font-mono text-[10px] uppercase tracking-widest border transition-all ${showAddMedia ? 'bg-[#ff5c5c]/10 border-[#ff5c5c]/20 text-[#ff5c5c]' : 'bg-[#c8ff57]/10 border-[#c8ff57]/20 text-[#c8ff57]'}`}>
                    {showAddMedia ? 'Close Search' : `Add ${mediaType === 'game' ? 'Game' : 'Media'}`}
                </button>
            </div>

            {showAddMedia && (
                <div className="bg-[#111118] border border-[#2a2a35] rounded-2xl p-6 animate-in zoom-in-95 duration-200">
                    <input type="text" value={searchQuery} onChange={e => handleSearchMedia(e.target.value)} placeholder={`Search ${mediaType} database...`} className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#c8ff57] mb-4" />
                    {searching ? <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-[#c8ff57]" /></div> : (
                        <div className="max-h-[350px] overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-2">
                            {searchResults.length > 0 ? searchResults.map(item => (
                                <div key={item.igdbId} className="flex items-center gap-4 p-3 bg-[#0d0d14] border border-[#2a2a35] rounded-xl hover:border-[#c8ff57]/30 transition-all">
                                    <img src={item.gameCover} alt="" className="w-12 h-16 object-cover rounded-lg flex-shrink-0 shadow-lg" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white text-sm font-bold truncate tracking-wide">{item.gameTitle}</div>
                                        <div className="text-[#4a4a5e] text-[10px] font-mono uppercase mt-1">Found in database</div>
                                    </div>
                                    <button onClick={() => handleAddItem(item)} className="px-4 py-2 bg-[#c8ff57] text-black font-black uppercase text-[10px] tracking-widest rounded-lg hover:bg-[#d4ff6e] transition-all flex-shrink-0 shadow-md">Add</button>
                                </div>
                            )) : searchQuery.trim().length >= 2 && !searching && (
                                <div className="py-10 text-center font-mono text-[10px] text-[#4a4a5e] uppercase tracking-widest">No results found for "{searchQuery}"</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {loadingMedia ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#c8ff57]" /></div> : (
                <>
                    {filteredItems.length > 0 ? (
                        <>
                            <MediaGrid items={pagedItems} onRemove={handleRemoveItem} mediaType={mediaType} navigate={navigate} />
                            <Pagination currentPage={mediaPage} total={filteredItems.length} onPageChange={setMediaPage} />
                        </>
                    ) : (
                        <EmptyState icon={mediaType === 'game' ? '🎮' : '🎬'} title="Empty Collection" text={`No items found in this ${mediaType} collection.`} />
                    )}
                </>
            )}
        </div>
    )
}

// ── Main Lists ────────────────────────────────────────────────────────────────
function Lists() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    
    const mediaType = searchParams.get('type') || 'game'
    const [activeTab, setActiveTab] = useState('lists')
    const [selectedListId, setSelectedListId] = useState(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [createForm, setCreateForm] = useState({ name: '', description: '', isPublic: true })
    const [creating, setCreating] = useState(false)
    const [toast, setToast] = useState(null)

    const [fullLikes, setFullLikes] = useState(null)
    const [fullWish, setFullWish] = useState(null)
    const [loadingTab, setLoadingTab] = useState(false)

    const [likedSearch, setLikedSearch] = useState('')
    const [likedPage, setLikedPage] = useState(1)
    const [wishSearch, setWishSearch] = useState('')
    const [wishPage, setWishPage] = useState(1)

    useEffect(() => { setLikedPage(1) }, [likedSearch])
    useEffect(() => { setWishPage(1) }, [wishSearch])

    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }, [])

    const userId = user?.id || user?._id
    const { data: listBundle, refetch: refetchLists, setData: setListBundle } = useCachedFetch(
        userId ? `lists_${userId}_${mediaType}` : null,
        userId ? `/lists/me?mediaType=${mediaType}` : null,
        { enabled: !!userId, ttl: 30 * 1000 } 
    )

    const fetchData = useCallback(async (silent = true) => {
        setFullLikes(null)
        setFullWish(null)
        await refetchLists(silent)
    }, [refetchLists])

    useEffect(() => {
        fetchData(false)
        setActiveTab('lists')
        setSelectedListId(null)
    }, [mediaType, fetchData])

    const { customLists = [], likesCount = 0, wishlistCount = 0 } = listBundle || {}

    const selectedList = useMemo(() => selectedListId ? customLists.find(l => l._id === selectedListId) : null, [selectedListId, customLists])
    const filteredLikes = useMemo(() => filterByQuery(fullLikes || [], likedSearch), [fullLikes, likedSearch])
    const pagedLikes = useMemo(() => paginate(filteredLikes, likedPage), [filteredLikes, likedPage])
    const filteredWish = useMemo(() => filterByQuery(fullWish || [], wishSearch), [fullWish, wishSearch])
    const pagedWish = useMemo(() => paginate(filteredWish, wishPage), [filteredWish, wishPage])

    const isWatchlist = mediaType === 'anime' || mediaType === 'movie' || mediaType === 'tv'
    const wishlistLabel = isWatchlist ? 'Watchlist' : 'Wishlist'

    const handleCreateList = async () => {
        if (!createForm.name.trim()) return
        setCreating(true)
        try {
            const res = await api.post('/lists/custom', { ...createForm, mediaType })
            if (res.data.success) {
                showToast('Collection created!')
                setShowCreateModal(false)
                setCreateForm({ name: '', description: '', isPublic: true })
                fetchData()
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to create collection', 'error')
        } finally { setCreating(false) }
    }

    const handleDeleteList = async (id) => {
        if (!window.confirm('Delete this collection?')) return
        try {
            await api.delete(`/lists/custom/${id}`)
            showToast('Collection deleted')
            fetchData()
        } catch { showToast('Failed to delete', 'error') }
    }

    const handleRemoveLike = async (id) => {
        try {
            if (fullLikes) setFullLikes(prev => prev.filter(g => g.igdbId !== id))
            setListBundle(prev => ({ ...prev, likesPreview: prev.likesPreview.filter(g => g.igdbId !== id), likesCount: Math.max(0, prev.likesCount - 1) }))
            await api.post('/lists/like', { igdbId: id, mediaType })
            showToast('Like removed')
            invalidateCache(`stats_${id}_${mediaType}`)
        } catch { showToast('Failed to remove like', 'error'); fetchData() }
    }

    const handleRemoveWishlist = async (id) => {
        try {
            if (fullWish) setFullWish(prev => prev.filter(g => g.igdbId !== id))
            setListBundle(prev => ({ ...prev, wishlistPreview: prev.wishlistPreview.filter(g => g.igdbId !== id), wishlistCount: Math.max(0, prev.wishlistCount - 1) }))
            await api.post('/lists/wishlist', { igdbId: id, mediaType })
            showToast('Wishlist updated')
            invalidateCache(`stats_${id}_${mediaType}`)
        } catch { showToast('Failed to update wishlist', 'error'); fetchData() }
    }

    const handleToggleGlobalPrivacy = async (field, value) => {
        try {
            await api.patch('/auth/privacy-settings', { [field]: value })
            setListBundle(prev => ({
                ...prev,
                user: { ...prev.user, [field]: value }
            }))
            showToast('Privacy updated!')
        } catch {
            showToast('Failed to update privacy', 'error')
        }
    }

    const handleToggleListPrivacy = async (list) => {
        try {
            const newStatus = !list.isPublic
            const res = await api.put(`/lists/custom/${list._id}`, { isPublic: newStatus })
            if (res.data.success) {
                setListBundle(prev => ({
                    ...prev,
                    customLists: prev.customLists.map(l => l._id === list._id ? { ...l, isPublic: newStatus } : l)
                }))
                showToast('Visibility updated')
            }
        } catch { showToast('Failed to update visibility', 'error') }
    }

    const handleTabChange = (id) => {
        setActiveTab(id)
        setSelectedListId(null)
    }

    // Effect to fetch tab-specific data (Likes/Wishlist) when tab changes
    useEffect(() => {
        if (activeTab === 'liked' && !fullLikes) {
            const fetchLikes = async () => {
                setLoadingTab(true)
                try {
                    const res = await api.get(`/lists/likes?mediaType=${mediaType}`)
                    if (res.data.success) {
                        setFullLikes(res.data.likes || [])
                    }
                } catch (err) {
                    console.error('Fetch likes error:', err)
                    showToast('Failed to load likes', 'error')
                } finally {
                    setLoadingTab(false)
                }
            }
            fetchLikes()
        }
        if (activeTab === 'wishlist' && !fullWish) {
            const fetchWish = async () => {
                setLoadingTab(true)
                try {
                    const res = await api.get(`/lists/wishlist?mediaType=${mediaType}`)
                    if (res.data.success) {
                        setFullWish(res.data.wishlist || [])
                    }
                } catch (err) {
                    console.error('Fetch wishlist error:', err)
                    showToast('Failed to load wishlist', 'error')
                } finally {
                    setLoadingTab(false)
                }
            }
            fetchWish()
        }
    }, [activeTab, mediaType, fullLikes, fullWish, showToast])

    if (!user) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-6">
            <div className="w-24 h-24 bg-[#111118] border border-[#2a2a35] rounded-full flex items-center justify-center text-5xl opacity-50 mb-4">📋</div>
            <div>
                <h2 className="text-white font-black text-3xl uppercase mb-2 tracking-tight" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>My Collections</h2>
                <p className="text-[#7a7a90] font-mono text-sm max-w-sm mx-auto mb-8 leading-relaxed">Sign in to organize your games, movies, and anime into custom collections.</p>
                <button onClick={() => navigate('/login')} className="px-10 py-4 bg-[#c8ff57] text-black font-black uppercase text-xs tracking-[0.2em] rounded-xl hover:bg-[#d4ff6e] transition-all shadow-lg">Sign In Now</button>
            </div>
        </div>
    )

    return (
        <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-24 min-h-screen relative">
            <Helmet>
                <title>My Collections | QuestDuck</title>
            </Helmet>

            {/* Media Selector */}
            <div className="flex items-center gap-2 mb-12 overflow-x-auto pb-4 no-scrollbar">
                {MEDIA_TYPES.map(m => (
                    <button
                        key={m.id}
                        onClick={() => setSearchParams({ type: m.id })}
                        className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl border font-mono text-[10px] uppercase tracking-widest transition-all flex-shrink-0
                                   ${mediaType === m.id ? 'bg-white text-black border-white shadow-xl' : 'bg-[#111118] text-[#4a4a5e] border-[#2a2a35] hover:border-[#7a7a90] hover:text-white'}`}
                    >
                        <m.icon size={14} /> {m.label}
                    </button>
                ))}
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
                <div>
                    <h1 className="font-black text-6xl text-white uppercase tracking-tighter" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        MY <span className="text-[#c8ff57]">{MEDIA_TYPES.find(m => m.id === mediaType)?.label}</span>
                    </h1>
                    {customLists.length >= 2 && activeTab === 'lists' && (
                        <div className="font-mono text-[9px] text-[#7a7a90] uppercase tracking-widest mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-500">
                            <div className="w-1 h-1 rounded-full bg-[#c8ff57]" />
                            Max 2 custom collections reached
                        </div>
                    )}
                </div>

                <div className="flex bg-[#111118] border border-[#2a2a35] p-1.5 rounded-2xl shadow-xl">
                    <button onClick={() => handleTabChange('lists')}
                        className={`px-6 py-2.5 rounded-xl font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'lists' ? 'bg-[#2a2a35] text-[#c8ff57] shadow-lg' : 'text-[#4a4a5e] hover:text-white'}`}>
                        Collections
                    </button>
                    <button onClick={() => handleTabChange('liked')}
                        className={`px-6 py-2.5 rounded-xl font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'liked' ? 'bg-[#2a2a35] text-[#ff5c5c] shadow-lg' : 'text-[#4a4a5e] hover:text-white'}`}>
                        Liked
                    </button>
                    <button onClick={() => handleTabChange('wishlist')}
                        className={`px-6 py-2.5 rounded-xl font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'wishlist' ? 'bg-[#2a2a35] text-[#5c9fff] shadow-lg' : 'text-[#4a4a5e] hover:text-white'}`}>
                        {wishlistLabel}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {selectedList ? (
                <ListDetail list={selectedList} mediaType={mediaType} onBack={() => setSelectedListId(null)} onUpdate={fetchData} showToast={showToast} />
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {activeTab === 'lists' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Create Button with Level 2 logic */}
                            {listBundle?.user?.level < 2 ? (
                                <div className="h-56 border-2 border-[#2a2a35] bg-[#111118]/50 rounded-3xl flex flex-col items-center justify-center gap-4 relative group overflow-hidden">
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-10">
                                        <div className="w-12 h-12 bg-[#1a1a25] border border-[#3a3a4a] rounded-full flex items-center justify-center mb-2">
                                            <span className="text-xl">🔒</span>
                                        </div>
                                        <span className="font-mono text-[10px] uppercase tracking-widest text-[#7a7a90]">Reach Level 2 to Unlock</span>
                                    </div>
                                    <Layers size={24} className="text-[#2a2a35]" />
                                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#2a2a35]">Create Collection</span>
                                </div>
                            ) : customLists.length < 2 && (
                                <button 
                                    onClick={() => setShowCreateModal(true)}
                                    className="h-56 border-2 border-dashed border-[#2a2a35] rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-[#c8ff57] hover:bg-[#c8ff57]/05 transition-all group">
                                    <div className="w-14 h-14 bg-[#111118] border border-[#2a2a35] rounded-full flex items-center justify-center group-hover:bg-[#c8ff57] group-hover:text-black transition-all">
                                        <Layers size={24} />
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#4a4a5e] group-hover:text-white">Create New Collection</span>
                                        <span className="font-mono text-[9px] text-[#7a7a90]">{customLists.length}/2 Used</span>
                                    </div>
                                </button>
                            )}

                            {/* Built-ins for quick access */}
                            <div className="flex flex-col gap-3">
                                <div onClick={() => handleTabChange('liked')} className="h-56 bg-[#111118] border border-[#2a2a35] rounded-3xl p-8 relative overflow-hidden cursor-pointer group hover:border-[#ff5c5c]/40 transition-all shadow-lg flex-1">
                                    <div className="absolute -right-4 -bottom-4 text-[#ff5c5c] opacity-05 group-hover:scale-110 transition-transform duration-500"><Heart size={160} /></div>
                                    <div className="relative z-10 flex flex-col h-full">
                                        <h3 className="font-black text-2xl text-white uppercase mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Liked Items</h3>
                                        <p className="text-[#4a4a5e] text-xs font-mono uppercase tracking-widest mb-auto">Quick access to everything you ❤️</p>
                                        <div className="flex items-center justify-between mt-4">
                                            <span className="font-mono text-[10px] text-[#ff5c5c] uppercase tracking-widest">{likesCount} items</span>
                                            <span className="text-[#ff5c5c] opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 font-bold">OPEN →</span>
                                        </div>
                                    </div>
                                </div>
                                <Toggle 
                                    enabled={listBundle?.user?.isLikesPublic}
                                    onToggle={() => handleToggleGlobalPrivacy('isLikesPublic', !listBundle?.user?.isLikesPublic)}
                                    label="Public Likes"
                                    sublabel="Show on profile"
                                    color="#ff5c5c"
                                />
                            </div>

                            <div className="flex flex-col gap-3">
                                    <div onClick={() => handleTabChange('wishlist')} className="h-56 bg-[#111118] border border-[#2a2a35] rounded-3xl p-8 relative overflow-hidden cursor-pointer group hover:border-[#5c9fff]/40 transition-all shadow-lg flex-1">
                                        <div className="absolute -right-4 -bottom-4 text-[#5c9fff] opacity-05 group-hover:scale-110 transition-transform duration-500"><Target size={160} /></div>
                                        <div className="relative z-10 flex flex-col h-full">
                                            <h3 className="font-black text-2xl text-white uppercase mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{wishlistLabel}</h3>
                                            <p className="text-[#4a4a5e] text-xs font-mono uppercase tracking-widest mb-auto">Tracking what's next 🎯</p>
                                            <div className="flex items-center justify-between mt-4">
                                                <span className="font-mono text-[10px] text-[#5c9fff] uppercase tracking-widest">{wishlistCount} items</span>
                                                <span className="text-[#5c9fff] opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 font-bold">OPEN →</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Toggle 
                                        enabled={listBundle?.user?.isWishlistPublic}
                                        onToggle={() => handleToggleGlobalPrivacy('isWishlistPublic', !listBundle?.user?.isWishlistPublic)}
                                        label={`Public ${wishlistLabel}`}
                                        sublabel="Show on profile"
                                        color="#5c9fff"
                                    />
                            </div>

                            {customLists.map(list => (
                                <div key={list._id} onClick={() => setSelectedListId(list._id)}
                                    className="h-56 bg-[#111118] border border-[#2a2a35] rounded-3xl p-8 relative overflow-hidden cursor-pointer group hover:border-[#c8ff57] transition-all shadow-lg">
                                    <div className="absolute -right-4 -bottom-4 text-[#c8ff57] opacity-05 group-hover:scale-110 transition-transform duration-500"><Layers size={160} /></div>
                                    <div className="relative z-10 flex flex-col h-full">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-black text-2xl text-white uppercase truncate group-hover:text-[#c8ff57] transition-colors" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{list.name}</h3>
                                            <div onClick={e => e.stopPropagation()}>
                                                <button 
                                                    onClick={() => handleToggleListPrivacy(list)}
                                                    className={`px-2 py-1 rounded font-mono text-[8px] uppercase tracking-wider transition-all
                                                               ${list.isPublic ? 'bg-[#c8ff57]/10 text-[#c8ff57] border border-[#c8ff57]/20' : 'bg-[#2a2a35] text-[#7a7a90] border border-transparent'}`}>
                                                    {list.isPublic ? 'Public' : 'Private'}
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[#4a4a5e] text-[11px] line-clamp-2 mb-auto leading-relaxed">{list.description || 'Custom collection.'}</p>
                                        <div className="flex items-center justify-between mt-4">
                                            <span className="font-mono text-[10px] text-[#4a4a5e] uppercase tracking-widest">{list.games?.length || 0} items</span>
                                            <div className="flex items-center gap-4">
                                                <button onClick={e => { e.stopPropagation(); handleDeleteList(list._id) }} className="p-2 text-[#4a4a5e] hover:text-[#ff5c5c] transition-colors"><X size={16} /></button>
                                                <span className="text-[#c8ff57] opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 font-bold">OPEN →</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'liked' && (
                        <div>
                            {loadingTab ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#c8ff57]" /></div> : (
                                <>
                                    <div className="flex items-center justify-between mb-8">
                                        <SearchBar value={likedSearch} onChange={setLikedSearch} placeholder={`Search liked ${mediaType}...`} />
                                    </div>
                                    {filteredLikes.length > 0 ? (
                                        <>
                                            <MediaGrid items={pagedLikes} onRemove={handleRemoveLike} mediaType={mediaType} navigate={navigate} />
                                            <Pagination currentPage={likedPage} total={filteredLikes.length} onPageChange={setLikedPage} />
                                        </>
                                    ) : (
                                        <EmptyState icon="❤️" title="No Liked Items" text={`Your favorite ${mediaType} will appear here.` } />
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'wishlist' && (
                        <div>
                            {loadingTab ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#c8ff57]" /></div> : (
                                <>
                                    <div className="flex items-center justify-between mb-8">
                                        <SearchBar value={wishSearch} onChange={setWishSearch} placeholder={`Search ${mediaType} ${wishlistLabel.toLowerCase()}...`} />
                                    </div>
                                    {filteredWish.length > 0 ? (
                                        <>
                                            <MediaGrid items={pagedWish} onRemove={handleRemoveWishlist} mediaType={mediaType} navigate={navigate} />
                                            <Pagination currentPage={wishPage} total={filteredWish.length} onPageChange={setWishPage} />
                                        </>
                                    ) : (
                                        <EmptyState icon="🎯" title={`${wishlistLabel} Empty`} text={`Keep track of ${mediaType} you want to check out later.`} />
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowCreateModal(false)} />
                    <div className="relative bg-[#111118] border border-[#2a2a35] rounded-3xl w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="font-black text-4xl text-white uppercase mb-8 tracking-tight" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Create <span className="text-[#c8ff57]">Collection</span></h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block font-mono text-[10px] text-[#4a4a5e] uppercase tracking-widest mb-3">Collection Name</label>
                                <input autoFocus type="text" placeholder="e.g. Masterpieces" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                                    className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#c8ff57] transition-all" />
                            </div>
                            <div>
                                <label className="block font-mono text-[10px] text-[#4a4a5e] uppercase tracking-widest mb-3">Description (Optional)</label>
                                <textarea placeholder="What's this collection about?" value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} rows={3}
                                    className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#c8ff57] transition-all resize-none" />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button onClick={handleCreateList} disabled={creating || !createForm.name.trim()}
                                    className="flex-1 bg-[#c8ff57] text-black py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-[#d4ff6e] transition-all disabled:opacity-50 shadow-lg">
                                    {creating ? 'Creating...' : 'Create Collection'}
                                </button>
                                <button onClick={() => setShowCreateModal(false)} className="px-8 border border-[#2a2a35] text-[#4a4a5e] rounded-2xl font-mono text-[10px] uppercase tracking-widest hover:text-white transition-all">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] px-8 py-4 rounded-2xl font-mono text-[10px] uppercase tracking-widest border shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-10 duration-500
                                ${toast.type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-500' : 'bg-[#c8ff57]/20 border-[#c8ff57]/40 text-[#c8ff57]'}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    )
}

export default Lists