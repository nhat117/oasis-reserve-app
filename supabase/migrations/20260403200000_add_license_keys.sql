-- License keys table for feature gating
CREATE TABLE IF NOT EXISTS license_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  features text[] NOT NULL DEFAULT ARRAY['ai_chat', 'inbox', 'knowledge_base'],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  expires_at timestamptz,
  notes text
);

-- Index for fast key lookup
CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(key);
CREATE INDEX IF NOT EXISTS idx_license_keys_tenant ON license_keys(tenant_id);

-- RLS
ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write license keys
CREATE POLICY "Service role full access on license_keys"
  ON license_keys FOR ALL
  USING (auth.role() = 'service_role');

-- Function to generate a formatted license key (XXXX-XXXX-XXXX-XXXX)
CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
  j int;
BEGIN
  FOR i IN 1..4 LOOP
    IF i > 1 THEN result := result || '-'; END IF;
    FOR j IN 1..4 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
  END LOOP;
  RETURN result;
END;
$$;

-- Function to batch-generate license keys
CREATE OR REPLACE FUNCTION generate_license_keys(count int DEFAULT 5, feature_list text[] DEFAULT ARRAY['ai_chat', 'inbox', 'knowledge_base'])
RETURNS SETOF license_keys
LANGUAGE plpgsql
AS $$
DECLARE
  i int;
  new_key text;
BEGIN
  FOR i IN 1..count LOOP
    LOOP
      new_key := generate_license_key();
      -- Ensure uniqueness
      EXIT WHEN NOT EXISTS (SELECT 1 FROM license_keys WHERE key = new_key);
    END LOOP;
    RETURN QUERY
      INSERT INTO license_keys (key, features)
      VALUES (new_key, feature_list)
      RETURNING *;
  END LOOP;
END;
$$;
