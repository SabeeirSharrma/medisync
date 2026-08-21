'use client'

import { ClipboardList } from 'lucide-react'
import TagInput from '@/components/ui/TagInput'

interface SymptomsFormProps {
  symptoms: string[]
  onSymptomsChange: (symptoms: string[]) => void
  duration: string
  onDurationChange: (duration: string) => void
  severity: 'mild' | 'moderate' | 'severe'
  onSeverityChange: (severity: 'mild' | 'moderate' | 'severe') => void
}

const COMMON_SYMPTOMS = [
  'Headache', 'Fever', 'Cough', 'Fatigue', 'Nausea', 'Vomiting',
  'Dizziness', 'Chest Pain', 'Shortness of Breath', 'Abdominal Pain',
  'Back Pain', 'Joint Pain', 'Muscle Pain', 'Sore Throat', 'Runny Nose',
  'Diarrhea', 'Constipation', 'Bloating', 'Loss of Appetite', 'Insomnia',
  'Anxiety', 'Rash', 'Itching', 'Swelling', 'Numbness', 'Blurred Vision',
  'Weight Loss', 'Night Sweats', 'Chills', 'Weakness',
]

const DURATION_OPTIONS = [
  { value: 'less_than_24h', label: 'Less than 24 hours' },
  { value: '1-3_days', label: '1-3 days' },
  { value: '4-7_days', label: '4-7 days' },
  { value: '1-2_weeks', label: '1-2 weeks' },
  { value: '2-4_weeks', label: '2-4 weeks' },
  { value: '1-3_months', label: '1-3 months' },
  { value: '3-6_months', label: '3-6 months' },
  { value: 'more_than_6_months', label: 'More than 6 months' },
]

export default function SymptomsForm({
  symptoms,
  onSymptomsChange,
  duration,
  onDurationChange,
  severity,
  onSeverityChange,
}: SymptomsFormProps) {
  return (
    <div>
      <div className="section-title" style={{ marginBottom: '24px' }}>
        <ClipboardList style={{ color: 'var(--color-tertiary)', fontSize: '22px' }} />
        Describe Your Symptoms
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <TagInput
          label="What symptoms are you experiencing?"
          tags={symptoms}
          onChange={onSymptomsChange}
          placeholder="Type a symptom and press Enter..."
          suggestions={COMMON_SYMPTOMS}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label className="label">How long have you had these symptoms?</label>
            <select
              value={duration}
              onChange={(e) => onDurationChange(e.target.value)}
              className="input-field"
              style={{ cursor: 'pointer' }}
            >
              <option value="">Select duration</option>
              {DURATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Severity Level</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {(['mild', 'moderate', 'severe'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onSeverityChange(level)}
                  style={{
                    padding: '12px 8px',
                    borderRadius: '12px',
                    border: `2px solid ${
                      severity === level
                        ? level === 'mild' ? 'var(--color-tertiary)' : level === 'moderate' ? '#856404' : '#b71c1c'
                        : 'var(--color-outline-variant)'
                    }`,
                    background: severity === level
                      ? level === 'mild' ? 'var(--color-tertiary-container)' : level === 'moderate' ? '#fff3cd' : 'var(--color-error-container)'
                      : 'white',
                    color: severity === level
                      ? level === 'mild' ? 'var(--color-tertiary)' : level === 'moderate' ? '#856404' : '#b71c1c'
                      : 'var(--color-on-surface-variant)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textTransform: 'capitalize',
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}