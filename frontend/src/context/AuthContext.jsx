// AuthContext.jsx
// Global auth state — stores the logged in user
// Any component in the app can access this

import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

// Step 1 — Create the context (like creating a radio station)
const AuthContext = createContext()

// Step 2 — Create the Provider (like the radio tower that broadcasts)
// Wrap your whole app in this so every component can tune in
export function AuthProvider({ children }) {

    // The logged in user — null means not logged in
    const [user, setUser] = useState(null)

    // Loading while we check if user is already logged in
    const [loading, setLoading] = useState(true)


    // ── CHECK IF ALREADY LOGGED IN ──
    // When app starts — check if there's a saved token
    // If yes — fetch user data and stay logged in
    useEffect(() => {
        const token = localStorage.getItem('levellog_token')

        if (token) {
            // Add token to all future Axios requests automatically
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`

            // Verify token and get user data
            api.get('/auth/me')
                .then(res => setUser(res.data.user))
                .catch(() => {
                    // Token is invalid or expired — clear it
                    localStorage.removeItem('levellog_token')
                    delete api.defaults.headers.common['Authorization']
                })
                .finally(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [])


    // ── SIGNUP ──
    const signup = async (username, email, password) => {
        try {
            const res = await api.post('/auth/signup', { username, email, password })

            // Save token to localStorage — persists across page refreshes
            localStorage.setItem('levellog_token', res.data.token)

            // Set token in Axios headers for future requests
            api.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`

            // Save user in state
            setUser(res.data.user)

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

            localStorage.setItem('levellog_token', res.data.token)
            api.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`
            setUser(res.data.user)

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
        // Remove token from localStorage
        localStorage.removeItem('levellog_token')

        // Remove token from Axios headers
        delete api.defaults.headers.common['Authorization']

        // Clear user from state
        setUser(null)
    }


    // Step 3 — Broadcast these values to all components
    return (
        <AuthContext.Provider value={{ user, loading, signup, login, logout }}>
            {/* Only render children after we know auth status */}
            {!loading && children}
        </AuthContext.Provider>
    )
}


// Step 4 — Custom hook to easily USE the context
// Instead of writing useContext(AuthContext) everywhere
// Just write useAuth()
export function useAuth() {
    return useContext(AuthContext)
}