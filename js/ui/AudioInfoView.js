import { formatDb, formatDuration } from "../analysis/AudioInfo.js";

export function renderAudioInfo(currentState) {
  renderOriginalAudioInfo(currentState);
  renderProcessedAudioInfo(currentState);
}

function renderOriginalAudioInfo(currentState) {
  const fileNameElement = document.getElementById("originalFileName");

  const elements = getMetricElements("original");

  if (!currentState.originalBuffer) {
    fileNameElement.textContent = "-";
    clearMetricElements(elements);
    return;
  }

  fileNameElement.textContent = currentState.originalFile?.name ?? "-";

  renderMetricElements(elements, currentState.originalInfo);
}

function renderProcessedAudioInfo(currentState) {
  const elements = getMetricElements("processed");

  if (!currentState.processedBuffer) {
    clearMetricElements(elements);
    return;
  }

  renderMetricElements(elements, currentState.processedInfo);
}

function getMetricElements(prefix) {
  return {
    currentTime: document.getElementById(`${prefix}CurrentTime`),

    duration: document.getElementById(`${prefix}Duration`),

    sampleRate: document.getElementById(`${prefix}SampleRate`),

    channels: document.getElementById(`${prefix}Channels`),

    peak: document.getElementById(`${prefix}Peak`),

    peakDb: document.getElementById(`${prefix}PeakDb`),
  };
}

function clearMetricElements(elements) {
  for (const element of Object.values(elements)) {
    element.textContent = "-";
  }
}

function renderMetricElements(elements, audioInfo) {
  // La posizione corrente è aggiornata dal PlaybackController. Qui mostro soltanto la durata effettiva del buffer
  elements.duration.textContent = formatDuration(audioInfo.durationMs);

  elements.sampleRate.textContent = `${audioInfo.sampleRate} Hz`;

  elements.channels.textContent = audioInfo.numberOfChannels;

  elements.peak.textContent = audioInfo.peakLinear.toFixed(4);

  elements.peakDb.textContent = formatDb(audioInfo.peakDb);
}
