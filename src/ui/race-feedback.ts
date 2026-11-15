import { CHECKPOINT, CHECKPOINT_FUEL, FUEL_PICKUP, OFFROAD_ENTRY_FUEL, type Race } from '../game/index.ts';
import type { AudioEngine } from '../audio/audio.ts';
import { t } from '../i18n/index.ts';
import { distanceUnit, formatDistance } from './units.ts';
import type { Hud } from './hud.ts';
import type { Notifications } from './notifications.ts';

/** Maps simulation events to feedback without coupling the simulation to browser services. */
export function presentRaceEvents(race: Race, audio: AudioEngine, hud: Hud, notifications: Notifications): void {
  for (const event of race.events) {
    switch (event) {
      case 'fuel':
        notifications.feedback(t('fb.fuel', { fuel: FUEL_PICKUP }));
        audio.tone(660, 0.22, 'square', 0.2);
        break;
      case 'fuelPenalty':
        hud.showFuelPenalty(OFFROAD_ENTRY_FUEL);
        break;
      case 'checkpoint':
        notifications.feedback(t('fb.checkpoint', { n: formatDistance(race.checkpoints * CHECKPOINT, 0), unit: distanceUnit(), fuel: CHECKPOINT_FUEL }));
        audio.tone(880, 0.2, 'square', 0.18);
        break;
      case 'offroad':
        notifications.feedback(t('fb.offroad'));
        audio.tone(70, 0.35, 'sawtooth', 0.28);
        break;
      case 'crash':
        audio.tone(90, 0.4, 'sawtooth', 0.3);
        break;
      case 'hit':
        break;
    }
  }
}
