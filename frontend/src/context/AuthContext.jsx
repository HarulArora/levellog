import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

const AuthContext = createContext()

const buildUser = (userData) => ({
    id: userData._id || userData.id,
    _id: userData._id || userData.id,
    username: userData.username,
    email: userData.email,
    bio: userData.bio || '',
    avatar: userData.avatar || '',
    isPrivate: userData.isPrivate || false,
    isEmailVerified: userData.isEmailVerified || false,
    xp: userData.xp || 0,
    level: userData.level || 1,
    badge: userData.badge || '🎮',
})

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('levellog_token')
            if (!token) { setLoading(false); return }
            try {
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`
                const res = await api.get('/auth/me')
                setUser(buildUser(res.data.user))
            } catch {
                localStorage.removeItem('levellog_token')
                delete api.defaults.headers.common['Authorization']
            } finally {
                setLoading(false)
            }
        }
        initAuth()
    }, [])

    const _setSession = (token, userData) => {
        localStorage.setItem('levellog_token', token)
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        setUser(buildUser(userData))
    }

    const signup = async (username, email, password) => {
        try {
            const res = await api.post('/auth/signup', { username, email, password })
            const { token, user: userData } = res.data
            _setSession(token, userData)
            return { success: true, message: res.data.message }
        } catch (err) {
            return {
                success: false,
                message: err.response?.data?.message || 'Signup failed',
                field: err.response?.data?.field || null,
            }
        }
    }

    const login = async (email, password) => {
        try {
            const res = await api.post('/auth/login', { email, password })
            const { token, user: userData } = res.data
            _setSession(token, userData)
            return { success: true }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Login failed' }
        }
    }

    // Google Sign-In — receives access_token from @react-oauth/google
    const loginWithGoogle = async (accessToken) => {
        try {
            const res = await api.post('/auth/google', { accessToken })
            const { token, user: userData } = res.data
            _setSession(token, userData)
            return { success: true }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Google sign-in failed' }
        }
    }

    const logout = () => {
        localStorage.removeItem('levellog_token')
        delete api.defaults.headers.common['Authorization']
        setUser(null)
    }

    const refreshUser = async () => {
        try {
            const res = await api.get('/auth/me')
            setUser(buildUser(res.data.user))
        } catch (err) {
            console.error('Failed to refresh user', err)
        }
    }

    const resendVerification = async () => {
        try {
            const res = await api.post('/auth/resend-verification')
            return { success: true, message: res.data.message }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Failed to send email' }
        }
    }

    const forgotPassword = async (email) => {
        try {
            const res = await api.post('/auth/forgot-password', { email })
            return { success: true, message: res.data.message }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Failed to send reset email' }
        }
    }

    const resetPassword = async (token, password) => {
        try {
            const res = await api.post('/auth/reset-password', { token, password })
            return { success: true, message: res.data.message }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Reset failed' }
        }
    }

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            signup,
            login,
            loginWithGoogle,
            logout,
            refreshUser,
            resendVerification,
            forgotPassword,
            resetPassword,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used inside AuthProvider')
    return context
}

export default AuthContext
