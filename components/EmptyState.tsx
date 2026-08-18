'use client'

import Link from 'next/link'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

export default function EmptyState({ icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="glass-card text-center animate-fade-in" style={{ padding: '64px' }}>
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '20px',
          background: 'var(--color-primary-container)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}
      >
        <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '36px' }}>{icon}</span>
      </div>
      <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>{title}</h3>
      <p style={{ fontSize: '15px', color: 'var(--color-on-surface-variant)', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-primary" style={{ padding: '12px 24px', fontSize: '14px' }}>
          {actionLabel}
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
        </Link>
      )}
    </div>
  )
}
