import { useState, useEffect, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, List as ListIcon, Heart, Bookmark, Search, Trash2, Share2, ChevronRight, Film, Tv } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { useSection } from '../../context/SectionContext'
import Skeleton from '../../components/ui/Skeleton'
import Toast from '../../components/ui/Toast'
import SubSectionToggle from '../../components/ui/SubSectionToggle'

// ── Components ──

const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction }) => (
    <div className="py-20 text-center bg-[#111118] border border-[#2a2a35] border-dashed rounded-2xl">
        <div className="w-16 h-16 bg-[#18181f] border border-[#2a2a35] rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon size={24} className="text-[#4a4a5e]" />
        </div>
        <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
        <p className="text-[#7a7a90] text-sm mb-8 max-w-xs mx-auto">{description}</p>
        {actionLabel && (
            <button 
                onClick={onAction}
                className="bg-[#c8ff57] text-black px-6 py-2.5 rounded-lg font-black uppercase text-xs tracking-widest hover:bg-[#d4ff6e] transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
                {actionLabel}
            </button>
        )}
    </div>
)

const ListItemCard = memo(({ item, onRemove, section }) => {
    const navigate = useNavigate()
    return (
        <div className="group relative bg-[#111118] border border-[#2a2a35] rounded-xl overflow-hidden hover:border-[#c8ff57] transition-all duration-300">
            <div className="aspect-[3/4] relative overflow-hidden cursor-pointer" onClick={() => navigate(`/movies/${item.externalId}?type=${section}`)}>
                <img src={item.cover} alt={item.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-white text-black px-3 py-1.5 rounded font-black uppercase text-[10px] tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>View</div>
                </div>
                {onRemove && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRemove(item.externalId) }}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-[#ff5c5c] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#ff5c5c] hover:text-white"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
            <div className="p-3">
                <div className="text-white font-bold text-xs truncate group-hover:text-[#c8ff57] transition-colors">{item.title}</div>
                <div className="font-mono text-[9px] text-[#7a7a90] mt-1 uppercase tracking-wider">{item.genre || 'Media'}</div>
            </div>
        </div>
    )
})

function MoviesLists() {
    const { user } = useAuth()
    const navigate = useNavigate()
    
    const [activeTab, setActiveTab] = useState('my-lists')
    const [loading, setLoading] = useState(true)
    const [myLists, setMyLists] = useState([])
    const [likedMovies, setLikedMovies] = useState([])
    const [wishlist, setWishlist] = useState([])
    
    const [selectedList, setSelectedList] = useState(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newListData, setNewListData] = useState({ name: '', description: '', isPublic: true })
    const [toast, setToast] = useState(null)

    const fetchAllData = async () => {
        if (!user) return
        setLoading(true)
        try {
            const [listsRes, likesRes, wishRes] = await Promise.all([
                api.get('/lists/me'),
                api.get('/lists/liked'),
                api.get('/lists/wishlist')
            ])
            setMyLists(listsRes.data.customLists || [])
            setLikedMovies(likesRes.data.likedMovies || [])
            setWishlist(wishRes.data.wishlist || [])
        } catch (err) {
            console.error('Fetch error:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAllData()
    }, [user])

    const showToast = (message, type = 'success') => setToast({ message, type })

    const handleCreateList = async () => {
        if (!newListData.name.trim()) return
        try {
            await api.post('/lists/custom', { ...newListData, mediaType: 'movie' })
            showToast('Collection created!')
            setShowCreateModal(false)
            setNewListData({ name: '', description: '', isPublic: true })
            fetchAllData()
        } catch {
            showToast('Failed to create collection', 'error')
        }
    }

    const handleDeleteList = async (id) => {
        if (!window.confirm('Delete this collection?')) return
        try {
            await api.delete(`/lists/custom/${id}`)
            showToast('Collection deleted')
            fetchAllData()
        } catch {
            showToast('Failed to delete', 'error')
        }
    }

    const handleRemoveFromList = async (listId, externalId) => {
        try {
            await api.put(`/lists/custom/${listId}/game`, { igdbId: externalId, action: 'remove' })
            showToast('Removed from collection')
            fetchAllData()
            if (selectedList && selectedList._id === listId) {
                setSelectedList(prev => ({
                    ...prev,
                    items: prev.items.filter(i => i.externalId !== externalId)
                }))
            }
        } catch {
            showToast('Failed to remove', 'error')
        }
    }

    const filteredLiked = useMemo(() => likedMovies.filter(m => (m.type || m.mediaType) === 'movie'), [likedMovies])
    const filteredWishlist = useMemo(() => wishlist.filter(m => (m.type || m.mediaType) === 'movie'), [wishlist])
    const filteredLists = useMemo(() => myLists.filter(l => l.mediaType === 'movie'), [myLists])

    if (loading) return (
        <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-24">
            <Skeleton variant="line" width="300px" height="48px" className="mb-12" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} variant="block" width="100%" height="200px" style={{ borderRadius: '16px' }} />
                ))}
            </div>
        </div>
    )

    return (
        <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-24 min-h-screen">
            <Helmet>
                <title>My Movie Collections | QuestDuck</title>
            </Helmet>
            <SubSectionToggle 
                current="movie"
                type="cinema"
                options={[
                    { label: 'Movies', value: 'movie', path: '/movies/lists' },
                    { label: 'TV Shows', value: 'tv', path: '/tv/lists' }
                ]}
            />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
                <div>
                    <h1 className="font-black text-5xl text-white uppercase" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        My <span className="text-[#c8ff57]">Collections</span>
                    </h1>
                </div>

                <div className="flex bg-[#111118] border border-[#2a2a35] p-1 rounded-xl">
                    <button 
                        onClick={() => { setActiveTab('my-lists'); setSelectedList(null); }}
                        className={`px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'my-lists' ? 'bg-[#2a2a35] text-[#c8ff57] shadow-lg' : 'text-[#7a7a90] hover:text-white'}`}
                    >
                        Collections
                    </button>
                    <button 
                        onClick={() => { setActiveTab('liked'); setSelectedList(null); }}
                        className={`px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'liked' ? 'bg-[#2a2a35] text-[#ff5c5c] shadow-lg' : 'text-[#7a7a90] hover:text-white'}`}
                    >
                        Liked
                    </button>
                    <button 
                        onClick={() => { setActiveTab('wishlist'); setSelectedList(null); }}
                        className={`px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'wishlist' ? 'bg-[#2a2a35] text-[#5c9fff] shadow-lg' : 'text-[#7a7a90] hover:text-white'}`}
                    >
                        Wishlist
                    </button>
                </div>
            </div>

            {selectedList && (
                <button onClick={() => setSelectedList(null)} className="flex items-center gap-2 text-[#7a7a90] hover:text-white font-mono text-xs uppercase tracking-widest mb-8 transition-colors group">
                    <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" /> Back to Collections
                </button>
            )}

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {selectedList ? (
                    <div>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 bg-[#111118] border border-[#2a2a35] p-8 rounded-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <ListIcon size={120} />
                            </div>
                            <div className="relative z-10">
                                <h2 className="font-black text-4xl text-white uppercase mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{selectedList.name}</h2>
                                <p className="text-[#7a7a90] text-sm max-w-xl">{selectedList.description || 'No description provided.'}</p>
                                <div className="flex items-center gap-4 mt-6">
                                    <span className="font-mono text-[10px] text-[#c8ff57] uppercase tracking-widest px-2 py-1 bg-[#c8ff57]/10 rounded border border-[#c8ff57]/20">{selectedList.items.length} items</span>
                                    <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest">Created {new Date(selectedList.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 relative z-10">
                                <button onClick={() => handleDeleteList(selectedList._id)} className="p-2.5 bg-[#ff5c5c]/10 text-[#ff5c5c] rounded-lg hover:bg-[#ff5c5c] hover:text-white transition-all"><Trash2 size={18} /></button>
                            </div>
                        </div>

                        {selectedList.items.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {selectedList.items.map(item => (
                                    <ListItemCard key={item.externalId} item={item} onRemove={(id) => handleRemoveFromList(selectedList._id, id)} />
                                ))}
                            </div>
                        ) : (
                            <EmptyState 
                                icon={Search}
                                title="Collection is empty"
                                description="Search and add movies to this collection from their detail pages."
                                actionLabel="Browse Trending"
                                onAction={() => navigate('/movies/discover')}
                            />
                        )}
                    </div>
                ) : (
                    <>
                        {activeTab === 'my-lists' && (
                            <div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <button 
                                        onClick={() => setShowCreateModal(true)}
                                        className="h-48 border-2 border-dashed border-[#2a2a35] rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-[#c8ff57] hover:bg-[#c8ff57]/05 transition-all group"
                                    >
                                        <div className="w-12 h-12 bg-[#111118] border border-[#2a2a35] rounded-full flex items-center justify-center group-hover:bg-[#c8ff57] group-hover:text-black transition-all">
                                            <Plus size={24} />
                                        </div>
                                        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7a7a90] group-hover:text-white">Create New Collection</span>
                                    </button>

                                    {filteredLists.map(list => (
                                        <div 
                                            key={list._id}
                                            onClick={() => setSelectedList(list)}
                                            className="h-48 bg-[#111118] border border-[#2a2a35] rounded-2xl p-6 relative overflow-hidden cursor-pointer group hover:border-[#c8ff57] transition-all hover:-translate-y-1 shadow-lg"
                                        >
                                            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                                <ListIcon size={120} />
                                            </div>
                                            <div className="flex flex-col h-full relative z-10">
                                                <h3 className="font-black text-2xl text-white uppercase mb-2 truncate group-hover:text-[#c8ff57] transition-colors" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{list.name}</h3>
                                                <p className="text-[#7a7a90] text-xs line-clamp-2 mb-auto">{list.description || 'No description.'}</p>
                                                <div className="flex items-center justify-between mt-4">
                                                    <span className="font-mono text-[10px] text-[#4a4a5e] uppercase tracking-widest">{list.items.length} items</span>
                                                    <span className="text-[#c8ff57] opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">Open →</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {filteredLists.length === 0 && !loading && (
                                    <div className="mt-8">
                                        <EmptyState 
                                            icon={ListIcon}
                                            title="No collections yet"
                                            description="Group your favorite movies into custom collections like 'Oscar Winners' or 'Must Watch'."
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'liked' && (
                            <div>
                                {filteredLiked.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                        {filteredLiked.map(item => (
                                            <ListItemCard key={item.externalId} item={item} />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState 
                                        icon={Heart}
                                        title="No liked items"
                                        description="Movies you ❤️ will appear here for quick access."
                                        actionLabel="Browse Popular"
                                        onAction={() => navigate('/movies/discover')}
                                    />
                                )}
                            </div>
                        )}

                        {activeTab === 'wishlist' && (
                            <div>
                                {filteredWishlist.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                        {filteredWishlist.map(item => (
                                            <ListItemCard key={item.externalId} item={item} />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState 
                                        icon={Bookmark}
                                        title="Wishlist is empty"
                                        description="Keep track of upcoming releases or movies you want to watch later."
                                        actionLabel="Discover Upcoming"
                                        onAction={() => navigate('/movies/discover')}
                                    />
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowCreateModal(false)} />
                    <div className="relative bg-[#111118] border border-[#2a2a35] rounded-2xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="font-black text-3xl text-white uppercase mb-6" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Create Collection</h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest mb-2">Collection Name</label>
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="e.g. Masterpieces"
                                    value={newListData.name}
                                    onChange={(e) => setNewListData({...newListData, name: e.target.value})}
                                    className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c8ff57] transition-all"
                                />
                            </div>
                            <div>
                                <label className="block font-mono text-[10px] text-[#7a7a90] uppercase tracking-widest mb-2">Description (Optional)</label>
                                <textarea 
                                    placeholder="What's this collection about?"
                                    value={newListData.description}
                                    onChange={(e) => setNewListData({...newListData, description: e.target.value})}
                                    rows={3}
                                    className="w-full bg-[#0d0d14] border border-[#2a2a35] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c8ff57] transition-all resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button 
                                    onClick={handleCreateList}
                                    disabled={!newListData.name.trim()}
                                    className="flex-1 bg-[#c8ff57] text-black py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-[#d4ff6e] transition-all disabled:opacity-50"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                    Create Collection
                                </button>
                                <button 
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-6 border border-[#2a2a35] text-[#7a7a90] rounded-xl font-mono text-[10px] uppercase tracking-widest hover:text-white hover:border-white transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    )
}

export default MoviesLists
