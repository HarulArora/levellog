// GameCard.jsx
// ONE single game card shown in the grid
// Updated to support IGDB cover images + clicking opens game detail page

import { useNavigate } from 'react-router-dom'

function GameCard({ game, onDelete }) {

    const navigate = useNavigate()

    // Status config — each status has a color and label
    const statusConfig = {
        playing: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Playing' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
    }

    // Platform colors
    const platformConfig = {
        PC: 'text-[#5c9fff] border-[#5c9fff]/35',
        PS: 'text-[#5daeff] border-[#5daeff]/35',
        Xbox: 'text-[#5dc55d] border-[#5dc55d]/35',
        SW: 'text-[#ff6464] border-[#ff6464]/35',
        Mac: 'text-[#aaaaaa] border-white/10',
    }

    const sc = statusConfig[game.status] || statusConfig.planned

    // ── IMAGE URL ──
    const imageUrl = game.cover
        ? game.cover
        : game.steamId
            ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamId}/header.jpg`
            : null

    // ── Navigate to game detail page if igdbId exists ──
    const handleCardClick = () => {
        if (game.igdbId) {
            navigate(`/game/${game.igdbId}`)
        }
    }

    return (
        <div
            onClick={handleCardClick}
            className={`bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden
                        group hover:border-[#c8ff57] hover:-translate-y-1
                        transition-all duration-200
                        hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]
                        ${game.igdbId ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ animation: 'fadeUp 0.3s ease backwards' }}
        >

            {/* ── Game Cover Image ── */}
            <div
                className="h-[110px] bg-cover bg-top bg-[#18181f] relative overflow-hidden"
                style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'none' }}
            >
                {!imageUrl && (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                        🎮
                    </div>
                )}

                {/* Dark gradient at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-10
                                bg-gradient-to-t from-[#111118] to-transparent" />

                {/* Status badge */}
                <div className={`absolute top-2 left-2 font-mono text-[10px] uppercase
                                 tracking-wider px-2 py-[2px] rounded-sm ${sc.bg} ${sc.color}`}>
                    {sc.label}
                </div>

                {/* "View Details" overlay — only if igdbId exists */}
                {game.igdbId && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50
                                    transition-all flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity
                                         font-mono text-[10px] text-white uppercase tracking-wider
                                         bg-black/60 px-2 py-1 rounded">
                            View Details
                        </span>
                    </div>
                )}

            </div>

            {/* ── Card Body ── */}
            <div className="p-3">

                {/* Game title */}
                <div className="font-semibold text-sm mb-2 truncate text-white
                                group-hover:text-[#c8ff57] transition-colors">
                    {game.title}
                </div>

                {/* Platform badges */}
                <div className="flex flex-wrap gap-1 mb-3">
                    {game.platforms?.map(platform => (
                        <span
                            key={platform}
                            className={`font-mono text-[9px] px-1 py-[1px] rounded
                                        border bg-[#18181f]
                                        ${platformConfig[platform] || 'text-[#7a7a90] border-[#2a2a35]'}`}
                        >
                            {platform}
                        </span>
                    ))}
                </div>

                {/* Bottom row — genre left, rating right */}
                <div className="flex justify-between items-center">
                    <span className="text-[#7a7a90] font-mono text-[10px] uppercase tracking-wider">
                        {game.genre}
                    </span>

                    {game.rating > 0 ? (
                        <span
                            className="font-black text-lg text-[#c8ff57] leading-none tracking-wide"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            {game.rating}
                            <small className="font-mono text-[10px] text-[#7a7a90] font-normal">
                                /10
                            </small>
                        </span>
                    ) : (
                        <span className="text-[#7a7a90] font-mono text-xs">—</span>
                    )}
                </div>

                {/* Hours tracked */}
                {game.hours > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#2a2a35]
                                    text-[#7a7a90] font-mono text-[10px]">
                        ⏱ {game.hours}h tracked
                    </div>
                )}

                {/* ── Delete Button ── */}
                {/* e.stopPropagation() prevents card click from firing */}
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onDelete()
                    }}
                    className="mt-2 w-full py-1 text-[10px] font-mono uppercase tracking-wider
                               text-[#ff5c5c] border border-[#ff5c5c]/20 rounded
                               hover:bg-[#ff5c5c]/10 transition-all
                               opacity-0 group-hover:opacity-100"
                >
                    Remove
                </button>

            </div>
        </div>
    )
}

export default GameCard