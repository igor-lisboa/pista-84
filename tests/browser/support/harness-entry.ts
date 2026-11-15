// Exposed to browser tests as `window.Pista`; bundled on the fly by harness.ts.
export { CALM_CONDITIONS, CARS, LANES, PATH_UNIT, PLAYER_T, POINTS_PER_COIN, Race, defaultSave, laneCenter, screenToDepth } from '../../../src/game/index.ts';
export { Renderer } from '../../../src/render/renderer.ts';
export {RoadSurface} from '../../../src/render/road-surface.ts';
export {paintReferenceRoad} from '../../support/road-surface-reference.ts';
export {drawCar, loadSprites, spriteDimensions, spritesReady, steeringPose, carPlacement} from '../../../src/render/sprites.ts';
export {paintVehicleGround} from '../../../src/render/vehicle-ground.ts';
export { AudioEngine, AUDIO_PROFILES, engineVoice, engineWave } from '../../../src/audio/audio.ts';
export { showGameOver } from '../../../src/ui/overlays.ts';
export { paintCarPreview } from '../../../src/ui/car-art.ts';
export { Hud } from '../../../src/ui/hud.ts';
export {InputController} from '../../../src/ui/input.ts';

export {setLang, LANGS, t} from '../../../src/i18n/index.ts';
export {paintedTile} from '../../../src/render/sprites.ts';
export {PAINTS} from '../../../src/game/cars.ts';
export {BASE_PAINTS} from '../../../src/render/sprite-paint.ts';
export {brakeTile} from '../../../src/render/sprite-brakes.ts';
export {lampMask, lampFootprints} from '../../../src/render/sprite-lamps.ts';
export {lampRegions} from '../../../src/render/sprite-materials.ts';
