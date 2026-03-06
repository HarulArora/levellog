import { useState, useEffect, useRef } from 'react'
import api from '../../api/axios'

function GameSearch({ onSelect }) {

    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [showResults, setShowResults] = useState(false)
    const timerRef = useRef(null)

    useEffect(() => {
        if (query.length < 2) {
            setResults([])
            setShowResults(false)
            return
        }

        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(async () => {
            setLoading(true)
            try {
                const res = await api.get(`/igdb/search?q=${query}`)
                setResults(res.data.games)
                setShowResults(true)
            } catch (err) {
                console.error('Search error:', err)
            } finally {
                setLoading(false)
            }
        }, 400)

        return () => clearTimeout(timerRef.current)
    }, [query])

    const handleSelect = (game) => {
        onSelect(game)
        setQuery('')
        setResults([])
        setShowResults(false)
    }

    return (
        <div className="relative">

            {/* Search Input */}
            <input
                type="text"
                placeholder="Search for a game..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setShowResults(true)}
                className="w-full bg-[#18181f] border border-[#c8ff57]/50 rounded
                   px-3 py-2 text-sm text-white
                   focus:outline-none focus:border-[#c8ff57]
                   placeholder:text-[#7a7a90] transition-colors"
            />

            {/* Loading */}
            {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2
                        text-[#7a7a90] font-mono text-xs">
                    searching...
                </div>
            )}

            {/* Results Dropdown */}
            {showResults && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1
                        bg-[#18181f] border border-[#2a2a35] rounded-lg
                        overflow-hidden z-50 shadow-2xl">
                    {results.map(game => (
                        <div
                            key={game.igdbId}
                            onClick={() => handleSelect(game)}
                            className="flex items-center gap-3 p-3 cursor-pointer
                         hover:bg-[#c8ff57]/05 transition-colors
                         border-b border-[#2a2a35] last:border-0"
                        >
                            {/* Cover image */}
                            {game.cover ? (
                                <img
                                    src={game.cover}
                                    alt={game.title}
                                    className="w-10 h-14 object-cover rounded flex-shrink-0"
                                />
                            ) : (
                                <div className="w-10 h-14 bg-[#2a2a35] rounded flex-shrink-0
                                flex items-center justify-center text-lg">
                                    🎮
                                </div>
                            )}

                            {/* Game info */}
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm truncate">
                                    {game.title}
                                </div>
                                <div className="font-mono text-[10px] text-[#7a7a90] mt-1">
                                    {game.genres.slice(0, 2).join(' · ')}
                                    {game.releaseYear && ` · ${game.releaseYear}`}
                                </div>
                            </div>

                        </div>
                    ))}
                </div>
            )}

        </div>
    )
}

export default GameSearch