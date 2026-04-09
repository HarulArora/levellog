import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Library from './pages/Library'
import Lists from './pages/Lists'
import Activity from './pages/Activity'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Stats from './pages/Stats'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import Search from './pages/Search'
import GameDetail from './pages/GameDetail'
import EditProfile from './pages/EditProfile'
import Discover from './pages/Discover'
import Deals from './pages/Deals'
import ScrollToTop from './components/ScrollToTop'

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
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/*" element={
                        <>
                            <Navbar />
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
                        </>
                    } />
                </Routes>
            </div>
        </BrowserRouter>
    )
}

export default App