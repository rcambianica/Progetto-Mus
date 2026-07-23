import {
    setOriginalBuffer,
    setOriginalFile,
    setOriginalInfo,
    setProcessedBuffer,
    setProcessedInfo,
    state,
    subscribe,
    updateProcessingSettings
} from "./state.js";

import {
    resumeAudioContext
} from "./audio/AudioContextManager.js";

import {
    loadAudioFile
} from "./audio/AudioLoader.js";

import {
    analyzeAudioBuffer,
    formatDb,
    formatDuration
} from "./analysis/AudioInfo.js";

import {
    clearProcessedWaveSurfer,
    initializeWaveSurfers,
    renderOriginalWaveformWithWaveSurfer,
    renderProcessedWaveformWithWaveSurfer,
    syncOriginalWaveSurferToTime,
    syncProcessedWaveSurferToTime
} from "./ui/WaveSurferView.js";

import {
    AudioPlayer
} from "./audio/AudioPlayer.js";

import {
    MicrophoneRecorder
} from "./audio/MicrophoneRecorder.js";

import {
    renderProcessedAudio
} from "./audio/OfflineRenderer.js";

const EMPTY_AUDIO_INFO = {
    durationMs: 0,
    sampleRate: 0,
    numberOfChannels: 0,
    peakLinear: 0,
    peakDb: -Infinity
};

const tracks = {
    original: {
        name: "original",
        player: null,
        playbackAnimationId: null,
        isUserSeeking: false,

        getBuffer: () => state.originalBuffer,

        playButtonId: "originalPlayBtn",
        pauseButtonId: "originalPauseBtn",
        stopButtonId: "originalStopBtn",

        seekSliderId: "originalSeekSlider",
        currentTimeId: "originalCurrentTime",
        totalTimeId: "originalTotalTime",

        syncWaveformToTime: syncOriginalWaveSurferToTime,

        missingAudioMessage: "No original audio loaded."
    },

    processed: {
        name: "processed",
        player: null,
        playbackAnimationId: null,
        isUserSeeking: false,

        getBuffer: () => state.processedBuffer,

        playButtonId: "processedPlayBtn",
        pauseButtonId: "processedPauseBtn",
        stopButtonId: "processedStopBtn",

        seekSliderId: "processedSeekSlider",
        currentTimeId: "processedCurrentTime",
        totalTimeId: "processedTotalTime",

        syncWaveformToTime: syncProcessedWaveSurferToTime,

        missingAudioMessage:
            "No processed audio available. Apply processing first."
    }
};

let microphoneRecorder = null;
let recordingAnimationId = null;

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
    initializeWaveSurfers(
        timeMs => handleWaveformInteraction(
            tracks.original,
            timeMs
        ),
        timeMs => handleWaveformInteraction(
            tracks.processed,
            timeMs
        )
    );

    bindAudioInputControls();
    bindPlaybackControls(tracks.original);
    bindPlaybackControls(tracks.processed);
    bindProcessingControls();
    bindMicrophoneRecordingControls();

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

            const audioBuffer =
                await loadAudioFile(file, audioContext);

            const info =
                analyzeAudioBuffer(audioBuffer);

            stopAndResetTrack(tracks.original);
            resetProcessedAudio();

            setOriginalFile(file);
            setOriginalBuffer(audioBuffer);
            setOriginalInfo(info);

            setupTrackPlayer(
                tracks.original,
                audioContext,
                audioBuffer
            );

            await renderOriginalWaveformWithWaveSurfer(file);

            tracks.original.syncWaveformToTime(0);
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    });
}

