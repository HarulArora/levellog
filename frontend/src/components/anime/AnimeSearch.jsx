import { useState, useEffect, useRef } from 'react'
import api from '../../api/axios'

function AnimeSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const animeSubSection = window.location.pathname.startsWith('/manga') ? 'manga' : 'anime'

  const timerRef = useRef(null)

  const handleQueryChange = (e) => {
    const val = e.target.value
    setQuery(val)
    if (val.length >= 2) {
      setShowResults(true)
      setLoading(true)
    } else {
      setShowResults(false)
      setLoading(false)
      setResults([])
    }
  }

  useEffect(() => {
    if (query.length < 2) return

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/anime/search?q=${query}&type=${animeSubSection}`)
        setResults(res.data.results)
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timerRef.current)
  }, [query, animeSubSection])

  const handleSelect = (item) => {
    onSelect(item)
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  return (
    <div className="relative">
      <input
        id="anime-search-modal"
        name="anime-search-modal"
        type="text"
        placeholder={`Search for ${animeSubSection}...`}
        value={query}
        onChange={handleQueryChange}
        onFocus={() => { if (query.length >= 2) setShowResults(true) }}
        className="w-full bg-[#18181f] border border-[#c8ff57]/50 rounded
                   px-3 py-2 pr-28 text-sm text-white
                   focus:outline-none focus:border-[#c8ff57]
                   placeholder:text-[#7a7a90] transition-colors"
      />

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2
                        text-[#7a7a90] font-mono text-xs">
          searching...
        </div>
      )}

      {showResults && results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1
                bg-[#18181f] border border-[#2a2a35] rounded-lg
                overflow-y-auto z-50 shadow-2xl
                max-h-[300px]">
          {results.map(item => (
            <div
              key={item.externalId}
              onClick={() => handleSelect(item)}
              className="flex items-center gap-3 p-3 cursor-pointer
                         hover:bg-[#c8ff57]/05 transition-colors
                         border-b border-[#2a2a35] last:border-0"
            >
              {item.cover ? (
                <img
                  src={item.cover}
                  alt={item.title}
                  className="w-10 h-14 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-14 bg-[#2a2a35] rounded flex-shrink-0
                                flex items-center justify-center text-lg">
                  {animeSubSection === 'manga' ? '📖' : '📺'}
                </div>
              )}

              <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate text-white">
                      {item.title}
                  </div>
                <div className="font-mono text-[10px] text-[#7a7a90] mt-1">
                  {item.genres?.slice(0, 2).join(' · ')}
                  {item.year && ` · ${item.year}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AnimeSearch
