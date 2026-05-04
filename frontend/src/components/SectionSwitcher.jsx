import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSection } from '../context/SectionState';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Tv, Popcorn } from 'lucide-react';

const SectionSwitcher = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { activeSection, setActiveSection, animeSubSection, setAnimeSubSection, cinemaSubSection, setCinemaSubSection } = useSection();
    const isManga = animeSubSection === 'manga';
    const isTV = cinemaSubSection === 'tv';

    // Auto-sync section with URL path changes
    React.useEffect(() => {
        const path = location.pathname;
        if (path.startsWith('/manga')) {
            if (activeSection !== 'anime') setActiveSection('anime');
            if (animeSubSection !== 'manga') setAnimeSubSection('manga');
        } else if (path.startsWith('/anime')) {
            if (activeSection !== 'anime') setActiveSection('anime');
            if (animeSubSection !== 'anime') setAnimeSubSection('anime');
        } else if (path.startsWith('/tv')) {
            if (activeSection !== 'movies') setActiveSection('movies');
            if (cinemaSubSection !== 'tv') setCinemaSubSection('tv');
        } else if (path.startsWith('/movies')) {
            if (activeSection !== 'movies') setActiveSection('movies');
            if (cinemaSubSection !== 'movie') setCinemaSubSection('movie');
        } else if (path === '/' || path.startsWith('/library') || path.startsWith('/discover') || path.startsWith('/game')) {
            if (activeSection !== 'games') setActiveSection('games');
        }
    }, [location.pathname, activeSection, setActiveSection, animeSubSection, setAnimeSubSection, cinemaSubSection, setCinemaSubSection]);

    const hideOnRoutes = ['/login', '/signup', '/verify-email', '/forgot-password', '/reset-password'];
    if (hideOnRoutes.includes(location.pathname)) return null;

    const BRAND_GREEN = '#c8ff57';

    const sections = [
        { 
            id: 'games', 
            label: 'GAMES', 
            icon: Gamepad2, 
            path: '/',
            iconAnim: {
                active: { rotate: [0, -5, 5, -5, 5, 0], x: [0, -1, 1, -1, 1, 0] },
                transition: { repeat: Infinity, duration: 0.8, ease: "linear", repeatType: "loop" }
            }
        },
        { 
            id: 'anime', 
            label: 'ANIME',
            subLabel: '& MANGA', 
            icon: Tv, 
            path: isManga ? '/manga' : '/anime',
            iconAnim: {
                active: { rotate: 360 },
                transition: { repeat: Infinity, duration: 4, ease: "linear", repeatType: "loop" }
            }
        },
        { 
            id: 'movies', 
            label: 'MOVIES',
            subLabel: '& TV', 
            icon: Popcorn, 
            path: isTV ? '/tv' : '/movies',
            iconAnim: {
                active: { 
                    y: [0, -6, 0],
                    scaleX: [1, 0.8, 1],
                    scaleY: [1, 1.2, 1]
                },
                transition: { repeat: Infinity, duration: 1.2, ease: "easeInOut", repeatType: "loop" }
            }
        }
    ];

    const handleSectionChange = (sectionId, path) => {
        if (activeSection === sectionId) return;
        setActiveSection(sectionId);
        
        const currentPath = location.pathname;
        let targetPath = path;

        // Ensure sub-section state matches the destination path
        if (sectionId === 'anime') {
            setAnimeSubSection(path.includes('/manga') ? 'manga' : 'anime');
        } else if (sectionId === 'movies') {
            setCinemaSubSection(path.includes('/tv') ? 'tv' : 'movie');
        }

        if (currentPath.includes('/discover')) {
            targetPath = sectionId === 'games' ? '/discover' : (sectionId === 'anime' ? (isManga ? '/manga/discover' : '/anime/discover') : (isTV ? '/tv/discover' : '/movies/discover'));
        } else if (currentPath.includes('/library')) {
            targetPath = sectionId === 'games' ? '/library' : (sectionId === 'anime' ? (isManga ? '/manga/library' : '/anime/library') : (isTV ? '/tv/library' : '/movies/library'));
        } else if (currentPath.includes('/lists')) {
            targetPath = sectionId === 'games' ? '/lists' : (sectionId === 'anime' ? (isManga ? '/manga/lists' : '/anime/lists') : (isTV ? '/tv/lists' : '/movies/lists'));
        }
        navigate(targetPath);
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 w-full max-w-fit pointer-events-none">
            <motion.div 
                layout
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex items-center gap-1 p-1.5 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-1 ring-inset ring-white/5 pointer-events-auto"
            >
                {sections.map((section) => {
                    const isActive = activeSection === section.id;
                    const Icon = section.icon;

                    return (
                        <button
                            key={section.id}
                            onClick={() => handleSectionChange(section.id, section.path)}
                            className={`
                                relative flex items-center justify-center gap-2.5 px-5 py-3 rounded-full transition-all duration-500
                                group outline-none overflow-hidden
                            `}
                        >
                            {/* Sliding Background */}
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 rounded-full"
                                    style={{ 
                                        backgroundColor: BRAND_GREEN,
                                        boxShadow: `0 0 30px ${BRAND_GREEN}50`,
                                        zIndex: 0
                                    }}
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ 
                                        type: "spring", 
                                        stiffness: 300, 
                                        damping: 30, 
                                        mass: 1,
                                        layout: { duration: 0.4, ease: "easeOut" }
                                    }}
                                />
                            )}

                            <motion.span 
                                className={`relative z-10`}
                                animate={isActive ? { ...section.iconAnim.active, scale: 1.1 } : { rotate: 0, scale: 1, x: 0, y: 0 }}
                                transition={isActive ? section.iconAnim.transition : { duration: 0.3 }}
                                style={{ color: isActive ? '#000' : 'rgba(255,255,255,0.4)' }}
                            >
                                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                            </motion.span>
                            
                            <motion.div 
                                layout
                                className="relative z-10 flex flex-col items-start overflow-hidden"
                                initial={false}
                                animate={{ 
                                    width: isActive ? 'auto' : 0,
                                    opacity: isActive ? 1 : 0,
                                    marginLeft: isActive ? 8 : 0,
                                    filter: isActive ? 'blur(0px)' : 'blur(4px)'
                                }}
                                transition={{ 
                                    type: "spring", 
                                    stiffness: 350, 
                                    damping: 35,
                                    mass: 1
                                }}
                            >
                                <span className={`
                                    text-[10px] font-black tracking-[0.1em] whitespace-nowrap leading-none
                                    ${isActive ? 'text-black' : 'text-white/40'}
                                `}>
                                    {section.label}
                                </span>
                                {section.subLabel && (
                                    <span className={`
                                        text-[7px] font-bold tracking-[0.05em] whitespace-nowrap mt-0.5 leading-none
                                        ${isActive ? 'text-black/60' : 'text-white/20'}
                                    `}>
                                        {section.subLabel}
                                    </span>
                                )}
                            </motion.div>

                            {/* Desktop Hover Effect */}
                            {!isActive && (
                                <div className="absolute inset-0 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                        </button>
                    );
                })}
            </motion.div>
        </div>
    );
};

export default SectionSwitcher;


