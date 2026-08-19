'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/EmptyState'
import type { AccessRequestWithUser } from '@medisync/shared'

export default function AccessRequestsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [requests, setRequests] = useState<AccessRequestWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { user: authUser } = await api.getMe()
        setUser(authUser)
        const data = await api.getAccessRequests()
        setRequests(data)
      } catch { router.push('/login') }
      setLoading(false)
    }
    fetchData()
  }, [router])

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    await api.updateAccessRequest(id, 'approved')
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r))
    setActionLoading(null)
  }

  const handleDeny = async (id: string) => {
    setActionLoading(id)
    await api.updateAccessRequest(id, 'denied')
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'denied' as const } : r))
    setActionLoading(null)
  }

  const handleRevoke = async (id: string) => {
    setActionLoading(id)
    await api.updateAccessRequest(id, 'revoked')
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'revoked' as const } : r))
    setActionLoading(null)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" text="Loading..." /></div>

  const isDoctor = user?.role === 'doctor'
  const pending = requests.filter(r => r.status === 'pending')
  const others = requests.filter(r => r.status !== 'pending')

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="flex justify-between items-center animate-fade-in" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-primary)' }}>shield</span>
            Access Requests
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--color-on-surface-variant)' }}>{requests.length} total requests</p>
        </div>
        {isDoctor && (
          <Link href="/dashboard/access-requests/new" className="btn-primary" style={{ padding: '12px 24px', fontSize: '14px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span> Request Access
          </Link>
        )}
      </div>

      {requests.length === 0 ? (
        <EmptyState icon="shield" title="No access requests" description="Access requests will appear here when doctors request patient data access." />
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Pending</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pending.map(req => (
                  <div key={req.id} className="glass-card" style={{ padding: '20px' }}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '15px' }}>{isDoctor ? req.patient_name || req.patient_email : req.doctor_name || req.doctor_email}</p>
                        <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>Scope: {req.scope?.categories ? req.scope.categories.join(', ') : 'Full access'}</p>
                      </div>
                      {!isDoctor && (
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(req.id)} disabled={actionLoading === req.id} className="btn-success" style={{ padding: '8px 16px', fontSize: '13px' }}>Approve</button>
                          <button onClick={() => handleDeny(req.id)} disabled={actionLoading === req.id} className="btn-danger" style={{ padding: '8px 16px', fontSize: '13px' }}>Deny</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>History</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {others.map(req => (
                  <div key={req.id} className="glass-card" style={{ padding: '16px 20px' }}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p style={{ fontSize: '14px' }}>{isDoctor ? req.patient_name || req.patient_email : req.doctor_name || req.doctor_email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`badge badge-${req.status}`}>{req.status}</span>
                        {req.status === 'approved' && (
                          <button onClick={() => handleRevoke(req.id)} style={{ fontSize: '12px', color: '#b71c1c', background: 'none', border: 'none', cursor: 'pointer' }}>Revoke</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
