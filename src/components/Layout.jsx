import { useState } from 'react'
import { useAuth } from '../App'
import { Alert, Button, Input, Modal } from './ui'

const NAV = [
  { section: 'Overview' },
  { id: 'dashboard', label: 'Dashboard', icon: '▣', roles: ['admin', 'warehouse_manager', 'operations', 'finance', 'security'] },
  { id: 'how-it-works', label: 'How It Works', icon: 'i', roles: ['admin', 'warehouse_manager', 'operations', 'finance', 'security'] },
  { section: 'Warehouse Flow' },
  { id: 'grn', label: 'Stock Intake (GRN)', icon: '↓', roles: ['admin', 'warehouse_manager'] },
  { id: 'dispatch', label: 'Dispatch', icon: '↑', roles: ['admin', 'operations', 'warehouse_manager', 'security'] },
  { id: 'ledger', label: 'Ledger', icon: '≡', roles: ['admin', 'warehouse_manager', 'operations', 'finance'] },
  { section: 'Risk And Control' },
  { id: 'expiry', label: 'Expiry Tracking', icon: '◔', roles: ['admin', 'warehouse_manager', 'operations', 'finance'] },
  { id: 'casualties', label: 'Casualties', icon: '!', roles: ['admin', 'warehouse_manager', 'operations'] },
  { id: 'reorder', label: 'Reorder Alerts', icon: '•', roles: ['admin', 'warehouse_manager', 'operations', 'finance'] },
  { id: 'performance', label: 'Partner Performance', icon: '◇', roles: ['admin', 'operations', 'finance'] },
  { section: 'Reconciliation' },
  { id: 'count', label: 'Physical Count', icon: '✓', roles: ['admin', 'warehouse_manager', 'operations'] },
  { id: 'reports', label: 'Reports & Export', icon: '↗', roles: ['admin', 'warehouse_manager', 'operations', 'finance'] },
  { section: 'Setup' },
  { id: 'products', label: 'Products', icon: '□', roles: ['admin', 'warehouse_manager', 'operations'] },
  { id: 'partners', label: 'Brand Partners', icon: '○', roles: ['admin', 'operations'] },
  { id: 'users', label: 'Users', icon: '⊕', roles: ['admin'] },
  { id: 'admin-audit', label: 'Admin Audit', icon: '⌘', roles: ['admin'] },
]

const ROLE_COLORS = {
  admin: '#c96558',
  warehouse_manager: '#d48779',
  operations: '#d29b6f',
  finance: '#c7a484',
  security: '#b86d64',
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
      setTimeout(() => setShowPasswordModal(false), 800)
    } catch (error) {
      setPasswordAlert({ message: error.message, type: 'error' })
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div style={shellStyle}>
      <style>{globalStyles}</style>

      {sidebarOpen && <div style={backdropStyle} onClick={() => setSidebarOpen(false)} />}

      <aside
        style={{
          ...sidebarStyle,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-108%)',
        }}
        className="dala-sidebar"
      >
        <div style={brandBlockStyle}>
          <div style={brandWordmarkStyle}>
            DALA <span style={{ color: '#d48779' }}>WMS</span>
          </div>
          <div style={brandMetaStyle}>Warehouse control system</div>
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
                  color: active ? '#fff4f1' : '#aaafb1',
                  background: active ? 'rgba(212, 135, 121, 0.16)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(212, 135, 121, 0.28)' : '1px solid rgba(255,255,255,0.05)',
                }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div style={footerCardStyle}>
          <div style={{ fontSize: 13, color: '#f4efee', fontWeight: 600 }}>{profile?.full_name}</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#8b8d90', marginTop: 4 }}>
            Signed in
          </div>
          <div style={rolePillStyle(profile?.role)}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ROLE_COLORS[profile?.role] || '#d48779' }} />
            {(profile?.role || 'user').replace('_', ' ')}
          </div>
          <button onClick={() => setShowPasswordModal(true)} style={secondaryButtonStyle}>Change Password</button>
          <button onClick={() => logout()} style={logoutButtonStyle}>Sign Out</button>
        </div>
      </aside>

      <div style={mainShellStyle} className="dala-main-shell">
        <header style={topbarStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => setSidebarOpen((open) => !open)} style={menuButtonStyle}>
              ☰
            </button>
            <div>
              <div style={topbarEyebrowStyle}>Current page</div>
              <div style={topbarTitleStyle}>{currentLabel}</div>
            </div>
          </div>

          <div style={topbarMetaStyle}>
            <div style={topbarPillStyle}>
              <span style={pulseDotStyle} />
              {(profile?.role || 'user').replace('_', ' ')}
            </div>
            <div style={topbarDateStyle}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
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
        <Modal
          title="Change Password"
          onClose={() => {
            setShowPasswordModal(false)
            setPasswordAlert({ message: '', type: 'success' })
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
          }}
        >
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

const shellStyle = {
  minHeight: '100vh',
  background: '#171312',
  color: '#ddd6d4',
  display: 'flex',
  position: 'relative',
  fontFamily: 'DM Sans, sans-serif',
}

const backdropStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 70,
  background: 'rgba(10, 8, 8, 0.7)',
  backdropFilter: 'blur(3px)',
}

