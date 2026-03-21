import { useState } from 'react'
import { useAuth } from '../App'

export default function LoginPage() {
  const { supabase } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login') // login | reset

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleReset(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) setError(error.message)
    else setError('Password reset email sent. Check your inbox.')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0b0f10', padding: 20,
      backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(0,229,160,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(79,195,247,0.03) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, color: '#fff', letterSpacing: '-0.03em' }}>
            DALA <span style={{ color: '#00e5a0' }}>WMS</span>
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#4a6068', letterSpacing: '0.15em', marginTop: 6, textTransform: 'uppercase' }}>
            Warehouse Management System
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#111618', border: '1px solid #1a2224', borderRadius: 10,
          padding: 32,
        }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#e0e8ea', marginBottom: 6 }}>
            {mode === 'login' ? 'Sign In' : 'Reset Password'}
          </div>
          <div style={{ fontSize: 13, color: '#4a6068', marginBottom: 28 }}>
            {mode === 'login' ? 'Enter your credentials to access the system.' : 'Enter your email and we\'ll send a reset link.'}
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleReset}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="you@dala.ng"
                style={inputStyle}
              />
            </div>

            {mode === 'login' && (
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required placeholder="••••••••"
                  style={inputStyle}
                />
              </div>
            )}

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13,
                background: error.includes('sent') ? 'rgba(0,229,160,0.08)' : 'rgba(255,107,53,0.08)',
                color: error.includes('sent') ? '#00e5a0' : '#ff6b35',
                border: `1px solid ${error.includes('sent') ? 'rgba(0,229,160,0.2)' : 'rgba(255,107,53,0.2)'}`,
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In →' : 'Send Reset Link →'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button
              onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError('') }}
              style={{ background: 'none', border: 'none', color: '#4a6068', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Mono, monospace', letterSpacing: '0.05em' }}
            >
              {mode === 'login' ? 'Forgot password?' : '← Back to Sign In'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#2a3840', letterSpacing: '0.08em' }}>
          DALA TECHNOLOGIES · LAGOS
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        input:focus { outline: none; border-color: #00e5a0 !important; box-shadow: 0 0 0 3px rgba(0,229,160,0.08); }
      `}</style>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontFamily: 'DM Mono, monospace', fontSize: 11,
  letterSpacing: '0.1em', color: '#4a6068', textTransform: 'uppercase', marginBottom: 8,
}
const inputStyle = {
  width: '100%', padding: '11px 14px', background: '#0b0f10',
  border: '1px solid #1e2a2d', borderRadius: 6, color: '#e0e8ea',
  fontFamily: 'DM Sans, sans-serif', fontSize: 14, transition: 'border-color 0.15s',
}
const btnStyle = {
  width: '100%', padding: '12px', background: '#00e5a0', border: 'none',
  borderRadius: 6, color: '#0b0f10', fontFamily: 'Syne, sans-serif',
  fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: '-0.01em',
  transition: 'opacity 0.15s',
}
