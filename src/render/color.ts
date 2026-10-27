const channel = (value: number): number => Math.min(255, Math.max(0, Math.round(value)));

const parse = (hex: string): [number, number, number] => {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};

const toHex = (rgb: readonly number[]): string => `#${rgb.map((v) => channel(v).toString(16).padStart(2, '0')).join('')}`;

/** Multiplies each channel: below 1 darkens, above 1 lightens. */
export const shade = (hex: string, factor: number): string => toHex(parse(hex).map((v) => v * factor));

/** Linear blend between two colours; `t` = 0 gives `a`, 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return toHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}
