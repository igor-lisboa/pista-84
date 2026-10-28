import { kmhToUnit, metresToUnit, type DistanceUnit } from '../game/index.ts';
import { getLang, t } from '../i18n/index.ts';

let current: DistanceUnit = 'km';

export const setUnits = (unit: DistanceUnit): void => {
  current = unit;
};

export const getUnits = (): DistanceUnit => current;

/** Distance in the chosen unit, without the unit label. */
export const formatDistance = (metres: number, digits = 2): string =>
  metresToUnit(metres, current).toLocaleString(getLang(), { minimumFractionDigits: digits, maximumFractionDigits: 2 });

export const distanceUnit = (): string => t(current === 'mi' ? 'unit.mi' : 'unit.km');

/** A km/h speed expressed in the chosen unit, rounded for display. */
export const speedValue = (kmh: number): number => Math.round(kmhToUnit(kmh, current));

export const speedUnit = (): string => t(current === 'mi' ? 'unit.mph' : 'hud.speedUnit');
