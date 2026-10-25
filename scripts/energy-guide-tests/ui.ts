/**
 * Browser tests for the "Come leggere il grafico" carousel, on the web build.
 *
 *   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=test \
 *     npx expo export --platform web --output-dir /tmp/fitlab-web
 *   npm run energy-guide:ui -- /tmp/fitlab-web
 *
 * Needs Playwright with Chromium (not a project dependency: point
 * PLAYWRIGHT_MODULE at an installed copy if `playwright` does not resolve).
 * The backend is stubbed: a signed-in session is seeded in localStorage and
 * every Supabase request answers empty, so Home runs on an empty account —
 * which is also the proof that the carousel never shows or writes real data.
 */
import assert from 'node:assert/strict';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';

// Playwright is resolved at runtime (it is not a dependency), so its types are not available here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;

const distDir = process.argv[2];
if (!distDir || !existsSync(join(distDir, 'index.html'))) {
  console.error('Usage: npm run energy-guide:ui -- <web export dir>');
  process.exit(2);
}

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

/** Static server with the clean URLs Vercel gives the export (/energy-guide → energy-guide.html). */
function serve(root: string): Promise<{ url: string; close: () => void }> {
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

async function openApp(browser: Browser, base: string, reducedMotion: 'reduce' | 'no-preference'): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion });
  await context.addInitScript((session: object) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(session));
    localStorage.setItem('fitlab/app', JSON.stringify({ state: { hasOnboarded: true, redoingQuestionnaire: false, appearance: 'light' }, version: 0 }));
  }, SESSION);
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
  await page.goto(base + '/');
  return page;
}

