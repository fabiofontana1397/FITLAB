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

import { loadChromium, openApp, serve, type Page } from '../lib/web-harness';

const distDir = process.argv[2];
if (!distDir || !existsSync(join(distDir, 'index.html'))) {
  console.error('Usage: npm run training:ui -- <web export dir>');
  process.exit(2);
}

const exercise = (n: number) => ({ id: `ex-${n}`, name: `Esercizio ${n}`, sets: 3, reps: '10', restSec: 60, suggestedKg: 20, tempo: '2-0-1' });
const workout = (weekday: string, title: string) => ({ weekday, type: 'workout', title, exercises: [exercise(1), exercise(2), exercise(3)] });
const rest = (weekday: string) => ({ weekday, type: 'rest', title: 'Riposo' });
const PLAN = {
  generatedAt: new Date().toISOString(),
  durationMonths: 3,
  engine: 'training-2',
  calibration: {},
  months: [
    {
      monthIndex: 1,
      phase: 'adattamento',
      title: 'Mese 1',
      focusNote: '',
      weeklySplit: [
        workout('Lun', 'Petto e tricipiti'),
        rest('Mar'),
        { weekday: 'Mer', type: 'cardio', title: 'Corsa facile', note: 'Corsa facile 35 min' },
        workout('Gio', 'Schiena e bicipiti'),
        rest('Ven'),
        workout('Sab', 'Gambe'),
        rest('Dom'),
      ],
    },
  ],
};

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

    await test('one titled section per training day of the week, in calendar order', async () => {
      const present = [] as string[];
      for (const date of week) if ((await page.getByTestId(`training-day-${date}`).count()) > 0) present.push(date);
      // Monday, Wednesday, Thursday and Saturday are sessions; today is always shown.
      const expected = week.filter((d) => [mon, wed, thu, sat, today].includes(d));
      assert.deepEqual(present, expected);
      const tops = [] as number[];
      for (const date of present) tops.push((await page.getByTestId(`training-day-${date}`).evaluate((el: HTMLElement) => el.offsetTop)));
      assert.deepEqual([...tops].sort((a, b) => a - b), tops, 'sections follow the week');
      const text = await list().innerText();
      assert.match(text, /Petto e tricipiti/);
      assert.match(text, /Schiena e bicipiti/);
      assert.match(text, /Gambe/);
      assert.match(text, /Corsa facile/);
    });

    await test('the selected day (today) is at the top of the list, with its own title', async () => {
      const region = (await list().boundingBox()).y;
      const section = await top(page, `training-day-${today}`);
      // Today may be one of the last sections: then the list is scrolled as far as it goes, not further.
      assert.ok(section >= region - 1, 'section not above the list');
      assert.ok(section - region < 60, `section ${section - region}px under the list's top`);
      assert.match(await page.getByTestId(`training-day-${today}`).innerText(), /Allenamento di oggi/);
    });

    await test('selecting another day scrolls its section to the top of the list', async () => {
      for (const date of [mon, thu, sat, wed]) {
        await page.getByTestId(`week-day-${date}`).click();
        await pause(900);
        const region = (await list().boundingBox()).y;
        const section = await top(page, `training-day-${date}`);
        assert.ok(Math.abs(section - region - 18) < 8, `${date}: section ${Math.round(section - region)}px under the list's top`);
      }
    });

    await test('the header and the week stay put while the list scrolls', async () => {
      await page.getByTestId(`week-day-${mon}`).click();
      await pause(900);
      const before = await top(page, `week-day-${mon}`);
      await list().evaluate((el: HTMLElement) => { el.scrollTop = el.scrollHeight; });
      await pause(400);
      assert.ok((await scrollTop()) > 100, 'the list scrolled');
      assert.equal(await top(page, `week-day-${mon}`), before, 'the week did not move');
      assert.equal(await pageScrollY(), 0, 'the page itself does not scroll');
      await list().evaluate((el: HTMLElement) => { el.scrollTop = 0; });
      await pause(300);
      assert.equal(await top(page, `week-day-${mon}`), before);
      if (shots) await page.screenshot({ path: join(shots, 'training-top.png') });
    });

    await test('every session can be reached by scrolling, down to the last', async () => {
      await list().evaluate((el: HTMLElement) => { el.scrollTop = el.scrollHeight; });
      await pause(400);
      const region = await list().boundingBox();
      const lastDate = sat; // Monday is selected here, so today's rest day is no longer listed
      const box = await page.getByTestId(`training-day-${lastDate}`).boundingBox();
      assert.ok(box.y < region.y + region.height, 'the last section is on screen');
      assert.ok(await page.getByText('Registra allenamento').isVisible(), 'the register button is at the end of the list');
      if (shots) await page.screenshot({ path: join(shots, 'training-bottom.png') });
    });

    await test('the list fades under the week once scrolled, and not at rest', async () => {
      await list().evaluate((el: HTMLElement) => { el.scrollTop = 0; });
      await pause(300);
      const opacity = () => page.getByTestId('training-fade').evaluate((el: HTMLElement) => Number(getComputedStyle(el).opacity));
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
