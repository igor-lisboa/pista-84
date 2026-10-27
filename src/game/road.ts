import { clamp } from './math.ts';

// Stateless, seeded road generation: any distance can be sampled in any order.
// Each section reserves straight road around a smooth bend, so no stored segment
// list grows during an endless run and there is no repeating track table.
const ROAD_SECTION = 1600;
const FIRST_SECTION_STRAIGHT = 420;
const STRAIGHT_PROBABILITY = 0.18;
const LEFT_BEND_THRESHOLD = 0.59;
/** Peak curvature scale; `roadBend` divides it back out to -1..1. */
export const MAX_CURVE = 120;

function roadRandom(section: number, seed: number, salt: number): number {
  let n = (Math.imul(section, 0x9e3779b1) ^ seed ^ Math.imul(salt, 0x85ebca6b)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Quintic smoothstep: zero first and second derivatives at both ends. */
const smootherstep = (v: number): number => {
  const u = clamp(v, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};

export function roadCurve(distance: number, seed = 0): number {
  const d = Math.max(0, distance);
  const section = Math.floor(d / ROAD_SECTION);
  const at = d - section * ROAD_SECTION;
  const random = (salt: number): number => roadRandom(section, seed, salt);

  const kind = random(1);
  if (kind < STRAIGHT_PROBABILITY) return 0;

  const straight = section === 0 ? FIRST_SECTION_STRAIGHT : 240 + random(2) * 260;
  const entry = 180 + random(3) * 60;
  const hold = 200 + random(4) * 160;
  const exit = 180 + random(5) * 60;
  const direction = kind < LEFT_BEND_THRESHOLD ? -1 : 1;
  const bend = direction * (0.32 + random(6) * 0.32) * MAX_CURVE;

  const t = at - straight;
  if (t <= 0 || t >= entry + hold + exit) return 0;
  // Zero derivatives at the joins avoid a sudden change in cornering load as a
  // straight becomes a bend or a bend straightens out.
  return bend * smootherstep(t / entry) * (1 - smootherstep((t - entry - hold) / exit));
}

export const roadBend = (distance: number, seed = 0): number => roadCurve(distance, seed) / MAX_CURVE;

// ---- Lane and camera geometry shared by the simulation, the renderer and the scenery ----

/** Normalised x of the barrier and of the grass shoulder. */
export const WALL = 1.35;
export const EDGE = 0.96;
/** Distance between checkpoints, in metres. */
export const CHECKPOINT = 1000;
/** Metres represented by the visible road. */
export const PATH_UNIT = 240;

export const LANE_COUNT = 5;
export const LANE_WIDTH = 1.86 / LANE_COUNT;
export const VEHICLE_SCALE = 3 / LANE_COUNT;
export const LANES: readonly number[] = Object.freeze(
  Array.from({ length: LANE_COUNT }, (_, i) => i - (LANE_COUNT - 1) / 2),
);
export const FIRST_LANE = LANES[0]!;
export const LAST_LANE = LANES[LANE_COUNT - 1]!;
export const laneCenter = (lane: number): number => lane * LANE_WIDTH;
export const LANE_DIVIDERS: readonly number[] = Object.freeze(
  LANES.slice(1).map((lane) => laneCenter(lane) - LANE_WIDTH / 2),
);

/** Screen row (0 horizon .. 1 camera) of the player's contact plane. */
export const PLAYER_T = 0.855;
// Shared perspective for the road, scenery and traffic.
export const depthToScreen = (z: number): number => (1 - z) / (1 + 4 * z);
export const screenToDepth = (t: number): number => (1 - t) / (1 + 4 * t);
export const PLAYER_DEPTH = screenToDepth(PLAYER_T);
