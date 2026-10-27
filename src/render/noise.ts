/** Deterministic pseudo-random value in [0, 1) derived from a number; stable across frames. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
