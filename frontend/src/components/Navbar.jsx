import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useNotifications from '../hooks/useNotifications'
import { Bell, User, Search, LogOut, ChevronDown, UserSearch, Tags } from 'lucide-react'
import { useDeals } from '../context/DealsContext'
import Avatar from './ui/Avatar'

import Logo from '../assets/logo.svg'

function Navbar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, logout, loading } = useAuth()
    const { unreadCount, setUnreadCount } = useNotifications()
    const [menuOpen, setMenuOpen] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const { newDealsCount, clearNewDealsCount } = useDeals()
    const dropdownRef = useRef(null)

    const links = [
        { name: 'HOME', path: '/' },
        { name: 'DISCOVER', path: '/discover' },
        { name: 'DEALS🔥', path: '/deals' },
        { name: 'LIBRARY', path: '/library' },
        { name: 'LISTS', path: '/lists' },
    ]

    // Listen for new deals from Deals page
    // Handle menu clicks outside

    // Clear badge when visiting /deals
    useEffect(() => {
        if (location.pathname === '/deals') clearNewDealsCount()
    }, [location.pathname, clearNewDealsCount])

    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target))
                setDropdownOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleLogout = async () => {
        try {
            await logout()
            navigate('/')
        } catch (err) {
            console.error('Logout error:', err)
        } finally {
            setMenuOpen(false)
            setDropdownOpen(false)
        }
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

    const handleDealsClick = () => {
        clearNewDealsCount()
        setMenuOpen(false)
        setDropdownOpen(false)
    }

    return (
        <nav className="relative border-b border-[#2a2a35] bg-[#0a0a0f]/90 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center justify-between px-5 md:px-10 py-4">

                {/* Logo */}
                <Link to="/" onClick={handleLinkClick}>
                    <div className="flex items-center gap-1 md:gap-1 group">
                        <img 
                            src={Logo} 
                            alt="QuestDuck" 
                            className="w-10 h-10 md:w-12 md:h-12 object-contain transition-transform group-hover:scale-110 duration-300" 
                        />
                        <div className="font-black text-2xl md:text-3xl tracking-widest text-[#c8ff57]"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            QUEST<span className="text-white">DUCK</span>
                        </div>
                    </div>
                </Link>

                {/* Desktop links */}
                <ul className="hidden md:flex gap-6 list-none">
                    {links.map(link => {
                        const isDeals = link.path === '/deals'
                        const isActive = location.pathname === link.path
                        return (
                            <li key={link.path} className="relative">
                                <Link
                                    to={link.path}
                                    onClick={isDeals ? handleDealsClick : handleLinkClick}
                                    className={`text-xs font-semibold tracking-widest uppercase transition-colors
                                               ${isActive ? 'text-[#c8ff57]' : 'text-[#7a7a90] hover:text-[#c8ff57]'}`}
                                >
                                    {link.name}
                                </Link>
                                {/* Deals new-deals badge */}
                                {isDeals && newDealsCount > 0 && (
                                    <div className="absolute -top-2 -right-3 w-4 h-4 bg-[#c8ff57] rounded-full flex items-center justify-center font-mono text-[9px] text-black font-bold pointer-events-none">
                                        {newDealsCount > 9 ? '9+' : newDealsCount}
                                    </div>
                                )}
                            </li>
                        )
                    })}
                </ul>

                {/* Desktop right */}
                <div className="hidden md:flex gap-3 items-center min-w-[120px] justify-end">
                    {!loading && (
                        user ? (
                            <>
                                {/* Notifications */}
                                <Link to="/notifications" onClick={handleNotificationClick} className="relative p-2 hover:bg-[#c8ff57]/10 rounded-full transition-all group">
                                    <Bell size={20} className="text-[#7a7a90] group-hover:text-[#c8ff57] transition-colors" />
                                    {unreadCount > 0 && (
                                        <div className="absolute top-1 right-1 w-4 h-4 bg-[#ff5c5c] rounded-full flex items-center justify-center font-mono text-[9px] text-white font-bold ring-2 ring-[#0a0a0f]">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </div>
                                    )}
                                </Link>

                                {/* Avatar dropdown */}
                                <div className="relative" ref={dropdownRef}>
                                    <button onClick={() => setDropdownOpen(o => !o)} className="flex items-center gap-1.5 focus:outline-none p-1 pr-2 hover:bg-[#2a2a35]/30 rounded-full transition-all border border-transparent hover:border-[#2a2a35]">
                                        <Avatar />
                                        <ChevronDown size={14} className={`text-[#7a7a90] transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {dropdownOpen && (
                                        <div className="absolute right-0 top-[calc(100%+10px)] w-52 bg-[#111118] border border-[#2a2a35] rounded-lg shadow-2xl overflow-hidden z-50">

                                            {/* User info */}
                                            <div className="px-4 py-4 border-b border-[#2a2a35] bg-[#1a1a25]/30">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <Avatar size="sm" />
                                                    <div className="min-w-0">
                                                        <div className="text-white font-bold text-sm truncate tracking-tight">{user.username}</div>
                                                        <div className="text-[10px] text-[#7a7a90] truncate opacity-60">@{user.username.toLowerCase()}</div>
                                                    </div>
                                                </div>
                                                <Link to="/stats?tab=xp" onClick={handleLinkClick} className="flex items-center gap-1.5 bg-[#0a0a0f]/60 rounded-full px-2.5 py-1 border border-[#2a2a35] w-fit shadow-inner shadow-black/60 translate-y-[1px] hover:border-[#c8ff57]/50 transition-colors group/lv">
                                                    <span className="flex items-center justify-center text-xs leading-none relative -top-[2px] flex-shrink-0">{user.badge || '🎮'}</span>
                                                    <span className="font-mono text-[10px] text-[#c8ff57] uppercase font-black tracking-widest whitespace-nowrap leading-none pt-[1px] group-hover/lv:underline">Lv.{user.level || 1}</span>
                                                </Link>
                                            </div>

                                            {/* Dropdown Menu Links... (same as original) */}
                                            <div className="py-1">
                                                <Link to={`/user/${user.username}`} onClick={handleLinkClick}
                                                    className="flex items-center gap-3 px-4 py-2.5 text-[#a0a0b8] hover:text-white hover:bg-[#1a1a25] transition-all text-[11px] font-bold uppercase tracking-wider">
                                                    <User size={14} className="opacity-70" />
                                                    <span>My Profile</span>
                                                </Link>

                                                <Link to="/search" onClick={handleLinkClick}
                                                    className="flex items-center gap-3 px-4 py-2.5 text-[#a0a0b8] hover:text-white hover:bg-[#1a1a25] transition-all text-[11px] font-bold uppercase tracking-wider">
                                                    <Search size={14} className="opacity-70" strokeWidth={2.5} />
                                                    <span>Find Friends</span>
                                                </Link>

                                                <div className="border-t border-[#2a2a35] my-1" />

                                                <button onClick={handleLogout}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[#ff5c5c] hover:bg-[#ff5c5c]/10 transition-all text-[11px] font-bold uppercase tracking-wider">
                                                    <LogOut size={14} className="opacity-70" />
                                                    <span>Logout</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <Link to="/login">
                                    <button className="px-4 py-2 text-sm font-semibold border border-[#2a2a35] text-white rounded hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">
                                        Login
                                    </button>
                                </Link>
                                <Link to="/signup">
                                    <button className="px-4 py-2 text-sm font-semibold bg-[#c8ff57] text-black rounded hover:bg-[#d4ff6e] transition-all">
                                        Sign Up
                                    </button>
                                </Link>
                            </>
                        )
                    )}
                </div>

                {/* Hamburger */}
                <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden flex flex-col gap-[5px] p-2">
                    <span className={`block w-5 h-[2px] bg-white transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
                    <span className={`block w-5 h-[2px] bg-white transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
                    <span className={`block w-5 h-[2px] bg-white transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
                </button>
            </div>

            {/* Mobile menu */}
            {menuOpen && (
                <div className="md:hidden border-t border-[#2a2a35] bg-[#0a0a0f] px-5 py-4 flex flex-col gap-4">

                    {links.map(link => {
                        const isDeals = link.path === '/deals'
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                onClick={isDeals ? handleDealsClick : handleLinkClick}
                                className={`text-sm font-semibold tracking-widest uppercase flex items-center gap-2
                                           ${location.pathname === link.path ? 'text-[#c8ff57]' : 'text-[#7a7a90]'}`}
                            >
                                {link.name}
                                {isDeals && newDealsCount > 0 && (
                                    <span className="bg-[#c8ff57] text-black rounded-full px-2 text-[9px] font-bold font-mono">
                                        {newDealsCount > 9 ? '9+' : newDealsCount}
                                    </span>
                                )}
                            </Link>
                        )
                    })}

                    {user && (
                        <Link to="/notifications" onClick={handleNotificationClick}
                            className="text-sm font-semibold tracking-widest uppercase text-[#7a7a90] flex items-center gap-3 py-1">
                            <Bell size={18} />
                            <span>Notifications</span>
                            {unreadCount > 0 && (
                                <span className="bg-[#ff5c5c] text-white rounded-full px-2 text-[10px] font-bold">
                                    {unreadCount}
                                </span>
                            )}
                        </Link>
                    )}

                    <div className="border-t border-[#2a2a35]" />

                    {!loading && (
                        user ? (
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-3 py-2">
                                    {user.avatar ? (
                                        <img src={user.avatar} alt={user.username} className="w-9 h-9 rounded-full object-cover ring-2 ring-[#2a2a35]" />
                                    ) : (
                                        <div className="w-9 h-9 rounded-full bg-[#c8ff57]/15 border-2 border-[#2a2a35] flex items-center justify-center font-black text-[#c8ff57] uppercase text-xs">
                                            {user.username?.[0] || '?'}
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-white font-bold text-sm tracking-tight">{user.username}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Link to="/stats?tab=xp" onClick={handleLinkClick} className="flex items-center gap-1.5 bg-[#111118] rounded-full px-2 py-0.5 border border-[#2a2a35] shadow-sm shadow-black/40 hover:border-[#c8ff57]/50 transition-colors group/mlv">
                                                <span className="flex items-center justify-center text-[10px] leading-none relative -top-[1.8px]">{user.badge || '🎮'}</span>
                                                <span className="font-mono text-[9px] text-[#c8ff57] uppercase font-black tracking-widest leading-none group-hover/mlv:underline">Lv.{user.level || 1}</span>
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                <Link to={`/user/${user.username}`} onClick={handleLinkClick}
                                    className="flex items-center gap-3 py-3 text-[#a0a0b8] hover:text-white transition-colors text-xs font-bold uppercase tracking-wider">
                                    <User size={16} />
                                    <span>My Profile</span>
                                </Link>

                                <Link to="/search" onClick={handleLinkClick}
                                    className="flex items-center gap-3 py-3 text-[#a0a0b8] hover:text-white transition-colors text-xs font-bold uppercase tracking-wider">
                                    <Search size={16} strokeWidth={3} />
                                    <span>Find Friends</span>
                                </Link>

                                <div className="border-t border-[#2a2a35] my-1" />

                                <button onClick={handleLogout}
                                    className="flex items-center gap-3 py-3 text-[#ff5c5c] w-full transition-colors text-xs font-bold uppercase tracking-wider">
                                    <LogOut size={16} />
                                    <span>Logout</span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <Link to="/login" onClick={handleLinkClick}>
                                    <button className="w-full py-2 text-sm font-semibold border border-[#2a2a35] text-white rounded transition-all">Login</button>
                                </Link>
                                <Link to="/signup" onClick={handleLinkClick}>
                                    <button className="w-full py-2 text-sm font-semibold bg-[#c8ff57] text-black rounded transition-all">Sign Up</button>
                                </Link>
                            </div>
                        )
                    )}
                </div>
            )}
        </nav>
    )
}

export default Navbar