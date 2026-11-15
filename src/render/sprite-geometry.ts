import type {VehicleDimensions} from './vehicle-scale.ts';
import {context2d} from './sprite-canvas.ts';

export interface ContactSpan {readonly left: number; readonly right: number}
export interface SpritePlacement {
  readonly source: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly flipped: boolean;
  readonly contact: ContactSpan;
}

const contacts = new WeakMap<HTMLCanvasElement, ContactSpan>();

/** The lowest visible tire/underbody band anchors every pose to the same ground point. */
function contactSpan(source: HTMLCanvasElement): ContactSpan {
  const cached = contacts.get(source);
  if (cached) return cached;
  const pixels = context2d(source, true).getImageData(0, 0, source.width, source.height).data;
  let left = source.width, right = 0;
  for (let y = Math.floor(source.height * .88); y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (pixels[(y * source.width + x) * 4 + 3]! <= 80) continue;
      left = Math.min(left, x); right = Math.max(right, x + 1);
    }
  }
  const span = right > left ? {left: left / source.width, right: right / source.width} : {left: .1, right: .9};
  contacts.set(source, span);
  return span;
}

export function spritePlacement(source: HTMLCanvasElement, dimensions: VehicleDimensions, flipped: boolean): SpritePlacement {
  const contact = contactSpan(source);
  const height = dimensions.height;
  const width = height * source.width / source.height;
  return {source, width, height, left: -width * (contact.left + contact.right) / 2, flipped, contact};
}