const sidebarStyle = {
  position: 'fixed',
  top: 16,
  left: 16,
  bottom: 16,
  width: 286,
  zIndex: 80,
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 22,
  border: '1px solid rgba(212, 135, 121, 0.14)',
  background: 'linear-gradient(180deg, #1c1716 0%, #141110 100%)',
  boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
  transition: 'transform 0.22s ease',
}

const brandBlockStyle = {
  padding: '24px 22px 18px',
  borderBottom: '1px solid rgba(212, 135, 121, 0.12)',
}

const brandWordmarkStyle = {
  fontFamily: 'Syne, sans-serif',
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: '-0.04em',
  color: '#f7f1ef',
}

const brandMetaStyle = {
  marginTop: 6,
  fontFamily: 'DM Mono, monospace',
  fontSize: 10,
  color: '#918685',
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
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
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#766665',
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
  color: '#b8b0ae',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 13,
  fontWeight: 500,
  transition: 'all 0.16s ease',
}

const navButtonActiveStyle = {
  color: '#fff4f1',
  border: '1px solid rgba(212, 135, 121, 0.3)',
  background: 'linear-gradient(135deg, rgba(181, 94, 80, 0.34) 0%, rgba(122, 63, 54, 0.3) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
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
  border: '1px solid rgba(212, 135, 121, 0.12)',
  background: 'rgba(255,255,255,0.02)',
}

function rolePillStyle(role) {
  const color = ROLE_COLORS[role] || '#d48779'
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    borderRadius: 999,
    padding: '5px 10px',
    background: 'rgba(212, 135, 121, 0.08)',
    color,
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  }
}

const secondaryButtonStyle = {
  width: '100%',
  marginTop: 14,
  padding: '11px 0',
  borderRadius: 12,
  border: '1px solid rgba(212, 135, 121, 0.18)',
  background: 'rgba(212, 135, 121, 0.08)',
  color: '#e4b7b0',
  cursor: 'pointer',
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
}

const logoutButtonStyle = {
  width: '100%',
  marginTop: 10,
  padding: '11px 0',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: '#11100f',
  color: '#bcaead',
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
}

const topbarStyle = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  height: 84,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '18px 24px 14px',
  background: 'rgba(23, 19, 18, 0.94)',
  borderBottom: '1px solid rgba(212, 135, 121, 0.08)',
  backdropFilter: 'blur(10px)',
}

const menuButtonStyle = {
  width: 42,
  height: 42,
  borderRadius: 12,
  border: '1px solid rgba(212, 135, 121, 0.16)',
  background: 'rgba(255,255,255,0.03)',
  color: '#eee4e2',
  cursor: 'pointer',
  fontSize: 18,
}

const topbarEyebrowStyle = {
  fontFamily: 'DM Mono, monospace',
  fontSize: 10,
  letterSpacing: '0.16em',
  color: '#8c807f',
  textTransform: 'uppercase',
}

const topbarTitleStyle = {
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  fontSize: 18,
  color: '#f7f1ef',
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
  border: '1px solid rgba(212, 135, 121, 0.16)',
  background: 'rgba(212, 135, 121, 0.08)',
  color: '#dfb0a8',
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const pulseDotStyle = {
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: '#d48779',
}

const topbarDateStyle = {
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  color: '#8c807f',
  letterSpacing: '0.08em',
}

const mainContentStyle = {
  flex: 1,
  padding: '0 18px 22px',
}

const contentFrameStyle = {
  minHeight: 'calc(100vh - 112px)',
  borderRadius: 26,
  border: '1px solid rgba(212, 135, 121, 0.08)',
  background: `
    linear-gradient(180deg, rgba(24, 21, 20, 0.96) 0%, rgba(18, 16, 15, 0.98) 100%),
    repeating-linear-gradient(
      90deg,
      rgba(255,255,255,0.012) 0,
      rgba(255,255,255,0.012) 1px,
      transparent 1px,
      transparent 44px
    )
  `,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
  padding: 28,
}

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { min-height: 100%; }
  body {
    background:
      radial-gradient(circle at top left, rgba(212,135,121,0.08), transparent 24%),
      radial-gradient(circle at bottom right, rgba(102,73,66,0.12), transparent 20%),
      #171312;
  }

  .dala-sidebar button:hover {
    border-color: rgba(212, 135, 121, 0.16);
    background: rgba(255,255,255,0.04);
    color: #f3e9e7;
  }

  .dala-main-shell {
    margin-left: 0;
  }

  input:focus, select:focus, textarea:focus {
    outline: none !important;
    border-color: #d48779 !important;
    box-shadow: 0 0 0 4px rgba(212, 135, 121, 0.10) !important;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(212, 135, 121, 0.18); border-radius: 999px; }

  @media (min-width: 980px) {
    .dala-sidebar {
      transform: translateX(0) !important;
    }

    .dala-main-shell {
      margin-left: 304px;
    }
  }

  @media (max-width: 979px) {
    .dala-main-shell {
      width: 100%;
    }
  }

  @media (max-width: 720px) {
    .dala-main-shell main {
      padding: 0 10px 14px !important;
    }

    .dala-main-shell main > div {
      padding: 18px !important;
      border-radius: 20px !important;
    }
  }
`
