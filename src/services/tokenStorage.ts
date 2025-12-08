/**
 * Token Storage Service
 * 
 * Handles encrypted storage and retrieval of LTK tokens in Supabase.
 * All tokens are encrypted with AES-256-GCM before storage.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { encryptToken, decryptToken } from '../utils/encryption.js';

interface StoredConnection {
  id: string;
  user_id: string;
  platform: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
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

export interface LTKTokens {
  accessToken: string;
  idToken: string;
  expiresAt: number; // Unix timestamp
}

export interface ConnectionStatus {
  connected: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'NOT_FOUND';
  expiresAt?: Date;
  lastRefresh?: Date;
  error?: string;
}

let supabase: SupabaseClient | null = null;

/**
 * Get Supabase client (singleton)
 */
function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY; // Use service role key for server-side
    
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

/**
 * Store LTK tokens for a user (encrypted)
 */
export async function storeTokens(
  userId: string,
  tokens: LTKTokens
): Promise<void> {
  const db = getSupabase();
  
  // Encrypt tokens
  const encryptedAccessToken = encryptToken(tokens.accessToken);
  const encryptedIdToken = encryptToken(tokens.idToken);
  
  // Check if connection already exists
  const { data: existing } = await db
    .from('platform_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', 'LTK')
    .single();
  
  const connectionData = {
    user_id: userId,
    platform: 'LTK' as const,
    status: 'CONNECTED' as const,
    encrypted_access_token: encryptedAccessToken,
    encrypted_id_token: encryptedIdToken,
    token_expires_at: new Date(tokens.expiresAt * 1000).toISOString(),
    connected_at: new Date().toISOString(),
    last_refresh_at: new Date().toISOString(),
    refresh_error: null,
    updated_at: new Date().toISOString(),
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
        metadata: {},
      });
    
    if (error) {
      throw new Error(`Failed to create connection: ${error.message}`);
    }
  }
  
  console.log(`[Token Storage] Stored encrypted tokens for user ${userId}`);
}

/**
 * Retrieve LTK tokens for a user (decrypted)
 */
export async function getTokens(userId: string): Promise<LTKTokens | null> {
  const db = getSupabase();
  
  const { data, error } = await db
    .from('platform_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'LTK')
    .eq('status', 'CONNECTED')
    .single();
  
  if (error || !data) {
    return null;
  }
  
  const connection = data as StoredConnection;
  
  if (!connection.encrypted_access_token || !connection.encrypted_id_token) {
    return null;
  }
  
  try {
    const accessToken = decryptToken(connection.encrypted_access_token);
    const idToken = decryptToken(connection.encrypted_id_token);
    const expiresAt = connection.token_expires_at 
      ? Math.floor(new Date(connection.token_expires_at).getTime() / 1000)
      : 0;
    
    return { accessToken, idToken, expiresAt };
  } catch (decryptError) {
    console.error(`[Token Storage] Failed to decrypt tokens for user ${userId}:`, decryptError);
    return null;
  }
}

/**
 * Get connection status for a user
 */
export async function getConnectionStatus(userId: string): Promise<ConnectionStatus> {
  const db = getSupabase();
  
  const { data, error } = await db
    .from('platform_connections')
    .select('status, token_expires_at, last_refresh_at, refresh_error')
    .eq('user_id', userId)
    .eq('platform', 'LTK')
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
 * Update token expiration and last refresh time
 */
export async function updateTokenExpiration(
  userId: string,
  expiresAt: number
): Promise<void> {
  const db = getSupabase();
  
  const { error } = await db
    .from('platform_connections')
    .update({
      token_expires_at: new Date(expiresAt * 1000).toISOString(),
      last_refresh_at: new Date().toISOString(),
      refresh_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('platform', 'LTK');
  
  if (error) {
    throw new Error(`Failed to update token expiration: ${error.message}`);
  }
}

/**
 * Mark connection as having an error
 */
export async function markConnectionError(
  userId: string,
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
    .eq('platform', 'LTK');
  
  if (error) {
    console.error(`Failed to mark connection error: ${error.message}`);
  }
}

/**
 * Disconnect LTK (remove tokens)
 */
export async function disconnectLTK(userId: string): Promise<void> {
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
    .eq('platform', 'LTK');
  
  if (error) {
    throw new Error(`Failed to disconnect: ${error.message}`);
  }
  
  console.log(`[Token Storage] Disconnected LTK for user ${userId}`);
}

/**
 * Get all connections that need token refresh
 * (tokens expiring within the next 10 minutes)
 */
export async function getConnectionsNeedingRefresh(): Promise<string[]> {
  const db = getSupabase();
  
  const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  
  const { data, error } = await db
    .from('platform_connections')
    .select('user_id')
    .eq('platform', 'LTK')
    .eq('status', 'CONNECTED')
    .lt('token_expires_at', tenMinutesFromNow);
  
  if (error) {
    console.error('[Token Storage] Failed to get connections needing refresh:', error);
    return [];
  }
  
  return (data || []).map(row => row.user_id);
}
