// Login.jsx — Login page

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Login() {
    const { login } = useAuth()
    const navigate = useNavigate()

    const [formData, setFormData] = useState({ email: '', password: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setError('')   // clear error when user types
    }

    const handleSubmit = async () => {
        if (!formData.email || !formData.password) {
            setError('Please fill in all fields')
            return
        }

        setLoading(true)
        const result = await login(formData.email, formData.password)
        setLoading(false)

        if (result.success) {
            // Redirect to library after login
            navigate('/library')
        } else {
            setError(result.message)
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">

                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="font-black text-4xl tracking-widest text-[#c8ff57] mb-2"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        LEVEL<span className="text-white">LOG</span>
                    </div>
                    <p className="text-[#7a7a90] font-mono text-xs">
                        Welcome back, gamer
                    </p>
                </div>

                {/* Card */}
                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">

                    <h2 className="font-black text-xl tracking-widest uppercase mb-6"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        Login
                    </h2>

                    {/* Error message */}
                    {error && (
                        <div className="bg-[#ff5c5c]/10 border border-[#ff5c5c]/30 
                            text-[#ff5c5c] font-mono text-xs p-3 rounded mb-4">
                            {error}
                        </div>
                    )}

                    {/* Email */}
                    <div className="mb-4">
                        <label className="block font-mono text-xs uppercase tracking-wider 
                              text-[#7a7a90] mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            placeholder="you@email.com"
                            value={formData.email}
                            onChange={e => handleChange('email', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded 
                         px-3 py-2 text-sm text-white
                         focus:outline-none focus:border-[#c8ff57]
                         placeholder:text-[#7a7a90] transition-colors"
                        />
                    </div>

                    {/* Password */}
                    <div className="mb-6">
                        <label className="block font-mono text-xs uppercase tracking-wider 
                              text-[#7a7a90] mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={e => handleChange('password', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded 
                         px-3 py-2 text-sm text-white
                         focus:outline-none focus:border-[#c8ff57]
                         placeholder:text-[#7a7a90] transition-colors"
                        />
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm 
                       rounded hover:bg-[#d4ff6e] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>

                    {/* Link to signup */}
                    <p className="text-center text-[#7a7a90] font-mono text-xs mt-4">
                        No account?{' '}
                        <Link to="/signup" className="text-[#c8ff57] hover:underline">
                            Sign up free
                        </Link>
                    </p>

                </div>
            </div>
        </div>
    )
}

export default Login