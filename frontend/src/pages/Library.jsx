import { useState, useMemo, useCallback, lazy, Suspense } from 'react'
import { useGamesContext } from '../context/GamesContext'
import GameCard from '../components/library/GameCard'
import FilterBar from '../components/library/FilterBar'
import Toast from '../components/ui/Toast'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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
    const { user } = useAuth()
    const navigate = useNavigate()
    const [activeFilter, setActiveFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedQ, setDebouncedQ] = useState('')
    const [editingGame, setEditingGame] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [toast, setToast] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [confirmDelete, setConfirmDelete] = useState(null)

    // Debounce search — avoids filtering on every keystroke
    const searchTimer = useMemo(() => ({ id: null }), [])
    const handleSearch = useCallback((query) => {
        setSearchQuery(query)
        clearTimeout(searchTimer.id)
        searchTimer.id = setTimeout(() => {
            setDebouncedQ(query)
            setCurrentPage(1)
        }, 200)
    }, [searchTimer])

    const handleFilter = useCallback((filter) => {
        setActiveFilter(filter)
        setCurrentPage(1)
    }, [])

    const showToast = useCallback((message, type = 'success') => setToast({ message, type }), [])

    const counts = useMemo(() => {
        const c = { all: games.length }
        games.forEach(g => { c[g.status] = (c[g.status] || 0) + 1 })
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

    // Stable callbacks — GameCard won't re-render just because Library re-renders
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

    return (
        <div className="max-w-[1200px] mx-auto px-4 md:px-10 py-8 md:py-10">

            {/* ── Page Header ── */}
            <div className="mb-3 pb-4 border-b border-[#2a2a35]">
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
                        onClick={() => {
                            if (!user) { navigate('/login'); return }
                            setShowModal(true)
                        }}
                        className="ml-auto px-3 py-2 bg-[#c8ff57] text-black font-bold text-sm
                                   rounded hover:bg-[#d4ff6e] transition-all whitespace-nowrap shrink-0"
                    >
                        + Add to Deck
                    </button>
                </div>

                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#7a7a90] flex items-center">
                        <Search size={14} strokeWidth={2.5} />
                    </span>
                    <input
                        type="text"
                        placeholder="Search games in your library..."
                        value={searchQuery}
                        onChange={e => handleSearch(e.target.value)}
                        className="w-full md:w-64 bg-[#111118] border border-[#2a2a35] rounded
                                   px-3 py-2 pl-7 text-sm text-white
                                   focus:outline-none focus:border-[#c8ff57]
                                   placeholder:text-[#7a7a90] transition-colors"
                    />
                </div>
            </div>

            {/* ── Filters ── */}
            <FilterBar activeFilter={activeFilter} onFilter={handleFilter} counts={counts} />

            {/* ── Loading skeleton ── */}
            {loading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                    {Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)}
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
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                            {paginatedGames.map(game => (
                                <GameCard
                                    key={game._id}
                                    game={game}
                                    onDelete={() => handleDeleteRequest(game._id, game.title)}
                                    onEdit={() => setEditingGame(game)}
                                />
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        )}
                    </>
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
                <Suspense fallback={null}>
                    <AddGameModal
                        onClose={handleCloseModal}
                        onAdd={handleAddGame}
                        games={games}
                    />
                </Suspense>
            )}

            {/* ── Modal (edit existing game) ── */}
            {editingGame && (
                <Suspense fallback={null}>
                    <AddGameModal
                        onClose={handleCloseModal}
                        onAdd={handleAddGame}
                        existingEntry={editingGame}
                    />
                </Suspense>
            )}

            {/* ── Delete Confirmation ── */}
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
                        <div className="text-3xl mb-3 text-center">🗑️</div>
                        <h3
                            className="text-white font-black text-xl tracking-widest uppercase text-center mb-2"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            Remove Game?
                        </h3>
                        <p className="text-[#7a7a90] font-mono text-xs text-center mb-6 leading-relaxed">
                            Are you sure you want to remove{' '}
                            <span className="text-white font-semibold">"{confirmDelete.title}"</span>{' '}
                            from your library? This can't be undone.
                        </p>
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
                <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            )}
        </div>
    )
}

// ── Pagination ──────────────────────────────────────────────────────────────

function Pagination({ currentPage, totalPages, onPageChange }) {
    const getPageNumbers = () => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

        if (currentPage <= 4)
            return [1, 2, 3, 4, 5, '...', totalPages]

        if (currentPage >= totalPages - 3)
            return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]

        return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
    }

    const pageNumbers = getPageNumbers()

    const btnBase = `flex items-center justify-center h-8 sm:h-9 font-mono rounded border transition-all duration-150`
    const btnInactive = `text-[#7a7a90] border-[#2a2a35] bg-transparent hover:text-white hover:border-[#7a7a90]`
    const btnActive = `text-black bg-[#c8ff57] border-[#c8ff57] font-bold`
    const btnDisabled = `text-[#3a3a50] border-[#1e1e28] bg-transparent cursor-not-allowed`

    return (
        <div className="flex items-center justify-center gap-1 mt-8 pt-4 border-t border-[#2a2a35] flex-wrap">

            {/* Prev */}
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`${btnBase} px-2.5 sm:px-4 text-xs sm:text-sm ${currentPage === 1 ? btnDisabled : `${btnInactive}`}`}
                aria-label="Previous page"
            >
                ← <span className="hidden sm:inline ml-1">Prev</span>
            </button>

            {/* Page numbers */}
            {pageNumbers.map((page, idx) =>
                page === '...' ? (
                    <span
                        key={`dots-${idx}`}
                        className="font-mono text-sm text-[#3a3a50] w-6 text-center select-none"
                    >
                        …
                    </span>
                ) : (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        className={`${btnBase} w-8 sm:w-9 text-xs sm:text-sm ${page === currentPage ? btnActive : btnInactive}`}
                        aria-label={`Page ${page}`}
                        aria-current={page === currentPage ? 'page' : undefined}
                    >
                        {page}
                    </button>
                )
            )}

            {/* Next */}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`${btnBase} px-2.5 sm:px-4 text-xs sm:text-sm ${currentPage === totalPages ? btnDisabled : `${btnInactive}`}`}
                aria-label="Next page"
            >
                <span className="hidden sm:inline mr-1">Next</span> →
            </button>
        </div>
    )
}

export default Library