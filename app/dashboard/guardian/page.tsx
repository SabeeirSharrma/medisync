'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/EmptyState'
import { GuardianLinkWithUser, GuardianTriggerType } from '@/types'

const TRIGGER_TYPES: { value: GuardianTriggerType; label: string; icon: string }[] = [
  { value: 'minor', label: 'Minor (Under 18)', icon: 'child_care' },
  { value: 'advance_directive', label: 'Advance Directive', icon: 'description' },
  { value: 'emergency_incapacity', label: 'Emergency Incapacity', icon: 'emergency' },
]

export default function GuardianPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; user_metadata?: Record<string, unknown> } | null>(null)
  const [links, setLinks] = useState<GuardianLinkWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [patientEmail, setPatientEmail] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [triggerType, setTriggerType] = useState<GuardianTriggerType>('advance_directive')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) { router.push('/login'); return }
        setUser(authUser)
        const { data } = await supabase.from('guardian_links').select('*').or(`patient_id.eq.${authUser.id},guardian_id.eq.${authUser.id}`)
        if (data) setLinks(data)
      } catch (err) {
        console.error('Failed to fetch guardian links:', err)
      }
      setLoading(false)
    }
    fetchData()
  }, [supabase, router])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const { data: patient } = await supabase.from('users').select('id').eq('email', patientEmail).single()
      const { data: guardian } = await supabase.from('users').select('id').eq('email', guardianEmail).single()

      if (!patient || !guardian) { setError('User not found'); setSubmitting(false); return }

      const initialStatus = triggerType === 'minor' ? 'sole_active' : 'pending_guardian'

      const { error: insertError } = await supabase.from('guardian_links').insert({
        patient_id: patient.id, guardian_id: guardian.id, trigger_type: triggerType, status: initialStatus,
      })

      if (insertError) throw new Error(insertError.message)
      setShowNew(false)
      setPatientEmail('')
      setGuardianEmail('')
      const { data } = await supabase.from('guardian_links').select('*').or(`patient_id.eq.${authUser.id},guardian_id.eq.${authUser.id}`)
      if (data) setLinks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    await supabase.from('guardian_links').update({ status }).eq('id', id)
    setLinks(prev => prev.map(l => l.id === id ? { ...l, status: status as any } : l))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" text="Loading..." /></div>

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="flex justify-between items-center animate-fade-in" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-primary)' }}>family_restroom</span>
            Guardian Management
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--color-on-surface-variant)' }}>Manage guardian/proxy access relationships</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="btn-primary" style={{ padding: '12px 24px', fontSize: '14px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span> New Link
        </button>
      </div>

      {showNew && (
        <div className="glass-card animate-fade-in" style={{ padding: '32px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>Create Guardian Link</h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="label">Patient Email <span style={{ color: '#b71c1c' }}>*</span></label>
                <input type="email" required placeholder="patient@example.com" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label">Guardian Email <span style={{ color: '#b71c1c' }}>*</span></label>
                <input type="email" required placeholder="guardian@example.com" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} className="input-field" />
              </div>
            </div>
            <div>
              <label className="label">Trigger Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {TRIGGER_TYPES.map(tt => (
                  <button key={tt.value} type="button" onClick={() => setTriggerType(tt.value)}
                    style={{ padding: '16px', borderRadius: '16px', border: `2px solid ${triggerType === tt.value ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`, background: triggerType === tt.value ? 'var(--color-primary-container)' : 'white', cursor: 'pointer', textAlign: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '24px', display: 'block', marginBottom: '4px', color: 'var(--color-primary)' }}>{tt.icon}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{tt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {error && <div style={{ padding: '12px 16px', background: 'var(--color-error-container)', borderRadius: '12px', fontSize: '13px' }}>{error}</div>}
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50" style={{ padding: '14px', fontSize: '15px' }}>
                {submitting ? 'Creating...' : 'Create Link'}
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="btn-ghost" style={{ padding: '14px', fontSize: '15px' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {links.length === 0 ? (
        <EmptyState icon="family_restroom" title="No guardian links" description="Create guardian links to manage proxy access for minors, advance directives, or emergency incapacity." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {links.map(link => (
            <div key={link.id} className="glass-card" style={{ padding: '20px' }}>
              <div className="flex justify-between items-center">
                <div>
                  <p style={{ fontWeight: 600, fontSize: '15px' }}>
                    {link.patient_name || link.patient_email || 'Patient'} &harr; {link.guardian_name || link.guardian_email || 'Guardian'}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                    Type: {link.trigger_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge badge-${link.status === 'sole_active' || link.status === 'active_shared_control' ? 'approved' : link.status === 'pending_guardian' || link.status === 'pending_senior' ? 'pending' : 'revoked'}`}>
                    {link.status.replace(/_/g, ' ')}
                  </span>
                  {link.status === 'pending_guardian' && (
                    <button onClick={() => handleUpdateStatus(link.id, 'active_shared_control')} className="btn-success" style={{ padding: '8px 16px', fontSize: '13px' }}>Approve</button>
                  )}
                  {(link.status === 'sole_active' || link.status === 'active_shared_control') && (
                    <button onClick={() => handleUpdateStatus(link.id, 'revoked')} style={{ fontSize: '12px', color: '#b71c1c', background: 'none', border: 'none', cursor: 'pointer' }}>Revoke</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
