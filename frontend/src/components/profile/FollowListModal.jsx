import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'

const PAGE_SIZE = 10

function FollowListModal({ userId, type, onClose }) {

    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)

    useEffect(() => {
        const fetchList = async () => {
            try {
                const res = await api.get(`/auth/${type}/${userId}`)
                setUsers(res.data.users)
            } catch (err) {
                console.error('Follow list error:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchList()
    }, [userId, type])

    // Reset page when search changes
    useEffect(() => {
        setPage(1)
    }, [search])

    const filtered = useMemo(() => {
        if (!search.trim()) return users
        return users.filter(u =>
            u.username.toLowerCase().includes(search.trim().toLowerCase())
        )
    }, [users, search])

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm
                       flex items-center justify-center z-50 px-4"
            onClick={onClose}
        >
            <div
                className="bg-[#111118] border border-[#2a2a35] rounded-lg
                           w-full max-w-md max-h-[75vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[#2a2a35]">
                    <div>
                        <h3
                            className="font-black text-lg tracking-widest uppercase text-white"
                            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                            {type === 'followers' ? 'Followers' : 'Following'}
                        </h3>
                        {!loading && (
                            <p className="font-mono text-[10px] text-[#7a7a90] mt-0.5">
                                {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
                                {search && ` found for "${search}"`}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[#7a7a90] hover:text-white transition-colors text-xl"
                    >
                        ✕
                    </button>
                </div>

                {/* Search bar */}
                {!loading && users.length > 0 && (
                    <div className="px-4 pt-3 pb-2">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a7a90] text-xs">
                                🔍
                            </span>
                            <input
                                type="text"
                                placeholder="Search by username..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                           pl-8 pr-3 py-2 text-sm text-white
                                           focus:outline-none focus:border-[#c8ff57]
                                           placeholder:text-[#3a3a50] transition-colors
                                           font-mono"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7a90] hover:text-white transition-colors text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* List */}
                <div className="overflow-y-auto flex-1 px-4 pb-4 flex flex-col gap-2 mt-2">
                    {loading ? (
                        <div className="text-center py-8 text-[#7a7a90] font-mono text-sm">
                            Loading...
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-3xl mb-2">👥</div>
                            <div className="text-[#7a7a90] font-mono text-sm">
                                {type === 'followers' ? 'No followers yet' : 'Not following anyone'}
                            </div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-3xl mb-2">🔍</div>
                            <div className="text-[#7a7a90] font-mono text-sm">
                                No users found for "{search}"
                            </div>
                        </div>
                    ) : (
                        paginated.map(u => (
                            <Link
                                key={u._id}
                                to={`/user/${u.username}`}
                                onClick={onClose}
                                className="flex items-center gap-3 p-3 rounded-lg
                                           bg-[#18181f] border border-[#2a2a35]
                                           hover:border-[#c8ff57]/50 transition-all"
                            >
                                {u.avatar ? (
                                    <img
                                        src={u.avatar}
                                        alt={u.username}
                                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-1 ring-[#2a2a35]"
                                    />
                                ) : (
                                    <div
                                        className="w-10 h-10 rounded-full bg-gradient-to-br
                                                   from-[#c8ff57] to-[#5c9fff]
                                                   flex items-center justify-center
                                                   font-black text-sm text-black flex-shrink-0"
                                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                    >
                                        {u.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-semibold text-sm truncate">
                                        {u.username}
                                    </div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] mt-[2px]">
                                        {u.followerCount ?? 0} followers
                                        {u.isPrivate && ' · 🔒 Private'}
                                    </div>
                                </div>
                                <span className="text-[#7a7a90] text-sm">→</span>
                            </Link>
                        ))
                    )}
                </div>

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a2a35]">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="font-mono text-xs text-[#7a7a90] hover:text-[#c8ff57]
                                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors
                                       px-3 py-1.5 border border-[#2a2a35] rounded hover:border-[#c8ff57]
                                       disabled:hover:border-[#2a2a35] disabled:hover:text-[#7a7a90]"
                        >
                            ← Prev
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-7 h-7 rounded font-mono text-xs transition-all
                                               ${page === p
                                            ? 'bg-[#c8ff57] text-black font-bold'
                                            : 'text-[#7a7a90] hover:text-[#c8ff57] border border-[#2a2a35] hover:border-[#c8ff57]'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="font-mono text-xs text-[#7a7a90] hover:text-[#c8ff57]
                                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors
                                       px-3 py-1.5 border border-[#2a2a35] rounded hover:border-[#c8ff57]
                                       disabled:hover:border-[#2a2a35] disabled:hover:text-[#7a7a90]"
                        >
                            Next →
                        </button>
                    </div>
                )}

            </div>
        </div>
    )
}

export default FollowListModal