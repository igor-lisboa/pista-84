import type { AudioEngine } from '../audio/audio.ts';
import { AudioUnavailableError } from '../audio/audio.ts';
import type { SaveData } from '../game/index.ts';
import { LANGS, getLang, isLang, t, type Lang } from '../i18n/index.ts';
import { byId } from './dom.ts';
import { flagSvg } from './flags.ts';
import { icon } from './icons.ts';
import { TiltError, type InputController } from './input.ts';
import type { Notifications } from './notifications.ts';

type IconName = Parameters<typeof icon>[0];

interface RowOptions {
  /** Shows an on/off switch and exposes the state as `aria-pressed`. */
  switch?: boolean;
  pressed?: boolean;
  /** Icon at the far end, for rows that open another dialog. */
  end?: IconName;
  danger?: boolean;
  hidden?: boolean;
  describedBy?: string;
}

/** One tappable settings row: icon, label and a switch or arrow. */
function row(id: string, iconName: IconName, text: string, options: RowOptions = {}): string {
  const end = options.switch
    ? '<i class="switch" aria-hidden="true"></i>'
    : options.end
      ? `<span class="row-end">${icon(options.end)}</span>`
      : '';
  const attrs = [
    options.switch ? `aria-pressed="${options.pressed === true}"` : '',
    options.hidden ? 'hidden' : '',
    options.describedBy ? `aria-describedby="${options.describedBy}"` : '',
  ].filter(Boolean).join(' ');
  return `<button id="${id}" class="setting-row${options.danger ? ' danger' : ''}" ${attrs}><span class="row-icon">${icon(iconName)}</span><span class="row-text">${text}</span>${end}</button>`;
}

/** Changes a row's label (and switch state) without losing its icon. */
function setRow(id: string, text: string, pressed?: boolean): void {
  const element = byId(id);
  element.querySelector('.row-text')!.textContent = text;
  if (pressed !== undefined) element.setAttribute('aria-pressed', String(pressed));
}

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
  changeUnits(units: SaveData['units']): void;
  /** Opens the how-to-play tutorial. */
  showTutorial(): void;
  /** Opens the "start over as a new player" confirmation. */
  newPlayer(): void;
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
      <div class="settings-groups">
        <section class="settings-group">
          <h3 class="group-title">${t('set.groupPlayer')}</h3>
          <div class="setting-card">
            ${row('username', 'user', t('set.username', { name: save.username ?? '—' }), { end: 'arrow' })}
            ${row('newPlayer', 'restart', t('newp.menu'), { end: 'arrow', danger: true })}
          </div>
        </section>
        <section class="settings-group">
          <h3 class="group-title">${t('set.groupGame')}</h3>
          <div class="setting-card">
            <div class="language-picker"><span class="label">${t('set.language')}</span><div class="flags" role="radiogroup" aria-label="${t('set.language')}">${flags}</div></div>
            ${row('units', 'swap', t(save.units === 'mi' ? 'set.unitsMi' : 'set.unitsKm'))}
            ${row('sound', 'volume', audio.enabled ? t('set.soundOn') : t('set.soundOff'), { switch: true, pressed: audio.enabled })}
            ${row('tutorial', 'help', t('set.tutorial'), { end: 'arrow' })}
          </div>
        </section>
        <section class="settings-group">
          <h3 class="group-title">${t('set.groupControls')}</h3>
          <div class="setting-card">
            ${row('tilt', 'phone', input.tiltEnabled ? t('set.tiltOn') : t('set.tiltOff'), { switch: true, pressed: input.tiltEnabled })}
            ${row('calibrate', 'target', t('set.calibrate'), { hidden: !input.tiltEnabled })}
            <p id="sensorStatus" class="settings-note">${t('set.sensor')}</p>
            <p class="settings-note help-keys">${t('set.keys')}</p>
          </div>
        </section>
        <section class="settings-group">
          <h3 class="group-title">${t('set.groupDevice')}</h3>
          <div class="setting-card">
            ${row('fullscreen', 'expand', t('set.fullscreen'))}
            ${row('install', 'download', t('set.install'), { describedBy: 'installHelp' })}
            <p id="installHelp" class="settings-note" role="status" hidden></p>
          </div>
        </section>
      </div>
      <small class="label settings-version">${t('set.version')}</small>`;

    for (const flag of document.querySelectorAll<HTMLButtonElement>('.flag')) {
      flag.onclick = () => {
        const lang = flag.dataset.lang;
        if (isLang(lang) && lang !== getLang()) this.deps.changeLanguage(lang);
      };
    }
    byId('username').onclick = () => this.deps.editUsername();
    byId('units').onclick = () => {
      const units = save.units === 'km' ? 'mi' : 'km';
      this.deps.changeUnits(units);
      setRow('units', t(units === 'mi' ? 'set.unitsMi' : 'set.unitsKm'));
    };
    byId('tutorial').onclick = () => this.deps.showTutorial();
    byId('newPlayer').onclick = () => this.deps.newPlayer();
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
    button.querySelector('.row-text')!.textContent = t(installed ? 'set.installed' : 'set.install');
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
      setRow('sound', audio.enabled ? t('set.soundOn') : t('set.soundOff'), audio.enabled);
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
      setRow('tilt', enabled ? t('tilt.on') : t('tilt.off'), enabled);
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
