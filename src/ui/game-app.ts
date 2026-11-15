import { AudioEngine } from '../audio/audio.ts';
import type {RuntimeConfig} from '../shared/config.ts';
import {
  CARS,
  DEMO_CAR_ID,
  Race,
  type CarSpec,
  type SaveData,
} from '../game/index.ts';
import { applyStatic, detectLang, isLang, setLang, t } from '../i18n/index.ts';
import { Renderer } from '../render/renderer.ts';
import { loadSprites } from '../render/sprites.ts';
import { Hud } from './hud.ts';
import { InputController } from './input.ts';
import { applyIcons } from './icons.ts';
import { Notifications } from './notifications.ts';
import { showGameOver, showPause } from './overlays.ts';
import { RemoteDialog, type RemoteHost } from './remote-dialog.ts';
import { setUnits } from './units.ts';
import { GameProgress } from './game-progress.ts';
import { GamePlatform, registerGameWorker, startGameFrames } from './game-platform.ts';
import { GameOnboarding } from './game-onboarding.ts';
import { presentRaceEvents } from './race-feedback.ts';
import { GameScreens, selectedGameCar, setGameView } from './game-screens.ts';
import { byId } from './dom.ts';

/** A first-time player who has not moved after this many seconds gets the tutorial. */
const IDLE_TUTORIAL_SECONDS = 5;

/** Seconds of play between automatic progress saves. */
const AUTOSAVE_SECONDS = 5;
/** Coordinates the race lifecycle and composes focused browser services. */
export class GameApp implements RemoteHost {
  readonly input = new InputController();

  private readonly progress: GameProgress;
  private readonly platform: GamePlatform;
  private readonly onboarding: GameOnboarding;
  private readonly save: SaveData;
  private readonly race: Race;
  private readonly audio = new AudioEngine();
  private readonly notifications = new Notifications();
  private readonly hud = new Hud();
  private readonly renderer = new Renderer(byId<HTMLCanvasElement>('game'));
  private readonly screens: GameScreens;
  private readonly remoteDialog: RemoteDialog;
  /** The run in progress is the one-time demo with the demo car; its end uses it up. */
  private demoRun = false;

  private previousStatus: Race['status'] = 'ready';
  private clock = 0;
  private lastAutosaveTime = 0;
  private bestDistanceAtStart = 0;
  private recordShown = false;

  constructor(config: RuntimeConfig) {
    this.progress = new GameProgress(config, {
      isRunning: () => this.isRunning(),
      changed: () => this.screens.refresh(),
      storageUnavailable: () => this.notifications.toast(t('toast.storage')),
    });
    this.save = this.progress.save;
    setLang(isLang(this.save.lang) ? this.save.lang : detectLang(navigator.languages));
    setUnits(this.save.units);
    this.race = new Race(selectedGameCar(this.save));

    this.screens = new GameScreens({
      config, save: this.save, race: this.race, audio: this.audio, input: this.input,
      hud: this.hud, notifications: this.notifications, progress: this.progress,
      openModal: () => this.openModal(), resetForCar: () => this.resetForCar(),
      openTutorial: idle => this.onboarding.openTutorial(idle),
      finishWelcome: () => this.onboarding.finishWelcome(),
      takeInstallPrompt: () => this.platform.takeInstallPrompt(),
    });
    this.remoteDialog = new RemoteDialog(this);
    this.onboarding = new GameOnboarding({
      save: this.save, progress: this.progress, username: this.screens.usernameDialog,
      openAccount: () => this.screens.openAccount(), openModal: () => this.openModal(), start: () => this.start(),
    });
    this.platform = new GamePlatform({
      input: this.input, race: this.race, renderer: this.renderer, progress: this.progress,
      isModalOpen: () => this.isModalOpen(), start: () => this.start(), resume: () => this.resume(),
      pause: () => this.pause(), settle: () => this.progress.settle(this.race), unlockAudio: () => this.unlockAudio(),
    });
  }

  /** Wires the DOM, starts the frame loop and the service worker. */
  mount(): void {
    applyIcons();
    applyStatic();
    this.screens.refresh();
    this.input.bindButtons();
    // First entry: a signed-in device uploads whatever it kept offline, without any button.
    void this.progress.syncAtRest();
    if (!this.save.tutorialDone) this.onboarding.openTutorial(false);
    this.input.onTiltChange = (enabled) => {
      document.body.dataset.tilt = enabled ? 'on' : 'off';
      this.screens.settingsDialog.refreshTilt();
      this.platform.checkRotation();
    };
    this.input.onTiltSilent = () => this.notifications.toast(t('tilt.silent'));
    void loadSprites().then(() => this.screens.refresh()).catch(() => undefined);

    this.screens.bindNavigation({
      start: () => this.start(), pause: () => this.pause(), remote: () => { void this.remoteDialog.open(); },
      modalClosed: () => this.onboarding.modalClosed(),
    });

    void this.progress.checkOnline();

    this.platform.bind();
    window.addEventListener('resize', () => this.platform.resize());
    window.visualViewport?.addEventListener('resize', () => this.platform.resize());
    this.platform.resize();
    startGameFrames((dt, now) => this.tick(dt, now));
    registerGameWorker();
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
    modal.scrollTop = 0;
  }

