// useNotifications.js
// Fetches unread notification count
// Used in Navbar to show the bell badge

import { useState, useEffect } from 'react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

function useNotifications() {

    const { user } = useAuth()
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        if (!user) {
            setUnreadCount(0)
            return
        }

        const fetchCount = async () => {
            try {
                const res = await api.get('/notifications/unread-count')
                setUnreadCount(res.data.count)
            } catch (err) {
                console.error('Notification count error:', err)
            }
        }

        // Fetch immediately
        fetchCount()

        // Then fetch every 30 seconds
        // This keeps count updated without page refresh
        const interval = setInterval(fetchCount, 30000)

        // Cleanup interval when component unmounts
        return () => clearInterval(interval)

    }, [user])

    return { unreadCount, setUnreadCount }
}

export default useNotifications