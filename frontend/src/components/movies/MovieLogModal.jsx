import { useState } from 'react'
import MovieSearch from './MovieSearch'
import { useSection } from '../../context/SectionState'
import { invalidatePrefix } from '../../utils/cache'

function MovieLogModal({ onClose, onAdd, preselectedItem = null, existingEntry = null, items = [], mediaType: forcedType = null }) {
    const { cinemaSubSection } = useSection()
    const activeType = forcedType || cinemaSubSection

    const [formData, setFormData] = useState({
        title: existingEntry?.title || preselectedItem?.title || '',
        genre: existingEntry?.genre || preselectedItem?.genres?.[0] || '',
        status: existingEntry?.status || 'playing',
        rating: existingEntry?.rating || 0,
        episodesWatched: existingEntry?.episodesWatched ?? '',
        seasonsWatched: existingEntry?.seasonsWatched ?? '',
        cover: existingEntry?.cover || existingEntry?.coverImage || preselectedItem?.cover || '',
        summary: existingEntry?.summary || preselectedItem?.summary || '',
        externalId: existingEntry?.externalId || preselectedItem?.externalId || '',
    })

    const [itemSelected, setItemSelected] = useState(!!(preselectedItem || existingEntry))
    const [submitting, setSubmitting] = useState(false)

    const statuses = ['playing', 'completed', 'planned', 'paused', 'dropped']
    const ratings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleItemSelect = (item) => {
        const alreadyLogged = items.find(i => String(i.externalId) === String(item.externalId))

        setFormData(prev => ({
            ...prev,
            title: item.title,
            genre: item.genres?.[0] || '',
            cover: item.cover || item.coverImage || '',
            summary: item.summary || '',
            externalId: item.externalId || '',
            status: alreadyLogged ? alreadyLogged.status : 'playing',
            rating: alreadyLogged ? alreadyLogged.rating : 0,
            episodesWatched: alreadyLogged ? alreadyLogged.episodesWatched : '',
            seasonsWatched: alreadyLogged ? alreadyLogged.seasonsWatched : (item.seasonsCount || ''),
        }))
        setItemSelected(true)
    }

    const handleSubmit = async () => {
        if (!formData.title.trim()) return
        setSubmitting(true)
        const result = await onAdd({
            ...formData,
            type: activeType
        })
        setSubmitting(false)
        if (result.success) {
            invalidatePrefix('movie_discover_')
            invalidatePrefix('movie_home_')
            onClose()
        }
    }

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[#111118] border border-[#2a2a35] rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[#2a2a35]">
                    <h3
                        className="font-black text-lg tracking-widest uppercase text-white"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                        {existingEntry ? `Edit ${activeType === 'tv' ? 'TV Show' : 'Movie'}` : `Log ${activeType === 'tv' ? 'TV Show' : 'Movie'}`}
                    </h3>
                    <button onClick={onClose} className="text-[#7a7a90] hover:text-white transition-colors text-xl">✕</button>
                </div>

                {/* Form Body */}
                <div className="p-5 flex flex-col gap-4">
                    {!preselectedItem && !existingEntry && (
                        <div>
                            <label className="block font-mono text-xs uppercase tracking-wider text-[#7a7a90] mb-2">
                                Search {activeType === 'tv' ? 'TV Show' : 'Movie'}
                            </label>
                            <MovieSearch onSelect={handleItemSelect} />
                        </div>
                    )}

                    {itemSelected && formData.cover && (
                        <div className="flex items-center gap-3 bg-[#18181f] border border-[#c8ff57]/20 rounded-lg p-3">
                            <img src={formData.cover} alt={formData.title} className="w-12 h-16 object-cover rounded" />
                            <div>
                                <div className="font-semibold text-sm text-white">{formData.title}</div>
                                <div className="font-mono text-[10px] text-[#7a7a90] mt-1">{formData.genre}</div>
                                <div className="text-[#c8ff57] font-mono text-[10px] mt-1">✓ {activeType === 'tv' ? 'TV' : 'Movie'} data loaded</div>
                            </div>
                        </div>
                    )}



                    {/* Status */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider text-[#7a7a90] mb-2">
                            Status
                        </label>
                        <select
                            value={formData.status}
                            onChange={e => handleChange('status', e.target.value)}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8ff57] transition-colors"
                        >
                            {statuses.map(s => (
                                <option key={s} value={s}>
                                    {s === 'playing' ? 'Watching' : s.charAt(0).toUpperCase() + s.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Progress */}
                    {activeType === 'tv' ? (
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block font-mono text-xs uppercase tracking-wider text-[#7a7a90] mb-2">
                                    Seasons
                                </label>
                                <input
                                    type="number"
                                    placeholder="e.g. 5"
                                    min="0"
                                    value={formData.seasonsWatched}
                                    onChange={e => handleChange('seasonsWatched', e.target.value)}
                                    className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8ff57] transition-colors"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block font-mono text-xs uppercase tracking-wider text-[#7a7a90] mb-2">
                                    Episodes
                                </label>
                                <input
                                    type="number"
                                    placeholder="e.g. 62"
                                    min="0"
                                    value={formData.episodesWatched}
                                    onChange={e => handleChange('episodesWatched', e.target.value)}
                                    className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8ff57] transition-colors"
                                />
                            </div>
                        </div>
                    ) : null}

                    {/* Rating */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider text-[#7a7a90] mb-2">
                            Your Rating
                        </label>
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

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !formData.title.trim()}
                        className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm rounded hover:bg-[#d4ff6e] transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                    >
                        {submitting ? 'Logging...' : existingEntry ? '💾 Save Changes' : `🐥 Log ${activeType === 'tv' ? 'TV Show' : 'Movie'}`}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default MovieLogModal

