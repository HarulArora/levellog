import { Resend } from 'resend'
import dotenv from 'dotenv'
import logger from './logger.js'

dotenv.config()

// Create Resend instance
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

if (resend) {
    logger.info('🚀 Resend SDK is ready for HTTP delivery')
} else {
    logger.error('❌ Resend API Key missing. Email delivery will fail.')
}

export const sendEmail = async ({ to, subject, html }) => {
    try {
        if (!resend) {
            throw new Error('Resend client not initialized')
        }

        logger.info(`Attempting to send API email to: ${to}...`)
        
        const { data, error } = await resend.emails.send({
            from: 'QuestDeck <onboarding@resend.dev>', // Update to your domain later (e.g. hello@questdeck.com)
            to: [to],
            subject,
            html,
        })

        if (error) {
            logger.error('❌ Resend API Error:', error)
            return { success: false, error }
        }

        logger.info('✅ Email sent via Resend API! ID:', data.id)
        return { success: true, data }
    } catch (error) {
        logger.error('❌ Email send exception error:', error)
        return { success: false, error }
    }
}

export const sendVerificationEmail = async (email, username, code) => {
    const subject = 'Verify Your QuestDeck Account'
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px; background-color: #0f172a; color: #f8fafc;">
            <h1 style="color: #c8ff57; text-align: center;">Welcome to QuestDeck!</h1>
            <p style="font-size: 16px;">Hello ${username},</p>
            <p style="font-size: 16px;">Thank you for signing up for QuestDeck. To complete your registration, please use the verification code below:</p>
            <div style="text-align: center; margin: 30px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #c8ff57; background-color: #1e293b; padding: 10px 20px; border-radius: 5px; border: 1px solid #334155;">${code}</span>
            </div>
            <p style="font-size: 14px; color: #94a3b8;">This code will expire in 10 minutes.</p>
            <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
            <p style="font-size: 12px; color: #64748b; text-align: center;">&copy; 2024 QuestDeck. All rights reserved.</p>
        </div>
    `
    return await sendEmail({ to: email, subject, html })
}

export const sendResetPasswordEmail = async (email, username, code) => {
    const subject = 'Reset Your QuestDeck Password'
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px; background-color: #0f172a; color: #f8fafc;">
            <h1 style="color: #c8ff57; text-align: center;">Reset Password Request</h1>
            <p style="font-size: 16px;">Hello ${username},</p>
            <p style="font-size: 16px;">We received a request to reset your QuestDeck password. Use the code below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #ef4444; background-color: #1e293b; padding: 10px 20px; border-radius: 5px; border: 1px solid #334155;">${code}</span>
            </div>
            <p style="font-size: 14px; color: #94a3b8;">This code will expire in 10 minutes.</p>
            <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
            <p style="font-size: 12px; color: #64748b; text-align: center;">&copy; 2024 QuestDeck. All rights reserved.</p>
        </div>
    `
    return await sendEmail({ to: email, subject, html })
}

export const sendWelcomeEmail = async (email, username) => {
    const subject = 'QuestDeck Account Verified!'
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px; background-color: #0f172a; color: #f8fafc;">
            <h1 style="color: #c8ff57; text-align: center;">You're All Set!</h1>
            <p style="font-size: 16px;">Hello ${username},</p>
            <p style="font-size: 16px;">Your email has been successfully verified. Your QuestDeck account is now fully active!</p>
            <p style="font-size: 16px;">You can now log your games, track your progress, and join the community.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL}" style="display: inline-block; padding: 12px 24px; background-color: #c8ff57; color: #000; text-decoration: none; font-weight: bold; border-radius: 5px;">Go to My Library</a>
            </div>
            <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
            <p style="font-size: 12px; color: #64748b; text-align: center;">&copy; 2024 QuestDeck. All rights reserved.</p>
        </div>
    `
    return await sendEmail({ to: email, subject, html })
}

export const sendPasswordResetSuccessEmail = async (email, username) => {
    const subject = 'Password Changed Successfully'
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px; background-color: #0f172a; color: #f8fafc;">
            <h1 style="color: #c8ff57; text-align: center;">Security Update</h1>
            <p style="font-size: 16px;">Hello ${username},</p>
            <p style="font-size: 16px;">This is a confirmation that your QuestDeck password has been changed successfully.</p>
            <p style="font-size: 14px; color: #94a3b8;">If you did not make this change, please contact our support immediately.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL}/login" style="display: inline-block; padding: 12px 24px; background-color: #c8ff57; color: #000; text-decoration: none; font-weight: bold; border-radius: 5px;">Login Now</a>
            </div>
            <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
            <p style="font-size: 12px; color: #64748b; text-align: center;">&copy; 2024 QuestDeck. All rights reserved.</p>
        </div>
    `
    return await sendEmail({ to: email, subject, html })
}

export const sendAccountLinkedEmail = async (email, username, provider = 'Google') => {
    const subject = `QuestDeck Account Connected: ${provider}`
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px; background-color: #0f172a; color: #f8fafc;">
            <h1 style="color: #c8ff57; text-align: center;">Account Linked!</h1>
            <p style="font-size: 16px;">Hello ${username},</p>
            <p style="font-size: 16px;">Your QuestDeck profile has been successfully connected to your <b>${provider}</b> account.</p>
            <p style="font-size: 16px;">You can now use either your password or your social account to log in.</p>
            <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
            <p style="font-size: 12px; color: #64748b; text-align: center;">&copy; 2024 QuestDeck. All rights reserved.</p>
        </div>
    `
    return await sendEmail({ to: email, subject, html })
}

export const sendAccountUnlinkedEmail = async (email, username, provider = 'Google') => {
    const subject = `QuestDeck Account Disconnected: ${provider}`
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px; background-color: #0f172a; color: #f8fafc;">
            <h1 style="color: #ff5c5c; text-align: center;">Account Disconnected</h1>
            <p style="font-size: 16px;">Hello ${username},</p>
            <p style="font-size: 16px;">This is to confirm that you have disconnected your <b>${provider}</b> account from your QuestDeck profile.</p>
            <p style="font-size: 14px; color: #94a3b8;">You should now use your email and password to log in.</p>
            <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
            <p style="font-size: 12px; color: #64748b; text-align: center;">&copy; 2024 QuestDeck. All rights reserved.</p>
        </div>
    `
    return await sendEmail({ to: email, subject, html })
}
