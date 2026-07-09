import {
    state,
    subscribe,
    setOriginalFile,
    setOriginalBuffer,
    setOriginalInfo
} from "./state.js";

import {
    getAudioContext,
    resumeAudioContext
} from "./audio/AudioContextManager.js";

import {
    loadAudioFile
} from "./audio/AudioLoader.js";

import {
    analyzeAudioBuffer,
    formatDuration,
    formatDb
} from "./analysis/AudioInfo.js";

import {
    drawWaveform,
    clearWaveform
} from "./ui/WaveformView.js";

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
    bindAudioContextControls();
    bindAudioInputControls();
    bindWindowResize();

    subscribe(render);

    render(state);
}

function bindAudioContextControls() {
    const initButton =
        document.getElementById("initAudioContextBtn");

    initButton.addEventListener("click", async () => {
        try {
            getAudioContext();

            await resumeAudioContext();

            render(state);
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    });
}

function bindAudioInputControls() {
    const audioFileInput =
        document.getElementById("audioFileInput");

    audioFileInput.addEventListener("change", async event => {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        try {
            const audioContext =
                await resumeAudioContext();

            setOriginalFile(file);

            const audioBuffer =
                await loadAudioFile(file, audioContext);

            const info =
                analyzeAudioBuffer(audioBuffer);

            setOriginalBuffer(audioBuffer);
            setOriginalInfo(info);
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    });
}

function bindWindowResize() {
    window.addEventListener("resize", () => {
        renderOriginalWaveform(state);
    });
}

function render(currentState) {
    renderAudioContextStatus(currentState);
    renderOriginalAudioInfo(currentState);
    renderOriginalWaveform(currentState);
}

function renderAudioContextStatus(currentState) {
    const statusElement =
        document.getElementById("audioContextStatus");

    const sampleRateElement =
        document.getElementById("audioContextSampleRate");

    if (!currentState.audioContext) {
        statusElement.textContent = "not initialized";
        sampleRateElement.textContent = "-";
        return;
    }

    statusElement.textContent =
        currentState.audioContext.state;

    sampleRateElement.textContent =
        `${currentState.audioContext.sampleRate} Hz`;
}

function renderOriginalAudioInfo(currentState) {
    const fileNameElement =
        document.getElementById("originalFileName");

    const durationElement =
        document.getElementById("originalDuration");

    const sampleRateElement =
        document.getElementById("originalSampleRate");

    const channelsElement =
        document.getElementById("originalChannels");

    const peakElement =
        document.getElementById("originalPeak");

    const peakDbElement =
        document.getElementById("originalPeakDb");

    if (!currentState.originalBuffer) {
        fileNameElement.textContent = "-";
        durationElement.textContent = "-";
        sampleRateElement.textContent = "-";
        channelsElement.textContent = "-";
        peakElement.textContent = "-";
        peakDbElement.textContent = "-";
        return;
    }

    fileNameElement.textContent =
        currentState.originalFile?.name ?? "-";

    durationElement.textContent =
        formatDuration(currentState.originalInfo.durationMs);

    sampleRateElement.textContent =
        `${currentState.originalInfo.sampleRate} Hz`;

    channelsElement.textContent =
        currentState.originalInfo.numberOfChannels;

    peakElement.textContent =
        currentState.originalInfo.peakLinear.toFixed(4);

    peakDbElement.textContent =
        formatDb(currentState.originalInfo.peakDb);
}

function renderOriginalWaveform(currentState) {
    const canvas =
        document.getElementById("originalWaveformCanvas");

    if (!currentState.originalBuffer) {
        clearWaveform(canvas);
        return;
    }

    drawWaveform(
        canvas,
        currentState.originalBuffer
    );
}