  // ---- race flow ----

  start(): void {
    if (this.isModalOpen()) return;
    this.demoRun = this.demoPending();
    this.race.car = this.demoRun ? this.demoCar() : selectedGameCar(this.save);
    this.race.start();
    if (this.demoRun) this.notifications.feedback(t('demo.start'));
    this.bestDistanceAtStart = this.save.best;
    this.recordShown = false;
    this.progress.resetRunRewards();
    this.lastAutosaveTime = 0;
    this.previousStatus = 'running';
    this.input.clear();
    setGameView('race');
    void this.platform.keepScreenAwake();
    this.unlockAudio();
  }

  pause(): void {
    if (this.race.status === 'paused') {
      this.resume();
      return;
    }
    if (this.race.status !== 'running') return;
    this.race.status = 'paused';
    this.progress.settle(this.race);
    void this.progress.syncAtRest();
    this.input.clear();
    setGameView('overlay');
    showPause({
      resume: () => this.resume(),
      openSettings: () => this.screens.openSettings(),
      toMenu: () => this.backToMenu(),
    });
  }

  resume(): void {
    if (this.race.status !== 'paused' || this.isModalOpen()) return;
    this.input.clear();
    this.race.status = 'running';
    setGameView('race');
    void this.platform.keepScreenAwake();
  }

  private backToMenu(): void {
    if (this.race.distance > 0) this.progress.settle(this.race);
    this.input.clear();
    this.race.reset();
    this.race.car = selectedGameCar(this.save);
    this.progress.resetRunRewards();
    this.previousStatus = 'ready';
    setGameView('menu');
    this.screens.refresh();
    void this.progress.syncAtRest();
  }

  private gameOver(): void {
    const finishedDemo = this.demoRun;
    if (finishedDemo) this.finishDemo();
    this.progress.settle(this.race);
    void this.progress.syncAtRest();
    this.audio.tone(this.race.crashed ? 55 : 65, 0.5, 'sawtooth', 0.3);
    setGameView('overlay');
    showGameOver(this.race, this.save, {
      restart: () => this.start(),
      toMenu: () => this.backToMenu(),
      // Guests can enter (sign up or log in) right from the result; signed-in players get no such button.
      enter: this.progress.signedIn() ? undefined : () => this.onboarding.openWelcome(),
      secondChance: () => {
        if (!this.race.resume(this.save)) return;
        this.progress.persist();
        this.previousStatus = 'running';
        this.input.clear();
        setGameView('race');
      },
    }, finishedDemo ? selectedGameCar(this.save).name : undefined);
  }

  private resetForCar(): void {
    if (this.race.distance > 0) this.progress.settle(this.race);
    this.race.car = selectedGameCar(this.save);
    this.race.reset();
    this.progress.resetRunRewards();
    this.previousStatus = 'ready';
    setGameView('menu');
    this.screens.refresh();
  }

  // ---- per-frame update ----

  private tick(dt: number, now: number): void {
    this.clock += dt;
    const drive = this.input.read();
    this.race.update(dt, drive);
    presentRaceEvents(this.race, this.audio, this.hud, this.notifications);

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
      !this.onboarding.tutorialActive
    ) {
      this.showIdleTutorial();
      return;
    }
    if (this.previousStatus !== 'over' && race.status === 'over') this.gameOver();
    this.previousStatus = race.status;
    if (race.status === 'running' && race.time - this.lastAutosaveTime >= AUTOSAVE_SECONDS) {
      this.progress.settle(this.race);
      this.lastAutosaveTime = race.time;
    }

    this.renderer.draw(race, this.clock, drive);
    this.audio.setMusic(race.status === 'running' ? 'race' : 'menu');
    this.audio.update(race, drive.brake === true, drive.accelerate === true);
    this.hud.update(race, this.bestDistanceAtStart, now);
  }

  // ---- one-time demo and idle tutorial ----

  /** The one-time demo is available once the tutorial is done and until a run with the demo car ends. */
  private demoPending(): boolean {
    return this.save.tutorialDone && !this.save.demoUsed;
  }

  /** The demo car in its own colours; it is never added to the garage. */
  private demoCar(): CarSpec {
    return CARS.find((candidate) => candidate.id === DEMO_CAR_ID) ?? selectedGameCar(this.save);
  }

  /** The demo ends with its first crash or empty tank; the player's own car is used from then on. */
  private finishDemo(): void {
    this.demoRun = false;
    this.save.demoUsed = true;
  }

  /** Nobody moved in the first seconds of a first run: show how to drive, then start over. */
  private showIdleTutorial(): void {
    this.race.reset();
    this.progress.resetRunRewards();
    this.previousStatus = 'ready';
    setGameView('menu');
    this.screens.refresh();
    this.onboarding.openTutorial(true);
  }

  /** Browsers only allow audio after a user gesture, so the first one switches it on. */
  private unlockAudio(): void {
    if (this.save.sound && !this.audio.enabled) this.audio.setEnabled(true).catch(() => undefined);
  }

}
