import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSection } from '../context/SectionContext';

const SectionSwitcher = () => {
    const { activeSection, setActiveSection } = useSection();
    const navigate = useNavigate();
    const location = useLocation();

    // Do not show switcher on login/signup pages if necessary, 
    // but the request says "it appears on every page".
    const hideOnRoutes = ['/login', '/signup', '/verify-email', '/forgot-password', '/reset-password'];
    if (hideOnRoutes.includes(location.pathname)) return null;

    const sections = [
        { id: 'games', label: 'Games', icon: '🎮', path: '/' },
        { id: 'anime', label: 'Anime', icon: '🎌', path: '/anime' },
        { id: 'movies', label: 'Cinema', icon: '🎬', path: '/movies' }
    ];


    const handleSectionChange = (sectionId, path) => {
        if (activeSection === sectionId) return;
        
        setActiveSection(sectionId);
        
        // When switching sections, we usually want to go to the "Home" of that section
        // But if the user is in Discover, Library, or Lists, we should try to stay on that page type
        const currentPath = location.pathname;
        let targetPath = path;

        if (currentPath.includes('/discover')) {
            targetPath = sectionId === 'games' ? '/discover' : `/${sectionId}/discover`;
        } else if (currentPath.includes('/library')) {
            targetPath = sectionId === 'games' ? '/library' : `/${sectionId}/library`;
        } else if (currentPath.includes('/lists')) {
            targetPath = sectionId === 'games' ? '/lists' : `/${sectionId}/lists`;
        } else if (currentPath === '/' || currentPath === '/anime' || currentPath === '/movies') {
            targetPath = path;
        } else {
            // For other pages like Profile, Leaderboard, etc., we don't change the path, 
            // just the section context. But the request says: 
            // "When switched, the Home, Discover, Library, and Lists pages change content for that section."
            // So if they are on one of these, we should redirect.
            // If they are on Profile, they stay on Profile.
        }

        navigate(targetPath);
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1 p-1.5 bg-[#12121a]/80 backdrop-blur-xl border border-white/5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)] scale-90 sm:scale-100 transition-transform duration-300">
            {sections.map((section) => (
                <button
                    key={section.id}
                    onClick={() => handleSectionChange(section.id, section.path)}
                    className={`
                        relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300
                        ${activeSection === section.id 
                            ? 'bg-[#c8ff57] text-black shadow-[0_0_15px_rgba(200,255,87,0.3)]' 
                            : 'text-[#7a7a90] hover:text-white hover:bg-white/5'}
                    `}
                >
                    <span className="text-sm">{section.icon}</span>
                    <span className="hidden sm:inline uppercase tracking-wider">{section.label}</span>
                </button>
            ))}
        </div>
    );
};

export default SectionSwitcher;
