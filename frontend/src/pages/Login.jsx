import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGoogleLogin } from '@react-oauth/google'

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function Login() {
    const { login, loginWithGoogle } = useAuth()
    const navigate = useNavigate()
    const [formData, setFormData] = useState({ email: '', password: '' })
    const [error, setError] = useState('')
    const [fieldError, setFieldError] = useState({})
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setError('')
        setFieldError(prev => ({ ...prev, [field]: '' }))
    }

    const handleSubmit = async () => {
        if (!formData.email || !formData.password) {
            setError('Please fill in all fields')
            return
        }

        // Simple format validation: if it contains '@', it must be a valid email
        if (formData.email.includes('@') && !isValidEmail(formData.email)) {
            setFieldError(prev => ({ ...prev, email: 'Please enter a valid email address' }))
            return
        }

        setLoading(true)
        const result = await login(formData.email, formData.password)
        setLoading(false)
        if (result.success) {
            navigate('/library')
        } else {
            if (result.requiresVerification) {
                navigate(`/verify-email?email=${encodeURIComponent(result.email)}`)
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
                <div className="flex items-center justify-between mb-6">
                    <button onClick={() => navigate(-1)}
                        className="flex items-center gap-2 font-mono text-xs text-[#7a7a90]
                                   hover:text-[#c8ff57] transition-colors">
                        ← BACK
                    </button>
                    <button onClick={() => navigate('/')}
                        className="flex items-center gap-2 font-mono text-xs text-[#7a7a90]
                                   hover:text-[#c8ff57] transition-colors">
                        <HomeIcon /> 
                        HOME
                    </button>
                </div>
                <div className="text-center mb-8">
                    <div className="font-black text-4xl tracking-widest text-[#c8ff57] mb-2"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        QUEST<span className="text-white">DECK</span>
                    </div>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">
                    <h2 className="font-black text-xl tracking-widest uppercase mb-6 text-white text-center hover:text-[#c8ff57] transition-colors cursor-default"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        Login
                    </h2>
                    {/* Google button */}
                    <button
                        type="button"
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
                    {/* Email */}
                    <div className="mb-4">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2" htmlFor="email">Email or Username</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="off"
                            placeholder="you@email.com or username"
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
                                ✕ {fieldError.email}
                            </div>
                        )}
                    </div>
                    {/* Password */}
                    <div className="mb-6">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2" htmlFor="password">Password</label>
                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                autoComplete="new-password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={e => handleChange('password', e.target.value)}
                                className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                           px-3 py-2 pr-10 text-sm text-white
                                           focus:outline-none focus:border-[#c8ff57]
                                           placeholder:text-[#7a7a90] transition-colors"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7a90] hover:text-[#c8ff57] transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading || googleLoading}
                        className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm
                                   rounded hover:bg-[#d4ff6e] transition-all
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Connecting...' : 'Login'}
                    </button>
                </form>
                <div className="flex flex-col gap-2 mt-4 text-center">
                    <p className="text-[#7a7a90] font-mono text-xs">
                        No account?{' '}
                        <Link to="/signup" className="text-[#c8ff57] hover:underline">Sign up free</Link>
                    </p>
                        <Link to="/forgot-password"
                            className="text-[#7a7a90] hover:text-[#c8ff57] font-mono text-[10px] uppercase tracking-wider transition-colors">
                            Forgot Password?
                        </Link>
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

function EyeIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
}

function EyeOffIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    )
}

function HomeIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    )
}

export default Login