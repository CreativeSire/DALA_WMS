import { useState } from 'react'
import { useAuth } from '../App'
import { Alert, Button, Input, Modal } from './ui'

const NAV = [
  { section: 'OVERVIEW' },
  { id:'dashboard', label:'Dashboard', icon:'◈', roles:['admin','warehouse_manager','operations','finance','security'] },
  { id:'how-it-works', label:'How It Works', icon:'?', roles:['admin','warehouse_manager','operations','finance','security'] },
  { section: 'STOCK FLOW' },
  { id:'grn', label:'Stock Intake (GRN)', icon:'↓', roles:['admin','warehouse_manager'] },
  { id:'dispatch', label:'Dispatch', icon:'↑', roles:['admin','operations','warehouse_manager','security'] },
  { id:'ledger', label:'Ledger', icon:'≡', roles:['admin','warehouse_manager','operations','finance'] },
  { section: 'RISK & CONTROL' },
  { id:'expiry', label:'Expiry Tracking', icon:'⏱', roles:['admin','warehouse_manager','operations','finance'] },
  { id:'casualties', label:'Casualties', icon:'⚠', roles:['admin','warehouse_manager','operations'] },
  { id:'reorder', label:'Reorder Alerts', icon:'🔔', roles:['admin','warehouse_manager','operations','finance'] },
  { id:'performance', label:'Partner Performance', icon:'◇', roles:['admin','operations','finance'] },
  { section: 'RECONCILIATION' },
  { id:'count', label:'Physical Count', icon:'✓', roles:['admin','warehouse_manager','operations'] },
  { id:'reports', label:'Reports & Export', icon:'↗', roles:['admin','warehouse_manager','operations','finance'] },
  { section: 'SYSTEM' },
  { id:'products', label:'Products', icon:'◉', roles:['admin','warehouse_manager','operations'] },
  { id:'partners', label:'Brand Partners', icon:'○', roles:['admin','operations'] },
  { id:'users', label:'Users', icon:'⊕', roles:['admin'] },
  { id:'admin-audit', label:'Admin Audit', icon:'⌘', roles:['admin'] },
]

const ROLE_COLORS = {
  admin:'#ff8552',
  warehouse_manager:'#2be3b4',
  operations:'#6dc6ff',
  finance:'#f5b85c',
  security:'#f07fe1',
}

