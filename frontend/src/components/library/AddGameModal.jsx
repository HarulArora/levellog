// AddGameModal.jsx
// Updated with IGDB game search and hours hint text

import { useState } from 'react'
import GameSearch from './GameSearch'

function AddGameModal({ onClose, onAdd }) {

    const [formData, setFormData] = useState({
        title: '',
        genre: '',
        status: 'playing',
        rating: 0,
        hours: '',
        platforms: [],
        cover: '',
        summary: '',
    })

    const [gameSelected, setGameSelected] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const statuses = ['playing', 'completed', 'planned', 'paused', 'dropped']
    const ratings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const platformOptions = ['PC', 'PS', 'Xbox', 'SW', 'Mac', 'Mobile']

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const togglePlatform = (platform) => {
        setFormData(prev => ({
            ...prev,
            platforms: prev.platforms.includes(platform)
                ? prev.platforms.filter(p => p !== platform)
                : [...prev.platforms, platform]
        }))
    }

    // ── WHEN USER SELECTS A GAME FROM IGDB ──
    // Auto fill the form with game data
    const handleGameSelect = (game) => {
        setFormData(prev => ({
            ...prev,
            title: game.title,
            genre: game.genres[0] || '',
            cover: game.cover || '',
            summary: game.summary || '',
            platforms: game.platforms
                .map(p => {
                    if (p.includes('PC')) return 'PC'
                    if (p.includes('PlayStation')) return 'PS'
                    if (p.includes('Xbox')) return 'Xbox'
                    if (p.includes('Nintendo Switch')) return 'SW'
                    if (p.includes('Mac')) return 'Mac'
                    return null
                })
                .filter(Boolean)
                .filter((v, i, a) => a.indexOf(v) === i)
        }))
        setGameSelected(true)
    }

    const handleSubmit = async () => {
        if (!formData.title.trim()) return
        setSubmitting(true)
        const result = await onAdd(formData)
        setSubmitting(false)
        if (result.success) onClose()
    }

    return (
        // Overlay
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50
                 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >

            {/* Modal box */}
            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg
                      w-full max-w-md max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between p-5
                        border-b border-[#2a2a35]">
                    <h3
                        className="font-black text-lg tracking-widest uppercase"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                        Log a Game
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-[#7a7a90] hover:text-white transition-colors text-xl"
                    >
                        ✕
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-5 flex flex-col gap-4">

                    {/* ── IGDB Search ── */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider
                              text-[#7a7a90] mb-2">
                            Search Game
                        </label>
                        <GameSearch onSelect={handleGameSelect} />
                    </div>

                    {/* Selected game preview */}
                    {gameSelected && formData.cover && (
                        <div className="flex items-center gap-3 bg-[#18181f]
                            border border-[#c8ff57]/20 rounded-lg p-3">
                            <img
                                src={formData.cover}
                                alt={formData.title}
                                className="w-12 h-16 object-cover rounded"
                            />
                            <div>
                                <div className="font-semibold text-sm">
                                    {formData.title}
                                </div>
                                <div className="font-mono text-[10px] text-[#7a7a90] mt-1">
                                    {formData.genre}
                                </div>
                                <div className="text-[#c8ff57] font-mono text-[10px] mt-1">
                                    ✓ Game data loaded automatically
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Manual title if no game selected from IGDB */}
                    {!gameSelected && (
                        <div>
                            <label className="block font-mono text-xs uppercase tracking-wider
                                text-[#7a7a90] mb-2">
                                Or enter title manually
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Elden Ring"
                                value={formData.title}
                                onChange={e => handleChange('title', e.target.value)}
                                className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                           px-3 py-2 text-sm text-white
                           focus:outline-none focus:border-[#c8ff57]
                           placeholder:text-[#7a7a90] transition-colors"
                            />
                        </div>
                    )}

                    {/* Status */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider
                              text-[#7a7a90] mb-2">
                            Status
                        </label>
                        <select
                            value={formData.status}
                            onChange={e => handleChange('status', e.target.value)}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                         px-3 py-2 text-sm text-white
                         focus:outline-none focus:border-[#c8ff57]
                         transition-colors"
                        >
                            {statuses.map(s => (
                                <option key={s} value={s}>
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Hours */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider
                              text-[#7a7a90] mb-2">
                            Hours Played
                        </label>
                        <input
                            type="number"
                            placeholder="e.g. 45"
                            min="0"
                            value={formData.hours}
                            onChange={e => handleChange('hours', e.target.value)}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                         px-3 py-2 text-sm text-white
                         focus:outline-none focus:border-[#c8ff57]
                         placeholder:text-[#7a7a90] transition-colors"
                        />
                        {/* Hint text — makes users feel comfortable entering estimates */}
                        <p className="text-[#7a7a90] font-mono text-[10px] mt-1">
                            💡 Your estimate is fine — this is your personal diary
                        </p>
                    </div>

                    {/* Rating */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider
                              text-[#7a7a90] mb-2">
                            Your Rating
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {ratings.map(r => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => handleChange('rating', r)}
                                    className={`w-9 h-9 rounded font-mono text-sm font-bold
                             border transition-all
                             ${formData.rating === r
                                            ? 'bg-[#c8ff57] text-black border-[#c8ff57]'
                                            : 'bg-[#18181f] text-[#7a7a90] border-[#2a2a35] hover:border-[#c8ff57]'
                                        }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Platforms */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider
                              text-[#7a7a90] mb-2">
                            Platforms
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {platformOptions.map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => togglePlatform(p)}
                                    className={`px-3 py-1 rounded font-mono text-xs
                             border transition-all
                             ${formData.platforms.includes(p)
                                            ? 'bg-[#c8ff57]/15 text-[#c8ff57] border-[#c8ff57]/50'
                                            : 'bg-[#18181f] text-[#7a7a90] border-[#2a2a35] hover:border-[#c8ff57]'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Submit button */}
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !formData.title.trim()}
                        className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm
                       rounded hover:bg-[#d4ff6e] transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                    >
                        {submitting ? 'Logging...' : '🎮 Log Game'}
                    </button>

                </div>
            </div>
        </div>
    )
}

export default AddGameModal