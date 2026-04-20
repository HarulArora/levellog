import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import AvatarFrame from './AvatarFrame'

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

    const pixelSize = size === 'sm' ? 28 : size === 'md' ? 40 : parseInt(size) || 40

    return (
        <AvatarFrame 
            userId={user._id} 
            src={imgError ? null : user.avatar} 
            size={pixelSize} 
            className={className} 
        />
    )
}

export default Avatar
