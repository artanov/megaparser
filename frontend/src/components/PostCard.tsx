import { Post } from '../types'

interface Props {
  post: Post
  onClick: () => void
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function PostCard({ post, onClick }: Props) {
  const mediaPaths = post.media_paths || []

  return (
    <div style={styles.row} onClick={onClick}>
      <span className={`status-badge status-${post.status}`} style={{ flexShrink: 0 }}>
        {post.status}
      </span>

      <span style={styles.text}>
        {post.original_text
          ? post.original_text.slice(0, 120) + (post.original_text.length > 120 ? '…' : '')
          : <span style={{ color: 'var(--text-muted)' }}>[no text]</span>
        }
      </span>

      <div style={styles.meta}>
        {mediaPaths.length > 0 && (
          <span className="label" style={{ color: 'var(--accent)' }}>
            📎 {mediaPaths.length}
          </span>
        )}
        <span className="label">{formatRelativeTime(post.created_at)}</span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'background 150ms ease',
    background: 'transparent',
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 1.4,
    color: 'var(--text)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
}
