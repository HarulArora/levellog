import { createContext, useContext, useState, useEffect, useRef } from 'react'

const SoundContext = createContext()

const SOUND_URLS = {
    quack: 'https://assets.mixkit.co/active_storage/sfx/2386/2386-preview.mp3',
    pop: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
    levelUp: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
    click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'
}

export const SoundProvider = ({ children }) => {
    const [isMuted, setIsMuted] = useState(() => {
        const saved = localStorage.getItem('questduck_muted')
        return saved ? JSON.parse(saved) : false
    })

    const audioRefs = useRef({})

    useEffect(() => {
        localStorage.setItem('questduck_muted', JSON.stringify(isMuted))
    }, [isMuted])

    const playSound = (soundName, volume = 0.4) => {
        if (isMuted || !SOUND_URLS[soundName]) return

        // Create or reuse audio object
        if (!audioRefs.current[soundName]) {
            audioRefs.current[soundName] = new Audio(SOUND_URLS[soundName])
        }

        const audio = audioRefs.current[soundName]
        audio.volume = volume
        audio.currentTime = 0 // Reset to start
        audio.play().catch(e => console.warn('Sound play blocked by browser:', e))
    }

    const toggleMute = () => setIsMuted(prev => !prev)

    return (
        <SoundContext.Provider value={{ playSound, isMuted, toggleMute }}>
            {children}
        </SoundContext.Provider>
    )
}

export const useSound = () => {
    const context = useContext(SoundContext)
    if (!context) throw new Error('useSound must be used within SoundProvider')
    return context
}
