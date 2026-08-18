-- Run this in Supabase SQL Editor to set up storage for prescription photos

-- ===== CREATE STORAGE BUCKET =====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'record-attachments',
  'record-attachments',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- ===== DROP OLD RESTRICTIVE POLICIES =====
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;

-- ===== CREATE PERMISSIVE POLICIES =====
-- Allow any authenticated user to upload to record-attachments bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'record-attachments');

-- Allow anyone to view files in record-attachments bucket
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'record-attachments');

-- Allow authenticated users to delete from record-attachments
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'record-attachments');

-- ===== ALSO ENSURE TABLES EXIST =====
-- (Run the main schema first, but this is a safety net)

CREATE TABLE IF NOT EXISTS records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  date DATE NOT NULL,
  doctor_name TEXT,
  hospital_name TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  attachment_url TEXT,
  content_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing RLS policies on records and recreate
ALTER TABLE records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients can view own records" ON records;
DROP POLICY IF EXISTS "Patients can insert own records" ON records;
DROP POLICY IF EXISTS "Patients can update own records" ON records;
DROP POLICY IF EXISTS "Patients can delete own records" ON records;

CREATE POLICY "Patients can view own records" ON records FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "Patients can insert own records" ON records FOR INSERT WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Patients can update own records" ON records FOR UPDATE USING (patient_id = auth.uid());
CREATE POLICY "Patients can delete own records" ON records FOR DELETE USING (patient_id = auth.uid());
