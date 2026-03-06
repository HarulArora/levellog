// AddGameModal.jsx
// The popup form for adding a new game
// It appears when user clicks "Log Game" button

import { useState } from 'react'

// onClose → close the modal
// onAdd → function to call with new game data
function AddGameModal({ onClose, onAdd }) {

    // Form state — stores what user typed in each field
    const [formData, setFormData] = useState({
        title: '',
        genre: '',
        status: 'playing',
        rating: 0,
        hours: '',
        platforms: [],
        steamId: '',
        notes: '',
    })

    // loading state for the submit button
    const [submitting, setSubmitting] = useState(false)

    // Available platforms to choose from
    const platforms = ['PC', 'PS', 'Xbox', 'SW', 'Mac']

    // Available statuses
    const statuses = ['playing', 'completed', 'planned', 'paused', 'dropped']

    // Rating buttons 1-10
    const ratings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]


    // ── HANDLERS ──

    // Update a single field in formData
    // Instead of writing a handler for every field, we use one smart handler
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    // Toggle platform selection
    const togglePlatform = (platform) => {
        setFormData(prev => ({
            ...prev,
            platforms: prev.platforms.includes(platform)
                // If already selected → remove it
                ? prev.platforms.filter(p => p !== platform)
                // If not selected → add it
                : [...prev.platforms, platform]
        }))
    }

    // Handle form submit
    const handleSubmit = async () => {
        // Validate title
        if (!formData.title.trim()) return

        setSubmitting(true)

        // Call the onAdd function passed from parent
        // This calls addGame() from our useGames hook
        const result = await onAdd(formData)

        setSubmitting(false)

        if (result.success) {
            onClose()  // close modal on success
        }
    }

    return (
        // Overlay — dark background behind modal
        // Click on overlay to close
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
                    <h3 className="font-black text-lg tracking-widest uppercase"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
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

                    {/* Title */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider 
                              text-[#7a7a90] mb-2">
                            Game Title *
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

                    {/* Genre */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider 
                              text-[#7a7a90] mb-2">
                            Genre
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. RPG, Action, Strategy"
                            value={formData.genre}
                            onChange={e => handleChange('genre', e.target.value)}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded 
                         px-3 py-2 text-sm text-white
                         focus:outline-none focus:border-[#c8ff57]
                         placeholder:text-[#7a7a90] transition-colors"
                        />
                    </div>

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
                         focus:outline-none focus:border-[#c8ff57] transition-colors"
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
                            placeholder="0"
                            min="0"
                            value={formData.hours}
                            onChange={e => handleChange('hours', e.target.value)}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded 
                         px-3 py-2 text-sm text-white
                         focus:outline-none focus:border-[#c8ff57]
                         placeholder:text-[#7a7a90] transition-colors"
                        />
                    </div>

                    {/* Rating */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider 
                              text-[#7a7a90] mb-2">
                            Rating
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
                            {platforms.map(p => (
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

                    {/* Steam ID */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider 
                              text-[#7a7a90] mb-2">
                            Steam App ID
                            <span className="ml-2 normal-case opacity-60">
                                (for cover image)
                            </span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. 1245620"
                            value={formData.steamId}
                            onChange={e => handleChange('steamId', e.target.value)}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded 
                         px-3 py-2 text-sm text-white
                         focus:outline-none focus:border-[#c8ff57]
                         placeholder:text-[#7a7a90] transition-colors"
                        />
                    </div>

                    {/* Submit button */}
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !formData.title.trim()}
                        className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm 
                       rounded hover:bg-[#d4ff6e] transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed
                       mt-2"
                    >
                        {submitting ? 'Logging...' : '🎮 Log Game'}
                    </button>

                </div>
            </div>
        </div>
    )
}

export default AddGameModal