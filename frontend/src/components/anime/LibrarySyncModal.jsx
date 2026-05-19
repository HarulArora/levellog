import { useState } from 'react'
import { X, RefreshCw, Sparkles, BookOpen, Star, AlertCircle, ShieldAlert } from 'lucide-react'
import Shuriken from '../ui/Shuriken'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

function LibrarySyncModal({ onClose, onSyncSuccess, mediaType }) {
    const { updateUser } = useAuth()
    const [service, setService] = useState('anilist') // 'anilist' or 'mal'
    const [username, setUsername] = useState('')
    const [syncing, setSyncing] = useState(false)
    const [statusLog, setStatusLog] = useState('')
    const [syncResult, setSyncResult] = useState(null)
    const [error, setError] = useState('')

    const handleSync = async (e) => {
        e.preventDefault()
        if (!username.trim()) {
            setError('Please enter a username')
            return
        }

        setError('')
        setSyncing(true)
        setStatusLog('Initializing connection to ' + (service === 'anilist' ? 'AniList' : 'MyAnimeList') + '...')

        try {
            // Fake progress steps for visual premium polish
            setTimeout(() => setStatusLog('Fetching public library collections...'), 1200)
            setTimeout(() => setStatusLog('Mapping external IDs and comparing database status...'), 2400)
            setTimeout(() => setStatusLog('Synchronizing list entries and computing XP awards...'), 3600)

            const endpoint = service === 'anilist' ? '/anime/import/anilist' : '/anime/import/mal'
            
            let clientAnilistData = null;
            if (service === 'anilist') {
                try {
                    const typeFilter = mediaType === 'manga' ? 'MANGA' : 'ANIME';
                    const aniListRes = await fetch('https://graphql.anilist.co', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                            query: `
                                query ($username: String, $type: MediaType) {
                                    MediaListCollection(userName: $username, type: $type) {
                                        lists {
                                            name
                                            isCustomList
                                            status
                                            entries {
                                                score(format: POINT_10)
                                                progress
                                                progressVolumes
                                                status
                                                media {
                                                    idMal
                                                    title {
                                                        romaji
                                                        english
                                                    }
                                                    coverImage {
                                                        large
                                                    }
                                                    genres
                                                    episodes
                                                    chapters
                                                    volumes
                                                    startDate {
                                                        year
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            `,
                            variables: { username: username.trim(), type: typeFilter }
                        })
                    });
                    
                    if (aniListRes.ok) {
                        const payload = await aniListRes.json();
                        if (payload.errors && payload.errors.length > 0) {
                            throw new Error(payload.errors[0].message);
                        }
                        clientAnilistData = payload;
                    } else {
                        const errorText = await aniListRes.text();
                        console.warn('Client-side AniList fetch failed with status:', aniListRes.status, errorText);
                    }
                } catch (clientErr) {
                    console.error('Client-side AniList fetch failed, falling back to server-side sync:', clientErr);
                    // Propagate user validation/not found error if explicit
                    if (clientErr.message && (
                        clientErr.message.toLowerCase().includes('user not found') || 
                        clientErr.message.toLowerCase().includes('notfound') ||
                        clientErr.message.toLowerCase().includes('no user')
                    )) {
                        throw clientErr;
                    }
                }
            }

            const res = await api.post(endpoint, {
                username: username.trim(),
                mediaType: mediaType, // 'anime' or 'manga'
                anilistData: clientAnilistData
            })

            // Add short delay to let the final visual step breathe
            await new Promise(resolve => setTimeout(resolve, 4500))

            if (res.data.success) {
                // Sync the global user's XP, level, and badge instantly
                if (res.data.xp !== undefined) {
                    updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
                }
                
                if (onSyncSuccess) {
                    onSyncSuccess(res.data)
                }
                onClose()
            } else {
                setError(res.data.message || 'Sync failed')
            }
        } catch (err) {
            console.error('Import Sync Error:', err)
            setError(err.response?.data?.message || 'Sync connection failed. Make sure your profile is public.')
        } finally {
            setSyncing(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !syncing && onClose()} />

            {/* Modal Body */}
            <div className="relative bg-[#111118] border border-[#2a2a35] rounded-[2.5rem] p-6 md:p-8 w-full max-w-lg shadow-[0_50px_120px_rgba(0,0,0,0.85)] overflow-hidden">
                {/* Visual Glassmorphism Highlights */}
                <div className="absolute -left-12 -top-12 w-32 h-32 bg-[#c8ff57]/10 rounded-full blur-3xl" />
                <div className="absolute -right-12 -bottom-12 w-32 h-32 bg-[#5c9fff]/10 rounded-full blur-3xl" />

                {/* Close Button */}
                {!syncing && (
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-xl bg-[#1a1a25] border border-[#2a2a35] text-[#7a7a90] hover:text-white hover:border-white/20 transition-all active:scale-95"
                    >
                        <X size={16} />
                    </button>
                )}

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-[#c8ff57]/10 border border-[#c8ff57]/20 flex items-center justify-center text-[#c8ff57]">
                        <RefreshCw size={20} className={syncing ? 'animate-spin' : ''} />
                    </div>
                    <div>
                        <span className="font-mono text-[9px] text-[#7a7a90] uppercase tracking-[3px]">Multiverse Sync</span>
                        <h2 className="text-white font-black text-2xl uppercase tracking-wider leading-none mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            One-Click Import
                        </h2>
                    </div>
                </div>

                {/* State 1: Active Sync Result Screen */}
                {syncResult ? (
                    <div className="text-center py-6 flex flex-col items-center">
                        <div className="w-20 h-20 bg-[#c8ff57]/10 rounded-3xl border border-[#c8ff57]/30 flex items-center justify-center text-[#c8ff57] mb-6 animate-bounce">
                            <Sparkles size={36} />
                        </div>
                        <h3 className="text-white font-black text-3xl uppercase tracking-wider mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            Sync Completed!
                        </h3>
                        <p className="text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest max-w-sm mb-8 leading-relaxed">
                            {syncResult.message}
                        </p>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-3 gap-3 w-full mb-8">
                            <div className="bg-[#0d0d14] border border-[#2a2a35] rounded-2xl p-4 flex flex-col items-center justify-center">
                                <span className="font-mono text-[9px] text-[#7a7a90] uppercase tracking-wider mb-1">Imported</span>
                                <span className="font-black text-2xl text-[#c8ff57]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    +{syncResult.importedCount || 0}
                                </span>
                            </div>
                            <div className="bg-[#0d0d14] border border-[#2a2a35] rounded-2xl p-4 flex flex-col items-center justify-center">
                                <span className="font-mono text-[9px] text-[#7a7a90] uppercase tracking-wider mb-1">Updated</span>
                                <span className="font-black text-2xl text-[#5c9fff]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {syncResult.updatedCount || 0}
                                </span>
                            </div>
                            <div className="bg-[#0d0d14] border border-[#2a2a35] rounded-2xl p-4 flex flex-col items-center justify-center">
                                <span className="font-mono text-[9px] text-[#7a7a90] uppercase tracking-wider mb-1">XP Earned</span>
                                <span className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-[#c8ff57] to-[#5c9fff]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    +{syncResult.xpGained || 0} XP
                                </span>
                            </div>
                        </div>

                        {/* User Level Indicator */}
                        {syncResult.xpGained > 0 && (
                            <div className="px-4 py-3 bg-[#c8ff57]/5 border border-[#c8ff57]/20 rounded-full flex items-center gap-2 mb-8">
                                <span className="text-sm">{syncResult.badge || '🔰'}</span>
                                <span className="text-[#c8ff57] font-mono text-[10px] font-bold uppercase tracking-wider">
                                    Current Rank: {syncResult.level || 1} — XP Total: {syncResult.xp || 0}
                                </span>
                            </div>
                        )}

                        <button
                            onClick={onClose}
                            className="w-full bg-[#c8ff57] text-black py-4 rounded-xl font-black uppercase text-sm tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_15px_40px_rgba(200,255,87,0.25)]"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            Return to Vault
                        </button>
                    </div>
                ) : syncing ? (
                    /* State 2: Syncing / Loader State */
                    <div className="flex flex-col items-center py-10">
                        <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
                            <div className="absolute inset-0 border-4 border-[#2a2a35] rounded-full" />
                            <div className="absolute inset-0 border-4 border-t-[#c8ff57] rounded-full animate-spin" />
                            <Shuriken size={36} className="text-[#c8ff57]" />
                        </div>
                        <h4 className="text-white font-black text-2xl uppercase tracking-wider mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            Syncing Universe
                        </h4>
                        <div className="px-4 py-2 bg-[#0d0d14] border border-[#2a2a35] rounded-xl max-w-sm w-full text-center">
                            <p className="text-[#7a7a90] font-mono text-[9px] uppercase tracking-wider animate-pulse leading-relaxed">
                                {statusLog}
                            </p>
                        </div>
                    </div>
                ) : (
                    /* State 3: Input Username / Configuration Form */
                    <form onSubmit={handleSync} className="space-y-6">
                        <p className="text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest leading-relaxed">
                            Synchronize your external lists to automatically back up your entire {mediaType} library history, level up your XP ranks, and showcase stats!
                        </p>

                        {/* Service Select */}
                        <div className="space-y-2">
                            <label className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">Select Platform</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setService('anilist')}
                                    className={`py-4 rounded-xl font-mono text-[10px] uppercase tracking-widest border transition-all flex flex-col items-center justify-center gap-1.5
                                               ${service === 'anilist' ? 'bg-[#5c9fff]/10 border-[#5c9fff] text-white' : 'bg-[#0d0d14] border-[#2a2a35] text-[#7a7a90] hover:text-white'}`}
                                >
                                    <Sparkles size={16} className="text-[#5c9fff]" />
                                    AniList
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setService('mal')}
                                    className={`py-4 rounded-xl font-mono text-[10px] uppercase tracking-widest border transition-all flex flex-col items-center justify-center gap-1.5
                                               ${service === 'mal' ? 'bg-[#c8ff57]/10 border-[#c8ff57] text-white' : 'bg-[#0d0d14] border-[#2a2a35] text-[#7a7a90] hover:text-white'}`}
                                >
                                    <BookOpen size={16} className="text-[#c8ff57]" />
                                    MyAnimeList
                                </button>
                            </div>
                        </div>

                        {/* Username Input */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">
                                    {service === 'anilist' ? 'AniList' : 'MAL'} Username
                                </label>
                                <span className="font-mono text-[8px] text-[#ff9f5c] uppercase tracking-wider flex items-center gap-1">
                                    <AlertCircle size={8} /> Profile must be public
                                </span>
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter public username..."
                                className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-xl pl-4 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-[#c8ff57] transition-all placeholder:text-[#3a3a4a]"
                            />
                        </div>

                        {/* Error Alert */}
                        {error && (
                            <div className="flex gap-2.5 p-4 rounded-xl bg-[#ff5c5c]/10 border border-[#ff5c5c]/20 text-[#ff5c5c] font-mono text-[10px] uppercase tracking-wider leading-relaxed">
                                <ShieldAlert size={16} className="flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="w-full bg-[#c8ff57] text-black py-4 rounded-xl font-black uppercase text-sm tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_15px_40px_rgba(200,255,87,0.25)]"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            Trigger Multiverse Sync
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}

export default LibrarySyncModal
