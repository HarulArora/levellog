import { useState } from 'react'

function AddMovieModal({ onClose, onAdd, preselectedMovie = null, existingEntry = null }) {
    const [formData, setFormData] = useState({
        title: existingEntry?.title || preselectedMovie?.title || '',
        genre: existingEntry?.genre || preselectedMovie?.genre || 'Media',
        status: existingEntry?.status || 'watching',
        rating: existingEntry?.rating || 0,
        seasonsWatched: existingEntry?.seasonsWatched ?? '',
        episodesWatched: existingEntry?.episodesWatched ?? '',
        totalEpisodes: existingEntry?.totalEpisodes || preselectedMovie?.totalEpisodes || 0,
        totalSeasons: existingEntry?.totalSeasons || preselectedMovie?.totalSeasons || 0,
        cover: existingEntry?.cover || existingEntry?.coverImage || preselectedMovie?.cover || '',
        externalId: existingEntry?.externalId || preselectedMovie?.externalId || '',
        type: existingEntry?.type || existingEntry?.mediaType || preselectedMovie?.type || 'movie',
        year: existingEntry?.year || preselectedMovie?.year || null
    })

    const [submitting, setSubmitting] = useState(false)
    const isTV = formData.type === 'tv'
    const statuses = ['watching', 'completed', 'planned', 'paused', 'dropped']
    const ratings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    const handleChange = (field, value) => {
        let val = value;
        if (value !== '') {
            const num = parseInt(value);
            let total = 0;
            if (field === 'episodesWatched') total = formData.totalEpisodes;
            if (field === 'seasonsWatched') total = formData.totalSeasons;

            if (total > 0) {
                val = Math.min(Math.max(0, num || 0), total);
            }
        }
        setFormData(prev => ({ ...prev, [field]: val }))
    }

    const handleSubmit = async () => {
        if (!formData.title.trim()) return
        setSubmitting(true)
        const result = await onAdd(formData)
        setSubmitting(false)
        if (result.success) onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
             onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[#2a2a35]">
                    <h3 className="font-black text-lg tracking-widest uppercase text-white"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {existingEntry ? `Edit ${isTV ? 'TV Show' : 'Movie'}` : `Add to Pond`}
                    </h3>
                    <button onClick={onClose} className="text-[#7a7a90] hover:text-white transition-colors text-xl">✕</button>
                </div>

                {/* Form Body */}
                <div className="p-5 flex flex-col gap-4">
                    {/* Preview */}
                    {formData.cover && (
                        <div className="flex items-center gap-3 bg-[#18181f] border border-[#c8ff57]/20 rounded-lg p-3">
                            <img src={formData.cover} alt={formData.title} className="w-12 h-16 object-cover rounded shadow-md" />
                            <div>
                                <div className="font-semibold text-sm text-white truncate max-w-[240px]">{formData.title}</div>
                                <div className="font-mono text-[10px] text-[#7a7a90] mt-1">{formData.genre}</div>
                                <div className="text-[#c8ff57] font-mono text-[10px] mt-1">✓ {isTV ? 'TV Show' : 'Movie'} data synced</div>
                            </div>
                        </div>
                    )}

                    {/* Status */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider text-[#7a7a90] mb-2">Status</label>
                        <select
                            value={formData.status}
                            onChange={e => handleChange('status', e.target.value)}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8ff57] transition-colors"
                        >
                            {statuses.map(s => (
                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Progress */}
                    {isTV && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block font-mono text-xs uppercase tracking-wider text-[#7a7a90] mb-2">Seasons</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 2"
                                    min="0"
                                    value={formData.seasonsWatched}
                                    onChange={e => handleChange('seasonsWatched', e.target.value)}
                                    className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8ff57] transition-colors"
                                />
                                <div className="mt-1 font-mono text-[9px] text-[#c8ff57] uppercase tracking-wider">
                                    Total: {formData.totalSeasons || '?'}
                                </div>
                            </div>
                            <div>
                                <label className="block font-mono text-xs uppercase tracking-wider text-[#7a7a90] mb-2">Episodes</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 24"
                                    min="0"
                                    value={formData.episodesWatched}
                                    onChange={e => handleChange('episodesWatched', e.target.value)}
                                    className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8ff57] transition-colors"
                                />
                                <div className="mt-1 font-mono text-[9px] text-[#c8ff57] uppercase tracking-wider">
                                    Total: {formData.totalEpisodes || '?'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rating */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider text-[#7a7a90] mb-2">Your Rating</label>
                        <div className="flex gap-2 flex-wrap">
                            {ratings.map(r => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => handleChange('rating', r)}
                                    className={`w-9 h-9 rounded font-mono text-sm font-bold border transition-all
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



                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !formData.title.trim()}
                        className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm
                                   rounded hover:bg-[#d4ff6e] transition-all
                                   disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                    >
                        {submitting ? 'LOGGING...' : existingEntry ? '💾 SAVE CHANGES' : `🐥 LOG ${isTV ? 'TV SHOW' : 'MOVIE'}`}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default AddMovieModal
