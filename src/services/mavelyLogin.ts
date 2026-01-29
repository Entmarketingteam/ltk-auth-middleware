/**
 * Mavely Puppeteer Login Service
 * 
 * Automates login to creators.joinmavely.com using headless Chrome,
 * extracts authentication cookies/tokens, and returns them.
 * 
 * Similar pattern to LTK login service.
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export interface MavelyLoginResult {
  success: boolean;
  accessToken?: string;
  sessionCookie?: string;
  expiresAt?: number; // Unix timestamp
  error?: string;
  errorCode?: 'INVALID_CREDENTIALS' | 'TIMEOUT' | 'BLOCKED' | 'UNKNOWN';
}

export interface MavelyLoginOptions {
  timeout?: number; // Max time for login attempt (default: 60000ms)
  headless?: boolean; // Show browser for debugging (default: true)
}

const MAVELY_LOGIN_URL = 'https://creators.joinmavely.com/auth/login';
const MAVELY_HOME_URL = 'https://creators.joinmavely.com/home';
const DEFAULT_TIMEOUT = 60000; // 60 seconds

/**
 * Log into Mavely and extract authentication tokens
 */
export async function loginToMavely(
  email: string,
  password: string,
  options: MavelyLoginOptions = {}
): Promise<MavelyLoginResult> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const headless = options.headless ?? true;
  
  let browser: Browser | null = null;
  
  try {
    console.log('[Mavely Login] Starting Puppeteer...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });
    
    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    console.log('[Mavely Login] Navigating to Mavely login page...');

    // Navigate to Mavely login page
    await page.goto(MAVELY_LOGIN_URL, {
      waitUntil: 'networkidle2',
      timeout,
    });

    await delay(2000);
    
    console.log('[Mavely Login] Current URL:', page.url());

    // Take a screenshot for debugging
    await page.screenshot({ path: '/tmp/mavely-login-page.png' });
    console.log('[Mavely Login] Screenshot saved to /tmp/mavely-login-page.png');
    
    // Look for the login form
    console.log('[Mavely Login] Looking for login form...');
    
    // Common email field selectors for Mavely
    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[id="email"]',
      'input[autocomplete="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
    ];
    
    let emailField = null;
    for (const selector of emailSelectors) {
      emailField = await page.$(selector);
      if (emailField) {
        console.log('[Mavely Login] Found email field:', selector);
        break;
      }
    }
    
    if (!emailField) {
      // Take a screenshot for debugging
      await page.screenshot({ path: '/tmp/mavely-login-email-not-found.png' });
      console.log('[Mavely Login] Screenshot saved to /tmp/mavely-login-email-not-found.png');
      console.log('[Mavely Login] Current URL:', page.url());
      console.log('[Mavely Login] Page title:', await page.title());

      throw new Error(`Could not find email input field. Current URL: ${page.url()}`);
    }
    
    // Type email
    await emailField.click({ clickCount: 3 }); // Select all
    await emailField.type(email, { delay: 50 });
    
    // Find password field
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[id="password"]',
      'input[autocomplete="current-password"]',
    ];
    
    let passwordField = null;
    for (const selector of passwordSelectors) {
      passwordField = await page.$(selector);
      if (passwordField) {
        console.log('[Mavely Login] Found password field:', selector);
        break;
      }
    }
    
    if (!passwordField) {
      throw new Error('Could not find password input field');
    }
    
    // Type password
    await passwordField.click({ clickCount: 3 });
    await passwordField.type(password, { delay: 50 });
    
    // Find and click submit button
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Log In")',
      'button:has-text("Login")',
      'input[type="submit"]',
    ];
    
    let submitted = false;
    for (const selector of submitSelectors) {
      try {
        const submitButton = await page.$(selector);
        if (submitButton) {
          console.log('[Mavely Login] Found submit button:', selector);
          await submitButton.click();
          submitted = true;
          break;
        }
      } catch {
        // Continue
      }
    }
    
    if (!submitted) {
      // Try pressing Enter on password field
      await passwordField.press('Enter');
    }
    
    console.log('[Mavely Login] Waiting for login to complete...');
    
    // Wait for navigation/redirect after login
    await page.waitForNavigation({
      waitUntil: 'networkidle2',
      timeout: 30000,
    }).catch(() => {});
    
    // Additional wait for any JS redirects
    await delay(3000);
    
    // Check for login errors
    const errorSelectors = [
      '.error-message',
      '.error',
      '[role="alert"]',
      '.alert-danger',
      '[data-testid="error"]',
    ];
    
    for (const selector of errorSelectors) {
      const errorElement = await page.$(selector);
      if (errorElement) {
        const errorText = await errorElement.evaluate(el => el.textContent);
        console.log('[Mavely Login] Login error:', errorText);
        return {
          success: false,
          error: errorText?.trim() || 'Login failed',
          errorCode: 'INVALID_CREDENTIALS',
        };
      }
    }
    
    // Check if we're logged in by looking at the URL
    const finalUrl = page.url();
    console.log('[Mavely Login] Final URL:', finalUrl);
    
    // Check if we reached the home page or dashboard
    if (!finalUrl.includes('joinmavely.com/home') && !finalUrl.includes('joinmavely.com/analytics')) {
      // Still on login page - something went wrong
      await page.screenshot({ path: '/tmp/mavely-login-failed.png' });
      return {
        success: false,
        error: 'Login did not complete - still on authentication page',
        errorCode: 'UNKNOWN',
      };
    }
    
    // Extract cookies
    console.log('[Mavely Login] Extracting authentication cookies...');
    const cookies = await page.cookies();

    // Log ALL cookies for debugging
    console.log('[Mavely Login] ===== ALL COOKIES =====');
    console.log('[Mavely Login] Total cookies found:', cookies.length);
    cookies.forEach((c, i) => {
      const valuePreview = c.value.length > 50 ? c.value.substring(0, 50) + '...' : c.value;
      console.log(`[Mavely Login] Cookie ${i + 1}: ${c.name} = ${valuePreview}`);
      console.log(`[Mavely Login]   Domain: ${c.domain}, Path: ${c.path}, Expires: ${c.expires}`);
    });
    console.log('[Mavely Login] ===== END COOKIES =====');

    // Find auth-related cookies
    const authCookies = cookies.filter(c =>
      c.name.includes('auth') ||
      c.name.includes('token') ||
      c.name.includes('session') ||
      c.name.includes('Auth') ||
      c.name.includes('Token') ||
      c.name.includes('Session') ||
      c.name.includes('access')
    );

    console.log('[Mavely Login] Auth-related cookies found:', authCookies.map(c => c.name).join(', '));

    // Check localStorage and sessionStorage
    const storageData = await page.evaluate(() => {
      const ls: Record<string, string> = {};
      const ss: Record<string, string> = {};

      // Get ALL localStorage keys
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            const value = window.localStorage.getItem(key) || '';
            ls[key] = value.substring(0, 200);
          }
        }
      } catch (e) {
        // localStorage may not be available
      }

      // Get ALL sessionStorage keys
      try {
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            const value = window.sessionStorage.getItem(key) || '';
            ss[key] = value.substring(0, 200);
          }
        }
      } catch (e) {
        // sessionStorage may not be available
      }

      return { localStorage: ls, sessionStorage: ss };
    });

    console.log('[Mavely Login] ===== STORAGE DATA =====');
    console.log('[Mavely Login] localStorage keys:', Object.keys(storageData.localStorage || {}).join(', '));
    console.log('[Mavely Login] sessionStorage keys:', Object.keys(storageData.sessionStorage || {}).join(', '));
    
    // Log storage contents
    for (const [key, value] of Object.entries(storageData.localStorage || {})) {
      console.log(`[Mavely Login] localStorage[${key}]: ${value}${value.length >= 200 ? '...' : ''}`);
    }
    for (const [key, value] of Object.entries(storageData.sessionStorage || {})) {
      console.log(`[Mavely Login] sessionStorage[${key}]: ${value}${value.length >= 200 ? '...' : ''}`);
    }
    console.log('[Mavely Login] ===== END STORAGE =====');

    // Try to find tokens
    let accessToken = '';
    let sessionCookie = '';
    let tokenSource = 'none';

    // First, check for common auth tokens in localStorage/sessionStorage
    for (const [key, value] of Object.entries(storageData.localStorage || {})) {
      if (key.includes('token') || key.includes('auth') || key.includes('session')) {
        console.log(`[Mavely Login] Found potential token in localStorage: ${key}`);
        // Get full value
        const fullValue = await page.evaluate((storageKey: string) => {
          return window.localStorage.getItem(storageKey);
        }, key);
        
        if (fullValue && fullValue.length > 20) {
          try {
            // Try to parse as JSON in case it's wrapped
            const parsed = JSON.parse(fullValue);
            if (typeof parsed === 'object' && parsed.token) {
              accessToken = parsed.token;
              tokenSource = `localStorage:${key}`;
            } else if (typeof parsed === 'string') {
              accessToken = parsed;
              tokenSource = `localStorage:${key}`;
            }
          } catch {
            // Not JSON, use as-is
            accessToken = fullValue;
            tokenSource = `localStorage:${key}`;
          }
          if (accessToken) break;
        }
      }
    }

    // Check sessionStorage if not found in localStorage
    if (!accessToken) {
      for (const [key, value] of Object.entries(storageData.sessionStorage || {})) {
        if (key.includes('token') || key.includes('auth') || key.includes('session')) {
          console.log(`[Mavely Login] Found potential token in sessionStorage: ${key}`);
          const fullValue = await page.evaluate((storageKey: string) => {
            return window.sessionStorage.getItem(storageKey);
          }, key);
          
          if (fullValue && fullValue.length > 20) {
            try {
              const parsed = JSON.parse(fullValue);
              if (typeof parsed === 'object' && parsed.token) {
                accessToken = parsed.token;
                tokenSource = `sessionStorage:${key}`;
              } else if (typeof parsed === 'string') {
                accessToken = parsed;
                tokenSource = `sessionStorage:${key}`;
              }
            } catch {
              accessToken = fullValue;
              tokenSource = `sessionStorage:${key}`;
            }
            if (accessToken) break;
          }
        }
      }
    }

    // Fallback: Use cookies
    if (!accessToken && authCookies.length > 0) {
      // Find the most relevant auth cookie
      for (const cookie of authCookies) {
        if (cookie.value && cookie.value.length > 20) {
          sessionCookie = cookie.value;
          tokenSource = `cookie:${cookie.name}`;
          accessToken = sessionCookie; // Use as access token
          break;
        }
      }
    }

    console.log('[Mavely Login] Token source:', tokenSource);
    console.log('[Mavely Login] Access token found:', accessToken.length > 0 ? `Yes (${accessToken.length} chars)` : 'No');
    console.log('[Mavely Login] Session cookie found:', sessionCookie.length > 0 ? `Yes (${sessionCookie.length} chars)` : 'No');

    // If we still don't have tokens, we can still return success if we're on the home page
    // The user can use cookie-based authentication
    if (!accessToken) {
      // Use the most relevant cookie as the session identifier
      const relevantCookie = authCookies.find(c => 
        c.name.toLowerCase().includes('session') || 
        c.name.toLowerCase().includes('auth')
      );
      
      if (relevantCookie) {
        accessToken = relevantCookie.value;
        sessionCookie = relevantCookie.value;
        tokenSource = `cookie:${relevantCookie.name}`;
        console.log('[Mavely Login] Using cookie as session:', relevantCookie.name);
      } else {
        return {
          success: false,
          error: `Login succeeded but no tokens found. Cookies: ${authCookies.map(c => c.name).join(', ')}. Storage keys: ${Object.keys(storageData.localStorage || {}).concat(Object.keys(storageData.sessionStorage || {})).join(', ')}`,
          errorCode: 'UNKNOWN',
        };
      }
    }

    // Calculate expiration (assume tokens last 24 hours)
    const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

    console.log('[Mavely Login] Successfully extracted tokens!');

    return {
      success: true,
      accessToken,
      sessionCookie: sessionCookie || accessToken,
      expiresAt,
    };
    
  } catch (error) {
    console.error('[Mavely Login] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let errorCode: MavelyLoginResult['errorCode'] = 'UNKNOWN';
    
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      errorCode = 'TIMEOUT';
    }
    
    return {
      success: false,
      error: errorMessage,
      errorCode,
    };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Helper function for delays
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if Mavely tokens are still valid by making a test request
 */
export async function validateMavelyTokens(
  accessToken: string
): Promise<boolean> {
  try {
    // Try to access the analytics page with the token
    const response = await fetch('https://creators.joinmavely.com/api/analytics', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Cookie': `auth-token=${accessToken}`,
        'Origin': 'https://creators.joinmavely.com',
        'Referer': 'https://creators.joinmavely.com/',
      },
    });
    
    return response.ok;
  } catch {
    return false;
  }
}
