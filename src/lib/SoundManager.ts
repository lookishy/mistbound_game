class SoundManagerClass {
  private initialized: boolean = false;
  private sounds: Record<string, HTMLAudioElement> = {};

  // Sounds configured to the requested paths
  private readonly config: Record<string, string> = {
    supply: '/mistbound_game/audio/supply.mp3',
    conquestSuccess: '/mistbound_game/audio/conquest_success.mp3',
    conquestFail: '/mistbound_game/audio/conquest_fail.mp3',
    eventAlert: '/mistbound_game/audio/event_alert.mp3',
    victory: '/mistbound_game/audio/victory.mp3'
  };

  public init() {
    if (this.initialized) return;

    // We preload Audio objects on first user interaction to bypass autoplay restrictions
    for (const [key, path] of Object.entries(this.config)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      // Load it silently to initialize
      audio.load();
      this.sounds[key] = audio;
    }

    this.initialized = true;
  }

  public play(key: keyof typeof this.config) {
    if (!this.initialized) {
        this.init();
    }

    const sound = this.sounds[key];
    if (sound) {
      sound.currentTime = 0; // reset to start
      sound.play().catch(e => {
          console.warn(`音频播放失败 (可能尚未交互或路径不存在): ${key}`, e);
      });
    }
  }
}

export const SoundManager = new SoundManagerClass();
