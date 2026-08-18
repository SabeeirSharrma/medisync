'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const RECORD_TYPES = ['prescription', 'lab_result', 'checkup', 'surgery', 'imaging', 'other'] as const

export default function NewRecordPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<string>('prescription')
  const [date, setDate] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [hospitalName, setHospitalName] = useState('')
  const [details, setDetails] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
    if (!allowedTypes.includes(selected.type)) {
      setError('Please upload a valid image (JPEG, PNG, WebP) or PDF')
      return
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setFile(selected)
    setError('')

    if (selected.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(selected)
    } else {
      setPreview('pdf')
    }
  }

  const removeFile = () => {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadFile = async (file: File, userId: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/${Date.now()}.${fileExt}`

    try {
      // Try uploading to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('record-attachments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        // If bucket doesn't exist, try to create it
        if (uploadError.message?.includes('Bucket not found') || uploadError.statusCode === '404') {
          setUploadProgress('Setting up storage...')
          // Try creating the bucket via SQL would be needed here
          // For now, fall back to data URL storage
          return await convertToDataUrl(file)
        }
        throw uploadError
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('record-attachments')
        .getPublicUrl(fileName)

      return urlData.publicUrl
    } catch (err) {
      console.error('Upload failed, falling back to data URL:', err)
      // Fallback: store as data URL in the record itself
      return await convertToDataUrl(file)
    }
  }

  const convertToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setUploadProgress('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      let attachmentUrl = null
      let contentType = null
      let fileSize = null

      if (file) {
        setUploadProgress('Uploading prescription photo...')
        attachmentUrl = await uploadFile(file, user.id)
        contentType = file.type
        fileSize = file.size
        setUploadProgress('Upload complete!')
      }

      setUploadProgress('Saving record...')

      const detailsObj = details.trim() ? { notes: details.trim() } : {}

      const { data, error: insertError } = await supabase.from('records').insert({
        patient_id: user.id,
        type,
        date,
        doctor_name: doctorName || null,
        hospital_name: hospitalName || null,
        details: detailsObj,
        attachment_url: attachmentUrl,
        content_type: contentType,
        file_size: fileSize,
      }).select()

      if (insertError) {
        console.error('Insert error:', insertError)
        throw new Error(`Failed to save record: ${insertError.message}`)
      }

      setUploadProgress('Record saved!')
      router.push('/dashboard/records')
    } catch (err) {
      console.error('Submit error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create record. Please try again.')
    } finally {
      setLoading(false)
      setUploadProgress('')
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }} className="animate-fade-in">
        <Link href="/dashboard/records" className="inline-flex items-center gap-1" style={{ fontSize: '14px', color: 'var(--color-primary)', textDecoration: 'none', marginBottom: '16px', fontWeight: 500 }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span> Back to Records
        </Link>
        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
          <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-primary)' }}>add_note</span>
          Add Medical Record
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--color-on-surface-variant)' }}>
          Upload a prescription photo or add record details
        </p>
      </div>

      <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Photo Upload Section */}
          <div>
            <label className="label" style={{ fontSize: '16px', fontWeight: 600 }}>
              <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '8px', fontSize: '20px' }}>photo_camera</span>
              Prescription Photo
            </label>
            <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', marginBottom: '12px' }}>
              Upload a photo of your prescription, lab report, or medical document
            </p>

            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--color-outline-variant)',
                  borderRadius: '16px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: 'rgba(255,255,255,0.4)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-primary-container)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.background = 'rgba(255,255,255,0.4)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-primary)', marginBottom: '12px', display: 'block' }}>cloud_upload</span>
                <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>Click to upload</p>
                <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>JPEG, PNG, WebP, or PDF (max 10MB)</p>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                {preview && preview !== 'pdf' ? (
                  <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--color-outline-variant)' }}>
                    <img src={preview} alt="Prescription preview" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', background: 'white' }} />
                  </div>
                ) : (
                  <div style={{ padding: '32px', borderRadius: '16px', border: '1px solid var(--color-outline-variant)', background: 'white', textAlign: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-primary)', marginBottom: '8px', display: 'block' }}>description</span>
                    <p style={{ fontSize: '14px', fontWeight: 600 }}>{file.name}</p>
                    <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={removeFile}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {/* Record Details */}
          <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: '24px' }}>
            <label className="label" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
              <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '8px', fontSize: '20px' }}>edit_note</span>
              Record Details
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="label">Record Type <span style={{ color: '#b71c1c' }}>*</span></label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="input-field" style={{ cursor: 'pointer' }}>
                    {RECORD_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Date <span style={{ color: '#b71c1c' }}>*</span></label>
                  <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="label">Doctor Name</label>
                  <input type="text" placeholder="Optional" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="label">Hospital / Clinic</label>
                  <input type="text" placeholder="Optional" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} className="input-field" />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Additional notes about this record..." className="input-field" style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>

          {error && (
            <div style={{ padding: '16px', background: 'var(--color-error-container)', borderRadius: '12px', fontSize: '13px' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#b71c1c' }}>error</span>
                <strong>Error</strong>
              </div>
              {error}
              <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', fontSize: '12px' }}>
                <strong>Fix:</strong> Run the <code>supabase-storage.sql</code> file in your Supabase SQL Editor to set up the storage bucket.
              </div>
            </div>
          )}

          {uploadProgress && (
            <div style={{ padding: '12px 16px', background: 'var(--color-primary-container)', borderRadius: '12px', fontSize: '13px', color: 'var(--color-on-primary-container)' }}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>sync</span>
                {uploadProgress}
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50" style={{ padding: '16px', fontSize: '16px', alignSelf: 'stretch' }}>
            {loading ? 'Saving...' : 'Save Record'}
            {!loading && <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>}
          </button>
        </form>
      </div>
    </div>
  )
}
