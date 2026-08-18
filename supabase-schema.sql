-- MediSync Health - Supabase Database Schema
-- Run this in your Supabase SQL Editor to create all required tables

-- ===== DIAGNOSES TABLE (from ai-diagnostic) =====
CREATE TABLE IF NOT EXISTS diagnoses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL,
  weight NUMERIC,
  height NUMERIC,
  allergies JSONB DEFAULT '[]'::jsonb,
  current_medications JSONB DEFAULT '[]'::jsonb,
  symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
  existing_conditions JSONB DEFAULT '[]'::jsonb,
  symptom_duration TEXT,
  severity TEXT NOT NULL DEFAULT 'mild',
  ai_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== RECORDS TABLE (from medisync) =====
CREATE TABLE IF NOT EXISTS records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('prescription', 'lab_result', 'checkup', 'surgery', 'imaging', 'other')),
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

CREATE INDEX IF NOT EXISTS idx_records_patient_date ON records(patient_id, date);

-- ===== ACCESS REQUESTS TABLE (from medisync) =====
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_requests_doctor ON access_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_patient ON access_requests(patient_id);

-- ===== EMERGENCY ACCESS TABLE (from medisync) =====
CREATE TABLE IF NOT EXISTS emergency_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  reason_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_access_doctor ON emergency_access(doctor_id);
CREATE INDEX IF NOT EXISTS idx_emergency_access_patient ON emergency_access(patient_id);

-- ===== GUARDIAN LINKS TABLE (from medisync) =====
CREATE TABLE IF NOT EXISTS guardian_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('minor', 'advance_directive', 'emergency_incapacity')),
  status TEXT NOT NULL DEFAULT 'pending_guardian' CHECK (status IN ('pending_guardian', 'pending_senior', 'active_shared_control', 'sole_active', 'denied', 'revoked', 'expired')),
  authority_document_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardian_links_patient ON guardian_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_guardian_links_guardian ON guardian_links(guardian_id);

-- ===== USERS TABLE (extended profile for medisync features) =====
-- Note: Supabase Auth handles users via auth.users
-- This table stores additional profile data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  role TEXT DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== AUTO-CREATE PROFILE ON SIGNUP =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== ROW LEVEL SECURITY =====
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Diagnoses: users can read/write their own
CREATE POLICY "Users can view own diagnoses" ON diagnoses FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "Users can insert own diagnoses" ON diagnoses FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "Users can delete own diagnoses" ON diagnoses FOR DELETE USING (user_id = auth.uid()::text);

-- Records: patients own their records
CREATE POLICY "Patients can view own records" ON records FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "Patients can insert own records" ON records FOR INSERT WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Patients can update own records" ON records FOR UPDATE USING (patient_id = auth.uid());
CREATE POLICY "Patients can delete own records" ON records FOR DELETE USING (patient_id = auth.uid());

-- Access requests: doctors create, patients manage
CREATE POLICY "Doctors can view own sent requests" ON access_requests FOR SELECT USING (doctor_id = auth.uid() OR patient_id = auth.uid());
CREATE POLICY "Doctors can create requests" ON access_requests FOR INSERT WITH CHECK (doctor_id = auth.uid());
CREATE POLICY "Users can update relevant requests" ON access_requests FOR UPDATE USING (doctor_id = auth.uid() OR patient_id = auth.uid());

-- Emergency access: doctors invoke, patients see
CREATE POLICY "Users can view relevant emergency access" ON emergency_access FOR SELECT USING (doctor_id = auth.uid() OR patient_id = auth.uid());
CREATE POLICY "Doctors can create emergency access" ON emergency_access FOR INSERT WITH CHECK (doctor_id = auth.uid());
CREATE POLICY "Users can update relevant emergency access" ON emergency_access FOR UPDATE USING (doctor_id = auth.uid() OR patient_id = auth.uid());

-- Guardian links: both parties can view/manage
CREATE POLICY "Users can view own guardian links" ON guardian_links FOR SELECT USING (patient_id = auth.uid() OR guardian_id = auth.uid());
CREATE POLICY "Users can create guardian links" ON guardian_links FOR INSERT WITH CHECK (patient_id = auth.uid() OR guardian_id = auth.uid());
CREATE POLICY "Users can update own guardian links" ON guardian_links FOR UPDATE USING (patient_id = auth.uid() OR guardian_id = auth.uid());

-- Profiles: users can view/update own
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
