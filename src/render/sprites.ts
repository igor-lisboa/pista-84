import type {CarLook} from '../game/cars.ts';
import {factoryTile, paintedTile, type SteeringPose} from './sprite-atlas.ts';
import {brakeTile} from './sprite-brakes.ts';
import {fallbackSprite} from './fallback-vehicles.ts';
import {vehicleDimensions} from './vehicle-scale.ts';
import {spritePlacement, type SpritePlacement} from './sprite-geometry.ts';
export {loadSprites, spritesReady, paintedTile} from './sprite-atlas.ts';

type Ctx = CanvasRenderingContext2D;
const SPRITE_WIDTH = 128;
const SPRITE_HEIGHT = 80;

/** 0 = straight rear view, 1 = gentle lean, 2 = hard lean. */
export function steeringPose(steer: number): SteeringPose {
  const amount = Math.abs(steer);
  if (amount < 0.18) return 0;
  return amount < 0.7 ? 1 : 2;
}

export interface SpriteDimensions {
  readonly width: number;
  readonly height: number;
}

/** Logical size of a car sprite in sprite pixels; ids without an atlas tile use the procedural size. */
export function spriteDimensions(car: CarLook): SpriteDimensions {
  const tile = factoryTile(car.id);
  return vehicleDimensions(car, tile ? tile.width / tile.height : SPRITE_WIDTH / SPRITE_HEIGHT, !!tile);
}

export function carPlacement(car: CarLook, turn = 0): SpritePlacement {
  const pose = steeringPose(turn);
  const tile = factoryTile(car.id, pose);
  const source = tile ?? fallbackSprite(car, false, Math.sign(turn) * pose);
  return spritePlacement(source, spriteDimensions(car), !!tile && pose > 0 && turn < 0);
}

export function drawCar(ctx: Ctx, x: number, y: number, scale: number, car: CarLook, brake = false, turn = 0): void {
  const placement = carPlacement(car, turn);
  const pose = steeringPose(turn);
  const tile = paintedTile(car, pose);
  const image = tile ? (brake ? brakeTile(tile, car.id, pose) : tile) : fallbackSprite(car, brake, Math.sign(turn) * pose);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (placement.flipped) ctx.scale(-1, 1);
  ctx.drawImage(image, Math.round(placement.left * scale), Math.round(-placement.height * scale),
    Math.round(placement.width * scale), Math.round(placement.height * scale));
  ctx.restore();
}
