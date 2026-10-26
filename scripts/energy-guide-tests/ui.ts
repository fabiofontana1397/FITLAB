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
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { loadChromium, openApp as openHarnessApp, serve, type Page } from '../lib/web-harness';

const distDir = process.argv[2];
if (!distDir || !existsSync(join(distDir, 'index.html'))) {
  console.error('Usage: npm run energy-guide:ui -- <web export dir>');
  process.exit(2);
}

const chromium = loadChromium();

/** `seedPastMeals`: meals logged on the two days before today, to see their rings in the week strip. */
function openApp(browser: Parameters<typeof openHarnessApp>[0], base: string, reducedMotion: 'reduce' | 'no-preference', viewport = { width: 390, height: 844 }, seedPastMeals = false) {
  return openHarnessApp(browser, base, {
    reducedMotion,
    viewport,
    initScript: seedPastMeals
      ? `
      var iso = function (n) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
      var entries2 = [1, 2].map(function (n) { return { id: 'seed-' + n, date: iso(n), slot: 'pranzo', foodId: 'chicken-breast', grams: 1000 }; });
      localStorage.setItem('fitlab/nutrition', JSON.stringify({ state: { entries: entries2, seededDates: [] }, version: 0 }));`
      : '',
  });
}

const pageEl = (page: Page, i: number) => page.getByTestId(`energy-guide-page-${i}`);
const text = async (page: Page, i: number) => (await pageEl(page, i).innerText()).replace(/\s+/g, ' ');

const PAGE_COUNT = 3;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HOME_LABEL = /^(Bilancio|Nessun pasto registrato)/;

