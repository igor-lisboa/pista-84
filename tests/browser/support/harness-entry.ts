// Exposed to browser tests as `window.Pista`; bundled on the fly by harness.ts.
export { CARS, LANES, PATH_UNIT, PLAYER_T, Race, laneCenter, screenToDepth } from '../../../src/game/index.ts';
export { Renderer } from '../../../src/render/renderer.ts';
export { drawCar, loadSprites, spriteDimensions, spritesReady, steeringPose } from '../../../src/render/sprites.ts';
