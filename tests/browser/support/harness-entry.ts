// Exposed to browser tests as `window.Pista`; bundled on the fly by harness.ts.
export { CARS, LANES, PATH_UNIT, PLAYER_T, POINTS_PER_COIN, Race, defaultSave, laneCenter, screenToDepth } from '../../../src/game/index.ts';
export { Renderer } from '../../../src/render/renderer.ts';
export { drawCar, loadSprites, spriteDimensions, spritesReady, steeringPose } from '../../../src/render/sprites.ts';
export { AudioEngine } from '../../../src/audio/audio.ts';
export { showGameOver } from '../../../src/ui/overlays.ts';
