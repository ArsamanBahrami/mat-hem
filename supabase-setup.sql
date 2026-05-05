-- ============================================================
-- Mat-hem: Supabase databas-setup
-- Kör detta i Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- 1. Skapa tabellen "households"
CREATE TABLE IF NOT EXISTS public.households (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Skapa tabellen "profiles"
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id uuid REFERENCES public.households(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;

-- Profiles: användare kan bara läsa/skriva sin EGEN rad
CREATE POLICY "profiles: own row read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: own row insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: own row update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Households: användare kan bara läsa det hushåll de tillhör
CREATE POLICY "households: member can read"
  ON public.households FOR SELECT
  USING (
    id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Households: användare kan skapa ett hushåll (vid onboarding)
CREATE POLICY "households: authenticated can insert"
  ON public.households FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
