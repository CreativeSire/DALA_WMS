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
  const [page, setPage] = useState(hasBackendApi && !hasSupabaseConfig ? 'how-it-works' : 'dashboard')

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
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0b0f10', color:'#00e5a0', fontFamily:'DM Mono, monospace', fontSize:13, letterSpacing:'0.1em' }}>
      LOADING DALA WMS...
    </div>
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
      case 'dashboard':    return hasBackendApi && !hasSupabaseConfig ? <BackendMigrationPage page="Dashboard" /> : <Dashboard setPage={setPage} />
      case 'how-it-works': return <HowItWorksPage />
      // ── Phase 1 — Stock ───────────────────────────────────
      case 'grn':          return hasBackendApi && !hasSupabaseConfig ? <BackendMigrationPage page="Stock Intake (GRN)" /> : can(['admin','warehouse_manager']) ? <GRNPage /> : <AccessDenied />
      case 'dispatch':     return hasBackendApi && !hasSupabaseConfig ? <BackendMigrationPage page="Dispatch" /> : can(['admin','operations','warehouse_manager','security']) ? <DispatchPage /> : <AccessDenied />
      case 'ledger':       return hasBackendApi && !hasSupabaseConfig ? <BackendMigrationPage page="Ledger" /> : <LedgerPage />
      // ── Phase 2 — Intelligence ────────────────────────────
      case 'expiry':       return hasBackendApi && !hasSupabaseConfig ? <BackendMigrationPage page="Expiry Tracking" /> : can(['admin','warehouse_manager','operations','finance']) ? <ExpiryPage /> : <AccessDenied />
      case 'casualties':   return hasBackendApi && !hasSupabaseConfig ? <BackendMigrationPage page="Casualties" /> : can(['admin','warehouse_manager','operations']) ? <CasualtyPage /> : <AccessDenied />
      case 'reorder':      return hasBackendApi && !hasSupabaseConfig ? <BackendMigrationPage page="Reorder Alerts" /> : can(['admin','warehouse_manager','operations','finance']) ? <ReorderPage /> : <AccessDenied />
      case 'performance':  return hasBackendApi && !hasSupabaseConfig ? <BackendMigrationPage page="Partner Performance" /> : can(['admin','operations','finance']) ? <PartnerPerformancePage /> : <AccessDenied />
      // ── Phase 3 — Reconciliation ──────────────────────────
      case 'count':        return hasBackendApi && !hasSupabaseConfig ? <BackendMigrationPage page="Physical Count" /> : can(['admin','warehouse_manager','operations']) ? <PhysicalCountPage /> : <AccessDenied />
      case 'reports':      return hasBackendApi && !hasSupabaseConfig ? <BackendMigrationPage page="Reports & Export" /> : can(['admin','warehouse_manager','operations','finance']) ? <ReportsPage /> : <AccessDenied />
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
    <div style={{ padding:48, textAlign:'center', color:'#ff6b35', fontFamily:'DM Mono, monospace', fontSize:13 }}>
      ACCESS DENIED — Your role does not permit viewing this page.
    </div>
  )
}

function DeploymentSetupPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0b0f10', color: '#e0e8ea', fontFamily: 'DM Sans, sans-serif', padding: '32px 20px 48px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em' }}>
            DALA <span style={{ color: '#00e5a0' }}>WMS</span>
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3e555d', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>
            Deployment Setup Required
          </div>
        </div>

        <div style={{ background: '#111618', border: '1px solid #1a2224', borderRadius: 10, padding: 24, marginBottom: 24 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
            This deployment is reviewable, but no data backend is configured yet.
          </div>
          <div style={{ fontSize: 14, color: '#93a7ac', lineHeight: 1.6, marginBottom: 16 }}>
            Configure either the legacy Supabase frontend variables or the new Railway backend API base URL, then redeploy. Until then, the embedded operator manual stays available so you can review the workflow and page model safely.
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <EnvRow name="VITE_API_BASE_URL" value="https://your-railway-api.up.railway.app" />
            <EnvRow name="VITE_SUPABASE_URL" value="https://YOUR_PROJECT_ID.supabase.co" />
            <EnvRow name="VITE_SUPABASE_ANON_KEY" value="YOUR_SUPABASE_ANON_KEY" />
          </div>
        </div>

        <HowItWorksPage />
      </div>
    </div>
  )
}

function BackendMigrationPage({ page }) {
  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ background: '#111618', border: '1px solid #1a2224', borderRadius: 10, padding: 24 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: '#e0e8ea', marginBottom: 8 }}>
          {page} is not on the Railway backend yet.
        </div>
        <div style={{ fontSize: 14, color: '#93a7ac', lineHeight: 1.6, marginBottom: 16 }}>
          Auth, users, products, and brand partners can already run against the new backend. Inventory, movement, and reporting pages still require the remaining migration work from the Railway backend plan.
        </div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#00e5a0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Current backend-ready modules: Login, Users, Products, Brand Partners
        </div>
      </div>
    </div>
  )
}

function EnvRow({ name, value }) {
  return (
    <div style={{ background: '#0b0f10', border: '1px solid #1a2224', borderRadius: 8, padding: 14 }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#00e5a0', letterSpacing: '0.08em', marginBottom: 6 }}>
        {name}
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#70878d', wordBreak: 'break-all' }}>
        {value}
      </div>
    </div>
  )
}
