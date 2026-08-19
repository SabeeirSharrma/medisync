'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<'patient' | 'doctor'>('patient')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      await api.register(email, password, username, role)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
        <div className="w-full" style={{ maxWidth: '400px' }}>
          <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--color-tertiary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-tertiary)', fontSize: '32px' }}>check_circle</span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Account Created!</h1>
            <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginBottom: '24px' }}>
              Your account has been created successfully. You can now sign in.
            </p>
            <Link href="/login" className="btn-primary" style={{ padding: '12px 24px', fontSize: '14px' }}>Go to Login</Link>
          </div>
        </div>
      </div>
    )
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
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Create Account</h1>
            <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)' }}>Start your health management journey</p>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', marginBottom: '20px', background: 'var(--color-error-container)', borderRadius: '12px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: '16px' }}>
              <label className="label">Username</label>
              <input type="text" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} required className="input-field" />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="label">Email</label>
              <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field" />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="label">Password</label>
              <input type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input-field" />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="label">Confirm Password</label>
              <input type="password" placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="input-field" />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="label">I am a</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {(['patient', 'doctor'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{
                      padding: '16px',
                      borderRadius: '16px',
                      border: `2px solid ${role === r ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                      background: role === r ? 'var(--color-primary-container)' : 'white',
                      color: role === r ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{r === 'patient' ? 'person' : 'medical_services'}</span>
                    {r === 'patient' ? 'Patient' : 'Doctor'}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50" style={{ padding: '14px', fontSize: '15px' }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="text-center" style={{ marginTop: '20px' }}>
            <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
