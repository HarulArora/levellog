import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'

function FollowListModal({ userId, type, onClose }) {

    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)

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

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm
                 flex items-center justify-center z-50 px-4"
            onClick={onClose}
        >
            <div
                className="bg-[#111118] border border-[#2a2a35] rounded-lg
                   w-full max-w-md max-h-[70vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5
                        border-b border-[#2a2a35]">
                    <h3
                        className="font-black text-lg tracking-widest uppercase text-white"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                        {type === 'followers' ? 'Followers' : 'Following'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-[#7a7a90] hover:text-white transition-colors text-xl"
                    >
                        ✕
                    </button>
                </div>

                {/* List */}
                <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
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
                    ) : (
                        users.map(u => (
                            <Link
                                key={u._id}
                                to={`/user/${u.username}`}
                                onClick={onClose}
                                className="flex items-center gap-3 p-3 rounded-lg
                           bg-[#18181f] border border-[#2a2a35]
                           hover:border-[#c8ff57]/50 transition-all"
                            >
                                <div
                                    className="w-10 h-10 rounded-full bg-gradient-to-br
                              from-[#c8ff57] to-[#5c9fff]
                              flex items-center justify-center
                              font-black text-sm text-black flex-shrink-0"
                                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                                >
                                    {u.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-semibold text-sm truncate">
                                        {u.username}
                                    </div>
                                    <div className="font-mono text-[10px] text-[#7a7a90] mt-[2px]">
                                        {u.followers?.length || 0} followers
                                        {u.isPrivate && ' · 🔒 Private'}
                                    </div>
                                </div>
                                <span className="text-[#7a7a90] text-sm">→</span>
                            </Link>
                        ))
                    )}
                </div>

            </div>
        </div>
    )
}

export default FollowListModal