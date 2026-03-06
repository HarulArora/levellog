// FilterBar.jsx
// The row of buttons that filter games by status
// It receives the current active filter and a function to change it

// activeFilter → which filter is currently selected (e.g. "playing")
// onFilter → function to call when user clicks a filter button
// counts → how many games in each status category
function FilterBar({ activeFilter, onFilter, counts }) {

    // All the filter options
    // 'all' shows every game, others filter by status
    const filters = [
        { key: 'all', label: 'All' },
        { key: 'playing', label: 'Playing' },
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
                    // When clicked — call onFilter with this filter's key
                    onClick={() => onFilter(f.key)}
                    className={`px-3 py-[6px] rounded font-mono text-xs uppercase tracking-wider
                     border transition-all duration-200
                     ${activeFilter === f.key
                            // Active state — highlighted in green
                            ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/06'
                            // Inactive state — grey
                            : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57] hover:text-[#c8ff57]'
                        }`}
                >
                    {/* Label + count in brackets */}
                    {f.label}
                    {/* Show count next to label if we have count data */}
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

export default FilterBar