import { t } from '../i18n/index.ts';
import { RemoteConnection } from '../net/remote.ts';
import { byId } from './dom.ts';
import { TiltError, InputController } from './input.ts';

const SEND_INTERVAL_MS = 40;
/** Start/pause are momentary pulses so a lost packet cannot leave them stuck on. */
const PULSE_MS = 700;
const WHEEL_DEGREES = 50;

async function keepScreenAwake(): Promise<void> {
  try {
    if ('wakeLock' in navigator && !document.hidden) await navigator.wakeLock.request('screen');
  } catch {
    // Wake lock is a nicety only.
  }
}

/** The page a paired phone shows: steering wheel, pedals and start/pause pulses. */
export function mountControllerPage(params: URLSearchParams): void {
  const input = new InputController();
  document.body.dataset.view = 'controller';
  byId('app').innerHTML = `
    <section class="controller">
      <header><h1>PISTA<span>84</span></h1><span class="label">${t('ctl.title')}</span></header>
      <p id="connection">${t('ctl.connecting')}</p>
      <div class="controller-toolbar">
        <button id="remoteStart">${t('ctl.start')}</button>
        <button id="remotePause">${t('ctl.pause')}</button>
      </div>
      <div class="controller-wheel"><div id="wheel" class="wheel"></div></div>
      <div class="controller-toolbar">
        <button id="tilt">${t('tilt.off')}</button>
        <button id="calibrate" hidden>${t('ctl.calibrate')}</button>
      </div>
      <div class="controller-pedals">
        <button data-control="left" aria-label="${t('hud.left')}">${t('ctl.left')}</button>
        <button data-control="right" aria-label="${t('hud.right')}">${t('ctl.right')}</button>
        <button data-control="brake">${t('hud.brake')}</button>
        <button data-control="accelerate">${t('hud.accelerate')}</button>
      </div>
      <p class="controller-note">${t('ctl.note')}</p>
    </section>`;
  input.bindButtons();

  const tiltButton = byId('tilt');
  input.onTiltChange = (enabled) => {
    tiltButton.textContent = enabled ? t('tilt.on') : t('tilt.off');
    byId('calibrate').hidden = !enabled;
  };
  tiltButton.onclick = () => {
    input.toggleTilt().catch((error: unknown) => {
      byId('connection').textContent = error instanceof TiltError ? t(error.key) : String(error);
    });
  };
  byId('calibrate').onclick = () => input.calibrate();

  let startUntil = 0;
  let pauseUntil = 0;
  byId('remoteStart').onclick = () => {
    startUntil = performance.now() + PULSE_MS;
    void keepScreenAwake();
  };
  byId('remotePause').onclick = () => {
    pauseUntil = performance.now() + PULSE_MS;
  };

  const connection = new RemoteConnection({
    forceRelay: params.get('transport') === 'relay',
    onStatus: (state, message) => {
      byId('connection').textContent = state === 'connected' ? t('ctl.connected') : (message ?? t('ctl.lost'));
    },
  });
  const token = params.get('token') ?? new URLSearchParams(location.hash.slice(1)).get('token');
  const room = params.get('controller');
  if (!token || !room) {
    byId('connection').textContent = t('ctl.badLink');
    return;
  }
  connection.join(room, token).then(keepScreenAwake).catch((error: unknown) => {
    byId('connection').textContent = error instanceof Error ? error.message : String(error);
  });

  setInterval(() => {
    const idle = { steer: 0, accelerate: false, brake: false };
    const drive = document.hidden ? idle : input.read();
    const now = performance.now();
    void connection.send({ ...drive, start: now < startUntil, pause: now < pauseUntil });
    byId('wheel').style.setProperty('--wheel-angle', `${(drive.steer ?? 0) * WHEEL_DEGREES}deg`);
  }, SEND_INTERVAL_MS);
}
