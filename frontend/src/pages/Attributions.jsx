import React from 'react'
import { Helmet } from 'react-helmet-async'
import { ShieldCheck, Database, Layout, ShieldAlert, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const Attributions = () => {
    const navigate = useNavigate()
    return (
        <div className="max-w-[800px] mx-auto px-6 py-28 min-h-screen relative overflow-hidden">
            <Helmet>
                <title>Attributions | QuestDuck</title>
            </Helmet>

            {/* Background Glow */}
            <div className="absolute top-1/4 -right-20 w-96 h-96 bg-[#c8ff57]/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-[#ff5c5c]/5 blur-[120px] pointer-events-none" />

            <div className="relative z-10">
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-[#a0a0b8] hover:text-[#c8ff57] mb-8 transition-colors group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-bold uppercase tracking-widest text-xs">Return to Pond</span>
                </button>
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-[#c8ff57]/10 border border-[#c8ff57]/20 rounded-2xl flex items-center justify-center text-[#c8ff57]">
                        <Database size={24} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-white uppercase tracking-tight" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Attributions</h1>
                        <p className="text-[#7a7a90] font-mono text-xs uppercase tracking-widest">Data sources & API credits</p>
                    </div>
                </div>

                <div className="prose prose-invert max-w-none">
                    <p className="text-[#a0a0b8] leading-relaxed mb-12">
                        QuestDuck is a community-driven platform that relies on various high-quality data sources to provide the most accurate and up-to-date information across gaming, anime, manga, and cinema. We are grateful to the following providers for their excellent APIs.
                    </p>

                    <div className="space-y-6">
                        {/* IGDB */}
                        <div className="bg-[#111118] border border-[#2a2a35] rounded-3xl p-8 hover:border-[#c8ff57]/30 transition-all group">
                            <div className="flex items-start justify-between gap-6">
                                <div className="flex-1">
                                    <h3 className="text-xl font-black text-white uppercase mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>IGDB (by Twitch)</h3>
                                    <p className="text-[#7a7a90] text-sm leading-relaxed mb-4">
                                        All video game metadata, including titles, cover art, release dates, and genres, is provided by IGDB. IGDB is a comprehensive gaming database that powers some of the biggest applications in the industry.
                                    </p>
                                    <a href="https://www.igdb.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[#c8ff57] font-mono text-[10px] uppercase tracking-widest hover:underline">
                                        Visit IGDB Website →
                                    </a>
                                </div>
                                <div className="w-16 h-16 bg-[#0d0d14] rounded-2xl flex items-center justify-center text-3xl shadow-xl group-hover:scale-110 transition-transform">🎮</div>
                            </div>
                        </div>

                        {/* AniList */}
                        <div className="bg-[#111118] border border-[#2a2a35] rounded-3xl p-8 hover:border-[#3db4f2]/30 transition-all group">
                            <div className="flex items-start justify-between gap-6">
                                <div className="flex-1">
                                    <h3 className="text-xl font-black text-white uppercase mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>AniList</h3>
                                    <p className="text-[#7a7a90] text-sm leading-relaxed mb-4">
                                        Our anime and manga section is powered by the AniList API. AniList provides a modern, fast, and feature-rich interface for tracking anime and manga, and their open API is a cornerstone of our media discovery.
                                    </p>
                                    <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[#3db4f2] font-mono text-[10px] uppercase tracking-widest hover:underline">
                                        Visit AniList Website →
                                    </a>
                                </div>
                                <div className="w-16 h-16 bg-[#0d0d14] rounded-2xl flex items-center justify-center text-3xl shadow-xl group-hover:scale-110 transition-transform">🎎</div>
                            </div>
                        </div>

                        {/* TMDB */}
                        <div className="bg-[#111118] border border-[#2a2a35] rounded-3xl p-8 hover:border-[#01d277]/30 transition-all group">
                            <div className="flex items-start justify-between gap-6">
                                <div className="flex-1">
                                    <h3 className="text-xl font-black text-white uppercase mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>The Movie Database (TMDB)</h3>
                                    <p className="text-[#7a7a90] text-sm leading-relaxed mb-4">
                                        Cinema and TV show data is sourced from TMDB. While this product uses the TMDB API, it is not endorsed or certified by TMDB. Their extensive database allows us to offer high-fidelity movie and show tracking.
                                    </p>
                                    <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[#01d277] font-mono text-[10px] uppercase tracking-widest hover:underline">
                                        Visit TMDB Website →
                                    </a>
                                </div>
                                <div className="w-16 h-16 bg-[#0d0d14] rounded-2xl flex items-center justify-center text-3xl shadow-xl group-hover:scale-110 transition-transform">🎬</div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 p-6 bg-[#ff5c5c]/5 border border-[#ff5c5c]/10 rounded-2xl flex items-start gap-4">
                        <ShieldAlert size={20} className="text-[#ff5c5c] flex-shrink-0 mt-1" />
                        <p className="text-[#ff5c5c]/70 text-xs leading-relaxed font-mono uppercase tracking-wide">
                            All trademarks, logos, and brand names are the property of their respective owners. QuestDuck is not affiliated with, sponsored by, or endorsed by IGDB, AniList, or TMDB.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Attributions
