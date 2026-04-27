import { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, LayoutGrid, List as ListIcon, Filter, Search, Film, Tv } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../context/AuthContext'
import { useSection } from '../../context/SectionContext'
import api from '../../api/axios'
import MovieCard from '../../components/movies/MovieCard'
import MovieFilterBar from '../../components/movies/MovieFilterBar'
import Skeleton from '../../components/ui/Skeleton'
import SubSectionToggle from '../../components/ui/SubSectionToggle'
import Toast from '../../components/ui/Toast'

const MovieLogModal = lazy(() => import('../../components/movies/MovieLogModal'))

function MoviesLibrary() {
    const { user } = useAuth()
    const location = useLocation()
    
    const [library, setLibrary] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [viewMode, setViewMode] = useState('grid')
    
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingMovie, setEditingMovie] = useState(null)
    const [toast, setToast] = useState(null)

    const fetchLibrary = async () => {
        try {
            setLoading(true)
            const res = await api.get('/movies/library')
            setLibrary(res.data.library || [])
        } catch (err) {
            console.error('Failed to fetch library:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (user) fetchLibrary()
    }, [user, location.key])

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
    }

    const handleLogMovie = async (data) => {
        try {
            const res = await api.post('/movies/log', data)
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
            await api.delete(`/movies/log/${id}`)
            showToast('Removed from library')
            fetchLibrary()
        } catch (err) {
            showToast('Failed to remove', 'error')
        }
    }

    const filteredMovies = useMemo(() => {
        return library
            .filter(m => (m.type || m.mediaType) === 'movie')
            .filter(m => filter === 'all' || m.status === filter)
            .filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()))
    }, [library, filter, searchQuery])

    const counts = useMemo(() => {
        const sectionItems = library.filter(m => (m.type || m.mediaType) === 'movie')
        return {
            all: sectionItems.length,
            playing: sectionItems.filter(m => m.status === 'playing').length,
            completed: sectionItems.filter(m => m.status === 'completed').length,
            planned: sectionItems.filter(m => m.status === 'planned').length,
            paused: sectionItems.filter(m => m.status === 'paused').length,
            dropped: sectionItems.filter(m => m.status === 'dropped').length,
        }
    }, [library])

    if (loading) return (
        <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-24">
            <Skeleton variant="line" width="200px" height="40px" className="mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                        <Skeleton variant="block" width="100%" height="220px" style={{ borderRadius: '12px' }} />
                        <Skeleton variant="line" width="80%" height="16px" />
                    </div>
                ))}
            </div>
        </div>
    )

    return (
        <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-24">
            <Helmet>
                <title>My Movie Library | QuestDuck</title>
            </Helmet>
            <SubSectionToggle 
                current="movie"
                type="cinema"
                options={[
                    { label: 'Movies', value: 'movie', path: '/movies/library' },
                    { label: 'TV Shows', value: 'tv', path: '/tv/library' }
                ]}
            />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
                <div>
                    <h1 className="font-black text-5xl text-white uppercase" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        My <span className="text-[#c8ff57]">Movie Library</span>
                    </h1>
                    <p className="text-[#7a7a90] font-mono text-xs uppercase tracking-wider mt-2">
                        {counts.all} items tracked in your pond
                    </p>
                </div>

                <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-[#c8ff57] text-black px-6 py-3 rounded-lg font-black uppercase text-sm tracking-widest flex items-center gap-2 hover:bg-[#d4ff6e] transition-all shadow-[0_8px_20px_rgba(200,255,87,0.2)]"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                    <Plus size={20} strokeWidth={3} /> Log Movie
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mb-8 bg-[#111118] border border-[#2a2a35] p-4 rounded-xl">
                <div className="flex-1">
                    <MovieFilterBar activeFilter={filter} onFilter={setFilter} counts={counts} />
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a5e]" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search library..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c8ff57] transition-all"
                        />
                    </div>
                    
                    <div className="flex bg-[#0d0d14] rounded-lg border border-[#2a2a35] p-1">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-[#c8ff57] text-black' : 'text-[#7a7a90] hover:text-white'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-[#c8ff57] text-black' : 'text-[#7a7a90] hover:text-white'}`}
                        >
                            <ListIcon size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {filteredMovies.length > 0 ? (
                <div className={viewMode === 'grid' 
                    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6"
                    : "flex flex-col gap-3"
                }>
                    {filteredMovies.map(item => (
                        <MovieCard 
                            key={item._id} 
                            movie={item} 
                            onDelete={() => handleDelete(item._id)}
                            onEdit={() => setEditingMovie(item)}
                        />
                    ))}
                </div>
            ) : (
                <div className="py-24 text-center border-2 border-dashed border-[#2a2a35] rounded-2xl bg-[#111118]">
                    <div className="text-5xl mb-6 opacity-50">🍿</div>
                    <h3 className="text-white font-bold text-xl mb-2">No movies found</h3>
                    <p className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest">
                        {searchQuery ? 'Try a different search' : 'Start logging your collection'}
                    </p>
                </div>
            )}

            <Suspense fallback={null}>
                {showAddModal && (
                    <MovieLogModal 
                        onClose={() => setShowAddModal(false)} 
                        onAdd={handleLogMovie}
                        items={library}
                    />
                )}
                {editingMovie && (
                    <MovieLogModal 
                        onClose={() => setEditingMovie(null)}
                        onAdd={handleLogMovie}
                        existingEntry={editingMovie}
                        items={library}
                    />
                )}
            </Suspense>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    )
}

export default MoviesLibrary
