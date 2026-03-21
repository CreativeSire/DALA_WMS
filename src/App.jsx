import { useState, useEffect, createContext, useContext } from 'react'
import { createClient } from '@supabase/supabase-js'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import GRNPage from './pages/GRNPage'
import DispatchPage from './pages/DispatchPage'
import LedgerPage from './pages/LedgerPage'
import ExpiryPage from './pages/ExpiryPage'
import CasualtyPage from './pages/CasualtyPage'
import ReorderPage from './pages/ReorderPage'
import PartnerPerformancePage from './pages/PartnerPerformancePage'
import PhysicalCountPage from './pages/PhysicalCountPage'
import ReportsPage from './pages/ReportsPage'
import HowItWorksPage from './pages/HowItWorksPage'
import { ProductsPage, BrandPartnersPage, UsersPage } from './pages/ProductsPage'
import Layout from './components/Layout'
import { createApiClient } from './lib/apiClient'

const runtimeConfig = globalThis.__APP_CONFIG__ || {}
const supabaseUrl = runtimeConfig.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = runtimeConfig.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
const apiBaseUrl = runtimeConfig.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE_URL
const hasBackendApi = Boolean(apiBaseUrl)
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseAnonKey) : null
export const api = hasBackendApi ? createApiClient(apiBaseUrl) : null

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export default function App() {
  const previewMode = globalThis.__DALA_PREVIEW__ || new URLSearchParams(window.location.search).get('preview')
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')

  if (previewMode === 'manual') {
    return <HowItWorksPage />
  }

  if (!hasSupabaseConfig && !hasBackendApi) {
    return <DeploymentSetupPage />
  }

  useEffect(() => {
    if (hasBackendApi) {
      refreshAuth()
      return undefined
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function refreshAuth() {
    if (hasBackendApi) {
      try {
        const data = await api.get('/auth/me')
        setProfile(data.user)
        setSession(data.user ? { user: data.user } : null)
      } catch (_error) {
        setProfile(null)
        setSession(null)
      } finally {
        setLoading(false)
      }
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    setSession(session)
    if (session) await fetchProfile(session.user.id)
    else setLoading(false)
  }

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  async function logout() {
    if (hasBackendApi) {
      try {
        await api.post('/auth/logout')
      } finally {
        setSession(null)
        setProfile(null)
      }
      return
    }

    await supabase.auth.signOut()
  }

  if (loading) return (
    <LoadingScreen />
  )

  if (!session) return (
    <AuthContext.Provider value={{ session, profile, supabase, api, authMode: hasBackendApi ? 'api' : 'supabase', refreshAuth, logout }}>
      <LoginPage />
    </AuthContext.Provider>
  )

  const can = (roles) => roles.includes(profile?.role)

  const renderPage = () => {
    switch (page) {
      // ── Core ──────────────────────────────────────────────
      case 'dashboard':    return <Dashboard setPage={setPage} />
      case 'how-it-works': return <HowItWorksPage />
      // ── Phase 1 — Stock ───────────────────────────────────
      case 'grn':          return can(['admin','warehouse_manager']) ? <GRNPage /> : <AccessDenied />
      case 'dispatch':     return can(['admin','operations','warehouse_manager','security']) ? <DispatchPage /> : <AccessDenied />
      case 'ledger':       return <LedgerPage />
      // ── Phase 2 — Intelligence ────────────────────────────
      case 'expiry':       return can(['admin','warehouse_manager','operations','finance']) ? <ExpiryPage /> : <AccessDenied />
      case 'casualties':   return can(['admin','warehouse_manager','operations']) ? <CasualtyPage /> : <AccessDenied />
      case 'reorder':      return can(['admin','warehouse_manager','operations','finance']) ? <ReorderPage /> : <AccessDenied />
      case 'performance':  return can(['admin','operations','finance']) ? <PartnerPerformancePage /> : <AccessDenied />
      // ── Phase 3 — Reconciliation ──────────────────────────
      case 'count':        return can(['admin','warehouse_manager','operations']) ? <PhysicalCountPage /> : <AccessDenied />
      case 'reports':      return can(['admin','warehouse_manager','operations','finance']) ? <ReportsPage /> : <AccessDenied />
      // ── Setup ─────────────────────────────────────────────
      case 'products':     return can(['admin','warehouse_manager','operations']) ? <ProductsPage /> : <AccessDenied />
      case 'partners':     return can(['admin','operations']) ? <BrandPartnersPage /> : <AccessDenied />
      case 'users':        return can(['admin']) ? <UsersPage /> : <AccessDenied />
      default:             return <Dashboard setPage={setPage} />
    }
  }

  return (
    <AuthContext.Provider value={{ session, profile, supabase, api, authMode: hasBackendApi ? 'api' : 'supabase', refreshAuth, logout }}>
      <Layout page={page} setPage={setPage}>{renderPage()}</Layout>
    </AuthContext.Provider>
  )
}

function AccessDenied() {
  return (
    <ScreenFrame
      eyebrow="Restricted"
      title="Access denied"
      copy="Your assigned role does not permit this module. Use a role with the correct operational scope or return to a page you can access."
      accent="#ff8552"
    />
  )
}

function DeploymentSetupPage() {
  return (
    <div style={setupShellStyle}>
      <style>{setupStyles}</style>
      <div style={setupOrbStyle('10%', '8%', '#2be3b4')} />
      <div style={setupOrbStyle('58%', '12%', '#ff8552')} />
      <div style={setupOrbStyle('auto', '42%', '#6dc6ff', '72%')} />

      <div style={{ maxWidth: 1180, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 34, letterSpacing: '-0.04em', color: '#f4fbf8' }}>
            DALA <span style={{ color: '#2be3b4' }}>WMS</span>
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6f858d', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 6 }}>
            Deployment Setup Required
          </div>
        </div>

        <div className="setup-grid" style={setupGridStyle}>
          <div style={setupIntroCardStyle}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 34, lineHeight: 1.02, color: '#f2f8f6', letterSpacing: '-0.04em' }}>
              This deployment needs its backend target before the live app can open.
            </div>
            <div style={{ marginTop: 16, fontSize: 15, lineHeight: 1.7, color: '#98aeb2', maxWidth: 680 }}>
              Point the frontend at the Railway API service using `VITE_API_BASE_URL` and redeploy. The setup screen is only a guard rail so blank environments do not crash.
            </div>

            <div style={setupChecklistCardStyle}>
              <SetupBullet>Use the active app domain, not an old Railway alias.</SetupBullet>
              <SetupBullet>Set `VITE_API_BASE_URL` to your Railway API public URL.</SetupBullet>
              <SetupBullet>Confirm the API service is healthy before redeploying the frontend.</SetupBullet>
            </div>
          </div>

          <div style={setupVarsCardStyle}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: '#f2f8f6', marginBottom: 10 }}>
              Required environment
            </div>
            <div style={{ fontSize: 14, color: '#8ea4a9', lineHeight: 1.6, marginBottom: 18 }}>
              For the Railway backend deployment path, only the API base URL is required on the frontend.
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <EnvRow name="VITE_API_BASE_URL" value="https://your-railway-api.up.railway.app" />
              <EnvRow name="VITE_SUPABASE_URL" value="Optional only if you still run the Supabase fallback path" />
              <EnvRow name="VITE_SUPABASE_ANON_KEY" value="Optional only if you still run the Supabase fallback path" />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <HowItWorksPage />
        </div>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <ScreenFrame
      eyebrow="Loading"
      title="Starting the live workspace"
      copy="The frontend is checking your configured backend and restoring the active session."
      accent="#2be3b4"
    />
  )
}

