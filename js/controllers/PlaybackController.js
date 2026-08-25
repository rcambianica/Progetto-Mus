import { state } from "../state.js";

import { AudioPlayer } from "../audio/AudioPlayer.js";

import { formatDuration } from "../analysis/AudioInfo.js";

export class PlaybackController {
  constructor({ syncOriginalWaveformToTime, syncProcessedWaveformToTime }) {
    this.tracks = {
      original: createTrack({
        name: "original",
        getBuffer: () => state.originalBuffer,
        syncWaveformToTime: syncOriginalWaveformToTime,
      }),

      processed: createTrack({
        name: "processed",
        getBuffer: () => state.processedBuffer,
        syncWaveformToTime: syncProcessedWaveformToTime,
      }),
    };
  }

  bind() {
    Object.values(this.tracks).forEach((track) => {
      this.bindTrackControls(track);
      this.renderTrackControls(track);
    });
  }

  render() {
    Object.values(this.tracks).forEach((track) => {
      this.renderTrackControls(track);
    });
  }

  setupTrack(trackName, audioContext, audioBuffer) {
    const track = this.getTrack(trackName);

    this.stopAnimation(track);

    if (!track.player) {
      track.player = new AudioPlayer(audioContext, {
        onEnded: () => {
          this.handleTrackEnded(trackName);
        },
      });
    }

    track.player.setBuffer(audioBuffer);
    track.syncWaveformToTime(0);
    this.renderTrackControls(track);
  }

  resetTrack(trackName) {
    const track = this.getTrack(trackName);

    this.stopAnimation(track);

    if (track.player) {
      track.player.stop();
    }

    track.syncWaveformToTime(0);
    this.renderTrackControls(track);
  }

  async toggleTrackPlayback(trackName) {
    const track = this.getTrack(trackName);

    if (!track.player || !track.getBuffer()) {
      return;
    }

    if (track.player.isPlaying) {
      track.player.pause();

      this.stopAnimation(track);

      track.syncWaveformToTime(track.player.getCurrentTimeMs());

      this.renderTrackControls(track);
      return;
    }

    const durationMs = track.player.getDurationMs();

    if (track.player.getCurrentTimeMs() >= durationMs) {
      track.player.seek(0);
      track.syncWaveformToTime(0);
    }

    if (track.player.audioContext.state === "suspended") {
      await track.player.audioContext.resume();
    }

    track.player.play();
    this.renderTrackControls(track);
    this.startAnimation(track);
  }

  seekTrack(trackName, timeSeconds) {
    const track = this.getTrack(trackName);

    if (!track.player || !track.getBuffer()) {
      return;
    }

    const timeMs = Number.isFinite(timeSeconds) ? timeSeconds * 1000 : 0;

    // AudioPlayer usa AudioBufferSourceNode: il seek viene quindi applicato al player Web Audio e non al media element di WaveSurfer
    track.player.seek(timeMs);

    track.syncWaveformToTime(track.player.getCurrentTimeMs());

    // Il seek durante la riproduzione sostituisce l'AudioBufferSourceNode. Riavviamo esplicitamente il ciclo grafico per mantenerlo associato allo stato corrente
    if (track.player.isPlaying) {
      this.startAnimation(track);
    } else {
      this.stopAnimation(track);
    }

    this.renderTrackControls(track);
  }

  stopTrack(trackName) {
    const track = this.getTrack(trackName);

    if (!track.player || !track.getBuffer()) {
      return;
    }

    this.stopAnimation(track);
    track.player.stop();
    track.syncWaveformToTime(0);
    this.renderTrackControls(track);
  }

  bindTrackControls(track) {
    const playPauseButton = document.getElementById(track.playPauseButtonId);

    const stopButton = document.getElementById(track.stopButtonId);

    if (!playPauseButton || !stopButton) {
      throw new Error(`Playback controls not found for track: ${track.name}`);
    }

    playPauseButton.addEventListener("click", async () => {
      try {
        await this.toggleTrackPlayback(track.name);
      } catch (error) {
        console.error(error);
        alert(error.message);
      }
    });

    stopButton.addEventListener("click", () => {
      this.stopTrack(track.name);
    });
  }

  renderTrackControls(track) {
    const playPauseButton = document.getElementById(track.playPauseButtonId);

    const stopButton = document.getElementById(track.stopButtonId);

    if (!playPauseButton || !stopButton) {
      return;
    }

    const hasAudio = Boolean(track.player && track.getBuffer());

    const isPlaying = Boolean(hasAudio && track.player.isPlaying);

    playPauseButton.disabled = !hasAudio;
    stopButton.disabled = !hasAudio;

    playPauseButton.textContent = isPlaying ? "Pause" : "Play";

    this.renderTrackTime(track);
  }

  renderTrackTime(track) {
    const currentTimeElement = document.getElementById(track.currentTimeElementId);

    const durationElement = document.getElementById(track.durationElementId);

    if (!currentTimeElement || !durationElement) {
      return;
    }

    const hasAudio = Boolean(track.player && track.getBuffer());

    if (!hasAudio) {
      currentTimeElement.textContent = "0:00.000";

      durationElement.textContent = "-";
      return;
    }

    currentTimeElement.textContent = formatDuration(track.player.getCurrentTimeMs());

    durationElement.textContent = formatDuration(track.player.getDurationMs());
  }

  getTrack(trackName) {
    const track = this.tracks[trackName];

    if (!track) {
      throw new Error(`Unknown playback track: ${trackName}`);
    }

    return track;
  }

  startAnimation(track) {
    this.stopAnimation(track);

    const update = () => {
      if (!track.player || !track.player.isPlaying) {
        track.animationFrameId = null;
        return;
      }

      track.syncWaveformToTime(track.player.getCurrentTimeMs());

      this.renderTrackTime(track);

      track.animationFrameId = requestAnimationFrame(update);
    };

    track.animationFrameId = requestAnimationFrame(update);
  }

  stopAnimation(track) {
    if (track.animationFrameId === null) {
      return;
    }

    cancelAnimationFrame(track.animationFrameId);

    track.animationFrameId = null;
  }

  handleTrackEnded(trackName) {
    const track = this.getTrack(trackName);

    this.stopAnimation(track);
    track.syncWaveformToTime(0);
    this.renderTrackControls(track);
  }
}

function createTrack({ name, getBuffer, syncWaveformToTime }) {
  return {
    name,
    player: null,
    getBuffer,
    syncWaveformToTime,
    animationFrameId: null,
    playPauseButtonId: `${name}PlayPauseBtn`,
    stopButtonId: `${name}StopBtn`,
    currentTimeElementId: `${name}CurrentTime`,
    durationElementId: `${name}Duration`,
  };
}
