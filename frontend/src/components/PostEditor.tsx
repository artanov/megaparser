import { useEffect, useRef, useState } from 'react'
import { api, unwrap } from '../api/client'
import { MyChannel, Post } from '../types'
import { useIsMobile } from '../hooks/useIsMobile'

interface Props {
  post: Post
  myChannels: MyChannel[]
  onClose: () => void
  onUpdate: (post: Post) => void
}

export default function PostEditor({ post, myChannels, onClose, onUpdate }: Props) {
  const [rewritten, setRewritten] = useState(post.rewritten_text || '')
  const [rewriting, setRewriting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [targetChannelId, setTargetChannelId] = useState<number>(
    post.target_channel_id || myChannels[0]?.id || 0
  )
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mobileTab, setMobileTab] = useState<'original' | 'rewritten'>('rewritten')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isMobile = useIsMobile()

  const mediaPaths = post.media_paths || []
  const mediaTypes = post.media_types || []

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (lightboxSrc) setLightboxSrc(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, lightboxSrc])

  async function handleRewrite() {
    setError('')
    setRewriting(true)
    try {
      const res = await api.post(`/posts/${post.id}/rewrite`)
      const data = unwrap<{ rewritten_text: string }>(res)
      setRewritten(data.rewritten_text)
      onUpdate({ ...post, rewritten_text: data.rewritten_text, status: 'ready' })
      if (isMobile) setMobileTab('rewritten')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Rewrite failed')
    } finally {
      setRewriting(false)
    }
  }

  async function handleSaveEdit() {
    try {
      const res = await api.patch(`/posts/${post.id}`, { rewritten_text: rewritten })
      const updated = unwrap<Post>(res)
      onUpdate(updated)
    } catch { /* ignore */ }
  }

  async function handlePublish() {
    if (!targetChannelId) return
    setError('')
    setPublishing(true)
    try {
      await api.patch(`/posts/${post.id}`, { rewritten_text: rewritten })
    } catch { /* ignore */ }
    try {
      const res = await api.post(`/posts/${post.id}/publish?target_channel_id=${targetChannelId}`)
      unwrap<{ sent_at: string }>(res)
      onUpdate({ ...post, rewritten_text: rewritten, status: 'sent' })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  async function handleDiscard() {
    setDiscarding(true)
    try {
      await api.post(`/posts/${post.id}/discard`)
      onUpdate({ ...post, status: 'discarded' })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Discard failed')
    } finally {
      setDiscarding(false)
    }
  }

  const modalStyle: React.CSSProperties = isMobile
    ? { position: 'fixed', inset: 0, zIndex: 100, background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
    : styles.modal

  return (
    <>
      {!isMobile && <div style={styles.overlay} onClick={onClose} />}
      <div style={modalStyle}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={`status-badge status-${post.status}`}>{post.status}</span>
            {!isMobile && <span className="label">Message #{post.message_id}</span>}
          </div>
          {isMobile ? (
            <div style={{ display: 'flex', gap: 0 }}>
              <button
                style={{ ...styles.tab, ...(mobileTab === 'original' ? styles.tabActive : {}) }}
                onClick={() => setMobileTab('original')}
              >ORIGINAL</button>
              <button
                style={{ ...styles.tab, ...(mobileTab === 'rewritten' ? styles.tabActive : {}) }}
                onClick={() => setMobileTab('rewritten')}
              >REWRITTEN</button>
            </div>
          ) : null}
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Media thumbnails */}
        {mediaPaths.length > 0 && (
          <div style={styles.mediaThumbs}>
            {mediaPaths.map((path, i) => (
              <div
                key={i}
                style={styles.thumbWrap}
                onClick={() => mediaTypes[i] === 'photo' && setLightboxSrc(`/${path}`)}
              >
                {mediaTypes[i] === 'photo' ? (
                  <img src={`/${path}`} alt="" style={styles.thumb} />
                ) : (
                  <video src={`/${path}`} style={styles.thumb} muted />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {isMobile ? (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 16 }}>
            {mobileTab === 'original' ? (
              <div style={styles.readonlyText}>{post.original_text || '—'}</div>
            ) : (
              <textarea
                ref={textareaRef}
                value={rewritten}
                onChange={e => setRewritten(e.target.value)}
                onBlur={handleSaveEdit}
                placeholder="Click 'Rewrite with AI' or type here…"
                style={{ ...styles.textarea, flex: 1, height: '100%' }}
              />
            )}
          </div>
        ) : (
          <div style={styles.columns}>
            <div style={styles.col}>
              <div className="label" style={styles.colLabel}>Original</div>
              <div style={styles.readonlyText}>{post.original_text || '—'}</div>
            </div>
            <div style={styles.col}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...styles.colLabel }}>
                <span className="label">Rewritten</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                  *bold* _italic_ `code` [link](url)
                </span>
              </div>
              <textarea
                ref={textareaRef}
                value={rewritten}
                onChange={e => setRewritten(e.target.value)}
                onBlur={handleSaveEdit}
                placeholder="Click 'Rewrite with AI' or type here…"
                style={styles.textarea}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ ...styles.footer, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          {error && <div style={{ ...styles.error, width: '100%' }}>{error}</div>}

          <div style={{ ...styles.footerRow, flexWrap: isMobile ? 'wrap' : 'nowrap', gap: 8 }}>
            <div style={styles.footerLeft}>
              <button
                className="btn-accent"
                onClick={handleRewrite}
                disabled={rewriting}
                style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
              >
                {rewriting
                  ? <><span className="spinner" /> REWRITING…</>
                  : post.rewritten_text ? 'REWRITE AGAIN' : 'REWRITE WITH AI'
                }
              </button>
              <button className="btn-danger" onClick={handleDiscard} disabled={discarding}>
                DISCARD
              </button>
            </div>

            <div style={{ ...styles.footerRight, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <select
                value={targetChannelId}
                onChange={e => setTargetChannelId(Number(e.target.value))}
                style={{ ...styles.select, flex: isMobile ? 1 : undefined, minWidth: 0 }}
              >
                {myChannels.map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.title || ch.username}</option>
                ))}
              </select>
              <button
                className="btn-success"
                onClick={handlePublish}
                disabled={publishing || !rewritten || !targetChannelId}
                style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
              >
                {publishing ? <><span className="spinner" style={{ borderTopColor: 'var(--success)' }} /> PUBLISHING…</> : 'PUBLISH'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {lightboxSrc && (
        <div style={styles.lightbox} onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="" style={styles.lightboxImg} />
        </div>
      )}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 99,
  },
  modal: {
    position: 'fixed', inset: '5vh 5vw', zIndex: 100,
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '12px 16px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  tab: {
    background: 'none', color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
    padding: '4px 12px', borderBottom: '2px solid transparent',
  },
  tabActive: {
    color: 'var(--accent)', borderBottom: '2px solid var(--accent)',
  },
  closeBtn: {
    background: 'none', color: 'var(--text-muted)', fontSize: 16,
    padding: '4px 8px',
  },
  mediaThumbs: {
    display: 'flex', gap: 8, padding: '10px 16px',
    borderBottom: '1px solid var(--border)', flexShrink: 0,
    overflowX: 'auto',
  },
  thumbWrap: {
    width: 72, height: 72, flexShrink: 0, overflow: 'hidden',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    cursor: 'pointer', background: 'var(--surface-2)',
  },
  thumb: {
    width: '100%', height: '100%', objectFit: 'cover',
  },
  columns: {
    display: 'flex', flex: 1, overflow: 'hidden',
  },
  col: {
    flex: 1, display: 'flex', flexDirection: 'column',
    padding: 20, overflow: 'hidden',
    borderRight: '1px solid var(--border)',
  },
  colLabel: {
    marginBottom: 10, flexShrink: 0,
  },
  readonlyText: {
    flex: 1, overflow: 'auto', fontSize: 14, lineHeight: 1.6,
    color: 'var(--text-muted)', whiteSpace: 'pre-wrap',
  },
  textarea: {
    flex: 1, resize: 'none', padding: 12, fontSize: 14,
    lineHeight: 1.6, width: '100%',
    background: 'var(--surface-2)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  },
  footer: {
    padding: '12px 16px', borderTop: '1px solid var(--border)',
    flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
  },
  error: {
    color: 'var(--danger)', fontSize: 12, fontFamily: 'var(--font-mono)',
  },
  footerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
  },
  footerLeft: {
    display: 'flex', gap: 8,
  },
  footerRight: {
    display: 'flex', gap: 8, alignItems: 'center',
  },
  select: {
    padding: '8px 10px', fontSize: 13,
    background: 'var(--surface-2)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  },
  lightbox: {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(0,0,0,0.9)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    cursor: 'zoom-out',
  },
  lightboxImg: {
    maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain',
  },
}
