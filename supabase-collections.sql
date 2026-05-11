-- ============================================================
-- Matvis: Samlingar (collections)
-- Kör i Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.collections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name         text NOT NULL,
  emoji        text,
  created_by   uuid REFERENCES public.profiles(id),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collection_recipes (
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  recipe_id     uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, recipe_id)
);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_recipes ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY "collections: household read"
  ON public.collections FOR SELECT
  USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "collections: household insert"
  ON public.collections FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "collections: household delete"
  ON public.collections FOR DELETE
  USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "collection_recipes: household read"
  ON public.collection_recipes FOR SELECT
  USING (collection_id IN (
    SELECT c.id FROM public.collections c
    JOIN public.profiles p ON p.household_id = c.household_id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "collection_recipes: household insert"
  ON public.collection_recipes FOR INSERT
  WITH CHECK (collection_id IN (
    SELECT c.id FROM public.collections c
    JOIN public.profiles p ON p.household_id = c.household_id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "collection_recipes: household delete"
  ON public.collection_recipes FOR DELETE
  USING (collection_id IN (
    SELECT c.id FROM public.collections c
    JOIN public.profiles p ON p.household_id = c.household_id
    WHERE p.id = auth.uid()
  ));

-- ── Funktioner ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fetch_collections(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hid uuid;
BEGIN
  SELECT household_id INTO v_hid FROM profiles WHERE id = p_user_id;
  IF v_hid IS NULL THEN RETURN '[]'::json; END IF;
  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id',           c.id,
        'name',         c.name,
        'emoji',        c.emoji,
        'created_at',   c.created_at,
        'recipe_count', (SELECT COUNT(*) FROM collection_recipes cr WHERE cr.collection_id = c.id)
      ) ORDER BY c.created_at DESC
    ), '[]'::json)
    FROM collections c WHERE c.household_id = v_hid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_collection(p_user_id uuid, p_name text, p_emoji text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hid uuid;
  v_id  uuid;
BEGIN
  SELECT household_id INTO v_hid FROM profiles WHERE id = p_user_id;
  IF v_hid IS NULL THEN RETURN json_build_object('error', 'Hushåll saknas'); END IF;
  INSERT INTO collections (household_id, name, emoji, created_by)
  VALUES (v_hid, p_name, p_emoji, p_user_id)
  RETURNING id INTO v_id;
  RETURN json_build_object('id', v_id, 'name', p_name, 'emoji', p_emoji, 'recipe_count', 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_collection(p_user_id uuid, p_collection_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hid uuid;
BEGIN
  SELECT household_id INTO v_hid FROM profiles WHERE id = p_user_id;
  DELETE FROM collections WHERE id = p_collection_id AND household_id = v_hid;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_recipe_to_collection(
  p_user_id      uuid,
  p_collection_id uuid,
  p_recipe_id    uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hid uuid;
BEGIN
  SELECT household_id INTO v_hid FROM profiles WHERE id = p_user_id;
  IF NOT EXISTS (SELECT 1 FROM collections WHERE id = p_collection_id AND household_id = v_hid) THEN
    RAISE EXCEPTION 'Samlingen hittades inte';
  END IF;
  INSERT INTO collection_recipes (collection_id, recipe_id)
  VALUES (p_collection_id, p_recipe_id)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_recipe_from_collection(
  p_user_id      uuid,
  p_collection_id uuid,
  p_recipe_id    uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hid uuid;
BEGIN
  SELECT household_id INTO v_hid FROM profiles WHERE id = p_user_id;
  IF NOT EXISTS (SELECT 1 FROM collections WHERE id = p_collection_id AND household_id = v_hid) THEN
    RAISE EXCEPTION 'Samlingen hittades inte';
  END IF;
  DELETE FROM collection_recipes
  WHERE collection_id = p_collection_id AND recipe_id = p_recipe_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_collection_recipes(p_user_id uuid, p_collection_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hid uuid;
BEGIN
  SELECT household_id INTO v_hid FROM profiles WHERE id = p_user_id;
  IF NOT EXISTS (SELECT 1 FROM collections WHERE id = p_collection_id AND household_id = v_hid) THEN
    RETURN '[]'::json;
  END IF;
  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id',           r.id,
        'title',        r.title,
        'image_url',    r.image_url,
        'tags',         r.tags,
        'prep_time_min', r.prep_time_min,
        'cook_time_min', r.cook_time_min
      ) ORDER BY r.title
    ), '[]'::json)
    FROM collection_recipes cr
    JOIN recipes r ON r.id = cr.recipe_id
    WHERE cr.collection_id = p_collection_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_recipe_collections(p_user_id uuid, p_recipe_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hid uuid;
BEGIN
  SELECT household_id INTO v_hid FROM profiles WHERE id = p_user_id;
  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object('id', c.id, 'name', c.name, 'emoji', c.emoji)
    ), '[]'::json)
    FROM collection_recipes cr
    JOIN collections c ON c.id = cr.collection_id
    WHERE cr.recipe_id = p_recipe_id AND c.household_id = v_hid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_collections           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_collection          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_collection          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_recipe_to_collection   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_recipe_from_collection TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_collection_recipes   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_recipe_collections   TO anon, authenticated;
