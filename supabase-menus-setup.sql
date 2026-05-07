-- ── Tabell ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_menus (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  week_start_date date        NOT NULL,
  days            jsonb       NOT NULL DEFAULT '{}',
  parameters      jsonb       NOT NULL DEFAULT '{}',
  created_by      uuid        REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE weekly_menus ENABLE ROW LEVEL SECURITY;

-- ── RLS-policies ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "household_select_menus" ON weekly_menus;
CREATE POLICY "household_select_menus" ON weekly_menus
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "household_insert_menus" ON weekly_menus;
CREATE POLICY "household_insert_menus" ON weekly_menus
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "household_delete_menus" ON weekly_menus;
CREATE POLICY "household_delete_menus" ON weekly_menus
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

-- ── SECURITY DEFINER-funktioner ─────────────────────────────────────────────

-- Hämta senaste menyn för hushållet
CREATE OR REPLACE FUNCTION fetch_current_menu(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_household_id uuid;
  v_result       jsonb;
BEGIN
  SELECT household_id INTO v_household_id FROM profiles WHERE id = p_user_id;
  IF v_household_id IS NULL THEN RETURN NULL; END IF;

  SELECT to_jsonb(m) INTO v_result
  FROM weekly_menus m
  WHERE m.household_id = v_household_id
  ORDER BY m.created_at DESC
  LIMIT 1;

  RETURN v_result;
END;
$$;

-- Hämta menyhistorik (senaste N menyer)
CREATE OR REPLACE FUNCTION fetch_menu_history(p_user_id uuid, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_household_id uuid;
BEGIN
  SELECT household_id INTO v_household_id FROM profiles WHERE id = p_user_id;
  IF v_household_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.created_at DESC), '[]'::jsonb)
    FROM weekly_menus m
    WHERE m.household_id = v_household_id
    LIMIT p_limit
  );
END;
$$;

-- Spara en ny meny
CREATE OR REPLACE FUNCTION save_menu(
  p_user_id        uuid,
  p_week_start_date date,
  p_days           jsonb,
  p_parameters     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_household_id uuid;
  v_result       jsonb;
BEGIN
  SELECT household_id INTO v_household_id FROM profiles WHERE id = p_user_id;
  IF v_household_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO weekly_menus (household_id, week_start_date, days, parameters, created_by)
  VALUES (v_household_id, p_week_start_date, p_days, p_parameters, p_user_id)
  RETURNING to_jsonb(weekly_menus.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- Hämta recipe_ids från senaste N veckornas menyer (för att undvika repetition)
CREATE OR REPLACE FUNCTION fetch_recent_menu_recipe_ids(p_user_id uuid, p_weeks int DEFAULT 2)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_household_id uuid;
BEGIN
  SELECT household_id INTO v_household_id FROM profiles WHERE id = p_user_id;
  IF v_household_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(DISTINCT kv.val), '[]'::jsonb)
    FROM weekly_menus m,
    LATERAL jsonb_each_text(m.days) AS kv(k, val)
    WHERE m.household_id = v_household_id
      AND m.week_start_date >= (current_date - (p_weeks * 7))
      AND kv.val IS NOT NULL
  );
END;
$$;
