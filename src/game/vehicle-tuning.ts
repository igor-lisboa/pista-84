import type { CarLook, CarSpec } from './cars.ts';

export interface VehicleTuning {
  /** Visual width relative to a compact car; sprite scaling remains uniform. */
  width: number;
  /** Converts the catalog acceleration rating to low-speed km/h gained per second. */
  accelerationGain: number;
  /** Extra loss of pull above 70% of maximum speed; higher fades more strongly. */
  accelerationFalloff: number;
  /** Dry-road braking deceleration in km/h per second. */
  braking: number;
  /** Tonal squeal mix; GT brakes use rolling friction rather than a piercing whistle. */
  squeal: number;
}

export const VEHICLE_TUNING: Readonly<Record<string, VehicleTuning>> = {
  fusca: { accelerationGain: 0.24, accelerationFalloff: 1.8, width: 0.9, braking: 34, squeal: 0.5 },
  brasilia: { accelerationGain: 0.24, accelerationFalloff: 1.6, width: 1.02, braking: 36, squeal: 0.45 },
  gol: { accelerationGain: 0.26, accelerationFalloff: 1.1, width: 0.98, braking: 46, squeal: 0.3 },
  palio: { accelerationGain: 0.25, accelerationFalloff: 1.2, width: 0.98, braking: 44, squeal: 0.25 },
  moto: { accelerationGain: 0.27, accelerationFalloff: 1.35, width: 0.56, braking: 48, squeal: 0.2 },
  suv: { accelerationGain: 0.26, accelerationFalloff: 1.5, width: 1.1, braking: 39, squeal: 0.3 },
  kombi: { accelerationGain: 0.23, accelerationFalloff: 2.4, width: 1.3, braking: 29, squeal: 0.55 },
  uno: { accelerationGain: 0.26, accelerationFalloff: 1.4, width: 0.94, braking: 38, squeal: 0.45 },
  chevette: { accelerationGain: 0.245, accelerationFalloff: 1.5, width: 1.03, braking: 35, squeal: 0.5 },
  cg125: { accelerationGain: 0.28, accelerationFalloff: 2, width: 0.52, braking: 42, squeal: 0.2 },
  opala: { accelerationGain: 0.27, accelerationFalloff: 1, width: 1.16, braking: 41, squeal: 0.4 },
  maverick: { accelerationGain: 0.285, accelerationFalloff: 0.85, width: 1.2, braking: 45, squeal: 0.35 },
  fiat147: { accelerationGain: 0.235, accelerationFalloff: 1.8, width: 0.88, braking: 34, squeal: 0.45 },
  marea: { accelerationGain: 0.29, accelerationFalloff: 0.8, width: 1.02, braking: 53, squeal: 0.25 },
  passat: { accelerationGain: 0.275, accelerationFalloff: 1.3, width: 0.94, braking: 40, squeal: 0.4 },
  puma: { accelerationGain: 0.285, accelerationFalloff: 1, width: 0.95, braking: 43, squeal: 0.3 },
  gt: { accelerationGain: 0.3, accelerationFalloff: 0.6, width: 1.18, braking: 70, squeal: 0 },
  superbike: { accelerationGain: 0.31, accelerationFalloff: 0.7, width: 0.6, braking: 64, squeal: 0.1 },
};

export const vehicleTuning = (car: CarLook): VehicleTuning =>
  VEHICLE_TUNING[car.id] ?? { accelerationGain: 0.25, accelerationFalloff: 1.4, width: car.shape === 'bike' ? 0.5 : 1, braking: 40, squeal: 0.3 };

/** Continuous pull curve: ordinary drag throughout, with extra fade above 70%. */
export function vehicleAcceleration(car: CarSpec, speed: number): number {
  const tuning = vehicleTuning(car);
  const ratio = Math.max(0, Math.min(1, speed / car.max));
  const highSpeedProgress = Math.max(0, (ratio - 0.7) / 0.3);
  const taper = 1 / (1 + tuning.accelerationFalloff * highSpeedProgress ** 2);
  return car.accel * tuning.accelerationGain * (1 - ratio ** 2) * taper;
}