export default function Layout({ children, page, setPage }) {
  const { profile, logout, api, authMode } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordAlert, setPasswordAlert] = useState({ message: '', type: 'success' })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const currentLabel = NAV.find((item) => item.id === page)?.label || 'Dashboard'
  const visibleNav = NAV.filter((item) => !item.roles || item.roles.includes(profile?.role))

  async function handlePasswordChange(event) {
    event.preventDefault()
    setPasswordAlert({ message: '', type: 'success' })

    if (authMode !== 'api') {
      setPasswordAlert({ message: 'Self-service password change is only enabled on the Railway backend.', type: 'warn' })
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordAlert({ message: 'New password must be at least 8 characters.', type: 'error' })
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordAlert({ message: 'New password and confirmation do not match.', type: 'error' })
      return
    }

    setPasswordLoading(true)
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordAlert({ message: response.message, type: 'success' })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setShowPasswordModal(false), 900)
    } catch (error) {
      setPasswordAlert({ message: error.message, type: 'error' })
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div style={shellStyle}>
      <style>{globalStyles}</style>

      <div style={ambientOrbStyle('12%', '10%', '#00e5a0')} />
      <div style={ambientOrbStyle('auto', '54%', '#ff8552', '12%', '20%')} />
      <div style={ambientOrbStyle('70%', 'auto', '#6dc6ff', '76%', '72%')} />

      {sidebarOpen && <div style={backdropStyle} onClick={() => setSidebarOpen(false)} />}

      <aside style={{
        ...sidebarStyle,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-110%)',
      }} className="dala-sidebar">
        <div style={brandBlockStyle}>
          <div style={brandWordmarkStyle}>
            DALA <span style={{ color: '#00e5a0' }}>WMS</span>
          </div>
          <div style={brandMetaStyle}>Railway Warehouse Console</div>
          <div style={brandChipRowStyle}>
            <StatusChip label="Live Ops" color="#00e5a0" />
            <StatusChip label={profile?.role?.replace('_', ' ') || 'user'} color={ROLE_COLORS[profile?.role] || '#6dc6ff'} />
          </div>
        </div>

        <nav style={navStyle}>
          {visibleNav.map((item, index) => {
            if (item.section) {
              return (
                <div key={`section-${index}`} style={sectionLabelStyle}>
                  {item.section}
                </div>
              )
            }

            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setPage(item.id)
                  setSidebarOpen(false)
                }}
                style={{
                  ...navButtonStyle,
                  ...(active ? navButtonActiveStyle : null),
                }}
              >
                <span style={{
                  ...navIconStyle,
                  color: active ? '#071412' : '#8aa0a8',
                  background: active ? 'rgba(4, 255, 191, 0.2)' : 'rgba(255,255,255,0.04)',
                }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div style={footerCardStyle}>
          <div style={{ fontSize: 13, color: '#f3f7f6', fontWeight: 600 }}>{profile?.full_name}</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6f858d', marginTop: 4 }}>
            Session active
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 10,
            borderRadius: 999,
            padding: '5px 10px',
            background: 'rgba(255,255,255,0.04)',
            color: ROLE_COLORS[profile?.role] || '#6dc6ff',
            fontFamily: 'DM Mono, monospace',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ROLE_COLORS[profile?.role] || '#6dc6ff' }} />
            {profile?.role?.replace('_', ' ')}
          </div>
          <button onClick={() => logout()} style={logoutButtonStyle}>Sign Out</button>
          <button onClick={() => setShowPasswordModal(true)} style={secondaryButtonStyle}>Change Password</button>
        </div>
      </aside>

      <div style={mainShellStyle} className="dala-main-shell">
        <header style={topbarStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => setSidebarOpen((open) => !open)} style={menuButtonStyle}>
              ☰
            </button>
            <div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: '#6f858d', textTransform: 'uppercase' }}>
                Active Module
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#f4f7f6' }}>
                {currentLabel}
              </div>
            </div>
          </div>

          <div style={topbarMetaStyle}>
            <div style={topbarPillStyle}>
              <span style={pulseDotStyle} />
              Railway Live
            </div>
            <div style={topbarDateStyle}>
              {new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
            </div>
          </div>
        </header>

        <main style={mainContentStyle}>
          <div style={contentFrameStyle}>
            {children}
          </div>
        </main>
      </div>

      {showPasswordModal && (
        <Modal title="Change Password" onClose={() => {
          setShowPasswordModal(false)
          setPasswordAlert({ message: '', type: 'success' })
          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        }}>
          <Alert message={passwordAlert.message} type={passwordAlert.type} />
          <form onSubmit={handlePasswordChange}>
            <Input label="Current Password" type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))} required />
            <Input label="New Password" type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))} required />
            <Input label="Confirm New Password" type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))} required />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
              <Button type="submit" disabled={passwordLoading}>{passwordLoading ? 'Updating...' : 'Update Password'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function StatusChip({ label, color }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      padding: '6px 10px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
      fontFamily: 'DM Mono, monospace',
      fontSize: 10,
      color,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {label}
    </span>
  )
}

