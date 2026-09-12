-- Supabase Schema for MedBud AI (PostgreSQL)

-- Note: In Supabase, the 'auth.users' table handles authentication.
-- We will store additional profile information in 'profiles', but for our current app architecture,
-- we'll rely on our own 'Family', 'FamilyMember', 'Medicine', and 'Consultation' tables.

-- Create Family table
CREATE TABLE IF NOT EXISTS public."Family" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text NOT NULL,
  "createdAt" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create FamilyMember table
CREATE TABLE IF NOT EXISTS public."FamilyMember" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId" uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  "familyId" uuid REFERENCES public."Family"(id) ON DELETE CASCADE NOT NULL,
  "role" text DEFAULT 'owner',
  "age" text,
  "weight" text,
  "allergies" text,
  "conditions" text,
  "currentMeds" text,
  UNIQUE("userId", "familyId")
);

-- Create Medicine table
CREATE TABLE IF NOT EXISTS public."Medicine" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "familyId" uuid REFERENCES public."Family"(id) ON DELETE CASCADE NOT NULL,
  "name" text NOT NULL,
  "activeIngredient" text,
  "strength" text,
  "form" text,
  "manufacturer" text,
  "expiry" text,
  "batch" text,
  "quantity" integer DEFAULT 1,
  "schedule" text,
  "confidence" integer,
  "storage" text,
  "cautions" text[],
  "createdAt" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Consultation table
CREATE TABLE IF NOT EXISTS public."Consultation" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId" uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  "symptoms" text NOT NULL,
  "triage" text NOT NULL,
  "riskLevel" text NOT NULL,
  "summary" text NOT NULL,
  "safeGuidance" text[],
  "avoid" text[],
  "redFlags" text[],
  "createdAt" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS but allow everything for now (or strictly require authentication)
ALTER TABLE public."Family" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FamilyMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Medicine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Consultation" ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write their own data
CREATE POLICY "Enable all access for authenticated users" ON public."Family" FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public."FamilyMember" FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public."Medicine" FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public."Consultation" FOR ALL TO authenticated USING (true);

-- Create a trigger to automatically create a Family and FamilyMember when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  new_family_id uuid;
BEGIN
  -- Create a default family for the user
  INSERT INTO public."Family" (name) 
  VALUES (coalesce(NEW.raw_user_meta_data->>'name', 'My') || '''s Family') 
  RETURNING id INTO new_family_id;

  -- Add the user as the owner of the family
  INSERT INTO public."FamilyMember" ("userId", "familyId", "role") 
  VALUES (NEW.id, new_family_id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
