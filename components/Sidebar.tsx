'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function Sidebar() {
  const pathname = usePathname()
  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: Record<string, unknown> } | null>(null)
  const [profile, setProfile] = useState<{ username?: string | null; role?: string | null } | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        if (user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          setProfile(profileData)
        }
      } catch (err) {
        console.error('Failed to load user profile:', err)
      }
    }
    getUser()

    let subscription: { unsubscribe: () => void } | null = null
    try {
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          setProfile(profileData)
        }
      })
      subscription = data.subscription
    } catch (err) {
      console.error('Auth state listener error:', err)
    }

    return () => { subscription?.unsubscribe() }
  }, [supabase])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try { await supabase.auth.signOut() } catch (err) {
      console.error('Logout error:', err)
    }
    window.location.href = '/login'
  }

  // Get display name: prefer username from profiles, then metadata, then email prefix
  const getDisplayName = () => {
    if (profile?.username) return profile.username
    if (user?.user_metadata?.username) return user.user_metadata.username
    if (user?.email) return user.email.split('@')[0]
    return 'Profile'
  }

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/dashboard/diagnose', label: 'Symptom Checker', icon: 'clinical_notes' },
    { href: '/dashboard/history', label: 'Diagnosis History', icon: 'monitor_heart' },
  ]

  const healthLinks = [
    { href: '/dashboard/records', label: 'Medical Records', icon: 'folder_open' },
    { href: '/dashboard/access-requests', label: 'Access Requests', icon: 'shield' },
    { href: '/dashboard/emergency-access', label: 'Emergency Access', icon: 'emergency' },
    { href: '/dashboard/guardian', label: 'Guardian', icon: 'family_restroom' },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <Link href="/" className="sidebar-logo">
          <span className="material-symbols-outlined">neurology</span>
        </Link>

        <nav className="sidebar-nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActive(link.href) ? 'active' : ''}`}
            >
              <span className="material-symbols-outlined">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-divider" />
        <div className="sidebar-section-label">Health Records</div>

        <nav className="sidebar-nav">
          {healthLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActive(link.href) ? 'active' : ''}`}
            >
              <span className="material-symbols-outlined">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-divider" />
        <div className="sidebar-section-label">Account</div>

        <div className="relative w-full" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="sidebar-link w-full"
            style={{ cursor: 'pointer' }}
          >
            <span className="material-symbols-outlined">account_circle</span>
            <span>{getDisplayName()}</span>
          </button>

          {showDropdown && (
            <div
              className="absolute left-0 bottom-full mb-2 py-2 rounded-2xl shadow-lg z-50"
              style={{
                width: '220px',
                background: 'rgba(255,255,255,0.4)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.3)',
              }}
            >
              <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface)' }}>{getDisplayName()}</p>
                <p style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full px-5 py-3 text-left text-sm font-medium transition-colors flex items-center gap-3"
                style={{ color: 'var(--color-on-surface-variant)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-container)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
                Logout → Sign Up
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Top Nav */}
      <header className="top-nav">
        <Link href="/" className="flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>neurology</span>
          <span className="font-bold text-lg">MediSync Health</span>
        </Link>

        <div className="flex items-center gap-2">
          {navLinks.slice(0, 3).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`p-2 rounded-full transition-colors ${
                isActive(link.href) ? 'text-white' : 'text-on-surface-variant'
              }`}
              style={isActive(link.href) ? { background: 'var(--color-primary)' } : {}}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{link.icon}</span>
            </Link>
          ))}

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-2 rounded-full transition-colors"
              style={{ background: 'rgba(0,0,0,0.05)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>account_circle</span>
            </button>

            {showDropdown && (
              <div
                className="absolute right-0 top-full mt-2 py-2 rounded-2xl shadow-lg z-50"
                style={{
                  width: '180px',
                  background: 'rgba(255,255,255,0.4)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              >
                <button
                  onClick={handleLogout}
                  className="w-full px-5 py-3 text-left text-sm font-medium transition-colors flex items-center gap-3"
                  style={{ color: 'var(--color-on-surface-variant)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  )
}
