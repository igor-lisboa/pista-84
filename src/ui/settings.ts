import type { AudioEngine } from '../audio/audio.ts';
import { AudioUnavailableError } from '../audio/audio.ts';
import type { SaveData } from '../game/index.ts';
import { LANGS, getLang, isLang, t, type Lang } from '../i18n/index.ts';
import { byId } from './dom.ts';
import { TiltError, type InputController } from './input.ts';
import type { Notifications } from './notifications.ts';

export interface InstallPrompt {
  prompt(): Promise<void>;
}

export interface SettingsDeps {
  readonly save: SaveData;
  readonly audio: AudioEngine;
  readonly input: InputController;
  readonly notify: Notifications;
  persist(): void;
  /** Applies a new UI language everywhere. */
  changeLanguage(lang: Lang): void;
  installPrompt(): InstallPrompt | null;
}

/** Options dialog: sound, tilt steering, fullscreen, install and language. */
export class SettingsDialog {
  private readonly deps: SettingsDeps;

  constructor(deps: SettingsDeps) {
    this.deps = deps;
  }

  render(): void {
    const { audio, input } = this.deps;
    const languages = (Object.entries(LANGS) as [Lang, string][])
      .map(([code, name]) => `<option value="${code}" ${code === getLang() ? 'selected' : ''}>${name}</option>`)
      .join('');
    byId('modalBody').innerHTML = `
      <span class="label">${t('set.label')}</span>
      <h1>${t('set.title')}<span>.</span></h1>
      <div class="settings-list">
        <label>${t('set.language')}<select id="language">${languages}</select></label>
        <button id="sound" aria-pressed="${audio.enabled}">${audio.enabled ? t('set.soundOn') : t('set.soundOff')}</button>
        <button id="tilt">${input.tiltEnabled ? t('set.tiltOn') : t('set.tiltOff')}</button>
        <button id="calibrate" ${input.tiltEnabled ? '' : 'hidden'}>${t('set.calibrate')}</button>
        <button id="fullscreen">${t('set.fullscreen')}</button>
        <button id="install" hidden>${t('set.install')}</button>
      </div>
      <p id="sensorStatus">${t('set.sensor')}</p>
      <p class="help-keys">${t('set.keys')}</p>
      <small class="label">${t('set.version')}</small>`;

    byId<HTMLSelectElement>('language').onchange = (event) => {
      const value = (event.target as HTMLSelectElement).value;
      if (isLang(value)) this.deps.changeLanguage(value);
    };
    byId('sound').onclick = () => void this.toggleSound();
    byId('tilt').onclick = () => void this.toggleTilt();
    byId('calibrate').onclick = () => {
      input.calibrate();
      this.deps.notify.toast(t('tilt.centered'));
    };
    byId('fullscreen').onclick = () => void this.toggleFullscreen();

    const install = this.deps.installPrompt();
    if (install) {
      byId('install').hidden = false;
      byId('install').onclick = () => void install.prompt();
    }
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
