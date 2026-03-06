// HeroSection.jsx
// This is the big banner section users see first on the home page
// It has two sides — left (text + buttons) and right (game preview cards)

function HeroSection() {

    // This is sample data — later this will come from your real database
    // Think of this as fake data just to see how it looks on screen
    const previewGames = [
        {
            id: 1,
            title: "Elden Ring",
            status: "playing",
            rating: 9,
            platform: "PC",
            // Steam game ID — used to get the game cover image automatically
            steamId: "1245620"
        },
        {
            id: 2,
            title: "God of War",
            status: "completed",
            rating: 10,
            platform: "PS",
            steamId: "1593500"
        },
        {
            id: 3,
            title: "Cyberpunk 2077",
            status: "paused",
            rating: 8,
            platform: "PC",
            steamId: "1091500"
        },
        {
            id: 4,
            title: "Hollow Knight",
            status: "planned",
            rating: 0,
            platform: "PC",
            steamId: "367520"
        },
    ]

    return (
        // The outer wrapper — full width, centered content, padding on sides
        <div className="max-w-[1200px] mx-auto px-10 py-20 grid grid-cols-2 gap-16 items-center">

            {/* ── LEFT SIDE ── */}
            <div>

                {/* Small tag at the top */}
                <div className="inline-block bg-[#c8ff57]/10 border border-[#c8ff57]/30 text-[#c8ff57] 
                        font-mono text-xs tracking-widest px-3 py-1 rounded-sm mb-5 uppercase">
                    Your Game Diary
                </div>

                {/* Big heading */}
                {/* clamp() means — minimum 3.5rem, ideal 7vw, maximum 5.5rem */}
                {/* This makes the text responsive — smaller on small screens */}
                <h1 className="font-black uppercase leading-none tracking-wide mb-5"
                    style={{ fontSize: 'clamp(3.5rem, 7vw, 5.5rem)', fontFamily: 'Bebas Neue, sans-serif' }}>
                    Track Every <br />
                    <em className="not-italic text-[#c8ff57]">Game You Play</em>
                </h1>

                {/* Description text */}
                <p className="text-[#7a7a90] leading-relaxed text-base mb-8 max-w-md">
                    Log your games, track your hours, rate your experiences.
                    Your personal gaming journal — built for gamers who care
                    about what they play.
                </p>

                {/* Two buttons side by side */}
                <div className="flex gap-3">
                    <button className="px-6 py-3 bg-[#c8ff57] text-black font-bold text-sm rounded 
                             hover:bg-[#d4ff6e] transition-all hover:shadow-[0_0_20px_rgba(200,255,87,0.3)]">
                        Start Logging Free
                    </button>
                    <button className="px-6 py-3 border border-[#2a2a35] text-white font-semibold text-sm 
                             rounded hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">
                        See How It Works
                    </button>
                </div>

                {/* Stats row — numbers below the buttons */}
                <div className="flex gap-8 mt-10">
                    {/* Each stat is its own small block */}
                    {[
                        { number: '12K+', label: 'Games Logged' },
                        { number: '3.4K', label: 'Active Users' },
                        { number: '180K', label: 'Hours Tracked' },
                    ].map(stat => (
                        <div key={stat.label}>
                            {/* Big number */}
                            <div className="text-[#c8ff57] font-black text-3xl leading-none tracking-wider"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {stat.number}
                            </div>
                            {/* Label below number */}
                            <div className="text-[#7a7a90] text-xs uppercase tracking-widest mt-1 font-mono">
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            {/* ── RIGHT SIDE — Game Preview Cards ── */}
            <div className="flex flex-col gap-3">
                {previewGames.map((game, index) => (
                    <HeroGameCard
                        key={game.id}
                        game={game}
                        // index is the position (0,1,2,3) — used for animation delay
                        index={index}
                    />
                ))}
            </div>

        </div>
    )
}


// ─────────────────────────────────────────────
// HeroGameCard — the small game cards on the right
// We define it in same file since it's only used here
// ─────────────────────────────────────────────

function HeroGameCard({ game, index }) {

    // Status colors — each status has its own color
    const statusColors = {
        playing: { bg: 'bg-[#c8ff57]/15', text: 'text-[#c8ff57]' },
        completed: { bg: 'bg-[#5c9fff]/15', text: 'text-[#5c9fff]' },
        planned: { bg: 'bg-[#ff9f5c]/15', text: 'text-[#ff9f5c]' },
        dropped: { bg: 'bg-[#ff5c5c]/15', text: 'text-[#ff5c5c]' },
        paused: { bg: 'bg-[#c45cff]/15', text: 'text-[#c45cff]' },
    }

    // Platform colors
    const platformColors = {
        PC: 'text-[#5c9fff] border-[#5c9fff]/35',
        PS: 'text-[#5daeff] border-[#5daeff]/35',
        Xbox: 'text-[#5dc55d] border-[#5dc55d]/35',
        SW: 'text-[#ff6464] border-[#ff6464]/35',
    }

    // Get the right colors for this game's status
    const sc = statusColors[game.status] || statusColors.planned
    const pc = platformColors[game.platform] || 'text-[#7a7a90] border-[#2a2a35]'

    // Steam CDN — this URL gives us the game cover image using steamId
    const imageUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamId}/header.jpg`

    return (
        // The card wrapper
        // style animationDelay makes each card appear slightly after the previous one
        <div
            className="bg-[#111118] border border-[#2a2a35] rounded-lg flex items-center 
                 gap-3 overflow-hidden cursor-pointer
                 hover:border-[#c8ff57] hover:translate-x-1 transition-all duration-200"
            style={{
                animation: `slideIn 0.4s ease ${index * 0.1}s backwards`
            }}
        >
            {/* Game cover image */}
            <div
                className="w-[90px] h-[56px] bg-cover bg-center bg-[#18181f] 
                   flex-shrink-0 m-2 rounded"
                style={{ backgroundImage: `url(${imageUrl})` }}
            />

            {/* Game info — title, status, platform */}
            <div className="flex-1 py-2">
                <div className="font-semibold text-sm mb-1">{game.title}</div>
                <div className="flex gap-2 items-center">

                    {/* Status badge */}
                    <span className={`font-mono text-[10px] uppercase tracking-wider 
                           px-2 py-[2px] rounded-sm ${sc.bg} ${sc.text}`}>
                        {game.status}
                    </span>

                    {/* Platform badge */}
                    <span className={`font-mono text-[9px] px-1 py-[1px] rounded 
                           border bg-[#18181f] ${pc}`}>
                        {game.platform}
                    </span>

                </div>
            </div>

            {/* Rating on the far right — only show if rated */}
            {game.rating > 0 && (
                <div className="font-black text-xl text-[#c8ff57] mr-4 tracking-wide"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    {game.rating}
                    <small className="font-mono text-[10px] text-[#7a7a90] font-normal">/10</small>
                </div>
            )}

        </div>
    )
}

export default HeroSection