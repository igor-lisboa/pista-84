import { AudioEngine } from '../audio/audio.ts';
import {ProgressSync} from '../net/progress-sync.ts';
import {ACCOUNT_KEY, clearAccountDevice, localAccount} from '../net/account.ts';
import {AccountDialog} from './account.ts';
import {
  CARS,
  CHECKPOINT,
  CHECKPOINT_FUEL,
  FUEL_PICKUP,
  OFFROAD_ENTRY_FUEL,
  PAINTS,
  Race,
  loadSave,
  startNewPlayer,
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
import { byId, formatInteger } from './dom.ts';
import { distanceUnit, formatDistance } from './units.ts';
import { Garage } from './garage.ts';
import { Hud } from './hud.ts';
import { InputController } from './input.ts';
import { applyIcons } from './icons.ts';
import { Notifications } from './notifications.ts';
import { showGameOver, showPause } from './overlays.ts';
import { RemoteDialog, type RemoteHost } from './remote-dialog.ts';
import { AboutDialog } from './about.ts';
import { LeaderboardDialog } from './leaderboard.ts';
import { TutorialDialog } from './tutorial.ts';
import { setUnits } from './units.ts';
import { NewPlayerDialog } from './new-player.ts';
import { UsernameDialog } from './username.ts';
import { SettingsDialog, type InstallPrompt } from './settings.ts';

type View = 'menu' | 'race' | 'overlay';

const SYNC_KEY = 'pista84.synced';

/** A first-time player who has not moved after this many seconds gets the tutorial. */
const IDLE_TUTORIAL_SECONDS = 5;

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
  private accountOwner = localAccount();
  private accountTransition = false;
  private readonly progressSync = new ProgressSync(this.storage,
    (input, init) => fetch(input, init), () => !this.isRunning() && !this.accountTransition && this.sameAccount());
  private readonly save: SaveData;
  private readonly race: Race;
  private readonly audio = new AudioEngine();
  private readonly notifications = new Notifications();
  private readonly hud = new Hud();
  private readonly renderer = new Renderer(byId<HTMLCanvasElement>('game'));
  private readonly garage: Garage;
  private readonly settingsDialog: SettingsDialog;
  private readonly accountDialog: AccountDialog;
  private readonly remoteDialog: RemoteDialog;
  private readonly usernameDialog: UsernameDialog;
  private readonly newPlayerDialog: NewPlayerDialog;
  private readonly leaderboardDialog = new LeaderboardDialog(() => this.save.playerId);
  private readonly tutorialDialog = new TutorialDialog();
  /** The tutorial owns the modal; closing it by any route finishes it. */
  private tutorialActive = false;
  /** Restart the race once an idle-triggered tutorial closes. */
  private tutorialRestart = false;
  private readonly aboutDialog = new AboutDialog();

  private previousStatus: Race['status'] = 'ready';
  private clock = 0;
  /** Coins already banked into the save for the current run. */
  private settledCoins = 0;
  private lastAutosaveTime = 0;
  private bestDistanceAtStart = 0;
  private recordShown = false;
  private cloudBackup = false;
  private syncing = false;
  private installPrompt: (InstallPrompt & Event) | null = null;

  constructor(config: BalanceConfig) {
    this.config = config;
    const localSave = loadSave(this.storage);
    // Persist generated IDs for legacy saves before queueing their first durable copy.
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(localSave)); } catch { /* Offline play still works. */ }
    this.progressSync.queue(localSave);
    this.save = loadSave({getItem: () => JSON.stringify(localSave)}, config);
    setLang(isLang(this.save.lang) ? this.save.lang : detectLang(navigator.languages));
    setUnits(this.save.units);
    this.race = new Race(this.selectedCar());

    this.accountDialog = new AccountDialog({
      save: this.save,
      switching: () => { this.accountTransition = true; this.progressSync.cancel(); },
      finished: () => { this.accountTransition = false; },
      signedIn: (save, user) => {
        this.progressSync.discard(this.save.playerId);
        this.accountOwner = user;
        this.race.reset();
        Object.assign(this.save, save);
        setUnits(this.save.units);
        setLang(isLang(this.save.lang) ? this.save.lang : detectLang(navigator.languages));
        applyStatic();
        this.hud.invalidate();
        this.resetForCar();
        this.accountTransition = false;
        this.persist();
      },
      signedOut: () => {
        this.progressSync.clear();
        clearAccountDevice(this.save);
        location.reload();
      },
    });

    this.garage = new Garage({
      save: this.save,
      race: this.race,
      config,
      selectedCar: () => this.selectedCar(),
      resetForCar: () => this.resetForCar(),
      persist: () => this.persist(),
      refreshFeatured: () => this.paintFeaturedCar(),
      toast: (message) => this.notifications.toast(message),
      cloudEnabled: () => this.cloudBackup,
      imported: () => {
        setUnits(this.save.units);
        this.hud.invalidate();
        this.refresh();
        void this.syncScore();
      },
    });
    this.settingsDialog = new SettingsDialog({
      save: this.save,
      audio: this.audio,
      input: this.input,
      notify: this.notifications,
      persist: () => this.persist(),
      changeLanguage: (lang) => this.changeLanguage(lang),
      editUsername: () => this.openUsername(),
      openAccount: () => this.openAccount(),
      changeUnits: (units) => this.changeUnits(units),
      showTutorial: () => this.openTutorial(false),
      newPlayer: () => this.openNewPlayer(),
      installPrompt: () => {
        const prompt = this.installPrompt;
        this.installPrompt = null;
        return prompt;
      },
    });
    this.usernameDialog = new UsernameDialog({
      save: this.save,
      openAccount: () => this.openAccount(),
      persist: () => this.persist(),
      onSaved: (name) => {
        this.notifications.toast(t('user.welcome', { name }));
        void this.syncScore();
        if (!this.save.tutorialDone) this.openTutorial(false);
      },
    });
    this.newPlayerDialog = new NewPlayerDialog({ save: this.save, confirm: () => this.startNewPlayer() });
    this.remoteDialog = new RemoteDialog(this);
  }

  /** Wires the DOM, starts the frame loop and the service worker. */
  mount(): void {
    applyIcons();
    applyStatic();
    this.refresh();
    this.input.bindButtons();
    if (this.usernameDialog.required) this.openUsername();
    this.input.onTiltChange = (enabled) => {
      document.body.dataset.tilt = enabled ? 'on' : 'off';
      this.checkRotation();
    };
    this.input.onTiltSilent = () => this.notifications.toast(t('tilt.silent'));
    void loadSprites().then(() => this.refresh()).catch(() => undefined);

    byId('start').onclick = () => this.start();
    byId('garageNav').onclick = () => this.openGarage();
    byId('coinsNav').onclick = () => {
      this.openModal();
      this.garage.renderCoinShop();
    };
    byId('garageOpen').onclick = () => this.openGarage();
    byId('settingsNav').onclick = () => this.openSettings();
    byId('aboutNav').onclick = () => this.openAbout();
    byId('rotateOff').onclick = () => void this.input.toggleTilt().catch(() => undefined);
    byId('leaderboardNav').onclick = () => this.openLeaderboard();
    byId('newPlayerNav').onclick = () => this.openNewPlayer();
    byId('remoteNav').onclick = () => void this.remoteDialog.open();
    byId('pause').onclick = () => this.pause();
    byId('closeModal').onclick = () => byId<HTMLDialogElement>('modal').close();
    // Without a name the dialog is mandatory, so Escape must not dismiss it.
    byId<HTMLDialogElement>('modal').addEventListener('cancel', (event) => {
      if (this.usernameDialog.required && document.getElementById('usernameForm')) event.preventDefault();
    });
    byId<HTMLDialogElement>('modal').addEventListener('close', () => {
      if (this.usernameDialog.required && !byId<HTMLDialogElement>('modal').open) {
        this.openUsername();
        return;
      }
      // A modal re-opened in the same tick (name dialog -> tutorial) is still open: ignore its stale close.
      if (this.tutorialActive && !byId<HTMLDialogElement>('modal').open) this.finishTutorial();
    });

    void this.checkOnline();

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
    void this.syncAtRest();
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
    void this.syncAtRest();
  }

  private gameOver(): void {
    this.settle();
    void this.syncAtRest();
    this.audio.tone(this.race.crashed ? 55 : 65, 0.5, 'sawtooth', 0.3);
    this.setView('overlay');
    showGameOver(this.race, this.save, {
      restart: () => this.start(),
      toMenu: () => this.backToMenu(),
      secondChance: () => {
        if (!this.race.resume(this.save)) return;
        this.persist();
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
    if (
      race.status === 'running' &&
      race.time >= IDLE_TUTORIAL_SECONDS &&
      race.distance < 1 &&
      this.save.best === 0 &&
      !this.tutorialActive
    ) {
      this.showIdleTutorial();
      return;
    }
    if (this.previousStatus !== 'over' && race.status === 'over') this.gameOver();
    this.previousStatus = race.status;
    if (race.status === 'running' && race.time - this.lastAutosaveTime >= AUTOSAVE_SECONDS) {
      this.settle();
      this.lastAutosaveTime = race.time;
    }

    this.renderer.draw(race, this.clock, drive);
    this.audio.setMusic(race.status === 'running' ? 'race' : 'menu');
    this.audio.update(race, drive.brake === true, drive.accelerate === true);
    this.hud.update(race, this.bestDistanceAtStart, now);
  }

  private handleRaceEvents(): void {
    for (const event of this.race.events) {
      switch (event) {
        case 'fuel':
          this.notifications.feedback(t('fb.fuel', { fuel: FUEL_PICKUP }));
          this.audio.tone(660, 0.22, 'square', 0.2);
          break;
        case 'fuelPenalty':
          this.hud.showFuelPenalty(OFFROAD_ENTRY_FUEL);
          break;
        case 'checkpoint':
          this.notifications.feedback(t('fb.checkpoint', { n: formatDistance(this.race.checkpoints * CHECKPOINT, 0), unit: distanceUnit(), fuel: CHECKPOINT_FUEL }));
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

  private async syncAtRest(): Promise<void> {
    if (this.isRunning() || navigator.onLine === false || this.accountTransition || !this.sameAccount()) return;
    void this.progressSync.flush();
    if (!this.cloudBackup) await this.checkOnline();
    await this.syncScore();
  }

  /**
   * Checks availability for the manual backup controls, without uploading saves.
   */
  private async checkOnline(): Promise<void> {
    if (this.isRunning() || navigator.onLine === false) return;
    try {
      const response = await fetch('/health', {signal: AbortSignal.timeout(10000)});
      if (!response.ok) return;
      const data = await response.json() as {cloudBackup?: boolean};
      this.cloudBackup = data.cloudBackup === true;
    } catch {
      // Online features are optional; local progress remains authoritative.
    }
  }

  /**
   * Sends the best score and current name once per change. The last value the
   * server accepted is remembered on this device, so a run played offline (or
   * a rename) is retried on the next pause, game end or exit.
   */
  private async syncScore(): Promise<void> {
    const { save } = this;
    if (this.isRunning() || navigator.onLine === false || this.accountTransition || !this.sameAccount() ||
      !this.cloudBackup || this.syncing || !save.username || save.bestScore <= 0) return;
    const marker = `${save.playerId}|${save.username}|${save.bestScore}`;
    if (this.readSyncMarker() === marker) return;
    this.syncing = true;
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerId: save.playerId, username: save.username, score: save.bestScore, distance: save.best }),
        signal: AbortSignal.timeout(10000),
        keepalive: true,
      });
      if (response.ok && this.sameAccount() && !this.accountTransition) this.writeSyncMarker(marker);
    } catch {
      // Offline: the marker is unchanged, so the next trigger retries.
    } finally {
      this.syncing = false;
    }
  }

  private readSyncMarker(): string | null {
    try {
      return this.storage.getItem(SYNC_KEY);
    } catch {
      return null;
    }
  }

  private writeSyncMarker(marker: string): void {
    try {
      this.storage.setItem(SYNC_KEY, marker);
    } catch {
      // Not being able to remember only means one extra submission later.
    }
  }

  private persist(): void {
    if (this.accountTransition || !this.sameAccount()) return;
    if (this.accountOwner) {
      this.save.playerId = this.accountOwner.id;
      this.save.username = this.accountOwner.username;
      this.save.history = [];
    }
    this.save.updatedAt = Date.now();
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      this.notifications.toast(t('toast.storage'));
    }
    this.progressSync.queue(this.save);
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
    byId('best').textContent = `${formatDistance(this.save.best)} ${distanceUnit()}`;
    byId('wallet').textContent = t('coins.amount', { n: formatInteger(this.save.coins) });
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

  private openAbout(): void {
    this.openModal();
    this.aboutDialog.render();
    applyIcons();
  }

  private openLeaderboard(): void {
    this.openModal();
    this.leaderboardDialog.open();
  }

  /** Opens the tutorial; `idle` means the player did not move and the race will restart afterwards. */
  private openTutorial(idle: boolean): void {
    this.tutorialActive = true;
    this.tutorialRestart = idle;
    this.openModal();
    this.tutorialDialog.open(idle);
  }

  private finishTutorial(): void {
    this.tutorialActive = false;
    if (!this.save.tutorialDone) {
      this.save.tutorialDone = true;
      this.persist();
    }
    if (this.tutorialRestart) {
      this.tutorialRestart = false;
      this.start();
    }
  }

  /** Nobody moved in the first seconds of a first run: show how to drive, then start over. */
  private showIdleTutorial(): void {
    this.race.reset();
    this.settledCoins = 0;
    this.previousStatus = 'ready';
    this.setView('menu');
    this.refresh();
    this.openTutorial(true);
  }

  private changeUnits(units: SaveData['units']): void {
    this.save.units = units;
    setUnits(units);
    this.persist();
    this.hud.invalidate();
  }

  openNewPlayer(): void {
    if (this.accountOwner) { this.openAccount(); return; }
    this.openModal();
    this.newPlayerDialog.render();
  }

  /** Retires the current player (kept in history and online) and begins again from scratch. */
  private startNewPlayer(): void {
    if (this.race.distance > 0) this.settle();
    this.race.reset();
    this.settledCoins = 0;
    Object.assign(this.save, startNewPlayer(this.save, this.config));
    this.resetForCar();
    this.persist();
    this.notifications.toast(t('newp.done'));
    this.openUsername();
  }

  openUsername(): void {
    if (this.accountOwner) { this.openAccount(); return; }
    this.openModal();
    this.usernameDialog.render();
  }

  private openSettings(): void {
    this.openModal();
    this.settingsDialog.render();
  }

  private openAccount(): void {
    this.openModal();
    void this.accountDialog.open();
  }

  private sameAccount(): boolean {
    return localAccount()?.id === this.accountOwner?.id;
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
    this.checkRotation();
  }

  /**
   * Tilt steering needs a landscape screen. Where the orientation lock is not
   * available the overlay asks the player to turn the phone, and a running race
   * pauses rather than being played blind in a portrait layout.
   */
  private checkRotation(): void {
    const needed = this.input.tiltEnabled && innerHeight > innerWidth;
    document.body.dataset.rotate = needed ? 'needed' : '';
    if (needed && this.race.status === 'running') this.pause();
  }

  // ---- platform plumbing ----

  /** Browsers only allow audio after a user gesture, so the first one switches it on. */
  private unlockAudio(): void {
    if (this.save.sound && !this.audio.enabled) this.audio.setEnabled(true).catch(() => undefined);
  }

  private async keepScreenAwake(): Promise<void> {
    try {
      if ('wakeLock' in navigator && !document.hidden) await navigator.wakeLock.request('screen');
    } catch {
      // Wake lock is a nicety only.
    }
  }

  private bindWindowEvents(): void {
    window.addEventListener('storage', event => {
      if ((event.key === ACCOUNT_KEY || event.key === null) && !this.sameAccount()) {
        this.accountTransition = true;
        this.progressSync.cancel();
        location.reload();
      }
    });
    window.addEventListener('appinstalled', () => { this.installPrompt = null; });
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
        else {
          this.persist();
          void this.syncAtRest();
        }
      }
    });
    window.addEventListener('pagehide', () => {
      if (this.isRunning()) {
        this.pause();
        return;
      }
      this.settle();
      this.input.clear();
      void this.syncAtRest();
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
