import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ForgotPassword() {
    const { forgotPassword } = useAuth()
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async () => {
        if (!email.trim()) { setError('Please enter your email'); return }
        setLoading(true)
        const result = await forgotPassword(email.trim())
        setLoading(false)
        if (result.success) {
            setSent(true)
        } else {
            setError(result.message)
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">

                <div className="text-center mb-8">
                    <div className="font-black text-4xl tracking-widest text-[#c8ff57] mb-2"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        LEVEL<span className="text-white">LOG</span>
                    </div>
                </div>

                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">

                    {sent ? (
                        <div className="text-center py-4">
                            <div className="text-4xl mb-4">📬</div>
                            <h2 className="font-black text-xl tracking-widest uppercase mb-3"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Email Sent
                            </h2>
                            <p className="text-[#7a7a90] font-mono text-xs leading-relaxed mb-6">
                                If an account exists for <span className="text-[#c8ff57]">{email}</span>,
                                you'll receive a password reset link shortly.
                                <br /><br />
                                The link expires in <strong className="text-white">1 hour</strong>.
                            </p>
                            <Link to="/login"
                                className="block w-full py-3 bg-[#c8ff57] text-black font-bold
                                           text-sm rounded hover:bg-[#d4ff6e] transition-all text-center">
                                Back to Login
                            </Link>
                            <p className="text-[#3a3a50] font-mono text-[10px] mt-3">
                                Didn't get it? Check your spam folder.
                            </p>
                        </div>
                    ) : (
                        <>
                            <button onClick={() => window.history.back()}
                                className="font-mono text-xs text-[#7a7a90] hover:text-[#c8ff57]
                                           transition-colors mb-5 flex items-center gap-2">
                                ← BACK
                            </button>

                            <h2 className="font-black text-xl tracking-widest uppercase mb-2"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Forgot Password
                            </h2>
                            <p className="text-[#7a7a90] font-mono text-xs mb-6">
                                Enter your email and we'll send a reset link.
                            </p>

                            {error && (
                                <div className="bg-[#ff5c5c]/10 border border-[#ff5c5c]/30
                                                text-[#ff5c5c] font-mono text-xs p-3 rounded mb-4">
                                    {error}
                                </div>
                            )}

                            <div className="mb-6">
                                <label className="block font-mono text-xs uppercase tracking-wider
                                                  text-[#7a7a90] mb-2">Email</label>
                                <input
                                    type="email"
                                    placeholder="you@email.com"
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setError('') }}
                                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                    className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                               px-3 py-2 text-sm text-white
                                               focus:outline-none focus:border-[#c8ff57]
                                               placeholder:text-[#7a7a90] transition-colors"
                                />
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm
                                           rounded hover:bg-[#d4ff6e] transition-all
                                           disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>

                            <p className="text-center text-[#7a7a90] font-mono text-xs mt-4">
                                Remember your password?{' '}
                                <Link to="/login" className="text-[#c8ff57] hover:underline">Login</Link>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ForgotPassword
