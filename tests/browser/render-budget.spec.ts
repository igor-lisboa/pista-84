import {expect, test} from '@playwright/test';
import {loadHarness} from './support/harness.ts';

test('batched road keeps every pixel while cutting canvas paint submissions', async ({page}, testInfo) => {
  await page.goto('/');
  await loadHarness(page);
  const reports = await page.evaluate(() => {
    const {RoadSurface, paintReferenceRoad} = window.Pista;
    return [0, 7, 680.35, 12000.8].map(path => {
      const contexts = [0, 1].map(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 960; canvas.height = 720;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        return ctx;
      });
      const before = contexts[0], after = contexts[1];
      if (!before || !after) throw new Error('Missing comparison context');
      const centerAt = (t: number): number => 480 + Math.sin(t * 3 + path) * t * 110;
      let originalCalls = 0, batchedCalls = 0;
      const fillRect = before.fillRect.bind(before);
      before.fillRect = (...args) => { originalCalls++; fillRect(...args); };
      const fill = after.fill.bind(after);
      after.fill = (shape?: Path2D | CanvasFillRule) => {
        batchedCalls++;
        if (shape instanceof Path2D) fill(shape); else fill(shape);
      };
      paintReferenceRoad(before, path, centerAt);
      new RoadSurface(960, 720, 198).paint(after, {path, centerAt, grassA: '#58a845', grassB: '#4d9a3d', asphalt: ['#50545f', '#484c57']});
      const a = before.getImageData(0, 0, 960, 720).data, b = after.getImageData(0, 0, 960, 720).data;
      return {path, originalCalls, batchedCalls, changedChannels: a.reduce((sum, value, i) => sum + Number(value !== b[i]), 0)};
    });
  });
  for (const report of reports) {
    expect(report.changedChannels, String(report.path)).toBe(0);
    expect(report.batchedCalls).toBeLessThan(report.originalCalls / 100);
  }
  await testInfo.attach('road-paint-submissions', {body: JSON.stringify(reports, null, 2), contentType: 'application/json'});
});
