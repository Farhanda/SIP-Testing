import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: '.auth/fe-state.json' });
  const page = await context.newPage();

  const requests = [];
  page.on('request', req => {
    requests.push({ method: req.method(), url: req.url() });
  });

  await page.goto('http://10.200.101.13:3000/dashboard');
  await page.waitForLoadState('networkidle');

  console.log('Dashboard loaded with default keyword MBG.');

  // Clear requests array before clicking trend chart
  requests.length = 0;

  console.log('--- Clicking Conversation Trend point to open Hourly Modal ---');
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const canvasEl = document.querySelector('canvas');
    const fiberKey = Object.keys(canvasEl).find((k) => k.startsWith('__reactFiber'));
    let curr = fiberKey ? canvasEl[fiberKey] : null;
    while (curr) {
      if (curr.memoizedProps?.options?.onClick) {
        // click last index
        curr.memoizedProps.options.onClick({}, [{ index: 29, datasetIndex: 0 }]);
        return;
      }
      curr = curr.return;
    }
  });

  await page.waitForTimeout(1500);

  console.log('Network requests triggered after clicking chart point:');
  if (requests.length === 0) {
    console.log('  -> ZERO network requests triggered! Masih tidak ada API call.');
  } else {
    requests.forEach(r => console.log('  ->', r.method, r.url));
  }

  // Check modal content
  const modal = page.locator('[role="dialog"]');
  console.log('Modal visible:', await modal.isVisible().catch(() => false));
  if (await modal.isVisible().catch(() => false)) {
    console.log('Modal text:');
    console.log(await modal.innerText());
  }

  // Check the data in the modal chart
  const modalChartData = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const c = dialog.querySelector('canvas');
    if (!c) return null;
    const fiberKey = Object.keys(c).find((k) => k.startsWith('__reactFiber'));
    let curr = fiberKey ? c[fiberKey] : null;
    while (curr) {
      if (curr.memoizedProps?.data) {
        return curr.memoizedProps.data;
      }
      curr = curr.return;
    }
    return null;
  });

  if (modalChartData) {
    console.log('\nModal Chart Labels:', modalChartData.labels);
    console.log('Modal Chart Values:', modalChartData.datasets?.[0]?.data);
  }

  await browser.close();
})();

