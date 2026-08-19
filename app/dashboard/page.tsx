'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function DashboardPage() {
  const [user, setUser] = useState<{ id: string; user_metadata?: Record<string, unknown> } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [recordCount, setRecordCount] = useState(0)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    setMounted(true)
    const getData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        const { count } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('patient_id', user?.id || '')
        setRecordCount(count || 0)
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      }
    }
    getData()
  }, [supabase])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className={`${mounted ? 'animate-fade-in' : 'opacity-0'}`} style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px' }}>
          {getGreeting()}, <span style={{ color: 'var(--color-primary)' }}>{String(user?.user_metadata?.username || 'there')}</span>
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--color-on-surface-variant)' }}>
          Manage your health with AI-powered insights and secure record keeping.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-card" style={{ padding: '32px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>favorite</span>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>Wellness Score</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
              <svg viewBox="0 0 120 120" style={{ width: '120px', height: '120px', transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-outline-variant)" strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-primary)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 52}`} strokeDashoffset={`${2 * Math.PI * 52 * (1 - 0.87)}`} />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>87</div>
                <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>/100</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginBottom: '4px' }}>Status</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-tertiary)' }}>Good Condition</div>
              <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', marginTop: '8px' }}>Medical Records: {recordCount}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Link href="/dashboard/diagnose" className="glass-card" style={{ padding: '24px', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'var(--color-primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '24px' }}>add_circle</span>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>New Diagnosis</div>
              <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>Enter symptoms and get AI analysis</div>
            </div>
          </Link>
          <Link href="/dashboard/records" className="glass-card" style={{ padding: '24px', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'var(--color-tertiary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-tertiary)', fontSize: '24px' }}>folder_open</span>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>Medical Records</div>
              <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>View and manage your records</div>
            </div>
          </Link>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
        <div className="section-title">
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>route</span>
          Quick Actions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { href: '/dashboard/diagnose', icon: 'clinical_notes', label: 'Diagnose', color: 'primary' },
            { href: '/dashboard/records/new', icon: 'add_note', label: 'New Record', color: 'tertiary' },
            { href: '/dashboard/access-requests', icon: 'shield', label: 'Access', color: 'secondary' },
            { href: '/dashboard/emergency-access', icon: 'emergency', label: 'Emergency', color: 'primary' },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--color-outline-variant)', background: 'white', textAlign: 'center', transition: 'all 0.2s ease' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '28px', color: `var(--color-${item.color})`, marginBottom: '8px', display: 'block' }}>{item.icon}</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
