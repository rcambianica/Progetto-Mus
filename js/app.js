import {
    initializeRotaryKnobs,
    refreshAllRotaryKnobs
} from "./ui/RotaryKnob.js";
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

import {
    encodeWav
} from "./audio/WavEncoder.js";

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
    bindProcessingModuleToggles();
    bindMicrophoneRecordingControls();
    bindExportControls();

    initializeRotaryKnobs();

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

    const limiterEnabled =
        document.getElementById(
            "limiterEnabled"
        );

    const limiterThreshold =
        document.getElementById(
            "limiterThreshold"
        );

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

    const compressorEnabled =
        document.getElementById(
            "compressorEnabled"
        );

    const compressorThreshold =
        document.getElementById(
            "compressorThreshold"
        );

    const compressorRatio =
        document.getElementById(
            "compressorRatio"
        );

    const compressorAttack =
        document.getElementById(
            "compressorAttack"
        );

    const compressorRelease =
        document.getElementById(
            "compressorRelease"
        );

    const applyButton =
        document.getElementById(
            "applyProcessingBtn"
        );

    const eqEnabled =
        document.getElementById(
            "eqEnabled"
        );

    const eqLowGain =
        document.getElementById(
            "eqLowGain"
        );

    const eqMidGain =
        document.getElementById(
            "eqMidGain"
        );

    const eqHighGain =
        document.getElementById(
            "eqHighGain"
        );

    const eqGainControls = [
        {
            element: eqLowGain,
            settingName: "lowGain"
        },
        {
            element: eqMidGain,
            settingName: "midGain"
        },
        {
            element: eqHighGain,
            settingName: "highGain"
        }
    ];

    for (
        const {
            element,
            settingName
        } of eqGainControls
    ) {
        element.addEventListener(
            "input",
            () => {
                updateProcessingSettings(
                    "eq",
                    {
                        [settingName]:
                            Number(element.value)
                    }
                );

                renderEqControls();
                markProcessingAsChanged();
            }
        );
    }

    const distortionEnabled =
        document.getElementById(
            "distortionEnabled"
        );

    const distortionDrive =
        document.getElementById(
            "distortionDrive"
        );

    const distortionMix =
        document.getElementById(
            "distortionMix"
        );

    const distortionOversample =
        document.getElementById(
            "distortionOversample"
        );

    const chorusEnabled =
        document.getElementById(
            "chorusEnabled"
        );

    const chorusRate =
        document.getElementById(
            "chorusRate"
        );

    const chorusDepth =
        document.getElementById(
            "chorusDepth"
        );

    const chorusMix =
        document.getElementById(
            "chorusMix"
        );

    const delayEnabled =
        document.getElementById(
            "delayEnabled"
        );

    const delayTime =
        document.getElementById(
            "delayTime"
        );

    const delayFeedback =
        document.getElementById(
            "delayFeedback"
        );

    const delayMix =
        document.getElementById(
            "delayMix"
        );

    const reverbEnabled =
        document.getElementById(
            "reverbEnabled"
        );

    const reverbDuration =
        document.getElementById(
            "reverbDuration"
        );

    const reverbDecay =
        document.getElementById(
            "reverbDecay"
        );

    const reverbMix =
        document.getElementById(
            "reverbMix"
        );

    distortionEnabled.addEventListener(
        "change",
        () => {
            updateProcessingSettings(
                "distortion",
                {
                    enabled:
                        distortionEnabled.checked
                }
            );

            renderDistortionControls();
            markProcessingAsChanged();
        }
    );

    distortionDrive.addEventListener(
        "input",
        () => {
            updateProcessingSettings(
                "distortion",
                {
                    drive:
                        Number(
                            distortionDrive.value
                        )
                }
            );

            renderDistortionControls();
            markProcessingAsChanged();
        }
    );

    distortionMix.addEventListener(
        "input",
        () => {
            updateProcessingSettings(
                "distortion",
                {
                    mix:
                        Number(
                            distortionMix.value
                        )
                }
            );

            renderDistortionControls();
            markProcessingAsChanged();
        }
    );

    distortionOversample.addEventListener(
        "change",
        () => {
            updateProcessingSettings(
                "distortion",
                {
                    oversample:
                        distortionOversample.value
                }
            );

            renderDistortionControls();
            markProcessingAsChanged();
        }
    );

    chorusEnabled.addEventListener(
        "change",
        () => {
            updateProcessingSettings(
                "chorus",
                {
                    enabled:
                        chorusEnabled.checked
                }
            );

            renderChorusControls();
            markProcessingAsChanged();
        }
    );

    const chorusControls = [
        {
            element: chorusRate,
            settingName: "rate"
        },
        {
            element: chorusDepth,
            settingName: "depthMs"
        },
        {
            element: chorusMix,
            settingName: "mix"
        }
    ];

    for (
        const {
            element,
            settingName
        } of chorusControls
    ) {
        element.addEventListener(
            "input",
            () => {
                updateProcessingSettings(
                    "chorus",
                    {
                        [settingName]:
                            Number(element.value)
                    }
                );

                renderChorusControls();
                markProcessingAsChanged();
            }
        );
    }

    const delayControls = [
        {
            element: delayTime,
            settingName: "time"
        },
        {
            element: delayFeedback,
            settingName: "feedback"
        },
        {
            element: delayMix,
            settingName: "mix"
        }
    ];

    for (
        const {
            element,
            settingName
        } of delayControls
    ) {
        element.addEventListener(
            "input",
            () => {
                updateProcessingSettings(
                    "delay",
                    {
                        [settingName]:
                            Number(element.value)
                    }
                );

                renderDelayControls();
                markProcessingAsChanged();
            }
        );
    }

    reverbEnabled.addEventListener(
        "change",
        () => {
            updateProcessingSettings(
                "reverb",
                {
                    enabled:
                        reverbEnabled.checked
                }
            );

            renderReverbControls();
            markProcessingAsChanged();
        }
    );

    const reverbControls = [
        {
            element: reverbDuration,
            settingName: "duration"
        },
        {
            element: reverbDecay,
            settingName: "decay"
        },
        {
            element: reverbMix,
            settingName: "mix"
        }
    ];

    for (
        const {
            element,
            settingName
        } of reverbControls
    ) {
        element.addEventListener(
            "input",
            () => {
                updateProcessingSettings(
                    "reverb",
                    {
                        [settingName]:
                            Number(element.value)
                    }
                );

                renderReverbControls();
                markProcessingAsChanged();
            }
        );
    }

    limiterEnabled.addEventListener(
        "change",
        () => {
            updateProcessingSettings(
                "limiter",
                {
                    enabled:
                        limiterEnabled.checked
                }
            );

            renderLimiterControls();
            markProcessingAsChanged();
        }
    );

    limiterThreshold.addEventListener(
        "input",
        () => {
            updateProcessingSettings(
                "limiter",
                {
                    threshold:
                        Number(
                            limiterThreshold.value
                        )
                }
            );

            renderLimiterControls();
            markProcessingAsChanged();
        }
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
                renderExportStatus(
                    "ready for download"
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

    compressorEnabled.addEventListener(
        "change",
        () => {
            updateProcessingSettings(
                "compressor",
                {
                    enabled:
                        compressorEnabled.checked
                }
            );

            renderCompressorControls();
            markProcessingAsChanged();
        }
    );

    compressorThreshold.addEventListener(
        "input",
        () => {
            updateProcessingSettings(
                "compressor",
                {
                    threshold:
                        Number(
                            compressorThreshold.value
                        )
                }
            );

            renderCompressorControls();
            markProcessingAsChanged();
        }
    );

    compressorRatio.addEventListener(
        "input",
        () => {
            updateProcessingSettings(
                "compressor",
                {
                    ratio:
                        Number(
                            compressorRatio.value
                        )
                }
            );

            renderCompressorControls();
            markProcessingAsChanged();
        }
    );

    compressorAttack.addEventListener(
        "input",
        () => {
            updateProcessingSettings(
                "compressor",
                {
                    attack:
                        Number(
                            compressorAttack.value
                        )
                }
            );

            renderCompressorControls();
            markProcessingAsChanged();
        }
    );

    compressorRelease.addEventListener(
        "input",
        () => {
            updateProcessingSettings(
                "compressor",
                {
                    release:
                        Number(
                            compressorRelease.value
                        )
                }
            );

            renderCompressorControls();
            markProcessingAsChanged();
        }
    );

    eqEnabled.addEventListener(
        "change",
        () => {
            updateProcessingSettings(
                "eq",
                {
                    enabled: eqEnabled.checked
                }
            );

            renderEqControls();
            markProcessingAsChanged();
        }
    );

    delayEnabled.addEventListener(
        "change",
        () => {
            updateProcessingSettings(
                "delay",
                {
                    enabled:
                        delayEnabled.checked
                }
            );

            renderDelayControls();
            markProcessingAsChanged();
        }
    );
}


function bindProcessingModuleToggles() {
    const modules =
        document.querySelectorAll(
            "[data-toggle-input]"
        );

    for (const moduleElement of modules) {
        const inputElement =
            document.getElementById(
                moduleElement.dataset.toggleInput
            );

        if (!inputElement) {
            console.warn(
                `Processing toggle not found: ${moduleElement.dataset.toggleInput}`
            );
            continue;
        }

        moduleElement.addEventListener(
            "click",
            event => {
                if (
                    isInteractiveProcessingTarget(
                        event.target
                    )
                ) {
                    return;
                }

                toggleProcessingModule(
                    inputElement
                );
            }
        );

        moduleElement.addEventListener(
            "keydown",
            event => {
                if (
                    event.target !== moduleElement ||
                    ![
                        "Enter",
                        " "
                    ].includes(event.key)
                ) {
                    return;
                }

                event.preventDefault();

                toggleProcessingModule(
                    inputElement
                );
            }
        );
    }
}

function toggleProcessingModule(inputElement) {
    inputElement.checked =
        !inputElement.checked;

    inputElement.dispatchEvent(
        new Event(
            "change",
            {
                bubbles: true
            }
        )
    );
}

function isInteractiveProcessingTarget(target) {
    return Boolean(
        target.closest(
            "input, select, button, a, label, [data-knob-for]"
        )
    );
}

function renderProcessingModuleStates() {
    const modules =
        document.querySelectorAll(
            "[data-toggle-input]"
        );

    for (const moduleElement of modules) {
        const inputElement =
            document.getElementById(
                moduleElement.dataset.toggleInput
            );

        if (!inputElement) {
            continue;
        }

        const enabled =
            inputElement.checked;

        moduleElement.classList.toggle(
            "is-enabled",
            enabled
        );

        moduleElement.setAttribute(
            "aria-pressed",
            String(enabled)
        );

        const statusElement =
            moduleElement.querySelector(
                "[data-module-status]"
            );

        if (statusElement) {
            statusElement.textContent =
                enabled ? "On" : "Off";
        }
    }
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

function bindExportControls() {
    const downloadButton =
        document.getElementById(
            "downloadWavBtn"
        );

    const fileNameInput =
        document.getElementById(
            "exportFileName"
        );

    fileNameInput.addEventListener(
        "input",
        () => {
            fileNameInput.dataset.userEdited =
                "true";
        }
    );

    downloadButton.addEventListener(
        "click",
        () => {
            try {
                downloadProcessedAudioAsWav();
            } catch (error) {
                console.error(error);
                alert(error.message);

                renderExportStatus(
                    "export error"
                );
            }
        }
    );
}

function downloadProcessedAudioAsWav() {
    if (!state.processedBuffer) {
        throw new Error(
            "No processed audio available. Apply processing first."
        );
    }

    renderExportStatus("encoding WAV");

    const wavBlob =
        encodeWav(
            state.processedBuffer
        );

    const objectUrl =
        URL.createObjectURL(wavBlob);

    const downloadLink =
        document.createElement("a");

    downloadLink.href =
        objectUrl;

    downloadLink.download =
        buildExportFileName();

    document.body.appendChild(
        downloadLink
    );

    downloadLink.click();
    downloadLink.remove();

    /*
     * La revoca viene rimandata per consentire
     * al browser di avviare correttamente
     * il download.
     */
    window.setTimeout(
        () => {
            URL.revokeObjectURL(
                objectUrl
            );
        },
        1000
    );

    renderExportStatus(
        "download started"
    );
}

function buildExportFileName() {
    const fileNameInput =
        document.getElementById(
            "exportFileName"
        );

    const requestedName =
        fileNameInput.value.trim();

    const fallbackName =
        getDefaultExportFileName();

    const sanitizedName =
        sanitizeFileName(
            requestedName || fallbackName
        );

    if (
        sanitizedName
            .toLowerCase()
            .endsWith(".wav")
    ) {
        return sanitizedName;
    }

    return `${sanitizedName}.wav`;
}

function getDefaultExportFileName() {
    const originalName =
        state.originalFile?.name;

    if (!originalName) {
        return "processed-audio";
    }

    const lastDotIndex =
        originalName.lastIndexOf(".");

    const baseName =
        lastDotIndex > 0
            ? originalName.slice(
                0,
                lastDotIndex
            )
            : originalName;

    return `${baseName}-processed`;
}

function sanitizeFileName(fileName) {
    const sanitized =
        fileName
            .replace(
                /[<>:"/\\|?*\u0000-\u001F]/g,
                "-"
            )
            .replace(/\s+/g, " ")
            .trim()
            .replace(/[. ]+$/g, "");

    return sanitized || "processed-audio";
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

    renderExportStatus(
        "no processed audio"
    );
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
    renderEqControls();
    renderCompressorControls();
    renderDistortionControls();
    renderChorusControls();
    renderDelayControls();
    renderReverbControls();
    renderNormalizationControls();
    renderLimiterControls();
    renderExportControls();

    updatePlaybackUI(tracks.original);
    updatePlaybackUI(tracks.processed);

    renderProcessingModuleStates();
    refreshAllRotaryKnobs();
}

function renderOriginalAudioInfo(currentState) {
    const fileNameElement =
        document.getElementById("originalFileName");

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
        sampleRateElement.textContent = "-";
        channelsElement.textContent = "-";
        peakElement.textContent = "-";
        peakDbElement.textContent = "-";
        return;
    }

    fileNameElement.textContent =
        currentState.originalFile?.name ?? "-";

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

    const sampleRateElement =
        document.getElementById("processedSampleRate");

    const channelsElement =
        document.getElementById("processedChannels");

    const peakElement =
        document.getElementById("processedPeak");

    const peakDbElement =
        document.getElementById("processedPeakDb");

    if (!currentState.processedBuffer) {
        sampleRateElement.textContent = "-";
        channelsElement.textContent = "-";
        peakElement.textContent = "-";
        peakDbElement.textContent = "-";
        return;
    }

    sampleRateElement.textContent =
        `${currentState.processedInfo.sampleRate} Hz`;

    channelsElement.textContent =
        currentState.processedInfo.numberOfChannels;

    peakElement.textContent =
        currentState.processedInfo.peakLinear.toFixed(4);

    peakDbElement.textContent =
        formatDb(currentState.processedInfo.peakDb);
}

function renderLimiterControls() {
    const enabledElement =
        document.getElementById(
            "limiterEnabled"
        );

    const thresholdElement =
        document.getElementById(
            "limiterThreshold"
        );

    const thresholdValueElement =
        document.getElementById(
            "limiterThresholdValue"
        );

    const settings =
        state.processingSettings.limiter;

    enabledElement.checked =
        settings.enabled;

    thresholdElement.disabled =
        !settings.enabled;

    thresholdElement.value =
        String(settings.threshold);

    thresholdValueElement.textContent =
        `${settings.threshold.toFixed(1)} dBFS`;
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

function renderCompressorControls() {
    const enabledElement =
        document.getElementById(
            "compressorEnabled"
        );

    const thresholdElement =
        document.getElementById(
            "compressorThreshold"
        );

    const ratioElement =
        document.getElementById(
            "compressorRatio"
        );

    const attackElement =
        document.getElementById(
            "compressorAttack"
        );

    const releaseElement =
        document.getElementById(
            "compressorRelease"
        );

    const thresholdValueElement =
        document.getElementById(
            "compressorThresholdValue"
        );

    const ratioValueElement =
        document.getElementById(
            "compressorRatioValue"
        );

    const attackValueElement =
        document.getElementById(
            "compressorAttackValue"
        );

    const releaseValueElement =
        document.getElementById(
            "compressorReleaseValue"
        );

    const settings =
        state.processingSettings.compressor;

    enabledElement.checked =
        settings.enabled;

    thresholdElement.disabled =
        !settings.enabled;

    ratioElement.disabled =
        !settings.enabled;

    attackElement.disabled =
        !settings.enabled;

    releaseElement.disabled =
        !settings.enabled;

    thresholdElement.value =
        String(settings.threshold);

    ratioElement.value =
        String(settings.ratio);

    attackElement.value =
        String(settings.attack);

    releaseElement.value =
        String(settings.release);

    thresholdValueElement.textContent =
        `${settings.threshold.toFixed(0)} dB`;

    ratioValueElement.textContent =
        `${settings.ratio.toFixed(1)}:1`;

    attackValueElement.textContent =
        `${settings.attack.toFixed(3)} s`;

    releaseValueElement.textContent =
        `${settings.release.toFixed(3)} s`;
}

function renderProcessingStatus(status) {
    const statusElement =
        document.getElementById("processingStatus");

    statusElement.textContent = status;
}

function renderRecordingStatus() {
    const statusElement =
        document.getElementById("recordingStatus");

    const mimeTypeElement =
        document.getElementById("recordingMimeType");


    if (microphoneRecorder) {
        mimeTypeElement.textContent =
            microphoneRecorder.getMimeType();
    } else {
        mimeTypeElement.textContent = "-";
    }
}

function renderEqControls() {
    const enabledElement =
        document.getElementById(
            "eqEnabled"
        );

    const settings =
        state.processingSettings.eq;

    enabledElement.checked =
        settings.enabled;

    const controls = [
        {
            sliderId: "eqLowGain",
            valueId: "eqLowGainValue",
            value: settings.lowGain
        },
        {
            sliderId: "eqMidGain",
            valueId: "eqMidGainValue",
            value: settings.midGain
        },
        {
            sliderId: "eqHighGain",
            valueId: "eqHighGainValue",
            value: settings.highGain
        }
    ];

    for (const control of controls) {
        const slider =
            document.getElementById(
                control.sliderId
            );

        const valueElement =
            document.getElementById(
                control.valueId
            );

        slider.disabled =
            !settings.enabled;

        slider.value =
            String(control.value);

        valueElement.textContent =
            formatSignedDb(
                control.value
            );
    }
}

function renderDistortionControls() {
    const enabledElement =
        document.getElementById(
            "distortionEnabled"
        );

    const driveElement =
        document.getElementById(
            "distortionDrive"
        );

    const mixElement =
        document.getElementById(
            "distortionMix"
        );

    const oversampleElement =
        document.getElementById(
            "distortionOversample"
        );

    const driveValueElement =
        document.getElementById(
            "distortionDriveValue"
        );

    const mixValueElement =
        document.getElementById(
            "distortionMixValue"
        );

    const settings =
        state.processingSettings.distortion;

    enabledElement.checked =
        settings.enabled;

    driveElement.disabled =
        !settings.enabled;

    mixElement.disabled =
        !settings.enabled;

    oversampleElement.disabled =
        !settings.enabled;

    driveElement.value =
        String(settings.drive);

    mixElement.value =
        String(settings.mix);

    oversampleElement.value =
        settings.oversample;

    driveValueElement.textContent =
        `${Math.round(settings.drive)}%`;

    mixValueElement.textContent =
        `${Math.round(
            settings.mix * 100
        )}%`;
}

function renderChorusControls() {
    const enabledElement =
        document.getElementById(
            "chorusEnabled"
        );

    const rateElement =
        document.getElementById(
            "chorusRate"
        );

    const depthElement =
        document.getElementById(
            "chorusDepth"
        );

    const mixElement =
        document.getElementById(
            "chorusMix"
        );

    const rateValueElement =
        document.getElementById(
            "chorusRateValue"
        );

    const depthValueElement =
        document.getElementById(
            "chorusDepthValue"
        );

    const mixValueElement =
        document.getElementById(
            "chorusMixValue"
        );

    const settings =
        state.processingSettings.chorus;

    enabledElement.checked =
        settings.enabled;

    rateElement.disabled =
        !settings.enabled;

    depthElement.disabled =
        !settings.enabled;

    mixElement.disabled =
        !settings.enabled;

    rateElement.value =
        String(settings.rate);

    depthElement.value =
        String(settings.depthMs);

    mixElement.value =
        String(settings.mix);

    rateValueElement.textContent =
        `${settings.rate.toFixed(2)} Hz`;

    depthValueElement.textContent =
        `${settings.depthMs.toFixed(1)} ms`;

    mixValueElement.textContent =
        `${Math.round(
            settings.mix * 100
        )}%`;
}

function renderDelayControls() {
    const enabledElement =
        document.getElementById(
            "delayEnabled"
        );

    const timeElement =
        document.getElementById(
            "delayTime"
        );

    const feedbackElement =
        document.getElementById(
            "delayFeedback"
        );

    const mixElement =
        document.getElementById(
            "delayMix"
        );

    const timeValueElement =
        document.getElementById(
            "delayTimeValue"
        );

    const feedbackValueElement =
        document.getElementById(
            "delayFeedbackValue"
        );

    const mixValueElement =
        document.getElementById(
            "delayMixValue"
        );

    const settings =
        state.processingSettings.delay;

    enabledElement.checked =
        settings.enabled;

    timeElement.disabled =
        !settings.enabled;

    feedbackElement.disabled =
        !settings.enabled;

    mixElement.disabled =
        !settings.enabled;

    timeElement.value =
        String(settings.time);

    feedbackElement.value =
        String(settings.feedback);

    mixElement.value =
        String(settings.mix);

    timeValueElement.textContent =
        `${settings.time.toFixed(3)} s`;

    feedbackValueElement.textContent =
        `${Math.round(
            settings.feedback * 100
        )}%`;

    mixValueElement.textContent =
        `${Math.round(
            settings.mix * 100
        )}%`;
}

function renderReverbControls() {
    const enabledElement =
        document.getElementById(
            "reverbEnabled"
        );

    const durationElement =
        document.getElementById(
            "reverbDuration"
        );

    const decayElement =
        document.getElementById(
            "reverbDecay"
        );

    const mixElement =
        document.getElementById(
            "reverbMix"
        );

    const durationValueElement =
        document.getElementById(
            "reverbDurationValue"
        );

    const decayValueElement =
        document.getElementById(
            "reverbDecayValue"
        );

    const mixValueElement =
        document.getElementById(
            "reverbMixValue"
        );

    const settings =
        state.processingSettings.reverb;

    enabledElement.checked =
        settings.enabled;

    durationElement.disabled =
        !settings.enabled;

    decayElement.disabled =
        !settings.enabled;

    mixElement.disabled =
        !settings.enabled;

    durationElement.value =
        String(settings.duration);

    decayElement.value =
        String(settings.decay);

    mixElement.value =
        String(settings.mix);

    durationValueElement.textContent =
        `${settings.duration.toFixed(2)} s`;

    decayValueElement.textContent =
        settings.decay.toFixed(1);

    mixValueElement.textContent =
        `${Math.round(
            settings.mix * 100
        )}%`;
}

function renderExportControls() {
    const downloadButton =
        document.getElementById(
            "downloadWavBtn"
        );

    const fileNameInput =
        document.getElementById(
            "exportFileName"
        );

    const hasProcessedAudio =
        Boolean(
            state.processedBuffer
        );

    downloadButton.disabled =
        !hasProcessedAudio;

    fileNameInput.disabled =
        !hasProcessedAudio;

    if (!hasProcessedAudio) {
        return;
    }

    /*
     * Non sovrascriviamo un nome modificato
     * manualmente dall'utente.
     */
    if (
        !fileNameInput.dataset.userEdited
    ) {
        fileNameInput.value =
            getDefaultExportFileName();
    }
}

function renderExportStatus(status) {
    const statusElement =
        document.getElementById(
            "exportStatus"
        );

    statusElement.textContent =
        status;
}

function formatSignedDb(value) {
    const numericValue =
        Number(value);

    const prefix =
        numericValue > 0
            ? "+"
            : "";

    return `${prefix}${numericValue.toFixed(1)} dB`;
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