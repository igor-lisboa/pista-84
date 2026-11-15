/** Normalized regions on the alpha-cropped authored poses, never on atlas cells. */
export interface LensRegion { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
type PoseCenters = readonly [readonly number[], readonly number[], readonly number[]];
interface Lamps { readonly y: number; readonly height: number; readonly width: number | readonly [number, number, number]; readonly centers: PoseCenters }
const PAIR: PoseCenters = [[.12, .88], [.08, .65], [.07, .57]];
const BIKES = new Set(['moto', 'superbike', 'cg125', 'biz125', 'hayabusa', 'harley']);
const LAMPS: Readonly<Record<string, Lamps>> = {
  fusca: {y: .64, height: .15, width: [.10, .08, .08], centers: [[.161, .845], [.089, .589], [.079, .552]]},
  brasilia: {y: .57, height: .18, width: .13, centers: PAIR},
  gol: {y: .58, height: .15, width: .19, centers: PAIR},
  palio: {y: .55, height: .15, width: [.18, .15, .15], centers: [[.15, .85], [.105, .63], [.09, .565]]},
  suv: {y: .55, height: .15, width: .14, centers: PAIR},
  kombi: {y: .67, height: .15, width: .1, centers: PAIR},
  uno: {y: .55, height: .18, width: .12, centers: PAIR},
  'uno-normal': {y: .55, height: .18, width: .12, centers: PAIR},
  chevette: {y: .56, height: .16, width: .2, centers: PAIR},
  opala: {y: .55, height: .14, width: .23, centers: [[.18, .82], [.12, .64], [.11, .56]]},
  maverick: {y: .5, height: .15, width: .1, centers: [[.13, .24, .76, .87], [.09, .18, .58, .67], [.08, .16, .49, .57]]},
  fiat147: {y: .55, height: .16, width: .1, centers: [[.10, .90], [.055, .64], [.065, .55]]},
  marea: {y: .48, height: .16, width: .23, centers: PAIR},
  passat: {y: .565, height: .12, width: [.22, .15, .14], centers: [[.14, .86], [.075, .61], [.075, .53]]},
  puma: {y: .55, height: .15, width: .07, centers: [[.128, .217, .785, .872], [.065, .132, .508, .577], [.061, .125, .471, .538]]},
  gt: {y: .64, height: .14, width: .22, centers: [[.13, .87], [.11, .65], [.1, .58]]},
  moto: {y: .44, height: .1, width: .23, centers: [[.5], [.25], [.22]]},
  superbike: {y: .41, height: .1, width: .24, centers: [[.5], [.25], [.22]]},
  cg125: {y: .49, height: .09, width: .2, centers: [[.5], [.24], [.22]]},
  biz125: {y: .50, height: .1, width: .26, centers: [[.5], [.22], [.25]]},
  hayabusa: {y: .44, height: .1, width: .34, centers: [[.5], [.29], [.26]]},
  harley: {y: .61, height: .1, width: .22, centers: [[.5], [.33], [.26]]},
};

export function lampRegions(id: string, pose: number): readonly LensRegion[] {
  const lamps = LAMPS[id];
  if (!lamps) return [];
  const centers = lamps.centers[pose] ?? lamps.centers[0];
  const width = typeof lamps.width === 'number' ? lamps.width : lamps.width[pose] ?? lamps.width[0];
  return centers.map(x => ({x: x - width / 2, y: lamps.y, width, height: lamps.height}));
}

export function insideRegion(x: number, y: number, region: LensRegion): boolean {
  return x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height;
}

export function insideLenses(x: number, y: number, regions: readonly LensRegion[]): boolean {
  for (const region of regions) if (insideRegion(x, y, region)) return true;
  return false;
}

/** Body hue alone cannot distinguish a red lens, blue rubber reflection or silver rim. */
export function protectedMaterial(id: string, pose: number, x: number, y: number, r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  // All rubber/underbody shades and neutral metallic trim keep their authored color.
  if ((max < 25 && max - min < 12) || (max - min < 24 && y > .75)) return true;
  const wheelArea = pose === 0 ? y > .76 && (x < .25 || x > .75)
    : (y > .75 && x > .72) || (y > .76 && (x < .16 || x > .45)) || (y > .55 && x > .92);
  if (wheelArea && max - min < 75) return true;
  if (y > .88) return true;
  if (BIKES.has(id)) {
    if (y < .35 || (id !== 'harley' && y > .79)) return true;
    if (id !== 'harley' && y > .62 && max < 115 && max - min < 75) return true;
  }
  if (id === 'moto' || id === 'superbike' || id === 'cg125') {
    if (y < .43) return true;
    // Rider legs flank the straight tail and cross the visible right side on bends.
    if (y < .72 && (pose === 0 ? x < .34 || x > .66 : x > .38)) return true;
  }
  // Blue-grey glass, including mirrors, is a material rather than body paint.
  if (b > r * 1.1 && b > g && max - min < 85 && y < .55) return true;
  return false;
}
