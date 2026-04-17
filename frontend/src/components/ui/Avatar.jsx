import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

const Avatar = ({ user: passedUser, size = 'md', className = '' }) => {
    const { user: authUser } = useAuth()
    const user = passedUser || authUser
    const [imgError, setImgError] = useState(false)
    
    if (!user) return null

    const dimensions = {
        sm: 'w-7 h-7 text-[10px]',
        md: 'w-10 h-10 text-sm',
    }
    
    // Support custom size classes for flexibility
    const currentSize = dimensions[size] || size || dimensions.md

    return (
        <div className={`relative flex-shrink-0 ${className}`}>
            {user.avatar && !imgError ? (
                <img 
                    src={user.avatar} 
                    alt={user.username} 
                    onError={() => setImgError(true)}
                    className={`${currentSize} rounded-full object-cover ring-2 ring-[#2a2a35]`} 
                />
            ) : (
                <div 
                    className={`${currentSize} rounded-full bg-gradient-to-br from-[#c8ff57] to-[#5c9fff] flex items-center justify-center font-black text-black uppercase`}
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                    {user.username?.[0] || '?'}
                </div>
            )}
        </div>
    )
}
 Arkansas

export default Avatar
