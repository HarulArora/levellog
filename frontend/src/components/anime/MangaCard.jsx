import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
// import { useSection } from '../../context/SectionContext'

const MangaCard = memo(({ anime: manga, onDelete, onEdit }) => {
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

    let statusKey = manga.status
    if (statusKey === 'playing') {
        statusKey = 'reading'
    }
    const sc = statusConfig[statusKey] || statusConfig.planned

    const imageUrl = manga.cover || manga.coverImage

    const handleCardClick = () => {
        if (manga.externalId) {
            navigate(`/manga/${manga.externalId}`)
        }
    }

    return (
        <div
            onClick={handleCardClick}
            className={`bg-[#111118] border border-[#2a2a35] rounded-lg overflow-hidden
                        flex flex-col
                        group hover:border-[#c8ff57] hover:-translate-y-1
                        transition-all duration-200
                        hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]
                        ${manga.externalId ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ animation: 'fadeUp 0.3s ease backwards' }}
        >
            <div className="aspect-video relative overflow-hidden bg-[#18181f] shrink-0">
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

                <div className="absolute inset-0 bg-gradient-to-t from-[#111118] via-transparent to-transparent opacity-60" />

                <div className={`absolute top-2 left-2 font-mono text-[10px] uppercase
                                 tracking-wider px-2 py-[2px] rounded-sm ${sc.bg} ${sc.color}`}>
                    {sc.label}
                </div>

                {manga.externalId && (
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
                    {manga.title}
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                    <span className={`font-mono text-[9px] px-1 py-[1px] rounded
                                    border bg-[#18181f]
                                    ${typeConfig['Manga']}`}>
                        Manga
                    </span>
                </div>

                <div className="mt-auto flex justify-between items-end">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[#94a3b8] font-mono text-[10px] uppercase tracking-wider truncate max-w-[100px]">
                            {manga.genres?.[0] || manga.genre}
                        </span>
                        {manga.chaptersRead > 0 && (
                            <span className="text-[#c8ff57] font-mono text-[9px] uppercase tracking-widest">
                                📖 {manga.chaptersRead} ch tracked
                            </span>
                        )}
                    </div>

                    {manga.rating > 0 ? (
                        <span
                            className="font-black text-2xl text-[#c8ff57] leading-none tracking-wide"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            {manga.rating}
                        </span>
                    ) : (
                        <span className="text-[#7a7a90] font-mono text-xs">—</span>
                    )}
                </div>

                <div className="mt-2 flex gap-1">
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

export default MangaCard

