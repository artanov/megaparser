import { useState } from 'react'
import { api, unwrap } from '../api/client'
import { MyChannel, SourceChannel } from '../types'

interface Props {
  myChannels: MyChannel[]
  sourceChannels: Record<number, SourceChannel[]>
  selectedSourceId: number | null
  onSelectSource: (src: SourceChannel) => void
  onChannelAdded: (ch: MyChannel) => void
  onSourceAdded: (src: SourceChannel) => void
  onChannelDeleted: (id: number) => void
  onSourceDeleted: (id: number) => void
}

export default function Sidebar({
  myChannels, sourceChannels, selectedSourceId,
  onSelectSource, onChannelAdded, onSourceAdded,
  onChannelDeleted, onSourceDeleted,
}: Props) {
  const [addingChannel, setAddingChannel] = useState(false)
  const [newChannelUsername, setNewChannelUsername] = useState('')
  const [addingSourceFor, setAddingSourceFor] = useState<number | null>(null)
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAddChannel(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/channels/my', { username: newChannelUsername })
      const ch = unwrap<MyChannel>(res)
      onChannelAdded(ch)
      setNewChannelUsername('')
      setAddingChannel(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddSource(e: React.FormEvent, myChannelId: number) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/channels/sources', { url: newSourceUrl, my_channel_id: myChannelId })
      const src = unwrap<SourceChannel>(res)
      onSourceAdded(src)
      setNewSourceUrl('')
      setAddingSourceFor(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteChannel(id: number) {
    if (!confirm('Delete this channel and all its sources?')) return
    await api.delete(`/channels/my/${id}`)
    onChannelDeleted(id)
  }

  async function handleDeleteSource(id: number) {
    await api.delete(`/channels/sources/${id}`)
    onSourceDeleted(id)
  }

  return (
    <div style={styles.sidebar}>
      <div style={styles.sidebarHeader}>
        <span className="label">Channels</span>
      </div>

      <div style={styles.channelList}>
        {myChannels.map(ch => (
          <div key={ch.id} style={styles.channelGroup}>
            <div style={styles.channelRow}>
              <span style={styles.channelTitle}>{ch.title || ch.username}</span>
              <button
                style={styles.deleteBtn}
                onClick={() => handleDeleteChannel(ch.id)}
                title="Delete channel"
              >✕</button>
            </div>

            <div style={styles.sourceList}>
              {(sourceChannels[ch.id] || []).map(src => (
                <div
                  key={src.id}
                  style={{
                    ...styles.sourceRow,
                    background: selectedSourceId === src.id ? 'var(--surface-2)' : 'transparent',
                    borderColor: selectedSourceId === src.id ? 'var(--border-hover)' : 'transparent',
                  }}
                  onClick={() => onSelectSource(src)}
                >
                  <span style={styles.sourceUsername}>@{src.username}</span>
                  <button
                    style={styles.deleteBtn}
                    onClick={e => { e.stopPropagation(); handleDeleteSource(src.id) }}
                    title="Remove source"
                  >✕</button>
                </div>
              ))}

              {addingSourceFor === ch.id ? (
                <form onSubmit={e => handleAddSource(e, ch.id)} style={styles.inlineForm}>
                  <input
                    value={newSourceUrl}
                    onChange={e => setNewSourceUrl(e.target.value)}
                    placeholder="t.me/channel or @channel"
                    required
                    autoFocus
                    style={styles.inlineInput}
                  />
                  <button type="submit" className="btn-accent" disabled={loading} style={styles.inlineBtn}>
                    {loading ? '…' : 'ADD'}
                  </button>
                  <button
                    type="button"
                    style={styles.cancelBtn}
                    onClick={() => { setAddingSourceFor(null); setError('') }}
                  >✕</button>
                </form>
              ) : (
                <button
                  style={styles.addBtn}
                  onClick={() => { setAddingSourceFor(ch.id); setAddingChannel(false) }}
                >
                  ＋ Add source
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {addingChannel ? (
        <form onSubmit={handleAddChannel} style={styles.addChannelForm}>
          <input
            value={newChannelUsername}
            onChange={e => setNewChannelUsername(e.target.value)}
            placeholder="@yourchannel"
            required
            autoFocus
            style={styles.inlineInput}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="submit" className="btn-accent" disabled={loading} style={styles.inlineBtn}>
              {loading ? '…' : 'ADD'}
            </button>
            <button
              type="button"
              style={styles.cancelBtn}
              onClick={() => { setAddingChannel(false); setError('') }}
            >✕</button>
          </div>
        </form>
      ) : (
        <button
          style={styles.addChannelBtn}
          onClick={() => { setAddingChannel(true); setAddingSourceFor(null) }}
        >
          ＋ Add channel
        </button>
      )}

      {error && <div style={styles.error}>{error}</div>}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 260, flexShrink: 0,
    background: 'var(--surface)', borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column',
    height: '100%', overflow: 'visible',
    position: 'relative', zIndex: 10,
  },
  sidebarHeader: {
    padding: '16px 16px 12px',
    borderBottom: '1px solid var(--border)',
  },
  channelList: {
    flex: 1, overflowY: 'auto', overflowX: 'visible', padding: '8px 0',
  },
  channelGroup: {
    marginBottom: 4,
  },
  channelRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 16px',
  },
  channelTitle: {
    fontSize: 13, fontWeight: 600, color: 'var(--text)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  sourceList: {
    paddingLeft: 16,
  },
  sourceRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '5px 8px 5px 12px', cursor: 'pointer',
    border: '1px solid transparent', borderRadius: 'var(--radius)',
    transition: 'background 150ms ease, border-color 150ms ease',
  },
  sourceUsername: {
    fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  deleteBtn: {
    background: 'none', color: 'var(--text-muted)', fontSize: 10,
    padding: '2px 4px', flexShrink: 0,
    transition: 'color 150ms ease',
  },
  addBtn: {
    background: 'none', color: 'var(--text-muted)',
    fontSize: 12, padding: '5px 12px',
    fontFamily: 'var(--font-mono)', textAlign: 'left', width: '100%',
    transition: 'color 150ms ease',
  },
  addChannelBtn: {
    background: 'none', color: 'var(--text-muted)',
    fontSize: 12, padding: '12px 16px', width: '100%', textAlign: 'left',
    borderTop: '1px solid var(--border)',
    fontFamily: 'var(--font-mono)',
    transition: 'color 150ms ease',
  },
  addChannelForm: {
    padding: '10px 12px', borderTop: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  inlineForm: {
    display: 'flex', gap: 4, padding: '4px 8px 4px 12px',
    alignItems: 'center',
  },
  inlineInput: {
    flex: 1, padding: '4px 8px', fontSize: 12,
    fontFamily: 'var(--font-mono)',
  },
  inlineBtn: {
    padding: '4px 8px', fontSize: 11,
  },
  cancelBtn: {
    background: 'none', color: 'var(--text-muted)',
    fontSize: 11, padding: '4px 6px',
  },
  error: {
    padding: '8px 16px', color: 'var(--danger)',
    fontSize: 11, fontFamily: 'var(--font-mono)',
  },
}
