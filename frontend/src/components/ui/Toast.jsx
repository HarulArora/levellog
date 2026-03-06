// Toast.jsx
// Small popup notification that appears and disappears automatically
// Used to show success/error messages to the user

import { useEffect, useState } from 'react'

// message → text to show
// type → 'success' or 'error' (controls color)
// onClose → function to call when toast disappears
function Toast({ message, type = 'success', onClose }) {

    // visible controls the slide-in animation
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        // Trigger slide-in animation after mount
        setTimeout(() => setVisible(true), 10)

        // Auto close after 2.8 seconds
        const timer = setTimeout(() => {
            setVisible(false)
            // Wait for slide-out animation then call onClose
            setTimeout(onClose, 300)
        }, 2800)

        return () => clearTimeout(timer)
    }, [onClose])

    return (
        <div
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[999]
                  px-5 py-3 rounded font-mono text-sm font-medium
                  shadow-2xl border transition-all duration-300
                  ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                  ${type === 'success'
                    ? 'bg-[#111118] border-[#c8ff57]/40 text-[#c8ff57]'
                    : 'bg-[#111118] border-[#ff5c5c]/40 text-[#ff5c5c]'
                }`}
        >
            {type === 'success' ? '🎮 ' : '❌ '}
            {message}
        </div>
    )
}

export default Toast