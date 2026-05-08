-- ── Fas 6: Invite-kod för hushåll ──────────────────────────────────────────
-- Kör detta i Supabase SQL Editor

-- 1. Lägg till invite_code-kolumn
ALTER TABLE households ADD COLUMN IF NOT EXISTS invite_code varchar(6) UNIQUE;

-- 2. Funktion som genererar en unik 6-teckens kod (inga förväxlingsbara tecken)
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS varchar LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  varchar(6);
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM households WHERE invite_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- 3. Trigger: sätt koden automatiskt vid INSERT
CREATE OR REPLACE FUNCTION set_household_invite_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := generate_invite_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS households_invite_code_trigger ON households;
CREATE TRIGGER households_invite_code_trigger
  BEFORE INSERT ON households
  FOR EACH ROW EXECUTE FUNCTION set_household_invite_code();

-- 4. Fyll i koder för befintliga hushåll
UPDATE households SET invite_code = generate_invite_code() WHERE invite_code IS NULL;

-- 5. RPC: gå med i ett hushåll via kod
CREATE OR REPLACE FUNCTION join_household_by_code(
  p_user_id      uuid,
  p_code         text,
  p_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_household_id uuid;
  v_result       jsonb;
BEGIN
  SELECT id INTO v_household_id
  FROM households
  WHERE invite_code = upper(trim(p_code));

  IF v_household_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Ogiltig kod — kontrollera och försök igen');
  END IF;

  INSERT INTO profiles (id, display_name, household_id)
  VALUES (p_user_id, COALESCE(p_display_name, 'Ny användare'), v_household_id)
  ON CONFLICT (id) DO UPDATE
    SET household_id = v_household_id,
        display_name = COALESCE(p_display_name, profiles.display_name);

  SELECT to_jsonb(p) || jsonb_build_object('households', to_jsonb(h))
  INTO v_result
  FROM profiles p
  JOIN households h ON h.id = p.household_id
  WHERE p.id = p_user_id;

  RETURN v_result;
END;
$$;
