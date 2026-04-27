import { useState, useEffect } from 'react'
import api from '../../api/axios'

function AddAnimeModal({ onClose, onAdd, preselectedAnime = null, existingEntry = null }) {
    const [formData, setFormData] = useState({
        title: existingEntry?.title || preselectedAnime?.title || '',
        genre: existingEntry?.genre || preselectedAnime?.genres?.[0] || 'Media',
        status: existingEntry?.status || 'playing',
        rating: existingEntry?.rating || 0,
        episodesWatched: existingEntry?.episodesWatched ?? '',
        chaptersRead: existingEntry?.chaptersRead ?? '',
        notes: existingEntry?.notes || '',
        cover: existingEntry?.cover || existingEntry?.coverImage || preselectedAnime?.cover || '',
        externalId: existingEntry?.externalId || preselectedAnime?.externalId || '',
        type: existingEntry?.type || existingEntry?.mediaType || preselectedAnime?.type || 'anime',
        totalEpisodes: existingEntry?.totalEpisodes || preselectedAnime?.episodes || 0,
        totalChapters: existingEntry?.totalChapters || preselectedAnime?.chapters || 0,
        airingStatus: existingEntry?.airingStatus || preselectedAnime?.airingStatus || preselectedAnime?.status || ''
    })
    
    // Auto-fetch total episodes if missing from existing entry
    useEffect(() => {
        if (formData.externalId && !formData.totalEpisodes && !formData.totalChapters) {
            const fetchTotals = async () => {
                try {
                    const res = await api.get(`/anime/detail/${formData.externalId}?type=${formData.type}`);
                    if (res.data.anime) {
                        const totalEp = res.data.anime.episodes || 0;
                        const totalCh = res.data.anime.chapters || 0;
                        setFormData(prev => ({
                            ...prev,
                            totalEpisodes: totalEp,
                            totalChapters: totalCh,
                            episodesWatched: totalEp > 0 && prev.episodesWatched > totalEp ? totalEp : prev.episodesWatched,
                            chaptersRead: totalCh > 0 && prev.chaptersRead > totalCh ? totalCh : prev.chaptersRead
                        }));
                    }
                } catch (err) { console.error('Failed to fetch totals:', err); }
            };
            fetchTotals();
        }
    }, [formData.externalId, formData.type]);

    const [submitting, setSubmitting] = useState(false)
    const isManga = formData.type === 'manga'
    const statuses = ['playing', 'completed', 'planned', 'paused', 'dropped']
    const ratings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    const handleChange = (field, value) => {
        let val = value;
        if (value !== '') {
            const num = parseInt(value);
            const total = isManga ? formData.totalChapters : formData.totalEpisodes;
            if ((field === 'episodesWatched' || field === 'chaptersRead') && total > 0) {
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
                        {existingEntry ? `Edit ${isManga ? 'Manga' : 'Anime'}` : `Add to Pond`}
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
                                <div className="text-[#c8ff57] font-mono text-[10px] mt-1">✓ {isManga ? 'Manga' : 'Anime'} data synced</div>
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
                                <option key={s} value={s}>{s === 'playing' ? (isManga ? 'Reading' : 'Watching') : s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Progress */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider text-[#7a7a90] mb-2">
                            {isManga ? 'Chapters Read' : 'Episodes Watched'}
                        </label>
                        <input
                            type="number"
                            placeholder={isManga ? "e.g. 150" : "e.g. 12"}
                            min="0"
                            value={isManga ? formData.chaptersRead : formData.episodesWatched}
                            onChange={e => handleChange(isManga ? 'chaptersRead' : 'episodesWatched', e.target.value)}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8ff57] transition-colors"
                        />
                        <div className="mt-1.5 flex items-center justify-between px-1">
                            <div className="font-mono text-[11px] font-bold text-[#c8ff57] uppercase tracking-wider">
                                Total: {(isManga ? formData.totalChapters : formData.totalEpisodes) || (formData.airingStatus?.toLowerCase().includes('airing') ? 'Ongoing' : '?')}
                            </div>
                            <div className="font-mono text-[9px] text-[#7a7a90] uppercase">
                                {(isManga ? formData.totalChapters : formData.totalEpisodes) > 0 ? 'Limit Enforced' : 'Flexible Progress'}
                            </div>
                        </div>
                    </div>

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

                    {/* Notes */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider text-[#7a7a90] mb-2">Private Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={e => handleChange('notes', e.target.value)}
                            placeholder="Add your thoughts..."
                            rows={3}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8ff57] transition-colors resize-none"
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !formData.title.trim()}
                        className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm
                                   rounded hover:bg-[#d4ff6e] transition-all
                                   disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                    >
                        {submitting ? 'LOGGING...' : existingEntry ? '💾 SAVE CHANGES' : `🐥 LOG ${isManga ? 'MANGA' : 'ANIME'}`}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default AddAnimeModal
