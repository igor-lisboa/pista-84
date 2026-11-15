import type {CarLook} from '../game/cars.ts';
import {carPlacement, steeringPose} from './sprites.ts';
import {reflectionTile} from './sprite-reflections.ts';

/** Contact shadows and road reflections share the sprite's pose, mirror and footprint. */
export function paintVehicleGround(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number,
  car: CarLook, turn: number, night: number, rain: number, brake = false): void {
  const p = carPlacement(car, turn);
  const footprint = (p.contact.right - p.contact.left) * p.width * scale;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = '#10162555';
  ctx.beginPath();
  ctx.ellipse(0, -scale, Math.max(2, footprint * .52), Math.max(1, p.height * scale * .035), 0, 0, Math.PI * 2);
  ctx.fill();
  if (p.flipped) ctx.scale(-1, 1);
  if (night > .05) {
    ctx.globalAlpha = night * (.035 + rain * .17) * (brake ? 1.4 : 1);
    const tile = reflectionTile(p.source, car.id, steeringPose(turn));
    ctx.drawImage(tile, Math.round(p.left * scale), 0, Math.round(p.width * scale),
      Math.max(1, Math.round(p.height * scale * (.08 + rain * .19))));
  }
  ctx.restore();
}

/** Headlight spill fades into the road and follows the visible front of a turning vehicle. */
export function paintVehicleHeadlights(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number,
  car: CarLook, turn: number, night: number): void {
  if (night <= .1) return;
  const p = carPlacement(car, turn);
  const direction = turn < 0 ? -1 : 1;
  const bend = steeringPose(turn) * .3 * direction;
  const span = (p.contact.right - p.contact.left) * p.width * scale;
  const startY = -p.height * scale * .42;
  const endY = startY - Math.max(p.height, p.width) * scale * 1.2;
  const startX = bend * span * .4;
  const endX = bend * span * 1.3;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y));
  const gradient = ctx.createLinearGradient(0, startY, 0, endY);
  gradient.addColorStop(0, `rgba(244,230,185,${night * .13})`);
  gradient.addColorStop(.65, `rgba(244,230,185,${night * .045})`);
  gradient.addColorStop(1, 'rgba(244,230,185,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(startX - span * .28, startY); ctx.lineTo(startX + span * .28, startY);
  ctx.lineTo(endX + span * .85, endY); ctx.lineTo(endX - span * .85, endY);
  ctx.closePath(); ctx.fill(); ctx.restore();
}
