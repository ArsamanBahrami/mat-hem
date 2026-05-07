-- Patch: lägg till delete_shopping_list-funktion
-- Kör detta i Supabase SQL Editor

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
