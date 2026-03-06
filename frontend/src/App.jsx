import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Library from './pages/Library'
import Lists from './pages/Lists'
import Activity from './pages/Activity'
import Login from './pages/Login'
import Signup from './pages/Signup'

function App() {
    return (
        <BrowserRouter>
            <div className="bg-[#0a0a0f] min-h-screen">
                <Routes>
                    {/* Login and Signup don't show Navbar */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />

                    {/* All other pages show Navbar */}
                    <Route path="/*" element={
                        <>
                            <Navbar />
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/library" element={<Library />} />
                                <Route path="/lists" element={<Lists />} />
                                <Route path="/activity" element={<Activity />} />
                            </Routes>
                        </>
                    } />
                </Routes>
            </div>
        </BrowserRouter>
    )
}

export default App