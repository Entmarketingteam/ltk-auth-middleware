/**
 * Mavely Puppeteer Login Service
 *
 * Automates login to creators.joinmavely.com using headless Chrome,
 * extracts authentication cookies/tokens, and returns them.
 *
 * Similar pattern to LTK login service.
 */
export interface MavelyLoginResult {
    success: boolean;
    accessToken?: string;
    sessionCookie?: string;
    expiresAt?: number;
    error?: string;
    errorCode?: 'INVALID_CREDENTIALS' | 'TIMEOUT' | 'BLOCKED' | 'UNKNOWN';
}
export interface MavelyLoginOptions {
    timeout?: number;
    headless?: boolean;
}
/**
 * Log into Mavely and extract authentication tokens
 */
export declare function loginToMavely(email: string, password: string, options?: MavelyLoginOptions): Promise<MavelyLoginResult>;
/**
 * Check if Mavely tokens are still valid by making a test request
 */
export declare function validateMavelyTokens(accessToken: string): Promise<boolean>;
//# sourceMappingURL=mavelyLogin.d.ts.map