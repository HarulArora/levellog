import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

console.log('SMTP_USER:', process.env.SMTP_USER)
console.log('SMTP_PASS:', process.env.SMTP_PASS ? 'SET' : 'NOT SET')

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
})

transporter.verify((error, success) => {
    if (error) {
        console.log('❌ SMTP Error:', error.message)
        console.log('Full error:', error)
    } else {
        console.log('✅ SMTP connection successful! Sending test email...')
        transporter.sendMail({
            from: process.env.SMTP_USER,
            to: process.env.SMTP_USER,
            subject: 'LevelLog Test Email',
            text: 'If you see this, email is working!'
        }, (err, info) => {
            if (err) console.log('❌ Send error:', err.message)
            else console.log('✅ Email sent:', info.response)
        })
    }
})