// Records real screen captures of the live deployed EventWeaver app using Playwright.
// Output: video/public/video/raw/*.webm (one file per flow), later converted to mp4.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '../public/video/raw');
fs.mkdirSync(RAW_DIR, { recursive: true });

const BASE = 'https://eventweaver-orpin.vercel.app';
const SIZE = { width: 1920, height: 1080 };

async function dismissTour(page) {
  try {
    const skip = page.getByText('Skip walkthrough', { exact: true });
    if (await skip.isVisible({ timeout: 2000 })) {
      await skip.click();
      await page.waitForTimeout(400);
    }
  } catch {}
}

async function recordFlow(name, fn) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: RAW_DIR, size: SIZE },
  });
  const page = await context.newPage();
  await fn(page);
  await context.close();
  await browser.close();
  // Playwright names videos by internal id; rename the newest file.
  const files = fs
    .readdirSync(RAW_DIR)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => ({ f, t: fs.statSync(path.join(RAW_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  const newest = files[0].f;
  fs.renameSync(path.join(RAW_DIR, newest), path.join(RAW_DIR, `${name}.webm`));
  console.log(`recorded ${name}.webm`);
}

async function main() {
  // 1. Landing — slow scroll through hero + preview chain card.
  await recordFlow('landing', async (page) => {
    await page.goto(`${BASE}/?tour=0`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1400);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1800);
  });

  // 2. Discovery — scroll through market cards, hover, click a status filter.
  await recordFlow('discovery', async (page) => {
    await page.goto(`${BASE}/?tour=0`, { waitUntil: 'networkidle' });
    await dismissTour(page);
    await page.getByRole('link', { name: 'Discovery' }).click();
    await page.waitForTimeout(1000);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(1200);
    const openFilter = page.getByRole('button', { name: 'OPEN', exact: true });
    if (await openFilter.isVisible().catch(() => false)) {
      await openFilter.click();
      await page.waitForTimeout(1200);
    }
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1800);
  });

  // 3. Market detail — open the Apple chain market, scroll through steps + resolution report.
  await recordFlow('market-detail', async (page) => {
    await page.goto(`${BASE}/?tour=0`, { waitUntil: 'networkidle' });
    await dismissTour(page);
    await page.getByRole('link', { name: 'Discovery' }).click();
    await page.waitForTimeout(800);
    const appleCard = page.getByText('Apple Spatial Computing Cascade', { exact: false });
    await appleCard.click();
    await page.waitForTimeout(1400);
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(1600);
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(1800);
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(1800);
  });

  // 4. Create — fill the Visual Logic Builder form, field by field.
  await recordFlow('create', async (page) => {
    await page.goto(`${BASE}/?tour=0`, { waitUntil: 'networkidle' });
    await dismissTour(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Create' }).click();
    await page.waitForTimeout(1000);
    await dismissTour(page);
    const title = page.getByPlaceholder('e.g. Vision Pro Adoption Cascade');
    await title.click();
    await title.type('Ethereum ETF Approval Cascade', { delay: 55 });
    await page.waitForTimeout(500);
    const desc = page.getByPlaceholder('What ripple effect does this market track?');
    await desc.click();
    await desc.type('Tracks a regulatory chain reaction across two dependent filings.', { delay: 35 });
    await page.waitForTimeout(700);
    const conditionInputs = page.getByPlaceholder(/SpaceX Starship completes/);
    const first = conditionInputs.first();
    await first.click();
    await first.type('SEC approves a spot Ethereum ETF application', { delay: 45 });
    await page.waitForTimeout(600);
    const urlInputs = page.getByPlaceholder(/spacex.com\/updates/);
    const firstUrl = urlInputs.first();
    await firstUrl.click();
    await firstUrl.type('https://www.sec.gov/news/pressreleases', { delay: 30 });
    await page.waitForTimeout(1600);
  });

  // 5. Portfolio — connect-wallet prompt state.
  await recordFlow('portfolio', async (page) => {
    await page.goto(`${BASE}/?tour=0`, { waitUntil: 'networkidle' });
    await dismissTour(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Portfolio' }).click();
    await page.waitForTimeout(2200);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
