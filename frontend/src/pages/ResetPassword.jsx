import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ResetPassword() {
    const { logout, resetPassword } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const queryParams = new URLSearchParams(location.search)
    const emailFromQuery = queryParams.get('email') || ''

    const [formData, setFormData] = useState({
        email: emailFromQuery,
        code: '',
        newPassword: '',
        confirmPassword: ''
    })
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setError('')
    }

    const handleSubmit = async () => {
        const { email, code, newPassword, confirmPassword } = formData
        if (!email || !code || !newPassword || !confirmPassword) {
            setError('Please fill in all fields')
            return
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match')
            return
        }
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters')
            return
        }

        setError('')
        setMessage('')
        setLoading(true)
        const res = await resetPassword(email, code, newPassword)
        setLoading(false)

        if (res.success) {
            // Logout first to clear any old session
            logout()
            setMessage('Password reset successfully! Redirecting to login...')
            setTimeout(() => navigate('/login'), 2000)
        } else {
            setError(res.message)
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
                        <div className="font-black text-4xl md:text-5xl tracking-[0.05em] text-[#c8ff57]"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            RESET<span className="text-white"> PASSWORD</span>
                        </div>
                    </Link>
                    <p className="text-[#7a7a90] font-mono text-xs">Enter the code and your new password</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6 shadow-2xl">
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
                                          text-[#7a7a90] mb-2" htmlFor="email">Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="username email"
                            value={formData.email}
                            onChange={e => handleChange('email', e.target.value)}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                       px-3 py-2 text-sm text-white
                                       focus:outline-none focus:border-[#c8ff57]
                                       placeholder:text-[#7a7a90] transition-colors"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2" htmlFor="code">Reset Code</label>
                        <input
                            id="code"
                            name="code"
                            type="text"
                            maxLength="6"
                            placeholder="123456"
                            value={formData.code}
                            onChange={e => handleChange('code', e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                       px-3 py-2 text-center text-lg font-bold tracking-widest
                                       focus:outline-none focus:border-[#c8ff57]
                                       placeholder:text-[#3a3a50] transition-colors text-white font-mono"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2" htmlFor="newPassword">New Password</label>
                        <div className="relative">
                            <input
                                id="newPassword"
                                name="newPassword"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                value={formData.newPassword}
                                onChange={e => handleChange('newPassword', e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                           px-3 py-2 text-sm text-white
                                           focus:outline-none focus:border-[#c8ff57]
                                           placeholder:text-[#7a7a90] transition-colors"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7a90] hover:text-[#c8ff57]"
                            >
                                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2" htmlFor="confirmPassword">Confirm New Password</label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={formData.confirmPassword}
                            onChange={e => handleChange('confirmPassword', e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                       px-3 py-2 text-sm text-white
                                       focus:outline-none focus:border-[#c8ff57]
                                       placeholder:text-[#7a7a90] transition-colors"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !formData.code || !formData.newPassword}
                        className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm
                                   rounded hover:bg-[#d4ff6e] transition-all
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Resetting...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
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

export default ResetPassword
