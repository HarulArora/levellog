// Library.jsx
// Now uses real data from MongoDB via our useGames hook
// Instead of fake sampleGames data

import { useState, useMemo } from 'react'
import useGames from '../hooks/useGames'
import GameCard from '../components/library/GameCard'
import FilterBar from '../components/library/FilterBar'
import AddGameModal from '../components/library/AddGameModal'
import Toast from '../components/ui/Toast'

function Library() {

    // ── GET REAL DATA ──
    // useGames hook fetches games from your backend automatically
    const { games, loading, error, addGame, deleteGame } = useGames()

    // ── LOCAL UI STATE ──
    const [activeFilter, setActiveFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')

    // Controls whether Add Game modal is open
    const [showModal, setShowModal] = useState(false)

    // Toast notification state
    // null = no toast, { message, type } = show toast
    const [toast, setToast] = useState(null)


    // ── HELPER — Show a toast message ──
    const showToast = (message, type = 'success') => {
        setToast({ message, type })
    }


    // ── COUNTS ──
    const counts = useMemo(() => {
        const c = { all: games.length }
        games.forEach(g => {
            c[g.status] = (c[g.status] || 0) + 1
        })
        return c
    }, [games])


    // ── FILTERED GAMES ──
    const filteredGames = useMemo(() => {
        return games
            .filter(game => activeFilter === 'all' || game.status === activeFilter)
            .filter(game => !searchQuery || game.title.toLowerCase().includes(searchQuery.toLowerCase()))
    }, [games, activeFilter, searchQuery])


    // ── HANDLE ADD GAME ──
    const handleAddGame = async (gameData) => {
        const result = await addGame(gameData)
        if (result.success) {
            showToast(`"${result.game.title}" logged!`)
        } else {
            showToast(result.message, 'error')
        }
        return result
    }


    // ── HANDLE DELETE GAME ──
    const handleDeleteGame = async (id, title) => {
        const result = await deleteGame(id)
        if (result.success) {
            showToast(`"${title}" removed from library`)
        } else {
            showToast(result.message, 'error')
        }
    }


    return (
        <div className="max-w-[1200px] mx-auto px-10 py-10">

            {/* ── Page Header ── */}
            <div className="flex items-baseline gap-4 mb-7 pb-4 border-b border-[#2a2a35]">

                <h2 className="font-black text-3xl tracking-widest uppercase"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    My Library
                </h2>

                <span className="font-mono text-xs text-[#7a7a90]">
                    {filteredGames.length} games
                </span>

                {/* Search */}
                <div className="relative ml-auto">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#7a7a90] text-sm">
                        🔍
                    </span>
                    <input
                        type="text"
                        placeholder="Search games..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="bg-[#111118] border border-[#2a2a35] rounded px-3 py-2 pl-7
                       text-sm text-white font-sans w-52
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

            {/* ── Filter Buttons ── */}
            <FilterBar
                activeFilter={activeFilter}
                onFilter={setActiveFilter}
                counts={counts}
            />

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
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                        {filteredGames.map(game => (
                            <GameCard
                                key={game._id}
                                game={game}
                                // Pass delete handler to each card
                                onDelete={() => handleDeleteGame(game._id, game.title)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-[#7a7a90]">
                        <div className="text-4xl mb-3">🎮</div>
                        <div className="font-mono text-sm">No games found</div>
                        <div className="font-mono text-xs mt-1 opacity-60">
                            {games.length === 0
                                ? 'Add your first game!'
                                : 'Try a different filter'}
                        </div>
                    </div>
                )
            )}

            {/* ── Add Game Modal ── */}
            {showModal && (
                <AddGameModal
                    onClose={() => setShowModal(false)}
                    onAdd={handleAddGame}
                />
            )}

            {/* ── Toast Notification ── */}
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