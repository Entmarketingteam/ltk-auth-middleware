/**
 * Platform Storage Service
 * 
 * Generic service for storing encrypted tokens for multiple platforms:
 * - LTK
 * - Mavely
 * - Amazon Creator
 * - ShopMY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { encryptToken, decryptToken } from '../utils/encryption.js';

export type Platform = 'LTK' | 'MAVELY' | 'AMAZON' | 'SHOPMY';
export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

interface StoredConnection {
  id: string;
  user_id: string;
  platform: Platform;
  status: ConnectionStatus;
  encrypted_access_token: string | null;
  encrypted_id_token: string | null;
  token_expires_at: string | null;
  last_refresh_at: string | null;
  refresh_error: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PlatformTokens {
  accessToken: string;
  idToken?: string;
  sessionCookie?: string;
  expiresAt: number; // Unix timestamp
  metadata?: Record<string, unknown>;
}

let supabase: SupabaseClient | null = null;

/**
 * Get Supabase client (singleton)
 */
function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

/**
 * Store platform tokens for a user (encrypted)
 */
export async function storePlatformTokens(
  userId: string,
  platform: Platform,
  tokens: PlatformTokens
): Promise<void> {
  const db = getSupabase();

  // Encrypt tokens
  const encryptedAccessToken = encryptToken(tokens.accessToken);
  const encryptedIdToken = tokens.idToken ? encryptToken(tokens.idToken) : null;

  // Check if connection already exists
  const { data: existing } = await db
    .from('platform_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single();

  const connectionData = {
    user_id: userId,
    platform,
    status: 'CONNECTED' as const,
    encrypted_access_token: encryptedAccessToken,
    encrypted_id_token: encryptedIdToken,
    token_expires_at: new Date(tokens.expiresAt * 1000).toISOString(),
    connected_at: new Date().toISOString(),
    last_refresh_at: new Date().toISOString(),
    refresh_error: null,
    updated_at: new Date().toISOString(),
    metadata: tokens.metadata || {},
  };

  if (existing) {
    // Update existing connection
    const { error } = await db
      .from('platform_connections')
      .update(connectionData)
      .eq('id', existing.id);

    if (error) {
      throw new Error(`Failed to update connection: ${error.message}`);
    }
  } else {
    // Create new connection
    const { error } = await db
      .from('platform_connections')
      .insert({
        ...connectionData,
        created_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to create connection: ${error.message}`);
    }
  }

  console.log(`[Platform Storage] Stored encrypted tokens for user ${userId} on ${platform}`);
}

/**
 * Retrieve platform tokens for a user (decrypted)
 */
export async function getPlatformTokens(
  userId: string,
  platform: Platform
): Promise<PlatformTokens | null> {
  const db = getSupabase();

  const { data, error } = await db
    .from('platform_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('status', 'CONNECTED')
    .single();

  if (error || !data) {
    return null;
  }

  const connection = data as StoredConnection;

  if (!connection.encrypted_access_token) {
    return null;
  }

  try {
    const accessToken = decryptToken(connection.encrypted_access_token);
    const idToken = connection.encrypted_id_token 
      ? decryptToken(connection.encrypted_id_token)
      : undefined;
    const expiresAt = connection.token_expires_at
      ? Math.floor(new Date(connection.token_expires_at).getTime() / 1000)
      : 0;

    const metadata = (connection.metadata as Record<string, unknown>) || {};

    return { 
      accessToken, 
      idToken, 
      expiresAt, 
      metadata,
      sessionCookie: metadata.sessionCookie as string | undefined,
    };
  } catch (decryptError) {
    console.error(`[Platform Storage] Failed to decrypt tokens for user ${userId} on ${platform}:`, decryptError);
    return null;
  }
}

/**
 * Get connection status for a user
 */
export async function getPlatformConnectionStatus(
  userId: string,
  platform: Platform
): Promise<{
  connected: boolean;
  status: ConnectionStatus | 'NOT_FOUND';
  expiresAt?: Date;
  lastRefresh?: Date;
  error?: string;
}> {
  const db = getSupabase();
  
  const { data, error } = await db
    .from('platform_connections')
    .select('status, token_expires_at, last_refresh_at, refresh_error')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single();
  
  if (error || !data) {
    return {
      connected: false,
      status: 'NOT_FOUND',
    };
  }
  
  const connection = data as Pick<StoredConnection, 'status' | 'token_expires_at' | 'last_refresh_at' | 'refresh_error'>;
  
  return {
    connected: connection.status === 'CONNECTED',
    status: connection.status,
    expiresAt: connection.token_expires_at 
      ? new Date(connection.token_expires_at) 
      : undefined,
    lastRefresh: connection.last_refresh_at 
      ? new Date(connection.last_refresh_at) 
      : undefined,
    error: connection.refresh_error || undefined,
  };
}

/**
 * Disconnect platform (remove tokens)
 */
export async function disconnectPlatform(
  userId: string,
  platform: Platform
): Promise<void> {
  const db = getSupabase();

  const { error } = await db
    .from('platform_connections')
    .update({
      status: 'DISCONNECTED',
      encrypted_access_token: null,
      encrypted_id_token: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('platform', platform);

  if (error) {
    throw new Error(`Failed to disconnect: ${error.message}`);
  }

  console.log(`[Platform Storage] Disconnected ${platform} for user ${userId}`);
}

/**
 * Mark connection as having an error
 */
export async function markPlatformError(
  userId: string,
  platform: Platform,
  errorMessage: string
): Promise<void> {
  const db = getSupabase();
  
  const { error } = await db
    .from('platform_connections')
    .update({
      status: 'ERROR',
      refresh_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('platform', platform);
  
  if (error) {
    console.error(`Failed to mark connection error: ${error.message}`);
  }
}

/**
 * Update metadata for a platform connection
 */
export async function updatePlatformMetadata(
  userId: string,
  platform: Platform,
  metadata: Record<string, unknown>
): Promise<void> {
  const db = getSupabase();

  const { data: existing, error: fetchError } = await db
    .from('platform_connections')
    .select('id, metadata')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single();

  if (fetchError || !existing) {
    throw new Error(`No ${platform} connection found for user`);
  }

  const currentMetadata = (existing.metadata as Record<string, unknown>) || {};
  const updatedMetadata = {
    ...currentMetadata,
    ...metadata,
  };

  const { error } = await db
    .from('platform_connections')
    .update({
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  if (error) {
    throw new Error(`Failed to update metadata: ${error.message}`);
  }

  console.log(`[Platform Storage] Updated metadata for user ${userId} on ${platform}`);
}
