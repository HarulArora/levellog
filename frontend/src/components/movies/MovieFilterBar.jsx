function MovieFilterBar({ activeFilter, onFilter, counts }) {
    const filters = [
        { key: 'all', label: 'All' },
        { key: 'playing', label: 'Watching' },
        { key: 'completed', label: 'Finished' },
        { key: 'planned', label: 'Watchlist' },
        { key: 'paused', label: 'On Hold' },
        { key: 'dropped', label: 'Dropped' },
    ]

    return (
        <div className="flex gap-3 items-center min-w-max py-1">
            {filters.map(f => (
                <button
                    key={f.key}
                    onClick={() => onFilter(f.key)}
                    className={`group relative px-5 py-2.5 rounded-xl font-mono text-[10px] uppercase tracking-[2px] transition-all duration-300 overflow-hidden
                     ${activeFilter === f.key
                            ? 'text-black font-bold'
                            : 'text-[#9a9ab0] hover:text-white'
                        }`}
                >
                    {/* Background Layer */}
                    <div className={`absolute inset-0 transition-all duration-300 ${
                        activeFilter === f.key 
                            ? 'bg-[#c8ff57] opacity-100 shadow-[0_0_15px_rgba(200,255,87,0.3)]' 
                            : 'bg-white/5 opacity-0 group-hover:opacity-100'
                    }`} />
                    
                    {/* Border Layer */}
                    <div className={`absolute inset-0 border rounded-xl transition-all duration-300 ${
                        activeFilter === f.key ? 'border-[#c8ff57]' : 'border-[#2a2a35] group-hover:border-[#4a4a5e]'
                    }`} />

                    <span className="relative z-10 flex items-center gap-2">
                        {f.label}
                        {counts && counts[f.key] !== undefined && (
                            <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold transition-all ${
                                activeFilter === f.key 
                                    ? 'bg-black/20 text-black' 
                                    : 'bg-[#1e1e28] text-[#7a7a90] group-hover:text-white group-hover:bg-[#2a2a35]'
                            }`}>
                                {counts[f.key]}
                            </span>
                        )}
                    </span>
                </button>
            ))}
        </div>
    )
}

export default MovieFilterBar
