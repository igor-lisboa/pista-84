import { AudioEngine } from '../audio/audio.ts';
import {
  CARS,
  PAINTS,
  Race,
  loadSave,
  SAVE_KEY,
  type BalanceConfig,
  type CarSpec,
  type SaveData,
  type SaveStorage,
} from '../game/index.ts';
import { applyStatic, detectLang, isLang, setLang, t, type Lang } from '../i18n/index.ts';
import { Renderer } from '../render/renderer.ts';
import { loadSprites } from '../render/sprites.ts';
import { paintCarPreview } from './car-art.ts';
import { byId, formatInteger, formatKm } from './dom.ts';
import { Garage } from './garage.ts';
import { Hud } from './hud.ts';
import { InputController } from './input.ts';
import { Notifications } from './notifications.ts';
import { showGameOver, showPause } from './overlays.ts';
import { RemoteDialog, type RemoteHost } from './remote-dialog.ts';
import { SettingsDialog, type InstallPrompt } from './settings.ts';
import { unavailableStore, type CashStore } from './store.ts';

type View = 'menu' | 'race' | 'overlay';

/** Seconds of play between automatic progress saves. */
const AUTOSAVE_SECONDS = 5;
const MAX_FRAME_SECONDS = 0.05;

function createStorage(): SaveStorage {
  try {
    return localStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => {
        throw new Error('Storage unavailable');
      },
    };
  }
}

