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
    xp: userData.xp || 0,
    level: userData.level || 1,
    badge: userData.badge || '🎮',
    googleId: userData.googleId || null,
    hasPassword: userData.hasPassword || false,
})

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('questduck_token')
            
            // If we have a token in localStorage, set it as default. 
            // If not, we still try /auth/me to see if an HttpOnly cookie exists.
            if (token) {
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`
            }

            try {
                const res = await api.get('/auth/me')
                setUser(buildUser(res.data.user))
            } catch (err) {
                // Clear if unauthorized (401) or forbidden/unverified (403)
                if (err.response?.status === 401 || err.response?.status === 403) {
                    localStorage.removeItem('questduck_token')
                    delete api.defaults.headers.common['Authorization']
                }
            } finally {
                setLoading(false)
            }
        }
        initAuth()
    }, [])

    const _setSession = (token, userData) => {
        localStorage.setItem('questduck_token', token)
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        setUser(buildUser(userData))
    }

    const signup = async (username, email, password) => {
        try {
            const res = await api.post('/auth/signup', { username, email, password })
            if (res.data.requiresVerification) {
                return { success: true, requiresVerification: true, email: res.data.email }
            }
            const { token, user: userData } = res.data
            _setSession(token, userData)
            return { success: true }
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
            if (err.response?.data?.requiresVerification) {
                return {
                    success: false,
                    requiresVerification: true,
                    email: err.response.data.email,
                    message: err.response.data.message
                }
            }
            return { success: false, message: err.response?.data?.message || 'Login failed' }
        }
    }

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

    const logout = async () => {
        try {
            await api.post('/auth/logout')
        } catch (err) {
            console.error('Logout request failed', err)
        } finally {
            localStorage.removeItem('questduck_token')
            delete api.defaults.headers.common['Authorization']
            setUser(null)
        }
    }

    const refreshUser = async () => {
        try {
            const res = await api.get('/auth/me')
            setUser(buildUser(res.data.user))
        } catch (err) {
            console.error('Failed to refresh user', err)
        }
    }

    const verifyEmail = async (email, code) => {
        try {
            const res = await api.post('/auth/verify-email', { email, code })
            const { token, user: userData } = res.data
            _setSession(token, userData)
            return { success: true, message: res.data.message }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Verification failed' }
        }
    }

    const resendVerification = async (email) => {
        try {
            const res = await api.post('/auth/resend-verification', { email })
            return { success: true, message: res.data.message }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Failed to resend code' }
        }
    }

    const forgotPassword = async (email) => {
        try {
            const res = await api.post('/auth/forgot-password', { email })
            return { success: true, message: res.data.message }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Failed to send reset code' }
        }
    }

    const resetPassword = async (email, code, newPassword) => {
        try {
            const res = await api.post('/auth/reset-password', { email, code, newPassword })
            return { success: true, message: res.data.message }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Failed to reset password' }
        }
    }

    const linkGoogle = async (accessToken) => {
        try {
            const res = await api.post('/auth/link-google', { accessToken })
            setUser(buildUser(res.data.user))
            return { success: true, message: res.data.message }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Failed to link Google account' }
        }
    }

    const unlinkGoogle = async () => {
        try {
            const res = await api.post('/auth/unlink-google')
            setUser(buildUser(res.data.user))
            return { success: true, message: res.data.message }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Failed to unlink Google account' }
        }
    }

    const setPassword = async (password) => {
        try {
            const res = await api.patch('/auth/set-password', { password })
            setUser(buildUser(res.data.user))
            return { success: true, message: res.data.message }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Failed to set password' }
        }
    }

    const changePassword = async (currentPassword, newPassword) => {
        try {
            const res = await api.patch('/auth/change-password', { currentPassword, newPassword })
            return { success: true, message: res.data.message }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Failed to change password' }
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
            verifyEmail,
            resendVerification,
            forgotPassword,
            resetPassword,
            linkGoogle,
            unlinkGoogle,
            setPassword,
            changePassword
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
