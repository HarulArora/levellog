function PrivacyPolicy() {
    return (
        <div className="max-w-[800px] mx-auto px-5 md:px-10 py-12 md:py-20 text-white">
            <h1 className="text-4xl font-black uppercase mb-8 tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                 Inner Workings <span className="text-[#c8ff57]">(Privacy)</span>
            </h1>
            <div className="space-y-10 opacity-90 leading-relaxed">
                <p className="text-lg">We value your privacy almost as much as we value a 100% completion achievement. Here's exactly what happens to your data while you're floating in our pond.</p>
                
                <section>
                    <h2 className="text-2xl font-black text-[#c8ff57] mb-3 uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        1. What We Snatch (Data Collection)
                    </h2>
                    <p className="text-[#a0a0b8]">We grab your <span className="text-white font-bold">Email</span> (so we know who to mail digital letters to) and your <span className="text-white font-bold">Username</span> (so your friends know who's dominating the leaderboard). We also track your gaming data—because that's the whole point of this site!</p>
                </section>

                <section>
                    <h2 className="text-2xl font-black text-[#c8ff57] mb-3 uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        2. The "No Shark" Rule
                    </h2>
                    <p className="text-[#a0a0b8]">We don't sell your data to third-party sharks. We are ducks. Shady advertisers are not allowed in these waters. Your data stays here, safe and sound, like a hidden collectible.</p>
                </section>

                <section>
                    <h2 className="text-2xl font-black text-[#c8ff57] mb-3 uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        3. Cookies (The Non-Delicious Kind)
                    </h2>
                    <p className="text-[#a0a0b8]">We use "Cookies" to keep you logged in. Sadly, they aren't the chocolate chip kind you can dip in milk. They are just tiny bits of code that help the pond remember who you are so you don't have to log in every 5 seconds.</p>
                </section>

                <section>
                    <h2 className="text-2xl font-black text-[#c8ff57] mb-3 uppercase tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        4. Your Secret Identity
                    </h2>
                    <p className="text-[#a0a0b8]">If you want us to delete your data and "wipe your save file," you can do so at any time. We'll be sad to see you waddle away, but we'll respect your space and delete everything associated with your account.</p>
                </section>

                <div className="mt-16 pt-10 border-t border-white/10 text-[#505060] text-[10px] font-mono font-bold uppercase tracking-widest">
                    Last Updated: April 21, 2026 · Built with ❤️ (and zero sharks).
                </div>
            </div>
        </div>
    )
}

export default PrivacyPolicy
