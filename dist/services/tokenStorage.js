"use strict";
/**
 * Token Storage Service
 *
 * Handles encrypted storage and retrieval of LTK tokens in Supabase.
 * All tokens are encrypted with AES-256-GCM before storage.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeTokens = storeTokens;
exports.getTokens = getTokens;
exports.getConnectionStatus = getConnectionStatus;
exports.updateTokenExpiration = updateTokenExpiration;
exports.markConnectionError = markConnectionError;
exports.disconnectLTK = disconnectLTK;
exports.getConnectionsNeedingRefresh = getConnectionsNeedingRefresh;
const supabase_js_1 = require("@supabase/supabase-js");
const encryption_js_1 = require("../utils/encryption.js");
/**
 * Parse JWT to extract payload (without verification)
 */
function parseJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const payload = Buffer.from(parts[1], 'base64').toString('utf8');
        return JSON.parse(payload);
    }
    catch {
        return null;
    }
}
/**
 * Extract publisher_id from idToken JWT claims
 */
function extractPublisherId(idToken) {
    const payload = parseJwtPayload(idToken);
    if (!payload)
        return null;
    // LTK stores publisher info in http://shopltk.com/profile claim
    const profile = payload['http://shopltk.com/profile'];
    if (profile?.publisher_id) {
        return String(profile.publisher_id);
    }
    // Fallback: check other common claim names
    if (payload['publisher_id'])
        return String(payload['publisher_id']);
    if (payload['pub_id'])
        return String(payload['pub_id']);
    return null;
}
let supabase = null;
/**
 * Get Supabase client (singleton)
 */
function getSupabase() {
    if (!supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY; // Use service role key for server-side
        if (!url || !key) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
        }
        supabase = (0, supabase_js_1.createClient)(url, key);
    }
    return supabase;
}
/**
 * Store LTK tokens for a user (encrypted)
 */
async function storeTokens(userId, tokens) {
    const db = getSupabase();
    // Encrypt tokens
    const encryptedAccessToken = (0, encryption_js_1.encryptToken)(tokens.accessToken);
    const encryptedIdToken = (0, encryption_js_1.encryptToken)(tokens.idToken);
    // Extract publisherId from idToken JWT
    const publisherId = tokens.publisherId || extractPublisherId(tokens.idToken);
    console.log(`[Token Storage] Extracted publisher_id: ${publisherId}`);
    // Check if connection already exists
    const { data: existing } = await db
        .from('platform_connections')
        .select('id')
        .eq('user_id', userId)
        .eq('platform', 'LTK')
        .single();
    const connectionData = {
        user_id: userId,
        platform: 'LTK',
        status: 'CONNECTED',
        encrypted_access_token: encryptedAccessToken,
        encrypted_id_token: encryptedIdToken,
        token_expires_at: new Date(tokens.expiresAt * 1000).toISOString(),
        connected_at: new Date().toISOString(),
        last_refresh_at: new Date().toISOString(),
        refresh_error: null,
        updated_at: new Date().toISOString(),
        metadata: { publisher_id: publisherId },
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
    }
    else {
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
    console.log(`[Token Storage] Stored encrypted tokens for user ${userId} (publisher: ${publisherId})`);
}
/**
 * Retrieve LTK tokens for a user (decrypted)
 */
async function getTokens(userId) {
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
    const connection = data;
    if (!connection.encrypted_access_token || !connection.encrypted_id_token) {
        return null;
    }
    try {
        const accessToken = (0, encryption_js_1.decryptToken)(connection.encrypted_access_token);
        const idToken = (0, encryption_js_1.decryptToken)(connection.encrypted_id_token);
        const expiresAt = connection.token_expires_at
            ? Math.floor(new Date(connection.token_expires_at).getTime() / 1000)
            : 0;
        // Get publisherId from metadata or extract from idToken
        const metadata = connection.metadata;
        let publisherId = metadata?.publisher_id;
        // Fallback: extract from idToken if not in metadata
        if (!publisherId) {
            publisherId = extractPublisherId(idToken) || undefined;
        }
        return { accessToken, idToken, expiresAt, publisherId };
    }
    catch (decryptError) {
        console.error(`[Token Storage] Failed to decrypt tokens for user ${userId}:`, decryptError);
        return null;
    }
}
/**
 * Get connection status for a user
 */
async function getConnectionStatus(userId) {
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
    const connection = data;
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
async function updateTokenExpiration(userId, expiresAt) {
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
async function markConnectionError(userId, errorMessage) {
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
async function disconnectLTK(userId) {
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
async function getConnectionsNeedingRefresh() {
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
//# sourceMappingURL=tokenStorage.js.map