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

function App() {
    return (
        <BrowserRouter>
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
                            </Routes>
                        </>
                    } />
                </Routes>
            </div>
        </BrowserRouter>
    )
}

export default App