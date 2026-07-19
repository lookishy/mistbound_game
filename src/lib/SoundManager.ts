class SoundManagerClass {
  private initialized: boolean = false;
  private audioCtx: AudioContext | null = null;

  public init() {
    if (this.initialized) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.initialized = true;
      }
    } catch (e) {
      console.error('Web Audio API not supported', e);
    }
  }

  // Synthesize short high-pitched chime (Supply Card)
  private playSupply() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  // Synthesize rising triumphant chime (Conquest Success)
  private playConquestSuccess() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  // Synthesize low heavy thud (Conquest Fail)
  private playConquestFail() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  // Synthesize oscillating siren (Event Alert)
  private playEventAlert() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const duration = 1.5;

    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const masterGain = ctx.createGain();

    // Main tone
    osc.type = 'sawtooth';
    osc.frequency.value = 250;

    // LFO for the siren effect
    lfo.type = 'sine';
    lfo.frequency.value = 4; // 4Hz oscillation
    lfoGain.gain.value = 50; // Sweep +-50Hz

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.2);
    masterGain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + duration - 0.2);
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    osc.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc.start();
    lfo.start();
    osc.stop(ctx.currentTime + duration);
    lfo.stop(ctx.currentTime + duration);
  }

  // Synthesize arpeggiated major chord (Victory)
  private playVictory() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;

    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // C Major Arpeggio (C4, E4, G4, C5)
    playNote(261.63, now, 1.0);
    playNote(329.63, now + 0.15, 1.0);
    playNote(392.00, now + 0.3, 1.0);
    playNote(523.25, now + 0.45, 2.0);
  }

  public play(key: 'supply' | 'conquestSuccess' | 'conquestFail' | 'eventAlert' | 'victory') {
    if (!this.initialized) {
        this.init();
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    switch (key) {
      case 'supply':
        this.playSupply();
        break;
      case 'conquestSuccess':
        this.playConquestSuccess();
        break;
      case 'conquestFail':
        this.playConquestFail();
        break;
      case 'eventAlert':
        this.playEventAlert();
        break;
      case 'victory':
        this.playVictory();
        break;
    }
  }
}

export const SoundManager = new SoundManagerClass();
