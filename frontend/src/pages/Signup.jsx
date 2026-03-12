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

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function Signup() {
    const { signup, loginWithGoogle } = useAuth()
    const navigate = useNavigate()

    const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '' })
    const [error, setError] = useState('')
    const [fieldError, setFieldError] = useState({})
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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
        if (field === 'username') {
            // Only allow letters, numbers, and underscores
            if (value && !/^[a-zA-Z0-9_]*$/.test(value)) return
        }
        setFormData(prev => ({ ...prev, [field]: value }))
        setError('')
        setFieldError(prev => ({ ...prev, [field]: '' }))
        if (field === 'username') setUsernameStatus(null)
    }

    const handleSubmit = async () => {
        const trimmedUsername = formData.username

        // All fields required
        if (!trimmedUsername || !formData.email || !formData.password || !formData.confirmPassword) {
            setError('Please fill in all fields')
            return
        }

        // Username min length (after trim)
        if (trimmedUsername.length < 3) {
            setFieldError(prev => ({ ...prev, username: 'Username must be at least 3 characters' }))
            return
        }

        // Email format validation
        if (!isValidEmail(formData.email)) {
            setFieldError(prev => ({ ...prev, email: 'Please enter a valid email address' }))
            return
        }

        // Password length
        if (formData.password.length < 6) {
            setFieldError(prev => ({ ...prev, password: 'Password must be at least 6 characters' }))
            return
        }

        // Confirm password match
        if (formData.password !== formData.confirmPassword) {
            setFieldError(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }))
            return
        }

        // Username availability
        if (usernameStatus && !usernameStatus.available) {
            setFieldError(prev => ({ ...prev, username: usernameStatus.message }))
            return
        }

        setLoading(true)
        const result = await signup(trimmedUsername, formData.email, formData.password)
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

                    <h2 className="font-black text-xl tracking-widest uppercase mb-6 text-white text-center hover:text-[#c8ff57] transition-colors cursor-default"
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
                        <div className="flex items-center justify-between mb-2">
                            <label className="font-mono text-xs uppercase tracking-wider text-[#7a7a90]">Username</label>
                            <span className={`font-mono text-[10px] tabular-nums ${formData.username.length >= 20 ? 'text-[#ff5c5c]' : formData.username.length >= 16 ? 'text-[#ffaa57]' : 'text-[#3a3a50]'}`}>
                                {formData.username.length}/20
                            </span>
                        </div>
                        <input
                            type="text"
                            placeholder="Letters, numbers, underscore"
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
                    <div className="mb-4">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Min 6 characters"
                                value={formData.password}
                                onChange={e => handleChange('password', e.target.value)}
                                className={`w-full bg-[#18181f] border rounded
                                           px-3 py-2 pr-10 text-sm text-white
                                           focus:outline-none transition-colors
                                           placeholder:text-[#7a7a90]
                                           ${fieldError.password
                                        ? 'border-[#ff5c5c] focus:border-[#ff5c5c]'
                                        : 'border-[#2a2a35] focus:border-[#c8ff57]'
                                    }`}
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
                        {fieldError.password && (
                            <div className="mt-1 font-mono text-[10px] text-[#ff5c5c]">
                                ✕ {fieldError.password}
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div className="mb-6">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2">Re-enter Password</label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="Repeat your password"
                                value={formData.confirmPassword}
                                onChange={e => handleChange('confirmPassword', e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                className={`w-full bg-[#18181f] border rounded
                                           px-3 py-2 pr-10 text-sm text-white
                                           focus:outline-none transition-colors
                                           placeholder:text-[#7a7a90]
                                           ${fieldError.confirmPassword
                                        ? 'border-[#ff5c5c] focus:border-[#ff5c5c]'
                                        : formData.confirmPassword && formData.password === formData.confirmPassword
                                            ? 'border-[#c8ff57]/60 focus:border-[#c8ff57]'
                                            : 'border-[#2a2a35] focus:border-[#c8ff57]'
                                    }`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7a90] hover:text-[#c8ff57] transition-colors"
                                tabIndex={-1}
                            >
                                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                        </div>
                        {fieldError.confirmPassword && (
                            <div className="mt-1 font-mono text-[10px] text-[#ff5c5c]">
                                ✕ {fieldError.confirmPassword}
                            </div>
                        )}
                        {!fieldError.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword && (
                            <div className="mt-1 font-mono text-[10px] text-[#c8ff57]">
                                ✓ Passwords match
                            </div>
                        )}
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

export default Signup