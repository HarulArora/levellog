const BASE_URL = process.env.CLIENT_URL || 'http://localhost:5173'

const sendEmail = async ({ to, subject, html }) => {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: 'LevelLog <onboarding@resend.dev>',
            to,
            subject,
            html,
        }),
    })

    const data = await res.json()

    if (!res.ok) {
        console.error('Resend API error:', data)
        throw new Error(data.message || 'Failed to send email')
    }

    return data
}

// ── Send email verification ───────────────────────────────────────────────────
export const sendVerificationEmail = async (email, token) => {
    const link = `${BASE_URL}/verify-email?token=${token}`
    await sendEmail({
        to: email,
        subject: 'Verify your LevelLog email',
        html: `
        <div style="background:#0a0a0f;color:#fff;font-family:monospace;padding:40px;max-width:480px;margin:0 auto;border-radius:12px;border:1px solid #2a2a35">
            <div style="font-size:28px;font-weight:900;letter-spacing:4px;color:#c8ff57;margin-bottom:8px">LEVEL<span style="color:#fff">LOG</span></div>
            <p style="color:#7a7a90;font-size:12px;margin-bottom:32px">Your game diary awaits</p>
            <h2 style="font-size:18px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px">Verify Your Email</h2>
            <p style="color:#b0b0c0;font-size:14px;line-height:1.6;margin-bottom:32px">
                Click the button below to verify your email address. This link expires in <strong style="color:#c8ff57">24 hours</strong>.
            </p>
            <a href="${link}" style="display:inline-block;background:#c8ff57;color:#000;font-weight:700;font-size:14px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:1px">
                VERIFY EMAIL
            </a>
            <p style="color:#3a3a50;font-size:11px;margin-top:32px">
                If you didn't create a LevelLog account, ignore this email.
            </p>
        </div>
        `,
    })
}

// ── Send password reset ───────────────────────────────────────────────────────
export const sendPasswordResetEmail = async (email, token) => {
    const link = `${BASE_URL}/reset-password?token=${token}`
    await sendEmail({
        to: email,
        subject: 'Reset your LevelLog password',
        html: `
        <div style="background:#0a0a0f;color:#fff;font-family:monospace;padding:40px;max-width:480px;margin:0 auto;border-radius:12px;border:1px solid #2a2a35">
            <div style="font-size:28px;font-weight:900;letter-spacing:4px;color:#c8ff57;margin-bottom:8px">LEVEL<span style="color:#fff">LOG</span></div>
            <p style="color:#7a7a90;font-size:12px;margin-bottom:32px">Password reset request</p>
            <h2 style="font-size:18px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px">Reset Your Password</h2>
            <p style="color:#b0b0c0;font-size:14px;line-height:1.6;margin-bottom:32px">
                Click the button below to set a new password. This link expires in <strong style="color:#c8ff57">1 hour</strong>.
            </p>
            <a href="${link}" style="display:inline-block;background:#c8ff57;color:#000;font-weight:700;font-size:14px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:1px">
                RESET PASSWORD
            </a>
            <p style="color:#3a3a50;font-size:11px;margin-top:32px">
                If you didn't request this, ignore this email. Your password won't change.
            </p>
        </div>
        `,
    })
}
