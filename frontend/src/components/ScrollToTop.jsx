import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
    const { pathname } = useLocation()

    useEffect(() => {
        // Aggressive reset to top
        window.scrollTo(0, 0)
        
        // Timeout ensures it fires even if content is still loading in Suspense
        const timer = setTimeout(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
            document.documentElement.scrollTo(0, 0)
        }, 10)

        return () => clearTimeout(timer)
    }, [pathname])

    return null
}
