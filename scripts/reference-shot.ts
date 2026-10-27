// A deterministic in-engine composition for reviewing the supplied art direction.
// The game ships as one bundle, so the scene is bundled on the fly and injected into the page.
import {chromium} from '@playwright/test';
import {build} from 'esbuild';

const BASE_URL = 'http://127.0.0.1:4173';
const OUTPUT = 'docs/screenshots/reference-scene.png';
const VIEWPORT = {width: 760, height: 744};

/** Browser-side entry: composes a fixed scene and draws a single frame. */
const SCENE_SOURCE = `
  import {Renderer} from './src/render/renderer.ts';
  import {loadSprites} from './src/render/sprites.ts';
  import {Race, CARS} from './src/game/index.ts';

  function traffic(lane, z, car) {
    return {type: 'traffic', lane, targetLane: lane, z, speed: 0, cruise: 0.5, car, timer: 0, cooldown: 0, passed: false};
  }

  async function drawReferenceScene() {
    await loadSprites();
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100vw;height:100vh;image-rendering:pixelated;display:block';
    document.body.replaceChildren(canvas);
    const race = new Race(CARS.find((car) => car.id === 'gt'));
    race.status = 'running';
    race.distance = 0;
    race.entities = [
      traffic(-1, 0.34, {...CARS[5], color: '#e9c14a'}),
      traffic(1, 0.25, CARS[0]),
      traffic(1, 0.57, CARS[2]),
      traffic(-1, 0.86, {...CARS[3], color: '#d14c4d'}),
    ];
    new Renderer(canvas).draw(race, 0, {});
  }

  window.drawReferenceScene = drawReferenceScene;
`;

async function bundleScene(): Promise<string> {
  const result = await build({
    stdin: {contents: SCENE_SOURCE, resolveDir: process.cwd(), loader: 'ts'},
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
  });
  return result.outputFiles[0]!.text;
}

const browser = await chromium.launch();
const page = await browser.newPage({viewport: VIEWPORT, locale: 'pt-BR'});
await page.goto(BASE_URL);
await page.addScriptTag({content: await bundleScene()});
await page.evaluate(() => (window as unknown as {drawReferenceScene(): Promise<void>}).drawReferenceScene());
await page.screenshot({path: OUTPUT});
await browser.close();
