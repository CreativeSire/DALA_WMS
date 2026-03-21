import { useState } from 'react'
import { useAuth } from '../App'

export default function LoginPage() {
  const { supabase, api, authMode, refreshAuth } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState('login')

  async function handleLogin(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      if (authMode === 'api') {
        await api.post('/auth/login', { email, password })
        await refreshAuth()
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error) {
      setMessage(error.message)
    }
    setLoading(false)
  }

  async function handleReset(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    if (authMode === 'api') {
      setMessage('Password reset is not enabled on the Railway backend yet. Contact an administrator for a credential reset.')
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) setMessage(error.message)
      else setMessage('Password reset email sent. Check your inbox.')
    }

    setLoading(false)
  }

  const isPositive = message.toLowerCase().includes('sent')

  return (
    <div style={shellStyle}>
      <style>{loginStyles}</style>

      <div style={orbStyle('8%', 'auto', '#2be3b4', '8%')} />
      <div style={orbStyle('58%', '9%', '#ff8552')} />
      <div style={orbStyle('auto', '34%', '#6dc6ff', '62%', 'auto', '18%')} />

      <div style={frameStyle} className="login-grid">
        <section style={heroPanelStyle}>
          <div style={eyebrowStyle}>Railway Deployment</div>
          <div style={heroTitleStyle}>
            Warehouse control for inbound, outbound, audit, and reconciliation.
          </div>
          <div style={heroCopyStyle}>
            The live DALA WMS console is now running against the Railway backend. Sign in to review stock intake,
            dispatch, reports, users, and partner operations in the production shell.
          </div>

          <div style={heroMetricGridStyle}>
            <MetricCard label="Backend" value="Railway API" accent="#2be3b4" />
            <MetricCard label="Database" value="Railway PG" accent="#6dc6ff" />
            <MetricCard label="Mode" value="Live Review" accent="#ff8552" />
          </div>

          <div style={heroChecklistStyle}>
            <div style={checklistTitleStyle}>What this environment already supports</div>
            <ChecklistItem>Role-based login and persistent sessions</ChecklistItem>
            <ChecklistItem>Inventory intake, dispatch, reports, and reconciliation flows</ChecklistItem>
            <ChecklistItem>Embedded operator guide directly inside the app</ChecklistItem>
          </div>
        </section>

        <section style={authPanelStyle}>
          <div style={wordmarkStyle}>
            DALA <span style={{ color: '#2be3b4' }}>WMS</span>
          </div>
          <div style={subtitleStyle}>Production access console</div>

          <div style={modeTabsStyle}>
            <button onClick={() => { setMode('login'); setMessage('') }} style={{ ...modeTabStyle, ...(mode === 'login' ? modeTabActiveStyle : null) }}>
              Sign In
            </button>
            <button onClick={() => { setMode('reset'); setMessage('') }} style={{ ...modeTabStyle, ...(mode === 'reset' ? modeTabActiveStyle : null) }}>
              Reset
            </button>
          </div>

          <div style={authHeaderStyle}>
            <div style={authTitleStyle}>{mode === 'login' ? 'Access the live workspace' : 'Request a credential reset'}</div>
            <div style={authCopyStyle}>
              {mode === 'login'
                ? 'Use your assigned role credentials to enter the Railway-backed warehouse console.'
                : 'Enter the email tied to your account. On Railway mode, an administrator can issue a temporary password from the Users module.'}
            </div>
          </div>

          {authMode === 'api' && (
            <div style={noticeStyle}>
              <span style={noticeDotStyle} />
              Railway backend authentication is active on this deployment.
            </div>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : handleReset}>
            <Field label="Email Address">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@dala.ng"
                style={inputStyle}
              />
            </Field>

            {mode === 'login' && (
              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  placeholder="Enter your password"
                  style={inputStyle}
                />
              </Field>
            )}

            {message && (
              <div style={{
                ...messageStyle,
                borderColor: isPositive ? 'rgba(43, 227, 180, 0.22)' : 'rgba(255, 133, 82, 0.22)',
                color: isPositive ? '#8df1cf' : '#ffb191',
                background: isPositive ? 'rgba(43,227,180,0.09)' : 'rgba(255,133,82,0.09)',
              }}>
                {message}
              </div>
            )}

            <button type="submit" disabled={loading} style={submitButtonStyle}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Enter Workspace' : 'Request Reset'}
            </button>
          </form>

          <div style={footerMetaStyle}>
            <div style={footerPillStyle}>Lagos Operations</div>
            <div style={footerCopyStyle}>Use the current Railway domain for review: `dalawms.up.railway.app`</div>
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function MetricCard({ label, value, accent }) {
  return (
    <div style={{
      borderRadius: 18,
      border: '1px solid rgba(126, 155, 160, 0.14)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.02) 100%)',
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at top right, ${accent}24 0%, transparent 34%)` }} />
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
    </div>
  )
}

function ChecklistItem({ children }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2be3b4', marginTop: 6, flexShrink: 0 }} />
      <span style={{ color: '#b3c6c8', fontSize: 14, lineHeight: 1.5 }}>{children}</span>
    </div>
  )
}

function orbStyle(top, right, color, left = 'auto', bottom = 'auto', size = '22%') {
  return {
    position: 'fixed',
    top,
    right,
    left,
    bottom,
    width: size,
    aspectRatio: '1 / 1',
    borderRadius: '50%',
    background: `radial-gradient(circle, ${color}26 0%, transparent 68%)`,
    filter: 'blur(24px)',
    pointerEvents: 'none',
  }
}

const shellStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '28px 18px',
  background: '#071012',
  position: 'relative',
  overflow: 'hidden',
}

const frameStyle = {
  width: '100%',
  maxWidth: 1200,
  display: 'grid',
  gridTemplateColumns: '1.1fr 0.9fr',
  gap: 22,
  position: 'relative',
  zIndex: 1,
}

const heroPanelStyle = {
  borderRadius: 28,
  padding: '42px 38px',
  border: '1px solid rgba(126, 155, 160, 0.12)',
  background: `
    linear-gradient(180deg, rgba(11,22,24,0.94) 0%, rgba(7,14,16,0.96) 100%),
    radial-gradient(circle at top right, rgba(43,227,180,0.08), transparent 28%)
  `,
  boxShadow: '0 28px 80px rgba(0,0,0,0.26)',
}

const eyebrowStyle = {
  fontFamily: 'DM Mono, monospace',
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#6f858d',
  marginBottom: 18,
}

const heroTitleStyle = {
  fontFamily: 'Syne, sans-serif',
  fontWeight: 800,
  fontSize: 46,
  lineHeight: 1,
  letterSpacing: '-0.05em',
  color: '#f6fbf9',
  maxWidth: 620,
}

const heroCopyStyle = {
  marginTop: 18,
  maxWidth: 620,
  color: '#9bb0b4',
  fontSize: 15,
  lineHeight: 1.7,
}

const heroMetricGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
  marginTop: 28,
}

const heroChecklistStyle = {
  marginTop: 28,
  borderRadius: 22,
  border: '1px solid rgba(126, 155, 160, 0.12)',
  background: 'rgba(255,255,255,0.03)',
  padding: '20px 20px 12px',
}

const checklistTitleStyle = {
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  fontSize: 20,
  color: '#edf7f4',
  marginBottom: 14,
}

const authPanelStyle = {
  borderRadius: 28,
  padding: '34px 30px',
  border: '1px solid rgba(126, 155, 160, 0.12)',
  background: 'linear-gradient(180deg, rgba(17,29,32,0.96) 0%, rgba(8,16,18,0.98) 100%)',
  boxShadow: '0 24px 72px rgba(0,0,0,0.3)',
}

const wordmarkStyle = {
  fontFamily: 'Syne, sans-serif',
  fontWeight: 800,
  fontSize: 34,
  letterSpacing: '-0.05em',
  color: '#f5fbf8',
}

const subtitleStyle = {
  fontFamily: 'DM Mono, monospace',
  fontSize: 10,
  letterSpacing: '0.18em',
  color: '#6f858d',
  textTransform: 'uppercase',
  marginTop: 4,
}

const modeTabsStyle = {
  display: 'inline-flex',
  gap: 8,
  marginTop: 24,
  padding: 6,
  borderRadius: 16,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(126, 155, 160, 0.12)',
}

const modeTabStyle = {
  border: 'none',
  borderRadius: 12,
  padding: '10px 14px',
  background: 'transparent',
  color: '#8ca1a8',
  cursor: 'pointer',
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  fontSize: 13,
}

const modeTabActiveStyle = {
  background: 'linear-gradient(135deg, rgba(43,227,180,0.95) 0%, rgba(123,255,219,0.84) 100%)',
  color: '#04110f',
}

const authHeaderStyle = {
  marginTop: 24,
  marginBottom: 18,
}

const authTitleStyle = {
  fontFamily: 'Syne, sans-serif',
  fontWeight: 800,
  fontSize: 26,
  color: '#f2f8f6',
  letterSpacing: '-0.03em',
}

const authCopyStyle = {
  marginTop: 8,
  color: '#8ea2a8',
  fontSize: 14,
  lineHeight: 1.6,
}

const noticeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  borderRadius: 14,
  border: '1px solid rgba(109, 198, 255, 0.2)',
  background: 'rgba(109, 198, 255, 0.08)',
  color: '#8fd8ff',
  fontSize: 13,
  marginBottom: 18,
}

const noticeDotStyle = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#6dc6ff',
}

const inputStyle = {
  width: '100%',
  padding: '13px 14px',
  borderRadius: 16,
  border: '1px solid rgba(126, 155, 160, 0.14)',
  background: 'rgba(4,9,10,0.7)',
  color: '#eef6f4',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: 14,
}

const labelStyle = {
  display: 'block',
  fontFamily: 'DM Mono, monospace',
  fontSize: 10,
  letterSpacing: '0.16em',
  color: '#6f858d',
  textTransform: 'uppercase',
  marginBottom: 8,
}

const messageStyle = {
  marginBottom: 16,
  borderRadius: 16,
  border: '1px solid',
  padding: '13px 14px',
  fontSize: 13,
  lineHeight: 1.5,
}

const submitButtonStyle = {
  width: '100%',
  padding: '14px 16px',
  border: '1px solid rgba(43, 227, 180, 0.36)',
  borderRadius: 18,
  background: 'linear-gradient(135deg, #2be3b4 0%, #7bffdb 100%)',
  color: '#04110f',
  cursor: 'pointer',
  fontFamily: 'Syne, sans-serif',
  fontWeight: 800,
  fontSize: 15,
  letterSpacing: '-0.02em',
  boxShadow: '0 16px 34px rgba(43, 227, 180, 0.18)',
}

const footerMetaStyle = {
  marginTop: 22,
  paddingTop: 18,
  borderTop: '1px solid rgba(126, 155, 160, 0.12)',
}

const footerPillStyle = {
  display: 'inline-block',
  borderRadius: 999,
  padding: '6px 10px',
  fontFamily: 'DM Mono, monospace',
  fontSize: 10,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  background: 'rgba(255,255,255,0.04)',
  color: '#90a5ab',
}

const footerCopyStyle = {
  marginTop: 12,
  color: '#768a90',
  fontSize: 12,
  lineHeight: 1.6,
}

const metricLabelStyle = {
  fontFamily: 'DM Mono, monospace',
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: '#6e858b',
  marginBottom: 8,
}

const metricValueStyle = {
  fontFamily: 'Syne, sans-serif',
  fontWeight: 800,
  fontSize: 20,
  color: '#f3f8f7',
}

const loginStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  input:focus {
    outline: none;
    border-color: #2be3b4 !important;
    box-shadow: 0 0 0 4px rgba(43, 227, 180, 0.08);
  }

  button:hover {
    filter: brightness(1.02);
  }

  @media (max-width: 980px) {
    .login-grid {
      grid-template-columns: 1fr;
    }
  }
`
