import {
  MENU_TRACK,
  RACE_TRACKS,
  STEPS_PER_BAR,
  midiToHz,
  stepSeconds,
  type Track,
  type Waveform,
} from './tracks.ts';

export type MusicMode = 'menu' | 'race';

/** How far ahead of the audio clock notes are queued, and how often we top up. */
const LOOKAHEAD_SECONDS = 0.15;
const SCHEDULER_INTERVAL_MS = 30;
const FADE_SECONDS = 0.35;

interface NoteOptions {
  readonly wave: Waveform;
  readonly volume: number;
  readonly attack?: number;
  readonly release?: number;
  /** Low-pass cut-off in Hz; omitted for an unfiltered voice. */
  readonly cutoff?: number;
}

/**
 * Procedural background music. A lookahead scheduler walks the 16-step grid of a
 * `Track` and renders each voice with plain Web Audio oscillators and noise.
 * The menu plays a calm loop; every race picks a different upbeat track.
 */
export class MusicPlayer {
  private bus: GainNode | null = null;
  private track: Track | null = null;
  private mode: MusicMode | null = null;
  private lastRaceTrack = -1;
  private step = 0;
  private bar = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly ctx: AudioContext;
  private readonly output: AudioNode;
  private readonly noise: AudioBuffer;

  constructor(ctx: AudioContext, output: AudioNode) {
    this.ctx = ctx;
    this.output = output;
    this.noise = this.createNoise();
  }

  /** Switches between the menu and race music, crossfading when the mode changes. */
  play(mode: MusicMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.fadeOutCurrent();
    this.track = mode === 'menu' ? MENU_TRACK : this.pickRaceTrack();
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.gain.setTargetAtTime(1, this.ctx.currentTime, FADE_SECONDS / 3);
    this.bus.connect(this.output);
    this.step = 0;
    this.bar = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer ??= setInterval(() => this.schedule(), SCHEDULER_INTERVAL_MS);
  }

  stop(): void {
    this.mode = null;
    this.track = null;
    this.fadeOutCurrent();
    this.bus = null;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private fadeOutCurrent(): void {
    const old = this.bus;
    if (!old) return;
    old.gain.setTargetAtTime(0, this.ctx.currentTime, FADE_SECONDS / 3);
    setTimeout(() => old.disconnect(), FADE_SECONDS * 4000);
  }

  /** Random race track, never the same one twice in a row. */
  private pickRaceTrack(): Track {
    let index = Math.floor(Math.random() * RACE_TRACKS.length);
    if (index === this.lastRaceTrack) index = (index + 1) % RACE_TRACKS.length;
    this.lastRaceTrack = index;
    return RACE_TRACKS[index]!;
  }

  private schedule(): void {
    const track = this.track;
    if (!track || !this.bus) return;
    const stepLength = stepSeconds(track);
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD_SECONDS) {
      this.playStep(track, this.step, this.bar, this.nextTime, stepLength);
      this.nextTime += stepLength;
      this.step += 1;
      if (this.step === STEPS_PER_BAR) {
        this.step = 0;
        this.bar = (this.bar + 1) % track.chords.length;
      }
    }
  }

  private playStep(track: Track, step: number, bar: number, time: number, stepLength: number): void {
    const chord = track.chords[bar]!;
    const root = chord[0]!;

    if (track.pad && step === 0) this.pad(chord, time, stepLength * STEPS_PER_BAR, track.mix.pad);

    const bassOffset = track.bass[step];
    if (bassOffset !== null && bassOffset !== undefined) {
      this.note(midiToHz(root - 24 + bassOffset), time, stepLength * 1.6, {
        wave: track.bassWave,
        volume: track.mix.bass * 0.45,
        attack: 0.005,
        cutoff: 700,
      });
    }

    const arpIndex = track.arp[step];
    if (arpIndex !== null && arpIndex !== undefined) {
      const tone = chord[arpIndex % chord.length]!;
      this.note(midiToHz(tone + 12), time, stepLength * 1.2, {
        wave: track.arpWave,
        volume: track.mix.arp * 0.5,
        attack: 0.004,
        release: 0.08,
        cutoff: 3200,
      });
    }

    if (track.stabs.includes(step)) {
      for (const tone of chord) {
        this.note(midiToHz(tone), time, stepLength * 1.4, {
          wave: 'triangle',
          volume: track.mix.pad * 0.28,
          attack: 0.004,
          release: 0.1,
        });
      }
    }

    const drums = track.mix.drums;
    if (track.kick.includes(step)) this.kick(time, drums);
    if (track.snare.includes(step)) this.snare(time, drums);
    if (track.hats.includes(step)) this.hat(time, drums * (step % 4 === 2 ? 1 : 0.6));
  }

  /** One enveloped oscillator routed to the music bus. */
  private note(freq: number, start: number, duration: number, options: NoteOptions): void {
    const { wave, volume, attack = 0.01, release = 0.12, cutoff } = options;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    const end = start + duration + release;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + attack);
    gain.gain.setValueAtTime(volume, start + duration);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    let tail: AudioNode = osc;
    if (cutoff) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      osc.connect(filter);
      tail = filter;
    }
    tail.connect(gain);
    gain.connect(this.bus!);
    osc.start(start);
    osc.stop(end + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /** Slow-attack chord for the calm menu loop. */
  private pad(chord: readonly number[], start: number, duration: number, volume: number): void {
    for (const tone of chord) {
      this.note(midiToHz(tone), start, duration * 0.92, {
        wave: 'triangle',
        volume: volume * 0.2,
        attack: duration * 0.25,
        release: duration * 0.2,
        cutoff: 1400,
      });
    }
  }

  private kick(start: number, volume: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, start);
    osc.frequency.exponentialRampToValueAtTime(42, start + 0.12);
    gain.gain.setValueAtTime(volume * 0.9, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    osc.connect(gain);
    gain.connect(this.bus!);
    osc.start(start);
    osc.stop(start + 0.22);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private snare(start: number, volume: number): void {
    this.noiseBurst(start, 0.16, 'bandpass', 1900, volume * 0.5);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, start);
    osc.frequency.exponentialRampToValueAtTime(120, start + 0.08);
    gain.gain.setValueAtTime(volume * 0.25, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
    osc.connect(gain);
    gain.connect(this.bus!);
    osc.start(start);
    osc.stop(start + 0.12);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private hat(start: number, volume: number): void {
    this.noiseBurst(start, 0.045, 'highpass', 7500, volume * 0.22);
  }

  private noiseBurst(start: number, duration: number, type: BiquadFilterType, frequency: number, volume: number): void {
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = this.noise;
    filter.type = type;
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.bus!);
    source.start(start, Math.random() * 0.5);
    source.stop(start + duration + 0.02);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  private createNoise(): AudioBuffer {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
