import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

function TermsOfService() {
    const navigate = useNavigate()
    return (
        <div className="max-w-[800px] mx-auto px-5 md:px-10 py-12 md:py-20 text-white">
            <button 
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-[#a0a0b8] hover:text-[#c8ff57] mb-8 transition-colors group"
            >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                <span className="font-bold uppercase tracking-widest text-xs">Return to Pond</span>
            </button>
            <h1 className="text-4xl font-black uppercase mb-8 tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                The <span className="text-[#c8ff57]">Pond</span> Rules
            </h1>
            <div className="space-y-10 opacity-90 leading-relaxed">
                <p className="text-lg">Welcome to the Pond! By dipping your toes into <span className="text-[#c8ff57] font-bold">QuestDuck</span>, you're agreeing to follow these rules. If you don't agree, you'll have to waddle away.</p>
                
                <section>
                    <h2 className="text-2xl font-black text-[#c8ff57] mb-3 uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        1. No Quacking at Others
                    </h2>
                    <p className="text-[#a0a0b8]">This is a peaceful pond. Be nice to your fellow ducklings. No bullying, no hate speech, and no being a mean goose. We're all here to track our media journeys, not to launch a civil war.</p>
                </section>

                <section>
                    <h2 className="text-2xl font-black text-[#c8ff57] mb-3 uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        2. The "Taste" Peace Treaty
                    </h2>
                    <p className="text-[#a0a0b8]">Do <span className="font-bold text-white">NOT</span> fight over taste. If someone thinks their 3/10 indie game or obscure anime is a masterpiece, just smile and float on. Their trash is their treasure. Respect the log, even if it's weird.</p>
                </section>

                <section>
                    <h2 className="text-2xl font-black text-[#c8ff57] mb-3 uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        3. Must Be 13 (To Handle the Heat)
                    </h2>
                    <p className="text-[#a0a0b8]">You must be at least 13 years old to join the flock. If you're younger, please ask your parental units to build a baby pond for you elsewhere. We need you old enough to handle the 100% completion grind and the season-long binges.</p>
                </section>

                <section>
                    <h2 className="text-2xl font-black text-[#c8ff57] mb-3 uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        4. Don't Break the Pond
                    </h2>
                    <p className="text-[#a0a0b8]">No hacking, no botting, and no weird illegal stuff. If you use this site for anything other than logging your epic media quests, we'll have to send the digital wardens.</p>
                </section>

                <section>
                    <h2 className="text-2xl font-black text-[#c8ff57] mb-3 uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        5. The "I'm Not a Lawyer" Clause
                    </h2>
                    <p className="text-[#a0a0b8]">QuestDuck is provided "as is". If you lose your 500-hour media history because you were too busy logging it here instead of consuming it, that's on you! (But we'll still feel bad for you.)</p>
                </section>

                <div className="mt-16 pt-10 border-t border-white/10 text-[#505060] text-[10px] font-mono font-bold uppercase tracking-widest">
                    Last Updated: April 21, 2026 · Stay Golden, Ducklings.
                </div>
            </div>
        </div>
    )
}

export default TermsOfService