function bindPlaybackControls(track) {
    const playButton =
        document.getElementById(track.playButtonId);

    const pauseButton =
        document.getElementById(track.pauseButtonId);

    const stopButton =
        document.getElementById(track.stopButtonId);

    const seekSlider =
        document.getElementById(track.seekSliderId);

    playButton.addEventListener("click", async () => {
        try {
            await resumeAudioContext();

            const buffer =
                track.getBuffer();

            if (!track.player && buffer) {
                track.player =
                    new AudioPlayer(state.audioContext);

                track.player.setBuffer(buffer);
            }

            if (!track.player) {
                throw new Error(track.missingAudioMessage);
            }

            track.player.play();

            track.syncWaveformToTime(
                track.player.getCurrentTimeMs()
            );

            startPlaybackAnimation(track);
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    });

    pauseButton.addEventListener("click", () => {
        if (!track.player) {
            return;
        }

        track.player.pause();

        track.syncWaveformToTime(
            track.player.getCurrentTimeMs()
        );

        stopPlaybackAnimation(track);
        updatePlaybackUI(track);
    });

    stopButton.addEventListener("click", () => {
        if (!track.player) {
            return;
        }

        track.player.stop();

        track.syncWaveformToTime(0);

        stopPlaybackAnimation(track);
        updatePlaybackUI(track);
    });

    seekSlider.addEventListener("input", () => {
        track.isUserSeeking = true;

        updateCurrentTimeFromSlider(track);
    });

    seekSlider.addEventListener("change", () => {
        if (!track.player) {
            return;
        }

        const durationMs =
            track.player.getDurationMs();

        const ratio =
            Number(seekSlider.value) / 1000;

        const targetTimeMs =
            durationMs * ratio;

        track.player.seek(targetTimeMs);

        track.syncWaveformToTime(targetTimeMs);

        track.isUserSeeking = false;

        updatePlaybackUI(track);

        if (track.player.isPlaying) {
            startPlaybackAnimation(track);
        }
    });
}

function bindProcessingControls() {
    const gainSlider =
        document.getElementById("gainSlider");

    const normalizationEnabled =
        document.getElementById(
            "normalizationEnabled"
        );

    const normalizationTarget =
        document.getElementById(
            "normalizationTarget"
        );

    const applyButton =
        document.getElementById(
            "applyProcessingBtn"
        );

    gainSlider.addEventListener("input", () => {
        const gainValue =
            Number(gainSlider.value);

        updateProcessingSettings("gain", {
            enabled: true,
            value: gainValue
        });

        renderGainControls();
        markProcessingAsChanged();
    });

    normalizationEnabled.addEventListener(
        "change",
        () => {
            updateProcessingSettings(
                "normalization",
                {
                    enabled:
                        normalizationEnabled.checked
                }
            );

            renderNormalizationControls();
            markProcessingAsChanged();
        }
    );

    normalizationTarget.addEventListener(
        "change",
        () => {
            const targetDb =
                Number(normalizationTarget.value);

            updateProcessingSettings(
                "normalization",
                {
                    targetDb
                }
            );

            renderNormalizationControls();
            markProcessingAsChanged();
        }
    );

    applyButton.addEventListener(
        "click",
        async () => {
            try {
                await resumeAudioContext();

                if (!state.originalBuffer) {
                    throw new Error(
                        "No original audio loaded."
                    );
                }

                renderProcessingStatus(
                    "processing"
                );

                stopAndResetTrack(
                    tracks.processed
                );

                const processedBuffer =
                    await renderProcessedAudio(
                        state.originalBuffer,
                        state.processingSettings
                    );

                const processedInfo =
                    analyzeAudioBuffer(
                        processedBuffer
                    );

                setProcessedBuffer(
                    processedBuffer
                );

                setProcessedInfo(
                    processedInfo
                );

                setupTrackPlayer(
                    tracks.processed,
                    state.audioContext,
                    processedBuffer
                );

                await renderProcessedWaveformWithWaveSurfer(
                    processedBuffer
                );

                tracks.processed
                    .syncWaveformToTime(0);

                renderProcessingStatus(
                    "processed"
                );
            } catch (error) {
                console.error(error);
                alert(error.message);

                renderProcessingStatus(
                    "error"
                );
            }
        }
    );
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

function handleWaveformInteraction(track, timeMs) {
    if (!track.player || !track.getBuffer()) {
        return;
    }

    track.player.seek(timeMs);

    const durationMs =
        track.player.getDurationMs();

    updateSeekSliderValue(
        track.seekSliderId,
        timeMs,
        durationMs
    );

    updatePlaybackUI(track);

    if (track.player.isPlaying) {
        startPlaybackAnimation(track);
    }
}

function updateSeekSliderValue(
    sliderId,
    timeMs,
    durationMs
) {
    const seekSlider =
        document.getElementById(sliderId);

    if (!durationMs || durationMs <= 0) {
        seekSlider.value = 0;
        return;
    }

    seekSlider.value =
        Math.round(
            (timeMs / durationMs) * 1000
        );
}

function setupTrackPlayer(track, audioContext, audioBuffer) {
    if (!track.player) {
        track.player =
            new AudioPlayer(audioContext);
    }

    track.player.setBuffer(audioBuffer);

    updatePlaybackUI(track);
}

function stopAndResetTrack(track) {
    if (track.player) {
        track.player.stop();
    }

    stopPlaybackAnimation(track);

    track.syncWaveformToTime(0);

    const seekSlider =
        document.getElementById(track.seekSliderId);

    if (seekSlider) {
        seekSlider.value = 0;
    }

    updatePlaybackUI(track);
}

function resetProcessedAudio() {
    stopAndResetTrack(tracks.processed);

    setProcessedBuffer(null);
    setProcessedInfo(EMPTY_AUDIO_INFO);

    clearProcessedWaveSurfer();

    renderProcessingStatus("not processed");
}

function startPlaybackAnimation(track) {
    stopPlaybackAnimation(track);

    function tick() {
        updatePlaybackUI(track);

        if (track.player) {
            track.syncWaveformToTime(
                track.player.getCurrentTimeMs()
            );
        }

        if (
            track.player &&
            track.player.isPlaying
        ) {
            track.playbackAnimationId =
                requestAnimationFrame(tick);
        }
    }

    track.playbackAnimationId =
        requestAnimationFrame(tick);
}

function stopPlaybackAnimation(track) {
    if (track.playbackAnimationId !== null) {
        cancelAnimationFrame(track.playbackAnimationId);
        track.playbackAnimationId = null;
    }
}

function updatePlaybackUI(track) {
    const seekSlider =
        document.getElementById(track.seekSliderId);

    const currentTimeElement =
        document.getElementById(track.currentTimeId);

    const totalTimeElement =
        document.getElementById(track.totalTimeId);

    if (!track.getBuffer() || !track.player) {
        seekSlider.value = 0;
        currentTimeElement.textContent = "0:00.000";
        totalTimeElement.textContent = "0:00.000";
        return;
    }

    const currentTimeMs =
        track.player.getCurrentTimeMs();

    const durationMs =
        track.player.getDurationMs();

    currentTimeElement.textContent =
        formatDuration(currentTimeMs);

    totalTimeElement.textContent =
        formatDuration(durationMs);

    if (!track.isUserSeeking && durationMs > 0) {
        seekSlider.value =
            Math.round(
                (currentTimeMs / durationMs) * 1000
            );
    }
}

function updateCurrentTimeFromSlider(track) {
    const seekSlider =
        document.getElementById(track.seekSliderId);

    const currentTimeElement =
        document.getElementById(track.currentTimeId);

    const totalTimeElement =
        document.getElementById(track.totalTimeId);

    if (!track.player) {
        return;
    }

    const durationMs =
        track.player.getDurationMs();

    const ratio =
        Number(seekSlider.value) / 1000;

    const previewTimeMs =
        durationMs * ratio;

    currentTimeElement.textContent =
        formatDuration(previewTimeMs);

    totalTimeElement.textContent =
        formatDuration(durationMs);
}

function render(currentState) {
    renderOriginalAudioInfo(currentState);
    renderProcessedAudioInfo(currentState);
    renderGainControls();
    renderNormalizationControls();

    updatePlaybackUI(tracks.original);
    updatePlaybackUI(tracks.processed);
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

function renderNormalizationControls() {
    const enabledElement =
        document.getElementById(
            "normalizationEnabled"
        );

    const targetElement =
        document.getElementById(
            "normalizationTarget"
        );

    const targetValueElement =
        document.getElementById(
            "normalizationTargetValue"
        );

    const normalizationSettings =
        state.processingSettings.normalization;

    enabledElement.checked =
        normalizationSettings.enabled;

    targetElement.disabled =
        !normalizationSettings.enabled;

    targetElement.value =
        String(normalizationSettings.targetDb);

    targetValueElement.textContent =
        `${normalizationSettings.targetDb.toFixed(2)} dBFS`;
}

function renderProcessingStatus(status) {
    const statusElement =
        document.getElementById("processingStatus");

    statusElement.textContent = status;
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

    stopAndResetTrack(tracks.original);
    resetProcessedAudio();

    setOriginalFile(recordedFile);
    setOriginalBuffer(audioBuffer);
    setOriginalInfo(info);

    setupTrackPlayer(
        tracks.original,
        audioContext,
        audioBuffer
    );

    await renderOriginalWaveformWithWaveSurfer(recordedFile);

    tracks.original.syncWaveformToTime(0);

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

function markProcessingAsChanged() {
    if (state.processedBuffer) {
        renderProcessingStatus(
            "settings changed — apply processing again"
        );
    } else {
        renderProcessingStatus(
            "not processed"
        );
    }
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