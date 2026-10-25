/**
 * Shared harness for the browser tests (scripts/*-tests/ui.ts): a static
 * server for the web export, and a Playwright page with a signed-in session
 * and a stubbed backend (every Supabase request answers empty), so the app
 * runs on an empty account plus whatever `storage` the test seeds.
 *
 * Playwright is not a project dependency: point PLAYWRIGHT_MODULE at an
 * installed copy if `playwright` does not resolve.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';

// Playwright is resolved at runtime (it is not a dependency), so its types are not available here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Browser = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Page = any;

export function loadChromium() {
  return createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright').chromium;
}

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

/** Static server with the clean URLs Vercel gives the export (/energy-guide → energy-guide.html). */
export function serve(root: string): Promise<{ url: string; close: () => void }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const candidates = [join(root, path), join(root, `${path}.html`), join(root, path, 'index.html')];
    const file = candidates.find((f) => existsSync(f) && statSync(f).isFile()) ?? join(root, 'index.html');
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    resolve({ url: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`, close: () => server.close() });
  }));
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const USER = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'demo@example.com', app_metadata: {}, user_metadata: { name: 'Demo' }, created_at: '2026-01-01T00:00:00Z' };
const expiresAt = Math.floor(Date.now() / 1000) + 24 * 3600;
const SESSION = {
  access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, exp: expiresAt, role: 'authenticated' })}.sig`,
  refresh_token: 'refresh',
  token_type: 'bearer',
  expires_in: 24 * 3600,
  expires_at: expiresAt,
  user: USER,
};

export type OpenAppOptions = {
  reducedMotion?: 'reduce' | 'no-preference';
  viewport?: { width: number; height: number };
  /** Extra localStorage entries (the persisted zustand stores), as JSON-able values; a function runs in the page to build the value. */
  storage?: Record<string, unknown>;
  /** Plain JavaScript run in the page before the app starts (to seed what depends on today's date). */
  initScript?: string;
  path?: string;
};

export async function openApp(browser: Browser, base: string, { reducedMotion = 'no-preference', viewport = { width: 390, height: 844 }, storage = {}, initScript = '', path = '/' }: OpenAppOptions = {}): Promise<Page> {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion });
  const entries = { 'fitlab/app': { state: { hasOnboarded: true, redoingQuestionnaire: false, appearance: 'light' }, version: 0 }, ...storage };
  // A plain string, so the test runner's transpiler adds no helpers to what runs in the page.
  await context.addInitScript(`
    localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(SESSION))});
    var entries = ${JSON.stringify(entries)};
    Object.keys(entries).forEach(function (k) { localStorage.setItem(k, JSON.stringify(entries[k])); });
    ${initScript}
  `);
  // The stubbed backend: the session's user, and an empty account everywhere else.
  await context.route('http://127.0.0.1:54321/**', (route: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const url = route.request().url();
    if (url.includes('/auth/v1/user')) return route.fulfill({ json: USER });
    if (url.includes('/auth/v1/')) return route.fulfill({ json: SESSION });
    const single = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    return route.fulfill({ json: single ? null : [], status: single ? 406 : 200 });
  });
  const page = await context.newPage();
  page.on('pageerror', (e: Error) => console.log('  [pageerror]', e.message));
  await page.goto(base + path);
  return page;
}
