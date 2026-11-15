/** Atlas regions are fractions of the complete source image. */
export type Region = readonly [number, number, number, number];
const TURN_SHEET_SIZE = 1254;

const ATLAS_REGIONS: Readonly<Record<string, Region>> = {
  fusca: [0, 0.15, 0.25, 0.34],
  brasilia: [0.25, 0.15, 0.25, 0.34],
  gol: [0.5, 0.15, 0.25, 0.34],
  palio: [0.75, 0.15, 0.25, 0.34],
  moto: [0, 0.54, 0.2, 0.36],
  gt: [0.215, 0.54, 0.29, 0.36],
  suv: [0.515, 0.54, 0.245, 0.36],
  superbike: [0.79, 0.54, 0.21, 0.36],
};

/** Turn sheet layout: [ids, top, bottom, column cuts]; each row holds two cars with two poses. */
const TURN_ROWS: readonly (readonly [readonly [string, string], number, number, readonly number[]])[] = [
  [['fusca', 'brasilia'], 0, 350, [0, 312, 627, 932, 1254]],
  [['gol', 'palio'], 350, 630, [0, 315, 628, 932, 1254]],
  [['moto', 'gt'], 630, 930, [0, 295, 580, 927, 1254]],
  [['suv', 'superbike'], 930, 1254, [0, 318, 660, 930, 1254]],
];

/** Cell gutters follow the authored sheet; each crop includes the complete body. */
function buildTurnRegions(): Record<string, Region> {
  const regions: Record<string, Region> = {};
  for (const [ids, top, bottom, cuts] of TURN_ROWS) {
    for (let i = 0; i < 4; i++) {
      const id = ids[Math.floor(i / 2)]!;
      regions[`${id}:${(i % 2) + 1}`] = [
        cuts[i]! / TURN_SHEET_SIZE,
        top / TURN_SHEET_SIZE,
        (cuts[i + 1]! - cuts[i]!) / TURN_SHEET_SIZE,
        (bottom - top) / TURN_SHEET_SIZE,
      ];
    }
  }
  return regions;
}

const TURN_REGIONS = buildTurnRegions();

// Authored gutters, not equal slices: roofs, ladders and tyres remain inside each crop.
const CLASSIC_IDS = ['kombi', 'uno', 'chevette', 'cg125', 'opala', 'maverick'] as const;
const CLASSIC_ROWS = [
  [0, 284, 548, 770, 1036, 1280, 1536],
  [0, 284, 548, 770, 1036, 1280, 1536],
  [0, 284, 548, 772, 1036, 1280, 1536],
] as const;
const CLASSIC_COLUMNS = [0, 320, 662, 1024] as const;
const CLASSIC_REGIONS: Record<string, Region> = {};
for (let row = 0; row < CLASSIC_IDS.length; row++) {
  for (let pose = 0; pose < 3; pose++) {
    const rows = CLASSIC_ROWS[pose]!;
    CLASSIC_REGIONS[`${CLASSIC_IDS[row]}:${pose}`] = [
      CLASSIC_COLUMNS[pose]! / 1024,
      rows[row]! / 1536,
      (CLASSIC_COLUMNS[pose + 1]! - CLASSIC_COLUMNS[pose]!) / 1024,
      (rows[row + 1]! - rows[row]!) / 1536,
    ];
  }
}

// Actual transparent gutters between the authored columns, rather than equal slices.
const BRAZILIAN_IDS = ['fiat147', 'marea', 'passat', 'puma'] as const;
const BRAZILIAN_COLUMNS = [0, 320, 675, 1024] as const;
const BRAZILIAN_REGIONS: Record<string, Region> = {};
for (let row = 0; row < BRAZILIAN_IDS.length; row++) {
  for (let pose = 0; pose < 3; pose++) {
    BRAZILIAN_REGIONS[`${BRAZILIAN_IDS[row]}:${pose}`] = [
      BRAZILIAN_COLUMNS[pose]! / 1024,
      row / 4,
      (BRAZILIAN_COLUMNS[pose + 1]! - BRAZILIAN_COLUMNS[pose]!) / 1024,
      1 / 4,
    ];
  }
}

export interface AtlasSheet {
  readonly url: string;
  readonly regions: Readonly<Record<string, Region>>;
  readonly layout: 'straight' | 'turn' | 'poses';
}

/** Model additions register artwork here; the loader has no model-specific branches. */
export function vehicleAtlases(
  url = './assets/vehicle-atlas-v1.png',
  turnUrl = './assets/vehicle-turns-v2.png',
  classicsUrl = './assets/vehicle-classics-v2.png',
  brazilianUrl = './assets/vehicle-brazilian-v1.png',
): readonly AtlasSheet[] {
  return [
    {url, regions: ATLAS_REGIONS, layout: 'straight'},
    {url: turnUrl, regions: TURN_REGIONS, layout: 'turn'},
    {url: classicsUrl, regions: CLASSIC_REGIONS, layout: 'poses'},
    {url: brazilianUrl, regions: BRAZILIAN_REGIONS, layout: 'poses'},
    {url: './assets/vehicle-uno-v1.png', layout: 'poses', regions: {
      'uno-normal:0': [0, 0, 1 / 3, 1], 'uno-normal:1': [1 / 3, 0, 1 / 3, 1], 'uno-normal:2': [2 / 3, 0, 1 / 3, 1],
    }},
    {url: './assets/vehicle-motorcycles-v1.png', layout: 'poses', regions: {
      'biz125:0': [0, 0, 1 / 3, .5], 'biz125:1': [1 / 3, 0, 1 / 3, .5], 'biz125:2': [2 / 3, 0, 1 / 3, .5],
      'hayabusa:0': [0, .5, 1 / 3, .5], 'hayabusa:1': [1 / 3, .5, 1 / 3, .5], 'hayabusa:2': [2 / 3, .5, 1 / 3, .5],
    }},
    {url: './assets/vehicle-harley-v2.png', layout: 'poses', regions: {
      'harley:0': [0, 0, 470 / 1536, 1],
      'harley:1': [470 / 1536, 0, 490 / 1536, 1],
      'harley:2': [960 / 1536, 0, 576 / 1536, 1],
    }},
  ];
}
