import { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import { Plus, LayoutGrid, List as ListIcon, Filter, Search, BookOpen, Sparkles, Edit3, Trash2 } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../context/AuthContext'
import { useSection } from '../../context/SectionContext'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import MangaCard from '../../components/anime/MangaCard'
import AnimeFilterBar from '../../components/anime/AnimeFilterBar'
import Skeleton from '../../components/ui/Skeleton'
import Toast from '../../components/ui/Toast'
import SubSectionToggle from '../../components/ui/SubSectionToggle'

const AnimeLogModal = lazy(() => import('../../components/anime/AnimeLogModal'))

function MangaLibrary() {
    const { user, updateSettings } = useAuth()
    const navigate = useNavigate()
    
    const [library, setLibrary] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    
    const [viewMode, setViewMode] = useState(user?.settings?.libraryViewMode || 'grid')
    
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingAnime, setEditingAnime] = useState(null)
    const [toast, setToast] = useState(null)

    const fetchLibrary = async () => {
        try {
            setLoading(true)
            const res = await api.get('/anime/library')
            setLibrary(res.data.library || [])
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

    const handleLogAnime = async (data) => {
        try {
            const res = await api.post('/anime/log', data)
            if (res.data.success) {
                showToast(res.data.updated ? `"${data.title}" updated!` : `"${data.title}" added to Pond!`)
                fetchLibrary()
                return { success: true }
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Action failed', 'error')
            return { success: false }
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Remove from library?')) return
        try {
            await api.delete(`/anime/log/${id}`)
            showToast('Removed from library')
            fetchLibrary()
        } catch (err) {
            showToast('Failed to remove', 'error')
        }
    }

    const filteredManga = useMemo(() => {
        return library
            .filter(a => (a.type || a.mediaType) === 'manga')
            .filter(a => filter === 'all' || a.status === filter || (filter === 'playing' && (a.status === 'watching' || a.status === 'reading')))
            .filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
    }, [library, filter, searchQuery])

    const counts = useMemo(() => {
        const sectionItems = library.filter(a => (a.type || a.mediaType) === 'manga')
        return {
            all: sectionItems.length,
            playing: sectionItems.filter(a => a.status === 'playing' || a.status === 'watching' || a.status === 'reading').length,
            completed: sectionItems.filter(a => a.status === 'completed').length,
            planned: sectionItems.filter(a => a.status === 'planned').length,
            paused: sectionItems.filter(a => a.status === 'paused').length,
            dropped: sectionItems.filter(a => a.status === 'dropped').length,
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
                        <Skeleton variant="block" width="100%" className="aspect-video" style={{ borderRadius: '12px' }} />
                        <Skeleton variant="line" width="80%" height="16px" />
                    </div>
                ))}
            </div>
        </div>
    )

    return (
        <div className="min-h-screen pb-32">
            <Helmet>
                <title>My Manga Library | QuestDuck</title>
            </Helmet>

            <div className="bg-[#0a0a0f] border-b border-[#1a1a25] pt-24 pb-16">
                <div className="max-w-[1200px] mx-auto px-5 md:px-10">
                    <SubSectionToggle 
                        current="manga"
                        type="anime"
                        options={[
                            { label: 'Anime', value: 'anime', path: '/anime/library' },
                            { label: 'Manga', value: 'manga', path: '/manga/library' }
                        ]}
                    />

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
                        <div className="relative group">
                            <div className="absolute -left-4 -top-4 w-12 h-12 bg-[#c8ff57]/10 rounded-full blur-2xl group-hover:bg-[#c8ff57]/20 transition-all duration-500" />
                            <div className="flex items-center gap-3 mb-2">
                                <BookOpen size={16} className="text-[#c8ff57]" />
                                <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-[3px]">Multiverse Vault</span>
                            </div>
                            <h1 className="font-black text-5xl md:text-6xl text-white uppercase leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                My <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#c8ff57] to-white bg-[length:200%_auto] animate-gradient">Manga Library</span>
                            </h1>
                            <div className="flex items-center gap-4 mt-4">
                                <div className="px-3 py-1 bg-[#111118] border border-[#2a2a35] rounded-full flex items-center gap-2">
                                    <Sparkles size={10} className="text-[#c8ff57]" />
                                    <span className="text-[#7a7a90] font-mono text-[9px] uppercase tracking-widest">
                                        {counts.all} VOLUMES LOGGED
                                    </span>
                                </div>
                                <div className="px-3 py-1 bg-[#c8ff57]/5 border border-[#c8ff57]/20 rounded-full flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff57] animate-pulse" />
                                    <span className="text-[#c8ff57] font-mono text-[9px] uppercase tracking-widest">
                                        {counts.playing} CURRENTLY READING
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
                            Log New Manga
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1200px] mx-auto px-5 md:px-10 mt-12">
                {/* Control Panel */}
                <div className="flex flex-col lg:flex-row gap-6 mb-12 bg-[#111118]/50 backdrop-blur-xl border border-[#2a2a35] p-5 rounded-3xl shadow-2xl">
                    <div className="flex-1 overflow-x-auto no-scrollbar">
                        <AnimeFilterBar activeFilter={filter} onFilter={setFilter} counts={counts} />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 border-l border-[#2a2a35] pl-6 ml-2 hidden lg:flex">
                        <div className="relative w-full sm:w-72 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white group-focus-within:text-[#c8ff57] transition-colors" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search your manga..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-[#c8ff57] focus:ring-4 focus:ring-[#c8ff57]/5 transition-all placeholder:text-[#3a3a4a]"
                            />
                        </div>
                        
                        <div className="flex bg-[#0d0d14] rounded-2xl border border-[#2a2a35] p-1.5 shadow-inner">
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
                {filteredManga.length > 0 ? (
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10">
                            {filteredManga.map(item => (
                                <MangaCard 
                                    key={item._id} 
                                    anime={item} 
                                    onDelete={() => handleDelete(item._id)}
                                    onEdit={() => setEditingAnime(item)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="overflow-x-auto no-scrollbar bg-[#111118]/50 border border-[#2a2a35] rounded-3xl">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-[#2a2a35] bg-[#0d0d14]">
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest w-16">#</th>
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest w-24">Image</th>
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest">Title</th>
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest text-center">Score</th>
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest">Progress</th>
                                        <th className="px-6 py-4 font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredManga.map((manga, idx) => (
                                        <MangaRow 
                                            key={manga._id} 
                                            manga={manga} 
                                            index={idx + 1}
                                            onDelete={() => handleDelete(manga._id)}
                                            onEdit={() => setEditingAnime(manga)}
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
                                <BookOpen size={40} className="text-[#4a4a5e]" />
                            </div>
                            <h3 className="text-white font-black text-3xl uppercase mb-3 tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {searchQuery ? 'Zero Matches' : 'Vault Empty'}
                            </h3>
                            <p className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                                {searchQuery ? `No results for "${searchQuery}". Maybe try a different keyword?` : 'Your manga journey begins with a single log.'}
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
                    <AnimeLogModal 
                        onClose={() => setShowAddModal(false)} 
                        onAdd={handleLogAnime}
                        items={library}
                    />
                )}
                {editingAnime && (
                    <AnimeLogModal 
                        onClose={() => setEditingAnime(null)}
                        onAdd={handleLogAnime}
                        existingEntry={editingAnime}
                        items={library}
                    />
                )}
            </Suspense>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    )
}

function MangaRow({ manga, index, onDelete, onEdit }) {
    const navigate = useNavigate()
    const statusConfig = {
        watching: { color: 'bg-[#c8ff57]', label: 'Reading' },
        playing: { color: 'bg-[#c8ff57]', label: 'Reading' },
        completed: { color: 'bg-[#5c9fff]', label: 'Completed' },
        planned: { color: 'bg-[#ff9f5c]', label: 'Planned' },
        dropped: { color: 'bg-[#ff5c5c]', label: 'Dropped' },
        paused: { color: 'bg-[#c45cff]', label: 'Paused' },
    }
    const sc = statusConfig[manga.status] || statusConfig.planned
    const imageUrl = manga.cover || manga.coverImage

    return (
        <tr className="border-b border-[#2a2a35] hover:bg-white/[0.02] transition-colors group">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className={`w-1 h-8 rounded-full ${sc.color}`} />
                    <span className="font-mono text-xs text-[#4a4a5e]">{index}</span>
                </div>
            </td>
            <td className="px-6 py-4">
                <div 
                    onClick={() => manga.externalId && navigate(`/manga/${manga.externalId}`)}
                    className="w-12 h-16 bg-[#1a1a25] rounded-lg overflow-hidden border border-[#2a2a35] cursor-pointer hover:border-[#c8ff57] transition-all"
                >
                    {imageUrl ? (
                        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">📚</div>
                    )}
                </div>
            </td>
            <td className="px-6 py-4">
                <div>
                    <h4 
                        onClick={() => manga.externalId && navigate(`/manga/${manga.externalId}`)}
                        className="text-white font-bold text-sm hover:text-[#c8ff57] cursor-pointer transition-colors"
                    >
                        {manga.title}
                    </h4>
                    <p className="text-[#4a4a5e] font-mono text-[10px] uppercase tracking-wider mt-0.5">{manga.genre}</p>
                </div>
            </td>
            <td className="px-6 py-4 text-center">
                {manga.rating > 0 ? (
                    <div className="flex flex-col items-center">
                        <span className="text-[#c8ff57] font-black text-2xl leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{manga.rating}</span>
                    </div>
                ) : (
                    <span className="text-[#3a3a4a] font-mono text-xs">—</span>
                )}
            </td>
            <td className="px-6 py-4">
                <span className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest ${sc.color.replace('bg-', 'text-')} bg-white/5 border border-white/5`}>
                    {sc.label}
                </span>
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 max-w-[60px] bg-[#1a1a25] rounded-full overflow-hidden">
                        <div 
                            className={`h-full ${sc.color}`} 
                            style={{ width: `${Math.min(100, (manga.chaptersRead / (manga.totalChapters || 1)) * 100)}%` }} 
                        />
                    </div>
                    <span className="text-[#7a7a90] font-mono text-[10px]">
                        {manga.chaptersRead || 0} / {manga.totalChapters || '?'}
                    </span>
                </div>
            </td>
            <td className="px-6 py-4 text-center">
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

export default MangaLibrary
