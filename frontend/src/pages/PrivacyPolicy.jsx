function PrivacyPolicy() {
    return (
        <div className="max-w-[800px] mx-auto px-5 md:px-10 py-12 md:py-20 text-white">
            <h1 className="text-4xl font-bold uppercase mb-8">Privacy Policy</h1>
            <div className="space-y-6 opacity-80">
                <p>Welcome to QuestDuck.</p>
                <p>We take your privacy seriously. This policy explains how we collect, use, and protect your information when you use our platform.</p>
                <h2 className="text-2xl font-bold mt-10">Data We Collect</h2>
                <ul className="list-disc pl-5 space-y-2">
                    <li>Account Information: Email, username.</li>
                    <li>Gaming Data: Game titles, ratings, status updates.</li>
                </ul>
                <p className="mt-10 pt-10 border-t border-white/10 text-xs">Last Updated: April 20, 2026</p>
            </div>
        </div>
    )
}

export default PrivacyPolicy
