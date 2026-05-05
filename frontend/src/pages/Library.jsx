import { useState, useMemo, useCallback, useRef, lazy, Suspense, useEffect } from 'react'
import { useGamesContext } from '../context/GamesContext'
import GameCard from '../components/library/GameCard'
import FilterBar from '../components/library/FilterBar'
import Toast from '../components/ui/Toast'
import { Search, Plus, Sparkles, LayoutGrid, List as ListIcon, Gamepad2, Edit3, Trash2, ExternalLink, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Helmet } from 'react-helmet-async'
import { getIGDBImage, SIZES } from '../utils/igdb'

// Heavy modals are lazy-loaded — not bundled until first open
const AddGameModal = lazy(() => import('../components/library/AddGameModal'))

const PAGE_SIZE = 20

// Skeleton card — same dimensions as a real GameCard to prevent layout shift
function SkeletonCard() {
    return (
        <div className="rounded-xl border border-[#2a2a35] bg-[#111118] overflow-hidden animate-pulse">
            <div className="aspect-[3/4] bg-[#1e1e28]" />
            <div className="p-3 space-y-2">
                <div className="h-3 bg-[#2a2a35] rounded w-3/4" />
                <div className="h-3 bg-[#2a2a35] rounded w-1/2" />
            </div>
        </div>
    )
}

