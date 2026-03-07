// Navbar.jsx
// Updated with mobile hamburger menu

import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Navbar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, logout } = useAuth()

    // Controls whether mobile menu is open or closed
    const [menuOpen, setMenuOpen] = useState(false)

    const links = [
        { name: 'HOME', path: '/' },
        { name: 'LIBRARY', path: '/library' },
        { name: 'STATS', path: '/stats' },  
        { name: 'LISTS', path: '/lists' },
        { name: 'ACTIVITY', path: '/activity' },
    ]

    const handleLogout = () => {
        logout()
        navigate('/')
        setMenuOpen(false)
    }

    const handleLinkClick = () => {
        // Close menu when a link is clicked
        setMenuOpen(false)
    }

    return (
        // relative → needed so mobile menu can position below navbar
        <nav className="relative border-b border-[#2a2a35] 
                    bg-[#0a0a0f]/90 backdrop-blur-md sticky top-0 z-50">

            {/* ── Main navbar row ── */}
            <div className="flex items-center justify-between px-5 md:px-10 py-4">

                {/* Logo */}
                <Link to="/" onClick={handleLinkClick}>
                    <div className="font-black text-2xl md:text-3xl tracking-widest text-[#c8ff57]"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        LEVEL<span className="text-white">LOG</span>
                    </div>
                </Link>

                {/* Desktop links — hidden on mobile */}
                <ul className="hidden md:flex gap-6 list-none">
                    {links.map(link => (
                        <li key={link.path}>
                            <Link
                                to={link.path}
                                className={`text-xs font-semibold tracking-widest uppercase transition-colors
                  ${location.pathname === link.path
                                        ? 'text-[#c8ff57]'
                                        : 'text-[#7a7a90] hover:text-[#c8ff57]'
                                    }`}
                            >
                                {link.name}
                            </Link>
                        </li>
                    ))}
                </ul>

                {/* Desktop auth buttons — hidden on mobile */}
                <div className="hidden md:flex gap-3 items-center">
                    {user ? (
                        <>
                            <span className="font-mono text-xs text-[#7a7a90]">
                                👾 {user.username}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 text-sm font-semibold border border-[#2a2a35]
                           text-[#7a7a90] rounded hover:border-[#ff5c5c]
                           hover:text-[#ff5c5c] transition-all"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login">
                                <button className="px-4 py-2 text-sm font-semibold border border-[#2a2a35]
                                   text-white rounded hover:border-[#c8ff57]
                                   hover:text-[#c8ff57] transition-all">
                                    Login
                                </button>
                            </Link>
                            <Link to="/signup">
                                <button className="px-4 py-2 text-sm font-semibold bg-[#c8ff57]
                                   text-black rounded hover:bg-[#d4ff6e] transition-all">
                                    Sign Up
                                </button>
                            </Link>
                        </>
                    )}
                </div>

                {/* Hamburger button — only visible on mobile */}
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="md:hidden flex flex-col gap-[5px] p-2"
                >
                    {/* Three lines of hamburger */}
                    {/* When menu is open → show X */}
                    <span className={`block w-5 h-[2px] bg-white transition-all duration-200
                           ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
                    <span className={`block w-5 h-[2px] bg-white transition-all duration-200
                           ${menuOpen ? 'opacity-0' : ''}`} />
                    <span className={`block w-5 h-[2px] bg-white transition-all duration-200
                           ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
                </button>

            </div>

            {/* ── Mobile menu — drops down when hamburger clicked ── */}
            {menuOpen && (
                <div className="md:hidden border-t border-[#2a2a35] bg-[#0a0a0f]
                        px-5 py-4 flex flex-col gap-4">

                    {/* Mobile links */}
                    {links.map(link => (
                        <Link
                            key={link.path}
                            to={link.path}
                            onClick={handleLinkClick}
                            className={`text-sm font-semibold tracking-widest uppercase
                ${location.pathname === link.path
                                    ? 'text-[#c8ff57]'
                                    : 'text-[#7a7a90]'
                                }`}
                        >
                            {link.name}
                        </Link>
                    ))}

                    {/* Divider */}
                    <div className="border-t border-[#2a2a35]" />

                    {/* Mobile auth */}
                    {user ? (
                        <div className="flex flex-col gap-3">
                            <span className="font-mono text-xs text-[#7a7a90]">
                                👾 {user.username}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="w-full py-2 text-sm font-semibold border border-[#ff5c5c]/30
                           text-[#ff5c5c] rounded transition-all"
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <Link to="/login" onClick={handleLinkClick}>
                                <button className="w-full py-2 text-sm font-semibold border border-[#2a2a35]
                                   text-white rounded transition-all">
                                    Login
                                </button>
                            </Link>
                            <Link to="/signup" onClick={handleLinkClick}>
                                <button className="w-full py-2 text-sm font-semibold bg-[#c8ff57]
                                   text-black rounded transition-all">
                                    Sign Up
                                </button>
                            </Link>
                        </div>
                    )}

                </div>
            )}

        </nav>
    )
}

export default Navbar