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

const LTK_LOGIN_URL = 'https://creator.shopltk.com';
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
    
    // Navigate to LTK
    await page.goto(LTK_LOGIN_URL, {
      waitUntil: 'networkidle2',
      timeout,
    });
    
    // Wait a moment for any redirects
    await delay(2000);
    
    // Check if we're already on a login page or need to click login
    const currentUrl = page.url();
    console.log('[LTK Login] Current URL:', currentUrl);
    
    // LTK uses Auth0 - look for their login form
    // The form might be on the main page or we might need to click a login button
    
    // Try to find and click login button if on landing page
    const loginButtonSelectors = [
      'a[href*="login"]',
      'a[href*="signin"]',
      '[data-testid="login-button"]',
      '.login-button',
      '.sign-in-button',
    ];
    
    for (const selector of loginButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          console.log('[LTK Login] Found login button, clicking...');
          await button.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
          await delay(1000);
          break;
        }
      } catch {
        // Continue trying other selectors
      }
    }
    
    // Now look for the Auth0 login form
    console.log('[LTK Login] Looking for login form...');
    
    // Auth0 email field selectors
    const emailSelectors = [
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
      await page.screenshot({ path: '/tmp/ltk-login-debug.png' });
      console.log('[LTK Login] Screenshot saved to /tmp/ltk-login-debug.png');
      
      throw new Error('Could not find email input field');
    }
    
    // Type email
    await emailField.click({ clickCount: 3 }); // Select all
    await emailField.type(email, { delay: 50 });
    
    // Find password field
    const passwordSelectors = [
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
    
    // Find the auth tokens
    const accessTokenCookie = cookies.find(c => c.name === 'auth._token.auth0');
    const idTokenCookie = cookies.find(c => c.name === 'auth._id_token.auth0');
    
    if (!accessTokenCookie || !idTokenCookie) {
      // Try alternative cookie names
      const altAccessToken = cookies.find(c => 
        c.name.includes('access_token') || c.name.includes('accessToken')
      );
      const altIdToken = cookies.find(c => 
        c.name.includes('id_token') || c.name.includes('idToken')
      );
      
      console.log('[LTK Login] Available cookies:', cookies.map(c => c.name).join(', '));
      
      if (!altAccessToken || !altIdToken) {
        return {
          success: false,
          error: 'Login succeeded but authentication tokens not found in cookies',
          errorCode: 'UNKNOWN',
        };
      }
    }
    
    // Decode URL-encoded tokens
    const accessToken = decodeURIComponent(
      accessTokenCookie?.value || ''
    ).replace('Bearer ', '');
    
    const idToken = decodeURIComponent(
      idTokenCookie?.value || ''
    );
    
    // Calculate expiration (tokens typically last 1 hour)
    // The cookie might have an expiration, or we estimate
    const expiresAt = accessTokenCookie?.expires 
      ? Math.floor(accessTokenCookie.expires)
      : Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    
    console.log('[LTK Login] Successfully extracted tokens!');
    
    return {
      success: true,
      accessToken,
      idToken,
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
