// Stats.jsx
// Shows user's gaming statistics with charts
// Uses Recharts library for visualization

import { useMemo } from 'react'
import useGames from '../hooks/useGames'
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'

function Stats() {

    const { games, loading } = useGames()

    // ── CALCULATE ALL STATS ──
    // useMemo → only recalculates when games changes
    const stats = useMemo(() => {

        if (games.length === 0) return null

        // ── Overview numbers ──
        const totalGames = games.length
        const totalHours = games.reduce((sum, g) => sum + (g.hours || 0), 0)
        const ratedGames = games.filter(g => g.rating > 0)
        const avgRating = ratedGames.length > 0
            ? (ratedGames.reduce((sum, g) => sum + g.rating, 0) / ratedGames.length).toFixed(1)
            : 0
        const completedGames = games.filter(g => g.status === 'completed').length

        // ── Status breakdown for pie chart ──
        const statusCount = {}
        games.forEach(g => {
            statusCount[g.status] = (statusCount[g.status] || 0) + 1
        })

        const statusData = [
            { name: 'Playing', value: statusCount.playing || 0, color: '#c8ff57' },
            { name: 'Completed', value: statusCount.completed || 0, color: '#5c9fff' },
            { name: 'Planned', value: statusCount.planned || 0, color: '#ff9f5c' },
            { name: 'Paused', value: statusCount.paused || 0, color: '#c45cff' },
            { name: 'Dropped', value: statusCount.dropped || 0, color: '#ff5c5c' },
        ].filter(s => s.value > 0)
        // filter → only show statuses that have at least 1 game

        // ── Genre breakdown for bar chart ──
        const genreCount = {}
        games.forEach(g => {
            if (g.genre && g.genre !== 'Unknown') {
                genreCount[g.genre] = (genreCount[g.genre] || 0) + 1
            }
        })

        // Sort by count and take top 6
        const genreData = Object.entries(genreCount)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6)

        // ── Top rated games ──
        const topRated = [...games]
            .filter(g => g.rating > 0)
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 5)

        return {
            totalGames,
            totalHours,
            avgRating,
            completedGames,
            statusData,
            genreData,
            topRated
        }

    }, [games])

    // ── LOADING STATE ──
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-[#7a7a90] font-mono text-sm">
                    Loading stats...
                </div>
            </div>
        )
    }

    // ── EMPTY STATE ──
    if (!stats || games.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">📊</div>
                <div className="text-white font-black text-2xl tracking-widest uppercase"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    No Stats Yet
                </div>
                <div className="text-[#7a7a90] font-mono text-sm text-center max-w-sm">
                    Add some games to your library first and your stats will appear here!
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-8 md:py-10">

            {/* ── Page Header ── */}
            <div className="flex items-baseline gap-4 mb-8 pb-4 border-b border-[#2a2a35]">
                <h2
                    className="font-black text-2xl md:text-3xl tracking-widest uppercase"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                    My Stats
                </h2>
                <span className="font-mono text-xs text-[#7a7a90]">
                    {stats.totalGames} games tracked
                </span>
            </div>

            {/* ── Overview Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

                {[
                    {
                        label: 'Total Games',
                        value: stats.totalGames,
                        icon: '🎮',
                        color: 'text-[#c8ff57]'
                    },
                    {
                        label: 'Hours Played',
                        value: stats.totalHours,
                        icon: '⏱',
                        color: 'text-[#5c9fff]'
                    },
                    {
                        label: 'Avg Rating',
                        value: `${stats.avgRating}/10`,
                        icon: '⭐',
                        color: 'text-[#ff9f5c]'
                    },
                    {
                        label: 'Completed',
                        value: stats.completedGames,
                        icon: '🏆',
                        color: 'text-[#c45cff]'
                    },
                ].map(card => (
                    <div
                        key={card.label}
                        className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5
                       hover:border-[#c8ff57]/30 transition-all"
                    >
                        <div className="text-2xl mb-3">{card.icon}</div>
                        <div
                            className={`font-black text-3xl md:text-4xl leading-none
                         tracking-wider mb-1 ${card.color}`}
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            {card.value}
                        </div>
                        <div className="font-mono text-[11px] text-[#7a7a90] uppercase tracking-wider">
                            {card.label}
                        </div>
                    </div>
                ))}

            </div>

            {/* ── Charts Row ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

                {/* ── Status Donut Chart ── */}
                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">

                    <h3
                        className="font-black text-lg tracking-widest uppercase mb-6"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                        Games by Status
                    </h3>

                    {/* ResponsiveContainer → chart resizes with its parent div */}
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie
                                data={stats.statusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}   // innerRadius makes it a donut not a pie
                                outerRadius={90}
                                paddingAngle={3}   // small gap between slices
                                dataKey="value"
                            >
                                {/* Render each slice with its color */}
                                {stats.statusData.map((entry, index) => (
                                    <Cell key={index} fill={entry.color} />
                                ))}
                            </Pie>
                            {/* Tooltip → shows data when user hovers a slice */}
                            <Tooltip
                                contentStyle={{
                                    background: '#18181f',
                                    border: '1px solid #2a2a35',
                                    borderRadius: '6px',
                                    color: '#e8e8f0',
                                    fontFamily: 'DM Mono',
                                    fontSize: '12px'
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>

                    {/* Legend — shows what each color means */}
                    <div className="flex flex-wrap gap-3 mt-2 justify-center">
                        {stats.statusData.map(s => (
                            <div key={s.name} className="flex items-center gap-1">
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ background: s.color }}
                                />
                                <span className="font-mono text-[10px] text-[#7a7a90]">
                                    {s.name} ({s.value})
                                </span>
                            </div>
                        ))}
                    </div>

                </div>

                {/* ── Genre Bar Chart ── */}
                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">

                    <h3
                        className="font-black text-lg tracking-widest uppercase mb-6"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                        Top Genres
                    </h3>

                    {stats.genreData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                                data={stats.genreData}
                                // margin gives space for axis labels
                                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                            >
                                {/* Grid lines */}
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#2a2a35"
                                    vertical={false}
                                />
                                {/* X axis — genre names */}
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: '#7a7a90', fontSize: 10, fontFamily: 'DM Mono' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                {/* Y axis — counts */}
                                <YAxis
                                    tick={{ fill: '#7a7a90', fontSize: 10, fontFamily: 'DM Mono' }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: '#18181f',
                                        border: '1px solid #2a2a35',
                                        borderRadius: '6px',
                                        color: '#e8e8f0',
                                        fontFamily: 'DM Mono',
                                        fontSize: '12px'
                                    }}
                                    cursor={{ fill: 'rgba(200,255,87,0.05)' }}
                                />
                                {/* The actual bars */}
                                <Bar
                                    dataKey="value"
                                    fill="#c8ff57"
                                    radius={[4, 4, 0, 0]}
                                // radius → rounded top corners on bars
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[220px]
                            text-[#7a7a90] font-mono text-xs">
                            Add games with genres to see this chart
                        </div>
                    )}

                </div>

            </div>

            {/* ── Top Rated Games ── */}
            {stats.topRated.length > 0 && (
                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-5">

                    <h3
                        className="font-black text-lg tracking-widest uppercase mb-5"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                        Top Rated Games
                    </h3>

                    <div className="flex flex-col gap-3">
                        {stats.topRated.map((game, index) => (
                            <div
                                key={game._id}
                                className="flex items-center gap-4 p-3 rounded-lg
                           bg-[#18181f] border border-[#2a2a35]
                           hover:border-[#c8ff57]/30 transition-all"
                            >

                                {/* Rank number */}
                                <div
                                    className="font-black text-2xl text-[#2a2a35] w-8 text-center flex-shrink-0"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                    {index + 1}
                                </div>

                                {/* Game cover */}
                                {game.cover ? (
                                    <img
                                        src={game.cover}
                                        alt={game.title}
                                        className="w-12 h-8 object-cover rounded flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-12 h-8 bg-[#2a2a35] rounded flex-shrink-0
                                  flex items-center justify-center text-sm">
                                        🎮
                                    </div>
                                )}

                                {/* Game info */}
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate">
                                        {game.title}
                                    </div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] mt-1">
                                        {game.genre} · {game.status}
                                    </div>
                                </div>

                                {/* Rating */}
                                <div
                                    className="font-black text-2xl text-[#c8ff57] flex-shrink-0"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                    {game.rating}
                                    <small className="font-mono text-[10px] text-[#7a7a90] font-normal">
                                        /10
                                    </small>
                                </div>

                            </div>
                        ))}
                    </div>

                </div>
            )}

        </div>
    )
}

export default Stats