import type {DriveInput} from '../game/index.ts';
import {clamp} from '../game/index.ts';
import type {RemoteInput} from '../net/remote.ts';
import {TiltControl} from './tilt-control.ts';
export {TiltError} from './tilt-control.ts';
export {gravityOnScreen, screenLean} from './tilt-math.ts';

/** Browser autofill dispatches key events without a `key`, so it may be undefined at runtime. */
const normalizeKey = (key: string | undefined): string => {
  if (!key) return '';
  return key.length === 1 ? key.toLowerCase() : key;
};

/** Combines keyboard, buttons, tilt and a paired phone into one drive input. */
export class InputController {
  onTiltChange: (enabled: boolean) => void = () => {};
  onTiltSilent: () => void = () => {};
  private readonly tiltControl = new TiltControl();
  private readonly keys = new Set<string>();
  private readonly held = new Map<number | string, string>();
  private remote: Partial<RemoteInput> = {};

  constructor() {
    this.tiltControl.onChange = enabled => this.onTiltChange(enabled);
    this.tiltControl.onSilent = () => this.onTiltSilent();
  }

  get tiltEnabled(): boolean { return this.tiltControl.enabled; }
  toggleTilt(): Promise<boolean> { return this.tiltControl.toggle(); }

  read(): DriveInput {
    const pressed = (...names: string[]): boolean => names.some((name) => this.keys.has(name));
    const right = pressed('ArrowRight', 'd') || this.isHeld('right') ? 1 : 0;
    const left = pressed('ArrowLeft', 'a') || this.isHeld('left') ? 1 : 0;
    const tilt = this.tiltControl.steer;
    return {
      steer: clamp(right - left + tilt + (this.remote.steer ?? 0), -1, 1),
      accelerate: pressed('ArrowUp', 'w') || this.isHeld('accelerate') || this.remote.accelerate === true,
      brake: pressed('ArrowDown', 's', ' ') || this.isHeld('brake') || this.remote.brake === true,
    };
  }

  clear(): void {
    this.keys.clear();
    this.held.clear();
    this.remote = {};
    this.tiltControl.clear();
    document.querySelectorAll('.pressed').forEach((element) => element.classList.remove('pressed'));
  }

  setRemote(input: Partial<RemoteInput>): void {
    this.remote = input;
  }

  clearRemote(): void {
    this.remote = {};
  }

  /** Records a key press and returns its normalised name. */
  keyDown(event: KeyboardEvent): string {
    const key = normalizeKey(event.key);
    this.keys.add(key);
    return key;
  }

  keyUp(event: KeyboardEvent): void {
    this.keys.delete(normalizeKey(event.key));
  }

  /** Wires every `[data-control]` button under `root` to the held-button map. */
  bindButtons(root: ParentNode = document): void {
    for (const element of root.querySelectorAll<HTMLElement>('[data-control]')) {
      const name = element.dataset.control!;
      const press = (id: number | string, event: Event): void => {
        event.preventDefault();
        this.held.set(id, name);
        element.classList.add('pressed');
      };
      const release = (id: number | string): void => {
        this.held.delete(id);
        if (!this.isHeld(name)) element.classList.remove('pressed');
      };

      if (window.PointerEvent) {
        element.addEventListener('pointerdown', (event) => {
          press(event.pointerId, event);
          try {
            element.setPointerCapture(event.pointerId);
          } catch {
            // Pointer capture is optional.
          }
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
          element.addEventListener(type, (event) => release((event as PointerEvent).pointerId));
        }
      } else {
        element.addEventListener(
          'touchstart',
          (event) => {
            for (const touch of event.changedTouches) press(touch.identifier, event);
          },
          { passive: false },
        );
        for (const type of ['touchend', 'touchcancel']) {
          element.addEventListener(
            type,
            (event) => {
              event.preventDefault();
              for (const touch of (event as TouchEvent).changedTouches) release(touch.identifier);
            },
            { passive: false },
          );
        }
        element.addEventListener('mousedown', (event) => press('mouse', event));
        window.addEventListener('mouseup', () => release('mouse'));
      }
      // Safari may still interpret rapid taps as zoom when only pointerdown is cancelled.
      // Cancel the native touch completion too, including on Pointer Events browsers.
      element.addEventListener('touchend', (event) => event.preventDefault(), { passive: false });
      element.addEventListener('dblclick', (event) => event.preventDefault());
      element.addEventListener('contextmenu', (event) => event.preventDefault());
    }
  }

  private isHeld(name: string): boolean {
    for (const held of this.held.values()) if (held === name) return true;
    return false;
  }
}
