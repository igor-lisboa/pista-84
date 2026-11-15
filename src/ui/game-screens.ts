import { CARS, PAINTS, type CarSpec, type Race, type SaveData } from '../game/index.ts';
import type { RuntimeConfig } from '../shared/config.ts';
import type { AudioEngine } from '../audio/audio.ts';
import { applyStatic, detectLang, isLang, setLang, t, type Lang } from '../i18n/index.ts';
import { AccountDialog } from './account.ts';
import { AboutDialog } from './about.ts';
import { Garage } from './garage.ts';
import { LeaderboardDialog } from './leaderboard.ts';
import { SettingsDialog, type InstallPrompt } from './settings.ts';
import { UsernameDialog } from './username.ts';
import { byId, formatInteger } from './dom.ts';
import { distanceUnit, formatDistance, setUnits } from './units.ts';
import { applyIcons } from './icons.ts';
import { paintCarPreview } from './car-art.ts';
import type { InputController } from './input.ts';
import type { Hud } from './hud.ts';
import type { Notifications } from './notifications.ts';
import type { GameProgress } from './game-progress.ts';

interface ScreenHost {
  readonly config: RuntimeConfig;
  readonly save: SaveData;
  readonly race: Race;
  readonly audio: AudioEngine;
  readonly input: InputController;
  readonly hud: Hud;
  readonly notifications: Notifications;
  readonly progress: GameProgress;
  openModal(): void;
  resetForCar(): void;
  openTutorial(idle: boolean): void;
  finishWelcome(): void;
  takeInstallPrompt(): InstallPrompt | null;
}

export function selectedGameCar(save: SaveData): CarSpec {
  const car = CARS.find(candidate => candidate.id === save.selected) ?? CARS[0]!;
  const paint = PAINTS.find(candidate => candidate.id === save.paint);
  return { ...car, color: paint?.color ?? car.color };
}

/** Dialog construction and menu presentation share one explicit dependency boundary. */
export class GameScreens {
  readonly settingsDialog: SettingsDialog;
  readonly usernameDialog: UsernameDialog;
  private readonly accountDialog: AccountDialog;
  private readonly garage: Garage;
  private readonly aboutDialog = new AboutDialog();
  private readonly leaderboardDialog: LeaderboardDialog;
  private readonly host: ScreenHost;

  constructor(host: ScreenHost) {
    this.host = host;
    this.leaderboardDialog = new LeaderboardDialog({ signedIn: () => host.progress.signedIn(), openAccount: () => this.openAccount() });
    this.accountDialog = new AccountDialog({
      save: this.host.save,
      switching: () => this.host.progress.beginAccountChange(),
      finished: () => this.host.progress.finishAccountChange(),
      signedIn: (save, user) => {
        this.host.progress.adoptAccount(save, user);
        this.host.race.reset();
        setUnits(this.host.save.units);
        setLang(isLang(this.host.save.lang) ? this.host.save.lang : detectLang(navigator.languages));
        applyStatic();
        this.host.hud.invalidate();
        this.host.resetForCar();
        this.host.progress.finishAccountChange();
        this.host.progress.persist();
      },
      signedOut: () => this.host.progress.signOut(),
    });

    this.garage = new Garage({
      save: this.host.save,
      race: this.host.race,
      config: this.host.config,
      selectedCar: () => selectedGameCar(this.host.save),
      resetForCar: () => this.host.resetForCar(),
      persist: () => this.host.progress.persist(),
      refreshFeatured: () => this.paintFeaturedCar(),
      toast: (message) => this.host.notifications.toast(message),
      progressToolsEnabled: this.host.config.progressTools ?? true,
      imported: () => {
        setUnits(this.host.save.units);
        this.host.hud.invalidate();
        this.refresh();
        void this.host.progress.syncScore();
      },
    });
    this.settingsDialog = new SettingsDialog({
      save: this.host.save,
      audio: this.host.audio,
      input: this.host.input,
      notify: this.host.notifications,
      persist: () => this.host.progress.persist(),
      changeLanguage: (lang) => this.changeLanguage(lang),
      openAccount: () => this.openAccount(),
      changeUnits: (units) => this.changeUnits(units),
      showTutorial: () => this.host.openTutorial(false),
      installPrompt: () => this.host.takeInstallPrompt(),
    });
    this.usernameDialog = new UsernameDialog({
      save: this.host.save,
      signIn: (action, username, password) => this.accountDialog.signInWith(action, username, password),
      onSaved: (name) => {
        this.host.notifications.toast(t('user.welcome', { name }));
        void this.host.progress.syncScore();
        this.host.finishWelcome();
      },
    });
  }

  bindNavigation(actions: { start(): void; pause(): void; remote(): void; modalClosed(): void }): void {
    byId('start').onclick = actions.start;
    byId('garageNav').onclick = () => this.openGarage();
    byId('coinsNav').onclick = () => {
      this.host.openModal();
      this.garage.renderCoinShop(this.host.progress.signedIn());
    };
    byId('garageOpen').onclick = () => this.openGarage();
    byId('settingsNav').onclick = () => this.openSettings();
    byId('aboutNav').onclick = () => this.openAbout();
    byId('rotateOff').onclick = () => void this.host.input.toggleTilt().catch(() => undefined);
    byId('leaderboardNav').onclick = () => this.openLeaderboard();
    byId('remoteNav').onclick = actions.remote;
    byId('pause').onclick = actions.pause;
    byId('closeModal').onclick = () => byId<HTMLDialogElement>('modal').close();
    byId<HTMLDialogElement>('modal').addEventListener('close', actions.modalClosed);
  }

  changeLanguage(lang: Lang): void {
    this.host.save.lang = lang;
    setLang(lang);
    applyStatic();
    this.host.progress.persist();
    this.host.hud.invalidate();
    this.settingsDialog.render();
  }

  refresh(): void {
    byId('best').textContent = `${formatDistance(this.host.save.best)} ${distanceUnit()}`;
    byId('wallet').textContent = t('coins.amount', { n: formatInteger(this.host.save.coins) });
    byId('carName').textContent = this.host.race.car.name.toUpperCase();
    this.paintFeaturedCar();
  }

  paintFeaturedCar(): void {
    paintCarPreview(byId<HTMLCanvasElement>('menuCar'), selectedGameCar(this.host.save));
  }

  // ---- screens ----

  openGarage(): void {
    this.host.openModal();
    this.garage.render();
  }

  openAbout(): void {
    this.host.openModal();
    this.aboutDialog.render();
    applyIcons();
  }

  openLeaderboard(): void {
    this.host.openModal();
    this.leaderboardDialog.open();
  }

  changeUnits(units: SaveData['units']): void {
    this.host.save.units = units;
    setUnits(units);
    this.host.progress.persist();
    this.host.hud.invalidate();
  }

  openSettings(): void {
    this.host.openModal();
    this.settingsDialog.render();
  }

  openAccount(): void {
    this.host.openModal();
    void this.accountDialog.open();
  }

}

export type GameView = 'menu' | 'race' | 'overlay';

export function setGameView(view: GameView): void {
  document.body.dataset.view = view;
  byId('menu').hidden = view !== 'menu';
  byId('raceUI').hidden = view === 'menu';
  byId('overlay').hidden = view !== 'overlay';
}
