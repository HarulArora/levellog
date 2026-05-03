import { useNavigate } from 'react-router-dom';
import { useSection } from '../../context/SectionState';

const SubSectionToggle = ({ current, options, type }) => {
    const navigate = useNavigate();
    const { setAnimeSubSection, setCinemaSubSection } = useSection();

    return (
        <div className="flex bg-[#111118]/80 backdrop-blur-md p-1 rounded-xl border border-[#2a2a35] w-fit mb-8 shadow-lg">
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => {
                        if (current !== opt.value) {
                            if (type === 'anime') setAnimeSubSection(opt.value);
                            if (type === 'cinema') setCinemaSubSection(opt.value);
                            navigate(opt.path);
                        }
                    }}
                    className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                        current === opt.value 
                        ? 'bg-[#c8ff57] text-black shadow-[0_0_20px_rgba(200,255,87,0.25)]' 
                        : 'text-[#7a7a90] hover:text-white hover:bg-white/5'
                    }`}
                    style={{ fontFamily: 'DM Mono, monospace' }}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
};

export default SubSectionToggle;