const isNativeApp = (): boolean =>
  (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;

/** The interactive game: owns the save, the race, the renderer and every screen. */
export class GameApp implements RemoteHost {
  readonly input = new InputController();

  private readonly config: BalanceConfig;
  private readonly storage = createStorage();
  private readonly save: SaveData;
  private readonly race: Race;
  private readonly audio = new AudioEngine();
  private readonly notifications = new Notifications();
  private readonly hud = new Hud();
  private readonly store: CashStore = unavailableStore;
  private readonly renderer = new Renderer(byId<HTMLCanvasElement>('game'));
  private readonly garage: Garage;
  private readonly settingsDialog: SettingsDialog;
  private readonly remoteDialog: RemoteDialog;

  private previousStatus: Race['status'] = 'ready';
  private clock = 0;
  /** Coins already banked into the save for the current run. */
  private settledCoins = 0;
  private lastAutosaveTime = 0;
  private bestDistanceAtStart = 0;
  private recordShown = false;
  private cloudBackup = false;
  private installPrompt: (InstallPrompt & Event) | null = null;

  constructor(config: BalanceConfig) {
    this.config = config;
    this.save = loadSave(this.storage, config);
    setLang(isLang(this.save.lang) ? this.save.lang : detectLang(navigator.languages));
    this.race = new Race(this.selectedCar());

    this.garage = new Garage({
      save: this.save,
      race: this.race,
      config,
      store: this.store,
      selectedCar: () => this.selectedCar(),
      resetForCar: () => this.resetForCar(),
      persist: () => this.persist(),
      refreshFeatured: () => this.paintFeaturedCar(),
      toast: (message) => this.notifications.toast(message),
      cloudEnabled: () => this.cloudBackup,
    });
    this.settingsDialog = new SettingsDialog({
      save: this.save,
      audio: this.audio,
      input: this.input,
      notify: this.notifications,
      persist: () => this.persist(),
      changeLanguage: (lang) => this.changeLanguage(lang),
      installPrompt: () => this.installPrompt,
    });
    this.remoteDialog = new RemoteDialog(this);
  }

  /** Wires the DOM, starts the frame loop and the service worker. */
  mount(): void {
    applyStatic();
    this.refresh();
    this.input.bindButtons();
    this.input.onTiltChange = (enabled) => {
      document.body.dataset.tilt = enabled ? 'on' : 'off';
    };
    this.input.onTiltSilent = () => this.notifications.toast(t('tilt.silent'));
    void loadSprites().then(() => this.refresh()).catch(() => undefined);

    byId('start').onclick = () => this.start();
    byId('garageNav').onclick = () => this.openGarage();
    byId('garageOpen').onclick = () => this.openGarage();
    byId('settingsNav').onclick = () => this.openSettings();
    byId('remoteNav').onclick = () => void this.remoteDialog.open();
    byId('pause').onclick = () => this.pause();
    byId('closeModal').onclick = () => byId<HTMLDialogElement>('modal').close();

    fetch('/health')
      .then((response) => response.json() as Promise<{ cloudBackup?: boolean }>)
      .then((data) => {
        this.cloudBackup = data.cloudBackup === true;
      })
      .catch(() => undefined);

    this.bindWindowEvents();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    this.resize();

    let last = performance.now();
    const frame = (now: number): void => {
      const dt = Math.min(MAX_FRAME_SECONDS, (now - last) / 1000);
      last = now;
      this.tick(dt, now);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    if ('serviceWorker' in navigator && !isNativeApp()) {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch(() => undefined);
    }
  }

  // ---- RemoteHost ----

  isRunning = (): boolean => this.race.status === 'running';
  isPaused = (): boolean => this.race.status === 'paused';
  isModalOpen = (): boolean => byId<HTMLDialogElement>('modal').open;
  closeModal = (): void => byId<HTMLDialogElement>('modal').close();
  notify = (message: string): void => this.notifications.toast(message);

  openModal(): void {
    if (this.race.status === 'running') this.pause();
    this.input.clear();
    const modal = byId<HTMLDialogElement>('modal');
    if (!modal.open) modal.showModal();
  }

  // ---- race flow ----

  start(): void {
    if (this.isModalOpen()) return;
    this.race.start();
    this.bestDistanceAtStart = this.save.best;
    this.recordShown = false;
    this.settledCoins = 0;
    this.lastAutosaveTime = 0;
    this.previousStatus = 'running';
    this.input.clear();
    this.setView('race');
    void this.keepScreenAwake();
    this.unlockAudio();
  }

  pause(): void {
    if (this.race.status === 'paused') {
      this.resume();
      return;
    }
    if (this.race.status !== 'running') return;
    this.race.status = 'paused';
    this.settle();
    this.input.clear();
    this.setView('overlay');
    showPause({
      resume: () => this.resume(),
      openSettings: () => this.openSettings(),
      toMenu: () => this.backToMenu(),
    });
  }

  resume(): void {
    if (this.race.status !== 'paused' || this.isModalOpen()) return;
    this.input.clear();
    this.race.status = 'running';
    this.setView('race');
    void this.keepScreenAwake();
  }

  private backToMenu(): void {
    if (this.race.distance > 0) this.settle();
    this.input.clear();
    this.race.reset();
    this.settledCoins = 0;
    this.previousStatus = 'ready';
    this.setView('menu');
    this.refresh();
  }

  private gameOver(): void {
    this.settle();
    this.audio.tone(this.race.crashed ? 55 : 65, 0.5, 'sawtooth', 0.3);
    this.setView('overlay');
    showGameOver(this.race, this.save, {
      restart: () => this.start(),
      toMenu: () => this.backToMenu(),
      secondChance: () => {
        if (!this.race.resume()) return;
        this.previousStatus = 'running';
        this.input.clear();
        this.setView('race');
      },
    });
  }

  private resetForCar(): void {
    if (this.race.distance > 0) this.settle();
    this.race.car = this.selectedCar();
    this.race.reset();
    this.settledCoins = 0;
    this.previousStatus = 'ready';
    this.setView('menu');
    this.refresh();
  }

  // ---- per-frame update ----

  private tick(dt: number, now: number): void {
    this.clock += dt;
    const drive = this.input.read();
    this.race.update(dt, drive);
    this.handleRaceEvents();

    const race = this.race;
    if (race.status === 'running' && !this.recordShown && this.bestDistanceAtStart > 0 && race.distance > this.bestDistanceAtStart) {
      this.recordShown = true;
      this.notifications.feedback(t('fb.record'));
    }
    if (this.previousStatus !== 'over' && race.status === 'over') this.gameOver();
    this.previousStatus = race.status;
    if (race.status === 'running' && race.time - this.lastAutosaveTime >= AUTOSAVE_SECONDS) {
      this.settle();
      this.lastAutosaveTime = race.time;
    }

    this.renderer.draw(race, this.clock, drive);
    this.audio.setMusic(race.status === 'running' ? 'race' : 'menu');
    this.audio.update(race, drive.brake === true);
    this.hud.update(race, this.bestDistanceAtStart, now);
  }

  private handleRaceEvents(): void {
    for (const event of this.race.events) {
      switch (event) {
        case 'fuel':
          this.notifications.feedback(t('fb.fuel'));
          this.audio.tone(660, 0.22, 'square', 0.2);
          break;
        case 'checkpoint':
          this.notifications.feedback(t('fb.checkpoint', { n: this.race.checkpoints }));
          this.audio.tone(880, 0.2, 'square', 0.18);
          break;
        case 'offroad':
          this.notifications.feedback(t('fb.offroad'));
          this.audio.tone(70, 0.35, 'sawtooth', 0.28);
          break;
        case 'crash':
          this.audio.tone(90, 0.4, 'sawtooth', 0.3);
          break;
        case 'hit':
          break;
      }
    }
  }

  // ---- save, selection, language ----

  /** Banks coins and records earned since the last call. */
  private settle(): void {
    this.save.coins += Math.max(0, this.race.coins - this.settledCoins);
    this.settledCoins = this.race.coins;
    this.save.best = Math.max(this.save.best, this.race.distance);
    this.save.bestScore = Math.max(this.save.bestScore, Math.floor(this.race.score));
    this.persist();
  }

  private persist(): void {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      this.notifications.toast(t('toast.storage'));
    }
    this.refresh();
  }

  /** The selected car with the chosen paint applied. */
  private selectedCar(): CarSpec {
    const car = CARS.find((candidate) => candidate.id === this.save.selected) ?? CARS[0]!;
    const paint = PAINTS.find((candidate) => candidate.id === this.save.paint);
    return { ...car, color: paint?.color ?? car.color };
  }

  private changeLanguage(lang: Lang): void {
    this.save.lang = lang;
    setLang(lang);
    applyStatic();
    this.persist();
    this.hud.invalidate();
    this.settingsDialog.render();
  }

  private refresh(): void {
    byId('best').textContent = `${formatKm(this.save.best)} km`;
    byId('wallet').textContent = `◈ ${formatInteger(this.save.coins)}`;
    byId('carName').textContent = this.race.car.name.toUpperCase();
    this.paintFeaturedCar();
  }

  private paintFeaturedCar(): void {
    paintCarPreview(byId<HTMLCanvasElement>('menuCar'), this.selectedCar());
  }

  // ---- screens ----

  private openGarage(): void {
    this.openModal();
    this.garage.render();
  }

  private openSettings(): void {
    this.openModal();
    this.settingsDialog.render();
  }

  private setView(view: View): void {
    document.body.dataset.view = view;
    byId('menu').hidden = view !== 'menu';
    byId('raceUI').hidden = view === 'menu';
    byId('overlay').hidden = view !== 'overlay';
  }

  private resize(): void {
    const height = window.visualViewport?.height ?? innerHeight;
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
    this.renderer.resize();
  }

  // ---- platform plumbing ----

  /** Browsers only allow audio after a user gesture, so the first one switches it on. */
  private unlockAudio(): void {
    if (this.save.sound && !this.audio.enabled) this.audio.toggle().catch(() => undefined);
  }

  private async keepScreenAwake(): Promise<void> {
    try {
      if ('wakeLock' in navigator && !document.hidden) await navigator.wakeLock.request('screen');
    } catch {
      // Wake lock is a nicety only.
    }
  }

  private bindWindowEvents(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPrompt = event as Event & InstallPrompt;
    });
    // The first tap or key press unlocks the Web Audio context for the menu music.
    const unlockOnce = (): void => {
      this.unlockAudio();
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
    window.addEventListener('pointerdown', unlockOnce);
    window.addEventListener('keydown', unlockOnce);

    window.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement;
      if (target.matches('input,textarea,select') || this.isModalOpen()) return;
      const key = this.input.keyDown(event);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) event.preventDefault();
      if (event.repeat) return;
      if (key === 'Enter' && this.race.status !== 'running') {
        if (this.race.status === 'paused') this.resume();
        else this.start();
      }
      if (key === 'p' || key === 'Escape') this.pause();
    });
    window.addEventListener('keyup', (event) => this.input.keyUp(event));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.input.clear();
        if (this.race.status === 'running') this.pause();
      }
    });
    window.addEventListener('pagehide', () => {
      if (this.race.distance > 0) this.settle();
      this.input.clear();
    });
    // Safari may fire blur when its browser chrome changes focus; on touch devices
    // visibility is the pause authority instead.
    window.addEventListener('blur', () => {
      if (matchMedia('(pointer:coarse)').matches) return;
      this.input.clear();
      if (this.race.status === 'running') this.pause();
    });
  }
}
