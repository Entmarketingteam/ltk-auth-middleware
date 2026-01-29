-- Migration: Add support for Mavely, Amazon, and ShopMY platforms
-- Run this in your Supabase SQL Editor

-- Update the platform check constraint to include new platforms
ALTER TABLE platform_connections 
DROP CONSTRAINT IF EXISTS platform_connections_platform_check;

ALTER TABLE platform_connections 
ADD CONSTRAINT platform_connections_platform_check 
CHECK (platform IN ('LTK', 'MAVELY', 'AMAZON', 'SHOPMY'));

-- Ensure all required columns exist
ALTER TABLE platform_connections 
ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT,
ADD COLUMN IF NOT EXISTS encrypted_id_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refresh_error TEXT,
ADD COLUMN IF NOT EXISTS encryption_iv TEXT;

-- Create index for scheduled job queries
CREATE INDEX IF NOT EXISTS idx_platform_connections_scheduled_jobs
ON platform_connections (platform, status)
WHERE status = 'CONNECTED' AND metadata->'scheduled_job'->>'enabled' = 'true';

-- Create index for platform lookups
CREATE INDEX IF NOT EXISTS idx_platform_connections_user_platform
ON platform_connections (user_id, platform);

-- Create index for token refresh queries
CREATE INDEX IF NOT EXISTS idx_platform_connections_refresh 
ON platform_connections (platform, status, token_expires_at)
WHERE status = 'CONNECTED';

-- Add comment for documentation
COMMENT ON TABLE platform_connections IS 'Stores encrypted authentication tokens for creator platforms (LTK, Mavely, Amazon, ShopMY)';
COMMENT ON COLUMN platform_connections.encrypted_access_token IS 'AES-256-GCM encrypted access token';
COMMENT ON COLUMN platform_connections.encrypted_id_token IS 'AES-256-GCM encrypted ID token (if applicable)';
COMMENT ON COLUMN platform_connections.metadata IS 'JSON metadata including scheduled_job configuration, publisher_ids, etc.';
