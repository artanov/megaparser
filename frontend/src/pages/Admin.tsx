import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrap } from '../api/client'
import { PublishLog, Stats } from '../types'

interface Props {
  onLogout: () => void
}

export default function Admin({ onLogout }: Props) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [logs, setLogs] = useState<PublishLog[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [targetFilter, setTargetFilter] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/admin/stats').then(res => {
      setStats(unwrap<Stats>(res))
    }).catch(() => {})
    loadLogs()
  }, [])

  async function loadLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from_', from)
      if (to) params.set('to', to)
      if (sourceFilter) params.set('source_channel', sourceFilter)
      if (targetFilter) params.set('target_channel', targetFilter)
      const res = await api.get(`/admin/logs?${params}`)
      setLogs(unwrap<PublishLog[]>(res))
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await api.post('/auth/logout')
    onLogout()
  }

  return (
    <div style={styles.root}>
      {/* Top bar */}
      <div style={styles.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link to="/" style={styles.navLink}>← DASHBOARD</Link>
          <span style={styles.logo}>Admin</span>
        </div>
        <button onClick={handleLogout} className="btn-secondary" style={{ padding: '6px 12px' }}>
          LOGOUT
        </button>
      </div>

      <div style={styles.content}>
        {/* Stats */}
        <div style={styles.statsRow} className="admin-stats">
          {[
            { label: 'PARSED', value: stats?.total_parsed ?? '—' },
            { label: 'PUBLISHED', value: stats?.total_sent ?? '—' },
            { label: 'DISCARDED', value: stats?.total_discarded ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} style={styles.statCard}>
              <span className="label">{label}</span>
              <span style={styles.statValue}>{value}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={styles.filters} className="admin-filters">
          <div style={styles.filterGroup}>
            <label className="label" style={styles.filterLabel}>FROM</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              style={styles.filterInput}
            />
          </div>
          <div style={styles.filterGroup}>
            <label className="label" style={styles.filterLabel}>TO</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              style={styles.filterInput}
            />
          </div>
          <div style={styles.filterGroup}>
            <label className="label" style={styles.filterLabel}>SOURCE</label>
            <input
              type="text"
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              placeholder="channel username"
              style={styles.filterInput}
            />
          </div>
          <div style={styles.filterGroup}>
            <label className="label" style={styles.filterLabel}>TARGET</label>
            <input
              type="text"
              value={targetFilter}
              onChange={e => setTargetFilter(e.target.value)}
              placeholder="channel username"
              style={styles.filterInput}
            />
          </div>
          <button className="btn-accent" onClick={loadLogs} disabled={loading} style={styles.applyBtn}>
            APPLY
          </button>
        </div>

        {/* Table */}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                {['DATE', 'SOURCE', 'TARGET', 'ORIGINAL', 'REWRITTEN', 'MEDIA'].map(h => (
                  <th key={h} style={styles.th} className="label">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    Loading…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    No logs found
                  </td>
                </tr>
              ) : logs.map((log, i) => (
                <tr
                  key={log.id}
                  style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}
                >
                  <td style={styles.td}>
                    {new Date(log.published_at).toLocaleDateString()}{' '}
                    <span style={{ color: 'var(--text-muted)' }}>
                      {new Date(log.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    @{log.source_channel_username}
                  </td>
                  <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    @{log.target_channel_username}
                  </td>
                  <td style={{ ...styles.td, maxWidth: 240 }}>
                    <span style={styles.snippet} title={log.original_text_snippet}>
                      {log.original_text_snippet || '—'}
                    </span>
                  </td>
                  <td style={{ ...styles.td, maxWidth: 240 }}>
                    <span style={styles.snippet} title={log.rewritten_text_snippet ?? ''}>
                      {log.rewritten_text_snippet || '—'}
                    </span>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {log.media_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    background: 'var(--bg)',
  },
  topbar: {
    height: 52, flexShrink: 0,
    background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px',
  },
  navLink: {
    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
    letterSpacing: '0.08em', transition: 'color 150ms ease',
  },
  logo: {
    fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 13,
    color: 'var(--text)', letterSpacing: '0.05em',
  },
  content: {
    flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 24,
  },
  statsRow: {
    display: 'flex', gap: 16,
  },
  statCard: {
    flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
    padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8,
  },
  statValue: {
    fontSize: 32, fontWeight: 600, fontFamily: 'var(--font-mono)',
    color: 'var(--text)',
  },
  filters: {
    display: 'flex', gap: 16, alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  filterGroup: {
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  filterLabel: {
    display: 'block',
  },
  filterInput: {
    padding: '8px 12px', width: 160,
  },
  applyBtn: {
    padding: '8px 20px', alignSelf: 'flex-end',
  },
  tableWrap: {
    overflow: 'auto', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
  },
  thead: {
    background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
  },
  th: {
    padding: '10px 14px', textAlign: 'left', whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 14px', fontSize: 13, color: 'var(--text)',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top',
  },
  snippet: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    fontSize: 12,
    color: 'var(--text-muted)',
  },
}
