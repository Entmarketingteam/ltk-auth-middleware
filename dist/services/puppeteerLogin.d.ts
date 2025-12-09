/**
 * LTK Puppeteer Login Service
 *
 * Automates login to creator.shopltk.com using headless Chrome,
 * extracts authentication cookies, and returns tokens.
 *
 * This is the "Plaid-style" magic - credentials go in, tokens come out.
 */
export interface LTKLoginResult {
    success: boolean;
    accessToken?: string;
    idToken?: string;
    expiresAt?: number;
    error?: string;
    errorCode?: 'INVALID_CREDENTIALS' | 'TIMEOUT' | 'BLOCKED' | 'UNKNOWN';
}
export interface LTKLoginOptions {
    timeout?: number;
    headless?: boolean;
}
/**
 * Log into LTK and extract authentication tokens
 */
export declare function loginToLTK(email: string, password: string, options?: LTKLoginOptions): Promise<LTKLoginResult>;
/**
 * Check if tokens are still valid by making a test request
 */
export declare function validateTokens(accessToken: string, idToken: string): Promise<boolean>;
//# sourceMappingURL=puppeteerLogin.d.ts.map