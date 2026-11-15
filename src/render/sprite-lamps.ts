import {insideRegion, lampRegions, type LensRegion} from './sprite-materials.ts';

const originals = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
interface LampMasks { readonly brake: Uint8Array; readonly material: Uint8Array }
const masks = new WeakMap<HTMLCanvasElement, LampMasks>();
const footprints = new WeakMap<HTMLCanvasElement, readonly LensRegion[]>();
const RED_ONLY_LAMPS = new Set(['puma', 'maverick']);

/** Paint variants retain their factory material identity even when the body becomes red. */
export function registerLampSource(painted: HTMLCanvasElement, original: HTMLCanvasElement): void {
  originals.set(painted, original);
}

/** A source-resolution mask of the authored red lenses, independent of the selected paint. */
function sourceMasks(tile: HTMLCanvasElement, id: string, pose: number): LampMasks {
  const source = originals.get(tile) ?? tile;
  const cached = masks.get(source);
  if (cached) return cached;
  const ctx = source.getContext('2d', {willReadFrequently: true});
  if (!ctx) throw new Error('2D canvas unavailable');
  const pixels = ctx.getImageData(0, 0, source.width, source.height).data;
  const regions = lampRegions(id, pose);
  const brake = new Uint8Array(source.width * source.height), material = new Uint8Array(brake.length);
  for (let index = 0; index < brake.length; index++) {
    const i = index * 4, r = pixels[i] ?? 0, g = pixels[i + 1] ?? 0, b = pixels[i + 2] ?? 0;
    const x = (index % source.width) / source.width, y = Math.floor(index / source.width) / source.height;
    if ((pixels[i + 3] ?? 0) < 80) continue;
    const region = regions.find(value => insideRegion(x, y, value));
    if (!region) continue;
    // The GT's horizontal amber slats are distinct from the red body surrounding them.
    const lens = region.brake !== false && (id === 'gt' ? r > 85 && g > r * .28 && r > g * 1.15 && g > b * 1.5
      : r > 85 && r > g * 3 && r > b * 1.6);
    const amberFloor = region.brake === false ? .18 : .28;
    const indicator = !RED_ONLY_LAMPS.has(id) && r > 85 && g > r * amberFloor && r > g * 1.15 && g > b * 1.8;
    if (lens) brake[index] = 1;
    if (lens || indicator) material[index] = 1;
  }
  const result = {brake, material};
  masks.set(source, result);
  return result;
}

export function lampMask(tile: HTMLCanvasElement, id: string, pose: number): Uint8Array {
  return sourceMasks(tile, id, pose).brake;
}

/** Amber indicators keep their color as well, but do not light up when braking. */
export function lampMaterialMask(tile: HTMLCanvasElement, id: string, pose: number): Uint8Array {
  return sourceMasks(tile, id, pose).material;
}

/** Actual luminous bounds, used to place road reflections below the corresponding lenses. */
export function lampFootprints(tile: HTMLCanvasElement, id: string, pose: number): readonly LensRegion[] {
  const source = originals.get(tile) ?? tile;
  const cached = footprints.get(source);
  if (cached) return cached;
  const mask = lampMask(source, id, pose);
  const found: LensRegion[] = [];
  for (const region of lampRegions(id, pose)) {
    let minX = source.width, minY = source.height, maxX = -1, maxY = -1;
    for (let y = Math.max(0, Math.floor(region.y * source.height)); y < Math.min(source.height, Math.ceil((region.y + region.height) * source.height)); y++) {
      for (let x = Math.max(0, Math.floor(region.x * source.width)); x < Math.min(source.width, Math.ceil((region.x + region.width) * source.width)); x++) {
        if (!mask[y * source.width + x]) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    if (maxX >= minX) found.push({x: minX / source.width, y: minY / source.height,
      width: (maxX - minX + 1) / source.width, height: (maxY - minY + 1) / source.height});
  }
  footprints.set(source, found);
  return found;
}
