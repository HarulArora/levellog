import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ResetPassword() {
    const { resetPassword } = useAuth()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')

    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState('')

    // If no token in URL, show an error immediately
    useEffect(() => {
        if (!token) setError('Invalid or missing reset token.')
    }, [token])

    const handleSubmit = async () => {
        if (!password || !confirm) { setError('Please fill in both fields'); return }
        if (password.length < 6) { setError('Password must be at least 6 characters'); return }
        if (password !== confirm) { setError('Passwords do not match'); return }

        setLoading(true)
        const result = await resetPassword(token, password)
        setLoading(false)

        if (result.success) {
            setDone(true)
            setTimeout(() => navigate('/login'), 2500)
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

                    {done ? (
                        <div className="text-center py-4">
                            <div className="text-4xl mb-4">✅</div>
                            <h2 className="font-black text-xl tracking-widest uppercase mb-3"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Password Reset!
                            </h2>
                            <p className="text-[#7a7a90] font-mono text-xs mb-4">
                                Your password has been updated. Redirecting to login...
                            </p>
                            <Link to="/login"
                                className="block w-full py-3 bg-[#c8ff57] text-black font-bold
                                           text-sm rounded hover:bg-[#d4ff6e] transition-all text-center">
                                Go to Login
                            </Link>
                        </div>
                    ) : (
                        <>
                            <h2 className="font-black text-xl tracking-widest uppercase mb-2"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Reset Password
                            </h2>
                            <p className="text-[#7a7a90] font-mono text-xs mb-6">
                                Choose a new password for your account.
                            </p>

                            {error && (
                                <div className="bg-[#ff5c5c]/10 border border-[#ff5c5c]/30
                                                text-[#ff5c5c] font-mono text-xs p-3 rounded mb-4">
                                    {error}
                                    {(!token || error.includes('invalid') || error.includes('expired')) && (
                                        <div className="mt-2">
                                            <Link to="/forgot-password" className="text-[#c8ff57] underline">
                                                Request a new link
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mb-4">
                                <label className="block font-mono text-xs uppercase tracking-wider
                                                  text-[#7a7a90] mb-2">New Password</label>
                                <input
                                    type="password"
                                    placeholder="Min 6 characters"
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setError('') }}
                                    className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                               px-3 py-2 text-sm text-white
                                               focus:outline-none focus:border-[#c8ff57]
                                               placeholder:text-[#7a7a90] transition-colors"
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block font-mono text-xs uppercase tracking-wider
                                                  text-[#7a7a90] mb-2">Confirm Password</label>
                                <input
                                    type="password"
                                    placeholder="Repeat new password"
                                    value={confirm}
                                    onChange={e => { setConfirm(e.target.value); setError('') }}
                                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                    className={`w-full bg-[#18181f] border rounded
                                                px-3 py-2 text-sm text-white
                                                focus:outline-none transition-colors
                                                placeholder:text-[#7a7a90]
                                                ${confirm && confirm !== password
                                            ? 'border-[#ff5c5c]'
                                            : confirm && confirm === password
                                                ? 'border-[#c8ff57]/60'
                                                : 'border-[#2a2a35] focus:border-[#c8ff57]'
                                        }`}
                                />
                                {confirm && confirm === password && (
                                    <p className="font-mono text-[10px] text-[#c8ff57] mt-1">✓ Passwords match</p>
                                )}
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={loading || !token}
                                className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm
                                           rounded hover:bg-[#d4ff6e] transition-all
                                           disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ResetPassword
