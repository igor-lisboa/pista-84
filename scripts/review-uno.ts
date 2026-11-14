import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadHarness } from '../tests/browser/support/harness.ts';

const output = 'docs/screenshots/uno-v1';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1536, height: 570 } });
  await page.addInitScript(() => localStorage.setItem('pista84', JSON.stringify({tutorialDone: true, demoUsed: true, lang: 'en'})));
  await page.goto('http://127.0.0.1:4173');
  await loadHarness(page);
  await page.evaluate(async () => {
    const { CARS, loadSprites, drawCar } = window.Pista;
    await loadSprites();
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;overflow:hidden';
    const canvas = document.createElement('canvas');
    canvas.width = 1536;
    canvas.height = 570;
    document.body.append(canvas);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#21182f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff3dc';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ['Straight', 'Gentle right', 'Hard right', 'Gentle left', 'Hard left', 'Blue paint / brake'].forEach((text, col) => ctx.fillText(text, 24 + col * 255, 30));
    ['uno-normal', 'uno', 'gt'].forEach((id, row) => {
      const car = CARS.find((car) => car.id === id)!;
      ctx.fillStyle = '#fff3dc';
      ctx.fillText(car.name, 18, 66 + row * 163);
      [0, 0.45, 1, -0.45, -1, 0.45].forEach((turn, col) => {
        drawCar(ctx, 122 + col * 255, 206 + row * 163, 1.1,
          col === 5 ? { ...car, color: '#2852b8' } : car, col === 5, turn);
      });
    });
  });
  const png = await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL().split(',')[1]!);
  await writeFile(`${output}/vehicle-poses.png`, Buffer.from(png, 'base64'));
  for (const id of ['uno-normal', 'uno']) {
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
