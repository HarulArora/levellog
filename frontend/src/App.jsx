import { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'

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
import ScrollToTop from './components/ScrollToTop'

const PageLoader = () => (
    <div className="fixed inset-0 bg-[#0a0a0f] z-[9999] flex items-center justify-center pointer-events-none">
        <div className="font-black text-4xl tracking-widest text-[#c8ff57] animate-pulse" 
             style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            QUEST<span className="text-white">DECK</span>
        </div>
    </div>
)

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
            <div className="bg-[#0a0a0f] min-h-screen">
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />
                        <Route path="/verify-email" element={<VerifyEmail />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/*" element={
                            <>
                                <Navbar />
                                <Suspense fallback={<PageLoader />}>
                                    <Routes>
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
                                        <Route path="*" element={<NotFound />} />
                                    </Routes>
                                </Suspense>
                            </>
                        } />
                    </Routes>
                </Suspense>
            </div>
        </BrowserRouter>
    )
}

export default App