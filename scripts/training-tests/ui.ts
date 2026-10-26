/**
 * Browser tests for the Allenamento tab: the week is fixed, the week's
 * sessions scroll under it with a fade.
 *
 *   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=test \
 *     npx expo export --platform web --output-dir /tmp/fitlab-web
 *   npm run training:ui -- /tmp/fitlab-web
 *
 * A training plan is seeded in localStorage (workouts on Mon, Thu, Sat, a run
 * on Wed, rest on the other days), on an otherwise empty account.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { TRAINING_PLAN as PLAN } from '../lib/fixtures';
import { loadChromium, openApp, serve, type Page } from '../lib/web-harness';

const distDir = process.argv[2];
if (!distDir || !existsSync(join(distDir, 'index.html'))) {
  console.error('Usage: npm run training:ui -- <web export dir>');
  process.exit(2);
}

const iso = (offset: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
/** The dates of this week, Monday first. */
const weekDates = () => {
  const mondayIndex = (new Date().getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => iso(i - mondayIndex));
};
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/** Top edge of an element, in px. */
async function top(page: Page, testId: string): Promise<number> {
  return (await page.getByTestId(testId).boundingBox()).y;
}

async function main() {
  const chromium = loadChromium();
  const server = await serve(distDir);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const shots = process.env.SCREENSHOT_DIR;
  try {
    const page = await openApp(browser, server.url, { path: '/training', storage: { 'fitlab/plans': { state: { dietPlan: null, trainingPlan: PLAN }, version: 0 } } });
    const week = weekDates();
    const [mon, , wed, thu, , sat] = week;
    const today = iso(0);
    await page.getByTestId(`week-day-${mon}`).waitFor({ timeout: 30000 });
    await pause(1200);
    if (shots) await page.screenshot({ path: join(shots, 'training.png') });

    const list = () => page.getByTestId('training-list');
    const scrollTop = () => list().evaluate((el: HTMLElement) => el.scrollTop);
    const pageScrollY = () => page.evaluate(() => window.scrollY + document.documentElement.scrollTop);

    const sessions = [mon, wed, thu, sat];
    const present = async () => {
      const found = [] as string[];
      for (const date of week) if ((await page.getByTestId(`training-day-${date}`).count()) > 0) found.push(date);
      return found;
    };
    const barY = async () => Math.round((await page.getByRole('button', { name: 'Notifiche' }).boundingBox()).y);

    await test('the list runs from the selected day (today) to the end of the week, in calendar order', async () => {
      // Today is always there; after it, every later session day.
      assert.deepEqual(await present(), week.filter((d) => d === today || (d > today && sessions.includes(d))));
      assert.match(await page.getByTestId(`training-day-${today}`).innerText(), /Allenamento di oggi/);
    });

    await test('selecting a day starts the list at that day: earlier days drop out, later sessions follow', async () => {
      await page.getByTestId(`week-day-${thu}`).click();
      await pause(600);
      assert.deepEqual(await present(), [thu, sat]);
      const text = await page.locator('body').innerText();
      assert.match(text, /Schiena e bicipiti/);
      assert.match(text, /Gambe/);
      assert.doesNotMatch(text, /Petto e tricipiti/);
      await page.getByTestId(`week-day-${wed}`).click();
      await pause(600);
      assert.deepEqual(await present(), [wed, thu, sat]);
      assert.match(await page.locator('body').innerText(), /Corsa facile/);
      await page.getByTestId(`week-day-${mon}`).click();
      await pause(600);
      assert.deepEqual(await present(), sessions);
    });

    await test('only the top bar is fixed: the week scrolls away with the page, under the fade', async () => {
      const bar = await barY();
      const weekBefore = await top(page, `week-day-${mon}`);
      await list().evaluate((el: HTMLElement) => { el.scrollTop = 300; });
      await pause(500);
      assert.ok((await scrollTop()) > 100, 'the page scrolled');
      assert.equal(await barY(), bar, 'the top bar did not move');
      assert.ok((await top(page, `week-day-${mon}`)) < weekBefore - 100, 'the week moved up with the page');
      assert.equal(await pageScrollY(), 0, 'the browser page itself does not scroll');
      if (shots) await page.screenshot({ path: join(shots, 'training-scrolled.png') });
      await list().evaluate((el: HTMLElement) => { el.scrollTop = 0; });
      await pause(400);
      assert.equal(await top(page, `week-day-${mon}`), weekBefore, 'back at the top, the week is where it was');
      if (shots) await page.screenshot({ path: join(shots, 'training-top.png') });
    });

    await test('every session can be reached by scrolling, down to the last', async () => {
      await list().evaluate((el: HTMLElement) => { el.scrollTop = el.scrollHeight; });
      await pause(400);
      const region = await list().boundingBox();
      const box = await page.getByTestId(`training-day-${sat}`).boundingBox();
      assert.ok(box.y < region.y + region.height, 'the last section is on screen');
      if (shots) await page.screenshot({ path: join(shots, 'training-bottom.png') });
    });

    await test('picking a day scrolls the page back to the top', async () => {
      await list().evaluate((el: HTMLElement) => { el.scrollTop = el.scrollHeight; });
      await pause(300);
      await page.getByTestId(`training-day-${sat}`).waitFor();
      await list().evaluate((el: HTMLElement) => { el.scrollTop = 150; });
      await pause(300);
      await page.getByTestId(`week-day-${thu}`).click({ force: true });
      await pause(1000);
      assert.equal(await scrollTop(), 0);
    });

    await test('the list fades under the top bar once scrolled, and not at the top', async () => {
      await page.getByTestId(`week-day-${mon}`).click();
      await pause(600);
      await list().evaluate((el: HTMLElement) => { el.scrollTop = 0; });
      await pause(300);
      const opacity = () => page.getByTestId('screen-top-fade').evaluate((el: HTMLElement) => Number(getComputedStyle(el).opacity));
      assert.equal(await opacity(), 0);
      await list().evaluate((el: HTMLElement) => { el.scrollTop = 80; });
      await pause(300);
      assert.equal(await opacity(), 1);
    });
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed} failed` : '\nAll passed');
  process.exit(failed ? 1 : 0);
}

main();
