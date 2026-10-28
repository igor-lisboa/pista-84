import type { AudioEngine } from '../audio/audio.ts';
import { AudioUnavailableError } from '../audio/audio.ts';
import type { SaveData } from '../game/index.ts';
import { LANGS, getLang, isLang, t, type Lang } from '../i18n/index.ts';
import { byId } from './dom.ts';
import { flagSvg } from './flags.ts';
import { TiltError, type InputController } from './input.ts';
import type { Notifications } from './notifications.ts';

export interface InstallPrompt {
  prompt(): Promise<unknown>;
}

export interface SettingsDeps {
  readonly save: SaveData;
  readonly audio: AudioEngine;
  readonly input: InputController;
  readonly notify: Notifications;
  persist(): void;
  /** Applies a new UI language everywhere. */
  changeLanguage(lang: Lang): void;
  /** Opens the player-name dialog. */
  editUsername(): void;
  installPrompt(): InstallPrompt | null;
}

/** Options dialog: sound, tilt steering, fullscreen, install and language. */
export class SettingsDialog {
  private readonly deps: SettingsDeps;
  private installed = false;
  private installing = false;

  constructor(deps: SettingsDeps) {
    this.deps = deps;
    window.addEventListener('appinstalled', () => {
      this.installed = true;
      this.updateInstallButton();
    });
    window.matchMedia('(display-mode: standalone)').addEventListener('change', () => this.updateInstallButton());
  }

  render(): void {
    const { audio, input, save } = this.deps;
    const flags = (Object.entries(LANGS) as [Lang, string][])
      .map(([code, name]) => {
        const active = code === getLang();
        return `<button class="flag ${active ? 'active' : ''}" data-lang="${code}" role="radio" aria-checked="${active}" aria-label="${name}" title="${name}">${flagSvg(code)}</button>`;
      })
      .join('');
    byId('modalBody').innerHTML = `
      <span class="label">${t('set.label')}</span>
      <h1>${t('set.title')}<span>.</span></h1>
      <div class="settings-list">
        <div class="language-picker"><span class="label">${t('set.language')}</span><div class="flags" role="radiogroup" aria-label="${t('set.language')}">${flags}</div></div>
        <button id="username">${t('set.username', { name: save.username ?? '—' })}</button>
        <button id="sound" aria-pressed="${audio.enabled}">${audio.enabled ? t('set.soundOn') : t('set.soundOff')}</button>
        <button id="tilt">${input.tiltEnabled ? t('set.tiltOn') : t('set.tiltOff')}</button>
        <button id="calibrate" ${input.tiltEnabled ? '' : 'hidden'}>${t('set.calibrate')}</button>
        <button id="fullscreen">${t('set.fullscreen')}</button>
        <button id="install" aria-describedby="installHelp">${t('set.install')}</button>
        <p id="installHelp" role="status" hidden></p>
      </div>
      <p id="sensorStatus">${t('set.sensor')}</p>
      <p class="help-keys">${t('set.keys')}</p>
      <small class="label">${t('set.version')}</small>`;

    for (const flag of document.querySelectorAll<HTMLButtonElement>('.flag')) {
      flag.onclick = () => {
        const lang = flag.dataset.lang;
        if (isLang(lang) && lang !== getLang()) this.deps.changeLanguage(lang);
      };
    }
    byId('username').onclick = () => this.deps.editUsername();
    byId('sound').onclick = () => void this.toggleSound();
    byId('tilt').onclick = () => void this.toggleTilt();
    byId('calibrate').onclick = () => {
      input.calibrate();
      this.deps.notify.toast(t('tilt.centered'));
    };
    byId('fullscreen').onclick = () => void this.toggleFullscreen();

    this.updateInstallButton();
    byId('install').onclick = () => void this.install();
  }

  private updateInstallButton(): void {
    const button = document.querySelector<HTMLButtonElement>('#install');
    if (!button) return;
    const installed = this.installed || window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    button.disabled = installed || this.installing;
    button.textContent = t(installed ? 'set.installed' : 'set.install');
    if (installed) document.querySelector<HTMLElement>('#installHelp')?.setAttribute('hidden', '');
  }

  private async install(): Promise<void> {
    if (this.installing) return;
    const prompt = this.deps.installPrompt();
    if (prompt) {
      this.installing = true;
      document.querySelector<HTMLElement>('#installHelp')?.setAttribute('hidden', '');
      this.updateInstallButton();
      try {
        await prompt.prompt();
      } catch {
        this.showInstallHelp();
      } finally {
        this.installing = false;
        this.updateInstallButton();
      }
    } else this.showInstallHelp();
  }

  private showInstallHelp(): void {
    const help = document.querySelector<HTMLElement>('#installHelp');
    if (!help) return;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    help.textContent = t(ios ? 'set.installIos' : 'set.installBrowser');
    help.hidden = false;
    help.scrollIntoView({ block: 'nearest' });
  }

  private async toggleSound(): Promise<void> {
    const { audio, save } = this.deps;
    try {
      save.sound = await audio.toggle();
      byId('sound').textContent = audio.enabled ? t('set.soundOn') : t('set.soundOff');
      byId('sound').setAttribute('aria-pressed', String(audio.enabled));
      this.deps.persist();
    } catch (error) {
      if (!(error instanceof AudioUnavailableError)) console.error(error);
      this.deps.notify.toast(t('toast.audio'));
    }
  }

  private async toggleTilt(): Promise<void> {
    const { input, notify } = this.deps;
    try {
      const enabled = await input.toggleTilt();
      byId('tilt').textContent = enabled ? t('tilt.on') : t('tilt.off');
      byId('calibrate').hidden = !enabled;
      notify.toast(enabled ? t('tilt.hold') : t('tilt.buttons'));
    } catch (error) {
      notify.toast(error instanceof TiltError ? t(error.key) : String(error));
    }
  }

  private async toggleFullscreen(): Promise<void> {
    const app = byId('app');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (app.requestFullscreen) await app.requestFullscreen();
      else this.deps.notify.toast(t('toast.safari'));
    } catch {
      this.deps.notify.toast(t('toast.fullscreen'));
    }
  }
}
