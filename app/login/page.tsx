'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Unable to connect to the authentication service.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full" style={{ maxWidth: '400px' }}>
        <div className="text-center" style={{ marginBottom: '32px' }}>
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '32px' }}>neurology</span>
            <span className="font-bold" style={{ fontSize: '22px' }}>MediSync Health</span>
          </Link>
        </div>

        <div className="glass-card" style={{ padding: '32px' }}>
          <div className="text-center" style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Welcome Back</h1>
            <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)' }}>Sign in to access your health dashboard</p>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', marginBottom: '20px', background: 'var(--color-error-container)', borderRadius: '12px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label className="label">Email</label>
              <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field" />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="label">Password</label>
              <input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input-field" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50" style={{ padding: '14px', fontSize: '15px' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="text-center" style={{ marginTop: '20px' }}>
            <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
              Don&apos;t have an account?{' '}
              <Link href="/register" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>Sign up for free</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
