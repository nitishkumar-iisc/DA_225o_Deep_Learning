import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = 'http://localhost:3000';
const SS_DIR = '/tmp/auth-screenshots';
mkdirSync(SS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

async function shot(name) {
  await page.screenshot({ path: `${SS_DIR}/${name}.png`, fullPage: true });
  console.log(`📸 ${name}: ${page.url()}`);
}

const results = [];

async function check(label, fn) {
  try {
    await fn();
    results.push({ label, status: '✅' });
  } catch (e) {
    results.push({ label, status: '❌', error: e.message });
    console.error(`FAIL ${label}:\n   ${e.message}\n`);
  }
}

// 1. Protected route redirect (unauthenticated)
await check('Unauthenticated /candidate/dashboard → redirects to /login', async () => {
  await page.goto(`${BASE}/candidate/dashboard`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot('1-protected-redirect');
  if (!page.url().includes('/login')) throw new Error(`Expected /login, got ${page.url()}`);
});

// 2. /login page loads with form
await check('/login page renders with email + password fields', async () => {
  await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(1000);
  await shot('2-login-page');
  await page.waitForSelector('input[type="email"]', { timeout: 8000 });
  await page.waitForSelector('input[type="password"]', { timeout: 8000 });
});

// 3. /register page loads with form
await check('/register page renders with name + email + password fields', async () => {
  await page.goto(`${BASE}/register`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(1000);
  await shot('3-register-page');
  await page.waitForSelector('input[type="email"]', { timeout: 8000 });
  await page.waitForSelector('input[type="password"]', { timeout: 8000 });
});

// 4. Register a new candidate (requires Firebase emulator on :9099)
const testEmail = `test-candidate-${Date.now()}@example.com`;
const testPass = 'Test1234!';
let registerSuccess = false;

await check('Register new candidate account via /register form', async () => {
  await page.goto(`${BASE}/register`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: /candidate/i }).first().click();
  await page.locator('input[placeholder="Jane Smith"]').fill('Test Candidate');
  await page.locator('input[type="email"]').fill(testEmail);
  await page.locator('input[type="password"]').fill(testPass);
  await page.getByRole('button', { name: /create account/i }).click();

  await page.waitForTimeout(8000);
  await shot('4-after-register');

  const url = page.url();
  if (url.includes('/register')) {
    const body = await page.textContent('body');
    throw new Error(`Still on /register. Snippet: ${body?.slice(0, 300)}`);
  }
  registerSuccess = true;
});

// 5. Should land on candidate dashboard
await check('After register → /candidate/dashboard', async () => {
  if (!registerSuccess) throw new Error('Skipped: registration failed');
  await shot('5-candidate-dashboard');
  if (!page.url().includes('/candidate/dashboard')) throw new Error(`Got: ${page.url()}`);
});

// 6. Nav Sign Out button visible
await check('Nav renders with Sign Out button', async () => {
  if (!registerSuccess) throw new Error('Skipped: registration failed');
  await page.waitForSelector('text=Sign Out', { timeout: 5000 });
});

// 7. Sign out
await check('Sign out → redirects to /login', async () => {
  if (!registerSuccess) throw new Error('Skipped: registration failed');
  await page.getByText('Sign Out').first().click();
  await page.waitForTimeout(3000);
  await shot('6-after-signout');
  if (!page.url().includes('/login')) throw new Error(`Expected /login, got ${page.url()}`);
});

// 8. Login
await check('Login with registered credentials → /candidate/dashboard', async () => {
  if (!registerSuccess) throw new Error('Skipped: registration failed');
  await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"]').fill(testEmail);
  await page.locator('input[type="password"]').fill(testPass);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForTimeout(6000);
  await shot('7-after-login');
  if (!page.url().includes('/candidate/dashboard')) throw new Error(`Expected /candidate/dashboard, got ${page.url()}`);
});

// 9. Role isolation
await check('Candidate → /recruiter/dashboard → /unauthorized', async () => {
  if (!registerSuccess) throw new Error('Skipped: registration failed');
  await page.goto(`${BASE}/recruiter/dashboard`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot('8-role-isolation');
  if (!page.url().includes('/unauthorized')) throw new Error(`Expected /unauthorized, got ${page.url()}`);
});

// 10. Wrong password error
await check('🔍 Wrong password → inline error shown (not a crash)', async () => {
  const p2 = await ctx.newPage();
  await p2.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 20000 });
  await p2.waitForTimeout(1000);
  await p2.locator('input[type="email"]').fill('nobody@example.com');
  await p2.locator('input[type="password"]').fill('wrongpass');
  await p2.getByRole('button', { name: /sign in/i }).click();
  await p2.waitForTimeout(4000);
  await p2.screenshot({ path: `${SS_DIR}/9-wrong-password.png`, fullPage: true });
  const body = await p2.textContent('body');
  const hasError = body?.toLowerCase().includes('invalid') || body?.toLowerCase().includes('error') || body?.toLowerCase().includes('password');
  if (!hasError) throw new Error(`No error message visible. Body: ${body?.slice(0, 200)}`);
  await p2.close();
});

await browser.close();

console.log('\n=== RESULTS ===');
for (const r of results) {
  console.log(`${r.status} ${r.label}${r.error ? '\n   ERROR: ' + r.error : ''}`);
}
console.log(`\nScreenshots saved to ${SS_DIR}/`);
writeFileSync('/tmp/auth-test-results.json', JSON.stringify(results, null, 2));
