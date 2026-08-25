import { state, subscribe } from "./state.js";

import { initializeRotaryKnobs, refreshAllRotaryKnobs } from "./ui/RotaryKnob.js";

import {
  initializeWaveSurfers,
  syncOriginalWaveSurferToTime,
  syncProcessedWaveSurferToTime,
} from "./ui/WaveSurferView.js";

import { renderAudioInfo } from "./ui/AudioInfoView.js";

import { PlaybackController } from "./controllers/PlaybackController.js";

import { AudioInputController } from "./controllers/AudioInputController.js";

import { ProcessingController } from "./controllers/ProcessingController.js";

import { ExportController } from "./controllers/ExportController.js";

const playbackController = new PlaybackController({
  syncOriginalWaveformToTime: syncOriginalWaveSurferToTime,

  syncProcessedWaveformToTime: syncProcessedWaveSurferToTime,
});

const exportController = new ExportController();

const processingController = new ProcessingController({
  playbackController,
  exportController,
});

const audioInputController = new AudioInputController({
  playbackController,
  processingController,
});

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
  initializeWaveSurfers({
    onOriginalSeek: (timeSeconds) => playbackController.seekTrack("original", timeSeconds),

    onProcessedSeek: (timeSeconds) => playbackController.seekTrack("processed", timeSeconds),
  });

  playbackController.bind();
  processingController.bind();
  audioInputController.bind();
  exportController.bind();

  initializeRotaryKnobs();

  subscribe(render);
  render(state);
}

function render(currentState) {
  renderAudioInfo(currentState);
  playbackController.render();
  processingController.render();
  exportController.render();

  refreshAllRotaryKnobs();
}
