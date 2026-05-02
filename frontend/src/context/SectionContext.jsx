import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const SectionContext = createContext();

export const useSection = () => {
    const context = useContext(SectionContext);
    if (!context) {
        throw new Error('useSection must be used within a SectionProvider');
    }
    return context;
};

export const SectionProvider = ({ children }) => {
    const { user, updateSettings } = useAuth();

    const [activeSection, setActiveSectionState] = useState(() => {
        const path = window.location.pathname;
        if (path.startsWith('/manga') || path.startsWith('/anime')) return 'anime';
        if (path.startsWith('/tv') || path.startsWith('/movies')) return 'movies';
        return localStorage.getItem('levellog_section') || 'games';
    });

    const [animeSubSection, setAnimeSubSectionState] = useState(() => {
        const path = window.location.pathname;
        if (path.startsWith('/manga')) return 'manga';
        if (path.startsWith('/anime')) return 'anime';
        return localStorage.getItem('levellog_anime_sub') || 'anime';
    });

    const [cinemaSubSection, setCinemaSubSectionState] = useState(() => {
        const path = window.location.pathname;
        if (path.startsWith('/tv')) return 'tv';
        if (path.startsWith('/movies')) return 'movie';
        return localStorage.getItem('levellog_cinema_sub') || 'movie';
    });


    const setActiveSection = (section) => {
        setActiveSectionState(section);
        localStorage.setItem('levellog_section', section);
    };

    const setAnimeSubSection = (sub) => {
        setAnimeSubSectionState(sub);
        localStorage.setItem('levellog_anime_sub', sub);
    };

    const setCinemaSubSection = (sub) => {
        setCinemaSubSectionState(sub);
        localStorage.setItem('levellog_cinema_sub', sub);
    };


    // Auto-sync section with URL path changes
    useEffect(() => {
        const handleLocationChange = () => {
            const path = window.location.pathname;
            if (path.startsWith('/manga')) {
                setActiveSectionState('anime');
                setAnimeSubSectionState('manga');
            } else if (path.startsWith('/anime')) {
                setActiveSectionState('anime');
                setAnimeSubSectionState('anime');
            } else if (path.startsWith('/tv')) {
                setActiveSectionState('movies');
                setCinemaSubSectionState('tv');
            } else if (path.startsWith('/movies')) {
                setActiveSectionState('movies');
                setCinemaSubSectionState('movie');
            } else if (path === '/' || path.startsWith('/library') || path.startsWith('/discover') || path.startsWith('/game')) {
                setActiveSectionState('games');
            }
        };

        window.addEventListener('popstate', handleLocationChange);
        handleLocationChange();
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    const value = {
        activeSection,
        setActiveSection,
        animeSubSection,
        setAnimeSubSection,
        cinemaSubSection,
        setCinemaSubSection
    };

    return (
        <SectionContext.Provider value={value}>
            {children}
        </SectionContext.Provider>
    );
};