const pageEl = (page: Page, i: number) => page.getByTestId(`energy-guide-page-${i}`);
const text = async (page: Page, i: number) => (await pageEl(page, i).innerText()).replace(/\s+/g, ' ');
/** Where page 3's marker sits, in px from the equilibrium tick (+ = right, the deficit side). */
async function markerOffset(page: Page): Promise<number> {
  const centre = async (id: string) => {
    const box = await page.getByTestId(id).boundingBox();
    return box.x + box.width / 2;
  };
  return (await centre('energy-balance-marker')) - (await centre('energy-balance-zero'));
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openGuide(page: Page) {
  await page.getByRole('button', { name: 'Come leggere il grafico, con un esempio' }).click();
  await pageEl(page, 0).waitFor();
}

/** Swipe the pager to page i (a real horizontal scroll, as a finger would). */
async function swipeTo(page: Page, i: number) {
  await page.getByTestId('energy-guide-pager').evaluate((el: HTMLElement, index: number) => {
    el.scrollLeft = index * el.clientWidth;
  }, i);
  await page.waitForFunction((index: number) => {
    const pager = document.querySelector('[data-testid="energy-guide-pager"]') as HTMLElement | null;
    return !!pager && Math.round(pager.scrollLeft / pager.clientWidth) === index;
  }, i);
  await pause(150);
}

let failed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}\n      ${(e as Error).message.split('\n').join('\n      ')}`);
  }
}

async function main() {
  const server = await serve(distDir);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const shots = process.env.SCREENSHOT_DIR;
  try {
    const page = await openApp(browser, server.url, 'no-preference');
    await page.getByRole('button', { name: 'Come leggere il grafico, con un esempio' }).waitFor({ timeout: 30000 });
    const homeBefore = await page.locator('body').innerText();
    if (shots) await page.screenshot({ path: join(shots, 'home.png') });

    await test('page 1 animates from zero to the example values when shown', async () => {
      await openGuide(page);
      await pause(120);
      const early = await text(page, 0);
      const pager = await page.getByTestId('energy-guide-pager').boundingBox();
      await pause(1400);
      const settled = await text(page, 0);
      assert.match(settled, /2\.400 kcal/);
      assert.match(settled, /2\.681 kcal/);
      assert.match(settled, /-281 kcal/);
      assert.doesNotMatch(early, /2\.681 kcal/, 'the counters are still running shortly after opening');
      if (shots) await page.screenshot({ path: join(shots, 'page1.png'), fullPage: true });
      // The pager is as tall as page 1, not as the tallest page.
      const page1 = await pageEl(page, 0).boundingBox();
      const after = await page.getByTestId('energy-guide-pager').boundingBox();
      assert.ok(Math.abs(after.height - page1.height) < 2, `pager ${after.height} vs page ${page1.height} (was ${pager.height})`);
    });

    await test('1. deficit: page 3 reads Deficit with the marker right of centre', async () => {
      await swipeTo(page, 2);
      await pause(1300);
      const t = await text(page, 2);
      assert.match(t, /Deficit -281 kcal/);
      assert.ok((await markerOffset(page)) > 40, 'marker right of centre');
      if (shots) await page.screenshot({ path: join(shots, 'page3-deficit.png'), fullPage: true });
    });

    await test('2. equilibrium preset: page 3 switches to Equilibrio, 0 kcal', async () => {
      await page.getByRole('button', { name: 'Esempio in equilibrio' }).click();
      await pause(900);
      assert.match(await text(page, 2), /Equilibrio 0 kcal/);
      assert.ok(Math.abs(await markerOffset(page)) < 2, 'marker on the equilibrium tick');
      if (shots) await page.screenshot({ path: join(shots, 'page3-even.png'), fullPage: true });
    });

    await test('3. surplus preset: page 3 switches to Surplus, +350 kcal', async () => {
      await page.getByRole('button', { name: 'Esempio in surplus' }).click();
      await pause(900);
      assert.match(await text(page, 2), /Surplus \+350 kcal/);
      assert.ok((await markerOffset(page)) < -40, 'marker left of centre');
      if (shots) await page.screenshot({ path: join(shots, 'page3-surplus.png'), fullPage: true });
    });

    await test('4. a stepper change updates the chart immediately', async () => {
      await page.getByRole('button', { name: 'Diminuisci calorie assunte' }).click();
      await page.getByRole('button', { name: 'Diminuisci calorie assunte' }).click();
      await page.getByRole('button', { name: 'Diminuisci calorie assunte' }).click();
      await page.getByRole('button', { name: 'Diminuisci calorie assunte' }).click();
      await pause(900);
      // 3.031 → 3.000 → 2.900 → 2.800 → 2.700: +19 against 2.681 burned.
      assert.match(await text(page, 2), /Equilibrio \+19 kcal/);
      // +19 sits inside the ±50 tolerance: still equilibrium, on the surplus side.
      await page.getByRole('button', { name: 'Aumenta attività extra' }).click();
      await page.getByRole('button', { name: 'Aumenta attività extra' }).click();
      await pause(900);
      assert.match(await text(page, 2), /Deficit -81 kcal/, 'more movement, more burned');
    });

    await test('5. swiping forward and back keeps every page in sync', async () => {
      await swipeTo(page, 3);
      await pause(1300);
      const p4 = await text(page, 3);
      assert.match(p4, /2\.781 kcal/);
      assert.match(p4, /2\.700 kcal/);
      assert.match(p4, /-81 kcal/);
      assert.match(p4, /in deficit/);
      if (shots) await page.screenshot({ path: join(shots, 'page4.png'), fullPage: true });
      await swipeTo(page, 1);
      await pause(1300);
      const p2 = await text(page, 1);
      assert.match(p2, /2\.781 kcal/, 'the total on page 2 follows the change');
      assert.match(p2, /1\.708 kcal/);
      assert.match(p2, /1\.073 kcal/);
      if (shots) await page.screenshot({ path: join(shots, 'page2.png'), fullPage: true });
      await swipeTo(page, 0);
      // Already played: back on page 1 the numbers are there at once, not replayed from zero.
      await pause(80);
      const p1 = await text(page, 0);
      assert.match(p1, /2\.700 kcal/);
      assert.match(p1, /2\.781 kcal/);
      assert.match(p1, /-81 kcal/);
    });

    await test('6. closing and reopening starts again from page 1 and the initial example', async () => {
      await page.getByRole('button', { name: 'Chiudi' }).first().click();
      await page.getByTestId('energy-guide-page-0').waitFor({ state: 'detached' });
      await openGuide(page);
      await pause(1400);
      const t = await text(page, 0);
      assert.match(t, /1 di 4/i);
      assert.match(t, /2\.400 kcal/);
      assert.match(t, /-281 kcal/);
      assert.equal(await page.getByText('Indietro', { exact: true }).count(), 0, 'back on the first page');
      await page.getByRole('button', { name: 'Chiudi' }).first().click();
      await page.getByTestId('energy-guide-page-0').waitFor({ state: 'detached' });
    });

    await test('8. Home shows the same numbers before and after using the carousel', async () => {
      await pause(600);
      const homeAfter = await page.locator('body').innerText();
      const kcal = (s: string) => s.match(/[-+]?[\d.]+ kcal/g) ?? [];
      assert.deepEqual(kcal(homeAfter), kcal(homeBefore));
      assert.doesNotMatch(homeAfter, /2\.400 kcal|2\.681 kcal/, 'no example value leaked into Home');
      assert.equal(await page.evaluate(() => Object.keys(localStorage).some((k) => k.includes('energy-guide'))), false);
    });

    await page.context().close();

    const still = await openApp(browser, server.url, 'reduce');
    await test('7. with reduced motion every chart is complete as soon as it is shown', async () => {
      await still.getByRole('button', { name: 'Come leggere il grafico, con un esempio' }).waitFor({ timeout: 30000 });
      await openGuide(still);
      await pause(60);
      const p1 = await text(still, 0);
      assert.match(p1, /2\.400 kcal/);
      assert.match(p1, /2\.681 kcal/);
      assert.match(p1, /-281 kcal/);
      await still.getByText('Avanti', { exact: true }).click();
      await still.getByText('Avanti', { exact: true }).click();
      await pause(60);
      assert.match(await text(still, 2), /Deficit -281 kcal/);
      await still.getByText('Avanti', { exact: true }).click();
      await pause(60);
      // -281 against a -300 goal is within the tolerance of it: Home's own caption.
      assert.match(await text(still, 3), /-281 kcal obiettivo raggiunto/);
      if (shots) await pageEl(still, 3).screenshot({ path: join(shots, 'reduced-page4.png') });
    });
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed} failed` : '\nAll passed');
  process.exit(failed ? 1 : 0);
}

main();
