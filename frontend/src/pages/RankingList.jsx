import { useState, memo, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ChevronLeft, Flame, Trophy, Calendar, Star } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useGamesContext } from '../context/GamesContext'
import { useAnimeContext } from '../context/AnimeContext'
import { useMoviesContext } from '../context/MoviesContext'
import useCachedFetch from '../hooks/useCachedFetch'
import { GameCardSkeleton } from '../components/ui/Skeleton'
import { getIGDBImage, SIZES } from '../utils/igdb'

const RankingCard = memo(({ item, contentType, index, myRating }) => {
    const navigate = useNavigate()
    
    const handleClick = () => {
        if (!item.contentId || isNaN(Number(item.contentId))) return;
        const pathMap = {
            game: `/game/${item.contentId}`,
            anime: `/anime/${item.contentId}?type=anime`,
            manga: `/manga/${item.contentId}?type=manga`,
            movie: `/movies/${item.contentId}?type=movie`,
            tv: `/tv/${item.contentId}?type=tv`
        }
        navigate(pathMap[contentType])
    }

    const coverUrl = contentType === 'game' 
        ? getIGDBImage(item.cover, SIZES.COVER_BIG)
        : item.cover

    return (
        <div 
            onClick={handleClick}
            className="group relative bg-[#111118] border border-[#2a2a35] rounded-xl overflow-hidden cursor-pointer hover:border-[#c8ff57] hover:-translate-y-1 transition-all duration-300 shadow-lg"
        >
            <div className="aspect-[3/4] relative overflow-hidden">
                {coverUrl ? (
                    <img 
                        src={coverUrl} 
                        alt={item.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    />
                ) : (
                    <div className="w-full h-full bg-[#18181f] flex items-center justify-center text-4xl">
                        {contentType === 'game' ? '🎮' : '🎬'}
                    </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d14] via-transparent to-transparent opacity-60" />
                
                {/* Rank Badge */}
                <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md border border-white/10 rounded px-2 py-1 flex items-center gap-1 shadow-xl z-10">
                    <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">#</span>
                    <span className="font-black text-sm text-[#c8ff57]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{index + 1}</span>
                </div>

                {/* Rating Badges */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                    {item.avgRating > 0 && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#5c9fff]/30 rounded px-2 py-1 flex items-center gap-1 shadow-xl w-[48px] justify-center h-[22px]">
                            <Star size={10} style={{ color: '#5c9fff', fill: '#5c9fff' }} />
                            <span className="font-black text-xs text-[#5c9fff]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                {(() => {
                                    const raw = item.avgRating;
                                    const val = raw > 10 ? raw / 10 : raw;
                                    return Number(val.toFixed(1)); 
                                })()}
                            </span>
                        </div>
                    )}
                    {myRating && (
                        <div className="bg-black/80 backdrop-blur-md border border-[#c8ff57]/30 rounded px-2 py-1 flex items-center gap-1 shadow-xl w-[48px] justify-center h-[22px]">
                            <span className="font-black text-[8px] text-[#c8ff57] mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>ME</span>
                            <span className="font-black text-xs text-[#c8ff57]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{myRating}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4">
                <h3 className="font-bold text-sm text-white truncate mb-1 group-hover:text-[#c8ff57] transition-colors">
                    {item.title}
                </h3>
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#7a7a90] uppercase tracking-wider">{item.year || 'TBA'}</span>
                    <span className="w-1 h-1 rounded-full bg-[#3a3a4a]" />
                    <span className="font-mono text-[9px] text-[#c8ff57] uppercase tracking-widest truncate">
                        {item.genres?.[0] || 'Media'}
                    </span>
                </div>
            </div>
        </div>
    )
})

export default function RankingList() {
    const { contentType, rankType } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { games } = useGamesContext()
    const { animeList } = useAnimeContext()
    const { moviesList } = useMoviesContext()
    const [userLibrary, setUserLibrary] = useState([])

    // Load appropriate library based on media type
    useEffect(() => {
        if (!user) {
            setUserLibrary([])
            return
        }
        if (contentType === 'game') {
            setUserLibrary(games)
        } else if (contentType === 'anime' || contentType === 'manga') {
            setUserLibrary(animeList)
        } else if (contentType === 'movie' || contentType === 'tv') {
            setUserLibrary(moviesList)
        }
    }, [user, contentType, games, animeList, moviesList])

    const getMyRating = useCallback((contentId) => {
        if (!user || !contentId) return null
        const idStr = String(contentId)

        if (contentType === 'game') {
            const match = userLibrary.find(g => g.igdbId && String(g.igdbId) === idStr)
            return match?.rating > 0 ? match.rating : null
        }
        if (contentType === 'anime' || contentType === 'manga') {
            const match = userLibrary.find(a => String(a.externalId) === idStr && (a.type || a.mediaType) === contentType)
            return match?.rating > 0 ? match.rating : null
        }
        if (contentType === 'movie' || contentType === 'tv') {
            const match = userLibrary.find(m => String(m.externalId) === idStr && (m.type || m.mediaType) === contentType)
            return match?.rating > 0 ? match.rating : null
        }
        return null
    }, [user, contentType, userLibrary])

    const { data: rankingData, loading } = useCachedFetch(
        `rankings_${contentType}_${rankType}`,
        `/rankings/${rankType}?type=${contentType}&limit=100`,
        { ttl: 10 * 60 * 1000 }
    )

    const rankings = rankingData?.rankings || []
    const [visibleCount, setVisibleCount] = useState(18)
    const observerTarget = useRef(null)

    // Reset visibility when category changes
    useEffect(() => {
        setVisibleCount(18)
    }, [contentType, rankType])

    // Infinite Scroll / Progressive Loading
    useEffect(() => {
        if (!rankings.length || visibleCount >= rankings.length) return

        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting) {
                    setVisibleCount(prev => Math.min(prev + 12, rankings.length))
                }
            },
            { threshold: 0.1, rootMargin: '200px' }
        )

        if (observerTarget.current) observer.observe(observerTarget.current)
        return () => observer.disconnect()
    }, [rankings.length, visibleCount])

    const titleMap = {
        trending: 'Trending',
        top_rated: 'Top Rated',
        coming_soon: 'Coming Soon'
    }

    const typeLabelMap = {
        game: 'Games',
        movie: 'Movies',
        tv: 'TV Shows',
        anime: 'Anime',
        manga: 'Manga'
    }

    const iconMap = {
        trending: <Flame className="text-[#c8ff57]" />,
        top_rated: <Trophy className="text-[#5c9fff]" />,
        coming_soon: <Calendar className="text-[#ff9f5c]" />
    }

    const pageTitle = `${titleMap[rankType]} ${typeLabelMap[contentType]}`

    return (
        <div className="min-h-screen bg-[#0a0a0f] pt-10 pb-20 px-5 md:px-10">
            <Helmet>
                <title>QuestDuck | {pageTitle}</title>
            </Helmet>

            <div className="max-w-[1200px] mx-auto">
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-[#7a7a90] hover:text-white transition-colors mb-8 font-mono text-xs uppercase tracking-widest"
                >
                    <ChevronLeft size={16} /> Back
                </button>

                <div className="flex items-center gap-4 mb-12">
                    <div className="p-3 bg-[#111118] border border-[#2a2a35] rounded-xl shadow-lg">
                        {iconMap[rankType]}
                    </div>
                    <div>
                        <h1 className="text-white font-black text-4xl uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            {pageTitle}
                        </h1>
                        <p className="text-[#7a7a90] font-mono text-[10px] uppercase tracking-[0.2em] mt-1">
                            Top 100 List • Updated Daily
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {Array.from({ length: 24 }).map((_, i) => <GameCardSkeleton key={i} />)}
                    </div>
                ) : rankings.length > 0 ? (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {rankings.slice(0, visibleCount).map((item, index) => (
                                <RankingCard 
                                    key={`${item.contentId}-${index}`} 
                                    item={item} 
                                    contentType={contentType}
                                    index={index}
                                    rankType={rankType}
                                    myRating={getMyRating(item.contentId)}
                                />
                            ))}
                        </div>
                        
                        {/* Sentinel for Infinite Scroll */}
                        {visibleCount < rankings.length && (
                            <div ref={observerTarget} className="h-32 flex items-center justify-center">
                                <div className="w-8 h-8 border-2 border-[#c8ff57]/20 border-t-[#c8ff57] rounded-full animate-spin" />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-20 bg-[#111118] border border-[#2a2a35] rounded-2xl">
                        <div className="text-[#3a3a4a] text-6xl mb-4">📭</div>
                        <h3 className="text-white font-black text-xl uppercase mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>No data found</h3>
                        <p className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest">Our duck is still gathering this information.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
