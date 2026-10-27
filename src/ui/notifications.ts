import { byId } from './dom.ts';

const TOAST_MS = 4500;
const FEEDBACK_MS = 1500;

/** Transient messages: a toast for longer notices and a short "feedback" flash over the road. */
export class Notifications {
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private feedbackTimer: ReturnType<typeof setTimeout> | undefined;

  toast(message: string): void {
    const element = byId('toast');
    element.textContent = message;
    element.style.display = 'block';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      element.style.display = 'none';
    }, TOAST_MS);
  }

  feedback(message: string): void {
    const element = byId('feedback');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => element.classList.remove('show'), FEEDBACK_MS);
  }
}
