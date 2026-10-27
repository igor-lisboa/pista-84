import { CHECKPOINT, PATH_UNIT, paceMultiplier, roadBend, type Race } from '../game/index.ts';
import { t } from '../i18n/index.ts';
import { byId, formatInteger, formatKm } from './dom.ts';

/** How far ahead of the car a bend must be to show the warning. */
const CURVE_LOOKAHEAD = PATH_UNIT * 0.45;
const CURVE_WARNING = 0.45;
const CURVE_SHARP = 0.8;
const SHARP_WARNING_SPEED = 150;
const LOW_FUEL = 25;
/** The HUD text is refreshed at about 12 Hz; the canvas runs every frame. */
const REFRESH_MS = 80;

const FUEL_OK = '#2de2e6';
const FUEL_LOW = '#ff3c78';

/** Top-bar race HUD: speed, trip, score, checkpoint progress, fuel and bend warning. */
export class Hud {
  private lastRefresh = 0;
  private readonly speed = byId('speed');
  private readonly distance = byId('distance');
  private readonly score = byId('score');
  private readonly fuelLabel = byId('fuelLabel');
  private readonly fuelBar = byId('fuelBar');
  private readonly curveHint = byId('curveHint');
  private readonly checkpointBar = byId('cpBar');
  private readonly checkpointLabel = byId('cpLabel');
  private readonly bestMark = byId('bestMark');

  /** Forces the next `update` to repaint (used after a language change). */
  invalidate(): void {
    this.lastRefresh = 0;
  }

  update(race: Race, bestDistanceAtStart: number, nowMs: number): void {
    if (nowMs - this.lastRefresh <= REFRESH_MS) return;
    this.lastRefresh = nowMs;

    this.speed.innerHTML = `${Math.round(race.speed).toString().padStart(3, '0')} <em>${t('hud.speedUnit')}</em>`;
    this.distance.innerHTML = `${formatKm(race.distance)} <em>km</em>`;
    const multiplier = paceMultiplier(race.kmMetres, race.kmTime).toFixed(1);
    this.score.textContent = `${formatInteger(race.score)} ${t('hud.pts')} · x${multiplier}`;
    this.fuelLabel.textContent = `${Math.ceil(race.fuel)}%`;
    this.fuelBar.style.width = `${race.fuel}%`;
    this.fuelBar.style.color = race.fuel < LOW_FUEL ? FUEL_LOW : FUEL_OK;

    this.updateBendWarning(race);

    const nextCheckpoint = (race.checkpoints + 1) * CHECKPOINT;
    this.checkpointBar.style.width = `${((race.distance % CHECKPOINT) / CHECKPOINT) * 100}%`;
    this.checkpointLabel.textContent = race.offroad ? t('hud.offroad') : t('hud.checkpoint', { km: formatKm(nextCheckpoint) });
    const showBest = bestDistanceAtStart > race.distance && bestDistanceAtStart < nextCheckpoint;
    this.bestMark.style.display = showBest ? 'block' : 'none';
    this.bestMark.style.left = `${((bestDistanceAtStart % CHECKPOINT) / CHECKPOINT) * 100}%`;
  }

  private updateBendWarning(race: Race): void {
    const bend = roadBend(race.path + CURVE_LOOKAHEAD, race.roadSeed);
    this.curveHint.hidden = Math.abs(bend) < CURVE_WARNING || race.status !== 'running';
    this.curveHint.classList.toggle('sharp', Math.abs(bend) > CURVE_SHARP && race.speed > SHARP_WARNING_SPEED);
    const arrow = this.curveHint.firstElementChild;
    if (arrow) arrow.classList.toggle('turn-left', bend < 0);
  }
}
