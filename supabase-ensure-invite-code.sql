-- Generera och spara invite_code för hushåll som saknar en (t.ex. skapade före Fas 6)
-- Kör i Supabase SQL Editor

CREATE OR REPLACE FUNCTION ensure_household_invite_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_household_id uuid;
  v_code         text;
BEGIN
  SELECT household_id INTO v_household_id FROM profiles WHERE id = p_user_id;
  IF v_household_id IS NULL THEN RETURN NULL; END IF;

  SELECT invite_code INTO v_code FROM households WHERE id = v_household_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  v_code := generate_invite_code();
  UPDATE households SET invite_code = v_code WHERE id = v_household_id;
  RETURN v_code;
END;
$$;
