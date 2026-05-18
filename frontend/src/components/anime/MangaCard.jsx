import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
// import { useSection } from '../../context/SectionState'

const MangaCard = memo(({ manga, onDelete, onEdit, showAvgRating = true, showProgress = true }) => {
    const navigate = useNavigate()

    const statusConfig = {
        reading: { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Reading' },
        completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
        planned: { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned' },
        dropped: { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped' },
        paused: { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused' },
    }

    const typeConfig = {
        TV: 'text-[#5c9fff] border-[#5c9fff]/35',
        Movie: 'text-[#5daeff] border-[#5daeff]/35',
        OVA: 'text-[#5dc55d] border-[#5dc55d]/35',
        Special: 'text-[#ff6464] border-[#ff6464]/35',
        Manga: 'text-[#c45cff] border-[#c45cff]/35',
        OneShot: 'text-[#aaaaaa] border-white/10',
    }

    if (!manga) return null

    let statusKey = manga.status
    if (statusKey === 'playing') {
        statusKey = 'reading'
    }
    const sc = (statusKey && statusConfig[statusKey]) ? statusConfig[statusKey] : null

    const imageUrl = manga.cover || manga.coverImage

    const handleCardClick = () => {
        if (manga.externalId) {
            navigate(`/manga/${manga.externalId}?type=manga`)
        }
    }

    return (
        <div
            onClick={handleCardClick}
            className="group relative bg-[#111118] border border-[#2a2a35] rounded-xl overflow-hidden cursor-pointer hover:border-[#c8ff57] hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex flex-col h-full"
        >
            <div className="aspect-[3/4] relative overflow-hidden bg-[#18181f] shrink-0">
                {imageUrl ? (
                    <img 
                        src={imageUrl} 
                        alt={manga.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                        📖
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d14] via-transparent to-transparent opacity-60" />

                {sc && (
                    <div className={`absolute top-2 left-2 font-mono text-[10px] uppercase
                                     tracking-wider px-2 py-[2px] rounded-sm ${sc.bg} ${sc.color}`}>
                        {sc.label}
                    </div>
                )}

                {/* Rating Badges */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                    {showAvgRating && manga.avgRating > 0 && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#5c9fff]/30 rounded px-2 py-1 flex items-center gap-1 shadow-xl w-[48px] justify-center">
                            <Star size={10} className="text-[#5c9fff] fill-[#5c9fff]" />
                            <span className="font-black text-xs text-[#5c9fff]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{manga.avgRating}</span>
                        </div>
                    )}
                    {manga.rating > 0 && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#c8ff57]/30 rounded px-2 py-1 flex items-center gap-1 shadow-xl w-[48px] justify-center">
                            <span className="font-black text-[8px] text-[#c8ff57] mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>ME</span>
                            <span className="font-black text-xs text-[#c8ff57]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{manga.rating}</span>
                        </div>
                    )}
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <div className="bg-[#c8ff57] text-black px-4 py-2 rounded font-black uppercase text-xs tracking-widest shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        View Details
                    </div>
                </div>
            </div>

            <div className="p-4 flex flex-col flex-1">
                <div className="font-semibold text-sm mb-2 truncate text-white
                                group-hover:text-[#c8ff57] transition-colors">
                    {manga.title}
                </div>

                <div className="flex items-center gap-2 mb-3">
                    <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider flex-shrink-0">
                        {manga.year || 'TBA'}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-[#3a3a4a] flex-shrink-0" />
                    <span className={`font-mono text-[9px] px-1 py-[1px] rounded
                                    border bg-[#18181f]
                                    ${typeConfig['Manga']}`}>
                        Manga
                    </span>
                </div>

                <div className="flex justify-between items-end pb-2">
                    <span className="text-[#94a3b8] font-mono text-[10px] uppercase tracking-wider truncate max-w-[1200px]">
                        {manga.genres?.[0] || manga.genre}
                    </span>
                </div>

                {showProgress && (manga.chaptersRead > 0 || manga.volumesRead > 0) && (
                    <div className="pt-2 border-t border-[#2a2a35] flex flex-col gap-1.5">
                        {/* Volumes Progress */}
                        <div className="flex items-center gap-2">
                            <div className="h-1 flex-1 bg-[#1a1a25] rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-[#5c9fff] transition-all duration-500" 
                                    style={{ width: `${Math.min(100, (manga.volumesRead / (manga.totalVolumes || 1)) * 100)}%` }} 
                                />
                            </div>
                            <span className="text-[#5c9fff] font-mono text-[8px] min-w-[32px] text-right">
                                V{manga.volumesRead || 0}/{manga.totalVolumes || '?'}
                            </span>
                        </div>
                        {/* Chapters Progress */}
                        <div className="flex items-center gap-2">
                            <div className="h-1 flex-1 bg-[#1a1a25] rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-[#c8ff57] transition-all duration-500" 
                                    style={{ width: `${Math.min(100, (manga.chaptersRead / (manga.totalChapters || 1)) * 100)}%` }} 
                                />
                            </div>
                            <span className="text-[#7a7a90] font-mono text-[8px] min-w-[32px] text-right">
                                C{manga.chaptersRead || 0}/{manga.totalChapters || '?'}
                            </span>
                        </div>
                    </div>
                )}

                {(onEdit || onDelete) && (
                    <div className="mt-auto pt-2 flex gap-1">
                        {onEdit && (
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
                        )}
                        {onDelete && (
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
                        )}
                    </div>
                )}
            </div>
        </div>
    )
})

export default MangaCard


