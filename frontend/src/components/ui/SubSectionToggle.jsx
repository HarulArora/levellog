import { useNavigate } from 'react-router-dom';
import { useSection } from '../../context/SectionState';
import { motion } from 'framer-motion';

const SubSectionToggle = ({ current, options, type }) => {
    const navigate = useNavigate();
    const { setAnimeSubSection, setCinemaSubSection } = useSection();

    const BRAND_GREEN = '#c8ff57';

    return (
        <div className="flex bg-black/40 backdrop-blur-xl p-1 rounded-full border border-white/5 w-fit mb-10 shadow-2xl relative overflow-hidden ring-1 ring-inset ring-white/5">
            {options.map(opt => {
                const isActive = current === opt.value;
                const Icon = opt.icon;

                return (
                    <button
                        key={opt.value}
                        onClick={() => {
                            if (current !== opt.value) {
                                if (type === 'anime') setAnimeSubSection(opt.value);
                                if (type === 'cinema') setCinemaSubSection(opt.value);
                                navigate(opt.path);
                            }
                        }}
                        className={`
                            relative flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-colors duration-300 z-10
                            ${isActive ? 'text-black' : 'text-white/40 hover:text-white/80'}
                        `}
                        style={{ fontFamily: 'DM Mono, monospace' }}
                    >
                        {/* Sliding Background */}
                        {isActive && (
                            <motion.div
                                layoutId="activeSubTab"
                                className="absolute inset-0 rounded-full shadow-lg"
                                style={{ 
                                    backgroundColor: BRAND_GREEN,
                                    boxShadow: `0 0 20px ${BRAND_GREEN}40`
                                }}
                                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                            />
                        )}

                        {Icon && (
                            <span className="relative z-10">
                                <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                            </span>
                        )}
                        <span className="relative z-10">{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default SubSectionToggle;

