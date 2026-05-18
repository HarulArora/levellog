import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { useSection } from '../../context/SectionState'

const MovieCard = memo(({ movie, onDelete, onEdit, showAvgRating = true }) => {
    const navigate = useNavigate()

    const statusConfig = {
        watching: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Watching' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
    }

    const typeConfig = {
        Movie: 'text-[#5c9fff] border-[#5c9fff]/35',
        TV: 'text-[#5daeff] border-[#5daeff]/35',
    }

    let statusKey = movie.status
    if (statusKey === 'playing') {
        statusKey = 'watching'
    }
    const sc = (statusKey && statusConfig[statusKey]) ? statusConfig[statusKey] : null

    const imageUrl = movie.cover || movie.coverImage

    const handleCardClick = () => {
        const extId = Number(movie.externalId)
        if (movie.externalId && !isNaN(extId)) {
            const path = (movie.type === 'tv' || movie.mediaType === 'tv') ? 'tv' : 'movies'
            navigate(`/${path}/${movie.externalId}`)
        }
    }

    return (
        <div
            onClick={handleCardClick}
            className={`bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden
                        flex flex-col h-full
                        group hover:border-[#c8ff57] hover:-translate-y-1
                        transition-all duration-200
                        hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]
                        ${movie.externalId ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ animation: 'fadeUp 0.3s ease backwards' }}
        >
            <div className="aspect-[3/4] relative overflow-hidden bg-[#18181f] shrink-0">
                {imageUrl ? (
                    <img 
                        src={imageUrl} 
                        alt={movie.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                        🎬
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-[#111118] via-transparent to-transparent opacity-60" />

                {sc && (
                    <div className={`absolute top-2 left-2 font-mono text-[10px] uppercase
                                     tracking-wider px-2 py-[2px] rounded-sm ${sc.bg} ${sc.color}`}>
                        {sc.label}
                    </div>
                )}

                {/* Rating Badges */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                    {showAvgRating && movie.avgRating > 0 && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#5c9fff]/30 rounded px-2 py-1 flex items-center gap-1 shadow-xl w-[48px] justify-center">
                            <Star size={10} style={{ color: '#5c9fff', fill: '#5c9fff' }} />
                            <span className="font-black text-xs text-[#5c9fff]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{movie.avgRating}</span>
                        </div>
                    )}
                    {movie.rating > 0 && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#c8ff57]/30 rounded px-2 py-1 flex items-center gap-1 shadow-xl w-[48px] justify-center">
                            <span className="font-black text-[8px] text-[#c8ff57] mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>ME</span>
                            <span className="font-black text-xs text-[#c8ff57]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{movie.rating}</span>
                        </div>
                    )}
                </div>

                {movie.externalId && (
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

            <div className="p-2.5 flex flex-col flex-1">
                <div className="font-semibold text-sm mb-2 truncate text-white
                                group-hover:text-[#c8ff57] transition-colors">
                    {movie.title}
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                    <span className={`font-mono text-[9px] px-1 py-[1px] rounded
                                    border bg-[#18181f]
                                    ${typeConfig['Movie']}`}>
                        Movie
                    </span>
                </div>

                <div className="flex justify-between items-end">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[#94a3b8] font-mono text-[10px] uppercase tracking-wider truncate max-w-[100px]">
                            {movie.genre}
                        </span>
                        {movie.runtime > 0 && (
                            <span className="text-[#c8ff57] font-mono text-[9px] uppercase tracking-widest">
                                ⏱ {movie.runtime}m tracked
                            </span>
                        )}
                    </div>
                </div>

                <div className="mt-auto pt-2 flex gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onEdit()
                        }}
                        className="flex-1 py-1 text-[10px] font-mono uppercase tracking-wider
                                   text-[#c8ff57] border border-[#c8ff57]/20 rounded
                                   hover:bg-[#c8ff57]/10 transition-all"
                    >
                        Edit
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete()
                        }}
                        className="flex-1 py-1 text-[10px] font-mono uppercase tracking-wider
                                   text-[#ff5c5c] border border-[#ff5c5c]/20 rounded
                                   hover:bg-[#ff5c5c]/10 transition-all"
                    >
                        Remove
                    </button>
                </div>
            </div>
        </div>
    )
})

export default MovieCard


