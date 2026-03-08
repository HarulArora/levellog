import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import useGames from '../hooks/useGames'

const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric'
  })
}

const activityConfig = {
  completed: {
    icon: '🏆',
    bg: 'bg-[#5c9fff]/15',
    getText: (a) => (
      <>
        Completed{' '}
        <span className="text-[#c8ff57] font-bold">{a.game.title}</span>
        {a.rating ? ` — rated it ${a.rating}/10` : ''}
      </>
    )
  },
  playing: {
    icon: '▶',
    bg: 'bg-[#c8ff57]/15',
    getText: (a) => (
      <>
        Started playing{' '}
        <span className="text-[#c8ff57] font-bold">{a.game.title}</span>
      </>
    )
  },
  rated: {
    icon: '⭐',
    bg: 'bg-[#ff9f5c]/15',
    getText: (a) => (
      <>
        Rated{' '}
        <span className="text-[#c8ff57] font-bold">{a.game.title}</span>
        {` ${a.rating}/10`}
      </>
    )
  },
  planned: {
    icon: '📋',
    bg: 'bg-[#2a2a35]',
    getText: (a) => (
      <>
        Added{' '}
        <span className="text-[#c8ff57] font-bold">{a.game.title}</span>
        {' to planned list'}
      </>
    )
  },
  dropped: {
    icon: '✕',
    bg: 'bg-[#ff5c5c]/15',
    getText: (a) => (
      <>
        Dropped{' '}
        <span className="text-[#c8ff57] font-bold">{a.game.title}</span>
        {a.hours ? ` after ${a.hours}h` : ''}
      </>
    )
  },
  paused: {
    icon: '⏸',
    bg: 'bg-[#c45cff]/15',
    getText: (a) => (
      <>
        Paused{' '}
        <span className="text-[#c8ff57] font-bold">{a.game.title}</span>
      </>
    )
  }
}

