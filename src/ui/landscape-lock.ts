/** Owns only the orientation/fullscreen resources requested for tilt steering. */
export class LandscapeLock {
  private generation = 0;
  private wanted = false;
  private fullscreenByTilt = false;

  async acquire(): Promise<void> {
    const generation = ++this.generation;
    this.wanted = true;
    if (typeof screen.orientation?.lock !== 'function') return;
    const installed = matchMedia('(display-mode: standalone)').matches;
    // Request fullscreen while still inside the enabling tap, before sensor permission prompts.
    if (!installed && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen({navigationUI: 'hide'});
        this.fullscreenByTilt = true;
      } catch {
        // Installed/PWA browsers may still allow an orientation lock without fullscreen.
      }
    }
    if (generation !== this.generation) {
      if (!this.wanted) this.cleanup();
      return;
    }
    try {
      await screen.orientation.lock('landscape');
      if (generation !== this.generation && !this.wanted) this.cleanup();
    } catch {
      // The portrait blocker remains authoritative when a browser refuses the OS lock.
    }
  }

  release(): void {
    this.wanted = false;
    this.generation++;
    this.cleanup();
  }

  private cleanup(): void {
    try { screen.orientation?.unlock?.(); } catch { /* Nothing to unlock. */ }
    if (this.fullscreenByTilt && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    this.fullscreenByTilt = false;
  }
}
