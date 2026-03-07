import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

const AuthContext = createContext()

export function AuthProvider({ children }) {

    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    // ── CHECK IF USER IS ALREADY LOGGED IN ──
    // Runs once when app starts
    // Reads token from localStorage and fetches user data
    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('levellog_token')

            if (!token) {
                setLoading(false)
                return
            }

            try {
                // Set token in axios headers
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`

                // Fetch current user data
                const res = await api.get('/auth/me')

                setUser({
                    id: res.data.user._id || res.data.user.id,
                    _id: res.data.user._id || res.data.user.id,
                    username: res.data.user.username,
                    email: res.data.user.email,
                    isPrivate: res.data.user.isPrivate || false
                })

            } catch (err) {
                // Token invalid or expired — clear it
                localStorage.removeItem('levellog_token')
                delete api.defaults.headers.common['Authorization']
            } finally {
                setLoading(false)
            }
        }

        initAuth()
    }, [])

    // ── SIGNUP ──
    const signup = async (username, email, password) => {
        try {
            const res = await api.post('/auth/signup', {
                username,
                email,
                password
            })

            const { token, user: userData } = res.data

            // Save token to localStorage
            localStorage.setItem('levellog_token', token)

            // Set token in axios headers for future requests
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`

            setUser({
                id: userData.id || userData._id,
                _id: userData.id || userData._id,
                username: userData.username,
                email: userData.email,
                isPrivate: userData.isPrivate || false
            })

            return { success: true }

        } catch (err) {
            return {
                success: false,
                message: err.response?.data?.message || 'Signup failed'
            }
        }
    }

    // ── LOGIN ──
    const login = async (email, password) => {
        try {
            const res = await api.post('/auth/login', { email, password })

            const { token, user: userData } = res.data

            localStorage.setItem('levellog_token', token)
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`

            setUser({
                id: userData.id || userData._id,
                _id: userData.id || userData._id,
                username: userData.username,
                email: userData.email,
                isPrivate: userData.isPrivate || false
            })

            return { success: true }

        } catch (err) {
            return {
                success: false,
                message: err.response?.data?.message || 'Login failed'
            }
        }
    }

    // ── LOGOUT ──
    const logout = () => {
        localStorage.removeItem('levellog_token')
        delete api.defaults.headers.common['Authorization']
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, loading, signup, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

// Custom hook to use auth context anywhere
export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used inside AuthProvider')
    }
    return context
}

export default AuthContext