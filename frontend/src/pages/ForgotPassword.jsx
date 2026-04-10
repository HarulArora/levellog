import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ForgotPassword() {
    const { forgotPassword } = useAuth()
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async () => {
        if (!email) {
            setError('Please enter your email')
            return
        }
        setError('')
        setMessage('')
        setLoading(true)
        const result = await forgotPassword(email)
        setLoading(false)
        if (result.success) {
            setMessage('If an account exists, a reset code has been sent.')
            // Redirect after delay
            setTimeout(() => {
                navigate(`/reset-password?email=${encodeURIComponent(email)}`)
            }, 2000)
        } else {
            if (result.requiresVerification) {
                setError(result.message)
                setTimeout(() => {
                    navigate(`/verify-email?email=${encodeURIComponent(result.email || email)}`)
                }, 2000)
            } else {
                setError(result.message)
            }
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <button onClick={() => navigate('/login')}
                    className="flex items-center gap-2 font-mono text-xs text-[#7a7a90]
                               hover:text-[#c8ff57] transition-colors mb-6">
                    ← BACK TO LOGIN
                </button>
                <div className="text-center mb-8">
                    <div className="font-black text-4xl tracking-widest text-[#c8ff57] mb-2"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        FORGOT<span className="text-white"> PASSWORD</span>
                    </div>
                    <p className="text-[#7a7a90] font-mono text-xs">Enter your email to receive a reset code</p>
                </div>
                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6 shadow-2xl">
                    {error && (
                        <div className="bg-[#ff5c5c]/10 border border-[#ff5c5c]/30
                                        text-[#ff5c5c] font-mono text-xs p-3 rounded mb-4">
                            ✕ {error}
                        </div>
                    )}
                    {message && (
                        <div className="bg-[#c8ff57]/10 border border-[#c8ff57]/30
                                        text-[#c8ff57] font-mono text-xs p-3 rounded mb-4">
                            ✓ {message}
                        </div>
                    )}

                    <div className="mb-6">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                            placeholder="you@email.com"
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                       px-3 py-2 text-sm text-white
                                       focus:outline-none focus:border-[#c8ff57]
                                       placeholder:text-[#7a7a90] transition-colors"
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={loading || !email}
                        className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm
                                   rounded hover:bg-[#d4ff6e] transition-all
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Sending...' : 'Send Reset Code'}
                    </button>
                    
                    <p className="text-center text-[#7a7a90] font-mono text-[10px] mt-4 uppercase tracking-tighter">
                        We'll send you a 6-digit code to verify your identity
                    </p>
                </div>
            </div>
        </div>
    )
}

export default ForgotPassword