function Activity() {

  const { user } = useAuth()
  const { games: myGames } = useGames()
  const [activity, setActivity] = useState([])
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('mine')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const fetchAll = async () => {
      setLoading(true)
      try {
        const [activityRes, feedRes] = await Promise.all([
          api.get(`/games/activity/${user.id || user._id}`),
          api.get('/auth/feed')
        ])
        setActivity(activityRes.data.activity)
        setFeed(feedRes.data.games)
      } catch (err) {
        console.error('Activity error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [user])

  const statusConfig = {
    playing:   { color: 'text-[#c8ff57]', bg: 'bg-[#c8ff57]/15', label: 'Playing'   },
    completed: { color: 'text-[#5c9fff]', bg: 'bg-[#5c9fff]/15', label: 'Completed' },
    planned:   { color: 'text-[#ff9f5c]', bg: 'bg-[#ff9f5c]/15', label: 'Planned'   },
    dropped:   { color: 'text-[#ff5c5c]', bg: 'bg-[#ff5c5c]/15', label: 'Dropped'   },
    paused:    { color: 'text-[#c45cff]', bg: 'bg-[#c45cff]/15', label: 'Paused'    },
  }

  // ── Find my rating for a game by title ──
  const getMyRating = (gameTitle) => {
    const match = myGames.find(
      g => g.title.toLowerCase() === gameTitle.toLowerCase()
    )
    return match?.rating > 0 ? match.rating : null
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-5xl">🎮</div>
        <div
          className="text-white font-black text-2xl tracking-widest uppercase"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          Login to see activity
        </div>
        <Link to="/login">
          <button className="px-6 py-3 bg-[#c8ff57] text-black font-bold
                             text-sm rounded hover:bg-[#d4ff6e] transition-all">
            Login
          </button>
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-[#7a7a90] font-mono text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-10 py-8 md:py-10">

      {/* Header */}
      <div className="flex items-baseline gap-4 mb-6 pb-4 border-b border-[#2a2a35]">
        <h2
          className="font-black text-2xl md:text-3xl tracking-widest uppercase text-white"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          Activity
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('mine')}
          className={`px-4 py-2 rounded font-mono text-xs uppercase
                     tracking-wider border transition-all
                     ${activeTab === 'mine'
                       ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/06'
                       : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'
                     }`}
        >
          My Activity
        </button>
        <button
          onClick={() => setActiveTab('feed')}
          className={`px-4 py-2 rounded font-mono text-xs uppercase
                     tracking-wider border transition-all
                     ${activeTab === 'feed'
                       ? 'border-[#c8ff57] text-[#c8ff57] bg-[#c8ff57]/06'
                       : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'
                     }`}
        >
          Following Feed
        </button>
      </div>

      {/* ── My Activity Tab ── */}
      {activeTab === 'mine' && (
        <>
          {activity.length > 0 ? (
            <div className="flex flex-col divide-y divide-[#2a2a35]
                            border border-[#2a2a35] rounded-lg overflow-hidden">
              {activity.map((item, index) => {
                const config = activityConfig[item.type] || activityConfig.planned
                return (
                  <div
                    key={index}
                    className="flex items-center gap-4 px-5 py-4 bg-[#111118]
                               hover:bg-[#18181f] transition-all"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center
                                     justify-center text-sm flex-shrink-0
                                     ${config.bg}`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 text-sm text-[#7a7a90]">
                      {config.getText(item)}
                    </div>
                    <div className="font-mono text-[10px] text-[#7a7a90] flex-shrink-0">
                      {timeAgo(item.time)}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🎮</div>
              <div className="text-[#7a7a90] font-mono text-sm">
                No activity yet. Start logging games!
              </div>
              <Link to="/library">
                <button className="mt-4 px-5 py-2 bg-[#c8ff57] text-black
                                   font-bold text-sm rounded
                                   hover:bg-[#d4ff6e] transition-all">
                  + Log a Game
                </button>
              </Link>
            </div>
          )}
        </>
      )}

      {/* ── Following Feed Tab ── */}
      {activeTab === 'feed' && (
        <>
          {feed.length > 0 ? (
            <div className="flex flex-col gap-3">
              {feed.map(game => {
                const sc = statusConfig[game.status] || statusConfig.planned
                const imageUrl = game.cover
                  ? game.cover
                  : game.steamId
                    ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamId}/header.jpg`
                    : null

                const myRating = getMyRating(game.title)

                return (
                  <div
                    key={game._id}
                    className="bg-[#111118] border border-[#2a2a35] rounded-lg
                               overflow-hidden hover:border-[#c8ff57]/30 transition-all"
                  >
                    <div className="flex items-center gap-4 p-4">

                      {/* Cover */}
                      <div
                        className="w-16 h-12 bg-cover bg-center bg-[#18181f]
                                   rounded flex-shrink-0"
                        style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'none' }}
                      >
                        {!imageUrl && (
                          <div className="w-full h-full flex items-center
                                          justify-center text-xl">🎮</div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-semibold text-sm truncate mb-1">
                          {game.title}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-mono text-[9px] uppercase
                                           tracking-wider px-2 py-[2px]
                                           rounded-sm ${sc.bg} ${sc.color}`}>
                            {sc.label}
                          </span>
                          {game.userId?.username && (
                            <span className="font-mono text-[10px] text-[#7a7a90]">
                              by{' '}
                              <Link
                                to={`/user/${game.userId.username}`}
                                className="text-[#7a7a90] hover:text-[#c8ff57]
                                           transition-colors"
                              >
                                {game.userId.username}
                              </Link>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ratings column */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">

                        {/* Friend's rating — BLUE */}
                        {game.rating > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[9px] text-[#7a7a90]
                                             uppercase tracking-wider">
                              {game.userId?.username
                                ? `${game.userId.username}'s`
                                : "friend's"}
                            </span>
                            <div
                              className="font-black text-xl text-[#5c9fff]"
                              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                              {game.rating}
                              <small className="font-mono text-[9px] text-[#7a7a90] font-normal">
                                /10
                              </small>
                            </div>
                          </div>
                        )}

                        {/* My rating — GREEN */}
                        {myRating ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[9px] text-[#7a7a90]
                                             uppercase tracking-wider">
                              my rating
                            </span>
                            <div
                              className="font-black text-xl text-[#c8ff57]"
                              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                              {myRating}
                              <small className="font-mono text-[9px] text-[#7a7a90] font-normal">
                                /10
                              </small>
                            </div>
                          </div>
                        ) : (
                          <div className="font-mono text-[9px] text-[#2a2a35]
                                          uppercase tracking-wider">
                            not rated
                          </div>
                        )}

                      </div>

                      {/* Date */}
                      <div className="font-mono text-[10px] text-[#7a7a90]
                                     flex-shrink-0 hidden sm:block ml-2">
                        {new Date(game.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric'
                        })}
                      </div>

                    </div>

                    {/* Comparison bars — only if both rated */}
                    {game.rating > 0 && myRating && (
                      <div className="px-4 pb-3 flex flex-col gap-1">

                        {/* Friend bar — BLUE */}
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-[#7a7a90] w-14 text-right truncate">
                            {game.userId?.username?.slice(0, 8) || 'friend'}
                          </span>
                          <div className="flex-1 relative h-1.5 bg-[#2a2a35] rounded-full">
                            <div
                              className="absolute left-0 top-0 h-full rounded-full bg-[#5c9fff]"
                              style={{ width: `${(game.rating / 10) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-[9px] text-[#5c9fff] w-4 text-right">
                            {game.rating}
                          </span>
                        </div>

                        {/* My bar — GREEN */}
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-[#7a7a90] w-14 text-right">
                            you
                          </span>
                          <div className="flex-1 relative h-1.5 bg-[#2a2a35] rounded-full">
                            <div
                              className="absolute left-0 top-0 h-full rounded-full bg-[#c8ff57]"
                              style={{ width: `${(myRating / 10) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-[9px] text-[#c8ff57] w-4 text-right">
                            {myRating}
                          </span>
                        </div>

                      </div>
                    )}

                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="text-5xl">👾</div>
              <div
                className="text-white font-black text-xl tracking-widest uppercase"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                No Activity Yet
              </div>
              <div className="text-[#7a7a90] font-mono text-sm text-center max-w-sm">
                Follow other gamers to see their games here
              </div>
              <Link to="/search">
                <button className="px-6 py-3 bg-[#c8ff57] text-black font-bold
                                   text-sm rounded hover:bg-[#d4ff6e] transition-all">
                  Find Friends
                </button>
              </Link>
            </div>
          )}
        </>
      )}

    </div>
  )
}

export default Activity
