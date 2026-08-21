'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { HeartPulse, Plus } from 'lucide-react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/EmptyState'

interface Diagnosis {
  id: string; patient_name?: string; patientName?: string; severity: string; symptoms: string[]; age: number; created_at?: string; createdAt?: string;
}

export default function HistoryPage() {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDiagnoses = async () => {
      try {
        const data = await api.getDiagnoses()
        setDiagnoses(data)
      } catch {}
      setLoading(false)
    }
    fetchDiagnoses()
  }, [])

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this diagnosis?')) {
      await api.deleteDiagnosis(id)
      setDiagnoses(diagnoses.filter((d) => d.id !== id))
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" text="Loading history..." /></div>

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="flex justify-between items-center animate-fade-in" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
            <HeartPulse size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-primary)' }} />
            Diagnosis History
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--color-on-surface-variant)' }}>{diagnoses.length} {diagnoses.length === 1 ? 'diagnosis' : 'diagnoses'} recorded</p>
        </div>
        <Link href="/dashboard/diagnose" className="btn-primary" style={{ padding: '12px 24px', fontSize: '14px' }}>
          <Plus size={18} /> New Diagnosis
        </Link>
      </div>

      {diagnoses.length === 0 ? (
        <EmptyState icon="inbox" title="No diagnoses yet" description="Start your first AI-powered diagnosis to see your health history here." actionLabel="Start First Diagnosis" actionHref="/dashboard/diagnose" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {diagnoses.map((diagnosis, index) => (
            <Link key={diagnosis.id} href={`/dashboard/results/${diagnosis.id}`} className="glass-card animate-fade-in" style={{ animationDelay: `${index * 0.05}s`, padding: '24px', textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div className="flex justify-between items-start" style={{ marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{diagnosis.patientName || diagnosis.patient_name}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>{new Date(diagnosis.createdAt || diagnosis.created_at || '').toLocaleDateString()}</p>
                </div>
                <span className={`badge-${diagnosis.severity}`}>{diagnosis.severity}</span>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div className="flex flex-wrap" style={{ gap: '6px' }}>
                  {diagnosis.symptoms.slice(0, 3).map((s) => <span key={s} className="tag" style={{ fontSize: '11px', padding: '4px 10px' }}>{s}</span>)}
                  {diagnosis.symptoms.length > 3 && <span className="tag" style={{ fontSize: '11px', padding: '4px 10px' }}>+{diagnosis.symptoms.length - 3} more</span>}
                </div>
              </div>
              <div className="flex justify-between items-center" style={{ paddingTop: '12px', borderTop: '1px solid var(--color-outline-variant)' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>{diagnosis.age} years</span>
                <button onClick={(e) => { e.preventDefault(); handleDelete(diagnosis.id) }} style={{ fontSize: '12px', color: '#b71c1c', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Delete</button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
