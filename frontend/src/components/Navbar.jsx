import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useNotifications from '../hooks/useNotifications'

function Navbar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const { unreadCount, setUnreadCount } = useNotifications()
    const [menuOpen, setMenuOpen] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const dropdownRef = useRef(null)

    const links = [
        { name: 'HOME', path: '/' },
        { name: 'LIBRARY', path: '/library' },
        { name: 'LISTS', path: '/lists' },
        { name: 'FIND FRIENDS', path: '/search' },
    ]

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleLogout = () => {
        logout()
        navigate('/')
        setMenuOpen(false)
        setDropdownOpen(false)
    }

    const handleLinkClick = () => {
        setMenuOpen(false)
        setDropdownOpen(false)
    }

    const handleNotificationClick = () => {
        setUnreadCount(0)
        setMenuOpen(false)
        setDropdownOpen(false)
    }

    // Avatar — shows profile pic/gif if set, otherwise initials
    const Avatar = ({ size = 'md' }) => {
        const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs'
        if (user?.avatar) {
            return (
                <img
                    src={user.avatar}
                    alt={user.username}
                    className={`${dim} rounded-full object-cover ring-2 ring-[#2a2a35]
                                hover:ring-[#c8ff57] transition-all`}
                />
            )
        }
        return (
            <div className={`${dim} rounded-full bg-[#c8ff57]/15 border-2 border-[#2a2a35]
                             hover:border-[#c8ff57] transition-all flex items-center
                             justify-center font-black text-[#c8ff57] uppercase`}>
                {user?.username?.[0] || '?'}
            </div>
        )
    }

    return (
        <nav className="relative border-b border-[#2a2a35]
                        bg-[#0a0a0f]/90 backdrop-blur-md sticky top-0 z-50">

            <div className="flex items-center justify-between px-5 md:px-10 py-4">

                {/* Logo */}
                <Link to="/" onClick={handleLinkClick}>
                    <div className="font-black text-2xl md:text-3xl tracking-widest text-[#c8ff57]"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        LEVEL<span className="text-white">LOG</span>
                    </div>
                </Link>

                {/* Desktop links */}
                <ul className="hidden md:flex gap-6 list-none">
                    {links.map(link => (
                        <li key={link.path}>
                            <Link to={link.path}
                                className={`text-xs font-semibold tracking-widest uppercase transition-colors
                                           ${location.pathname === link.path
                                        ? 'text-[#c8ff57]'
                                        : 'text-[#7a7a90] hover:text-[#c8ff57]'}`}>
                                {link.name}
                            </Link>
                        </li>
                    ))}
                </ul>

                {/* Desktop right side */}
                <div className="hidden md:flex gap-3 items-center">
                    {user ? (
                        <>
                            {/* Notifications */}
                            <Link to="/notifications" onClick={handleNotificationClick}
                                className="relative">
                                <div className="text-[#7a7a90] hover:text-[#c8ff57] transition-colors text-lg">
                                    🔔
                                </div>
                                {unreadCount > 0 && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#ff5c5c]
                                                    rounded-full flex items-center justify-center
                                                    font-mono text-[9px] text-white font-bold">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </div>
                                )}
                            </Link>

                            {/* Profile avatar + dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button onClick={() => setDropdownOpen(o => !o)}
                                    className="flex items-center gap-2 focus:outline-none">
                                    <Avatar />
                                </button>

                                {dropdownOpen && (
                                    <div className="absolute right-0 top-[calc(100%+10px)] w-56
                                                    bg-[#111118] border border-[#2a2a35] rounded-lg
                                                    shadow-2xl overflow-hidden z-50">

                                        {/* User info */}
                                        <div className="px-4 py-3 border-b border-[#2a2a35]
                                                        flex items-center gap-3">
                                            <Avatar size="sm" />
                                            <div className="min-w-0">
                                                <div className="text-white font-semibold text-sm truncate">
                                                    {user.username}
                                                </div>
                                                <div className="font-mono text-[10px] text-[#7a7a90]">
                                                    {user.badge || '🎮'} Lv.{user.level || 1}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Menu items */}
                                        <div className="py-1">
                                            <Link to={`/user/${user.username}`}
                                                onClick={handleLinkClick}
                                                className="flex items-center gap-3 px-4 py-2.5
                                                           text-[#a0a0b8] hover:text-white
                                                           hover:bg-[#1a1a25] transition-all text-sm">
                                                <span className="text-base">👤</span>
                                                <span className="font-mono text-xs uppercase tracking-wider">
                                                    My Profile
                                                </span>
                                            </Link>

                                            <Link to="/stats"
                                                onClick={handleLinkClick}
                                                className="flex items-center gap-3 px-4 py-2.5
                                                           text-[#a0a0b8] hover:text-white
                                                           hover:bg-[#1a1a25] transition-all text-sm">
                                                <span className="text-base">📊</span>
                                                <span className="font-mono text-xs uppercase tracking-wider">
                                                    Stats
                                                </span>
                                            </Link>

                                            <Link to="/edit-profile"
                                                onClick={handleLinkClick}
                                                className="flex items-center gap-3 px-4 py-2.5
                                                           text-[#a0a0b8] hover:text-white
                                                           hover:bg-[#1a1a25] transition-all text-sm">
                                                <span className="text-base">✏️</span>
                                                <span className="font-mono text-xs uppercase tracking-wider">
                                                    Edit Profile
                                                </span>
                                            </Link>

                                            <div className="border-t border-[#2a2a35] my-1" />

                                            <button onClick={handleLogout}
                                                className="w-full flex items-center gap-3 px-4 py-2.5
                                                           text-[#ff5c5c] hover:bg-[#ff5c5c]/10
                                                           transition-all text-sm">
                                                <span className="text-base">🚪</span>
                                                <span className="font-mono text-xs uppercase tracking-wider">
                                                    Logout
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
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

                {/* Hamburger */}
                <button onClick={() => setMenuOpen(!menuOpen)}
                    className="md:hidden flex flex-col gap-[5px] p-2">
                    <span className={`block w-5 h-[2px] bg-white transition-all duration-200
                                     ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
                    <span className={`block w-5 h-[2px] bg-white transition-all duration-200
                                     ${menuOpen ? 'opacity-0' : ''}`} />
                    <span className={`block w-5 h-[2px] bg-white transition-all duration-200
                                     ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
                </button>

            </div>

            {/* Mobile menu */}
            {menuOpen && (
                <div className="md:hidden border-t border-[#2a2a35] bg-[#0a0a0f]
                                px-5 py-4 flex flex-col gap-4">

                    {links.map(link => (
                        <Link key={link.path} to={link.path} onClick={handleLinkClick}
                            className={`text-sm font-semibold tracking-widest uppercase
                                       ${location.pathname === link.path
                                    ? 'text-[#c8ff57]'
                                    : 'text-[#7a7a90]'}`}>
                            {link.name}
                        </Link>
                    ))}

                    {user && (
                        <Link to="/notifications" onClick={handleNotificationClick}
                            className="text-sm font-semibold tracking-widest uppercase
                                       text-[#7a7a90] flex items-center gap-2">
                            🔔 Notifications
                            {unreadCount > 0 && (
                                <span className="bg-[#ff5c5c] text-white rounded-full
                                                 px-2 text-[10px] font-bold">
                                    {unreadCount}
                                </span>
                            )}
                        </Link>
                    )}

                    <div className="border-t border-[#2a2a35]" />

                    {user ? (
                        <div className="flex flex-col gap-1">

                            {/* Mobile user info */}
                            <div className="flex items-center gap-3 py-2">
                                {user.avatar ? (
                                    <img src={user.avatar} alt={user.username}
                                        className="w-9 h-9 rounded-full object-cover
                                                   ring-2 ring-[#2a2a35]" />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-[#c8ff57]/15
                                                    border-2 border-[#2a2a35] flex items-center
                                                    justify-center font-black text-[#c8ff57]
                                                    uppercase text-xs">
                                        {user.username?.[0] || '?'}
                                    </div>
                                )}
                                <div>
                                    <div className="text-white font-semibold text-sm">
                                        {user.username}
                                    </div>
                                    <div className="font-mono text-[10px] text-[#7a7a90]">
                                        {user.badge || '🎮'} Lv.{user.level || 1}
                                    </div>
                                </div>
                            </div>

                            <Link to={`/user/${user.username}`} onClick={handleLinkClick}
                                className="flex items-center gap-3 py-2.5 text-[#a0a0b8]
                                           hover:text-white transition-colors">
                                <span>👤</span>
                                <span className="font-mono text-xs uppercase tracking-wider">My Profile</span>
                            </Link>

                            <Link to="/stats" onClick={handleLinkClick}
                                className="flex items-center gap-3 py-2.5 text-[#a0a0b8]
                                           hover:text-white transition-colors">
                                <span>📊</span>
                                <span className="font-mono text-xs uppercase tracking-wider">Stats</span>
                            </Link>

                            <Link to="/edit-profile" onClick={handleLinkClick}
                                className="flex items-center gap-3 py-2.5 text-[#a0a0b8]
                                           hover:text-white transition-colors">
                                <span>✏️</span>
                                <span className="font-mono text-xs uppercase tracking-wider">Edit Profile</span>
                            </Link>

                            <div className="border-t border-[#2a2a35] my-1" />

                            <button onClick={handleLogout}
                                className="flex items-center gap-3 py-2.5 text-[#ff5c5c]
                                           w-full transition-colors">
                                <span>🚪</span>
                                <span className="font-mono text-xs uppercase tracking-wider">Logout</span>
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