import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const LEVELS = [
    { level: 1, xpRequired: 0, badge: '🎮', title: 'Newbie' },
    { level: 2, xpRequired: 5, badge: '🕹️', title: 'Gamer' },
    { level: 3, xpRequired: 25, badge: '⭐', title: 'Enthusiast' },
    { level: 4, xpRequired: 60, badge: '🔥', title: 'Veteran' },
    { level: 5, xpRequired: 100, badge: '💎', title: 'Legend' },
    { level: 6, xpRequired: 150, badge: '👑', title: 'Elite' },
    { level: 7, xpRequired: 500, badge: '🚀', title: 'Master' },
    { level: 8, xpRequired: 1000, badge: '🌟', title: 'Immortal' },
]

const getLevelInfo = (xp) => {
    let current = LEVELS[0]
    let next = LEVELS[1]
    for (let i = 0; i < LEVELS.length; i++) {
        if (xp >= LEVELS[i].xpRequired) {
            current = LEVELS[i]
            next = LEVELS[i + 1] || null
        }
    }
    return { current, next }
}

const MAX_CUSTOM_LISTS = 2

// ── List Detail View ──────────────────────────────────────────────────────────
function ListDetail({ list, onBack, onUpdate, showToast }) {
    const navigate = useNavigate()
    const [editMode, setEditMode] = useState(false)
    const [editForm, setEditForm] = useState({ name: list.name, description: list.description || '', isPublic: list.isPublic })
    const [saving, setSaving] = useState(false)
    const [showAddGame, setShowAddGame] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [currentList, setCurrentList] = useState(list)

    // Sync if parent list updates
    useEffect(() => { setCurrentList(list) }, [list])

    const handleSaveEdit = async () => {
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
        } catch {
            showToast('Failed to update list', 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleRemoveGame = async (igdbId) => {
        try {
            await api.put(`/lists/custom/${currentList._id}/game`, { igdbId, action: 'remove' })
            setCurrentList(prev => ({ ...prev, games: prev.games.filter(g => g.igdbId !== igdbId) }))
            showToast('Game removed')
            onUpdate()
        } catch {
            showToast('Failed to remove game', 'error')
        }
    }

    const handleSearchGames = async (q) => {
        setSearchQuery(q)
        if (q.trim().length < 2) { setSearchResults([]); return }
        setSearching(true)
        try {
            // Search from user's library
            const res = await api.get(`/igdb/search?q=${encodeURIComponent(q)}`)
            const alreadyInList = currentList.games.map(g => String(g.igdbId))
            const games = (res.data.games || []).map(g => ({
                igdbId: g.igdbId,
                gameTitle: g.title,
                gameCover: g.cover,
            }))
            setSearchResults(games.filter(g => !alreadyInList.includes(String(g.igdbId))))
        } catch {
            setSearchResults([])
        } finally {
            setSearching(false)
        }
    }

    const handleAddGame = async (game) => {
        try {
            await api.put(`/lists/custom/${currentList._id}/game`, {
                igdbId: game.igdbId,
                gameTitle: game.gameTitle,
                gameCover: game.gameCover,
                action: 'add'
            })
            setCurrentList(prev => ({ ...prev, games: [...prev.games, game] }))
            setSearchResults(prev => prev.filter(g => g.igdbId !== game.igdbId))
            showToast('Game added!')
            onUpdate()
        } catch {
            showToast('Failed to add game', 'error')
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Back + Header */}
            <div className="flex items-center gap-3 mb-2">
                <button onClick={onBack}
                    className="text-[#7a7a90] hover:text-[#c8ff57] transition-colors font-mono text-xs flex items-center gap-1">
                    ← Back
                </button>
            </div>

            {/* List Header Card */}
            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">
                {editMode ? (
                    <div className="flex flex-col gap-3">
                        <input
                            type="text"
                            value={editForm.name}
                            onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white
                                       focus:outline-none focus:border-[#c8ff57] placeholder:text-[#7a7a90]"
                            placeholder="List name"
                        />
                        <textarea
                            value={editForm.description}
                            onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                            rows={2}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white resize-none
                                       focus:outline-none focus:border-[#c8ff57] placeholder:text-[#7a7a90]"
                            placeholder="Description (optional)"
                        />
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
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-lg bg-[#c8ff57]/15 flex items-center justify-center text-2xl flex-shrink-0">📋</div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="font-black text-xl text-white tracking-widest uppercase"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{currentList.name}</h2>
                                    <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm
                                                     ${currentList.isPublic ? 'bg-[#c8ff57]/15 text-[#c8ff57]' : 'bg-[#2a2a35] text-[#7a7a90]'}`}>
                                        {currentList.isPublic ? 'Public' : 'Private'}
                                    </span>
                                </div>
                                {currentList.description && (
                                    <div className="font-mono text-xs text-[#7a7a90] mt-1">{currentList.description}</div>
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

            {/* Add Games Button */}
            <button onClick={() => setShowAddGame(v => !v)}
                className="w-full py-3 border border-dashed border-[#c8ff57]/40 text-[#c8ff57]
                           font-mono text-xs rounded-lg hover:border-[#c8ff57] hover:bg-[#c8ff57]/05
                           transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> {showAddGame ? 'Close Search' : 'Add Games'}
            </button>

            {/* Add Games Search Panel */}
            {showAddGame && (
                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-4 flex flex-col gap-3">
                    <input
                        type="text"
                        placeholder="Search in Database..."
                        value={searchQuery}
                        onChange={e => handleSearchGames(e.target.value)}
                        className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white
                                   focus:outline-none focus:border-[#c8ff57] placeholder:text-[#7a7a90]"
                    />
                    {searching && <div className="font-mono text-[10px] text-[#7a7a90]">Searching...</div>}
                    {!searching && searchResults.length > 0 && (
                        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                            {searchResults.map(game => (
                                <div key={game.igdbId}
                                    className="flex items-center gap-3 p-2 bg-[#18181f] border border-[#2a2a35] rounded-lg hover:border-[#c8ff57]/30 transition-all">
                                    {game.gameCover ? (
                                        <img src={game.gameCover} alt={game.gameTitle} className="w-10 h-14 object-cover rounded" />
                                    ) : (
                                        <div className="w-10 h-14 bg-[#2a2a35] rounded flex items-center justify-center text-lg">🎮</div>
                                    )}
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
                        <div className="font-mono text-[10px] text-[#7a7a90]">No games found in your library.</div>
                    )}
                </div>
            )}

            {/* Games Grid */}
            {currentList.games?.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {currentList.games.map(game => (
                        <div key={game.igdbId} className="relative group">
                            <div onClick={() => game.igdbId && navigate(`/game/${game.igdbId}`)}
                                className="bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden
                                           hover:border-[#c8ff57]/50 transition-all cursor-pointer">
                                {game.gameCover ? (
                                    <img src={game.gameCover} alt={game.gameTitle} className="w-full h-[140px] object-cover" />
                                ) : (
                                    <div className="w-full h-[140px] bg-[#18181f] flex items-center justify-center text-3xl">🎮</div>
                                )}
                                <div className="p-2">
                                    <div className="text-white font-semibold text-xs truncate">{game.gameTitle}</div>
                                </div>
                            </div>
                            <button onClick={() => handleRemoveGame(game.igdbId)}
                                className="absolute top-1 right-1 w-6 h-6 bg-[#ff5c5c] rounded-full text-white
                                           text-[10px] hidden group-hover:flex items-center justify-center font-bold">✕</button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="text-4xl">📋</div>
                    <div className="text-[#7a7a90] font-mono text-sm text-center">No games in this list yet.</div>
                    <div className="text-[#7a7a90] font-mono text-[10px] text-center">Use the "Add Games" button above</div>
                </div>
            )}
        </div>
    )
}

// ── Main Lists Component ──────────────────────────────────────────────────────
function Lists() {
    const { user } = useAuth()
    const navigate = useNavigate()

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('lists')
    const [selectedList, setSelectedList] = useState(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
    const [createForm, setCreateForm] = useState({ name: '', description: '', isPublic: true })
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState('')
    const [toast, setToast] = useState(null)

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const fetchData = async () => {
        try {
            setLoading(true)
            const res = await api.get('/lists/me')
            setData(res.data)
            // If a list is selected, keep it in sync
            if (selectedList) {
                const updated = res.data.customLists?.find(l => l._id === selectedList._id)
                if (updated) setSelectedList(updated)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (user) fetchData()
    }, [user])

    const handleCreateList = async () => {
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
        } finally {
            setCreating(false)
        }
    }

    const handleDeleteList = async (id) => {
        try {
            await api.delete(`/lists/custom/${id}`)
            showToast('List deleted')
            setShowDeleteConfirm(null)
            if (selectedList?._id === id) setSelectedList(null)
            fetchData()
        } catch {
            showToast('Failed to delete', 'error')
        }
    }

    const handleRemoveLike = async (igdbId) => {
        try {
            const res = await api.post('/lists/like', { igdbId })
            showToast(res.data.message || 'Like removed · -1 XP', 'success')
            fetchData()
        } catch {
            showToast('Failed', 'error')
        }
    }

    const handleRemoveWishlist = async (igdbId) => {
        try {
            await api.post('/lists/wishlist', { igdbId })
            showToast('Removed from wishlist')
            fetchData()
        } catch {
            showToast('Failed', 'error')
        }
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">📋</div>
                <div className="text-white font-black text-2xl tracking-widest uppercase"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    Login to view your lists
                </div>
                <button onClick={() => navigate('/login')}
                    className="px-6 py-3 bg-[#c8ff57] text-black font-bold text-sm rounded hover:bg-[#d4ff6e] transition-all">
                    Login
                </button>
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

    const { customLists, likes, wishlist, user: userData } = data || {}
    const xp = userData?.xp || 0
    const { current: currentLevel, next: nextLevel } = getLevelInfo(xp)
    const xpProgress = nextLevel
        ? ((xp - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)) * 100
        : 100
    const canCreateList = currentLevel.level >= 2
    const atListLimit = (customLists?.length || 0) >= MAX_CUSTOM_LISTS

    const tabs = [
        { id: 'lists', label: 'My Lists', count: (customLists?.length || 0) + 2 },
        { id: 'liked', label: 'Liked Games', count: likes?.length || 0 },
        { id: 'wishlist', label: 'Wishlist', count: wishlist?.length || 0 },
        { id: 'xp', label: 'XP & Level', count: null },
    ]

    return (
        <div className="max-w-[900px] mx-auto px-5 md:px-10 py-8 md:py-10">

            {/* Toast */}
            {toast && (
                <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg font-mono text-sm border transition-all
                                ${toast.type === 'error'
                        ? 'bg-[#ff5c5c]/15 border-[#ff5c5c]/50 text-[#ff5c5c]'
                        : 'bg-[#c8ff57]/15 border-[#c8ff57]/50 text-[#c8ff57]'}`}>
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
                    <div className="flex items-center gap-2 bg-[#18181f] border border-[#2a2a35] rounded-full px-3 py-1">
                        <span className="text-sm">{currentLevel.badge}</span>
                        <span className="font-mono text-[10px] text-[#c8ff57] uppercase tracking-wider">{currentLevel.title}</span>
                        <span className="font-mono text-[10px] text-[#7a7a90]">{xp} XP</span>
                    </div>
                </div>
            </div>

            {/* If a list is selected, show its detail view */}
            {selectedList && activeTab === 'lists' ? (
                <ListDetail
                    list={selectedList}
                    onBack={() => setSelectedList(null)}
                    onUpdate={fetchData}
                    showToast={showToast}
                />
            ) : (
                <>
                    {/* Tabs */}
                    <div className="flex gap-2 mb-6 flex-wrap">
                        {tabs.map(tab => (
                            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedList(null) }}
                                className={`px-4 py-2 rounded font-mono text-xs uppercase tracking-wider border transition-all
                                           ${activeTab === tab.id
                                        ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/06'
                                        : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'}`}>
                                {tab.label}
                                {tab.count !== null && <span className="ml-1.5 opacity-60">({tab.count})</span>}
                            </button>
                        ))}
                    </div>

                    {/* ══ MY LISTS TAB ══ */}
                    {activeTab === 'lists' && (
                        <div className="flex flex-col gap-4">

                            {/* Built-in: Liked Games */}
                            <div onClick={() => setActiveTab('liked')}
                                className="flex items-center gap-4 p-4 bg-[#111118] border border-[#2a2a35]
                                           rounded-lg hover:border-[#c8ff57]/30 transition-all cursor-pointer">
                                <div className="w-12 h-12 rounded-lg bg-[#ff5c5c]/15 flex items-center justify-center text-2xl flex-shrink-0">❤️</div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-semibold text-sm">Liked Games</div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5">{likes?.length || 0} games · Always available</div>
                                </div>
                                <div className="font-mono text-[10px] text-[#2a2a35] uppercase tracking-wider border border-[#2a2a35] rounded px-2 py-1">Built-in</div>
                            </div>

                            {/* Built-in: Wishlist */}
                            <div onClick={() => setActiveTab('wishlist')}
                                className="flex items-center gap-4 p-4 bg-[#111118] border border-[#2a2a35]
                                           rounded-lg hover:border-[#c8ff57]/30 transition-all cursor-pointer">
                                <div className="w-12 h-12 rounded-lg bg-[#5c9fff]/15 flex items-center justify-center text-2xl flex-shrink-0">🎯</div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-semibold text-sm">Wishlist</div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5">{wishlist?.length || 0} games · Always available</div>
                                </div>
                                <div className="font-mono text-[10px] text-[#2a2a35] uppercase tracking-wider border border-[#2a2a35] rounded px-2 py-1">Built-in</div>
                            </div>

                            {/* Custom lists */}
                            {customLists?.map(list => (
                                <div key={list._id}
                                    className="bg-[#111118] border border-[#2a2a35] rounded-lg hover:border-[#c8ff57]/30 transition-all overflow-hidden">
                                    <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setSelectedList(list)}>
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
                                                <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5 truncate">{list.description}</div>
                                            )}
                                            <div className="font-mono text-[10px] text-[#7a7a90] mt-0.5">{list.games?.length || 0} games · tap to open</div>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); setShowDeleteConfirm(list._id) }}
                                            className="text-[#7a7a90] hover:text-[#ff5c5c] transition-colors font-mono text-xs px-2 py-1 flex-shrink-0">
                                            ✕
                                        </button>
                                    </div>
                                    {list.games?.length > 0 && (
                                        <div className="px-4 pb-4 flex gap-2 flex-wrap">
                                            {list.games.slice(0, 6).map(game => (
                                                game.gameCover ? (
                                                    <img key={game.igdbId} src={game.gameCover} alt={game.gameTitle}
                                                        onClick={() => setSelectedList(list)}
                                                        className="w-12 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-all" />
                                                ) : (
                                                    <div key={game.igdbId} className="w-12 h-16 bg-[#2a2a35] rounded flex items-center justify-center text-sm">🎮</div>
                                                )
                                            ))}
                                            {list.games.length > 6 && (
                                                <div onClick={() => setSelectedList(list)}
                                                    className="w-12 h-16 bg-[#2a2a35] rounded flex items-center justify-center font-mono text-[10px] text-[#7a7a90] cursor-pointer hover:bg-[#3a3a45] transition-all">
                                                    +{list.games.length - 6}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Create list CTA */}
                            {canCreateList ? (
                                atListLimit ? (
                                    <div className="w-full py-4 border border-dashed border-[#2a2a35] rounded-lg flex flex-col items-center gap-2 p-5">
                                        <div className="text-2xl">📋</div>
                                        <div className="text-white font-semibold text-sm">List limit reached</div>
                                        <div className="font-mono text-[10px] text-[#7a7a90] text-center">
                                            You can have up to {MAX_CUSTOM_LISTS} custom lists. Delete one to create another.
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowCreateModal(true)}
                                        className="w-full py-4 border border-dashed border-[#c8ff57]/40 text-[#c8ff57]
                                                   font-mono text-xs rounded-lg hover:border-[#c8ff57] hover:bg-[#c8ff57]/05
                                                   transition-all flex items-center justify-center gap-2">
                                        <span className="text-lg">+</span> Create Custom List ({customLists?.length || 0}/{MAX_CUSTOM_LISTS})
                                    </button>
                                )
                            ) : (
                                <div className="w-full py-5 border border-dashed border-[#2a2a35] rounded-lg flex flex-col items-center gap-2 p-5">
                                    <div className="text-2xl">🔒</div>
                                    <div className="text-white font-semibold text-sm">Custom List Locked</div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] text-center max-w-xs">
                                        Reach <span className="text-[#c8ff57]">Level 2 (5 XP)</span> to unlock custom lists.
                                        You have <span className="text-[#c8ff57]">{xp} XP</span> —
                                        need <span className="text-[#c8ff57]">{Math.max(0, 5 - xp)} more</span>.
                                    </div>
                                    <div className="w-full max-w-xs bg-[#2a2a35] rounded-full h-1.5 mt-2">
                                        <div className="h-full rounded-full bg-[#c8ff57] transition-all"
                                            style={{ width: `${Math.min((xp / 5) * 100, 100)}%` }} />
                                    </div>
                                    <div className="font-mono text-[9px] text-[#7a7a90]">
                                        Log games, rate them, like games, follow people to earn XP
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══ LIKED GAMES TAB ══ */}
                    {activeTab === 'liked' && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-xl">❤️</span>
                                <h3 className="font-black text-lg tracking-widest uppercase text-white"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Liked Games</h3>
                                <span className="font-mono text-xs text-[#7a7a90]">{likes?.length || 0} games</span>
                            </div>
                            {likes?.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {likes.map(game => (
                                        <div key={game._id} className="relative group">
                                            <div onClick={() => game.igdbId && navigate(`/game/${game.igdbId}`)}
                                                className="bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden
                                                           hover:border-[#c8ff57]/50 transition-all cursor-pointer">
                                                {game.gameCover ? (
                                                    <img src={game.gameCover} alt={game.gameTitle} className="w-full h-[140px] object-cover" />
                                                ) : (
                                                    <div className="w-full h-[140px] bg-[#18181f] flex items-center justify-center text-3xl">🎮</div>
                                                )}
                                                <div className="p-2">
                                                    <div className="text-white font-semibold text-xs truncate">{game.gameTitle}</div>
                                                    <div className="font-mono text-[9px] text-[#ff5c5c] mt-0.5">❤️ Liked</div>
                                                </div>
                                            </div>
                                            <button onClick={() => handleRemoveLike(game.igdbId)}
                                                className="absolute top-1 right-1 w-6 h-6 bg-[#ff5c5c] rounded-full text-white
                                                           text-[10px] hidden group-hover:flex items-center justify-center font-bold">✕</button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <div className="text-4xl">❤️</div>
                                    <div className="text-[#7a7a90] font-mono text-sm text-center">No liked games yet.</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══ WISHLIST TAB ══ */}
                    {activeTab === 'wishlist' && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-xl">🎯</span>
                                <h3 className="font-black text-lg tracking-widest uppercase text-white"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Wishlist</h3>
                                <span className="font-mono text-xs text-[#7a7a90]">{wishlist?.length || 0} games</span>
                            </div>
                            {wishlist?.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {wishlist.map(game => (
                                        <div key={game._id} className="relative group">
                                            <div onClick={() => game.igdbId && navigate(`/game/${game.igdbId}`)}
                                                className="bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden
                                                           hover:border-[#5c9fff]/50 transition-all cursor-pointer">
                                                {game.gameCover ? (
                                                    <img src={game.gameCover} alt={game.gameTitle} className="w-full h-[140px] object-cover" />
                                                ) : (
                                                    <div className="w-full h-[140px] bg-[#18181f] flex items-center justify-center text-3xl">🎮</div>
                                                )}
                                                <div className="p-2">
                                                    <div className="text-white font-semibold text-xs truncate">{game.gameTitle}</div>
                                                    {game.releaseYear && <div className="font-mono text-[9px] text-[#7a7a90] mt-0.5">{game.releaseYear}</div>}
                                                    <div className="font-mono text-[9px] text-[#5c9fff] mt-0.5">🎯 Wishlisted</div>
                                                </div>
                                            </div>
                                            <button onClick={() => handleRemoveWishlist(game.igdbId)}
                                                className="absolute top-1 right-1 w-6 h-6 bg-[#ff5c5c] rounded-full text-white
                                                           text-[10px] hidden group-hover:flex items-center justify-center font-bold">✕</button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <div className="text-4xl">🎯</div>
                                    <div className="text-[#7a7a90] font-mono text-sm text-center">No games wishlisted yet.</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══ XP & LEVEL TAB ══ */}
                    {activeTab === 'xp' && (
                        <div className="flex flex-col gap-4">
                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="text-5xl">{currentLevel.badge}</div>
                                    <div>
                                        <div className="font-black text-2xl text-white tracking-widest uppercase"
                                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                            Level {currentLevel.level} — {currentLevel.title}
                                        </div>
                                        <div className="font-mono text-sm text-[#c8ff57]">{xp} XP total</div>
                                    </div>
                                </div>
                                {nextLevel ? (
                                    <>
                                        <div className="flex justify-between font-mono text-[10px] text-[#7a7a90] mb-1.5">
                                            <span>Progress to Level {nextLevel.level}</span>
                                            <span>{xp} / {nextLevel.xpRequired} XP</span>
                                        </div>
                                        <div className="w-full bg-[#2a2a35] rounded-full h-2">
                                            <div className="h-full rounded-full bg-gradient-to-r from-[#c8ff57] to-[#5c9fff] transition-all"
                                                style={{ width: `${Math.min(xpProgress, 100)}%` }} />
                                        </div>
                                        <div className="font-mono text-[10px] text-[#7a7a90] mt-1.5">
                                            {nextLevel.xpRequired - xp} XP needed to reach {nextLevel.badge} {nextLevel.title}
                                        </div>
                                    </>
                                ) : (
                                    <div className="font-mono text-[10px] text-[#c8ff57]">🎉 Max level reached — you are Immortal!</div>
                                )}
                            </div>

                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden">
                                <div className="px-4 py-3 border-b border-[#2a2a35]">
                                    <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest">All Levels</div>
                                </div>
                                {LEVELS.map(lvl => {
                                    const isReached = xp >= lvl.xpRequired
                                    const isCurrent = currentLevel.level === lvl.level
                                    return (
                                        <div key={lvl.level}
                                            className={`flex items-center gap-4 px-4 py-3 border-b border-[#2a2a35] last:border-0
                                                       ${isCurrent ? 'bg-[#c8ff57]/05' : ''}`}>
                                            <div className={`text-2xl ${isReached ? '' : 'grayscale opacity-30'}`}>{lvl.badge}</div>
                                            <div className="flex-1">
                                                <div className={`font-semibold text-sm ${isReached ? 'text-white' : 'text-[#7a7a90]'}`}>
                                                    Level {lvl.level} — {lvl.title}
                                                </div>
                                                <div className="font-mono text-[10px] text-[#7a7a90]">{lvl.xpRequired} XP required</div>
                                            </div>
                                            {isCurrent && (
                                                <span className="font-mono text-[9px] text-[#c8ff57] border border-[#c8ff57]/30 rounded px-2 py-0.5 uppercase tracking-wider">Current</span>
                                            )}
                                            {isReached && !isCurrent && (
                                                <span className="font-mono text-[9px] text-[#5c9fff] border border-[#5c9fff]/30 rounded px-2 py-0.5 uppercase tracking-wider">✓ Unlocked</span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden">
                                <div className="px-4 py-3 border-b border-[#2a2a35]">
                                    <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest">How to Earn XP</div>
                                </div>
                                {[
                                    { action: 'Log a game (any status)', xp: '+1 XP', icon: '🎮' },
                                    { action: 'Rate a game', xp: '+1 XP', icon: '⭐' },
                                    { action: 'Like a game', xp: '+1 XP', icon: '❤️' },
                                    { action: 'Follow someone', xp: '+1 XP', icon: '👥' },
                                    { action: 'Get followed', xp: '+1 XP', icon: '🌟' },
                                    { action: 'Comment on a game', xp: '+1 XP', icon: '💬' },
                                ].map(item => (
                                    <div key={item.action} className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a35] last:border-0">
                                        <span className="text-lg">{item.icon}</span>
                                        <div className="flex-1 font-mono text-xs text-[#7a7a90]">{item.action}</div>
                                        <div className="font-black text-sm text-[#c8ff57]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{item.xp}</div>
                                    </div>
                                ))}
                                <div className="px-4 py-3 bg-[#ff5c5c]/05 border-t border-[#ff5c5c]/10">
                                    <div className="font-mono text-[10px] text-[#ff5c5c]">⚠ Undoing any action deducts the XP it gave</div>
                                </div>
                            </div>

                            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden">
                                <div className="px-4 py-3 border-b border-[#2a2a35]">
                                    <div className="font-mono text-xs text-[#7a7a90] uppercase tracking-widest">Level Unlocks</div>
                                </div>
                                {[
                                    { level: 1, badge: '🎮', xp: 0, unlock: 'Wishlist + Liked Games — always free' },
                                    { level: 2, badge: '🕹️', xp: 5, unlock: 'Create up to 2 Custom Lists' },
                                    { level: 3, badge: '⭐', xp: 25, unlock: 'Enthusiast badge on profile' },
                                    { level: 4, badge: '🔥', xp: 60, unlock: 'Veteran badge on profile' },
                                    { level: 5, badge: '💎', xp: 100, unlock: 'Legend badge on profile' },
                                    { level: 6, badge: '👑', xp: 150, unlock: 'Elite badge on profile' },
                                    { level: 7, badge: '🚀', xp: 500, unlock: 'Master badge on profile' },
                                    { level: 8, badge: '🌟', xp: 1000, unlock: 'Immortal badge + special border' },
                                ].map(item => {
                                    const isReached = currentLevel.level >= item.level
                                    return (
                                        <div key={item.level} className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a35] last:border-0">
                                            <span className={`text-lg ${isReached ? '' : 'grayscale opacity-30'}`}>{item.badge}</span>
                                            <div className="flex-1">
                                                <div className={`font-mono text-xs ${isReached ? 'text-white' : 'text-[#7a7a90]'}`}>{item.unlock}</div>
                                                <div className="font-mono text-[9px] text-[#7a7a90]">Level {item.level} · {item.xp} XP</div>
                                            </div>
                                            {isReached ? (
                                                <span className="font-mono text-[9px] text-[#c8ff57]">✓</span>
                                            ) : (
                                                <span className="font-mono text-[9px] text-[#2a2a35]">🔒</span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
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
                                <label className="block font-mono text-xs uppercase tracking-wider text-[#7a7a90] mb-2">List Name *</label>
                                <input type="text" placeholder="e.g. My Top RPGs" value={createForm.name}
                                    onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                                    className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white
                                               focus:outline-none focus:border-[#c8ff57] placeholder:text-[#7a7a90] transition-colors" />
                            </div>
                            <div>
                                <label className="block font-mono text-xs uppercase tracking-wider text-[#7a7a90] mb-2">Description</label>
                                <textarea placeholder="What's this list about?" value={createForm.description}
                                    onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                                    rows={3}
                                    className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white resize-none
                                               focus:outline-none focus:border-[#c8ff57] placeholder:text-[#7a7a90] transition-colors" />
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

            {/* ══ DELETE CONFIRM MODAL ══ */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={e => e.target === e.currentTarget && setShowDeleteConfirm(null)}>
                    <div className="bg-[#111118] border border-[#2a2a35] rounded-lg w-full max-w-sm p-6 flex flex-col gap-4">
                        <div className="text-center">
                            <div className="text-3xl mb-2">🗑️</div>
                            <div className="text-white font-semibold text-sm">Delete this list?</div>
                            <div className="font-mono text-[10px] text-[#7a7a90] mt-1">This cannot be undone.</div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 py-2 border border-[#2a2a35] text-[#7a7a90] font-mono text-xs rounded
                                           hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">Cancel</button>
                            <button onClick={() => handleDeleteList(showDeleteConfirm)}
                                className="flex-1 py-2 bg-[#ff5c5c] text-white font-bold text-xs rounded hover:bg-[#ff3333] transition-all">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Lists