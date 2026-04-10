import { useState, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGoogleLogin } from '@react-oauth/google'
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
    const [googleSuccess, setGoogleSuccess] = useState('')
    const [passwordData, setPasswordData] = useState({
        current: '',
        new: '',
        confirm: ''
    })
    const [passwordLoading, setPasswordLoading] = useState(false)
    const [passwordSuccess, setPasswordSuccess] = useState('')
    const [error, setError] = useState('')
    const [googleLoading, setGoogleLoading] = useState(false)
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const [confirmInput, setConfirmInput] = useState('')
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    })

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

    // ─── Google Linking ──────────────────────────────────────────────────
    const { linkGoogle, unlinkGoogle } = useAuth()

    const handleGoogleLink = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setGoogleLoading(true)
            setError('')
            const res = await linkGoogle(tokenResponse.access_token)
            setGoogleLoading(false)
            if (res.success) {
                setGoogleSuccess('Linked successfully!')
                setTimeout(() => setGoogleSuccess(''), 3000)
            } else {
                setError(res.message)
            }
        },
        onError: () => setError('Google Link Failed')
    })

    const handleGoogleUnlink = async () => {
        setIsConfirmModalOpen(true)
    }

    const confirmGoogleUnlink = async () => {
        if (confirmInput !== user.username) return
        
        setGoogleLoading(true)
        const res = await unlinkGoogle()
        setGoogleLoading(false)
        setIsConfirmModalOpen(false)
        setConfirmInput('')

        if (res.success) {
            setGoogleSuccess('Unlinked successfully!')
            setTimeout(() => setGoogleSuccess(''), 3000)
        } else {
            setError(res.message)
        }
    }

    // ─── Password Management ─────────────────────────────────────────────
    const { setPassword, changePassword } = useAuth()

    const handleSetPassword = async (e) => {
        e.preventDefault()
        if (passwordData.new.length < 6) return setError('Password must be at least 6 characters')
        if (passwordData.new !== passwordData.confirm) return setError('Passwords do not match')

        setPasswordLoading(true)
        setError('')
        const res = await setPassword(passwordData.new)
        setPasswordLoading(false)
        if (res.success) {
            setPasswordSuccess('Password set successfully!')
            setPasswordData({ current: '', new: '', confirm: '' })
            setTimeout(() => setPasswordSuccess(''), 3000)
        } else {
            setError(res.message)
        }
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        if (passwordData.new.length < 6) return setError('New password must be at least 6 characters')
        if (passwordData.new !== passwordData.confirm) return setError('Passwords do not match')

        setPasswordLoading(true)
        setError('')
        const res = await changePassword(passwordData.current, passwordData.new)
        setPasswordLoading(false)
        if (res.success) {
            setPasswordSuccess('Password changed successfully!')
            setPasswordData({ current: '', new: '', confirm: '' })
            setTimeout(() => setPasswordSuccess(''), 3000)
        } else {
            setError(res.message)
        }
    }

    // ─── Save ─────────────────────────────────────────────────────────────────

    const handleSave = async (e) => {
        if (e) e.preventDefault()
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
                            <span className={`font-mono text-[10px] tabular-nums ${username.length >= 12
                                    ? 'text-[#ff5c5c]'
                                    : username.length >= 10
                                        ? 'text-[#ffaa57]'
                                        : 'text-[#3a3a50]'
                                }`}>
                                {username.length}/12
                            </span>
                        </div>
                        <input
                            type="text"
                            value={username}
                            onChange={e => handleUsernameChange(e.target.value)}
                            maxLength={12}
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
                            maxLength={150}
                            rows={3}
                            placeholder="Tell people about yourself..."
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                       px-3 py-2.5 text-sm text-white resize-none
                                       focus:outline-none focus:border-[#c8ff57]
                                       placeholder:text-[#3a3a50] transition-colors"
                        />
                        <div className={`font-mono text-[10px] mt-1 text-right tabular-nums ${bio.length >= 150
                                ? 'text-[#ff5c5c]'
                                : bio.length >= 135
                                    ? 'text-[#ffaa57]'
                                    : 'text-[#7a7a90]'
                            }`}>
                            {bio.length}/150
                        </div>
                    </div>

                    {/* ── Connected Accounts ── */}
                    <div className="pt-4 border-t border-[#2a2a35]">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-4">
                            Connected Accounts
                        </label>
                        
                        <div className="flex items-center justify-between p-3 bg-[#18181f] border border-[#2a2a35] rounded">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-full">
                                    <svg width="16" height="16" viewBox="0 0 18 18">
                                        <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" />
                                        <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" />
                                        <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z" />
                                        <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.31z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-white text-xs font-bold">Google</p>
                                    <p className="text-[#7a7a90] text-[10px] font-mono">
                                        {user?.googleId ? 'Connected' : 'Not linked'}
                                    </p>
                                </div>
                            </div>

                            {user?.googleId ? (
                                <button
                                    onClick={handleGoogleUnlink}
                                    disabled={googleLoading}
                                    className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider
                                               border border-[#ff5c5c]/30 text-[#ff5c5c] rounded
                                               hover:bg-[#ff5c5c]/10 transition-colors
                                               disabled:opacity-50"
                                >
                                    Disconnect
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleGoogleLink()}
                                    disabled={googleLoading}
                                    className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider
                                               border border-[#c8ff57]/30 text-[#c8ff57] rounded
                                               hover:bg-[#c8ff57]/10 transition-colors
                                               disabled:opacity-50"
                                >
                                    {googleLoading ? 'Linking...' : 'Connect'}
                                </button>
                            )}
                        </div>

                        {user?.googleId && !user?.hasPassword && (
                            <p className="mt-3 text-[10px] text-[#ffaa57] font-mono leading-relaxed">
                                ⚠ You must set a password below before you can disconnect Google.
                            </p>
                        )}
                    </div>

                    {/* ── Security / Password ── */}
                    <div className="pt-4 border-t border-[#2a2a35]">
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-4">
                            {user?.hasPassword ? 'Change Password' : 'Set Password'}
                        </label>

                        {!user?.hasPassword ? (
                            <form onSubmit={handleSetPassword} className="space-y-3">
                                {user?.googleId && (
                                    <p className="text-[10px] text-[#7a7a90] font-mono mb-2 leading-relaxed">
                                        You can log in via <b>{user?.email}</b> if you set a password and later choose to disconnect your Google account.
                                    </p>
                                )}
                                <div className="relative">
                                    <input
                                        type={showPasswords.new ? 'text' : 'password'}
                                        placeholder="New Password"
                                        autoComplete="new-password"
                                        value={passwordData.new}
                                        onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                                        className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-[#c8ff57]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7a90] hover:text-[#c8ff57] transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPasswords.new ? <EyeOffIcon /> : <EyeIcon />}
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showPasswords.confirm ? 'text' : 'password'}
                                        placeholder="Confirm New Password"
                                        autoComplete="new-password"
                                        value={passwordData.confirm}
                                        onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                        className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-[#c8ff57]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7a90] hover:text-[#c8ff57] transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPasswords.confirm ? <EyeOffIcon /> : <EyeIcon />}
                                    </button>
                                </div>
                                <button
                                    type="submit"
                                    disabled={passwordLoading || !passwordData.new}
                                    className="w-full py-2 bg-[#c8ff57]/10 text-[#c8ff57] border border-[#c8ff57]/30 font-bold text-xs rounded hover:bg-[#c8ff57]/20 transition-all"
                                >
                                    {passwordLoading ? 'Setting...' : 'Set Password'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleChangePassword} className="space-y-3">
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-[9px] text-[#7a7a90] font-mono uppercase tracking-widest">Current Password</label>
                                        <Link to="/forgot-password" 
                                              className="text-[9px] text-[#c8ff57] font-mono hover:underline uppercase tracking-widest">
                                            Forgot?
                                        </Link>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showPasswords.current ? 'text' : 'password'}
                                            placeholder="Enter your current password"
                                            autoComplete="new-password"
                                            value={passwordData.current}
                                            onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-[#c8ff57]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7a90] hover:text-[#c8ff57] transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showPasswords.current ? <EyeOffIcon /> : <EyeIcon />}
                                        </button>
                                    </div>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showPasswords.new ? 'text' : 'password'}
                                        placeholder="New Password"
                                        autoComplete="new-password"
                                        value={passwordData.new}
                                        onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                                        className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-[#c8ff57]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7a90] hover:text-[#c8ff57] transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPasswords.new ? <EyeOffIcon /> : <EyeIcon />}
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showPasswords.confirm ? 'text' : 'password'}
                                        placeholder="Confirm New Password"
                                        autoComplete="new-password"
                                        value={passwordData.confirm}
                                        onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                        className="w-full bg-[#18181f] border border-[#2a2a35] rounded px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-[#c8ff57]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7a90] hover:text-[#c8ff57] transition-colors"
                                        tabIndex={-1}
                                    >
                                        {showPasswords.confirm ? <EyeOffIcon /> : <EyeIcon />}
                                    </button>
                                </div>
                                <button
                                    type="submit"
                                    disabled={passwordLoading || !passwordData.new}
                                    className="w-full py-2 bg-[#18181f] text-[#7a7a90] border border-[#2a2a35] font-bold text-xs rounded hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all"
                                >
                                    {passwordLoading ? 'Updating...' : 'Change Password'}
                                </button>
                            </form>
                        )}

                        {passwordSuccess && (
                            <p className="mt-2 text-[10px] text-[#c8ff57] font-mono">
                                ✓ {passwordSuccess}
                            </p>
                        )}
                    </div>

                    {googleSuccess && (
                        <div className="px-3 py-2 bg-[#c8ff57]/10 border border-[#c8ff57]/30
                                        rounded font-mono text-xs text-[#c8ff57] animate-pulse">
                            ✓ {googleSuccess}
                        </div>
                    )}
                    
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

            {/* ── Confirmation Modal ── */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-5">
                    <div 
                        className="bg-[#111118] border border-[#ff5c5c]/30 rounded-xl p-8 max-w-sm w-full shadow-[0_20px_60px_rgba(255,92,92,0.1)]"
                        style={{ animation: 'fadeUp 0.3s ease-out' }}
                    >
                        <h3 className="font-black text-2xl text-white tracking-widest uppercase mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            Disconnect Google?
                        </h3>
                        <p className="text-[#7a7a90] font-mono text-[11px] mb-6 leading-relaxed">
                            You will no longer be able to log in with this Google account. To confirm, please type your username <span className="text-white font-bold">"{user?.username}"</span> below.
                        </p>

                        <div className="space-y-4">
                            <input 
                                type="text"
                                placeholder="Type your username"
                                value={confirmInput}
                                onChange={e => setConfirmInput(e.target.value)}
                                className="w-full bg-[#18181f] border border-[#2a2a35] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff5c5c] transition-all"
                            />

                            <div className="flex gap-3">
                                <button 
                                    onClick={() => { setIsConfirmModalOpen(false); setConfirmInput('') }}
                                    className="flex-1 py-3 border border-[#2a2a35] text-[#7a7a90] font-mono text-[10px] uppercase tracking-widest rounded-lg hover:bg-white/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={confirmGoogleUnlink}
                                    disabled={confirmInput !== user?.username || googleLoading}
                                    className="flex-1 py-3 bg-[#ff5c5c] text-white font-mono text-[10px] uppercase tracking-widest rounded-lg 
                                               hover:bg-[#ff4040] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    {googleLoading ? 'Disconnecting...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


function EyeIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
}

function EyeOffIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    )
}

export default EditProfile
