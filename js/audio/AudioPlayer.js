export class AudioPlayer {
    constructor(audioContext) {
        this.audioContext = audioContext;

        this.buffer = null;
        this.source = null;
        this.gainNode = this.audioContext.createGain();

        this.startedAt = 0;
        this.pausedAt = 0;
        this.isPlaying = false;

        this.ignoreEndedEvent = false;

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

        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.gainNode);

        const offsetSeconds = this.pausedAt;

        this.startedAt =
            this.audioContext.currentTime - offsetSeconds;

        this.ignoreEndedEvent = false;

        this.source.onended = () => {
            if (this.ignoreEndedEvent) {
                return;
            }

            this.isPlaying = false;
            this.pausedAt = 0;
            this.source = null;
        };

        this.source.start(0, offsetSeconds);

        this.isPlaying = true;
    }

    pause() {
        if (!this.isPlaying) {
            return;
        }

        this.pausedAt =
            this.getCurrentTimeMs() / 1000;

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

        const durationMs =
            this.buffer.duration * 1000;

        const clampedMs =
            Math.max(0, Math.min(timeMs, durationMs));

        this.pausedAt =
            clampedMs / 1000;

        if (this.isPlaying) {
            this.stopSourceOnly();
            this.isPlaying = false;
            this.play();
        }
    }

    getCurrentTimeMs() {
        if (!this.buffer) {
            return 0;
        }

        if (!this.isPlaying) {
            return this.pausedAt * 1000;
        }

        const currentSeconds =
            this.audioContext.currentTime - this.startedAt;

        const durationSeconds =
            this.buffer.duration;

        return Math.min(
            currentSeconds,
            durationSeconds
        ) * 1000;
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

        this.ignoreEndedEvent = true;

        try {
            this.source.stop();
        } catch {
            // La source potrebbe essere già terminata.
        }

        this.source.disconnect();
        this.source = null;
    }
}