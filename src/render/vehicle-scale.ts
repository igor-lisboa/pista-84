import type {CarLook} from '../game/cars.ts';
import {vehicleTuning} from '../game/vehicle-tuning.ts';

export interface VehicleDimensions { readonly width: number; readonly height: number }

/** Logical heights keep the riders at one human scale; source aspect retains each bike's width. */
const AUTHORED_BIKE_HEIGHT: Readonly<Record<string, number>> = {
  moto: 104, superbike: 100, cg125: 90, biz125: 104, hayabusa: 104, harley: 135,
};

export function vehicleDimensions(car: CarLook, aspect: number, authored: boolean): VehicleDimensions {
  const safeAspect = Math.max(0.1, aspect);
  const bikeHeight = authored ? AUTHORED_BIKE_HEIGHT[car.id] : undefined;
  if (bikeHeight) return {width: bikeHeight * safeAspect, height: bikeHeight};
  const width = 112 * vehicleTuning(car).width;
  return {width, height: width / safeAspect};
}
