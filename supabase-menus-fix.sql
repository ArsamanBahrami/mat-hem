-- Patch: ändra sortering från week_start_date till created_at DESC
-- Kör detta i Supabase SQL Editor

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
