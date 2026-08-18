import type { SettingsStore } from '../settings/settings';
import type { BiomeId } from '../biomes/biomes';

type TrackKind = 'menu' | 'battle';

export type SfxKind =
  | 'ui-click'
  | 'ui-hover'
  | 'ui-select'
  | 'ui-confirm'
  | 'ui-denied'
  | 'ui-formation'
  | 'recruit-knight'
  | 'recruit-archer'
  | 'recruit-tank'
  | 'recruit-champion'
  | 'melee-hit'
  | 'arrow-shot'
  | 'arrow-impact'
  | 'unit-death'
  | 'tower-shot'
  | 'wall-hit'
  | 'wall-break'
  | 'castle-hit'
  | 'structure-hit'
  | 'wave-start'
  | 'wave-complete'
  | 'prep-tick';

const TRACK_URLS: Record<TrackKind, string> = {
  menu: '/audio/menu-music.ogg',
  battle: '/audio/battle-music.ogg',
};

const FADE_TIME = 0.6;

interface Track {
  kind: TrackKind;
  gain: GainNode;
  stop: () => void;
}

interface ChordDef {
  freqs: number[];
  arpeggio: number[];
  bass: number;
}

const MENU_CHORDS: ChordDef[] = [
  { freqs: [220, 261.63, 329.63], arpeggio: [440, 523.25, 659.26], bass: 110 },
  { freqs: [174.61, 220, 261.63], arpeggio: [349.23, 440, 523.25], bass: 87.31 },
  { freqs: [196, 261.63, 329.63], arpeggio: [392, 523.25, 659.26], bass: 98 },
  { freqs: [196, 246.94, 293.66], arpeggio: [392, 493.88, 587.33], bass: 98 },
];

const BATTLE_CHORDS: ChordDef[] = [
  { freqs: [220, 261.63, 329.63], arpeggio: [220, 329.63, 440], bass: 110 },
  { freqs: [174.61, 220, 261.63], arpeggio: [174.61, 261.63, 349.23], bass: 87.31 },
  { freqs: [146.83, 220, 261.63], arpeggio: [146.83, 261.63, 293.66], bass: 73.42 },
  { freqs: [164.81, 246.94, 329.63], arpeggio: [164.81, 246.94, 329.63], bass: 82.41 },
];

class MusicGenerator {
  private step = 0;
  private timer: number | null = null;
  private readonly stepDuration: number;
  private readonly noise: AudioBuffer;

  constructor(
    private readonly ctx: AudioContext,
    private readonly dest: GainNode,
    private readonly kind: TrackKind,
  ) {
    this.stepDuration = kind === 'menu' ? 0.5 : 0.25;
    this.noise = this.makeNoise();
  }

