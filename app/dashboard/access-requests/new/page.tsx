'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const RECORD_TYPES = ['prescription', 'lab_result', 'checkup', 'surgery', 'imaging', 'other'] as const

export default function NewAccessRequestPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [patientEmail, setPatientEmail] = useState('')
  const [scopeType, setScopeType] = useState<'full' | 'category'>('full')
  const [categories, setCategories] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const toggleCategory = (cat: string) => {
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Find patient by email
      const { data: patients } = await supabase.from('users').select('id').eq('email', patientEmail).single()
      if (!patients) { setError('Patient not found'); setLoading(false); return }

      const scope = scopeType === 'category' ? { categories } : {}

      const { error: insertError } = await supabase.from('access_requests').insert({
        doctor_id: user.id, patient_id: patients.id, scope,
      })

      if (insertError) throw new Error(insertError.message)
      router.push('/dashboard/access-requests')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }} className="animate-fade-in">
        <Link href="/dashboard/access-requests" className="inline-flex items-center gap-1" style={{ fontSize: '14px', color: 'var(--color-primary)', textDecoration: 'none', marginBottom: '16px', fontWeight: 500 }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span> Back to Requests
        </Link>
        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-primary)' }}>shield</span>
          Request Patient Access
        </h1>
      </div>

      <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label className="label">Patient Email <span style={{ color: '#b71c1c' }}>*</span></label>
            <input type="email" required placeholder="patient@example.com" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} className="input-field" />
          </div>

          <div>
            <label className="label">Access Scope</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {(['full', 'category'] as const).map(v => (
                <button key={v} type="button" onClick={() => setScopeType(v)}
                  style={{ padding: '16px', borderRadius: '16px', border: `2px solid ${scopeType === v ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`, background: scopeType === v ? 'var(--color-primary-container)' : 'white', cursor: 'pointer', fontWeight: 600, fontSize: '14px', textTransform: 'capitalize' }}>
                  {v === 'full' ? 'Full Access' : 'Specific Types'}
                </button>
              ))}
            </div>
          </div>

          {scopeType === 'category' && (
            <div>
              <label className="label">Record Types</label>
              <div className="flex flex-wrap" style={{ gap: '8px' }}>
                {RECORD_TYPES.map(cat => (
                  <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                    className={`tag ${categories.includes(cat) ? 'active' : ''}`} style={{ textTransform: 'capitalize' }}>
                    {cat.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <div style={{ padding: '12px 16px', background: 'var(--color-error-container)', borderRadius: '12px', fontSize: '13px' }}>{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50" style={{ padding: '14px', fontSize: '15px' }}>
            {loading ? 'Sending...' : 'Request Access'}
          </button>
        </form>
      </div>
    </div>
  )
}
