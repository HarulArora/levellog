import { useState, useMemo } from 'react'

import useGames from '../hooks/useGames'

import GameCard from '../components/library/GameCard'
import FilterBar from '../components/library/FilterBar'
import AddGameModal from '../components/library/AddGameModal'
import Toast from '../components/ui/Toast'

function Library() {

    const { games, loading, error, addGame, deleteGame } = useGames()
    const [activeFilter, setActiveFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [editingGame, setEditingGame] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [toast, setToast] = useState(null)

    // Delete confirmation state
    const [confirmDelete, setConfirmDelete] = useState(null) // null | { id, title }

    const showToast = (message, type = 'success') => setToast({ message, type })

    const counts = useMemo(() => {
        const c = { all: games.length }
        games.forEach(g => { c[g.status] = (c[g.status] || 0) + 1 })
        return c
    }, [games])

    const filteredGames = useMemo(() => {
        return games
            .filter(game => activeFilter === 'all' || game.status === activeFilter)
            .filter(game => !searchQuery || game.title.toLowerCase().includes(searchQuery.toLowerCase()))
    }, [games, activeFilter, searchQuery])

    const handleAddGame = async (gameData) => {
        const result = await addGame(gameData)
        if (result.success) showToast(
            result.updated
                ? `"${result.game.title}" status updated!`
                : `"${result.game.title}" logged!`
        )
        else showToast(result.message, 'error')
        return result
    }

    // Instead of deleting immediately, open confirmation modal
    const handleDeleteRequest = (id, title) => {
        setConfirmDelete({ id, title })
    }

    // Called when user confirms deletion
    const handleDeleteConfirmed = async () => {
        if (!confirmDelete) return
        const { id, title } = confirmDelete
        setConfirmDelete(null)
        const result = await deleteGame(id)
        if (result.success) showToast(`"${title}" removed`)
        else showToast(result.message, 'error')
    }

    const handleCloseModal = () => {
        setShowModal(false)
        setEditingGame(null)
    }

    return (
        <div className="max-w-[1200px] mx-auto px-4 md:px-10 py-8 md:py-10">

            {/* ── Page Header ── */}
            <div className="mb-3 pb-4 border-b border-[#2a2a35]">

                {/* Row 1: Title + count + Log Game button */}
                <div className="flex items-center gap-3 mb-3">
                    <h2
                        className="font-black text-2xl md:text-3xl tracking-widest uppercase text-white leading-tight"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                        My Library
                    </h2>
                    <span className="font-mono text-xs text-[#7a7a90] shrink-0">
                        {filteredGames.length} games
                    </span>
                    <button
                        onClick={() => setShowModal(true)}
                        className="ml-auto px-3 py-2 bg-[#c8ff57] text-black font-bold text-sm
                                   rounded hover:bg-[#d4ff6e] transition-all whitespace-nowrap shrink-0"
                    >
                        + Log Game
                    </button>
                </div>

                {/* Row 2: Search — full width on mobile */}
                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#7a7a90] text-sm">🔍</span>
                    <input
                        type="text"
                        placeholder="Search games in your library..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full md:w-64 bg-[#111118] border border-[#2a2a35] rounded
                                   px-3 py-2 pl-7 text-sm text-white
                                   focus:outline-none focus:border-[#c8ff57]
                                   placeholder:text-[#7a7a90] transition-colors"
                    />
                </div>
            </div>

            {/* ── Filters row ── */}
            <FilterBar
                activeFilter={activeFilter}
                onFilter={setActiveFilter}
                counts={counts}
            />

            {/* ── Loading ── */}
            {loading && (
                <div className="text-center py-20 text-[#7a7a90] font-mono text-sm">
                    Loading your library...
                </div>
            )}

            {/* ── Error ── */}
            {error && !loading && (
                <div className="text-center py-20 text-[#ff5c5c] font-mono text-sm">
                    ❌ {error}
                </div>
            )}

            {/* ── Game Grid ── */}
            {!loading && !error && (
                filteredGames.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                        {filteredGames.map(game => (
                            <GameCard
                                key={game._id}
                                game={game}
                                onDelete={() => handleDeleteRequest(game._id, game.title)}
                                onEdit={() => setEditingGame(game)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-[#7a7a90]">
                        <div className="text-4xl mb-3">🎮</div>
                        <div className="font-mono text-sm">No games found</div>
                        <div className="font-mono text-xs mt-1 opacity-60">
                            {games.length === 0 ? 'Add your first game!' : 'Try a different filter'}
                        </div>
                    </div>
                )
            )}

            {/* ── Modal (new game) ── */}
            {showModal && (
                <AddGameModal
                    onClose={handleCloseModal}
                    onAdd={handleAddGame}
                    games={games}
                />
            )}

            {/* ── Modal (edit existing game) ── */}
            {editingGame && (
                <AddGameModal
                    onClose={handleCloseModal}
                    onAdd={handleAddGame}
                    existingEntry={editingGame}
                />
            )}

            {/* ── Delete Confirmation Modal ── */}
            {confirmDelete && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
                >
                    <div
                        className="bg-[#111118] border border-[#2a2a35] rounded-xl p-6 w-full max-w-sm
                                   shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
                        style={{ animation: 'fadeUp 0.2s ease backwards' }}
                    >
                        {/* Icon */}
                        <div className="text-3xl mb-3 text-center">🗑️</div>

                        {/* Title */}
                        <h3
                            className="text-white font-black text-xl tracking-widest uppercase text-center mb-2"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            Remove Game?
                        </h3>

                        {/* Message */}
                        <p className="text-[#7a7a90] font-mono text-xs text-center mb-6 leading-relaxed">
                            Are you sure you want to remove{' '}
                            <span className="text-white font-semibold">"{confirmDelete.title}"</span>{' '}
                            from your library? This can't be undone.
                        </p>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="flex-1 py-2 text-xs font-mono uppercase tracking-wider
                                           text-[#7a7a90] border border-[#2a2a35] rounded
                                           hover:border-[#7a7a90] hover:text-white transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirmed}
                                className="flex-1 py-2 text-xs font-mono uppercase tracking-wider
                                           text-[#ff5c5c] border border-[#ff5c5c]/30 rounded
                                           hover:bg-[#ff5c5c]/10 hover:border-[#ff5c5c] transition-all"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast ── */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    )
}

export default Library