  start(): void {
    this.timer = window.setInterval(() => this.tick(), this.stepDuration * 1000);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private makeNoise(): AudioBuffer {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private tick(): void {
    const chords = this.kind === 'menu' ? MENU_CHORDS : BATTLE_CHORDS;
    const step = this.step++;
    const chord = chords[Math.floor(step / 8) % chords.length];
    const t = this.ctx.currentTime + 0.05;

    if (this.kind === 'menu') {
      if (step % 8 === 0) {
        this.playPad(chord.freqs, t, 4.5, 0.05);
        this.playNote('sine', chord.bass, t, 4.5, 0.035);
      }
      this.playNote('triangle', chord.arpeggio[step % 3], t, 0.35, 0.028);
    } else {
      if (step % 8 === 0) this.playPad(chord.freqs, t, 2.2, 0.045);
      this.playNote('square', chord.bass, t, 0.2, 0.045, 500);
      if (step % 2 === 0) this.playKick(t);
      else this.playHat(t);
      if (step % 16 === 8) this.playRiff(t);
    }
  }

  private playNote(
    type: OscillatorType,
    freq: number,
    t: number,
    dur: number,
    vol: number,
    filterFreq?: number,
  ): void {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    let node: AudioNode = osc;
    if (filterFreq) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      osc.connect(filter);
      node = filter;
    }
    const gain = this.ctx.createGain();
    node.connect(gain);
    gain.connect(this.dest);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private playPad(freqs: number[], t: number, dur: number, vol: number): void {
    for (const freq of freqs) this.playNote('sine', freq, t, dur, vol, 900);
  }

  private playKick(t: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.dest);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private playHat(t: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const gain = this.ctx.createGain();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.dest);
    gain.gain.setValueAtTime(0.03, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.start(t, Math.random() * 0.5, 0.08);
  }

  private playRiff(t: number): void {
    const riff = [440, 523.25, 659.26, 783.99];
    for (let i = 0; i < riff.length; i++) {
      this.playNote('triangle', riff[i], t + i * 0.125, 0.12, 0.03);
    }
  }
}

class AmbientLayer {
  private src: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private accentTimer: number | null = null;
  private biome: BiomeId | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly noise: AudioBuffer,
    private readonly bus: GainNode,
  ) {}

  setBiome(biome: BiomeId): void {
    if (biome === this.biome) return;
    this.biome = biome;
    if (!this.src) this.start();
    if (!this.filter || !this.gain) return;
    const t = this.ctx.currentTime;
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setTargetAtTime(this.filterFreq(biome), t, 0.5);
    this.scheduleAccents();
  }

  stop(): void {
    this.stopAccents();
    if (this.src) {
      try {
        this.src.stop();
      } catch {
        // already stopped
      }
      this.src.disconnect();
      this.src = null;
    }
    if (this.filter) {
      this.filter.disconnect();
      this.filter = null;
    }
    if (this.gain) {
      this.gain.disconnect();
      this.gain = null;
    }
    if (this.lfo) {
      this.lfo.disconnect();
      this.lfo = null;
    }
    if (this.lfoGain) {
      this.lfoGain.disconnect();
      this.lfoGain = null;
    }
    this.biome = null;
  }

  private start(): void {
    const ctx = this.ctx;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.12;
    this.gain.connect(this.bus);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.8;
    this.filter.frequency.value = this.filterFreq(this.biome ?? 'field');
    this.filter.connect(this.gain);
    this.src = ctx.createBufferSource();
    this.src.buffer = this.noise;
    this.src.loop = true;
    this.src.connect(this.filter);
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.15;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0.015;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.gain.gain);
    this.src.start();
    this.lfo.start();
    this.scheduleAccents();
  }

  private filterFreq(biome: BiomeId): number {
    switch (biome) {
      case 'field':
        return 700;
      case 'desert':
        return 500;
      case 'snow':
        return 1600;
      case 'volcanic':
        return 240;
      case 'ruins':
        return 380;
      case 'cosmic':
        return 300;
    }
  }

  private scheduleAccents(): void {
    this.stopAccents();
    const biome = this.biome;
    if (!biome) return;
    const accent = (): void => {
      if (this.biome !== biome) return;
      if (biome === 'field') this.bird();
      else if (biome === 'volcanic') this.crackle();
      else if (biome === 'cosmic') this.chime();
      this.accentTimer = window.setTimeout(accent, 2500 + Math.random() * 3500);
    };
    this.accentTimer = window.setTimeout(accent, 1500 + Math.random() * 2500);
  }

  private stopAccents(): void {
    if (this.accentTimer !== null) {
      window.clearTimeout(this.accentTimer);
      this.accentTimer = null;
    }
  }

  private bird(): void {
    this.blip(2600 + Math.random() * 900, 0.12, 0.05);
    this.blip(2600 + Math.random() * 900, 0.1, 0.05, 0.15);
  }

