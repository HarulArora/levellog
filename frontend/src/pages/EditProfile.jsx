import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

function EditProfile() {
    const { user, refreshUser } = useAuth()
    const navigate = useNavigate()

    const [username, setUsername] = useState(user?.username || '')
    const [bio, setBio] = useState(user?.bio || '')

    // Single source of truth for avatar - no more 3-way state split
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '')
    const [avatarData, setAvatarData] = useState(user?.avatar || '')   // what gets sent to server
    const [avatarMode, setAvatarMode] = useState('upload')
    const [avatarUrl, setAvatarUrl] = useState(
        user?.avatar?.startsWith('http') ? user.avatar : ''
    )
    const [urlError, setUrlError] = useState('')

    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')

    const fileInputRef = useRef(null)

    // ─── Avatar: File Upload ──────────────────────────────────────────────────

    const handleFileUpload = useCallback((e) => {
        const file = e.target.files[0]
        if (!file) return

        setError('')

        if (!file.type.startsWith('image/')) {
            setError('Please upload an image or GIF file')
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            setError('File must be under 2MB')
            return
        }

        const reader = new FileReader()
        reader.onload = (ev) => {
            const result = ev.target.result
            setAvatarData(result)
            setAvatarPreview(result)
        }
        reader.onerror = () => {
            setError('Failed to read file. Please try again.')
        }
        reader.readAsDataURL(file)

        // Reset input so same file can be re-selected
        e.target.value = ''
    }, [])

    // ─── Avatar: URL Mode ─────────────────────────────────────────────────────

    const handleUrlChange = useCallback((val) => {
        setAvatarUrl(val)
        setUrlError('')

        // Clear avatar data if URL is emptied
        if (!val.trim()) {
            setAvatarData('')
            setAvatarPreview('')
            return
        }

        // Optimistically show preview; validate on load/error
        setAvatarPreview(val.trim())
    }, [])

    const handleUrlImageLoad = useCallback(() => {
        // Image loaded successfully — commit the URL as the avatar data
        setAvatarData(avatarUrl.trim())
        setUrlError('')
    }, [avatarUrl])

    const handleUrlImageError = useCallback(() => {
        setUrlError('Could not load image from this URL')
        setAvatarData('')   // don't save a broken URL
    }, [])

    // ─── Remove Avatar ────────────────────────────────────────────────────────

    const removeAvatar = useCallback(() => {
        setAvatarData('')
        setAvatarPreview('')
        setAvatarUrl('')
        setUrlError('')
        setError('')
    }, [])

    // ─── Mode Switch ──────────────────────────────────────────────────────────

    const switchMode = useCallback((mode) => {
        setAvatarMode(mode)
        setUrlError('')
        setError('')
    }, [])

    // ─── Username Change ──────────────────────────────────────────────────────

    const handleUsernameChange = (val) => {
        // Only allow letters, numbers, and underscores
        if (val && !/^[a-zA-Z0-9_]*$/.test(val)) return
        setUsername(val)
    }

    // ─── Save ─────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        setError('')

        // Guard: URL mode with broken image
        if (avatarMode === 'url' && avatarUrl.trim() && !avatarData) {
            setError('Avatar URL is invalid or the image failed to load')
            return
        }

        setSaving(true)
        try {
            const res = await api.put('/auth/profile', {
                username: username.trim(),
                bio: bio.trim(),
                avatar: avatarData.trim(),
            })

            if (res.data.success) {
                // Wait for refreshUser to fully resolve before navigating
                try {
                    await refreshUser()
                } catch {
                    // refreshUser failing shouldn't block the success flow
                }
                setSaved(true)
                setTimeout(() => {
                    navigate(`/user/${res.data.user.username}`)
                }, 1200)
            } else {
                setError(res.data.message || 'Something went wrong')
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    // ─── Derived ──────────────────────────────────────────────────────────────

    const canSave = !saving && username.trim().length > 0 && !urlError

    return (
        <div className="min-h-screen flex items-start justify-center pt-16 px-4">
            <div className="w-full max-w-md">

                <div className="mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="font-mono text-xs text-[#7a7a90] hover:text-[#c8ff57]
                                   transition-colors mb-6 flex items-center gap-2"
                    >
                        ← BACK
                    </button>
                    <h1
                        className="font-black text-4xl text-white uppercase tracking-widest"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                        Edit Profile
                    </h1>
                    <p className="font-mono text-xs text-[#7a7a90] mt-1">
                        Update your public profile info
                    </p>
                </div>

                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6 flex flex-col gap-6">

                    {/* ── Avatar ── */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-3">
                            Profile Picture / GIF
                        </label>

                        <div className="flex items-center gap-4 mb-4">
                            <div className="relative flex-shrink-0">
                                {avatarPreview ? (
                                    <img
                                        src={avatarPreview}
                                        alt="preview"
                                        onLoad={avatarMode === 'url' ? handleUrlImageLoad : undefined}
                                        onError={avatarMode === 'url' ? handleUrlImageError : undefined}
                                        className="w-16 h-16 rounded-full object-cover ring-2 ring-[#c8ff57]/50"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-[#c8ff57]/15
                                                    border-2 border-[#2a2a35] flex items-center
                                                    justify-center font-black text-[#c8ff57]
                                                    uppercase text-xl">
                                        {user?.username?.[0] || '?'}
                                    </div>
                                )}
                                {avatarPreview && (
                                    <button
                                        onClick={removeAvatar}
                                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full
                                                   bg-[#ff5c5c] text-white text-[10px]
                                                   flex items-center justify-center
                                                   hover:bg-[#ff4040] transition-colors"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                            <div className="text-[#7a7a90] font-mono text-[10px] leading-relaxed">
                                Supports JPG, PNG, GIF<br />
                                Max 2MB · GIFs will animate
                            </div>
                        </div>

                        {/* Mode toggle */}
                        <div className="flex gap-2 mb-3">
                            {['upload', 'url'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => switchMode(mode)}
                                    className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase
                                               tracking-wider border transition-all
                                               ${avatarMode === mode
                                            ? 'bg-[#c8ff57]/15 text-[#c8ff57] border-[#c8ff57]/50'
                                            : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'}`}
                                >
                                    {mode === 'upload' ? '⬆ Upload File' : '🔗 Paste URL'}
                                </button>
                            ))}
                        </div>

                        {avatarMode === 'upload' ? (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,.gif"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-3 border border-dashed border-[#2a2a35]
                                               text-[#7a7a90] font-mono text-xs rounded
                                               hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all"
                                >
                                    Click to choose image or GIF
                                </button>
                            </>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    placeholder="https://example.com/avatar.gif"
                                    value={avatarUrl}
                                    onChange={e => handleUrlChange(e.target.value)}
                                    className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                               px-3 py-2.5 text-sm text-white font-mono
                                               focus:outline-none focus:border-[#c8ff57]
                                               placeholder:text-[#3a3a50] transition-colors"
                                />
                                {urlError && (
                                    <p className="font-mono text-[10px] text-[#ff5c5c] mt-1">
                                        {urlError}
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── Username ── */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="font-mono text-xs uppercase tracking-wider text-[#7a7a90]">
                                Username
                            </label>
                            <span className={`font-mono text-[10px] tabular-nums ${username.length >= 20
                                    ? 'text-[#ff5c5c]'
                                    : username.length >= 16
                                        ? 'text-[#ffaa57]'
                                        : 'text-[#3a3a50]'
                                }`}>
                                {username.length}/20
                            </span>
                        </div>
                        <input
                            type="text"
                            value={username}
                            onChange={e => handleUsernameChange(e.target.value)}
                            maxLength={20}
                            placeholder="Letters, numbers, underscore only"
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                       px-3 py-2.5 text-sm text-white
                                       focus:outline-none focus:border-[#c8ff57] transition-colors
                                       placeholder:text-[#3a3a50]"
                        />
                        <p className="font-mono text-[10px] text-[#3a3a50] mt-1">
                            a–z · A–Z · 0–9 · _ only &nbsp;·&nbsp; no spaces allowed
                        </p>
                    </div>

                    {/* ── Bio ── */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2">Bio</label>
                        <textarea
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            maxLength={200}
                            rows={3}
                            placeholder="Tell people about yourself..."
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                       px-3 py-2.5 text-sm text-white resize-none
                                       focus:outline-none focus:border-[#c8ff57]
                                       placeholder:text-[#3a3a50] transition-colors"
                        />
                        <div className="font-mono text-[10px] text-[#7a7a90] mt-1 text-right">
                            {bio.length}/200
                        </div>
                    </div>

                    {/* ── Error ── */}
                    {error && (
                        <div className="px-3 py-2.5 bg-[#ff5c5c]/10 border border-[#ff5c5c]/30
                                        rounded font-mono text-xs text-[#ff5c5c]">
                            {error}
                        </div>
                    )}

                    {/* ── Save Button ── */}
                    <button
                        onClick={handleSave}
                        disabled={!canSave}
                        className={`w-full py-3 font-bold text-sm rounded transition-all
                                   ${saved
                                ? 'bg-[#5c9fff] text-white'
                                : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e]'}
                                   disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                        {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
                    </button>

                </div>
            </div>
        </div>
    )
}

export default EditProfile