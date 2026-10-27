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

const LIGHTS: readonly LightName[] = ['day', 'sunset', 'night', 'dawn'];
/** Second within the 180 s day cycle at which each light phase ends. */
const LIGHT_ENDS = [65, 95, 155, 180] as const;
const NIGHT_LEVEL = [0, 0.15, 1, 0.35] as const;
const LIGHT_BLEND_SECONDS = 10;
const DAY_CYCLE_SECONDS = 180;

const WEATHER: readonly WeatherName[] = ['clear', 'rain', 'clear', 'fog'];
const WEATHER_PHASE_SECONDS = 38;
const WEATHER_BLEND_SECONDS = 5;
/** The first seconds of a run are always clear. */
const CLEAR_START_SECONDS = 5;

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Lighting and weather as a pure function of elapsed run time. */
export function environment(time: number): Environment {
  const t = Math.max(0, time);
  const cycle = t % DAY_CYCLE_SECONDS;
  const index = LIGHT_ENDS.findIndex((end) => cycle < end);
  const mix = smoothstep(clamp((cycle - (LIGHT_ENDS[index]! - LIGHT_BLEND_SECONDS)) / LIGHT_BLEND_SECONDS, 0, 1));

  const phase = Math.floor(t / WEATHER_PHASE_SECONDS) % WEATHER.length;
  const blend = clamp((t % WEATHER_PHASE_SECONDS) / WEATHER_BLEND_SECONDS, 0, 1);
  const previous = WEATHER[(phase + WEATHER.length - 1) % WEATHER.length]!;
  const weather = WEATHER[phase]!;
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
    rain: t < CLEAR_START_SECONDS ? 0 : intensity('rain'),
    fog: t < CLEAR_START_SECONDS ? 0 : intensity('fog'),
  };
}
