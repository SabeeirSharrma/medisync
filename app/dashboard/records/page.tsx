'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/EmptyState'
import { MedicalRecord } from '@/types'

export default function RecordsPage() {
  const router = useRouter()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }
        const { data } = await supabase.from('records').select('*').eq('patient_id', user.id).order('date', { ascending: false })
        if (data) setRecords(data)
      } catch (err) {
        console.error('Failed to fetch records:', err)
      }
      setLoading(false)
    }
    fetchRecords()
  }, [supabase, router])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record?')) return
    await supabase.from('records').delete().eq('id', id)
    setRecords(records.filter(r => r.id !== id))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" text="Loading records..." /></div>

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="flex justify-between items-center animate-fade-in" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-primary)' }}>folder_open</span>
            Medical Records
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--color-on-surface-variant)' }}>{records.length} records</p>
        </div>
        <Link href="/dashboard/records/new" className="btn-primary" style={{ padding: '12px 24px', fontSize: '14px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span> Add Record
        </Link>
      </div>

      {records.length === 0 ? (
        <EmptyState icon="folder_open" title="No records yet" description="Upload your first prescription photo or add a medical record." actionLabel="Add First Record" actionHref="/dashboard/records/new" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {records.map((record, index) => (
            <div
              key={record.id}
              className="glass-card animate-fade-in"
              style={{
                animationDelay: `${index * 0.05}s`,
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => router.push(`/dashboard/records/${record.id}`)}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
            >
              {/* Thumbnail or Icon */}
              <div style={{ marginBottom: '16px' }}>
                {record.attachment_url ? (
                  <div style={{ borderRadius: '12px', overflow: 'hidden', height: '160px', background: 'var(--color-surface-highest)' }}>
                    {record.content_type?.startsWith('image/') ? (
                      <img
                        src={record.attachment_url}
                        alt="Prescription"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-primary)' }}>description</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ height: '160px', borderRadius: '12px', background: 'var(--color-primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-primary)' }}>
                      {record.type === 'prescription' ? 'medication' : record.type === 'lab_result' ? 'science' : record.type === 'imaging' ? 'radiology' : 'note'}
                    </span>
                  </div>
                )}
              </div>

              {/* Record Info */}
              <div className="flex justify-between items-start" style={{ marginBottom: '8px' }}>
                <span className="badge badge-active" style={{ textTransform: 'capitalize' }}>{record.type.replace('_', ' ')}</span>
                {record.attachment_url && (
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>photo</span>
                )}
              </div>

              <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{record.date}</p>
              <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>{record.doctor_name || 'No doctor specified'}</p>
              <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>{record.hospital_name || ''}</p>

              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(record.id) }}
                  style={{ fontSize: '12px', color: '#b71c1c', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                >
                  Delete
                </button>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-on-surface-variant)' }}>arrow_forward</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
