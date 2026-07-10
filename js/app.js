import {
    state,
    subscribe,
    setOriginalFile,
    setOriginalBuffer,
    setOriginalInfo,
    setProcessedBuffer,
    setProcessedInfo,
    updateProcessingSettings
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

import {
    MicrophoneRecorder
} from "./audio/MicrophoneRecorder.js";

import {
    renderProcessedAudio
} from "./audio/OfflineRenderer.js";

let originalPlayer = null;
let originalPlaybackAnimationId = null;
let isUserSeekingOriginal = false;

let microphoneRecorder = null;
let recordingAnimationId = null;

let processedPlayer = null;
let processedPlaybackAnimationId = null;
let isUserSeekingProcessed = false;

const EMPTY_AUDIO_INFO = {
    durationMs: 0,
    sampleRate: 0,
    numberOfChannels: 0,
    peakLinear: 0,
    peakDb: -Infinity
};

document.addEventListener("DOMContentLoaded", initializeApp);


//**
// Binding dei controlli relativi ai moduli della pagina
// **/
function initializeApp() {
    bindAudioInputControls();
    bindOriginalPlaybackControls();
    bindProcessedPlaybackControls();
    bindProcessingControls();
    bindMicrophoneRecordingControls();
    bindWindowResize();

    subscribe(render);

    render(state);
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

            resetProcessedAudio();

            setOriginalFile(file);
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
        renderProcessedWaveform(state);
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

function bindProcessedPlaybackControls() {
    const playButton =
        document.getElementById("processedPlayBtn");

    const pauseButton =
        document.getElementById("processedPauseBtn");

    const stopButton =
        document.getElementById("processedStopBtn");

    const seekSlider =
        document.getElementById("processedSeekSlider");

    playButton.addEventListener("click", async () => {
        try {
            await resumeAudioContext();

            if (!processedPlayer && state.processedBuffer) {
                processedPlayer =
                    new AudioPlayer(state.audioContext);

                processedPlayer.setBuffer(state.processedBuffer);
            }

            if (!processedPlayer) {
                throw new Error(
                    "No processed audio available. Apply processing first."
                );
            }

            processedPlayer.play();
            startProcessedPlaybackAnimation();
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    });

    pauseButton.addEventListener("click", () => {
        if (!processedPlayer) {
            return;
        }

        processedPlayer.pause();
        stopProcessedPlaybackAnimation();
        updateProcessedPlaybackUI();
    });

    stopButton.addEventListener("click", () => {
        if (!processedPlayer) {
            return;
        }

        processedPlayer.stop();
        stopProcessedPlaybackAnimation();
        updateProcessedPlaybackUI();
    });

    seekSlider.addEventListener("input", () => {
        isUserSeekingProcessed = true;

        updateProcessedCurrentTimeFromSlider();
    });

    seekSlider.addEventListener("change", () => {
        if (!processedPlayer) {
            return;
        }

        const durationMs =
            processedPlayer.getDurationMs();

        const ratio =
            Number(seekSlider.value) / 1000;

        const targetTimeMs =
            durationMs * ratio;

        processedPlayer.seek(targetTimeMs);

        isUserSeekingProcessed = false;

        updateProcessedPlaybackUI();

        if (processedPlayer.isPlaying) {
            startProcessedPlaybackAnimation();
        }
    });
}

function bindProcessingControls() {
    const gainSlider =
        document.getElementById("gainSlider");

    const applyButton =
        document.getElementById("applyProcessingBtn");


    gainSlider.addEventListener("input", () => {
        const gainValue =
            Number(gainSlider.value);

        updateProcessingSettings("gain", {
            enabled: true,
            value: gainValue
        });

        renderGainControls();
    });

    applyButton.addEventListener("click", async () => {
        try {
            await resumeAudioContext();

            if (!state.originalBuffer) {
                throw new Error("No original audio loaded.");
            }

            renderProcessingStatus("processing");

            if (processedPlayer) {
                processedPlayer.stop();
                stopProcessedPlaybackAnimation();
            }

            const processedBuffer =
                await renderProcessedAudio(
                    state.originalBuffer,
                    state.processingSettings
                );

            const processedInfo =
                analyzeAudioBuffer(processedBuffer);

            setProcessedBuffer(processedBuffer);
            setProcessedInfo(processedInfo);

            setupProcessedPlayer(
                state.audioContext,
                processedBuffer
            );

            renderProcessingStatus("processed");
        } catch (error) {
            console.error(error);
            alert(error.message);

            renderProcessingStatus("error");
        }
    });
}

function bindMicrophoneRecordingControls() {
    const startButton =
        document.getElementById("startRecordingBtn");

    const stopButton =
        document.getElementById("stopRecordingBtn");

    startButton.addEventListener("click", async () => {
        try {
            await resumeAudioContext();

            if (!microphoneRecorder) {
                microphoneRecorder =
                    new MicrophoneRecorder();
            }

            await microphoneRecorder.start();

            startButton.disabled = true;
            stopButton.disabled = false;

            renderRecordingStatus("recording");

            startRecordingTimer();
        } catch (error) {
            console.error(error);
            alert(error.message);

            stopRecordingTimer();

            startButton.disabled = false;
            stopButton.disabled = true;

            renderRecordingStatus("error");
        }
    });

    stopButton.addEventListener("click", async () => {
        try {
            if (!microphoneRecorder) {
                return;
            }

            const audioBlob =
                await microphoneRecorder.stop();

            stopRecordingTimer();

            startButton.disabled = false;
            stopButton.disabled = true;

            renderRecordingStatus("processing");

            await useRecordedBlobAsOriginalAudio(audioBlob);

            renderRecordingStatus("inactive");
        } catch (error) {
            console.error(error);
            alert(error.message);

            stopRecordingTimer();

            startButton.disabled = false;
            stopButton.disabled = true;

            renderRecordingStatus("error");
        }
    });
}

function render(currentState) {
    renderOriginalAudioInfo(currentState);
    renderProcessedAudioInfo(currentState);
    renderOriginalWaveform(currentState);
    renderProcessedWaveform(currentState);
    renderGainControls();
    updateOriginalPlaybackUI();
    updateProcessedPlaybackUI();
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

function renderProcessedAudioInfo(currentState) {
    const durationElement =
        document.getElementById("processedDuration");

    const sampleRateElement =
        document.getElementById("processedSampleRate");

    const channelsElement =
        document.getElementById("processedChannels");

    const peakElement =
        document.getElementById("processedPeak");

    const peakDbElement =
        document.getElementById("processedPeakDb");

    if (!currentState.processedBuffer) {
        durationElement.textContent = "-";
        sampleRateElement.textContent = "-";
        channelsElement.textContent = "-";
        peakElement.textContent = "-";
        peakDbElement.textContent = "-";
        return;
    }

    durationElement.textContent =
        formatDuration(currentState.processedInfo.durationMs);

    sampleRateElement.textContent =
        `${currentState.processedInfo.sampleRate} Hz`;

    channelsElement.textContent =
        currentState.processedInfo.numberOfChannels;

    peakElement.textContent =
        currentState.processedInfo.peakLinear.toFixed(4);

    peakDbElement.textContent =
        formatDb(currentState.processedInfo.peakDb);
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

function renderProcessedWaveform(currentState) {
    const canvas =
        document.getElementById("processedWaveformCanvas");

    if (!currentState.processedBuffer) {
        clearWaveform(canvas);
        return;
    }

    drawWaveform(
        canvas,
        currentState.processedBuffer
    );
}

function renderGainControls() {
    const gainSlider =
        document.getElementById("gainSlider");

    const gainValueElement =
        document.getElementById("gainValue");

    const gainValue =
        state.processingSettings.gain.value;

    if (Number(gainSlider.value) !== gainValue) {
        gainSlider.value = String(gainValue);
    }

    gainValueElement.textContent =
        gainValue.toFixed(2);
}

function renderProcessingStatus(status) {
    const statusElement =
        document.getElementById("processingStatus");

    statusElement.textContent = status;
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

function updateProcessedPlaybackUI() {
    const seekSlider =
        document.getElementById("processedSeekSlider");

    const currentTimeElement =
        document.getElementById("processedCurrentTime");

    const totalTimeElement =
        document.getElementById("processedTotalTime");

    if (!state.processedBuffer || !processedPlayer) {
        seekSlider.value = 0;
        currentTimeElement.textContent = "0:00.000";
        totalTimeElement.textContent = "0:00.000";
        return;
    }

    const currentTimeMs =
        processedPlayer.getCurrentTimeMs();

    const durationMs =
        processedPlayer.getDurationMs();

    currentTimeElement.textContent =
        formatDuration(currentTimeMs);

    totalTimeElement.textContent =
        formatDuration(durationMs);

    if (!isUserSeekingProcessed && durationMs > 0) {
        seekSlider.value =
            Math.round(
                (currentTimeMs / durationMs) * 1000
            );
    }
}

function renderRecordingStatus(status) {
    const statusElement =
        document.getElementById("recordingStatus");

    const mimeTypeElement =
        document.getElementById("recordingMimeType");

    statusElement.textContent = status;

    if (microphoneRecorder) {
        mimeTypeElement.textContent =
            microphoneRecorder.getMimeType();
    } else {
        mimeTypeElement.textContent = "-";
    }
}

function setupOriginalPlayer(audioContext, audioBuffer) {
    if (!originalPlayer) {
        originalPlayer =
            new AudioPlayer(audioContext);
    }

    originalPlayer.setBuffer(audioBuffer);

    updateOriginalPlaybackUI();
}

function setupProcessedPlayer(audioContext, audioBuffer) {
    if (!processedPlayer) {
        processedPlayer =
            new AudioPlayer(audioContext);
    }

    processedPlayer.setBuffer(audioBuffer);

    updateProcessedPlaybackUI();
}

function resetProcessedAudio() {
    if (processedPlayer) {
        processedPlayer.stop();
        stopProcessedPlaybackAnimation();
    }

    setProcessedBuffer(null);
    setProcessedInfo(EMPTY_AUDIO_INFO);
    renderProcessingStatus("not processed");
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

function startProcessedPlaybackAnimation() {
    stopProcessedPlaybackAnimation();

    function tick() {
        updateProcessedPlaybackUI();

        if (
            processedPlayer &&
            processedPlayer.isPlaying
        ) {
            processedPlaybackAnimationId =
                requestAnimationFrame(tick);
        }
    }

    processedPlaybackAnimationId =
        requestAnimationFrame(tick);
}

function stopProcessedPlaybackAnimation() {
    if (processedPlaybackAnimationId !== null) {
        cancelAnimationFrame(processedPlaybackAnimationId);
        processedPlaybackAnimationId = null;
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

function updateProcessedCurrentTimeFromSlider() {
    const seekSlider =
        document.getElementById("processedSeekSlider");

    const currentTimeElement =
        document.getElementById("processedCurrentTime");

    const totalTimeElement =
        document.getElementById("processedTotalTime");

    if (!processedPlayer) {
        return;
    }

    const durationMs =
        processedPlayer.getDurationMs();

    const ratio =
        Number(seekSlider.value) / 1000;

    const previewTimeMs =
        durationMs * ratio;

    currentTimeElement.textContent =
        formatDuration(previewTimeMs);

    totalTimeElement.textContent =
        formatDuration(durationMs);
}

async function useRecordedBlobAsOriginalAudio(audioBlob) {
    const audioContext =
        await resumeAudioContext();

    const extension =
        getExtensionFromMimeType(audioBlob.type);

    const fileName =
        `microphone-recording-${Date.now()}.${extension}`;

    const recordedFile =
        new File(
            [audioBlob],
            fileName,
            {
                type: audioBlob.type
            }
        );

    const audioBuffer =
        await loadAudioFile(recordedFile, audioContext);

    const info =
        analyzeAudioBuffer(audioBuffer);

    if (originalPlayer) {
        originalPlayer.stop();
        stopOriginalPlaybackAnimation();
    }

    resetProcessedAudio();

    setOriginalFile(recordedFile);
    setOriginalBuffer(audioBuffer);
    setOriginalInfo(info);

    setupOriginalPlayer(audioContext, audioBuffer);

    const audioFileInput =
        document.getElementById("audioFileInput");

    audioFileInput.value = "";

    render(state);
}

function getExtensionFromMimeType(mimeType) {
    if (!mimeType) {
        return "webm";
    }

    if (mimeType.includes("ogg")) {
        return "ogg";
    }

    if (mimeType.includes("mp4")) {
        return "mp4";
    }

    if (mimeType.includes("wav")) {
        return "wav";
    }

    if (mimeType.includes("mpeg")) {
        return "mp3";
    }

    return "webm";
}

function startRecordingTimer() {
    stopRecordingTimer();

    function tick() {
        updateRecordingTime();

        if (
            microphoneRecorder &&
            microphoneRecorder.isRecording
        ) {
            recordingAnimationId =
                requestAnimationFrame(tick);
        }
    }

    recordingAnimationId =
        requestAnimationFrame(tick);
}

function stopRecordingTimer() {
    if (recordingAnimationId !== null) {
        cancelAnimationFrame(recordingAnimationId);
        recordingAnimationId = null;
    }

    updateRecordingTime();
}

function updateRecordingTime() {
    const recordingTimeElement =
        document.getElementById("recordingTime");

    if (
        !microphoneRecorder ||
        !microphoneRecorder.isRecording
    ) {
        recordingTimeElement.textContent =
            "0:00.000";

        return;
    }

    recordingTimeElement.textContent =
        formatDuration(
            microphoneRecorder.getElapsedMs()
        );
}