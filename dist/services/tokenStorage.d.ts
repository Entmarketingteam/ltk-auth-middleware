/**
 * Token Storage Service
 *
 * Handles encrypted storage and retrieval of LTK tokens in Supabase.
 * All tokens are encrypted with AES-256-GCM before storage.
 */
export interface LTKTokens {
    accessToken: string;
    idToken: string;
    expiresAt: number;
    publisherId?: string;
}
export interface ConnectionStatus {
    connected: boolean;
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'NOT_FOUND';
    expiresAt?: Date;
    lastRefresh?: Date;
    error?: string;
}
/**
 * Store LTK tokens for a user (encrypted)
 */
export declare function storeTokens(userId: string, tokens: LTKTokens): Promise<void>;
/**
 * Retrieve LTK tokens for a user (decrypted)
 */
export declare function getTokens(userId: string): Promise<LTKTokens | null>;
/**
 * Get connection status for a user
 */
export declare function getConnectionStatus(userId: string): Promise<ConnectionStatus>;
/**
 * Update token expiration and last refresh time
 */
export declare function updateTokenExpiration(userId: string, expiresAt: number): Promise<void>;
/**
 * Mark connection as having an error
 */
export declare function markConnectionError(userId: string, errorMessage: string): Promise<void>;
/**
 * Disconnect LTK (remove tokens)
 */
export declare function disconnectLTK(userId: string): Promise<void>;
/**
 * Get all connections that need token refresh
 * (tokens expiring within the next 10 minutes)
 */
export declare function getConnectionsNeedingRefresh(): Promise<string[]>;
//# sourceMappingURL=tokenStorage.d.ts.map