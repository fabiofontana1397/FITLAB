/**
 * Browser tests for the four main tabs' top bar: the logo, title and the
 * calendar / menu buttons stay put while the page scrolls,
 * and what scrolls under them dissolves into a fade.
 *
 *   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=test \
 *     npx expo export --platform web --output-dir /tmp/fitlab-web
 *   npm run tabs:ui -- /tmp/fitlab-web
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { TRAINING_PLAN } from '../lib/fixtures';
import { loadChromium, openApp, serve } from '../lib/web-harness';

const distDir = process.argv[2];
if (!distDir || !existsSync(join(distDir, 'index.html'))) {
  console.error('Usage: npm run tabs:ui -- <web export dir>');
  process.exit(2);
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
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TABS = [
  { name: 'Home', path: '/', scrollId: 'screen-scroll' },
  { name: 'Allenamento', path: '/training', scrollId: 'training-list', storage: { 'fitlab/plans': { state: { dietPlan: null, trainingPlan: TRAINING_PLAN }, version: 0 } } },
  { name: 'Nutrizione', path: '/nutrition', scrollId: 'screen-scroll' },
  { name: 'Progressi', path: '/progress', scrollId: 'screen-scroll' },
  { name: 'Piani', path: '/plans', scrollId: 'screen-scroll' },
];

async function main() {
  const server = await serve(distDir);
  const browser = await loadChromium().launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const shots = process.env.SCREENSHOT_DIR;
  try {
    for (const tab of TABS) {
      const page = await openApp(browser, server.url, { path: tab.path, storage: tab.storage });
      await page.getByRole('button', { name: 'Apri menu' }).waitFor({ timeout: 30000 });
      await pause(1500);

      await test(`${tab.name}: the top bar stays put while the page scrolls, and the content fades under it`, async () => {
        const bar = async () => {
          const menu = await page.getByRole('button', { name: 'Apri menu' }).boundingBox();
          return [Math.round(menu.y), Math.round(menu.x)];
        };
        const scroller = page.getByTestId(tab.scrollId);
        const opacity = () => page.getByTestId('screen-top-fade').evaluate((el: HTMLElement) => Number(getComputedStyle(el).opacity));
        await scroller.evaluate((el: HTMLElement) => { el.scrollTop = 0; });
        await pause(400);
        const before = await bar();
        assert.equal(await opacity(), 0, 'no fade at the top');
        await scroller.evaluate((el: HTMLElement) => { el.scrollTop = 400; });
        await pause(500);
        const scrolled = await scroller.evaluate((el: HTMLElement) => el.scrollTop);
        assert.ok(scrolled > 40, `the page scrolled (${scrolled}px)`);
        assert.deepEqual(await bar(), before, 'the bar did not move');
        assert.equal(await opacity(), 1, 'the fade is in');
        // The fade sits right under the bar, over the scrolled content.
        const fade = await page.getByTestId('screen-top-fade').boundingBox();
        assert.ok(fade.y >= before[0] + 36, 'the fade starts below the buttons');
        if (shots) await page.screenshot({ path: join(shots, `tab-${tab.path.replace('/', '') || 'home'}.png`) });
        await scroller.evaluate((el: HTMLElement) => { el.scrollTop = 0; });
        await pause(300);
        assert.deepEqual(await bar(), before);
      });

      await test(`${tab.name}: the menu opens under its button with Profilo, Notifiche and Impostazioni, and closes on a tap outside`, async () => {
        const button = await page.getByRole('button', { name: 'Apri menu' }).boundingBox();
        await page.getByRole('button', { name: 'Apri menu' }).click();
        await pause(700);
        for (const name of ['Profilo', 'Notifiche', 'Impostazioni']) await page.getByRole('button', { name, exact: true }).waitFor({ timeout: 3000 });
        const profile = await page.getByRole('button', { name: 'Profilo', exact: true }).boundingBox();
        assert.ok(profile.y > button.y + button.height, 'the panel hangs under the button');
        assert.ok(Math.abs(profile.x + profile.width - (button.x + button.width)) < 24, 'right-aligned with the button');
        if (shots) await page.screenshot({ path: join(shots, `menu-${tab.path.replace('/', '') || 'home'}.png`) });
        await page.mouse.click(30, 600);
        await pause(500);
        assert.equal(await page.getByRole('button', { name: 'Impostazioni', exact: true }).count(), 0, 'the menu closed');
      });
      await page.context().close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed} failed` : '\nAll passed');
  process.exit(failed ? 1 : 0);
}

main();
