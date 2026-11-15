import {insideRegion, type SpriteRegion} from './sprite-materials.ts';

type Regions = readonly [readonly SpriteRegion[], readonly SpriteRegion[], readonly SpriteRegion[]];
const region = (x: number, y: number, width: number, height: number): SpriteRegion => ({x, y, width, height});
const UNO_PLATES: Regions = [
  [region(.36, .55, .28, .11)], [region(.23, .54, .24, .11)], [region(.20, .54, .21, .10)],
];
const PLATES: Readonly<Record<string, Regions>> = {
  uno: [[region(.37, .63, .26, .10)], [region(.23, .63, .22, .09)], [region(.20, .63, .21, .09)]],
  'uno-normal': UNO_PLATES,
  moto: [[region(.36, .55, .28, .09)], [region(.16, .55, .19, .10)], [region(.16, .54, .18, .10)]],
  superbike: [[region(.38, .53, .25, .08)], [region(.16, .51, .19, .10)], [region(.16, .50, .19, .10)]],
  cg125: [[region(.40, .58, .20, .10)], [region(.12, .54, .20, .12)], [region(.13, .53, .20, .12)]],
};
const NEUTRAL_PANELS: Readonly<Record<string, Regions>> = {
  moto: [
    [region(.26, .44, .48, .14)],
    [region(.10, .44, .45, .15), region(.55, .35, .18, .10)],
    [region(.10, .43, .45, .16), region(.55, .35, .18, .10)],
  ],
};
const COLORED_PANELS: Readonly<Record<string, Regions>> = {
  cg125: [[region(.28, .27, .44, .20)], [region(.06, .21, .50, .25)], [region(.06, .19, .50, .25)]],
  superbike: [[region(.15, .37, .70, .14)], [region(.06, .36, .51, .15)], [region(.06, .35, .51, .15)]],
};
type Wheel = readonly [x: number, y: number, radiusX: number, radiusY: number];
const UNO_WHEELS: readonly (readonly Wheel[])[] = [
  [[.12, .87, .08, .13], [.88, .87, .08, .13]],
  [[.715, .815, .065, .16], [.955, .645, .045, .15]],
  [[.65, .81, .065, .17], [.925, .62, .045, .15]],
];

/** Visible wheel ellipses on the cropped Uno poses; body eligibility cannot override rubber/rims. */
export function wheelMaterial(id: string, pose: number, x: number, y: number): boolean {
  if (id !== 'uno' && id !== 'uno-normal') return false;
  const ladder = id === 'uno';
  for (const [cx, cy, rx, ry] of UNO_WHEELS[pose] ?? []) {
    const centerY = ladder ? .17 + cy * .83 : cy;
    const radiusY = ladder ? ry * .83 : ry;
    if (((x - cx) / rx) ** 2 + ((y - centerY) / radiusY) ** 2 <= 1) return true;
  }
  return false;
}

function contains(regions: Readonly<Record<string, Regions>>, id: string, pose: number, x: number, y: number): boolean {
  for (const value of regions[id]?.[pose] ?? []) if (insideRegion(x, y, value)) return true;
  return false;
}

/** Only neutral source pixels inside a plate housing are protected; adjacent paint stays eligible. */
export function plateMaterial(id: string, pose: number, x: number, y: number, chroma: number): boolean {
  return chroma < .30 && contains(PLATES, id, pose, x, y);
}

export function neutralBodyPanel(id: string, pose: number, x: number, y: number, chroma: number, lightness: number): boolean {
  if (chroma >= .20 || lightness <= .35) return false;
  if (id === 'uno') return y > .23 && y < .78;
  if (id === 'uno-normal') return y < .78;
  return contains(NEUTRAL_PANELS, id, pose, x, y);
}

/** Reviewed painted panels may share the rider's bounding box, but never the rider's material. */
export function coloredBodyPanel(id: string, pose: number, x: number, y: number): boolean {
  return contains(COLORED_PANELS, id, pose, x, y);
}
