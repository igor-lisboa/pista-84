// Capture the authored poses and identical cameras at representative screen shapes/speeds.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { loadHarness } from '../tests/browser/support/harness.ts';

await mkdir('docs/screenshots/driving-v2', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 960 } });
  await page.goto('http://127.0.0.1:4173');
  await loadHarness(page);
  const bounds = await page.evaluate(async () => {
    const { loadSprites, drawCar, CARS } = window.Pista;
    await loadSprites();
    document.body.replaceChildren();
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 960;
    document.body.append(canvas);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#24183c';
    ctx.fillRect(0, 0, 1200, 960);
    const ids = ['kombi', 'uno', 'chevette', 'cg125', 'opala', 'maverick'];
    ids.forEach((id, row) => {
      const car = CARS.find((car) => car.id === id)!;
      ctx.fillStyle = '#fff6dc';
      ctx.font = '16px sans-serif';
      ctx.fillText(car.name, 16, row * 160 + 24);
      [0, 0.45, 1, -1].forEach((turn, col) => drawCar(ctx, 180 + col * 285, row * 160 + 152, 1.15, car, false, turn));
    });
    // Confirm the actual source has transparent gutters and no clipped silhouettes.
    const image = new Image();
    image.src = '/assets/vehicle-classics-v2.png';
    await image.decode();
    const source = document.createElement('canvas');
    source.width = image.width;
    source.height = image.height;
    const sourceCtx = source.getContext('2d')!;
    sourceCtx.drawImage(image, 0, 0);
    const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
    const rowCuts = [[0, 284, 548, 770, 1036, 1280, 1536], [0, 284, 548, 770, 1036, 1280, 1536], [0, 284, 548, 772, 1036, 1280, 1536]];
    const columns = [0, 320, 662, 1024];
    return ids.flatMap((id, row) => [0, 1, 2].map((pose) => {
      const rows = rowCuts[pose]!;
      let edge = 0;
      let opaque = 0;
      for (let y = rows[row]!; y < rows[row + 1]!; y++) {
        for (let x = columns[pose]!; x < columns[pose + 1]!; x++) {
          if (pixels[(y * image.width + x) * 4 + 3]! <= 80) continue;
          opaque++;
          if (x === columns[pose] || x === columns[pose + 1]! - 1 || y === rows[row] || y === rows[row + 1]! - 1) edge++;
        }
      }
      return { id, pose, opaque, edge };
    }));
  });
  console.log(JSON.stringify(bounds));
  if (bounds.some((cell) => cell.edge > 0 || cell.opaque < 1000)) throw new Error('Clipped or empty atlas cell');
  await page.screenshot({ path: 'docs/screenshots/driving-v2/vehicle-poses.png' });
  for (const [name, width, height] of [['portrait', 390, 844], ['landscape', 1280, 720], ['square', 720, 720]] as const) {
    await page.setViewportSize({ width, height });
    for (const speed of [120, 150, 350]) {
      await page.evaluate(({ speed }) => {
        document.body.replaceChildren();
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:100vw;height:100vh;object-fit:contain;display:block;image-rendering:pixelated;background:#100920';
        document.body.append(canvas);
        const { Race, CARS, Renderer } = window.Pista;
        const race = new Race(CARS.find((car) => car.id === 'gt'), () => 0.25);
        race.start();
        race.speed = speed;
        race.path = 700;
        race.time = 7;
        race.steer = 0.45;
        race.entities = [-1, 1, 2].map((lane, i) => ({ type: 'traffic', lane, targetLane: lane, z: 0.15 + i * 0.2, speed: 70, cruise: 0.5, car: CARS[6 + i]!, timer: 10, cooldown: 0, passed: false }));
        new Renderer(canvas).draw(race, 7);
      }, { speed });
      await page.screenshot({ path: `docs/screenshots/driving-v2/${name}-${speed}.png` });
    }
  }
} finally {
  await browser.close();
}
