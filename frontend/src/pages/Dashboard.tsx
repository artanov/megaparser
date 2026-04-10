import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrap } from '../api/client'
import { MyChannel, Post, SourceChannel } from '../types'
import { useIsMobile } from '../hooks/useIsMobile'
import Sidebar from '../components/Sidebar'
import PostCard from '../components/PostCard'
import PostEditor from '../components/PostEditor'

interface Props {
  onLogout: () => void
}

export default function Dashboard({ onLogout }: Props) {
  const [myChannels, setMyChannels] = useState<MyChannel[]>([])
  const [sourceChannels, setSourceChannels] = useState<Record<number, SourceChannel[]>>({})
  const [selectedSource, setSelectedSource] = useState<SourceChannel | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [fetching, setFetching] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptText, setPromptText] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useIsMobile()

  // Load all my channels and their sources on mount
  useEffect(() => {
    api.get('/channels/my').then(async res => {
      const channels = unwrap<MyChannel[]>(res)
      setMyChannels(channels)

      const sourcesMap: Record<number, SourceChannel[]> = {}
      await Promise.all(channels.map(async ch => {
        const sRes = await api.get(`/channels/sources?my_channel_id=${ch.id}`)
        sourcesMap[ch.id] = unwrap<SourceChannel[]>(sRes)
      }))
      setSourceChannels(sourcesMap)
    }).catch(() => {})
  }, [])

  const loadPosts = useCallback(async (src: SourceChannel) => {
    setLoadingPosts(true)
    try {
      const res = await api.get(`/posts?source_channel_id=${src.id}`)
      setPosts(unwrap<Post[]>(res))
    } finally {
      setLoadingPosts(false)
    }
  }, [])

  function handleSelectSource(src: SourceChannel) {
    setSelectedSource(src)
    setSelectedPost(null)
    setPromptOpen(false)
    setPromptText(src.prompt || '')
    setSidebarOpen(false)
    loadPosts(src)
  }

  async function handleSavePrompt() {
    if (!selectedSource) return
    setSavingPrompt(true)
    try {
      const res = await api.patch(`/channels/sources/${selectedSource.id}`, { prompt: promptText })
      const updated = unwrap<SourceChannel>(res)
      setSelectedSource(updated)
      setSourceChannels(prev => ({
        ...prev,
        [updated.my_channel_id]: (prev[updated.my_channel_id] || []).map(s =>
          s.id === updated.id ? updated : s
        ),
      }))
      setPromptOpen(false)
    } finally {
      setSavingPrompt(false)
    }
  }

  async function handleFetch() {
    if (!selectedSource) return
    setFetching(true)
    try {
      const res = await api.post(`/posts/fetch?source_channel_id=${selectedSource.id}`)
      const newPosts = unwrap<Post[]>(res)
      if (newPosts.length > 0) {
        setPosts(prev => [...newPosts, ...prev])
      }
    } finally {
      setFetching(false)
    }
  }

  async function handleLogout() {
    await api.post('/auth/logout')
    onLogout()
  }

  function handleChannelAdded(ch: MyChannel) {
    setMyChannels(prev => [...prev, ch])
    setSourceChannels(prev => ({ ...prev, [ch.id]: [] }))
  }

  function handleSourceAdded(src: SourceChannel) {
    setSourceChannels(prev => ({
      ...prev,
      [src.my_channel_id]: [...(prev[src.my_channel_id] || []), src],
    }))
  }

  function handleChannelDeleted(id: number) {
    setMyChannels(prev => prev.filter(c => c.id !== id))
    setSourceChannels(prev => { const next = { ...prev }; delete next[id]; return next })
    if (selectedSource && myChannels.find(c => c.id === id)
      && sourceChannels[id]?.some(s => s.id === selectedSource.id)) {
      setSelectedSource(null)
      setPosts([])
    }
  }

  function handleSourceDeleted(id: number) {
    setSourceChannels(prev => {
      const next = { ...prev }
      for (const key in next) {
        next[key] = next[key].filter(s => s.id !== id)
      }
      return next
    })
    if (selectedSource?.id === id) {
      setSelectedSource(null)
      setPosts([])
    }
  }

  function handlePostUpdate(updated: Post) {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
    if (selectedPost?.id === updated.id) setSelectedPost(updated)
  }

  return (
    <div style={styles.root}>
      {/* Top bar */}
      <div style={styles.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{ background: 'none', color: 'var(--text)', fontSize: 18, padding: '4px 6px' }}
            >
              ☰
            </button>
          )}
          <span style={styles.logo}>TG Parser</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link to="/admin" style={styles.adminLink}>ADMIN</Link>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '6px 12px' }}>
            LOGOUT
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div style={styles.layout}>
        <div style={{
          ...(isMobile ? {
            position: 'fixed', top: 52, left: 0, bottom: 0, zIndex: 51,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 200ms ease',
          } : {}),
        }}>
        <Sidebar
          myChannels={myChannels}
          sourceChannels={sourceChannels}
          selectedSourceId={selectedSource?.id ?? null}
          onSelectSource={handleSelectSource}
          onChannelAdded={handleChannelAdded}
          onSourceAdded={handleSourceAdded}
          onChannelDeleted={handleChannelDeleted}
          onSourceDeleted={handleSourceDeleted}
        />
        </div>

        <div style={styles.main}>
          {selectedSource ? (
            <>
              <div style={styles.mainHeader}>
                <div>
                  <h2 style={styles.sourceName}>@{selectedSource.username}</h2>
                  <span className="label">{selectedSource.title}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-secondary"
                    onClick={() => { setPromptOpen(p => !p); setPromptText(selectedSource.prompt || '') }}
                    style={{ fontSize: 11 }}
                  >
                    {selectedSource.prompt ? 'EDIT PROMPT' : 'SET PROMPT'}
                  </button>
                  <button
                    className="btn-accent"
                    onClick={handleFetch}
                    disabled={fetching}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {fetching ? <><span className="spinner" /> FETCHING…</> : 'FETCH POSTS'}
                  </button>
                </div>
              </div>

              {promptOpen && (
                <div style={styles.promptPanel}>
                  <div className="label" style={{ marginBottom: 8 }}>
                    AI REWRITE PROMPT — оставь пустым для дефолтного
                  </div>
                  <textarea
                    value={promptText}
                    onChange={e => setPromptText(e.target.value)}
                    placeholder="You are a copywriter for a Telegram channel. Rewrite the post in a fresh, engaging style. Preserve all facts. Return ONLY the rewritten text."
                    style={styles.promptTextarea}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      className="btn-accent"
                      onClick={handleSavePrompt}
                      disabled={savingPrompt}
                    >
                      {savingPrompt ? 'SAVING…' : 'SAVE'}
                    </button>
                    <button className="btn-secondary" onClick={() => setPromptOpen(false)}>
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              {loadingPosts ? (
                <div style={styles.center}>
                  <div className="spinner" style={{ width: 24, height: 24, borderColor: 'var(--border)', borderTopColor: 'var(--text-muted)' }} />
                </div>
              ) : posts.length === 0 ? (
                <div style={styles.center}>
                  <span className="label">No posts yet — click FETCH POSTS</span>
                </div>
              ) : (
                <div style={styles.grid}>
                  {posts.map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onClick={() => setSelectedPost(post)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={styles.center}>
              <span className="label">Select a source channel from the sidebar</span>
            </div>
          )}
        </div>
      </div>

      {selectedPost && (
        <PostEditor
          post={selectedPost}
          myChannels={myChannels}
          onClose={() => setSelectedPost(null)}
          onUpdate={handlePostUpdate}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  topbar: {
    height: 52, flexShrink: 0,
    background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px',
  },
  logo: {
    fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 13,
    color: 'var(--accent)', letterSpacing: '0.05em',
  },
  adminLink: {
    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
    letterSpacing: '0.08em',
    transition: 'color 150ms ease',
  },
  layout: {
    flex: 1, display: 'flex', overflow: 'hidden', position: 'relative',
  },
  main: {
    flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0,
  },
  mainHeader: {
    padding: '20px 24px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  sourceName: {
    fontSize: 18, fontWeight: 600, marginBottom: 4,
  },
  grid: {
    flex: 1, overflowY: 'auto',
    display: 'flex', flexDirection: 'column',
  },
  center: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  promptPanel: {
    padding: '16px 24px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface-2)',
    flexShrink: 0,
  },
  promptTextarea: {
    width: '100%',
    height: 100,
    resize: 'vertical',
    padding: '8px 12px',
    fontSize: 13,
    lineHeight: 1.5,
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  },
}
