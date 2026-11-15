import {expect, test} from '@playwright/test';
import {loadHarness} from './support/harness.ts';

const CAR_COUNT = 22;

test('the production atlas and the procedural sprites draw complete, unclipped vehicles', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const report = await page.evaluate(async () => {
    const { loadSprites, spritesReady, spriteDimensions, drawCar, CARS } = window.Pista;
    await loadSprites();
    const details = CARS.map((car) => {
      const { width, height } = spriteDimensions(car);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      drawCar(ctx, 128, 240, Math.min(210 / width, 210 / height), car);
      const pixels = ctx.getImageData(0, 0, 256, 256).data;
      let count = 0;
      let edge = 0;
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          if (pixels[(y * 256 + x) * 4 + 3]! > 80) {
            count++;
            if (x === 0 || y === 0 || x === 255 || y === 255) edge++;
          }
        }
      }
      return { id: car.id, count, edge };
    });
    return { ready: spritesReady(), details };
  });
  expect(report.ready).toBe(true);
  expect(report.details).toHaveLength(CAR_COUNT);
  for (const sprite of report.details) {
    expect(sprite.count, sprite.id).toBeGreaterThan(1000);
    expect(sprite.edge, sprite.id).toBe(0);
  }
});

test('every vehicle has complete, distinct straight, mild and strong turn sprites', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const result = await page.evaluate(async () => {
    const { loadSprites, drawCar, steeringPose, CARS } = window.Pista;
    await loadSprites();
    const reports = CARS.map((car) =>
      [0, 0.45, 1, -1].map((steer) => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 320;
        const ctx = canvas.getContext('2d')!;
        let drawCalls = 0;
        let rotations = 0;
        const draw = ctx.drawImage.bind(ctx);
        const rotate = ctx.rotate.bind(ctx);
        ctx.drawImage = (image: CanvasImageSource, ...coordinates: number[]): void => {
          drawCalls++;
          Reflect.apply(draw, ctx, [image, ...coordinates]);
        };
        ctx.rotate = (angle: number) => {
          rotations++;
          rotate(angle);
        };
        drawCar(ctx, 200, 290, 1, car, false, steer);
        const data = ctx.getImageData(0, 0, 400, 320).data;
        let pixels = 0;
        let clipped = 0;
        let left = 400;
        let right = 0;
        let top = 320;
        let bottom = 0;
        for (let y = 0; y < 320; y++) {
          for (let x = 0; x < 400; x++) {
            if (data[(y * 400 + x) * 4 + 3]! > 80) {
              pixels++;
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
              if (!x || !y || x === 399 || y === 319) clipped++;
            }
          }
        }
        // Compare cropped artwork so a sideways translation cannot pass as a turning pose.
        const crop = document.createElement('canvas');
        crop.width = right - left + 1;
        crop.height = bottom - top + 1;
        crop.getContext('2d')!.drawImage(canvas, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height);
        return { id: car.id, pixels, clipped, drawCalls, rotations, width: right - left, height: bottom - top, signature: crop.toDataURL() };
      }),
    );
    return { reports, poses: [0, 0.1, 0.45, 0.8, -1].map(steeringPose) };
  });

  expect(result.poses).toEqual([0, 0, 1, 2, 2]);
  for (const frames of result.reports) {
    const id = frames[0]!.id;
    for (const frame of frames) {
      expect(frame.pixels, id).toBeGreaterThan(700);
      expect(frame.clipped, id).toBe(0);
      expect(frame.drawCalls, id).toBe(1);
      expect(frame.rotations, id).toBe(0);
    }
    // Every vehicle has separate authored straight, mild and hard turn artwork.
    expect(new Set(frames.slice(0, 3).map((frame) => frame.signature)).size, id).toBe(3);
    expect(Math.abs(frames[2]!.width - frames[3]!.width), id).toBeLessThanOrEqual(2);
    expect(frames[2]!.height, id).toBe(frames[3]!.height);
  }
});

test('portrait, landscape and square preserve the complete gameplay camera on resize', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  await page.evaluate(async () => {
    await window.Pista.loadSprites();
  });
  const frames: string[] = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }, { width: 720, height: 720 }]) {
    await page.setViewportSize(viewport);
    const frame = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain';
      document.body.append(canvas);
      const renderer = new window.Pista.Renderer(canvas);
      const race = new window.Pista.Race(undefined, () => 0.25, () => new Date('2026-11-14T15:00:00Z'));
      race.start();
      race.speed = 150;
      race.path = 700;
      renderer.draw(race, 1);
      renderer.resize();
      renderer.draw(race, 1);
      const report = { width: canvas.width, height: canvas.height, fit: getComputedStyle(canvas).objectFit, pixels: canvas.toDataURL() };
      canvas.remove();
      return report;
    });
    expect([frame.width, frame.height]).toEqual([960, 720]);
    expect(frame.fit).toBe('contain');
    frames.push(frame.pixels);
  }
  expect(new Set(frames).size).toBe(1);
});

test('the road renders four lane dividers and five lanes using the race seed', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const result = await page.evaluate(async () => {
    const { Renderer, Race, CALM_CONDITIONS, CARS, LANES, PLAYER_T, PATH_UNIT, laneCenter, screenToDepth, loadSprites } = window.Pista;
    await loadSprites();
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:960px;height:720px';
    document.body.replaceChildren(canvas);
    const race = new Race();
    race.start();
    race.conditions = CALM_CONDITIONS;
    race.roadSeed = 1;
    race.entities = LANES.map((lane) => ({
      type: 'traffic' as const,
      lane,
      targetLane: lane,
      z: 0.2,
      speed: 0,
      cruise: 0.5,
      car: CARS[0]!,
      timer: 1e9,
      cooldown: 0,
      passed: false,
    }));
    const renderer = new Renderer(canvas);
    const y = 644;
    const horizon = Math.round(canvas.height * 0.275);
    // Sample in the middle of a painted dash (3 m paint on a 6 m cycle), independent of camera depth.
    race.path = (6 - ((screenToDepth((y - horizon) / (canvas.height - horizon)) * PATH_UNIT) % 6)) % 6 + 1.5;
    renderer.draw(race, 0, {});
    const pixels = canvas.getContext('2d')!.getImageData(80, y, 800, 1).data;
    let lines = 0;
    let inLine = false;
    for (let i = 0; i < pixels.length; i += 4) {
      const x = 80 + i / 4;
      const white = (x < 420 || x > 540) && pixels[i]! > 150 && pixels[i + 1]! > 150 && pixels[i + 2]! > 130 && pixels[i]! > pixels[i + 2]!;
      if (white && !inLine) lines++;
      inLine = white;
    }
    return { lines, lanes: LANES.map((lane) => laneCenter(lane)), playerT: PLAYER_T };
  });
  expect(result.lines).toBe(4);
  expect(result.lanes).toHaveLength(5);
});
