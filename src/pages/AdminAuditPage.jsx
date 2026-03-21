import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../App'
import { Alert, Badge, Card, EmptyState, Input, PageHeader, SectionCard, StatStrip, Table } from '../components/ui'

const ACTION_COLORS = {
  user_created: '#2be3b4',
  invite_sent: '#6dc6ff',
  user_activated: '#2be3b4',
  user_deactivated: '#ff8552',
  password_reset: '#f5b85c',
  password_changed: '#6dc6ff',
  email_delivery_failed: '#ff8552',
  email_delivery_sent: '#2be3b4',
}

export default function AdminAuditPage() {
  const { api } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [alert, setAlert] = useState({ message: '', type: 'success' })

  useEffect(() => {
    loadLogs()
  }, [])

  async function loadLogs() {
    setLoading(true)
    try {
      const { logs } = await api.get('/api/admin/audit-logs?limit=150')
      setLogs(logs || [])
    } catch (error) {
      setAlert({ message: error.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase()
    return logs.filter((log) => {
      if (!query) return true
      return [
        log.summary,
        log.actor?.full_name,
        log.actor?.email,
        log.target?.full_name,
        log.target?.email,
        log.action,
      ].some((value) => value?.toLowerCase().includes(query))
    })
  }, [logs, search])

  return (
    <div>
      <PageHeader
        title="Admin Audit Log"
        subtitle="See who changed access, sent invites, reset passwords, and whether email delivery worked."
      />

      <Alert message={alert.message} type={alert.type} />

      <SectionCard
        eyebrow="Control Review"
        title="Sensitive actions in one place"
        subtitle="This helps DALA track admin changes without relying on private notes, memory, or side spreadsheets."
        style={{ marginBottom: 20 }}
      >
        <StatStrip items={[
          { label: 'Visible Logs', value: filteredLogs.length, accent: '#6dc6ff' },
          { label: 'Invites', value: logs.filter((item) => item.action === 'invite_sent').length, accent: '#2be3b4' },
          { label: 'Password Events', value: logs.filter((item) => item.action === 'password_reset' || item.action === 'password_changed').length, accent: '#f5b85c' },
          { label: 'Email Failures', value: logs.filter((item) => item.action === 'email_delivery_failed').length, accent: '#ff8552' },
        ]} />
      </SectionCard>

      <SectionCard style={{ marginBottom: 20 }}>
        <Input
          label="Search audit records"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by user, email, summary, or action..."
          style={{ marginBottom: 0, maxWidth: 420 }}
        />
      </SectionCard>

      {loading ? (
        <Card>
          <div style={{ color: '#7d959a', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>Loading admin audit log...</div>
        </Card>
      ) : filteredLogs.length === 0 ? (
        <EmptyState title="No admin audit records found" copy="Admin actions will appear here when users are created, invited, reset, or switched on and off." />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table
            headers={['When', 'Action', 'Done By', 'Affected User', 'What Happened', 'Email']}
            rows={filteredLogs.map((log) => [
              <div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#d6e3e0' }}>
                  {new Date(log.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6f858d' }}>
                  {new Date(log.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>,
              <Badge color={ACTION_COLORS[log.action] || '#6f858d'}>{humanizeAction(log.action)}</Badge>,
              <div>
                <div style={{ color: '#e5efed', fontWeight: 600 }}>{log.actor?.full_name || 'System'}</div>
                <div style={{ fontSize: 11, color: '#6f858d' }}>{log.actor?.email || '—'}</div>
              </div>,
              <div>
                <div style={{ color: '#e5efed', fontWeight: 600 }}>{log.target?.full_name || 'Not tied to one user'}</div>
                <div style={{ fontSize: 11, color: '#6f858d' }}>{log.target?.email || '—'}</div>
              </div>,
              <span style={{ color: '#b7c7c9', fontSize: 12 }}>{log.summary}</span>,
              <Badge color={log.details?.status === 'sent' || log.details?.email_status === 'sent' ? '#2be3b4' : '#6f858d'}>
                {log.details?.status || log.details?.email_status || 'n/a'}
              </Badge>,
            ])}
          />
        </Card>
      )}
    </div>
  )
}

function humanizeAction(action) {
  return action.replaceAll('_', ' ')
}
