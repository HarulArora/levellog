import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-5 text-center bg-[#0a0a0f]">
            <Helmet>
                <title>404 - Quest Not Found | QuestDuck</title>
            </Helmet>
            
            <div className="relative mb-8">
                <div className="text-[12rem] font-black leading-none opacity-5 select-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    404
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-8xl">🦆</span>
                </div>
            </div>

            <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-4" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                Quest Not Found
            </h1>
            
            <p className="text-[#7a7a90] max-w-md mb-10 font-mono text-sm leading-relaxed">
                The page you're looking for has wandered into another pond or doesn't exist anymore.
            </p>

            <button 
                onClick={() => navigate('/')}
                className="btn-apple btn-apple-primary px-8 py-4 flex items-center gap-3 group"
            >
                <Home size={18} className="group-hover:-translate-y-0.5 transition-transform" />
                <span>Back to Home Base</span>
            </button>
        </div>
    );
};

export default NotFound;