async function openGuide(page: Page, from: 'details' | 'gauge' = 'details') {
  if (from === 'gauge') await page.getByRole('button', { name: HOME_LABEL }).click();
  else await page.getByRole('button', { name: 'Dettagli: come leggere il grafico' }).click();
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

/** Every page fits in the pager: nothing to scroll vertically, on any page. */
async function assertPagesFit(page: Page) {
  const pager = await page.getByTestId('energy-guide-pager').boundingBox();
  const problems: string[] = [];
  for (let i = 0; i < PAGE_COUNT; i++) {
    await swipeTo(page, i);
    await pause(900);
    const fit = await pageEl(page, i).evaluate((el: HTMLElement) => ({ content: el.scrollHeight, shown: el.parentElement!.clientHeight }));
    if (fit.content > fit.shown + 1) problems.push(`page ${i + 1}: content ${fit.content}px in ${fit.shown}px`);
    const box = await pageEl(page, i).boundingBox();
    if (box.y + box.height > pager.y + pager.height + 1) problems.push(`page ${i + 1} ends below the pager`);
  }
  assert.deepEqual(problems, []);
  // On the last page both notes are read in full, inside the room the pager has.
  await swipeTo(page, PAGE_COUNT - 1);
  await pause(900);
  const bottoms = [] as string[];
  for (const note of [/Arancione: consumate/, /Il triangolo/]) {
    const box = await pageEl(page, PAGE_COUNT - 1).getByText(note).boundingBox();
    if (!box || box.y + box.height > pager.y + pager.height + 1) bottoms.push(`${note} ends below the pager`);
  }
  assert.deepEqual(bottoms, []);
  await swipeTo(page, 0);
}

async function main() {
  const server = await serve(distDir);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const shots = process.env.SCREENSHOT_DIR;
  try {
    const page = await openApp(browser, server.url, 'no-preference', undefined, true);
    await page.getByRole('button', { name: 'Dettagli: come leggere il grafico' }).waitFor({ timeout: 30000 });
    await pause(1500);
    const homeBefore = await page.locator('body').innerText();
    if (shots) await page.screenshot({ path: join(shots, 'home.png') });

    await test('Home: the calendar, notifications and profile buttons are on the top bar's line, in that order', async () => {
      const cal = await page.getByRole('button', { name: 'Apri calendario' }).boundingBox();
      const bell = await page.getByRole('button', { name: 'Notifiche' }).boundingBox();
      const profile = await page.getByRole('button', { name: /profilo/i }).first().boundingBox();
      assert.ok(cal.x + cal.width <= bell.x + 1 && bell.x + bell.width <= profile.x + 1, 'calendar, bell, profile from left to right');
      assert.ok(Math.abs(cal.y - bell.y) < 2 && Math.abs(cal.y - profile.y) < 2, 'all on one line');
    });

    await test('Home: the gauge shows the balance, the goal under it, then deficit / surplus in grey', async () => {
      const gauge = await page.getByRole('button', { name: HOME_LABEL }).innerText();
      assert.match(gauge.replace(/\s+/g, ' '), /-?\d[\d.]* \/-?\d[\d.]* kcal (deficit|surplus|equilibrio|nessun pasto)$/);
      assert.match(gauge, /Equilibrio · 0 kcal/);
      assert.match(gauge, /Deficit\s+-[\d.]+ kcal/);
      assert.match(gauge, /Surplus\s+\+[\d.]+ kcal/);
      assert.doesNotMatch(gauge, /obiettivo/i);
    });

    await test('Home: days with meals logged before today show their coloured ring in the week strip', async () => {
      const today = new Date().getDay(); // 0 = Sunday … 1 = Monday
      if (today === 1) return console.log('      (Monday: no earlier day in this week, skipped)');
      const rings = async (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() - offset);
        return page.locator(`[role="tab"][aria-label$=" ${d.getDate()}"] svg path`).count();
      };
      assert.equal(await rings(1), 2, 'yesterday: two arcs (burned + eaten)');
      assert.equal(await rings(2) > 0 || today === 2, true, 'two days ago has its arcs too');
    });

    await test('page 1 animates from zero to the example values when shown', async () => {
      await openGuide(page);
      await pause(120);
      const early = await text(page, 0);
      await pause(1400);
      const settled = await text(page, 0);
      assert.match(settled, /2\.400 kcal/);
      assert.match(settled, /2\.681 kcal/);
      assert.match(settled, /-281 kcal/);
      assert.doesNotMatch(early, /2\.681 kcal/, 'the counters are still running shortly after opening');
      if (shots) await page.screenshot({ path: join(shots, 'page1.png') });
    });

    await test('the carousel is one screen: no controls box, no vertical scroll on any page', async () => {
      assert.equal(await page.getByText('Prova a cambiare').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Ripristina l’esempio' }).count(), 0);
      await assertPagesFit(page);
    });

    await test('5. swiping forward and back keeps every page in sync', async () => {
      await swipeTo(page, 2);
      await pause(1300);
      const p3 = await text(page, 2);
      assert.match(p3, /-281 \/-300 kcal equilibrio|-281 \/-300 kcal deficit/);
      assert.match(p3, /2\.681 kcal/);
      assert.match(p3, /2\.400 kcal/);
      assert.match(p3, /Equilibrio · 0 kcal/);
      assert.match(p3, /Deficit -600 kcal/);
      assert.match(p3, /Surplus \+600 kcal/);
      if (shots) await page.screenshot({ path: join(shots, 'page4.png') });
      await swipeTo(page, 1);
      await pause(1300);
      const p2 = await text(page, 1);
      assert.match(p2, /2\.681 kcal/);
      assert.match(p2, /1\.708 kcal/);
      assert.match(p2, /973 kcal/);
      if (shots) await page.screenshot({ path: join(shots, 'page2.png') });
      await swipeTo(page, 0);
      await pause(80);
      const p1 = await text(page, 0);
      assert.match(p1, /2\.400 kcal/);
      assert.match(p1, /-281 kcal/);
    });

    await test('6. closing and reopening (from a tap on the gauge) starts again from page 1', async () => {
      await page.getByRole('button', { name: 'Chiudi' }).first().click();
      await page.getByTestId('energy-guide-page-0').waitFor({ state: 'detached' });
      await openGuide(page, 'gauge');
      await pause(1400);
      const t = await text(page, 0);
      assert.match(t, /1 di 3/i);
      assert.match(t, /2\.400 kcal/);
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

    // Tall phones lose room to their insets (not simulated here), so shorter windows stand in for them.
    for (const size of [{ width: 375, height: 667 }, { width: 390, height: 700 }]) {
      const small = await openApp(browser, server.url, 'no-preference', size);
      await test(`on a ${size.width}×${size.height} phone every page fits without scrolling, notes included`, async () => {
        await small.getByRole('button', { name: 'Dettagli: come leggere il grafico' }).waitFor({ timeout: 30000 });
        await openGuide(small);
        await assertPagesFit(small);
        await swipeTo(small, PAGE_COUNT - 1);
        await pause(1300);
        if (shots) await small.screenshot({ path: join(shots, `small-${size.height}.png`) });
      });
      await small.context().close();
    }

    const still = await openApp(browser, server.url, 'reduce');
    await test('7. with reduced motion every chart is complete as soon as it is shown', async () => {
      await still.getByRole('button', { name: 'Dettagli: come leggere il grafico' }).waitFor({ timeout: 30000 });
      await openGuide(still);
      await pause(60);
      const p1 = await text(still, 0);
      assert.match(p1, /2\.400 kcal/);
      assert.match(p1, /2\.681 kcal/);
      assert.match(p1, /-281 kcal/);
      await still.getByText('Avanti', { exact: true }).click();
      await still.getByText('Avanti', { exact: true }).click();
      await pause(60);
      assert.match(await text(still, 2), /-281 \/-300 kcal deficit/);
      if (shots) await pageEl(still, 2).screenshot({ path: join(shots, 'reduced-page3.png') });
    });
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed} failed` : '\nAll passed');
  process.exit(failed ? 1 : 0);
}

main();