function EnvRow({ name, value }) {
  return (
    <div style={{ background: 'rgba(5,10,12,0.7)', border: '1px solid rgba(126, 155, 160, 0.12)', borderRadius: 16, padding: 16 }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#2be3b4', letterSpacing: '0.12em', marginBottom: 8 }}>
        {name}
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#7f969d', wordBreak: 'break-all', lineHeight: 1.6 }}>
        {value}
      </div>
    </div>
  )
}

function SetupBullet({ children }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2be3b4', marginTop: 7, flexShrink: 0 }} />
      <span style={{ color: '#b8c9cb', fontSize: 14, lineHeight: 1.6 }}>{children}</span>
    </div>
  )
}

function ScreenFrame({ eyebrow, title, copy, accent }) {
  return (
    <div style={screenShellStyle}>
      <style>{setupStyles}</style>
      <div style={setupOrbStyle('12%', '9%', accent)} />
      <div style={setupOrbStyle('60%', '12%', '#6dc6ff')} />
      <div style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '40px 32px',
        borderRadius: 28,
        border: '1px solid rgba(126, 155, 160, 0.12)',
        background: 'linear-gradient(180deg, rgba(15,28,30,0.96) 0%, rgba(8,15,17,0.98) 100%)',
        boxShadow: '0 26px 70px rgba(0,0,0,0.28)',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: accent, marginBottom: 14 }}>
          {eyebrow}
        </div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 38, fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.05em', color: '#f4fbf8' }}>
          {title}
        </div>
        <div style={{ marginTop: 16, color: '#97adb1', fontSize: 15, lineHeight: 1.7 }}>
          {copy}
        </div>
      </div>
    </div>
  )
}

const screenShellStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: '#071012',
  position: 'relative',
  overflow: 'hidden',
}

const setupShellStyle = {
  minHeight: '100vh',
  background: '#071012',
  color: '#e0e8ea',
  fontFamily: 'DM Sans, sans-serif',
  padding: '32px 18px 48px',
  position: 'relative',
  overflow: 'hidden',
}

const setupGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1.1fr 0.9fr',
  gap: 20,
}

const setupIntroCardStyle = {
  borderRadius: 28,
  padding: '34px 30px',
  border: '1px solid rgba(126, 155, 160, 0.12)',
  background: 'linear-gradient(180deg, rgba(14,26,28,0.96) 0%, rgba(8,15,17,0.98) 100%)',
  boxShadow: '0 24px 70px rgba(0,0,0,0.26)',
}

const setupChecklistCardStyle = {
  marginTop: 24,
  borderRadius: 20,
  border: '1px solid rgba(126, 155, 160, 0.12)',
  background: 'rgba(255,255,255,0.03)',
  padding: '18px 18px 8px',
}

const setupVarsCardStyle = {
  borderRadius: 28,
  padding: '30px 26px',
  border: '1px solid rgba(126, 155, 160, 0.12)',
  background: 'linear-gradient(180deg, rgba(18,29,32,0.96) 0%, rgba(9,17,19,0.98) 100%)',
  boxShadow: '0 24px 70px rgba(0,0,0,0.26)',
}

function setupOrbStyle(top, right, color, left = 'auto') {
  return {
    position: 'fixed',
    top,
    right,
    left,
    width: 280,
    height: 280,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
    filter: 'blur(22px)',
    pointerEvents: 'none',
  }
}

const setupStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  * { box-sizing: border-box; }

  @media (max-width: 960px) {
    .setup-grid {
      grid-template-columns: 1fr !important;
    }
  }
`
