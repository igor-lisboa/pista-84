import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { loadHarness } from '../tests/browser/support/harness.ts';

const output = 'docs/screenshots/brazilian-cars-v1';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1060 } });
  await page.goto('http://127.0.0.1:4173');
  await loadHarness(page);
  await page.evaluate(async () => {
    const { CARS, loadSprites, drawCar } = window.Pista;
    await loadSprites();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;overflow:hidden';
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 1060;
    document.body.append(canvas);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#21182f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff3dc';
    ctx.font = '18px sans-serif';
    ['Straight', 'Gentle right', 'Hard right', 'Hard left', 'Blue paint / brake'].forEach((text, col) => ctx.fillText(text, 24 + col * 255, 30));
    ['fusca', 'fiat147', 'marea', 'passat', 'puma', 'gt'].forEach((id, row) => {
      const car = CARS.find((car) => car.id === id)!;
      ctx.fillStyle = '#fff3dc';
      ctx.fillText(car.name, 18, 66 + row * 163);
      [0, 0.45, 1, -1, 0.45].forEach((turn, col) => {
        drawCar(ctx, 122 + col * 255, 206 + row * 163, 1.4,
          col === 4 ? { ...car, color: '#2852b8' } : car, col === 4, turn);
      });
    });
  });
  await page.locator('canvas').screenshot({ path: `${output}/vehicle-poses.png` });
  for (const id of ['fiat147', 'marea', 'passat', 'puma']) {
    await page.evaluate(({ id }) => {
      const { CARS, Race, Renderer } = window.Pista;
      const canvas = document.querySelector('canvas')!;
      const race = new Race(CARS.find((car) => car.id === id), () => 0.25);
      race.start();
      race.speed = 100;
      race.time = 7;
      race.path = 700;
      race.steer = 0.5;
      new Renderer(canvas).draw(race, 7);
    }, { id });
    await page.locator('canvas').screenshot({ path: `${output}/${id}-driving.png` });
  }
} finally {
  await browser.close();
}
