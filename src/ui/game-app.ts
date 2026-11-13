import { AudioEngine } from '../audio/audio.ts';
import {ProgressSync} from '../net/progress-sync.ts';
import type {RuntimeConfig} from '../shared/config.ts';
import {ACCOUNT_KEY, clearAccountDevice, localAccount} from '../net/account.ts';
import {AccountDialog} from './account.ts';
import {reconcileStoredSave} from '../game/merge-progress.ts';
import {
  CARS,
  CHECKPOINT,
  CHECKPOINT_FUEL,
  DEMO_CAR_ID,
  FUEL_PICKUP,
  OFFROAD_ENTRY_FUEL,
  PAINTS,
  Race,
  loadSave,
  SAVE_KEY,
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

  private readonly storage = createStorage();
  private accountOwner = localAccount();
  private accountTransition = false;
  private readonly progressSync = new ProgressSync(this.storage,
    (input, init) => fetch(input, init), () => this.signedIn() && !this.isRunning() && !this.accountTransition && this.sameAccount());
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
  private readonly leaderboardDialog = new LeaderboardDialog({ signedIn: () => this.signedIn() });
  private readonly tutorialDialog = new TutorialDialog();
  /** The tutorial owns the modal; closing it by any route finishes it. */
  private tutorialActive = false;
  /** Restart the race once an idle-triggered tutorial closes. */
  private tutorialRestart = false;
  /** The optional sign-up screen owns the modal until it is closed (by any route). */
  private welcomeActive = false;
  /** The run in progress is the one-time demo with the demo car; its end uses it up. */
  private demoRun = false;
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
  /** `updatedAt` of the last save this tab wrote or adopted; a larger stored value came from elsewhere. */
  private writtenAt = 0;
  private installPrompt: (InstallPrompt & Event) | null = null;

  constructor(config: RuntimeConfig) {
    const localSave = loadSave(this.storage);
    this.applyAccountIdentity(localSave);
    // Persist generated IDs for legacy saves before queueing their first durable copy.
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(localSave)); } catch { /* Offline play still works. */ }
    this.progressSync.queue(localSave);
    this.save = loadSave({getItem: () => JSON.stringify(localSave)}, config);
    this.writtenAt = this.save.updatedAt;
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
        this.applyAccountIdentity(this.save);
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
      progressToolsEnabled: config.progressTools ?? true,
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
      openAccount: () => this.openAccount(),
      changeUnits: (units) => this.changeUnits(units),
      showTutorial: () => this.openTutorial(false),
      installPrompt: () => {
        const prompt = this.installPrompt;
        this.installPrompt = null;
        return prompt;
      },
    });
    this.usernameDialog = new UsernameDialog({
      save: this.save,
      signIn: (action, username, password) => this.accountDialog.signInWith(action, username, password),
      onSaved: (name) => {
        this.notifications.toast(t('user.welcome', { name }));
        void this.syncScore();
        this.finishWelcome();
      },
    });
    this.remoteDialog = new RemoteDialog(this);
  }

  /** Wires the DOM, starts the frame loop and the service worker. */
  mount(): void {
    applyIcons();
    applyStatic();
    this.refresh();
    this.input.bindButtons();
    // First entry: a signed-in device uploads whatever it kept offline, without any button.
    void this.syncAtRest();
    if (this.needsWelcome()) this.openWelcome();
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
      this.garage.renderCoinShop(this.signedIn());
    };
    byId('garageOpen').onclick = () => this.openGarage();
    byId('settingsNav').onclick = () => this.openSettings();
    byId('aboutNav').onclick = () => this.openAbout();
    byId('rotateOff').onclick = () => void this.input.toggleTilt().catch(() => undefined);
    byId('leaderboardNav').onclick = () => this.openLeaderboard();
    byId('remoteNav').onclick = () => void this.remoteDialog.open();
    byId('pause').onclick = () => this.pause();
    byId('closeModal').onclick = () => byId<HTMLDialogElement>('modal').close();
    byId<HTMLDialogElement>('modal').addEventListener('close', () => {
      const open = byId<HTMLDialogElement>('modal').open;
      // A modal re-opened in the same tick (sign-up -> tutorial) is still open: ignore its stale close.
      if (this.tutorialActive && !open) this.finishTutorial();
      else if (this.welcomeActive && !open) this.finishWelcome();
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
    // Forced sign-in screens hide the close button; every other dialog starts with it visible.
    byId('closeModal').hidden = false;
    const modal = byId<HTMLDialogElement>('modal');
    if (!modal.open) modal.showModal();
  }

  // ---- race flow ----

  start(): void {
    if (this.isModalOpen()) return;
    this.demoRun = this.demoPending();
    this.race.car = this.demoRun ? this.demoCar() : this.selectedCar();
    this.race.start();
    if (this.demoRun) this.notifications.feedback(t('demo.start'));
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
    this.race.car = this.selectedCar();
    this.settledCoins = 0;
    this.previousStatus = 'ready';
    this.setView('menu');
    this.refresh();
    void this.syncAtRest();
  }

  private gameOver(): void {
    if (this.demoRun) this.finishDemo();
    this.settle();
    void this.syncAtRest();
    this.audio.tone(this.race.crashed ? 55 : 65, 0.5, 'sawtooth', 0.3);
    this.setView('overlay');
    showGameOver(this.race, this.save, {
      restart: () => this.start(),
      toMenu: () => this.backToMenu(),
      // Guests can enter (sign up or log in) right from the result; signed-in players get no such button.
      enter: this.signedIn() ? undefined : () => this.openWelcome(),
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
    // Take in anything another tab saved first, so earnings are added to the current wallet.
    this.reconcileWithStorage();
    this.save.coins += Math.max(0, this.race.coins - this.settledCoins);
    this.settledCoins = this.race.coins;
    this.save.best = Math.max(this.save.best, this.race.distance);
    this.save.bestScore = Math.max(this.save.bestScore, Math.floor(this.race.score));
    this.persist();
  }

  /** Guests play fully offline: no uploads, health checks or score submissions. */
  private signedIn(): boolean {
    return this.accountOwner !== null;
  }

  private async syncAtRest(): Promise<void> {
    if (!this.signedIn() || this.isRunning() || navigator.onLine === false || this.accountTransition || !this.sameAccount()) return;
    void this.progressSync.flush();
    if (!this.cloudBackup) await this.checkOnline();
    await this.syncScore();
  }

  /**
   * Checks availability for the manual backup controls, without uploading saves.
   */
  private async checkOnline(): Promise<void> {
    if (!this.signedIn() || this.isRunning() || navigator.onLine === false) return;
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
    if (!this.signedIn() || this.isRunning() || navigator.onLine === false || this.accountTransition || !this.sameAccount() ||
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

  /**
   * Adopts a newer save that another tab or a restore wrote, so this tab never overwrites it.
   * Returns false when that save belongs to another player: this tab is stale and must not write.
   */
  private reconcileWithStorage(): boolean {
    let stored: SaveData;
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return true;
      stored = loadSave({ getItem: () => raw });
    } catch {
      return true;
    }
    if (stored.updatedAt <= this.writtenAt) return true;
    if (stored.playerId !== this.save.playerId) return false;
    Object.assign(this.save, reconcileStoredSave(stored, this.save));
    this.writtenAt = this.save.updatedAt;
    return true;
  }

  private persist(): void {
    if (this.accountTransition || !this.sameAccount()) return;
    this.applyAccountIdentity(this.save);
    if (!this.reconcileWithStorage()) return;
    this.save.updatedAt = Date.now();
    this.writtenAt = this.save.updatedAt;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      this.notifications.toast(t('toast.storage'));
    }
    this.progressSync.queue(this.save);
    this.refresh();
  }

  private applyAccountIdentity(save: SaveData): void {
    if (this.accountOwner) {
      save.playerId = this.accountOwner.id;
      save.username = this.accountOwner.username;
      save.history = [];
    }
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

  /** The one-time demo is available once the tutorial is done and until a run with the demo car ends. */
  private demoPending(): boolean {
    return this.save.tutorialDone && !this.save.demoUsed;
  }

  /** The demo car in its own colours; it is never added to the garage. */
  private demoCar(): CarSpec {
    return CARS.find((candidate) => candidate.id === DEMO_CAR_ID) ?? this.selectedCar();
  }

  /** The demo ends with its first crash or empty tank; the player's own car is used from then on. */
  private finishDemo(): void {
    this.demoRun = false;
    this.save.demoUsed = true;
  }

  /**
   * Whether the optional sign-up screen should greet a new player: no name yet, no account and no tutorial.
   * A device that already has a name (an account, or a name kept from before) is never asked again.
   */
  private needsWelcome(): boolean {
    return this.save.username === null && !this.save.tutorialDone && !this.accountOwner;
  }

  private openWelcome(): void {
    if (this.accountOwner) {
      this.openAccount();
      return;
    }
    this.welcomeActive = true;
    this.openModal();
    this.usernameDialog.render();
  }

  /** Closing the welcome screen (sign-up, guest, or the close button) moves on to the tutorial, once. */
  private finishWelcome(): void {
    this.welcomeActive = false;
    if (!this.save.tutorialDone) this.openTutorial(false);
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

  /**
   * Double taps, pinch zoom and text selection must not break play. Form fields keep
   * their own behaviour; everything else ignores those gestures.
   */
  private bindGestureGuards(): void {
    const isTextField = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement && target.matches('input,textarea,select,[contenteditable="true"]');
    // Double-tap zoom is stopped by the viewport meta and `touch-action: manipulation`; cancelling
    // touchend here would also swallow the click of a quick repeat tap on a menu button.
    document.addEventListener('touchmove', (event) => {
      if (event.touches.length > 1) event.preventDefault();
    }, { passive: false });
    for (const type of ['gesturestart', 'gesturechange', 'gestureend'] as const) {
      document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
    }
    document.addEventListener('dblclick', (event) => {
      if (!isTextField(event.target)) event.preventDefault();
    });
    document.addEventListener('selectstart', (event) => {
      if (!isTextField(event.target)) event.preventDefault();
    });
    // Ctrl/Cmd + wheel and + / - zoom the browser page; the game already has its own camera.
    window.addEventListener('wheel', (event) => {
      if (event.ctrlKey) event.preventDefault();
    }, { passive: false });
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
    this.bindGestureGuards();

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
