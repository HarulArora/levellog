import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { Helmet } from 'react-helmet-async'
import { Gamepad2, Film, Tv, Monitor, BookOpen, Heart, Bookmark, Search, LayoutGrid, List as ListIcon, Sparkles, ChevronRight, History } from 'lucide-react'
import Shuriken from '../components/ui/Shuriken'
import { getIGDBImage, SIZES } from '../utils/igdb'

const MEDIA_TYPES = [
    { id: 'game', label: 'Games', icon: Gamepad2, color: '#c8ff57' },
    { id: 'anime', label: 'Anime', icon: Shuriken, color: '#5c9fff' },
    { id: 'manga', label: 'Manga', icon: BookOpen, color: '#ff9f5c' },
    { id: 'movie', label: 'Movies', icon: Film, color: '#ff5c5c' },
    { id: 'tv', label: 'TV Shows', icon: Tv, color: '#c45cff' }
]

function Collections() {
    const { user, loading: authLoading } = useAuth()
    const navigate = useNavigate()
    const [activeMediaType, setActiveMediaType] = useState('game')
    const [activeSection, setActiveSection] = useState('likes') // 'likes' or 'wishlist'
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login')
        }
    }, [user, authLoading, navigate])

    const { data: likesData, loading: likesLoading } = useCachedFetch(
        user?._id ? `collections_likes_${user._id}_${activeMediaType}` : null,
        user?._id ? `/lists/user/${user._id}/likes?mediaType=${activeMediaType}` : null,
        { enabled: !!user?._id, deps: [user?._id, activeMediaType] }
    )

    const { data: wishlistData, loading: wishlistLoading } = useCachedFetch(
        user?._id ? `collections_wishlist_${user._id}_${activeMediaType}` : null,
        user?._id ? `/lists/user/${user._id}/wishlist?mediaType=${activeMediaType}` : null,
        { enabled: !!user?._id, deps: [user?._id, activeMediaType] }
    )

    const likes = likesData?.likes || []
    const wishlist = wishlistData?.wishlist || []
    const currentItems = activeSection === 'likes' ? likes : wishlist
    const loading = likesLoading || wishlistLoading

    const filteredItems = useMemo(() => {
        if (!searchQuery) return currentItems
        const q = searchQuery.toLowerCase()
        return currentItems.filter(item => 
            (item.title_english || item.gameTitle || item.title || '').toLowerCase().includes(q)
        )
    }, [currentItems, searchQuery])

    if (authLoading) return <div className="min-h-screen bg-[#0a0a0f]" />

    return (
        <div className="min-h-screen bg-[#0a0a0f] pb-32">
            <Helmet>
                <title>My Collections | QuestDuck</title>
            </Helmet>

            {/* Header Section */}
            <div className="bg-[#0d0d14] border-b border-[#1a1a25] pt-10 pb-16 relative overflow-hidden">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#c8ff57]/5 blur-[120px] pointer-events-none" />
                
                <div className="max-w-[1200px] mx-auto px-5 md:px-10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-2">
                                <Sparkles size={16} className="text-[#c8ff57]" />
                                <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-[3px]">Trophy Vault</span>
                            </div>
                            <h1 className="font-black text-5xl md:text-6xl text-white uppercase leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                My <span className="text-[#c8ff57]">Collections</span>
                            </h1>
                            <p className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest mt-4 opacity-60">
                                Your curated odyssey across all dimensions
                            </p>
                        </div>

                        {/* Quick Stats */}
                        <div className="flex w-full sm:w-auto gap-3 sm:gap-4">
                            <div className="flex-1 sm:flex-none px-5 py-3 bg-[#111118] border border-[#2a2a35] rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-black/20">
                                <span className="text-[#c8ff57] font-black text-2xl leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {likes.length}
                                </span>
                                <span className="text-[#4a4a5e] font-mono text-[9px] uppercase tracking-wider mt-1">Likes</span>
                            </div>
                            <div className="flex-1 sm:flex-none px-5 py-3 bg-[#111118] border border-[#2a2a35] rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-black/20">
                                <span className="text-[#5c9fff] font-black text-2xl leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {wishlist.length}
                                </span>
                                <span className="text-[#4a4a5e] font-mono text-[9px] uppercase tracking-wider mt-1">
                                    {activeMediaType === 'game' ? 'Wishlist' : 'Watchlist'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1200px] mx-auto px-5 md:px-10 mt-12">
                {/* Media Type Tabs */}
                <div className="flex gap-2 p-1.5 bg-[#0a0a0f]/90 backdrop-blur-2xl border border-[#2a2a35] rounded-2xl overflow-x-auto no-scrollbar mb-8 sticky top-20 z-30 shadow-2xl">
                    {MEDIA_TYPES.map(m => {
                        const isActive = activeMediaType === m.id
                        return (
                            <button
                                key={m.id}
                                onClick={() => setActiveMediaType(m.id)}
                                className={`
                                    flex items-center gap-3 px-6 py-3 rounded-xl font-mono text-[11px] uppercase tracking-[0.1em] transition-all whitespace-nowrap
                                    ${isActive 
                                        ? 'bg-[#c8ff57] text-black font-black shadow-[0_10px_25px_rgba(200,255,87,0.2)]' 
                                        : 'text-[#7a7a90] hover:text-white hover:bg-white/5'}
                                `}
                            >
                                <m.icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                                {m.label}
                            </button>
                        )
                    })}
                </div>

                {/* Sub-Navigation & Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-10">
                    {/* Likes/Wishlist Toggle */}
                    <div className="flex bg-[#111118] p-1 rounded-xl border border-[#2a2a35] w-full sm:w-auto">
                        <button
                            onClick={() => setActiveSection('likes')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all
                                ${activeSection === 'likes' 
                                    ? 'bg-white/10 text-[#c8ff57] border border-[#c8ff57]/20 shadow-lg shadow-black/20' 
                                    : 'text-[#7a7a90] hover:text-white'}`}
                        >
                            <Heart size={14} fill={activeSection === 'likes' ? '#c8ff57' : 'none'} className={activeSection === 'likes' ? 'text-[#c8ff57]' : ''} />
                            Liked
                        </button>
                        <button
                            onClick={() => setActiveSection('wishlist')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all
                                ${activeSection === 'wishlist' 
                                    ? 'bg-white/10 text-[#5c9fff] border border-[#5c9fff]/20 shadow-lg shadow-black/20' 
                                    : 'text-[#7a7a90] hover:text-white'}`}
                        >
                            <Bookmark size={14} fill={activeSection === 'wishlist' ? '#5c9fff' : 'none'} className={activeSection === 'wishlist' ? 'text-[#5c9fff]' : ''} />
                            {activeMediaType === 'game' ? 'Wishlist' : 'Watchlist'}
                        </button>
                    </div>

                    {/* Search */}
                    <div className="flex-1 relative group w-full">
                        <input 
                            type="text" 
                            placeholder={`Search in your ${activeMediaType} ${activeSection}...`}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-[#111118] border border-[#2a2a35] rounded-xl pl-12 pr-6 py-4 text-sm text-white focus:outline-none focus:border-[#c8ff57]/40 transition-all placeholder:text-[#3a3a4a] shadow-inner"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3a3a4a] group-focus-within:text-[#c8ff57] transition-colors" size={18} />
                    </div>
                </div>

                {/* Grid Content */}
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="rounded-2xl border border-[#2a2a35] bg-[#111118] overflow-hidden animate-pulse">
                                <div className="aspect-[3/4] bg-[#1e1e28]" />
                                <div className="p-4 space-y-2">
                                    <div className="h-3 bg-[#2a2a35] rounded w-3/4" />
                                    <div className="h-3 bg-[#2a2a35] rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredItems.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {filteredItems.map((item, idx) => (
                            <CollectionCard key={`${item.igdbId || item.externalId}-${idx}`} item={item} mediaType={activeMediaType} />
                        ))}
                    </div>
                ) : (
                    <div className="py-32 text-center border-2 border-dashed border-[#2a2a35] rounded-[40px] bg-[#111118]/30 backdrop-blur-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-b from-[#c8ff57]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-20 h-20 bg-[#1a1a25] rounded-3xl flex items-center justify-center mb-8 border border-[#2a2a35] group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                                {activeSection === 'likes' ? <Heart size={32} className="text-[#4a4a5e]" /> : <Bookmark size={32} className="text-[#4a4a5e]" />}
                            </div>
                            <h3 className="text-white font-black text-3xl uppercase mb-3 tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Vault Section Empty
                            </h3>
                            <p className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                                You haven't added any {activeMediaType} items to your {activeSection} yet.
                            </p>
                            <Link 
                                to={activeMediaType === 'game' ? '/discover' : `/${activeMediaType}/discover`}
                                className="mt-8 px-8 py-3 bg-[#c8ff57] text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#c8ff57]/10"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                                Explore {activeMediaType}s →
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function CollectionCard({ item, mediaType }) {
    const isGame = mediaType === 'game'
    const imageUrl = isGame
        ? getIGDBImage(item.gameCover || (item.steamId ? `https://cdn.akamai.steamstatic.com/steam/apps/${item.steamId}/header.jpg` : null), SIZES.COVER_BIG)
        : (item.gameCover || item.coverImage || item.cover)
    
    const itemId = item.igdbId || item.externalId
    const pathMap = {
        game: `/game/${itemId}`,
        anime: `/anime/${itemId}`,
        manga: `/manga/${itemId}`,
        movie: `/movies/${itemId}`,
        tv: `/tv/${itemId}`
    }
    const detailPath = pathMap[mediaType] || '#'

    return (
        <Link to={detailPath} className="group relative">
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-[#2a2a35] bg-[#111118] group-hover:border-[#c8ff57]/50 transition-all duration-500 shadow-2xl">
                {imageUrl ? (
                    <img 
                        src={imageUrl} 
                        alt="" 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Gamepad2 size={48} className="text-[#2a2a35]" />
                    </div>
                ) }

                {/* Glass Overlay on Hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                

                {/* Bottom Info */}
                <div className="absolute inset-x-0 bottom-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                    <h4 className="text-white font-bold text-sm leading-tight mb-1 line-clamp-2 group-hover:text-[#c8ff57] transition-colors">
                        {item.title_english || item.gameTitle || item.title}
                    </h4>
                    <div className="flex items-center justify-between mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                        <span className="font-mono text-[8px] text-[#7a7a90] uppercase tracking-widest">View Details</span>
                        <ChevronRight size={12} className="text-[#c8ff57]" />
                    </div>
                </div>
            </div>
        </Link>
    )
}

export default Collections
