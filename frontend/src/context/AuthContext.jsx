import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

const AuthContext = createContext()

const buildUser = (userData) => ({
    id: userData._id || userData.id,
    _id: userData._id || userData.id,
    username: userData.username,
    email: userData.email,
    isPrivate: userData.isPrivate || false,
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
            if (!token) {
                setLoading(false)
                return
            }
            try {
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`
                const res = await api.get('/auth/me')
                setUser(buildUser(res.data.user))
            } catch (err) {
                localStorage.removeItem('levellog_token')
                delete api.defaults.headers.common['Authorization']
            } finally {
                setLoading(false)
            }
        }
        initAuth()
    }, [])

    const signup = async (username, email, password) => {
        try {
            const res = await api.post('/auth/signup', { username, email, password })
            const { token, user: userData } = res.data
            localStorage.setItem('levellog_token', token)
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`
            setUser(buildUser(userData))
            return { success: true }
        } catch (err) {
            return {
                success: false,
                message: err.response?.data?.message || 'Signup failed'
            }
        }
    }

    const login = async (email, password) => {
        try {
            const res = await api.post('/auth/login', { email, password })
            const { token, user: userData } = res.data
            localStorage.setItem('levellog_token', token)
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`
            setUser(buildUser(userData))
            return { success: true }
        } catch (err) {
            return {
                success: false,
                message: err.response?.data?.message || 'Login failed'
            }
        }
    }

    const logout = () => {
        localStorage.removeItem('levellog_token')
        delete api.defaults.headers.common['Authorization']
        setUser(null)
    }

    // Refresh XP/level from server (call this after earning XP)
    const refreshUser = async () => {
        try {
            const res = await api.get('/auth/me')
            setUser(buildUser(res.data.user))
        } catch (err) {
            console.error('Failed to refresh user', err)
        }
    }

    return (
        <AuthContext.Provider value={{ user, loading, signup, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used inside AuthProvider')
    }
    return context
}

export default AuthContext