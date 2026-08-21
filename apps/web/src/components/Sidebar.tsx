'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { Brain, LayoutDashboard, ClipboardList, HeartPulse, FolderOpen, Shield, Siren, Users, User, LogOut } from 'lucide-react'

const iconMap: Record<string, React.ComponentType<any>> = {
  neurology: Brain,
  dashboard: LayoutDashboard,
  clinical_notes: ClipboardList,
  monitor_heart: HeartPulse,
  folder_open: FolderOpen,
  shield: Shield,
  emergency: Siren,
  family_restroom: Users,
  account_circle: User,
  logout: LogOut,
}

export default function Sidebar() {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const getUser = async () => {
      try {
        const { user: u, profile: p } = await api.getMe()
        setUser(u)
        setProfile(p)
      } catch {}
    }
    getUser()
  }, [])

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
    try { await api.logout() } catch {}
    window.location.href = '/login'
  }

  const getDisplayName = () => {
    if (profile?.username) return profile.username
    if (user?.username) return user.username
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
          <Brain />
        </Link>

        <nav className="sidebar-nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActive(link.href) ? 'active' : ''}`}
            >
              {(() => { const Icon = iconMap[link.icon]; return Icon ? <Icon /> : null; })()}
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
              {(() => { const Icon = iconMap[link.icon]; return Icon ? <Icon /> : null; })()}
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
            <User />
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
                <LogOut style={{ fontSize: '20px' }} />
                Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Top Nav */}
      <header className="top-nav">
        <Link href="/" className="flex items-center gap-2">
          <Brain style={{ color: 'var(--color-primary)' }} />
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
              {(() => { const Icon = iconMap[link.icon]; return Icon ? <Icon style={{ fontSize: '22px' }} /> : null; })()}
            </Link>
          ))}

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-2 rounded-full transition-colors"
              style={{ background: 'rgba(0,0,0,0.05)' }}
            >
              <User style={{ fontSize: '22px' }} />
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
                  <LogOut style={{ fontSize: '20px' }} />
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
