// Signup.jsx — Signup page

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Signup() {
    const { signup } = useAuth()
    const navigate = useNavigate()

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setError('')
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

        setLoading(true)
        const result = await signup(formData.username, formData.email, formData.password)
        setLoading(false)

        if (result.success) {
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
                        Start your game diary today
                    </p>
                </div>

                {/* Card */}
                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6">

                    <h2 className="font-black text-xl tracking-widest uppercase mb-6"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        Create Account
                    </h2>

                    {/* Error */}
                    {error && (
                        <div className="bg-[#ff5c5c]/10 border border-[#ff5c5c]/30 
                            text-[#ff5c5c] font-mono text-xs p-3 rounded mb-4">
                            {error}
                        </div>
                    )}

                    {/* Username */}
                    <div className="mb-4">
                        <label className="block font-mono text-xs uppercase tracking-wider 
                              text-[#7a7a90] mb-2">
                            Username
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. piyush_games"
                            value={formData.username}
                            onChange={e => handleChange('username', e.target.value)}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded 
                         px-3 py-2 text-sm text-white
                         focus:outline-none focus:border-[#c8ff57]
                         placeholder:text-[#7a7a90] transition-colors"
                        />
                    </div>

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

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-3 bg-[#c8ff57] text-black font-bold text-sm 
                       rounded hover:bg-[#d4ff6e] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>

                    {/* Link to login */}
                    <p className="text-center text-[#7a7a90] font-mono text-xs mt-4">
                        Already have an account?{' '}
                        <Link to="/login" className="text-[#c8ff57] hover:underline">
                            Login
                        </Link>
                    </p>

                </div>
            </div>
        </div>
    )
}

export default Signup