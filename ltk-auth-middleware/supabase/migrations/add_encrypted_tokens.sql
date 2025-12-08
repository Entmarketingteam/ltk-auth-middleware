-- Migration: Add encrypted token storage to platform_connections
-- Run this in your Supabase SQL Editor

-- Add new columns for encrypted token storage
ALTER TABLE platform_connections 
ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT,
ADD COLUMN IF NOT EXISTS encrypted_id_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refresh_error TEXT;

-- Create an index for efficient token refresh queries
CREATE INDEX IF NOT EXISTS idx_platform_connections_ltk_refresh 
ON platform_connections (platform, status, token_expires_at)
WHERE platform = 'LTK' AND status = 'CONNECTED';

-- Add a comment explaining the encryption
COMMENT ON COLUMN platform_connections.encrypted_access_token IS 
  'AES-256-GCM encrypted LTK access token. Format: iv.authTag.ciphertext (base64)';
COMMENT ON COLUMN platform_connections.encrypted_id_token IS 
  'AES-256-GCM encrypted LTK ID token. Format: iv.authTag.ciphertext (base64)';

-- Grant permissions (if using RLS)
-- Note: The middleware uses SUPABASE_SERVICE_KEY which bypasses RLS
-- But if you want RLS for direct access:
-- ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view own connections" ON platform_connections
--   FOR SELECT USING (auth.uid() = user_id);
