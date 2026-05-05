-- ============================================================
-- Mat-hem fas 2: Receptbank
-- Kör i Supabase SQL Editor
-- ============================================================

-- 1. Skapa tabellen recipes
CREATE TABLE IF NOT EXISTS public.recipes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  image_url     text,
  source_url    text,
  ingredients   jsonb NOT NULL DEFAULT '[]',
  instructions  jsonb NOT NULL DEFAULT '[]',
  servings      int NOT NULL DEFAULT 4,
  prep_time_min int,
  cook_time_min int,
  tags          text[] DEFAULT '{}',
  created_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- RLS-policies (för när JWT-verifieringen fungerar korrekt)
CREATE POLICY "recipes: household read"
  ON public.recipes FOR SELECT
  USING (household_id IN (
    SELECT household_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "recipes: household insert"
  ON public.recipes FOR INSERT
  WITH CHECK (household_id IN (
    SELECT household_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "recipes: household update"
  ON public.recipes FOR UPDATE
  USING (household_id IN (
    SELECT household_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "recipes: household delete"
  ON public.recipes FOR DELETE
  USING (household_id IN (
    SELECT household_id FROM public.profiles WHERE id = auth.uid()
  ));


-- ============================================================
-- SECURITY DEFINER-funktioner (primär väg för CRUD)
-- Kringgår RLS — verifierar användaren via auth.users
-- ============================================================

-- Hämta alla recept för ett hushåll
CREATE OR REPLACE FUNCTION public.fetch_recipes(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hid  uuid;
  v_rows json;
BEGIN
  SELECT household_id INTO v_hid FROM profiles WHERE id = p_user_id;
  IF v_hid IS NULL THEN RAISE EXCEPTION 'Inte autentiserad'; END IF;

  SELECT COALESCE(json_agg(r ORDER BY r.created_at DESC), '[]'::json)
  INTO v_rows
  FROM recipes r
  WHERE r.household_id = v_hid;

  RETURN v_rows;
END;
$$;

-- Hämta ett recept (verifierar hushållstillhörighet)
CREATE OR REPLACE FUNCTION public.fetch_recipe(p_user_id uuid, p_recipe_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hid   uuid;
  v_result json;
BEGIN
  SELECT household_id INTO v_hid FROM profiles WHERE id = p_user_id;
  IF v_hid IS NULL THEN RAISE EXCEPTION 'Inte autentiserad'; END IF;

  SELECT row_to_json(r.*) INTO v_result
  FROM recipes r
  WHERE r.id = p_recipe_id AND r.household_id = v_hid;

  RETURN v_result;
END;
$$;

-- Skapa eller uppdatera recept
CREATE OR REPLACE FUNCTION public.upsert_recipe(
  p_user_id      uuid,
  p_title        text,
  p_description  text    DEFAULT NULL,
  p_image_url    text    DEFAULT NULL,
  p_source_url   text    DEFAULT NULL,
  p_ingredients  jsonb   DEFAULT '[]',
  p_instructions jsonb   DEFAULT '[]',
  p_servings     int     DEFAULT 4,
  p_prep_time    int     DEFAULT NULL,
  p_cook_time    int     DEFAULT NULL,
  p_tags         text[]  DEFAULT '{}',
  p_id           uuid    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hid    uuid;
  v_result json;
BEGIN
  SELECT household_id INTO v_hid FROM profiles WHERE id = p_user_id;
  IF v_hid IS NULL THEN RAISE EXCEPTION 'Inte autentiserad'; END IF;

  IF p_id IS NOT NULL THEN
    UPDATE recipes SET
      title         = p_title,
      description   = p_description,
      image_url     = p_image_url,
      source_url    = p_source_url,
      ingredients   = p_ingredients,
      instructions  = p_instructions,
      servings      = p_servings,
      prep_time_min = p_prep_time,
      cook_time_min = p_cook_time,
      tags          = p_tags
    WHERE id = p_id AND household_id = v_hid
    RETURNING row_to_json(recipes.*) INTO v_result;
  ELSE
    INSERT INTO recipes
      (household_id, title, description, image_url, source_url,
       ingredients, instructions, servings, prep_time_min, cook_time_min,
       tags, created_by)
    VALUES
      (v_hid, p_title, p_description, p_image_url, p_source_url,
       p_ingredients, p_instructions, p_servings, p_prep_time, p_cook_time,
       p_tags, p_user_id)
    RETURNING row_to_json(recipes.*) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- Ta bort recept
CREATE OR REPLACE FUNCTION public.delete_recipe(p_user_id uuid, p_recipe_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_hid uuid;
BEGIN
  SELECT household_id INTO v_hid FROM profiles WHERE id = p_user_id;
  IF v_hid IS NULL THEN RAISE EXCEPTION 'Inte autentiserad'; END IF;
  DELETE FROM recipes WHERE id = p_recipe_id AND household_id = v_hid;
  RETURN FOUND;
END;
$$;

-- Ge behörighet att anropa funktionerna
GRANT EXECUTE ON FUNCTION public.fetch_recipes  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_recipe   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_recipe  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_recipe  TO anon, authenticated;


-- ============================================================
-- Supabase Storage — recipe-images
-- Gör detta i Supabase Dashboard: Storage → New bucket
--   Name: recipe-images
--   Public bucket: JA (kryssa i)
-- Kör sedan nedanstående för storage-policies:
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "recipe-images: authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'recipe-images');

CREATE POLICY "recipe-images: anon upload"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'recipe-images');

CREATE POLICY "recipe-images: public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'recipe-images');

CREATE POLICY "recipe-images: owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'recipe-images');
