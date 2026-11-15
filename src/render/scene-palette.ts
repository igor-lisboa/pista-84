import type {LightName} from '../game/index.ts';

export interface Palette {
  readonly skyTop: string;
  readonly haze: string;
  readonly farRidge: string;
  readonly nearRidge: string;
  readonly grassA: string;
  readonly grassB: string;
  readonly sun: string;
}

export const PALETTES: Readonly<Record<LightName, Palette>> = {
  day: {
    skyTop: '#2f7fd0',
    haze: '#c4e6f4',
    farRidge: '#8fb2d0',
    nearRidge: '#6e9aa8',
    grassA: '#58a845',
    grassB: '#4d9a3d',
    sun: '#fff0a8',
  },
  sunset: {
    skyTop: '#3f3a86',
    haze: '#ff9a5c',
    farRidge: '#9a6c9c',
    nearRidge: '#6e5280',
    grassA: '#527f3c',
    grassB: '#487234',
    sun: '#ffd070',
  },
  night: {
    skyTop: '#080e2c',
    haze: '#2b386c',
    farRidge: '#2a3760',
    nearRidge: '#1d2849',
    grassA: '#1f4632',
    grassB: '#1a3b2b',
    sun: '#e4ecff',
  },
  dawn: {
    skyTop: '#5f64b0',
    haze: '#ffb7a0',
    farRidge: '#a58ab2',
    nearRidge: '#7a749c',
    grassA: '#5e8c47',
    grassB: '#53803f',
    sun: '#ffe2a2',
  },
};

const parseHex = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Linear blend of two `#rrggbb` colours. */
export function blendColor(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  const channels = x.map((v, i) =>
    Math.round(v + (y[i]! - v) * t)
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${channels.join('')}`;
}

export function blendPalette(from: Palette, to: Palette, mix: number): Palette {
  return {
    skyTop: blendColor(from.skyTop, to.skyTop, mix),
    haze: blendColor(from.haze, to.haze, mix),
    farRidge: blendColor(from.farRidge, to.farRidge, mix),
    nearRidge: blendColor(from.nearRidge, to.nearRidge, mix),
    grassA: blendColor(from.grassA, to.grassA, mix),
    grassB: blendColor(from.grassB, to.grassB, mix),
    sun: blendColor(from.sun, to.sun, mix),
  };
}
