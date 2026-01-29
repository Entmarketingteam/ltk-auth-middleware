"use strict";
/**
 * Platform Storage Service
 *
 * Generic service for storing encrypted tokens for multiple platforms:
 * - LTK
 * - Mavely
 * - Amazon Creator
 * - ShopMY
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.storePlatformTokens = storePlatformTokens;
exports.getPlatformTokens = getPlatformTokens;
exports.getPlatformConnectionStatus = getPlatformConnectionStatus;
exports.disconnectPlatform = disconnectPlatform;
exports.markPlatformError = markPlatformError;
exports.updatePlatformMetadata = updatePlatformMetadata;
const supabase_js_1 = require("@supabase/supabase-js");
const encryption_js_1 = require("../utils/encryption.js");
let supabase = null;
/**
 * Get Supabase client (singleton)
 */
function getSupabase() {
    if (!supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY;
        if (!url || !key) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
        }
        supabase = (0, supabase_js_1.createClient)(url, key);
    }
    return supabase;
}
/**
 * Store platform tokens for a user (encrypted)
 */
async function storePlatformTokens(userId, platform, tokens) {
    const db = getSupabase();
    // Encrypt tokens
    const encryptedAccessToken = (0, encryption_js_1.encryptToken)(tokens.accessToken);
    const encryptedIdToken = tokens.idToken ? (0, encryption_js_1.encryptToken)(tokens.idToken) : null;
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
        status: 'CONNECTED',
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
    console.log(`[Platform Storage] Stored encrypted tokens for user ${userId} on ${platform}`);
}
/**
 * Retrieve platform tokens for a user (decrypted)
 */
async function getPlatformTokens(userId, platform) {
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
    const connection = data;
    if (!connection.encrypted_access_token) {
        return null;
    }
    try {
        const accessToken = (0, encryption_js_1.decryptToken)(connection.encrypted_access_token);
        const idToken = connection.encrypted_id_token
            ? (0, encryption_js_1.decryptToken)(connection.encrypted_id_token)
            : undefined;
        const expiresAt = connection.token_expires_at
            ? Math.floor(new Date(connection.token_expires_at).getTime() / 1000)
            : 0;
        const metadata = connection.metadata || {};
        return {
            accessToken,
            idToken,
            expiresAt,
            metadata,
            sessionCookie: metadata.sessionCookie,
        };
    }
    catch (decryptError) {
        console.error(`[Platform Storage] Failed to decrypt tokens for user ${userId} on ${platform}:`, decryptError);
        return null;
    }
}
/**
 * Get connection status for a user
 */
async function getPlatformConnectionStatus(userId, platform) {
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
 * Disconnect platform (remove tokens)
 */
async function disconnectPlatform(userId, platform) {
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
async function markPlatformError(userId, platform, errorMessage) {
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
async function updatePlatformMetadata(userId, platform, metadata) {
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
    const currentMetadata = existing.metadata || {};
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
//# sourceMappingURL=platformStorage.js.map