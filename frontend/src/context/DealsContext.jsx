import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import api from '../api/axios'

const DealsContext = createContext()

export function DealsProvider({ children }) {
    const [deals, setDeals] = useState([])
    const [loading, setLoading] = useState(true)
    const [lastUpdated, setLastUpdated] = useState(null)
    const [newDealsCount, setNewDealsCount] = useState(0)
    const [newDealsList, setNewDealsList] = useState([])
    const prevIds = useRef(new Set())

    const fetchDeals = useCallback(async (storeFilter = 'all', freeOnly = false) => {
        try {
            // Check loading state without being a dependency
            const res = await api.get(`/deals?storeFilter=${storeFilter}&freeOnly=${freeOnly}`)
            const { success, deals: cleaned } = res.data
            
            if (!success) return

            // Detection logic for new deals (for the badge and notifications)
            const fresh = cleaned.filter(d => prevIds.current.size > 0 && !prevIds.current.has(d.dealID))
            prevIds.current = new Set(cleaned.map(d => d.dealID))

            if (fresh.length > 0) {
                setNewDealsCount(prev => prev + fresh.length)
                setNewDealsList(fresh.slice(0, 10))

                // Browser Notification
                if (Notification?.permission === 'granted') {
                    new Notification('🎮 New LevelLog Deals!', {
                        body: `${fresh.length} new deal${fresh.length > 1 ? 's' : ''} detected! Check them out now.`,
                        icon: '/favicon.ico',
                    })
                }
            }

            setDeals(cleaned)
            setLastUpdated(new Date())
        } catch (err) {
            console.error('Deals background fetch error:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    // Initial prefetch and background polling
    useEffect(() => {
        fetchDeals()
        const interval = setInterval(() => fetchDeals(), 5 * 60 * 1000) // Poll every 5 minutes
        return () => clearInterval(interval)
    }, [fetchDeals])

    // Permission request for notifications
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }
    }, [])

    const clearNewDealsCount = useCallback(() => {
        setNewDealsCount(0)
        setNewDealsList([])
    }, [])

    const value = useMemo(() => ({
        deals,
        loading,
        lastUpdated,
        newDealsCount,
        newDealsList,
        fetchDeals,
        clearNewDealsCount
    }), [deals, loading, lastUpdated, newDealsCount, newDealsList, fetchDeals, clearNewDealsCount])

    return (
        <DealsContext.Provider value={value}>
            {children}
        </DealsContext.Provider>
    )
}

export function useDeals() {
    const context = useContext(DealsContext)
    if (!context) throw new Error('useDeals must be used inside DealsProvider')
    return context
}

export default DealsContext
