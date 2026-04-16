import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'


function VerifyEmail() {
    const { verifyEmail, resendVerification } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const queryParams = new URLSearchParams(location.search)
    const emailFromQuery = queryParams.get('email') || ''

    const [email, setEmail] = useState(emailFromQuery)
    const [code, setCode] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [resending, setResending] = useState(false)
    const [timer, setTimer] = useState(0)

    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => setTimer(t => t - 1), 1000)
            return () => clearInterval(interval)
        }
    }, [timer])

    const handleSubmit = async () => {
        if (!email || !code) {
            setError('Please enter both email and verification code')
            return
        }
        setError('')
        setMessage('')
        setLoading(true)
        const result = await verifyEmail(email, code)
        setLoading(false)
        if (result.success) {
            navigate('/library')
        } else {
            setError(result.message)
        }
    }

    const handleResend = async () => {
        if (!email) {
            setError('Please enter your email to resend code')
            return
        }
        setResending(true)
        const result = await resendVerification(email)
        setResending(false)
        if (result.success) {
            setMessage('A new code has been sent to your email.')
            setTimer(60)
        } else {
            setError(result.message)
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
                    <Link to="/" className="group block mb-2">
                        <div className="font-black text-5xl tracking-[0.1em] text-[#c8ff57]"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            VERIFY<span className="text-white"> EMAIL</span>
                        </div>
                    </Link>
                    <p className="text-[#7a7a90] font-mono text-xs">Enter the 6-digit code sent to your email</p>
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

                    <div className="mb-4">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            readOnly
                            className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded
                                       px-3 py-2 text-sm text-[#7a7a90] cursor-not-allowed
                                       focus:outline-none transition-colors"
                        />
                        <div className="flex justify-start mt-2">
                            <button 
                                onClick={() => navigate('/signup', { state: { email, username: queryParams.get('username') } })}
                                className="font-mono text-[10px] uppercase tracking-wider text-[#c8ff57] hover:underline"
                            >
                                Change Email?
                            </button>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2">Verification Code</label>
                        <input
                            type="text"
                            maxLength="6"
                            placeholder="123456"
                            value={code}
                            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                       px-3 py-2 text-center text-xl font-bold tracking-[0.5em] text-[#c8ff57]
                                       focus:outline-none focus:border-[#c8ff57]
                                       placeholder:text-[#3a3a50] transition-colors font-mono"
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={loading || !code || code.length < 6}
                        className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm
                                   rounded hover:bg-[#d4ff6e] transition-all
                                   disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                    >
                        {loading ? 'Verifying...' : 'Verify Account'}
                    </button>

                    <div className="text-center">
                        <button
                            onClick={handleResend}
                            disabled={resending || timer > 0}
                            className="font-mono text-[10px] uppercase tracking-wider text-[#7a7a90]
                                       hover:text-white transition-colors disabled:opacity-50"
                        >
                            {timer > 0 ? `Resend code in ${timer}s` : 'Resend Verification Code'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VerifyEmail
