import { useState, useMemo, memo, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ChevronLeft, Flame, Trophy, Calendar, Star } from 'lucide-react'
import useCachedFetch from '../hooks/useCachedFetch'
import { GameCardSkeleton } from '../components/ui/Skeleton'
import { getIGDBImage, SIZES } from '../utils/igdb'

const RankingCard = memo(({ item, contentType, index, rankType }) => {
    const navigate = useNavigate()
    
    const handleClick = () => {
        const pathMap = {
            game: `/game/${item.contentId}`,
            anime: `/anime/${item.contentId}`,
            manga: `/manga/${item.contentId}`,
            movie: `/movies/${item.contentId}`,
            tv: `/tv/${item.contentId}`
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

                {/* Rating Badge */}
                {item.avgRating > 0 && (
                    <div className="absolute top-2 right-2 bg-[#5c9fff] rounded px-2 py-1 flex items-center gap-1 shadow-xl z-10">
                        <span className="font-black text-xs text-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            {(() => {
                                const raw = item.avgRating;
                                const val = raw > 10 ? raw / 10 : raw;
                                return Number(val.toFixed(1)); 
                            })()}
                        </span>
                    </div>
                )}
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
        <div className="min-h-screen bg-[#0a0a0f] pt-24 pb-20 px-5 md:px-10">
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
