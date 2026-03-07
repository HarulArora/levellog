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
    const [showModal, setShowModal] = useState(false)
    const [toast, setToast] = useState(null)

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
    }

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
        if (result.success) {
            showToast(`"${result.game.title}" logged!`)
        } else {
            showToast(result.message, 'error')
        }
        return result
    }

    const handleDeleteGame = async (id, title) => {
        const result = await deleteGame(id)
        if (result.success) {
            showToast(`"${title}" removed`)
        } else {
            showToast(result.message, 'error')
        }
    }

    return (
        <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-8 md:py-10">

            {/* ── Page Header ── */}
            <div className="flex flex-wrap items-center gap-3 mb-6 pb-4 border-b border-[#2a2a35]">

                <h2
                    className="font-black text-2xl md:text-3xl tracking-widest uppercase text-white"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                    My Library
                </h2>

                <span className="font-mono text-xs text-[#7a7a90]">
                    {filteredGames.length} games
                </span>

                {/* Search and button — full width on mobile */}
                <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">

                    {/* Search */}
                    <div className="relative flex-1 sm:flex-none">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#7a7a90] text-sm">
                            🔍
                        </span>
                        <input
                            type="text"
                            placeholder="Search games..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full sm:w-52 bg-[#111118] border border-[#2a2a35] rounded
                         px-3 py-2 pl-7 text-sm text-white
                         focus:outline-none focus:border-[#c8ff57]
                         placeholder:text-[#7a7a90] transition-colors"
                        />
                    </div>

                    {/* Log Game button */}
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-2 bg-[#c8ff57] text-black font-bold text-sm
                       rounded hover:bg-[#d4ff6e] transition-all whitespace-nowrap"
                    >
                        + Log Game
                    </button>

                </div>
            </div>

            {/* ── Filter Buttons ── */}
            <div className="overflow-x-auto pb-2 mb-2">
                <FilterBar
                    activeFilter={activeFilter}
                    onFilter={setActiveFilter}
                    counts={counts}
                />
            </div>

            {/* ── Loading State ── */}
            {loading && (
                <div className="text-center py-20 text-[#7a7a90] font-mono text-sm">
                    Loading your library...
                </div>
            )}

            {/* ── Error State ── */}
            {error && !loading && (
                <div className="text-center py-20 text-[#ff5c5c] font-mono text-sm">
                    ❌ {error}
                </div>
            )}

            {/* ── Game Grid ── */}
            {!loading && !error && (
                filteredGames.length > 0 ? (
                    // Responsive grid
                    // 2 columns on mobile
                    // 3 columns on tablet
                    // 4-5 columns on desktop
                    <div className="grid grid-cols-2 sm:grid-cols-3 
                          lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                        {filteredGames.map(game => (
                            <GameCard
                                key={game._id}
                                game={game}
                                onDelete={() => handleDeleteGame(game._id, game.title)}
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

            {/* ── Modal ── */}
            {showModal && (
                <AddGameModal
                    onClose={() => setShowModal(false)}
                    onAdd={handleAddGame}
                />
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