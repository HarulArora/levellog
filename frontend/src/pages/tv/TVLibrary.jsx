import { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import { Plus, LayoutGrid, List as ListIcon, Filter, Search, Tv, Sparkles, Edit3, Trash2, Film } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import TVCard from '../../components/movies/TVCard'
import MovieFilterBar from '../../components/movies/MovieFilterBar'
import Skeleton from '../../components/ui/Skeleton'
import Toast from '../../components/ui/Toast'
import SubSectionToggle from '../../components/ui/SubSectionToggle'

const MovieLogModal = lazy(() => import('../../components/movies/MovieLogModal'))

function TVLibrary() {
    const { user, updateSettings, updateUser } = useAuth()
    const navigate = useNavigate()

    const [library, setLibrary] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')

    const [viewMode, setViewMode] = useState(user?.settings?.libraryViewMode || 'grid')

    const [showAddModal, setShowAddModal] = useState(false)
    const [editingMovie, setEditingMovie] = useState(null)
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [toast, setToast] = useState(null)

    const fetchLibrary = async () => {
        try {
            setLoading(true)
            const res = await api.get('/movies/library')
            const rawList = res.data.library || []
            const uniqueMap = new Map()
            rawList.forEach(item => {
                const type = item.type || item.mediaType || 'tv'
                if (type !== 'tv') return // Only show tv in TVLibrary
                const key = item.externalId ? `${type}_ext_${item.externalId}` : `${type}_title_${item.title?.toLowerCase()}`
                if (!uniqueMap.has(key)) uniqueMap.set(key, item)
            })
            setLibrary(Array.from(uniqueMap.values()))
        } catch (err) {
            console.error('Failed to fetch library:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (user) {
            fetchLibrary()
        } else {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        if (user?.settings?.libraryViewMode) {
            setViewMode(user.settings.libraryViewMode)
        }
    }, [user?.settings?.libraryViewMode])

    const handleViewModeChange = async (mode) => {
        setViewMode(mode)
        if (user) {
            await updateSettings({ libraryViewMode: mode })
        }
    }

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }


    const handleDeleteRequest = (id, title) => {
        setConfirmDelete({ id, title })
    }

    const handleDeleteConfirmed = async () => {
        if (!confirmDelete) return
        const { id, title } = confirmDelete
        setConfirmDelete(null)
        try {
            const res = await api.delete(`/movies/log/${id}`)
            if (res.data.success) {
                showToast(`"${title}" removed from library`)

                // Update local user XP/Stats
                if (res.data.xp !== undefined) {
                    updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
                }

                fetchLibrary()
            }
        } catch {
            showToast('Failed to remove', 'error')
        }
    }

    const filteredShows = useMemo(() => {
        return library
            .filter(m => (m.type || m.mediaType) === 'tv')
            .filter(m => filter === 'all' || m.status === filter || (filter === 'playing' && (m.status === 'watching' || m.status === 'reading')))
            .filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()))
    }, [library, filter, searchQuery])

    const counts = useMemo(() => {
        const sectionItems = library.filter(m => (m.type || m.mediaType) === 'tv')
        return {
            all: sectionItems.length,
            playing: sectionItems.filter(m => m.status === 'playing' || m.status === 'watching' || m.status === 'reading').length,
            completed: sectionItems.filter(m => m.status === 'completed').length,
            planned: sectionItems.filter(m => m.status === 'planned').length,
            paused: sectionItems.filter(m => m.status === 'paused').length,
            dropped: sectionItems.filter(m => m.status === 'dropped').length,
        }
    }, [library])

    if (loading) return (
        <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 animate-pulse">
                <div className="space-y-4">
                    <div className="h-12 w-64 bg-[#111118] rounded-xl border border-[#2a2a35]" />
                    <div className="h-4 w-48 bg-[#111118] rounded-full border border-[#2a2a35]" />
                </div>
                <div className="h-12 w-40 bg-[#111118] rounded-xl border border-[#2a2a35]" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                        <Skeleton variant="block" width="100%" className="aspect-[3/4]" style={{ borderRadius: '12px' }} />
                        <Skeleton variant="line" width="80%" height="16px" />
                    </div>
                ))}
            </div>
        </div>
    )

    return (
        <div className="min-h-screen pb-32">
            <Helmet>
                <title>My TV Library | QuestDuck</title>
            </Helmet>

            <div className="bg-[#0a0a0f] border-b border-[#1a1a25] pt-24 pb-16">
                <div className="max-w-[1200px] mx-auto px-5 md:px-10">
                    <SubSectionToggle
                        current="tv"
                        type="cinema"
                        options={[
                            { label: 'Movies', value: 'movie', path: '/movies/library', icon: Film },
                            { label: 'TV Shows', value: 'tv', path: '/tv/library', icon: Tv }
                        ]}
                    />

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
                        <div className="relative group">
                            <div className="absolute -left-4 -top-4 w-12 h-12 bg-[#c8ff57]/10 rounded-full blur-2xl group-hover:bg-[#c8ff57]/20 transition-all duration-500" />
                            <div className="flex items-center gap-3 mb-2">
                                <Tv size={16} className="text-[#c8ff57]" />
                                <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-[3px]">Multiverse Vault</span>
                            </div>
                            <h1 className="font-black text-5xl md:text-6xl text-white uppercase leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                My <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#c8ff57] to-white bg-[length:200%_auto] animate-gradient">TV Library</span>
                            </h1>
                            <div className="flex items-center gap-4 mt-4">
                                <div className="px-3 py-1 bg-[#111118] border border-[#2a2a35] rounded-full flex items-center gap-2">
                                    <Sparkles size={10} className="text-[#c8ff57]" />
                                    <span className="text-[#7a7a90] font-mono text-[9px] uppercase tracking-widest">
                                        {counts.all} SHOWS LOGGED
                                    </span>
                                </div>
                                <div className="px-3 py-1 bg-[#c8ff57]/5 border border-[#c8ff57]/20 rounded-full flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff57] animate-pulse" />
                                    <span className="text-[#c8ff57] font-mono text-[9px] uppercase tracking-widest">
                                        {counts.playing} CURRENTLY WATCHING
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                if (!user) { navigate('/login'); return }
                                setShowAddModal(true)
                            }}
                            className="group relative bg-[#c8ff57] text-black px-8 py-4 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_15px_40px_rgba(200,255,87,0.25)]"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            <Plus size={22} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
                            Log New Show
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1200px] mx-auto px-5 md:px-10 mt-12">
                {/* Control Panel */}
                <div className="flex flex-col lg:flex-row gap-6 mb-12 bg-[#111118]/50 backdrop-blur-xl border border-[#2a2a35] p-5 rounded-3xl shadow-2xl">
                    <div className="flex-1 overflow-x-auto no-scrollbar pr-10">
                        <MovieFilterBar activeFilter={filter} onFilter={setFilter} counts={counts} />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto lg:border-l lg:border-[#2a2a35] lg:pl-6 lg:ml-2">
                        <div className="relative w-full sm:flex-1 lg:w-72 group">
                            <input
                                type="text"
                                placeholder="Search your TV shows..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-2xl pl-12 pr-12 py-3.5 text-sm text-white focus:outline-none focus:border-[#c8ff57] focus:ring-4 focus:ring-[#c8ff57]/5 transition-all placeholder:text-[#3a3a4a]"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7a7a90] group-focus-within:text-[#c8ff57] transition-colors z-10 pointer-events-none" size={18} />
                        </div>

                        <div className="flex bg-[#0d0d14] rounded-2xl border border-[#2a2a35] p-1.5 shadow-inner shrink-0">
                            <button
                                onClick={() => handleViewModeChange('grid')}
                                className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-[#c8ff57] text-black shadow-lg' : 'text-[#7a7a90] hover:text-white hover:bg-[#1a1a25]'}`}
                            >
                                <LayoutGrid size={20} />
                            </button>
                            <button
                                onClick={() => handleViewModeChange('list')}
                                className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-[#c8ff57] text-black shadow-lg' : 'text-[#7a7a90] hover:text-white hover:bg-[#1a1a25]'}`}
                            >
                                <ListIcon size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Library Content */}
                {filteredShows.length > 0 ? (
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10">
                            {filteredShows.map(item => (
                                <TVCard
                                    key={item._id}
                                    movie={item}
                                    showAvgRating={false}
                                    onDelete={() => handleDeleteRequest(item._id, item.title)}
                                    onEdit={() => setEditingMovie(item)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="overflow-x-auto no-scrollbar bg-[#111118]/50 border border-[#2a2a35] rounded-3xl">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-[#2a2a35] bg-[#0d0d14]">
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest w-16 text-center align-middle">#</th>
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest w-24 text-center align-middle">Image</th>
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest text-center align-middle">Title</th>
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest text-center align-middle">Score</th>
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest text-center align-middle">Status</th>
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest text-center align-middle">Genre</th>
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest text-center align-middle">Progress (S/E)</th>
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest text-center align-middle">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredShows.map((show, idx) => (
                                        <TVRow
                                            key={show._id}
                                            show={show}
                                            index={idx + 1}
                                            onDelete={() => handleDeleteRequest(show._id, show.title)}
                                            onEdit={() => setEditingMovie(show)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    <div className="py-32 text-center border-2 border-dashed border-[#2a2a35] rounded-[40px] bg-[#111118]/30 backdrop-blur-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-b from-[#c8ff57]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <div className="relative z-10">
                            <div className="w-24 h-24 bg-[#1a1a25] rounded-3xl flex items-center justify-center mx-auto mb-8 border border-[#2a2a35] group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
                                <Tv size={40} className="text-[#4a4a5e]" />
                            </div>
                            <h3 className="text-white font-black text-3xl uppercase mb-3 tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {searchQuery ? 'Zero Matches' : 'Vault Empty'}
                            </h3>
                            <p className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                                {searchQuery ? `No results for "${searchQuery}". Maybe try a different keyword?` : 'Your television journey begins with a single log.'}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="mt-10 text-[#c8ff57] font-black uppercase text-sm tracking-[3px] hover:tracking-[5px] transition-all"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                    Log First Entry →
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <Suspense fallback={null}>
                {showAddModal && (
                    <MovieLogModal
                        onClose={() => setShowAddModal(false)}
                        onAdd={async (formData) => {
                            try {
                                const res = await api.post('/movies/log', formData)
                                if (res.data.xp) updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
                                setShowAddModal(false)
                                fetchLibrary()
                                return { success: true }
                            } catch { return { success: false } }
                        }}
                        onDelete={async (logId) => {
                            try {
                                const res = await api.delete(`/movies/log/${logId}`)
                                if (res.data.xp) updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
                                setShowAddModal(false)
                                fetchLibrary()
                                return { success: true }
                            } catch { return { success: false } }
                        }}
                        items={library}
                        mediaType="tv"
                    />
                )}
                {editingMovie && (
                    <MovieLogModal
                        onClose={() => setEditingMovie(null)}
                        onAdd={async (formData) => {
                            try {
                                const res = await api.post('/movies/log', formData)
                                if (res.data.xp) updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
                                setEditingMovie(null)
                                fetchLibrary()
                                return { success: true }
                            } catch { return { success: false } }
                        }}
                        onDelete={async (logId) => {
                            try {
                                const res = await api.delete(`/movies/log/${logId}`)
                                if (res.data.xp) updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
                                setEditingMovie(null)
                                fetchLibrary()
                                return { success: true }
                            } catch { return { success: false } }
                        }}
                        preselectedItem={editingMovie}
                        existingEntry={editingMovie}
                        items={library}
                        mediaType="tv"
                    />
                )}
            </Suspense>

            {confirmDelete && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300"
                >
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setConfirmDelete(null)} />
                    <div
                        className="relative bg-[#111118] border border-[#2a2a35] rounded-[2rem] p-8 w-full max-w-md
                                   shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#ff5c5c] to-transparent opacity-50" />
                        <div className="w-20 h-20 bg-[#ff5c5c]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#ff5c5c]/20">
                            <Plus size={32} className="text-[#ff5c5c] rotate-45" />
                        </div>
                        <h3
                            className="text-white font-black text-3xl tracking-widest uppercase text-center mb-2"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            Remove Entry?
                        </h3>
                        <p className="text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest text-center mb-8 leading-relaxed">
                            Are you sure you want to remove <span className="text-white">"{confirmDelete.title}"</span>? This action is permanent and will deduct any associated XP.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="flex-1 py-4 text-xs font-black uppercase tracking-widest
                                           text-white bg-[#1a1a25] border border-[#2a2a35] rounded-xl
                                           hover:bg-[#2a2a35] transition-all"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                                Keep it
                            </button>
                            <button
                                onClick={handleDeleteConfirmed}
                                className="flex-1 py-4 text-xs font-black uppercase tracking-widest
                                           text-white bg-[#ff5c5c] rounded-xl shadow-[0_10px_20px_rgba(255,92,92,0.2)]
                                           hover:bg-[#ff4b4b] transition-all"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    )
}

function TVRow({ show, index, onDelete, onEdit }) {
    const navigate = useNavigate()
    const statusConfig = {
        watching: { color: 'bg-[#c8ff57]', label: 'Watching' },
        playing: { color: 'bg-[#c8ff57]', label: 'Watching' },
        completed: { color: 'bg-[#5c9fff]', label: 'Completed' },
        planned: { color: 'bg-[#ff9f5c]', label: 'Planned' },
        dropped: { color: 'bg-[#ff5c5c]', label: 'Dropped' },
        paused: { color: 'bg-[#c45cff]', label: 'Paused' },
    }
    const sc = statusConfig[show.status] || statusConfig.planned
    const imageUrl = show.cover || show.coverImage

    return (
        <tr className="border-b border-[#2a2a35] hover:bg-white/[0.02] transition-colors group">
            <td className="px-6 py-4 align-middle text-center">
                <div className="flex items-center justify-center gap-3">
                    <div className={`w-1 h-8 rounded-full ${sc.color}`} />
                    <span className="font-mono text-xs text-[#4a4a5e]">{index}</span>
                </div>
            </td>
            <td className="px-6 py-4 align-middle">
                <div
                    onClick={() => show.externalId && navigate(`/tv/${show.externalId}`)}
                    className="w-14 h-[76px] bg-[#1a1a25] rounded-xl overflow-hidden border border-[#2a2a35] cursor-pointer hover:border-[#c8ff57] transition-all flex-shrink-0 shadow-lg group-hover:scale-105"
                >
                    {imageUrl ? (
                        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">🎬</div>
                    )}
                </div>
            </td>
            <td className="px-6 py-4 align-middle text-center">
                <div>
                    <h4
                        onClick={() => show.externalId && navigate(`/tv/${show.externalId}`)}
                        className="text-white font-bold text-sm hover:text-[#c8ff57] cursor-pointer transition-colors"
                    >
                        {show.title}
                    </h4>
                </div>
            </td>
            <td className="px-6 py-4 align-middle text-center">
                <div className="flex items-center justify-center">
                    {show.rating > 0 ? (
                        <span className="text-[#c8ff57] font-black text-2xl leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{show.rating}</span>
                    ) : (
                        <span className="text-[#3a3a4a] font-mono text-xs">—</span>
                    )}
                </div>
            </td>
            <td className="px-6 py-4 align-middle text-center">
                <div className="flex items-center justify-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest ${sc.color.replace('bg-', 'text-')} bg-white/5 border border-white/5 leading-none`}>
                        {sc.label}
                    </span>
                </div>
            </td>
            <td className="px-6 py-4 align-middle text-center">
                <span className="text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest truncate max-w-[100px] inline-block">
                    {show.genre || 'TV Show'}
                </span>
            </td>
            <td className="px-6 py-4 align-middle">
                <div className="flex flex-col gap-2 min-w-[140px]">
                    {/* Seasons Progress */}
                    <div className="flex items-center gap-2">
                        <div className="h-1 flex-1 bg-[#1a1a25] rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-[#5c9fff] transition-all duration-500" 
                                style={{ width: `${Math.min(100, (show.seasonsWatched / (show.totalSeasons || 1)) * 100)}%` }} 
                            />
                        </div>
                        <span className="text-[#5c9fff] font-mono text-[9px] w-14 text-right">
                            S{show.seasonsWatched || 0}/{show.totalSeasons || '?'}
                        </span>
                    </div>
                    {/* Episodes Progress */}
                    <div className="flex items-center gap-2">
                        <div className="h-1 flex-1 bg-[#1a1a25] rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-[#c8ff57] transition-all duration-500" 
                                style={{ width: `${Math.min(100, (show.episodesWatched / (show.totalEpisodes || 1)) * 100)}%` }} 
                            />
                        </div>
                        <span className="text-[#7a7a90] font-mono text-[9px] w-14 text-right">
                            E{show.episodesWatched || 0}/{show.totalEpisodes || '?'}
                        </span>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 align-middle text-center">
                <div className="flex justify-center gap-2">
                    <button
                        onClick={() => onEdit()}
                        className="p-2 bg-[#1a1a25] border border-[#2a2a35] rounded-lg text-[#7a7a90] hover:text-[#c8ff57] hover:border-[#c8ff57] transition-all"
                    >
                        <Edit3 size={14} />
                    </button>
                    <button
                        onClick={() => onDelete()}
                        className="p-2 bg-[#1a1a25] border border-[#2a2a35] rounded-lg text-[#7a7a90] hover:text-[#ff5c5c] hover:border-[#ff5c5c] transition-all"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </td>
        </tr>
    )
}

export default TVLibrary
