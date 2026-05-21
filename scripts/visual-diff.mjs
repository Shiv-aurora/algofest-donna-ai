import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const root = process.cwd();
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173';

const screens = [
  {
    name: 'overview',
    route: '/overview',
    ref: 'deisgn-pack/overview_quiet_canvas_refined/screen.png',
    width: 1600,
    height: 1280,
    // Baseline from original design-pack HTML to its own reference screenshot.
    baselineRatio: 0.1143
  },
  {
    name: 'today',
    route: '/today',
    ref: 'deisgn-pack/today_quiet_canvas/screen.png',
    width: 1600,
    height: 1345,
    baselineRatio: 0.1144
  },
  {
    name: 'assignments',
    route: '/assignments',
    ref: 'deisgn-pack/assignments_quiet_canvas/screen.png',
    width: 1600,
    height: 1280,
    baselineRatio: 0.0889
  },
  {
    name: 'calendar',
    route: '/calendar',
    ref: 'deisgn-pack/calendar_quiet_canvas/screen.png',
    width: 1600,
    height: 1280,
    baselineRatio: 0.0573
  }
];
const toleratedDrift = 0.004;

const currentDir = path.join(root, 'artifacts', 'current');
const diffDir = path.join(root, 'artifacts', 'diff');
fs.mkdirSync(currentDir, { recursive: true });
fs.mkdirSync(diffDir, { recursive: true });

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

async function captureScreenshots(browser) {
  for (const screen of screens) {
    const page = await browser.newPage({ viewport: { width: screen.width, height: screen.height } });
    await page.goto(`${baseUrl}${screen.route}`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    });
    await page.waitForTimeout(900);
    await page.screenshot({
      path: path.join(currentDir, `${screen.name}.png`),
      clip: { x: 0, y: 0, width: screen.width, height: screen.height }
    });
    await page.close();
  }
}

function compareScreens() {
  let hasFailures = false;

  for (const screen of screens) {
    const reference = readPng(path.join(root, screen.ref));
    const current = readPng(path.join(currentDir, `${screen.name}.png`));

    if (reference.width !== current.width || reference.height !== current.height) {
      console.error(
        `[${screen.name}] Dimension mismatch. expected ${reference.width}x${reference.height}, got ${current.width}x${current.height}`
      );
      hasFailures = true;
      continue;
    }

    const diff = new PNG({ width: reference.width, height: reference.height });
    const mismatchPixels = pixelmatch(reference.data, current.data, diff.data, reference.width, reference.height, {
      threshold: 0.1
    });
    const mismatchRatio = mismatchPixels / (reference.width * reference.height);

    fs.writeFileSync(path.join(diffDir, `${screen.name}.png`), PNG.sync.write(diff));

    const baselinePct = (screen.baselineRatio * 100).toFixed(2);
    const currentPct = (mismatchRatio * 100).toFixed(2);
    const driftPct = ((mismatchRatio - screen.baselineRatio) * 100).toFixed(2);

    console.log(`[${screen.name}] mismatch: ${currentPct}% (baseline ${baselinePct}%, drift ${driftPct}%)`);

    if (mismatchRatio > screen.baselineRatio + toleratedDrift) {
      hasFailures = true;
    }
  }

  if (hasFailures) {
    process.exitCode = 1;
  }
}

const browser = await chromium.launch({ headless: true });
try {
  await captureScreenshots(browser);
  compareScreens();
} finally {
  await browser.close();
}
