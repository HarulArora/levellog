import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../api/axios'

function VerifyEmail() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')

    const [status, setStatus] = useState('loading')  // 'loading' | 'success' | 'error'
    const [message, setMessage] = useState('')

    useEffect(() => {
        if (!token) {
            setStatus('error')
            setMessage('No verification token found in the link.')
            return
        }
        api.get(`/auth/verify-email?token=${token}`)
            .then(res => {
                setStatus('success')
                setMessage(res.data.message)
            })
            .catch(err => {
                setStatus('error')
                setMessage(err.response?.data?.message || 'Verification failed.')
            })
    }, [token])

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="font-black text-4xl tracking-widest text-[#c8ff57] mb-2"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        LEVEL<span className="text-white">LOG</span>
                    </div>
                </div>

                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-8 text-center">
                    {status === 'loading' && (
                        <>
                            <div className="text-4xl mb-4">⏳</div>
                            <h2 className="font-black text-xl tracking-widest uppercase mb-3"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Verifying...
                            </h2>
                            <p className="text-[#7a7a90] font-mono text-xs">
                                Please wait while we verify your email.
                            </p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="text-4xl mb-4">🎉</div>
                            <h2 className="font-black text-xl tracking-widest uppercase mb-3"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Email Verified!
                            </h2>
                            <p className="text-[#7a7a90] font-mono text-xs mb-6 leading-relaxed">
                                {message}
                            </p>
                            <Link to="/login"
                                className="block w-full py-3 bg-[#c8ff57] text-black font-bold
                                           text-sm rounded hover:bg-[#d4ff6e] transition-all">
                                Login to LevelLog
                            </Link>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="text-4xl mb-4">❌</div>
                            <h2 className="font-black text-xl tracking-widest uppercase mb-3"
                                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                Verification Failed
                            </h2>
                            <p className="text-[#ff5c5c] font-mono text-xs mb-6 leading-relaxed">
                                {message}
                            </p>
                            <Link to="/login"
                                className="block w-full py-3 bg-[#c8ff57] text-black font-bold
                                           text-sm rounded hover:bg-[#d4ff6e] transition-all mb-3">
                                Go to Login
                            </Link>
                            <p className="text-[#7a7a90] font-mono text-[10px]">
                                Need a new link? Log in and we'll offer to resend it.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default VerifyEmail
