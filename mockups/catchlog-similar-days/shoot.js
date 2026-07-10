const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const html = 'file://' + path.join(__dirname, 'catchlog.html');

  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 3,
    });
    await page.goto(`${html}?theme=${theme}`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(__dirname, `catchlog-similar-days-${theme}.png`) });
    if (theme === 'light') {
      // close-up of the "Days ahead" portion of the patterns card
      const card = page.locator('.section');
      const box = await card.boundingBox();
      const sub = await page.locator('.subhead').boundingBox();
      await page.screenshot({
        path: path.join(__dirname, 'catchlog-similar-days-detail.png'),
        clip: { x: box.x - 8, y: sub.y - 12, width: box.width + 16, height: box.y + box.height - sub.y + 16 },
      });
    }
    await page.close();
  }
  await browser.close();
  console.log('done');
})();
