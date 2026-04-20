import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axios'

const LeaderboardContext = createContext()

export function LeaderboardProvider({ children }) {
    const [topUsers, setTopUsers] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchLeaderboard = useCallback(async () => {
        try {
            const res = await api.get('/leaderboard/top')
            if (res.data.success) {
                setTopUsers(res.data.leaderboard)
            }
        } catch (err) {
            console.error('Failed to fetch leaderboard:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchLeaderboard()
        // Refresh Every 10 minutes
        const interval = setInterval(fetchLeaderboard, 10 * 60 * 1000)
        return () => clearInterval(interval)
    }, [fetchLeaderboard])

    return (
        <LeaderboardContext.Provider value={{ topUsers, loading, refresh: fetchLeaderboard }}>
            {children}
        </LeaderboardContext.Provider>
    )
}

export function useLeaderboard() {
    return useContext(LeaderboardContext)
}
