import { clamp } from './math.ts';

export type LightName = 'day' | 'sunset' | 'night' | 'dawn';
export type WeatherName = 'clear' | 'rain' | 'fog';

export interface Environment {
  readonly light: LightName;
  readonly weather: WeatherName;
  readonly from: LightName;
  readonly to: LightName;
  /** 0..1 blend between `from` and `to` lighting. */
  readonly mix: number;
  /** 0 (day) .. 1 (full night). */
  readonly night: number;
  readonly rain: number;
  readonly fog: number;
}

/** What makes one run look different from another: when it starts and what the sky does. */
export interface Conditions {
  /** Second of the day cycle the run starts at, taken from the player's local clock. */
  readonly cycleOffset: number;
  /** Weather of each consecutive phase; the plan repeats once a run outlasts it. */
  readonly weather: readonly WeatherName[];
}

const LIGHTS: readonly LightName[] = ['day', 'sunset', 'night', 'dawn'];
/** Second within the 180 s day cycle at which each light phase ends. */
const LIGHT_ENDS = [65, 95, 155, 180] as const;
/** Local hour at which each light phase begins (dawn at 05:30, day at 07:00...). */
const LIGHT_STARTS_AT_HOUR = [7, 17.5, 19, 5.5] as const;
const NIGHT_LEVEL = [0, 0.15, 1, 0.35] as const;
const LIGHT_BLEND_SECONDS = 10;
const DAY_CYCLE_SECONDS = 180;
const HOURS_PER_DAY = 24;

const WEATHER_PHASE_SECONDS = 38;
const WEATHER_BLEND_SECONDS = 5;
/** Phases rolled per run: about eight minutes before the plan repeats. */
const WEATHER_PLAN_PHASES = 12;
/** Relative odds of each weather in a phase: half clear, the rest split between rain and fog. */
const WEATHER_ODDS: readonly (readonly [WeatherName, number])[] = [
  ['clear', 0.5],
  ['rain', 0.25],
  ['fog', 0.25],
];

/** Daylight with a clear sky throughout: for previews and deterministic tests. */
export const CALM_CONDITIONS: Conditions = { cycleOffset: 0, weather: ['clear'] };

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/**
 * Maps a local clock time to the matching second of the compressed day cycle,
 * so a run started at 21:00 begins at night and one started at 18:00 at sunset.
 */
export function cycleSecondAt(date: Date): number {
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const dayStart = LIGHT_STARTS_AT_HOUR[0];
  // Hours since the day phase began, so the phases are in order without wrapping midnight.
  const sinceDay = (hour - dayStart + HOURS_PER_DAY) % HOURS_PER_DAY;
  let phaseStartSecond = 0;
  for (let index = 0; index < LIGHTS.length; index++) {
    const startHour = (LIGHT_STARTS_AT_HOUR[index]! - dayStart + HOURS_PER_DAY) % HOURS_PER_DAY;
    const endHour = index + 1 < LIGHTS.length
      ? (LIGHT_STARTS_AT_HOUR[index + 1]! - dayStart + HOURS_PER_DAY) % HOURS_PER_DAY
      : HOURS_PER_DAY;
    const endSecond = LIGHT_ENDS[index]!;
    if (sinceDay < endHour) {
      const progress = (sinceDay - startHour) / (endHour - startHour);
      return phaseStartSecond + progress * (endSecond - phaseStartSecond);
    }
    phaseStartSecond = endSecond;
  }
  return 0;
}

/** A random weather plan for one run; any phase, including the first, can be rain or fog. */
export function rollWeather(random: () => number, phases = WEATHER_PLAN_PHASES): WeatherName[] {
  const total = WEATHER_ODDS.reduce((sum, [, odds]) => sum + odds, 0);
  return Array.from({ length: phases }, () => {
    let roll = random() * total;
    for (const [weather, odds] of WEATHER_ODDS) {
      roll -= odds;
      if (roll < 0) return weather;
    }
    return WEATHER_ODDS[0]![0];
  });
}

/** Conditions for a run starting now: the player's local time of day and a fresh weather plan. */
export function rollConditions(now: Date, random: () => number): Conditions {
  return { cycleOffset: cycleSecondAt(now), weather: rollWeather(random) };
}

/** Lighting and weather as a pure function of elapsed run time and the run's conditions. */
export function environment(time: number, conditions: Conditions): Environment {
  const t = Math.max(0, time);
  const cycle = (t + conditions.cycleOffset) % DAY_CYCLE_SECONDS;
  const index = LIGHT_ENDS.findIndex((end) => cycle < end);
  const mix = smoothstep(clamp((cycle - (LIGHT_ENDS[index]! - LIGHT_BLEND_SECONDS)) / LIGHT_BLEND_SECONDS, 0, 1));

  const plan = conditions.weather.length > 0 ? conditions.weather : CALM_CONDITIONS.weather;
  const phase = Math.floor(t / WEATHER_PHASE_SECONDS);
  const weather = plan[phase % plan.length]!;
  // The opening phase has nothing to blend from: a run can start straight into rain or fog.
  const previous = phase === 0 ? weather : plan[(phase - 1) % plan.length]!;
  const blend = clamp((t % WEATHER_PHASE_SECONDS) / WEATHER_BLEND_SECONDS, 0, 1);
  const intensity = (kind: WeatherName): number =>
    (previous === kind ? 1 - blend : 0) + (weather === kind ? blend : 0);

  const next = (index + 1) % LIGHTS.length;
  return {
    light: LIGHTS[index]!,
    weather,
    from: LIGHTS[index]!,
    to: LIGHTS[next]!,
    mix,
    night: NIGHT_LEVEL[index]! * (1 - mix) + NIGHT_LEVEL[next]! * mix,
    rain: intensity('rain'),
    fog: intensity('fog'),
  };
}
