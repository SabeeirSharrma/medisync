'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface CardData { id: string; title: string; icon: string; color: string; bgColor: string; content: string[] }

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function parseAIResponse(aiResponse: string): CardData[] {
  if (!aiResponse) return []
  const cards: CardData[] = []
  const sections = [
    { key: 'POSSIBLE DIAGNOSES', title: 'Possible Diagnoses', icon: 'neurology', color: '#3525cd', bgColor: '#e8deff' },
    { key: 'IMMEDIATE SOLUTIONS', title: 'Immediate Solutions', icon: 'healing', color: '#005338', bgColor: '#6ffabe' },
    { key: 'RECOMMENDED TESTS', title: 'Recommended Tests', icon: 'science', color: '#6b38d4', bgColor: '#e8deff' },
    { key: 'WHEN TO SEEK EMERGENCY', title: 'Emergency Care', icon: 'emergency', color: '#b71c1c', bgColor: '#ffdad6' },
  ]
  for (const section of sections) {
    const regex = new RegExp(`${section.key}[\\s:]*\\n([\\s\\S]*?)(?=\\n(?:POSSIBLE DIAGNOSES|IMMEDIATE SOLUTIONS|RECOMMENDED TESTS|WHEN TO SEEK|$))`, 'i')
    const match = aiResponse.match(regex)
    if (match) {
      const items = match[1].trim().split('\n').map(l => l.replace(/^[•\-\d\.\*\s]+/, '').trim()).filter(l => l.length > 3)
      if (items.length > 0) cards.push({ id: section.key, title: section.title, icon: section.icon, color: section.color, bgColor: section.bgColor, content: items })
    }
  }
  if (cards.length === 0 && aiResponse) {
    const items = aiResponse.split('\n').map(l => l.replace(/^[•\-\d\.\*\s]+/, '').trim()).filter(l => l.length > 5)
    cards.push({ id: 'analysis', title: 'AI Analysis', icon: 'auto_awesome', color: '#3525cd', bgColor: '#e8deff', content: items.length > 0 ? items : [aiResponse] })
  }
  return cards
}

export default function ResultsPage() {
  const params = useParams()
  const router = useRouter()
  const [diagnosis, setDiagnosis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState<CardData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const fetchDiagnosis = async () => {
      try {
        await api.getMe()
        const data = await api.getDiagnosis(params.id as string)
        if (!data) { router.push('/dashboard'); return }
        setDiagnosis(data)
        const parsed = parseAIResponse(data.ai_response || '')
        setCards(shuffleArray(parsed))
      } catch { router.push('/dashboard') }
      setLoading(false)
    }
    fetchDiagnosis()
  }, [params.id, router])

  const goToNext = useCallback(() => {
    if (cards.length <= 1) return
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % cards.length
        if (next === 0) setCards(prevCards => shuffleArray(prevCards))
        return next
      })
      setIsTransitioning(false)
      startTimeRef.current = Date.now()
      setProgress(0)
    }, 300)
  }, [cards.length])

  useEffect(() => {
    if (cards.length <= 1) return
    const interval = 15000
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      setProgress(Math.min((elapsed / interval) * 100, 100))
      if (elapsed >= interval) goToNext()
    }, 50)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [cards.length, goToNext])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" text="Loading diagnosis..." /></div>
  if (!diagnosis) return null

  const currentCard = cards[currentIndex]

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }} className="animate-fade-in">
        <Link href="/dashboard/history" className="inline-flex items-center gap-1" style={{ fontSize: '14px', color: 'var(--color-primary)', textDecoration: 'none', marginBottom: '16px', fontWeight: 500 }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span> Back to History
        </Link>
        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>Diagnosis Results</h1>
        <p style={{ fontSize: '15px', color: 'var(--color-on-surface-variant)' }}>
          For {diagnosis.patient_name} &middot; {new Date(diagnosis.created_at).toLocaleDateString()}
        </p>
      </div>

      {cards.length > 0 && (
        <>
          <div className="progress-bar" style={{ marginBottom: '24px' }}>
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {cards.map((card, i) => (
              <button key={card.id} onClick={() => { setCurrentIndex(i); startTimeRef.current = Date.now(); setProgress(0) }}
                style={{ padding: '8px 16px', borderRadius: '9999px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s ease',
                  background: i === currentIndex ? card.color : 'var(--color-surface-highest)', color: i === currentIndex ? 'white' : 'var(--color-on-surface-variant)' }}>
                {card.title}
              </button>
            ))}
          </div>

          <div className="glass-card animate-fade-in" style={{ padding: '32px', minHeight: '300px', opacity: isTransitioning ? 0 : 1, transition: 'opacity 0.3s ease' }}>
            {currentCard && (
              <>
                <div className="flex items-center gap-3" style={{ marginBottom: '24px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: currentCard.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ color: currentCard.color, fontSize: '24px' }}>{currentCard.icon}</span>
                  </div>
                  <h2 style={{ fontSize: '22px', fontWeight: 700 }}>{currentCard.title}</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {currentCard.content.map((item, i) => (
                    <div key={i} style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.5)', border: '1px solid var(--color-outline-variant)' }}>
                      <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--color-on-surface)' }}>{item}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
