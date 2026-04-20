import { useState, lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import ScrollToTop from './components/ScrollToTop'

const Home = lazy(() => import('./pages/Home'))
const Library = lazy(() => import('./pages/Library'))
const Lists = lazy(() => import('./pages/Lists'))
const Activity = lazy(() => import('./pages/Activity'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Stats = lazy(() => import('./pages/Stats'))
const Profile = lazy(() => import('./pages/Profile'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Search = lazy(() => import('./pages/Search'))
const GameDetail = lazy(() => import('./pages/GameDetail'))
const EditProfile = lazy(() => import('./pages/EditProfile'))
const Discover = lazy(() => import('./pages/Discover'))
const Deals = lazy(() => import('./pages/Deals'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

const PageLoader = () => (
    <div className="fixed inset-0 bg-[#0a0a0f] z-[9999] flex flex-col items-center justify-center pointer-events-none gap-6">
        <div className="font-black text-6xl tracking-[0.2em] text-[#c8ff57] animate-pulse" 
             style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            QUEST<span className="text-white">DUCK</span>
        </div>
    </div>
)

const MinimalLoader = () => (
    <div className="fixed top-0 left-0 right-0 h-[2.5px] z-[9999] overflow-hidden pointer-events-none">
        <div className="h-full bg-[#c8ff57] shadow-[0_0_12px_#c8ff57] animate-loading-bar" />
    </div>
)

/**
 * 🚀 Manual Progress Bar Trigger
 * Listens to location changes AND global clicks for ultra-fast feedback.
 */
const NavigationProgress = () => {
    const location = useLocation()
    const [visible, setVisible] = useState(false)
    const timerRef = useRef(null)

    const startLoader = () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        setVisible(true)
        timerRef.current = setTimeout(() => setVisible(false), 800)
    }

    useEffect(() => {
        // Trigger on any route change (including back/forward)
        startLoader()
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [location.pathname, location.search, location.hash])

    useEffect(() => {
        // Immediate Trigger for perceived performance
        const handleInteraction = (e) => {
            const link = e.target.closest('a')
            if (link && link.href.includes(window.location.origin) && !link.target) {
                startLoader()
            }
        }
        window.addEventListener('mousedown', handleInteraction)
        return () => window.removeEventListener('mousedown', handleInteraction)
    }, [])

    if (!visible) return null
    return <MinimalLoader />
}

function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
            <div className="font-black text-8xl text-[#c8ff57] mb-2"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                404
            </div>
            <p className="font-mono text-[#7a7a90] text-sm mb-6">
                This page doesn't exist or was moved.
            </p>
            <a href="/"
                className="px-5 py-2.5 bg-[#c8ff57] text-black font-bold text-sm rounded hover:bg-[#d4ff6e] transition-all">
                Go Home
            </a>
        </div>
    )
}



function App() {
    return (
        <BrowserRouter>
            <ScrollToTop />
            <NavigationProgress />
            <div className="bg-[#0a0a0f] min-h-screen">
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />
                        <Route path="/verify-email" element={<VerifyEmail />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        
                        {/* Main Layout Routes */}
                        <Route element={<><Navbar /><div className="content-wrapper"><Suspense fallback={<MinimalLoader />}><Outlet /></Suspense></div><Footer /></>}>
                            <Route path="/" element={<Home />} />
                            <Route path="/library" element={<Library />} />
                            <Route path="/lists" element={<Lists />} />
                            <Route path="/activity" element={<Activity />} />
                            <Route path="/stats" element={<Stats />} />
                            <Route path="/user/:username" element={<Profile />} />
                            <Route path="/notifications" element={<Notifications />} />
                            <Route path="/search" element={<Search />} />
                            <Route path="/game/:igdbId" element={<GameDetail />} />
                            <Route path="/edit-profile" element={<EditProfile />} />
                            <Route path="/discover" element={<Discover />} />
                            <Route path="/deals" element={<Deals />} />
                            <Route path="/privacy" element={<PrivacyPolicy />} />
                            <Route path="/terms" element={<TermsOfService />} />
                        </Route>
                        <Route path="*" element={<><Navbar /><NotFound /></>} />
                    </Routes>
                </Suspense>
            </div>
        </BrowserRouter>
    )
}

export default App