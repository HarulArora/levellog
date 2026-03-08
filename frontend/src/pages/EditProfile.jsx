import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

function EditProfile() {
    const { user, refreshUser } = useAuth()
    const navigate = useNavigate()

    const [username, setUsername] = useState(user?.username || '')
    const [bio, setBio] = useState(user?.bio || '')
    const [avatar, setAvatar] = useState(user?.avatar || '')
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '')
    const [avatarMode, setAvatarMode] = useState('upload')
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')
    const fileInputRef = useRef(null)

    const handleFileUpload = (e) => {
        const file = e.target.files[0]
        if (!file) return
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
            setAvatar(ev.target.result)
            setAvatarPreview(ev.target.result)
            setError('')
        }
        reader.readAsDataURL(file)
    }

    const handleUrlChange = (val) => {
        setAvatarUrl(val)
        setAvatarPreview(val)
        setAvatar(val)
    }

    const removeAvatar = () => {
        setAvatar('')
        setAvatarPreview('')
        setAvatarUrl('')
    }

    const handleSave = async () => {
        setError('')
        setSaving(true)
        try {
            const res = await api.put('/auth/profile', {
                username: username.trim(),
                bio: bio.trim(),
                avatar: avatar.trim(),
            })
            if (res.data.success) {
                await refreshUser()
                setSaved(true)
                setTimeout(() => {
                    setSaved(false)
                    navigate(`/user/${res.data.user.username}`)
                }, 1200)
            } else {
                setError(res.data.message || 'Something went wrong')
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="min-h-screen flex items-start justify-center pt-16 px-4">
            <div className="w-full max-w-md">

                <div className="mb-8">
                    <button onClick={() => navigate(-1)}
                        className="font-mono text-xs text-[#7a7a90] hover:text-[#c8ff57]
                                   transition-colors mb-6 flex items-center gap-2">
                        ← BACK
                    </button>
                    <h1 className="font-black text-4xl text-white uppercase tracking-widest"
                        style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        Edit Profile
                    </h1>
                    <p className="font-mono text-xs text-[#7a7a90] mt-1">
                        Update your public profile info
                    </p>
                </div>

                <div className="bg-[#111118] border border-[#2a2a35] rounded-lg p-6 flex flex-col gap-6">

                    {/* Avatar */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-3">
                            Profile Picture / GIF
                        </label>

                        <div className="flex items-center gap-4 mb-4">
                            <div className="relative flex-shrink-0">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="preview"
                                        className="w-16 h-16 rounded-full object-cover
                                                   ring-2 ring-[#c8ff57]/50" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-[#c8ff57]/15
                                                    border-2 border-[#2a2a35] flex items-center
                                                    justify-center font-black text-[#c8ff57]
                                                    uppercase text-xl">
                                        {user?.username?.[0] || '?'}
                                    </div>
                                )}
                                {avatarPreview && (
                                    <button onClick={removeAvatar}
                                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full
                                                   bg-[#ff5c5c] text-white text-[10px]
                                                   flex items-center justify-center
                                                   hover:bg-[#ff4040] transition-colors">
                                        ✕
                                    </button>
                                )}
                            </div>
                            <div className="text-[#7a7a90] font-mono text-[10px] leading-relaxed">
                                Supports JPG, PNG, GIF<br />
                                Max 2MB · GIFs will animate
                            </div>
                        </div>

                        <div className="flex gap-2 mb-3">
                            {['upload', 'url'].map(mode => (
                                <button key={mode} onClick={() => setAvatarMode(mode)}
                                    className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase
                                               tracking-wider border transition-all
                                               ${avatarMode === mode
                                            ? 'bg-[#c8ff57]/15 text-[#c8ff57] border-[#c8ff57]/50'
                                            : 'border-[#2a2a35] text-[#7a7a90] hover:border-[#c8ff57]'}`}>
                                    {mode === 'upload' ? '⬆ Upload File' : '🔗 Paste URL'}
                                </button>
                            ))}
                        </div>

                        {avatarMode === 'upload' ? (
                            <>
                                <input ref={fileInputRef} type="file"
                                    accept="image/*,.gif"
                                    onChange={handleFileUpload}
                                    className="hidden" />
                                <button onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-3 border border-dashed border-[#2a2a35]
                                               text-[#7a7a90] font-mono text-xs rounded
                                               hover:border-[#c8ff57] hover:text-[#c8ff57] transition-all">
                                    Click to choose image or GIF
                                </button>
                            </>
                        ) : (
                            <input type="text"
                                placeholder="https://example.com/avatar.gif"
                                value={avatarUrl}
                                onChange={e => handleUrlChange(e.target.value)}
                                className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                           px-3 py-2.5 text-sm text-white font-mono
                                           focus:outline-none focus:border-[#c8ff57]
                                           placeholder:text-[#3a3a50] transition-colors" />
                        )}
                    </div>

                    {/* Username */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2">Username</label>
                        <input type="text" value={username}
                            onChange={e => setUsername(e.target.value)}
                            maxLength={20}
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                       px-3 py-2.5 text-sm text-white
                                       focus:outline-none focus:border-[#c8ff57] transition-colors" />
                        <div className="font-mono text-[10px] text-[#7a7a90] mt-1 text-right">
                            {username.length}/20
                        </div>
                    </div>

                    {/* Bio */}
                    <div>
                        <label className="block font-mono text-xs uppercase tracking-wider
                                          text-[#7a7a90] mb-2">Bio</label>
                        <textarea value={bio} onChange={e => setBio(e.target.value)}
                            maxLength={200} rows={3}
                            placeholder="Tell people about yourself..."
                            className="w-full bg-[#18181f] border border-[#2a2a35] rounded
                                       px-3 py-2.5 text-sm text-white resize-none
                                       focus:outline-none focus:border-[#c8ff57]
                                       placeholder:text-[#3a3a50] transition-colors" />
                        <div className="font-mono text-[10px] text-[#7a7a90] mt-1 text-right">
                            {bio.length}/200
                        </div>
                    </div>

                    {error && (
                        <div className="px-3 py-2.5 bg-[#ff5c5c]/10 border border-[#ff5c5c]/30
                                        rounded font-mono text-xs text-[#ff5c5c]">
                            {error}
                        </div>
                    )}

                    <button onClick={handleSave} disabled={saving || !username.trim()}
                        className={`w-full py-3 font-bold text-sm rounded transition-all
                                   ${saved
                                ? 'bg-[#5c9fff] text-white'
                                : 'bg-[#c8ff57] text-black hover:bg-[#d4ff6e]'}
                                   disabled:opacity-40 disabled:cursor-not-allowed`}>
                        {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
                    </button>

                </div>
            </div>
        </div>
    )
}

export default EditProfile