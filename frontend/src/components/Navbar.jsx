import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Navbar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    // user → null if not logged in, user object if logged in

    const links = [
        { name: 'HOME', path: '/' },
        { name: 'LIBRARY', path: '/library' },
        { name: 'LISTS', path: '/lists' },
        { name: 'ACTIVITY', path: '/activity' },
    ]

    const handleLogout = () => {
        logout()
        navigate('/')
    }

    return (
        <nav className="flex items-center justify-between px-10 py-4 border-b 
                    border-[#2a2a35] bg-[#0a0a0f]/90 backdrop-blur-md 
                    sticky top-0 z-50">

            {/* Logo */}
            <Link to="/">
                <div className="font-black text-3xl tracking-widest text-[#c8ff57]"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    LEVEL<span className="text-white">LOG</span>
                </div>
            </Link>

            {/* Links */}
            <ul className="flex gap-6 list-none">
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

            {/* Right side — show Login/Signup OR username/logout */}
            <div className="flex gap-3 items-center">
                {user ? (
                    // Logged in — show username and logout button
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
                    // Not logged in — show Login and Signup buttons
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

        </nav>
    )
}

export default Navbar
