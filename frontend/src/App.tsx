import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from './api/client'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    api.get('/auth/status').then(res => {
      setAuthed(res.data.data.authenticated)
    }).catch(() => {
      setAuthed(false)
    })
  }, [])

  if (authed === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" style={{ width: 24, height: 24, borderColor: 'var(--border)', borderTopColor: 'var(--text-muted)' }} />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={authed ? <Navigate to="/" replace /> : <Login onLogin={() => setAuthed(true)} />}
        />
        <Route
          path="/admin"
          element={authed ? <Admin onLogout={() => setAuthed(false)} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/"
          element={authed ? <Dashboard onLogout={() => setAuthed(false)} /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}
