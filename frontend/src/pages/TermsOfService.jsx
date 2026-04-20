function TermsOfService() {
    return (
        <div className="max-w-[800px] mx-auto px-5 md:px-10 py-12 md:py-20 text-white">
            <h1 className="text-4xl font-bold uppercase mb-8">Terms of Service</h1>
            <div className="space-y-6 opacity-80">
                <p>By using QuestDuck, you agree to these terms.</p>
                <h2 className="text-2xl font-bold mt-10">Usage Policy</h2>
                <ul className="list-disc pl-5 space-y-2">
                    <li>You must be at least 13 years old.</li>
                    <li>No harassment or illegal activity.</li>
                </ul>
                <p className="mt-10 pt-10 border-t border-white/10 text-xs">Last Updated: April 20, 2026</p>
            </div>
        </div>
    )
}

export default TermsOfService
