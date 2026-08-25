import WaveSurfer from "../../lib/wavesurfer/wavesurfer.esm.js";

import HoverPlugin from "../../lib/wavesurfer/plugins/hover.esm.js";

import { encodeWav } from "../audio/WavEncoder.js";

const waveformViews = {
  original: createWaveformView("#originalWaveform"),

  processed: createWaveformView("#processedWaveform"),
};

export function initializeWaveSurfers({ onOriginalSeek, onProcessedSeek }) {
  initializeWaveformView(waveformViews.original, onOriginalSeek);

  initializeWaveformView(waveformViews.processed, onProcessedSeek);
}

export async function renderOriginalWaveformWithWaveSurfer(file) {
  const view = waveformViews.original;

  if (!view.waveSurfer || !file) {
    return;
  }

  disableWaveform(view);
  revokeObjectUrl(view);

  view.objectUrl = URL.createObjectURL(file);

  try {
    await view.waveSurfer.load(view.objectUrl);

    syncWaveSurferToTime(view, 0);
    enableWaveform(view);
  } catch (error) {
    disableWaveform(view);
    revokeObjectUrl(view);
    throw error;
  }
}

export async function renderProcessedWaveformWithWaveSurfer(audioBuffer) {
  const view = waveformViews.processed;

  if (!view.waveSurfer || !audioBuffer) {
    return;
  }

  disableWaveform(view);
  revokeObjectUrl(view);

  const wavBlob = encodeWav(audioBuffer);

  view.objectUrl = URL.createObjectURL(wavBlob);

  try {
    await view.waveSurfer.load(view.objectUrl);

    syncWaveSurferToTime(view, 0);
    enableWaveform(view);
  } catch (error) {
    disableWaveform(view);
    revokeObjectUrl(view);
    throw error;
  }
}

export function syncOriginalWaveSurferToTime(timeMs) {
  syncWaveSurferToTime(waveformViews.original, timeMs);
}

export function syncProcessedWaveSurferToTime(timeMs) {
  syncWaveSurferToTime(waveformViews.processed, timeMs);
}

export function clearOriginalWaveSurfer() {
  clearWaveform(waveformViews.original);
}

export function clearProcessedWaveSurfer() {
  clearWaveform(waveformViews.processed);
}

export function destroyWaveSurfers() {
  Object.values(waveformViews).forEach((view) => {
    removeHoverPlugin(view);
    removeInteractionListener(view);

    if (view.waveSurfer) {
      view.waveSurfer.destroy();
      view.waveSurfer = null;
    }

    revokeObjectUrl(view);
  });
}

function createWaveformView(containerSelector) {
  return {
    containerSelector,
    containerElement: null,
    waveSurfer: null,
    hoverPlugin: null,
    objectUrl: null,
    isEnabled: false,
    unsubscribeInteraction: null,
  };
}

function initializeWaveformView(view, onSeek) {
  view.containerElement = document.querySelector(view.containerSelector);

  if (!view.containerElement) {
    throw new Error(`Waveform container not found: ${view.containerSelector}`);
  }

  view.waveSurfer = createWaveSurfer(view.containerElement);

  view.unsubscribeInteraction = view.waveSurfer.on("interaction", (newTimeSeconds) => {
    if (!view.isEnabled) {
      return;
    }

    invokeSeekHandler(onSeek, newTimeSeconds);
  });

  disableWaveform(view);
}

function invokeSeekHandler(handler, timeSeconds) {
  if (typeof handler !== "function") {
    return;
  }

  Promise.resolve(handler(timeSeconds)).catch((error) => {
    console.error(error);
    alert(error.message);
  });
}

function removeInteractionListener(view) {
  if (!view.unsubscribeInteraction) {
    return;
  }

  view.unsubscribeInteraction();
  view.unsubscribeInteraction = null;
}

function enableWaveform(view) {
  if (!view.waveSurfer) {
    return;
  }

  view.isEnabled = true;
  view.waveSurfer.toggleInteraction(true);

  addHoverPlugin(view);

  view.containerElement.classList.remove("waveform--disabled");

  view.containerElement.classList.add("waveform--enabled");
}

function disableWaveform(view) {
  if (!view.waveSurfer) {
    return;
  }

  view.isEnabled = false;

  removeHoverPlugin(view);
  view.waveSurfer.toggleInteraction(false);

  view.containerElement.classList.remove("waveform--enabled");

  view.containerElement.classList.add("waveform--disabled");
}

function addHoverPlugin(view) {
  if (!view.waveSurfer || view.hoverPlugin) {
    return;
  }

  view.hoverPlugin = view.waveSurfer.registerPlugin(
    HoverPlugin.create({
      lineColor: "#1e40afeb",
      lineWidth: 2,
      labelBackground: "#172033",
      labelColor: "#ffffff",
      labelSize: 12,
      formatTimeCallback: formatHoverTime,
    }),
  );
}

function removeHoverPlugin(view) {
  if (!view.waveSurfer || !view.hoverPlugin) {
    return;
  }

  view.hoverPlugin.destroy();
  view.hoverPlugin = null;
}

function clearWaveform(view) {
  if (!view.waveSurfer) {
    return;
  }

  disableWaveform(view);
  view.waveSurfer.empty();
  revokeObjectUrl(view);
}

function syncWaveSurferToTime(view, timeMs) {
  if (!view.waveSurfer) {
    return;
  }

  const duration = view.waveSurfer.getDuration();

  if (!duration || duration <= 0) {
    return;
  }

  const timeSeconds = Math.max(0, Math.min(timeMs / 1000, duration));

  // Aggiorna soltanto la testina grafica di WaveSurfer.
  // La riproduzione resta gestita da AudioPlayer/Web Audio API.
  view.waveSurfer.setTime(timeSeconds);
}

function revokeObjectUrl(view) {
  if (!view.objectUrl) {
    return;
  }

  URL.revokeObjectURL(view.objectUrl);

  view.objectUrl = null;
}

function createWaveSurfer(container) {
  return WaveSurfer.create({
    container,
    height: 180,
    waveColor: "#a1a1aa",
    progressColor: "#18181b",
    cursorColor: "#1e40afeb",
    cursorWidth: 2,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    normalize: false,
    interact: false,
    dragToSeek: false,
    hideScrollbar: false,
  });
}

function formatHoverTime(seconds) {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));

  const minutes = Math.floor(totalMilliseconds / 60000);

  const remainingMilliseconds = totalMilliseconds % 60000;

  const wholeSeconds = Math.floor(remainingMilliseconds / 1000);

  const milliseconds = remainingMilliseconds % 1000;

  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}
