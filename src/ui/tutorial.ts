import { CHECKPOINT_FUEL } from '../game/index.ts';
import { t, type MessageKey } from '../i18n/index.ts';
import { byId } from './dom.ts';
import { icon } from './icons.ts';

interface Step {
  readonly id: 'accel' | 'steer' | 'brake' | 'do' | 'dont';
  readonly icon: Parameters<typeof icon>[0];
}

const STEPS: readonly Step[] = [
  { id: 'accel', icon: 'play' },
  { id: 'steer', icon: 'curve' },
  { id: 'brake', icon: 'pause' },
  { id: 'do', icon: 'fuel' },
  { id: 'dont', icon: 'close' },
];

/** Step-by-step "how to play"; closing the modal (finish, skip or X) ends it. */
export class TutorialDialog {
  private step = 0;
  private idle = false;

  /** `idle` explains why it popped up: the player did not move at the start of a race. */
  open(idle = false): void {
    this.step = 0;
    this.idle = idle;
    this.render();
  }

  private render(): void {
    const current = STEPS[this.step]!;
    const last = this.step === STEPS.length - 1;
    const key = (part: 'title' | 'body'): MessageKey => `tut.${current.id}.${part}` as MessageKey;
    const dots = STEPS.map((_, index) => `<i class="${index === this.step ? 'on' : ''}"></i>`).join('');
    byId('modalBody').innerHTML = `
      <span class="label">${t('tut.label')}</span>
      <h1>${t(key('title'))}<span>.</span></h1>
      ${this.idle && this.step === 0 ? `<p class="warning">${t('tut.idle')}</p>` : ''}
      <div class="tutorial-card tutorial-${current.id}">
        <span class="tutorial-icon">${icon(current.icon)}</span>
        <p>${t(key('body'), { fuel: CHECKPOINT_FUEL })}</p>
      </div>
      <div class="tutorial-dots" aria-hidden="true">${dots}</div>
      <p class="tutorial-count" role="status">${t('tut.step', { n: this.step + 1, total: STEPS.length })}</p>
      <div class="confirm-actions">
        <button id="tutBack" class="menu-button" ${this.step === 0 ? 'disabled style="visibility:hidden"' : ''}><span>${t('tut.back')}</span></button>
        <button id="tutNext" class="menu-button ${last ? 'go' : ''}"><span>${last ? t('tut.start') : t('tut.next')}</span></button>
      </div>
      ${last ? '' : `<button id="tutSkip" class="tutorial-skip">${t('tut.skip')}</button>`}`;
    // Back stays in the layout (just invisible) on step 1 so Next never changes position.
    byId('tutBack').onclick = () => {
      this.step -= 1;
      this.render();
    };
    byId('tutNext').onclick = () => {
      if (last) byId<HTMLDialogElement>('modal').close();
      else {
        this.step += 1;
        this.render();
      }
    };
    if (!last) byId('tutSkip').onclick = () => byId<HTMLDialogElement>('modal').close();
    byId('tutNext').focus();
  }
}