function ambientOrbStyle(top, right, color, left = 'auto', bottom = 'auto') {
  return {
    position: 'fixed',
    top,
    right,
    left,
    bottom,
    width: 320,
    height: 320,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${color}22 0%, transparent 68%)`,
    filter: 'blur(26px)',
    pointerEvents: 'none',
    zIndex: 0,
  }
}

const shellStyle = {
  minHeight: '100vh',
  background: '#071012',
  color: '#dbe8e6',
  display: 'flex',
  position: 'relative',
  overflow: 'hidden',
  fontFamily: 'DM Sans, sans-serif',
}

const backdropStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 70,
  background: 'rgba(4, 10, 12, 0.72)',
  backdropFilter: 'blur(3px)',
}

const sidebarStyle = {
  position: 'fixed',
  top: 18,
  left: 18,
  bottom: 18,
  width: 276,
  zIndex: 80,
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 24,
  border: '1px solid rgba(126, 155, 160, 0.16)',
  background: 'linear-gradient(180deg, rgba(13,24,26,0.95) 0%, rgba(10,18,20,0.98) 100%)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.03)',
  backdropFilter: 'blur(18px)',
  transition: 'transform 0.22s ease',
}

const brandBlockStyle = {
  padding: '24px 22px 20px',
  borderBottom: '1px solid rgba(126, 155, 160, 0.1)',
}

const brandWordmarkStyle = {
  fontFamily: 'Syne, sans-serif',
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: '-0.04em',
  color: '#f5fbf8',
}

const brandMetaStyle = {
  marginTop: 6,
  fontFamily: 'DM Mono, monospace',
  fontSize: 10,
  color: '#6f858d',
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
}

const brandChipRowStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 16,
}

const navStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '12px 12px 8px',
}

const sectionLabelStyle = {
  padding: '14px 10px 6px',
  fontFamily: 'DM Mono, monospace',
  fontSize: 9,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: '#42545b',
}

const navButtonStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '11px 12px',
  marginBottom: 4,
  border: '1px solid transparent',
  borderRadius: 14,
  background: 'transparent',
  color: '#a3b8bd',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 13,
  fontWeight: 500,
  transition: 'all 0.16s ease',
}

const navButtonActiveStyle = {
  color: '#061210',
  border: '1px solid rgba(43, 227, 180, 0.5)',
  background: 'linear-gradient(135deg, rgba(43,227,180,0.96) 0%, rgba(118,255,224,0.84) 100%)',
  boxShadow: '0 10px 30px rgba(43, 227, 180, 0.18)',
}

const navIconStyle = {
  width: 24,
  height: 24,
  borderRadius: 8,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  flexShrink: 0,
}

const footerCardStyle = {
  margin: '0 12px 12px',
  padding: '16px 14px',
  borderRadius: 18,
  border: '1px solid rgba(126, 155, 160, 0.12)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
}

const logoutButtonStyle = {
  width: '100%',
  marginTop: 14,
  padding: '11px 0',
  borderRadius: 12,
  border: '1px solid rgba(126, 155, 160, 0.14)',
  background: 'rgba(8, 15, 17, 0.8)',
  color: '#8aa0a8',
  cursor: 'pointer',
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
}

const secondaryButtonStyle = {
  width: '100%',
  marginTop: 10,
  padding: '11px 0',
  borderRadius: 12,
  border: '1px solid rgba(43, 227, 180, 0.16)',
  background: 'rgba(10, 30, 24, 0.4)',
  color: '#9af2d1',
  cursor: 'pointer',
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
}

const mainShellStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  zIndex: 1,
}

const topbarStyle = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  height: 88,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '20px 26px 16px',
  background: 'linear-gradient(180deg, rgba(7,16,18,0.92) 0%, rgba(7,16,18,0.72) 100%)',
  backdropFilter: 'blur(14px)',
}

const menuButtonStyle = {
  width: 42,
  height: 42,
  borderRadius: 12,
  border: '1px solid rgba(126, 155, 160, 0.16)',
  background: 'rgba(255,255,255,0.04)',
  color: '#e8f6f2',
  cursor: 'pointer',
  fontSize: 18,
}

const topbarMetaStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
}

const topbarPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  borderRadius: 999,
  padding: '8px 12px',
  border: '1px solid rgba(43, 227, 180, 0.16)',
  background: 'rgba(10, 30, 24, 0.72)',
  color: '#9af2d1',
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const pulseDotStyle = {
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: '#2be3b4',
  boxShadow: '0 0 0 6px rgba(43,227,180,0.12)',
}

const topbarDateStyle = {
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  color: '#7e949b',
  letterSpacing: '0.08em',
}

const mainContentStyle = {
  flex: 1,
  padding: '0 20px 24px',
}

const contentFrameStyle = {
  minHeight: 'calc(100vh - 120px)',
  borderRadius: 28,
  border: '1px solid rgba(126, 155, 160, 0.08)',
  background: `
    linear-gradient(180deg, rgba(8,16,18,0.82) 0%, rgba(8,16,18,0.68) 100%),
    repeating-linear-gradient(
      90deg,
      rgba(255,255,255,0.02) 0,
      rgba(255,255,255,0.02) 1px,
      transparent 1px,
      transparent 38px
    )
  `,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  padding: '28px',
}

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { min-height: 100%; }
  body {
    background:
      radial-gradient(circle at top left, rgba(43,227,180,0.08), transparent 28%),
      radial-gradient(circle at bottom right, rgba(255,133,82,0.06), transparent 22%),
      #071012;
  }

  .dala-sidebar button:hover {
    border-color: rgba(126, 155, 160, 0.14);
    background: rgba(255,255,255,0.045);
    color: #ebf5f2;
  }

  .dala-main-shell {
    margin-left: 0;
  }

  input:focus, select:focus, textarea:focus {
    outline: none !important;
    border-color: #2be3b4 !important;
    box-shadow: 0 0 0 4px rgba(43, 227, 180, 0.08) !important;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(126, 155, 160, 0.18); border-radius: 999px; }

  @media (min-width: 980px) {
    .dala-sidebar {
      transform: translateX(0) !important;
    }

    .dala-main-shell {
      margin-left: 306px;
    }
  }

  @media (max-width: 979px) {
    .dala-main-shell {
      width: 100%;
    }
  }

  @media (max-width: 720px) {
    .dala-main-shell main {
      padding: 0 12px 18px !important;
    }

    .dala-main-shell main > div {
      padding: 20px !important;
      border-radius: 22px !important;
    }
  }
`
