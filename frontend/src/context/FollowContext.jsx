import { createContext, useContext, useState, useCallback } from 'react'
import api from '../api/axios'
import { useAuth } from './AuthContext'

const FollowContext = createContext()

export const useFollow = () => useContext(FollowContext)

export function FollowProvider({ children }) {
    const { user: currentUser } = useAuth()
    const [followMap, setFollowMap] = useState({})
    const [loadingMap, setLoadingMap] = useState({})

    const updateFollowStatus = useCallback((userId, status) => {
        setFollowMap(prev => ({ ...prev, [userId]: status }))
    }, [])

    const getFollowStatus = useCallback((user) => {
        if (!user) return 'none'
        const current = followMap[user._id || user.id]
        if (current) return current
        
        // Fallback to user object properties if not in map yet
        if (user.isFollowedByMe) return 'following'
        if (user.isRequestedByMe) return 'requested'
        return 'none'
    }, [followMap])

    const handleFollowToggle = async (targetUser) => {
        if (!currentUser) return { success: false, message: 'Login required' }
        
        const targetId = targetUser._id || targetUser.id
        const currentState = getFollowStatus(targetUser)
        
        setLoadingMap(prev => ({ ...prev, [targetId]: true }))
        
        try {
            if (currentState === 'following') {
                await api.post(`/auth/unfollow/${targetId}`)
                updateFollowStatus(targetId, 'none')
                return { success: true, type: 'unfollowed' }
            } else if (currentState === 'requested') {
                await api.delete(`/auth/follow-request/cancel/${targetId}`)
                updateFollowStatus(targetId, 'none')
                return { success: true, type: 'cancelled' }
            } else {
                const res = await api.post(`/auth/follow/${targetId}`)
                const type = res.data.type === 'request_sent' ? 'requested' : 'following'
                updateFollowStatus(targetId, type)
                return { success: true, type }
            }
        } catch (err) {
            console.error('Follow toggle error:', err)
            return { success: false, message: err.response?.data?.message || 'Action failed' }
        } finally {
            setLoadingMap(prev => ({ ...prev, [targetId]: false }))
        }
    }

    return (
        <FollowContext.Provider value={{
            followMap,
            loadingMap,
            getFollowStatus,
            handleFollowToggle,
            updateFollowStatus
        }}>
            {children}
        </FollowContext.Provider>
    )
}
