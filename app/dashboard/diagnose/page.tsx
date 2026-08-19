'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PatientInfoForm from '@/components/forms/PatientInfoForm'
import SymptomsForm from '@/components/forms/SymptomsForm'
import ConditionsForm from '@/components/forms/ConditionsForm'
import { PatientInfo, DiagnosticInput } from '@/types'

export default function DiagnosePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: '', age: 0, gender: 'male', weight: undefined, height: undefined, allergies: [], currentMedications: [],
  })
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [duration, setDuration] = useState('')
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('mild')
  const [conditions, setConditions] = useState<string[]>([])

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {}
    if (!patientInfo.name) newErrors.name = 'Name is required'
    if (!patientInfo.age || patientInfo.age < 1 || patientInfo.age > 120) newErrors.age = 'Age must be between 1 and 120'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {}
    if (symptoms.length === 0) newErrors.symptoms = 'At least one symptom is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2)
    else if (step === 2 && validateStep2()) setStep(3)
  }

  const handleSubmit = async () => {
    setLoading(true)
    const input: DiagnosticInput = {
      patientInfo, symptoms, existingConditions: conditions, symptomDuration: duration, severity,
    }

    try {
      let userId = 'demo-user'
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) userId = authUser.id
        } catch (err) {
          console.error('Failed to save diagnosis:', err)
        }

      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!response.ok) throw new Error('Diagnosis failed')
      const data = await response.json()

      if (data.diagnosis) {
        try {
          const { data: saved } = await supabase
            .from('diagnoses')
            .insert({
              user_id: userId, patient_name: patientInfo.name, age: patientInfo.age, gender: patientInfo.gender,
              weight: patientInfo.weight, height: patientInfo.height, allergies: patientInfo.allergies,
              current_medications: patientInfo.currentMedications, symptoms, existing_conditions: conditions,
              symptom_duration: duration, severity, ai_response: data.diagnosis,
            })
            .select()
            .single()

          if (saved) { router.push(`/dashboard/results/${saved.id}`); return }
      } catch (err) {
        console.error('Failed to get user:', err)
      }
        alert('Diagnosis complete!\n\n' + data.diagnosis)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to process diagnosis')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }} className="animate-fade-in">
        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-primary)' }}>clinical_notes</span>
          Symptom Checker
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--color-on-surface-variant)' }}>
          Step {step} of 3 — {step === 1 ? 'Your Information' : step === 2 ? 'Symptoms' : 'Medical History'}
        </p>
      </div>

      <div className="progress-bar animate-fade-in" style={{ animationDelay: '0.1s', marginBottom: '32px' }}>
        <div className="progress-fill" style={{ width: `${(step / 3) * 100}%` }}></div>
      </div>

      <div className="glass-card animate-fade-in" style={{ animationDelay: '0.2s', padding: '32px' }}>
        {step === 1 && <PatientInfoForm data={patientInfo} onChange={setPatientInfo} errors={errors} />}
        {step === 2 && <SymptomsForm symptoms={symptoms} onSymptomsChange={setSymptoms} duration={duration} onDurationChange={setDuration} severity={severity} onSeverityChange={setSeverity} />}
        {step === 3 && <ConditionsForm conditions={conditions} onConditionsChange={setConditions} allergies={patientInfo.allergies} onAllergiesChange={(allergies) => setPatientInfo({ ...patientInfo, allergies })} medications={patientInfo.currentMedications} onMedicationsChange={(currentMedications) => setPatientInfo({ ...patientInfo, currentMedications })} />}

        <div className="flex justify-between" style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--color-outline-variant)' }}>
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)} className="btn-secondary" style={{ padding: '12px 24px', fontSize: '14px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span> Back
            </button>
          ) : <div />}
          {step < 3 ? (
            <button onClick={handleNext} className="btn-primary" style={{ padding: '12px 24px', fontSize: '14px' }}>
              Continue <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="btn-primary disabled:opacity-50" style={{ padding: '12px 24px', fontSize: '14px' }}>
              {loading ? 'Analyzing...' : 'Get Diagnosis'}
              {!loading && <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>auto_awesome</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
