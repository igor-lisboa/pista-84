import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const fitsHorizontally = (selector: string) =>
  `Array.from(document.querySelectorAll('${selector}')).every((el) => el.scrollWidth <= el.clientWidth + 1)`;

test('settings are grouped, switches show their state and nothing spills sideways on a phone', async ({ page }) => {
  await page.goto('/');
  await page.locator('#settingsNav').click();

  await expect(page.locator('.settings-group')).toHaveCount(4);
  expect(await page.evaluate(fitsHorizontally('#modal, .setting-card, .setting-row'))).toBe(true);

  const sound = page.locator('#sound');
  const before = await sound.getAttribute('aria-pressed');
  await sound.click();
  await expect(sound).not.toHaveAttribute('aria-pressed', before!);
  // The label changed but the row still has its icon and switch.
  await expect(sound.locator('.row-icon svg')).toHaveCount(1);
  await expect(sound.locator('.switch')).toHaveCount(1);

  // Every row is comfortably tappable.
  for (const id of ['username', 'newPlayer', 'units', 'sound', 'tutorial', 'tilt', 'fullscreen', 'install']) {
    const box = (await page.locator(`#${id}`).boundingBox())!;
    expect(box.height, id).toBeGreaterThanOrEqual(48);
  }
});

test('the garage shows one car per row on a phone, with its stats inside the card', async ({ page }) => {
  await page.goto('/');
  await page.locator('#garageNav').click();

  const cards = page.locator('.car-card');
  expect(await cards.count()).toBe(14);
  const first = (await cards.nth(0).boundingBox())!;
  const second = (await cards.nth(1).boundingBox())!;
  expect(second.y).toBeGreaterThan(first.y + first.height - 1); // stacked, never side by side
  expect(Math.abs(second.x - first.x)).toBeLessThan(2);

  expect(await page.evaluate(fitsHorizontally('.car-card, .car-card dl, .car-card button, #modal'))).toBe(true);
  // The stats stay readable, not truncated into narrow boxes.
  const stat = (await cards.nth(0).locator('dl > div').first().boundingBox())!;
  expect(stat.width).toBeGreaterThan(120);
  // The thumbnail and the buy/select button are both there for every car.
  for (let i = 0; i < 14; i += 1) {
    await expect(cards.nth(i).locator('canvas')).toHaveCount(1);
    await expect(cards.nth(i).locator('button')).toHaveCount(1);
  }
  // Paints are a swipeable row rather than a wall of cards.
  const paints = (await page.locator('#paints').evaluate((el) => ({ scrolls: el.scrollWidth > el.clientWidth, flex: getComputedStyle(el).display })));
  expect(paints.flex).toBe('flex');
  expect(paints.scrolls).toBe(true);
});
