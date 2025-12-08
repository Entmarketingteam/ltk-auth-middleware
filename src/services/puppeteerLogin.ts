/**
 * LTK Puppeteer Login Service
 * 
 * Automates login to creator.shopltk.com using headless Chrome,
 * extracts authentication cookies, and returns tokens.
 * 
 * This is the "Plaid-style" magic - credentials go in, tokens come out.
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export interface LTKLoginResult {
  success: boolean;
  accessToken?: string;
  idToken?: string;
  expiresAt?: number; // Unix timestamp
  error?: string;
  errorCode?: 'INVALID_CREDENTIALS' | 'TIMEOUT' | 'BLOCKED' | 'UNKNOWN';
}

export interface LTKLoginOptions {
  timeout?: number; // Max time for login attempt (default: 60000ms)
  headless?: boolean; // Show browser for debugging (default: true)
}

const LTK_BASE_URL = 'https://creator.shopltk.com';
const LTK_AUTH_URL = 'https://creator-auth.shopltk.com/login';
const DEFAULT_TIMEOUT = 60000; // 60 seconds

/**
 * Log into LTK and extract authentication tokens
 */
export async function loginToLTK(
  email: string,
  password: string,
  options: LTKLoginOptions = {}
): Promise<LTKLoginResult> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const headless = options.headless ?? true;
  
  let browser: Browser | null = null;
  
  try {
    console.log('[LTK Login] Starting Puppeteer...');
    
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
    
    console.log('[LTK Login] Navigating to LTK...');

    // Navigate to LTK base URL - it should redirect to auth page
    await page.goto(LTK_BASE_URL, {
      waitUntil: 'networkidle2',
      timeout,
    });

    let currentUrl = page.url();
    console.log('[LTK Login] Initial URL after navigation:', currentUrl);

    // Wait for potential redirect to auth page
    await delay(2000);
    currentUrl = page.url();
    console.log('[LTK Login] URL after delay:', currentUrl);

    // If not on auth page, navigate directly to it
    if (!currentUrl.includes('creator-auth.shopltk.com')) {
      console.log('[LTK Login] Not on auth page, navigating directly to:', LTK_AUTH_URL);
      await page.goto(LTK_AUTH_URL, {
        waitUntil: 'networkidle2',
        timeout,
      });
      await delay(2000);
      currentUrl = page.url();
      console.log('[LTK Login] URL after direct auth navigation:', currentUrl);
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: '/tmp/ltk-login-page.png' });
    console.log('[LTK Login] Screenshot saved to /tmp/ltk-login-page.png');
    
    // Now look for the Auth0 login form
    console.log('[LTK Login] Looking for login form...');
    
    // Auth0 email field selectors
    const emailSelectors = [
      '[data-test-id="login-email-input"]',
      'input[name="username"]',
      'input[name="email"]',
      'input[type="email"]',
      'input[id="username"]',
      'input[id="email"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]',
    ];
    
    let emailField = null;
    for (const selector of emailSelectors) {
      emailField = await page.$(selector);
      if (emailField) {
        console.log('[LTK Login] Found email field:', selector);
        break;
      }
    }
    
    if (!emailField) {
      // Take a screenshot for debugging
      await page.screenshot({ path: '/tmp/ltk-login-email-not-found.png' });
      console.log('[LTK Login] Screenshot saved to /tmp/ltk-login-email-not-found.png');
      console.log('[LTK Login] Current URL:', page.url());
      console.log('[LTK Login] Page title:', await page.title());

      throw new Error(`Could not find email input field. Current URL: ${page.url()}`);
    }
    
    // Type email
    await emailField.click({ clickCount: 3 }); // Select all
    await emailField.type(email, { delay: 50 });
    
    // Find password field
    const passwordSelectors = [
      '[data-test-id="login-password-input"]',
      'input[name="password"]',
      'input[type="password"]',
      'input[id="password"]',
    ];
    
    let passwordField = null;
    for (const selector of passwordSelectors) {
      passwordField = await page.$(selector);
      if (passwordField) {
        console.log('[LTK Login] Found password field:', selector);
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
      '[data-test-id="login-submit-btn"]',
      'button[type="submit"]',
      'button[name="action"]',
      'button[data-action-button-primary="true"]',
      'input[type="submit"]',
      'button[value="default"]',
    ];
    
    let submitted = false;
    for (const selector of submitSelectors) {
      try {
        const submitButton = await page.$(selector);
        if (submitButton) {
          console.log('[LTK Login] Found submit button:', selector);
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
    
    console.log('[LTK Login] Waiting for login to complete...');
    
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
      '.auth0-lock-error-msg',
      '[data-testid="error"]',
      '.alert-danger',
    ];
    
    for (const selector of errorSelectors) {
      const errorElement = await page.$(selector);
      if (errorElement) {
        const errorText = await errorElement.evaluate(el => el.textContent);
        console.log('[LTK Login] Login error:', errorText);
        return {
          success: false,
          error: errorText?.trim() || 'Login failed',
          errorCode: 'INVALID_CREDENTIALS',
        };
      }
    }
    
    // Check if we're logged in by looking at the URL
    const finalUrl = page.url();
    console.log('[LTK Login] Final URL:', finalUrl);
    
    if (!finalUrl.includes('creator.shopltk.com') && !finalUrl.includes('rewardstyle.com')) {
      // Still on login page - something went wrong
      return {
        success: false,
        error: 'Login did not complete - still on authentication page',
        errorCode: 'UNKNOWN',
      };
    }
    
    // Extract cookies
    console.log('[LTK Login] Extracting authentication cookies...');
    const cookies = await page.cookies();

    // Log ALL cookies for debugging
    console.log('[LTK Login] ===== ALL COOKIES =====');
    console.log('[LTK Login] Total cookies found:', cookies.length);
    cookies.forEach((c, i) => {
      const valuePreview = c.value.length > 50 ? c.value.substring(0, 50) + '...' : c.value;
      console.log(`[LTK Login] Cookie ${i + 1}: ${c.name} = ${valuePreview}`);
      console.log(`[LTK Login]   Domain: ${c.domain}, Path: ${c.path}, Expires: ${c.expires}`);
    });
    console.log('[LTK Login] ===== END COOKIES =====');

    // Find the auth tokens - try LTK-specific cookie names first
    const ltkCookieNames = [
      '_Legacy_auth0',
      'auth0.authenticated',
      'NMIT.is.authenticated',
      'auth._token.auth0',
      'auth._id_token.auth0',
    ];

    console.log('[LTK Login] Looking for cookies:', ltkCookieNames.join(', '));

    // Find any auth-related cookies
    const authCookies = cookies.filter(c =>
      c.name.includes('auth') ||
      c.name.includes('token') ||
      c.name.includes('Auth') ||
      c.name.includes('Token') ||
      c.name.includes('NMIT') ||
      c.name.includes('Legacy')
    );

    console.log('[LTK Login] Auth-related cookies found:', authCookies.map(c => c.name).join(', '));

    // Check localStorage and sessionStorage - log ALL keys
    const allStorage = await page.evaluate(() => {
      const result: Record<string, string> = {};

      // Get ALL localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key) || '';
          result[`localStorage:${key}`] = value.substring(0, 200);
        }
      }

      // Get ALL sessionStorage keys
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const value = sessionStorage.getItem(key) || '';
          result[`sessionStorage:${key}`] = value.substring(0, 200);
        }
      }

      return result;
    });

    console.log('[LTK Login] ===== ALL STORAGE (localStorage + sessionStorage) =====');
    console.log('[LTK Login] Total storage items:', Object.keys(allStorage).length);
    Object.entries(allStorage).forEach(([key, value]) => {
      console.log(`[LTK Login] ${key}: ${value}${value.length >= 200 ? '...' : ''}`);
    });
    console.log('[LTK Login] ===== END STORAGE =====');

    // Try to find tokens - check multiple sources
    let accessToken = '';
    let idToken = '';
    let tokenSource = 'none';

    // Check cookies first
    for (const cookie of authCookies) {
      if (cookie.value && cookie.value.length > 20) {
        // This might be a token
        if (cookie.name.includes('token') || cookie.name.includes('Token')) {
          if (!accessToken) {
            accessToken = decodeURIComponent(cookie.value).replace('Bearer ', '');
            tokenSource = `cookie:${cookie.name}`;
          }
        }
      }
    }

    // Check localStorage for tokens
    for (const [key, value] of Object.entries(allStorage)) {
      if (key.includes('localStorage') && value && value.length > 20) {
        if (key.includes('token') || key.includes('Token') || key.includes('access')) {
          if (!accessToken) {
            accessToken = value;
            tokenSource = key;
          }
        }
        if (key.includes('id_token') || key.includes('idToken')) {
          if (!idToken) {
            idToken = value;
          }
        }
      }
    }

    console.log('[LTK Login] Token source:', tokenSource);
    console.log('[LTK Login] Access token found:', accessToken.length > 0 ? `Yes (${accessToken.length} chars)` : 'No');
    console.log('[LTK Login] ID token found:', idToken.length > 0 ? `Yes (${idToken.length} chars)` : 'No');

    // If we still don't have tokens, return error with debug info
    if (!accessToken) {
      return {
        success: false,
        error: `Login succeeded but no tokens found. Cookies: ${authCookies.map(c => c.name).join(', ')}. Storage keys: ${Object.keys(allStorage).join(', ')}`,
        errorCode: 'UNKNOWN',
      };
    }

    // Calculate expiration (tokens typically last 1 hour)
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    console.log('[LTK Login] Successfully extracted tokens!');

    return {
      success: true,
      accessToken,
      idToken: idToken || accessToken, // Use access token as fallback for id token
      expiresAt,
    };
    
  } catch (error) {
    console.error('[LTK Login] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let errorCode: LTKLoginResult['errorCode'] = 'UNKNOWN';
    
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
 * Check if tokens are still valid by making a test request
 */
export async function validateTokens(
  accessToken: string,
  idToken: string
): Promise<boolean> {
  try {
    const response = await fetch('https://api-gateway.rewardstyle.com/api/co-api/v1/get_user_info', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-id-token': idToken,
        'Origin': 'https://creator.shopltk.com',
        'Referer': 'https://creator.shopltk.com/',
      },
    });
    
    return response.ok;
  } catch {
    return false;
  }
}
