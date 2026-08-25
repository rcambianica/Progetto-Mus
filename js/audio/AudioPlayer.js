export class AudioPlayer {
  constructor(audioContext, { onEnded = null } = {}) {
    this.audioContext = audioContext;
    this.onEnded = onEnded;

    this.buffer = null;
    this.source = null;
    this.gainNode = this.audioContext.createGain();

    this.startedAt = 0;
    this.pausedAt = 0;
    this.isPlaying = false;

    this.gainNode.connect(this.audioContext.destination);
  }

  setBuffer(audioBuffer) {
    this.stop();

    this.buffer = audioBuffer;
    this.pausedAt = 0;
  }

  play() {
    if (!this.buffer) {
      throw new Error("No audio buffer loaded.");
    }

    if (this.isPlaying) {
      return;
    }

    const source = this.audioContext.createBufferSource();

    source.buffer = this.buffer;
    source.connect(this.gainNode);

    const offsetSeconds = this.pausedAt;

    this.startedAt = this.audioContext.currentTime - offsetSeconds;

    this.source = source;

    source.onended = () => {
      // Un nodo fermato per pausa, stop o seek può emettere comunque `ended`, quindi gnoriamo gli eventi appartenenti a una source che non è più quella attiva.
      if (this.source !== source) {
        return;
      }

      this.isPlaying = false;
      this.pausedAt = 0;
      this.source = null;

      if (typeof this.onEnded === "function") {
        this.onEnded();
      }
    };

    source.start(0, offsetSeconds);

    this.isPlaying = true;
  }

  pause() {
    if (!this.isPlaying) {
      return;
    }

    this.pausedAt = this.getCurrentTimeMs() / 1000;

    this.stopSourceOnly();

    this.isPlaying = false;
  }

  stop() {
    this.stopSourceOnly();

    this.pausedAt = 0;
    this.isPlaying = false;
  }

  seek(timeMs) {
    if (!this.buffer) {
      return;
    }

    const durationMs = this.buffer.duration * 1000;

    const clampedMs = Math.max(0, Math.min(timeMs, durationMs));

    const wasPlaying = this.isPlaying;

    this.pausedAt = clampedMs / 1000;

    if (!wasPlaying) {
      return;
    }

    this.stopSourceOnly();
    this.isPlaying = false;

    // Se il seek porta esattamente alla fine, non viene creata una nuova source priva di contenuto da riprodurre.
    if (clampedMs >= durationMs) {
      return;
    }

    this.play();
  }

  getCurrentTimeMs() {
    if (!this.buffer) {
      return 0;
    }

    if (!this.isPlaying) {
      return this.pausedAt * 1000;
    }

    const currentSeconds = this.audioContext.currentTime - this.startedAt;

    const durationSeconds = this.buffer.duration;

    return Math.min(currentSeconds, durationSeconds) * 1000;
  }

  getDurationMs() {
    if (!this.buffer) {
      return 0;
    }

    return this.buffer.duration * 1000;
  }

  stopSourceOnly() {
    if (!this.source) {
      return;
    }

    const source = this.source;

    // La source non è più considerata attiva prima di chiamare
    // stop(), così un eventuale evento `ended` tardivo non può
    // modificare lo stato del player o della nuova source.
    this.source = null;
    source.onended = null;

    try {
      source.stop();
    } catch {
      // La source potrebbe essere già terminata.
    }

    source.disconnect();
  }
}
