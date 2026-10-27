import { clamp } from './math.ts';

/** Average speed (km/h) of a kilometre that pays exactly one point per metre. */
export const PAR_SPEED = 100;
const MIN_MULTIPLIER = 0.2;
const MAX_MULTIPLIER = 3.5;

/**
 * Score pays per metre, scaled by the average speed of the kilometre being
 * driven: par is x1, a crawl pays a fraction and a flat-out kilometre up to x3.5.
 */
export function paceMultiplier(metres: number, seconds: number): number {
  if (seconds <= 0) return MIN_MULTIPLIER;
  const averageKmh = (metres / seconds) * 3.6;
  return clamp(averageKmh / PAR_SPEED, MIN_MULTIPLIER, MAX_MULTIPLIER);
}
