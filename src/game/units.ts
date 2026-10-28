/** Distance unit the player reads; the simulation itself always works in metres and km/h. */
export type DistanceUnit = 'km' | 'mi';

const METRES_PER_MILE = 1609.344;
const KMH_PER_MPH = 1.609344;

export const metresToUnit = (metres: number, unit: DistanceUnit): number =>
  unit === 'mi' ? metres / METRES_PER_MILE : metres / 1000;

export const kmhToUnit = (kmh: number, unit: DistanceUnit): number => (unit === 'mi' ? kmh / KMH_PER_MPH : kmh);
