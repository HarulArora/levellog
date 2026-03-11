import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGoogleLogin } from '@react-oauth/google'
import api from '../api/axios'

function useDebounce(value, delay) {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return debounced
}

function Signup() {
    const { signup, loginWithGoogle } = useAuth()
    const navigate = useNavigate()

    const [formData, setFormData] = useState({ username: '', email: '', password: '' })
    const [error, setError] = useState('')
    const [fieldError, setFieldError] = useState({})
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)

    // ── Username availability check ───────────────────────────────────────────
    const [usernameStatus, setUsernameStatus] = useState(null)
    const [checkingUsername, setCheckingUsername] = useState(false)
    const debouncedUsername = useDebounce(formData.username, 500)

    useEffect(() => {
        if (!debouncedUsername || debouncedUsername.length < 3) {
            setUsernameStatus(null)
            return
        }
        let cancelled = false
        setCheckingUsername(true)
        api.get(`/auth/check-username?username=${encodeURIComponent(debouncedUsername)}`)
            .then(res => { if (!cancelled) setUsernameStatus(res.data) })
            .catch(() => { if (!cancelled) setUsernameStatus(null) })
            .finally(() => { if (!cancelled) setCheckingUsername(false) })
        return () => { cancelled = true }
    }, [debouncedUsername])

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setError('')
        setFieldError(prev => ({ ...prev, [field]: '' }))
        if (field === 'username') setUsernameStatus(null)
    }

    const handleSubmit = async () => {
        if (!formData.username || !formData.email || !formData.password) {
            setError('Please fill in all fields')
            return
        }
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters')
            return
        }
        if (usernameStatus && !usernameStatus.available) {
            setFieldError(prev => ({ ...prev, username: usernameStatus.message }))
            return
        }

        setLoading(true)
        const result = await signup(formData.username, formData.email, formData.password)
        setLoading(false)

        if (result.success) {
            navigate('/library')
        } else {
            if (result.field) {
                setFieldError(prev => ({ ...prev, [result.field]: result.message }))
            } else {
                setError(result.message)
            }
        }
    }

    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setGoogleLoading(true)
            try {
                const result = await loginWithGoogle(tokenResponse.access_token)
                if (result.success) {
                    navigate('/library')
                } else {
                    setError(result.message)
                }
            } catch {
                setError('Google sign-in failed. Please try again.')
            } finally {
                setGoogleLoading(false)
            }
        },
        onError: () => setError('Google sign-in was cancelled or failed'),
    })

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">

                <div className="text-center mb-8">
                    <div className="font-black text-4xl tracking-widest text-[#c8ff57] mb-2"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        LEVEL<span className="text-white">LOG</span>
                    </div>
                    <p className="text-[#7a7a90] font-mono text-xs">Start your game diary today</p>
                </div>

                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">

                    <h2 className="font-black text-xl tracking-widest uppercase mb-6"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        Create Account
                    </h2>

                    {/* Google button */}
                    <button
                        onClick={() => googleLogin()}
                        disabled={googleLoading || loading}
                        className="w-full flex items-center justify-center gap-3 py-2.5 mb-4
                                   bg-white text-[#111] font-bold text-sm rounded
                                   hover:bg-gray-100 transition-all
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {googleLoading ? (
                            <span className="font-mono text-xs">Connecting...</span>
                        ) : (
                            <>
                                <GoogleIcon />
                                Continue with Google
                            </>
                        )}
                    </button>

                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px bg-[#2a2a35]" />
                        <span className="font-mono text-[10px] text-[#3a3a50] uppercase tracking-wider">or</span>
                        <div className="flex-1 h-px bg-[#2a2a35]" />
                    </div>

                    {error && (
                        <div className="bg-[#ff5c5c]/10 border border-[#ff5c5c]/30
                                        text-[#ff5c5c] font-mono text-xs p-3 rounded mb-4">
                            {error}
                        </div>
                    )}

                    {/* Username */}
                    <div className="mb-4">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2">Username</label>
                        <input
                            type="text"
                            placeholder="e.g. piyush_games"
                            value={formData.username}
                            onChange={e => handleChange('username', e.target.value)}
                            maxLength={20}
                            className={`w-full bg-[#18181f] border rounded
                                        px-3 py-2 text-sm text-white
                                        focus:outline-none transition-colors
                                        placeholder:text-[#7a7a90]
                                        ${fieldError.username
                                    ? 'border-[#ff5c5c] focus:border-[#ff5c5c]'
                                    : usernameStatus?.available
                                        ? 'border-[#c8ff57]/60 focus:border-[#c8ff57]'
                                        : 'border-[#2a2a35] focus:border-[#c8ff57]'
                                }`}
                        />
                        <div className="mt-1 h-4 flex items-center">
                            {checkingUsername && (
                                <span className="font-mono text-[10px] text-[#7a7a90]">Checking...</span>
                            )}
                            {!checkingUsername && fieldError.username && (
                                <span className="font-mono text-[10px] text-[#ff5c5c]">
                                    ✕ {fieldError.username}
                                </span>
                            )}
                            {!checkingUsername && !fieldError.username && usernameStatus && (
                                <span className={`font-mono text-[10px] ${usernameStatus.available ? 'text-[#c8ff57]' : 'text-[#ff5c5c]'}`}>
                                    {usernameStatus.available ? '✓' : '✕'} {usernameStatus.message}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Email */}
                    <div className="mb-4">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2">Email</label>
                        <input
                            type="email"
                            placeholder="you@email.com"
                            value={formData.email}
                            onChange={e => handleChange('email', e.target.value)}
                            className={`w-full bg-[#18181f] border rounded
                                        px-3 py-2 text-sm text-white
                                        focus:outline-none transition-colors
                                        placeholder:text-[#7a7a90]
                                        ${fieldError.email
                                    ? 'border-[#ff5c5c] focus:border-[#ff5c5c]'
                                    : 'border-[#2a2a35] focus:border-[#c8ff57]'
                                }`}
                        />
                        {fieldError.email && (
                            <div className="mt-1 font-mono text-[10px] text-[#ff5c5c]">
                                ✕ {fieldError.email}{' '}
                                {fieldError.email.includes('already exists') && (
                                    <Link to="/login" className="underline text-[#c8ff57]">
                                        Log in instead?
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Password */}
                    <div className="mb-6">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2">Password</label>
                        <input
                            type="password"
                            placeholder="Min 6 characters"
                            value={formData.password}
                            onChange={e => handleChange('password', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                       px-3 py-2 text-sm text-white
                                       focus:outline-none focus:border-[#c8ff57]
                                       placeholder:text-[#7a7a90] transition-colors"
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={loading || googleLoading}
                        className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm
                                   rounded hover:bg-[#d4ff6e] transition-all
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>

                    <p className="text-center text-[#7a7a90] font-mono text-xs mt-4">
                        Already have an account?{' '}
                        <Link to="/login" className="text-[#c8ff57] hover:underline">Login</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" />
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" />
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z" />
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.31z" />
        </svg>
    )
}

export default Signup
