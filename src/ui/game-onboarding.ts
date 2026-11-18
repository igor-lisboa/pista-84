import type { SaveData } from '../game/save.ts';
import type { GameProgress } from './game-progress.ts';
import type { UsernameDialog } from './username.ts';
import { TutorialDialog } from './tutorial.ts';
import { byId } from './dom.ts';
import { t } from '../i18n/index.ts';
import { selectedGameCar } from './game-screens.ts';

interface OnboardingHost {
  readonly save: SaveData;
  readonly progress: GameProgress;
  readonly username: UsernameDialog;
  openAccount(): void;
  openModal(): void;
  start(): void;
}

/** Tutorial and optional welcome own the modal until any close route completes them. */
export class GameOnboarding {
  tutorialActive = false;
  private tutorialRestart = false;
  private welcomeActive = false;
  private introductionActive = false;
  private readonly tutorialDialog = new TutorialDialog();
  private readonly host: OnboardingHost;

  constructor(host: OnboardingHost) { this.host = host; }

  modalClosed(): void {
    // A dialog reopened in the same tick still owns the modal; ignore stale close events.
    if (byId<HTMLDialogElement>('modal').open) return;
    if (this.introductionActive) {
      this.introductionActive = false;
      if (!this.host.save.tutorialDone) this.openTutorial(false);
    } else if (this.tutorialActive) this.finishTutorial();
    else if (this.welcomeActive) this.finishWelcome();
  }

  /** Explain the demo loan before teaching controls or entering the menu. */
  openIntroduction(): void {
    this.introductionActive = true;
    this.host.openModal();
    byId('modalBody').innerHTML = `
      <span class="label">PISTA 84</span>
      <h1>${t('intro.title')}<span>.</span></h1>
      <div class="intro-stage"><strong>${t('intro.demoTitle')}</strong><p>${t('intro.demo')}</p></div>
      <div class="intro-stage"><strong>${t('intro.garageTitle')}</strong><p id="introCar"></p></div>
      <button id="introContinue" class="menu-button go"><span>${t('intro.continue')}</span></button>`;
    byId('introCar').textContent = t('intro.garage', { car: selectedGameCar(this.host.save).name });
    byId('introContinue').onclick = () => byId<HTMLDialogElement>('modal').close();
    byId('introContinue').focus({ preventScroll: true });
  }

  openWelcome(): void {
    if (this.host.progress.signedIn()) {
      this.host.openAccount();
      return;
    }
    this.welcomeActive = true;
    this.host.openModal();
    this.host.username.render();
  }

  /** Closing the welcome screen (sign-up, guest, or the close button) moves on to the tutorial, once. */
  finishWelcome(): void {
    this.welcomeActive = false;
    if (!this.host.save.tutorialDone) this.openTutorial(false);
  }

  /** Opens the tutorial; `idle` means the player did not move and the race will restart afterwards. */
  openTutorial(idle: boolean): void {
    this.tutorialActive = true;
    this.tutorialRestart = idle;
    this.host.openModal();
    this.tutorialDialog.open(idle);
  }

  private finishTutorial(): void {
    this.tutorialActive = false;
    if (!this.host.save.tutorialDone) {
      this.host.save.tutorialDone = true;
      this.host.progress.persist();
    }
    if (this.tutorialRestart) {
      this.tutorialRestart = false;
      this.host.start();
    }
  }

}
