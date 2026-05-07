-- ── Tabell ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopping_lists (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  menu_id      uuid        REFERENCES weekly_menus(id) ON DELETE SET NULL,
  items        jsonb       NOT NULL DEFAULT '[]',
  created_by   uuid        REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;

-- ── RLS-policies ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "household_select_shopping" ON shopping_lists;
CREATE POLICY "household_select_shopping" ON shopping_lists
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "household_insert_shopping" ON shopping_lists;
CREATE POLICY "household_insert_shopping" ON shopping_lists
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "household_update_shopping" ON shopping_lists;
CREATE POLICY "household_update_shopping" ON shopping_lists
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "household_delete_shopping" ON shopping_lists;
CREATE POLICY "household_delete_shopping" ON shopping_lists
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

-- ── Realtime ────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE shopping_lists;

-- ── SECURITY DEFINER-funktioner ─────────────────────────────────────────────

-- Hämta senaste inköpslistan för hushållet
CREATE OR REPLACE FUNCTION fetch_shopping_list(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_household_id uuid;
  v_result       jsonb;
BEGIN
  SELECT household_id INTO v_household_id FROM profiles WHERE id = p_user_id;
  IF v_household_id IS NULL THEN RETURN NULL; END IF;

  SELECT to_jsonb(sl) INTO v_result
  FROM shopping_lists sl
  WHERE sl.household_id = v_household_id
  ORDER BY sl.created_at DESC
  LIMIT 1;

  RETURN v_result;
END;
$$;

-- Spara ny inköpslista (ersätter inte befintliga)
CREATE OR REPLACE FUNCTION save_shopping_list(
  p_user_id uuid,
  p_items   jsonb,
  p_menu_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_household_id uuid;
  v_result       jsonb;
BEGIN
  SELECT household_id INTO v_household_id FROM profiles WHERE id = p_user_id;
  IF v_household_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO shopping_lists (household_id, menu_id, items, created_by)
  VALUES (v_household_id, p_menu_id, p_items, p_user_id)
  RETURNING to_jsonb(shopping_lists.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- Radera en inköpslista
CREATE OR REPLACE FUNCTION delete_shopping_list(p_user_id uuid, p_list_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_household_id uuid;
BEGIN
  SELECT household_id INTO v_household_id FROM profiles WHERE id = p_user_id;
  IF v_household_id IS NULL THEN RETURN; END IF;

  DELETE FROM shopping_lists
  WHERE id = p_list_id
    AND household_id = v_household_id;
END;
$$;

-- Uppdatera items på en befintlig lista (används vid bocka av + offline-sync)
CREATE OR REPLACE FUNCTION update_shopping_list_items(
  p_user_id uuid,
  p_list_id uuid,
  p_items   jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_household_id uuid;
BEGIN
  SELECT household_id INTO v_household_id FROM profiles WHERE id = p_user_id;
  IF v_household_id IS NULL THEN RETURN; END IF;

  UPDATE shopping_lists
  SET items = p_items
  WHERE id = p_list_id
    AND household_id = v_household_id;
END;
$$;