  private blip(freq: number, dur: number, vol: number, delay = 0): void {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.bus);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private crackle(): void {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;
    const gain = this.ctx.createGain();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.bus);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.start(t, Math.random() * 0.5, 0.1);
  }

  private chime(): void {
    this.blip(1200 + Math.random() * 600, 0.25, 0.04);
  }
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private interfaceBus: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambientLayer: AmbientLayer | null = null;
  private requested: TrackKind | null = null;
  private track: Track | null = null;
  private filePlayers: Partial<Record<TrackKind, HTMLAudioElement>> = {};
  private fileNodes: Partial<Record<TrackKind, MediaElementAudioSourceNode>> = {};
  private fileReady: Partial<Record<TrackKind, boolean>> = {};

  constructor(private readonly settings: SettingsStore) {}

  unlock(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.interfaceBus = this.ctx.createGain();
    this.ambientBus = this.ctx.createGain();
    this.musicBus.connect(this.ctx.destination);
    this.sfxBus.connect(this.ctx.destination);
    this.interfaceBus.connect(this.ctx.destination);
    this.ambientBus.connect(this.ctx.destination);
    this.noiseBuffer = this.makeNoise();
    this.ambientLayer = new AmbientLayer(this.ctx, this.noiseBuffer, this.ambientBus);
    this.applySettings();
    this.detectFiles();
  }

  applySettings(): void {
    if (!this.musicBus || !this.sfxBus || !this.interfaceBus || !this.ambientBus) return;
    const settings = this.settings.value;
    this.musicBus.gain.value = settings.music ? settings.musicVolume : 0;
    this.sfxBus.gain.value = settings.sfx ? settings.sfxVolume : 0;
    this.interfaceBus.gain.value = settings.sfx ? settings.interfaceVolume : 0;
    this.ambientBus.gain.value = settings.sfx && settings.ambient ? settings.ambientVolume : 0;
    if (!settings.music) {
      this.stopTrack();
    } else if (this.requested && !this.track) {
      this.switchTo(this.requested);
    }
  }

  setBiome(biome: BiomeId): void {
    if (this.ambientLayer) this.ambientLayer.setBiome(biome);
  }

  stopAmbient(): void {
    if (this.ambientLayer) this.ambientLayer.stop();
  }

  playSfx(kind: SfxKind): void {
    const ctx = this.ctx;
    const sfx = this.sfxBus;
    const ui = this.interfaceBus;
    if (!ctx || !sfx || !ui) return;
    switch (kind) {
      case 'ui-click':
        this.tone(ui, 'square', 750, 520, 0.06, 0.28);
        break;
      case 'ui-hover':
        this.tone(ui, 'sine', 900, 1150, 0.05, 0.16);
        break;
      case 'ui-select':
        this.tone(ui, 'triangle', 640, 860, 0.07, 0.28);
        break;
      case 'ui-confirm':
        this.tone(ui, 'triangle', 480, 700, 0.08, 0.38);
        this.tone(ui, 'triangle', 700, 980, 0.1, 0.32, 0.09);
        break;
      case 'ui-denied':
        this.tone(ui, 'square', 200, 140, 0.16, 0.38);
        this.burst(ui, 0.12, 0.18, 'lowpass', 700);
        break;
      case 'ui-formation':
        [523.25, 659.26, 783.99].forEach((f, i) => this.tone(ui, 'triangle', f, f, 0.09, 0.28, i * 0.07));
        break;
      case 'recruit-knight':
        this.burst(sfx, 0.08, 0.3, 'bandpass', 2000);
        this.tone(sfx, 'sine', 300, 180, 0.12, 0.28);
        break;
      case 'recruit-archer':
        this.tone(sfx, 'triangle', 620, 300, 0.14, 0.32);
        break;
      case 'recruit-tank':
        this.tone(sfx, 'sine', 150, 60, 0.3, 0.45);
        this.burst(sfx, 0.15, 0.18, 'lowpass', 500);
        break;
      case 'recruit-champion':
        [523.25, 659.26, 783.99, 1046.5].forEach((f, i) =>
          this.tone(sfx, 'triangle', f, f, 0.12, 0.28, i * 0.08),
        );
        break;
      case 'melee-hit':
        this.burst(sfx, 0.08, 0.26, 'lowpass', 1600);
        this.tone(sfx, 'sine', 220, 130, 0.1, 0.22);
        break;
      case 'arrow-shot':
        this.burst(sfx, 0.12, 0.16, 'bandpass', 2400);
        break;
      case 'arrow-impact':
        this.burst(sfx, 0.05, 0.26, 'highpass', 2000);
        break;
      case 'unit-death':
        this.tone(sfx, 'triangle', 420, 140, 0.22, 0.26);
        this.burst(sfx, 0.15, 0.18, 'lowpass', 900);
        break;
      case 'tower-shot':
        this.tone(sfx, 'sine', 120, 45, 0.4, 0.45);
        this.burst(sfx, 0.3, 0.22, 'lowpass', 600);
        break;
      case 'wall-hit':
        this.tone(sfx, 'sine', 160, 70, 0.16, 0.36);
        this.burst(sfx, 0.1, 0.22, 'lowpass', 900);
        break;
      case 'wall-break':
        this.burst(sfx, 0.5, 0.45, 'lowpass', 900);
        this.tone(sfx, 'sine', 110, 35, 0.5, 0.45);
        break;
      case 'castle-hit':
        this.tone(sfx, 'sine', 100, 40, 0.35, 0.5);
        this.burst(sfx, 0.25, 0.26, 'lowpass', 500);
        break;
      case 'structure-hit':
        this.tone(sfx, 'sine', 180, 90, 0.12, 0.32);
        break;
      case 'wave-start':
        this.tone(sfx, 'square', 392, 392, 0.12, 0.28);
        this.tone(sfx, 'square', 587, 587, 0.16, 0.28, 0.15);
        break;
      case 'wave-complete':
        [523.25, 659.26, 783.99, 1046.5].forEach((f, i) =>
          this.tone(sfx, 'triangle', f, f, 0.16, 0.28, i * 0.09),
        );
        break;
      case 'prep-tick':
        this.tone(sfx, 'sine', 1100, 900, 0.05, 0.14);
        break;
    }
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private tone(
    bus: GainNode,
    type: OscillatorType,
    freq0: number,
    freq1: number,
    dur: number,
    vol: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq0), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq1), t + dur);
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(bus);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private burst(
    bus: GainNode,
    dur: number,
    vol: number,
    filterType: BiquadFilterType,
    filterFreq: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  setMusicLevel(level: number): void {
    if (!this.musicBus || !this.ctx) return;
    const target = this.settings.value.music ? level : 0;
    this.musicBus.gain.setTargetAtTime(Math.max(0, target), this.ctx.currentTime, 0.4);
  }

  playMusic(kind: TrackKind): void {
    this.unlock();
    this.requested = kind;
    if (!this.settings.value.music || !this.musicBus) return;
    if (this.track?.kind === kind) return;
    this.switchTo(kind);
  }

  stopMusic(): void {
    this.requested = null;
    this.stopTrack();
  }

  private detectFiles(): void {
    for (const kind of ['menu', 'battle'] as TrackKind[]) {
      const audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
      audio.src = TRACK_URLS[kind];
      audio.addEventListener('canplaythrough', () => {
        this.fileReady[kind] = true;
        this.filePlayers[kind] = audio;
      });
      audio.addEventListener('error', () => {
        this.fileReady[kind] = false;
      });
    }
  }

  private switchTo(kind: TrackKind): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;
    const old = this.track;
    if (old) {
      this.track = null;
      this.fadeOutAndDispose(old);
    }
    const gain = ctx.createGain();
    gain.connect(bus);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    this.track = { kind, gain, stop: this.buildStop(kind, gain) };
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + (old ? FADE_TIME : 0.05));
  }

  private buildStop(kind: TrackKind, gain: GainNode): () => void {
    if (this.fileReady[kind] && this.filePlayers[kind]) {
      const audio = this.filePlayers[kind];
      let node = this.fileNodes[kind];
      if (!node) {
        node = this.ctx!.createMediaElementSource(audio);
        this.fileNodes[kind] = node;
      }
      node.connect(gain);
      void audio.play();
      return () => {
        audio.pause();
        audio.currentTime = 0;
      };
    }
    const generator = new MusicGenerator(this.ctx!, gain, kind);
    generator.start();
    return () => generator.stop();
  }

  private fadeOutAndDispose(track: Track): void {
    const ctx = this.ctx!;
    track.gain.gain.cancelScheduledValues(ctx.currentTime);
    track.gain.gain.setValueAtTime(track.gain.gain.value, ctx.currentTime);
    track.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_TIME);
    window.setTimeout(() => {
      track.stop();
      track.gain.disconnect();
    }, FADE_TIME * 1000);
  }

  private stopTrack(): void {
    const old = this.track;
    if (!old) return;
    this.track = null;
    this.fadeOutAndDispose(old);
  }
}