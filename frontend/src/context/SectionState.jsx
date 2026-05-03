import { createContext, useContext } from 'react';

export const SectionContext = createContext();

export const useSection = () => {
    const context = useContext(SectionContext);
    if (!context) {
        throw new Error('useSection must be used within a SectionProvider');
    }
    return context;
};
