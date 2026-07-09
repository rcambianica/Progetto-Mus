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

import {
    AudioPlayer
} from "./audio/AudioPlayer.js";

let originalPlayer = null;
let originalPlaybackAnimationId = null;
let isUserSeekingOriginal = false;

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
    bindAudioContextControls();
    bindAudioInputControls();
    bindOriginalPlaybackControls();
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

            setupOriginalPlayer(audioContext, audioBuffer);
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

function bindOriginalPlaybackControls() {
    const playButton =
        document.getElementById("originalPlayBtn");

    const pauseButton =
        document.getElementById("originalPauseBtn");

    const stopButton =
        document.getElementById("originalStopBtn");

    const seekSlider =
        document.getElementById("originalSeekSlider");

    playButton.addEventListener("click", async () => {
        try {
            await resumeAudioContext();

            if (!originalPlayer && state.originalBuffer) {
                originalPlayer =
                    new AudioPlayer(state.audioContext);

                originalPlayer.setBuffer(state.originalBuffer);
            }

            if (!originalPlayer) {
                throw new Error("No original audio loaded.");
            }

            originalPlayer.play();
            startOriginalPlaybackAnimation();
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    });

    pauseButton.addEventListener("click", () => {
        if (!originalPlayer) {
            return;
        }

        originalPlayer.pause();
        stopOriginalPlaybackAnimation();
        updateOriginalPlaybackUI();
    });

    stopButton.addEventListener("click", () => {
        if (!originalPlayer) {
            return;
        }

        originalPlayer.stop();
        stopOriginalPlaybackAnimation();
        updateOriginalPlaybackUI();
    });

    seekSlider.addEventListener("input", () => {
        isUserSeekingOriginal = true;

        updateOriginalCurrentTimeFromSlider();
    });

    seekSlider.addEventListener("change", () => {
        if (!originalPlayer) {
            return;
        }

        const durationMs =
            originalPlayer.getDurationMs();

        const ratio =
            Number(seekSlider.value) / 1000;

        const targetTimeMs =
            durationMs * ratio;

        originalPlayer.seek(targetTimeMs);

        isUserSeekingOriginal = false;

        updateOriginalPlaybackUI();

        if (originalPlayer.isPlaying) {
            startOriginalPlaybackAnimation();
        }
    });
}

function render(currentState) {
    renderAudioContextStatus(currentState);
    renderOriginalAudioInfo(currentState);
    renderOriginalWaveform(currentState);
    updateOriginalPlaybackUI();
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

function setupOriginalPlayer(audioContext, audioBuffer) {
    if (!originalPlayer) {
        originalPlayer =
            new AudioPlayer(audioContext);
    }

    originalPlayer.setBuffer(audioBuffer);

    updateOriginalPlaybackUI();
}

function startOriginalPlaybackAnimation() {
    stopOriginalPlaybackAnimation();

    function tick() {
        updateOriginalPlaybackUI();

        if (
            originalPlayer &&
            originalPlayer.isPlaying
        ) {
            originalPlaybackAnimationId =
                requestAnimationFrame(tick);
        }
    }

    originalPlaybackAnimationId =
        requestAnimationFrame(tick);
}

function stopOriginalPlaybackAnimation() {
    if (originalPlaybackAnimationId !== null) {
        cancelAnimationFrame(originalPlaybackAnimationId);
        originalPlaybackAnimationId = null;
    }
}

function updateOriginalPlaybackUI() {
    const seekSlider =
        document.getElementById("originalSeekSlider");

    const currentTimeElement =
        document.getElementById("originalCurrentTime");

    const totalTimeElement =
        document.getElementById("originalTotalTime");

    if (!state.originalBuffer || !originalPlayer) {
        seekSlider.value = 0;
        currentTimeElement.textContent = "0:00.000";
        totalTimeElement.textContent = "0:00.000";
        return;
    }

    const currentTimeMs =
        originalPlayer.getCurrentTimeMs();

    const durationMs =
        originalPlayer.getDurationMs();

    currentTimeElement.textContent =
        formatDuration(currentTimeMs);

    totalTimeElement.textContent =
        formatDuration(durationMs);

    if (!isUserSeekingOriginal && durationMs > 0) {
        seekSlider.value =
            Math.round(
                (currentTimeMs / durationMs) * 1000
            );
    }
}

function updateOriginalCurrentTimeFromSlider() {
    const seekSlider =
        document.getElementById("originalSeekSlider");

    const currentTimeElement =
        document.getElementById("originalCurrentTime");

    const totalTimeElement =
        document.getElementById("originalTotalTime");

    if (!originalPlayer) {
        return;
    }

    const durationMs =
        originalPlayer.getDurationMs();

    const ratio =
        Number(seekSlider.value) / 1000;

    const previewTimeMs =
        durationMs * ratio;

    currentTimeElement.textContent =
        formatDuration(previewTimeMs);

    totalTimeElement.textContent =
        formatDuration(durationMs);
}