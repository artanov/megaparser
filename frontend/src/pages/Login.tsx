import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api, unwrap } from '../api/client'

interface Props {
  onLogin: () => void
}

type LoginMode = 'choose' | 'qr' | 'phone'
type PhoneStep = 1 | 2 | 3

export default function Login({ onLogin }: Props) {
  const [mode, setMode] = useState<LoginMode>('choose')

  // QR state
  const [qrUrl, setQrUrl] = useState('')
  const [qrToken, setQrToken] = useState('')
  const [qrLoading, setQrLoading] = useState(false)
  const [qrNeedPassword, setQrNeedPassword] = useState(false)
  const [qrPassword, setQrPassword] = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Phone state
  const [phoneStep, setPhoneStep] = useState<PhoneStep>(1)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [codeHash, setCodeHash] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling])

  // ── QR Code Flow ─────────────────────────────
  async function startQr() {
    setMode('qr')
    setError('')
    setQrLoading(true)
    try {
      const res = await api.post('/auth/qr-init')
      const data = unwrap<{ url: string; token: string }>(res)
      setQrUrl(data.url)
      setQrToken(data.token)
      startPolling(data.token)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to init QR')
    } finally {
      setQrLoading(false)
    }
  }

  function startPolling(token: string) {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.post('/auth/qr-check', { token })
        const data = unwrap<{ waiting?: boolean; url?: string; need_password?: boolean; user_id?: number; token?: string }>(res)
        if (data.need_password) {
          stopPolling()
          setQrNeedPassword(true)
          if (data.token) setQrToken(data.token)
        } else if (data.waiting) {
          if (data.url) setQrUrl(data.url)
        } else if (data.user_id) {
          stopPolling()
          onLogin()
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000)
  }

  async function handleQrPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/qr-password', { phone: qrToken, password: qrPassword })
      onLogin()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wrong password')
    } finally {
      setLoading(false)
    }
  }

  // ── Phone Code Flow ──────────────────────────
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/send-code', { phone })
      const data = unwrap<{ phone_code_hash: string }>(res)
      setCodeHash(data.phone_code_hash)
      setPhoneStep(2)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/verify-code', { phone, code, phone_code_hash: codeHash })
      const data = unwrap<{ need_password?: boolean; user_id?: number }>(res)
      if (data.need_password) {
        setPhoneStep(3)
      } else {
        onLogin()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/verify-password', { phone, password })
      onLogin()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wrong password')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ───────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card} className="login-card">
        <div style={styles.header}>
          <span className="label">TG Parser</span>
          <h1 style={styles.title}>Sign in</h1>
        </div>

        {/* Choose method */}
        {mode === 'choose' && (
          <div style={styles.form}>
            <button className="btn-accent" onClick={startQr} style={styles.btn}>
              SIGN IN WITH QR CODE
            </button>
            <button className="btn-secondary" onClick={() => setMode('phone')} style={styles.btn}>
              SIGN IN WITH PHONE
            </button>
          </div>
        )}

        {/* QR Code */}
        {mode === 'qr' && !qrNeedPassword && (
          <div style={styles.form}>
            <p style={styles.hint}>
              Open Telegram on your phone → Settings → Devices → Link Desktop Device → Scan this QR code
            </p>
            <div style={styles.qrWrap}>
              {qrLoading ? (
                <span className="spinner" />
              ) : qrUrl ? (
                <QRCodeSVG
                  value={qrUrl}
                  size={240}
                  bgColor="#0d0d0d"
                  fgColor="#e8ff57"
                  level="L"
                />
              ) : null}
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <button
              className="btn-secondary"
              onClick={() => { stopPolling(); setMode('choose'); setError('') }}
              style={styles.btn}
            >
              BACK
            </button>
          </div>
        )}

        {/* QR + 2FA */}
        {mode === 'qr' && qrNeedPassword && (
          <form onSubmit={handleQrPassword} style={styles.form}>
            <div style={styles.field}>
              <label className="label" style={styles.fieldLabel}>2FA Cloud Password</label>
              <input
                type="password"
                value={qrPassword}
                onChange={e => setQrPassword(e.target.value)}
                placeholder="your password"
                required
                autoFocus
                style={styles.input}
              />
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <button type="submit" className="btn-accent" disabled={loading} style={styles.btn}>
              {loading ? <span className="spinner" /> : 'CONFIRM'}
            </button>
          </form>
        )}

        {/* Phone: step 1 */}
        {mode === 'phone' && phoneStep === 1 && (
          <form onSubmit={handleSendCode} style={styles.form}>
            <div style={styles.field}>
              <label className="label" style={styles.fieldLabel}>Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+79001234567"
                required
                style={styles.input}
              />
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <button type="submit" className="btn-accent" disabled={loading} style={styles.btn}>
              {loading ? <span className="spinner" /> : 'SEND CODE'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setMode('choose'); setError('') }}
              style={styles.btn}
            >
              BACK
            </button>
          </form>
        )}

        {/* Phone: step 2 */}
        {mode === 'phone' && phoneStep === 2 && (
          <form onSubmit={handleVerify} style={styles.form}>
            <div style={styles.field}>
              <label className="label" style={styles.fieldLabel}>Code from Telegram</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="12345"
                required
                autoFocus
                style={styles.input}
              />
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <button type="submit" className="btn-accent" disabled={loading} style={styles.btn}>
              {loading ? <span className="spinner" /> : 'VERIFY'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setPhoneStep(1); setError('') }}
              style={{ ...styles.btn, marginTop: 8 }}
            >
              BACK
            </button>
          </form>
        )}

        {/* Phone: step 3 (2FA) */}
        {mode === 'phone' && phoneStep === 3 && (
          <form onSubmit={handlePassword} style={styles.form}>
            <div style={styles.field}>
              <label className="label" style={styles.fieldLabel}>2FA Cloud Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="your password"
                required
                autoFocus
                style={styles.input}
              />
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <button type="submit" className="btn-accent" disabled={loading} style={styles.btn}>
              {loading ? <span className="spinner" /> : 'CONFIRM'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
  },
  card: {
    width: 400,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    marginTop: 8,
    color: 'var(--text)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldLabel: {
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
  },
  error: {
    color: 'var(--danger)',
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
  },
  hint: {
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    margin: 0,
  },
  qrWrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px 0',
    minHeight: 260,
  },
  qrImg: {
    width: 240,
    height: 240,
    imageRendering: 'pixelated',
  },
  btn: {
    width: '100%',
    padding: '10px 16px',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
}
