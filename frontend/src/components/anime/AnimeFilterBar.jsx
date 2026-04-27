import { useSection } from '../../context/SectionContext'

function AnimeFilterBar({ activeFilter, onFilter, counts }) {
    const { animeSubSection } = useSection()

    const filters = [
        { key: 'all', label: 'All' },
        { key: 'playing', label: animeSubSection === 'manga' ? 'Reading' : 'Watching' },
        { key: 'completed', label: 'Completed' },
        { key: 'planned', label: 'Planned' },
        { key: 'paused', label: 'Paused' },
        { key: 'dropped', label: 'Dropped' },
    ]

    return (
        <div className="flex gap-2 flex-wrap items-center mb-6">
            {filters.map(f => (
                <button
                    key={f.key}
                    onClick={() => onFilter(f.key)}
                    className={`px-3 py-[6px] rounded font-mono text-xs uppercase tracking-wider
                     border transition-all duration-200
                     ${activeFilter === f.key
                            ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/06'
                            : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57] hover:text-[#c8ff57]'
                        }`}
                >
                    {f.label}
                    {counts && counts[f.key] !== undefined && (
                        <span className="ml-1 opacity-60">
                            ({counts[f.key]})
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
}

export default AnimeFilterBar