function Library() {
    const { games, loading, error, addGame, deleteGame } = useGamesContext()
    const { user, updateSettings } = useAuth()
    const navigate = useNavigate()
    
    const [activeFilter, setActiveFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedQ, setDebouncedQ] = useState('')
    const [editingGame, setEditingGame] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [toast, setToast] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [confirmDelete, setConfirmDelete] = useState(null)
    
    const [viewMode, setViewMode] = useState(user?.settings?.libraryViewMode || 'grid')

    // Sync viewMode with user settings on load
    useEffect(() => {
        if (user?.settings?.libraryViewMode) {
            setViewMode(user.settings.libraryViewMode)
        }
    }, [user?.settings?.libraryViewMode])

    const handleViewModeChange = async (mode) => {
        setViewMode(mode)
        if (user) {
            await updateSettings({ libraryViewMode: mode })
        }
    }

    // Debounce search — avoids filtering on every keystroke
    const searchTimer = useRef(null)
    const handleSearch = useCallback((query) => {
        setSearchQuery(query)
        if (searchTimer.current) clearTimeout(searchTimer.current)
        searchTimer.current = setTimeout(() => {
            setDebouncedQ(query)
            setCurrentPage(1)
        }, 200)
    }, [])

    const handleFilter = useCallback((filter) => {
        setActiveFilter(filter)
        setCurrentPage(1)
    }, [])

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }, [])

    const counts = useMemo(() => {
        const c = { all: games.length, playing: 0, completed: 0, planned: 0, paused: 0, dropped: 0 }
        games.forEach(g => { 
            if (c[g.status] !== undefined) c[g.status]++ 
        })
        return c
    }, [games])

    const filteredGames = useMemo(() => {
        const q = debouncedQ.toLowerCase()
        return games.filter(game =>
            (activeFilter === 'all' || game.status === activeFilter) &&
            (!q || game.title.toLowerCase().includes(q))
        )
    }, [games, activeFilter, debouncedQ])

    const totalPages = Math.max(1, Math.ceil(filteredGames.length / PAGE_SIZE))

    const paginatedGames = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE
        return filteredGames.slice(start, start + PAGE_SIZE)
    }, [filteredGames, currentPage])

    // Stable callbacks
    const handleDeleteRequest = useCallback((id, title) => setConfirmDelete({ id, title }), [])

    const handleAddGame = useCallback(async (gameData) => {
        const result = await addGame(gameData)
        if (result.success) showToast(
            result.updated ? `"${result.game.title}" status updated!` : `"${result.game.title}" logged!`
        )
        else showToast(result.message, 'error')
        return result
    }, [addGame, showToast])

    const handleDeleteConfirmed = useCallback(async () => {
        if (!confirmDelete) return
        const { id, title } = confirmDelete
        setConfirmDelete(null)
        const result = await deleteGame(id)
        if (result.success) {
            showToast(`"${title}" removed`)
            const newTotalPages = Math.max(1, Math.ceil((filteredGames.length - 1) / PAGE_SIZE))
            if (currentPage > newTotalPages) setCurrentPage(newTotalPages)
        } else {
            showToast(result.message, 'error')
        }
    }, [confirmDelete, deleteGame, filteredGames.length, currentPage, showToast])

    const handleCloseModal = useCallback(() => {
        setShowModal(false)
        setEditingGame(null)
    }, [])

    if (loading && games.length === 0) return (
        <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 animate-pulse">
                <div className="space-y-4">
                    <div className="h-12 w-64 bg-[#111118] rounded-xl border border-[#2a2a35]" />
                    <div className="h-4 w-48 bg-[#111118] rounded-full border border-[#2a2a35]" />
                </div>
                <div className="h-12 w-40 bg-[#111118] rounded-xl border border-[#2a2a35]" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
        </div>
    )

    return (
        <div className="min-h-screen pb-32">
            <Helmet>
                <title>My Game Library | QuestDuck</title>
            </Helmet>

            <div className="bg-[#0a0a0f] border-b border-[#1a1a25] pt-24 pb-16">
                <div className="max-w-[1200px] mx-auto px-5 md:px-10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
                        <div className="relative group">
                            <div className="absolute -left-4 -top-4 w-12 h-12 bg-[#c8ff57]/10 rounded-full blur-2xl group-hover:bg-[#c8ff57]/20 transition-all duration-500" />
                            <div className="flex items-center gap-3 mb-2">
                                <Gamepad2 size={16} className="text-[#c8ff57]" />
                                <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-[3px]">Multiverse Vault</span>
                            </div>
                            <h1 className="font-black text-5xl md:text-6xl text-white uppercase leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                My <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#c8ff57] to-white bg-[length:200%_auto] animate-gradient">Game Library</span>
                            </h1>
                            <div className="flex items-center gap-4 mt-4">
                                <div className="px-3 py-1 bg-[#111118] border border-[#2a2a35] rounded-full flex items-center gap-2">
                                    <Sparkles size={10} className="text-[#c8ff57]" />
                                    <span className="text-[#7a7a90] font-mono text-[9px] uppercase tracking-widest">
                                        {counts.all} GAMES LOGGED
                                    </span>
                                </div>
                                <div className="px-3 py-1 bg-[#c8ff57]/5 border border-[#c8ff57]/20 rounded-full flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff57] animate-pulse" />
                                    <span className="text-[#c8ff57] font-mono text-[9px] uppercase tracking-widest">
                                        {counts.playing || 0} CURRENTLY PLAYING
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => {
                                if (!user) { navigate('/login'); return }
                                setShowModal(true)
                            }}
                            className="group relative bg-[#c8ff57] text-black px-8 py-4 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_15px_40px_rgba(200,255,87,0.25)]"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            <Plus size={22} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" /> 
                            Log New Game
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1200px] mx-auto px-5 md:px-10 mt-12">
                {/* Control Panel */}
                <div className="flex flex-col lg:flex-row gap-6 mb-12 bg-[#111118]/50 backdrop-blur-xl border border-[#2a2a35] p-5 rounded-3xl shadow-2xl">
                    <div className="flex-1 overflow-x-auto no-scrollbar">
                        <FilterBar activeFilter={activeFilter} onFilter={handleFilter} counts={counts} />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto lg:border-l lg:border-[#2a2a35] lg:pl-6 lg:ml-2">
                        <div className="relative w-full sm:flex-1 lg:w-72 group">
                            <input 
                                type="text" 
                                placeholder="Search your vault..."
                                value={searchQuery}
                                onChange={e => handleSearch(e.target.value)}
                                className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-2xl pl-12 pr-12 py-3.5 text-sm text-white focus:outline-none focus:border-[#c8ff57] focus:ring-4 focus:ring-[#c8ff57]/5 transition-all placeholder:text-[#3a3a4a]"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c8ff57] group-focus-within:text-[#c8ff57] transition-colors z-10 pointer-events-none" size={18} />
                        </div>

                        <div className="flex bg-[#0d0d14] rounded-2xl border border-[#2a2a35] p-1.5 shadow-inner shrink-0">
                            <button 
                                onClick={() => handleViewModeChange('grid')}
                                className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-[#c8ff57] text-black shadow-lg' : 'text-[#7a7a90] hover:text-white hover:bg-[#1a1a25]'}`}
                            >
                                <LayoutGrid size={20} />
                            </button>
                            <button 
                                onClick={() => handleViewModeChange('list')}
                                className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-[#c8ff57] text-black shadow-lg' : 'text-[#7a7a90] hover:text-white hover:bg-[#1a1a25]'}`}
                            >
                                <ListIcon size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && !loading && (
                    <div className="text-center py-20 text-[#ff5c5c] font-mono text-sm bg-[#ff5c5c]/5 border border-[#ff5c5c]/20 rounded-3xl mb-12">
                        ❌ {error}
                    </div>
                )}

                {/* Library Content */}
                {filteredGames.length > 0 ? (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10">
                                {paginatedGames.map(game => (
                                    <GameCard
                                        key={game._id}
                                        game={game}
                                        onDelete={() => handleDeleteRequest(game._id, game.title)}
                                        onEdit={() => setEditingGame(game)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="overflow-x-auto no-scrollbar bg-[#111118]/50 border border-[#2a2a35] rounded-3xl">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-[#2a2a35] bg-[#0d0d14]">
                                            <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest w-16">#</th>
                                            <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest w-24">Image</th>
                                            <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest">Title</th>
                                            <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest text-center">Score</th>
                                            <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest">Platform</th>
                                            <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest">Playtime</th>
                                            <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedGames.map((game, idx) => (
                                            <GameRow 
                                                key={game._id} 
                                                game={game} 
                                                index={(currentPage - 1) * PAGE_SIZE + idx + 1}
                                                onDelete={() => handleDeleteRequest(game._id, game.title)}
                                                onEdit={() => setEditingGame(game)}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {totalPages > 1 && (
                            <div className="mt-16">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        )}
                    </>
                ) : !loading && (
                    <div className="py-32 text-center border-2 border-dashed border-[#2a2a35] rounded-[40px] bg-[#111118]/30 backdrop-blur-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-b from-[#c8ff57]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <div className="relative z-10">
                            <div className="w-24 h-24 bg-[#1a1a25] rounded-3xl flex items-center justify-center mx-auto mb-8 border border-[#2a2a35] group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
                                <Gamepad2 size={40} className="text-[#4a4a5e]" />
                            </div>
                            <h3 className="text-white font-black text-3xl uppercase mb-3 tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {debouncedQ ? 'Zero Matches' : 'Vault Empty'}
                            </h3>
                            <p className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                                {debouncedQ ? `No results for "${debouncedQ}". Maybe try a different keyword?` : 'Your legendary collection starts with a single log.'}
                            </p>
                            {!debouncedQ && (
                                <button 
                                    onClick={() => setShowModal(true)}
                                    className="mt-10 text-[#c8ff57] font-black uppercase text-sm tracking-[3px] hover:tracking-[5px] transition-all"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                    Log First Entry →
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <Suspense fallback={null}>
                {showModal && (
                    <AddGameModal
                        onClose={handleCloseModal}
                        onAdd={handleAddGame}
                        games={games}
                    />
                )}
                {editingGame && (
                    <AddGameModal
                        onClose={handleCloseModal}
                        onAdd={handleAddGame}
                        existingEntry={editingGame}
                    />
                )}
            </Suspense>

            {/* Delete Confirmation */}
            {confirmDelete && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300"
                >
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setConfirmDelete(null)} />
                    <div
                        className="relative bg-[#111118] border border-[#2a2a35] rounded-[2rem] p-8 w-full max-w-md
                                   shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#ff5c5c] to-transparent opacity-50" />
                        <div className="w-20 h-20 bg-[#ff5c5c]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#ff5c5c]/20">
                            <Plus size={32} className="text-[#ff5c5c] rotate-45" />
                        </div>
                        <h3
                            className="text-white font-black text-3xl tracking-widest uppercase text-center mb-2"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            Remove Entry?
                        </h3>
                        <p className="text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest text-center mb-8 leading-relaxed">
                            Are you sure you want to remove <span className="text-white">"{confirmDelete.title}"</span>? This action is permanent and will deduct any associated XP.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="flex-1 py-4 text-xs font-black uppercase tracking-widest
                                           text-white bg-[#1a1a25] border border-[#2a2a35] rounded-xl
                                           hover:bg-[#2a2a35] transition-all"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                                Keep it
                            </button>
                            <button
                                onClick={handleDeleteConfirmed}
                                className="flex-1 py-4 text-xs font-black uppercase tracking-widest
                                           text-white bg-[#ff5c5c] rounded-xl shadow-[0_10px_20px_rgba(255,92,92,0.2)]
                                           hover:bg-[#ff4b4b] transition-all"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            )}
        </div>
    )
}

function GameRow({ game, index, onDelete, onEdit }) {
    const navigate = useNavigate()
    const statusConfig = {
        playing: { color: 'bg-[#c8ff57]', label: 'Playing' },
        completed: { color: 'bg-[#5c9fff]', label: 'Completed' },
        planned: { color: 'bg-[#ff9f5c]', label: 'Planned' },
        dropped: { color: 'bg-[#ff5c5c]', label: 'Dropped' },
        paused: { color: 'bg-[#c45cff]', label: 'Paused' },
    }
    const sc = statusConfig[game.status] || statusConfig.planned
    const imageUrl = getIGDBImage(game.cover || (game.steamId ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamId}/header.jpg` : null), SIZES.THUMB)

    return (
        <tr className="border-b border-[#2a2a35] hover:bg-white/[0.02] transition-colors group">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className={`w-1 h-8 rounded-full ${sc.color}`} />
                    <span className="font-mono text-xs text-[#4a4a5e]">{index}</span>
                </div>
            </td>
            <td className="px-6 py-4">
                <div 
                    onClick={() => game.igdbId && navigate(`/game/${game.igdbId}`)}
                    className="w-12 h-16 bg-[#1a1a25] rounded-lg overflow-hidden border border-[#2a2a35] cursor-pointer hover:border-[#c8ff57] transition-all"
                >
                    {imageUrl ? (
                        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">🎮</div>
                    )}
                </div>
            </td>
            <td className="px-6 py-4">
                <div>
                    <h4 
                        onClick={() => game.igdbId && navigate(`/game/${game.igdbId}`)}
                        className="text-white font-bold text-sm hover:text-[#c8ff57] cursor-pointer transition-colors"
                    >
                        {game.title}
                    </h4>
                    <p className="text-[#4a4a5e] font-mono text-[10px] uppercase tracking-wider mt-0.5">{game.genre}</p>
                </div>
            </td>
            <td className="px-6 py-4 text-center">
                <div className="flex flex-col items-center">
                    {game.rating > 0 ? (
                        <span className="text-[#c8ff57] font-black text-xl leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{game.rating}</span>
                    ) : (
                        <span className="text-[#3a3a4a] font-mono text-[9px] uppercase tracking-tighter">NOT RATED</span>
                    )}
                </div>
            </td>
            <td className="px-6 py-4">
                <span className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest ${sc.color.replace('bg-', 'text-')} bg-white/5 border border-white/5`}>
                    {sc.label}
                </span>
            </td>
            <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1 max-w-[120px]">
                    {game.platforms && game.platforms.length > 0 ? (
                        game.platforms.map(p => (
                            <span key={p} className="px-1.5 py-0.5 rounded-[4px] bg-[#1a1a25] border border-[#2a2a35] text-[#7a7a90] font-mono text-[8px] uppercase">
                                {p}
                            </span>
                        ))
                    ) : (
                        <span className="text-[#3a3a4a] font-mono text-[10px]">—</span>
                    )}
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-bold ${game.hours > 0 ? 'text-[#c8ff57]' : 'text-[#4a4a5e]'}`}>
                        {game.hours > 0 ? `${game.hours}h` : '—'}
                    </span>
                </div>
            </td>
            <td className="px-6 py-4 text-center">
                <div className="flex justify-center gap-2">
                    <button 
                        onClick={() => onEdit()}
                        className="p-2 bg-[#1a1a25] border border-[#2a2a35] rounded-lg text-[#7a7a90] hover:text-[#c8ff57] hover:border-[#c8ff57] transition-all shadow-sm"
                    >
                        <Edit3 size={14} />
                    </button>
                    <button 
                        onClick={() => onDelete()}
                        className="p-2 bg-[#1a1a25] border border-[#2a2a35] rounded-lg text-[#7a7a90] hover:text-[#ff5c5c] hover:border-[#ff5c5c] transition-all shadow-sm"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </td>
        </tr>
    )
}

function Pagination({ currentPage, totalPages, onPageChange }) {
    const getPageNumbers = () => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
        if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages]
        if (currentPage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
    }

    const pageNumbers = getPageNumbers()
    const btnBase = `flex items-center justify-center h-10 w-10 font-mono rounded-xl border transition-all duration-300`
    const btnInactive = `text-[#7a7a90] border-[#2a2a35] bg-[#111118]/50 hover:text-white hover:border-[#c8ff57] hover:scale-110`
    const btnActive = `text-black bg-[#c8ff57] border-[#c8ff57] font-bold shadow-lg shadow-[#c8ff57]/20 scale-110`
    const btnDisabled = `text-[#3a3a50] border-[#1e1e28] bg-transparent cursor-not-allowed opacity-50`

    return (
        <div className="flex items-center justify-center gap-2">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`${btnBase} ${currentPage === 1 ? btnDisabled : btnInactive}`}
            >
                ←
            </button>
            {pageNumbers.map((page, idx) =>
                page === '...' ? (
                    <span key={`dots-${idx}`} className="font-mono text-[#3a3a50] w-10 text-center select-none">…</span>
                ) : (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        className={`${btnBase} ${page === currentPage ? btnActive : btnInactive}`}
                    >
                        {page}
                    </button>
                )
            )}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`${btnBase} ${currentPage === totalPages ? btnDisabled : btnInactive}`}
            >
                →
            </button>
        </div>
    )
}

export default Library