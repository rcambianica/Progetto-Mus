import {
    setProcessedBuffer,
    setProcessedInfo,
    state
} from "../state.js";

import {
    resumeAudioContext
} from "../audio/AudioContextManager.js";

import {
    renderProcessedAudio
} from "../audio/OfflineRenderer.js";

import {
    analyzeAudioBuffer
} from "../analysis/AudioInfo.js";

import {
    clearProcessedWaveSurfer,
    renderProcessedWaveformWithWaveSurfer
} from "../ui/WaveSurferView.js";

import {
    ProcessingControlsView
} from "../ui/ProcessingControlsView.js";

const EMPTY_AUDIO_INFO = {
    durationMs: 0,
    sampleRate: 0,
    numberOfChannels: 0,
    peakLinear: 0,
    peakDb: -Infinity
};

export class ProcessingController {
    constructor({
        playbackController,
        exportController
    }) {
        this.playbackController =
            playbackController;

        this.exportController =
            exportController;

        this.status = "not processed";

        this.controlsView =
            new ProcessingControlsView({
                onSettingsChanged:
                    () => {
                        this.markSettingsChanged();
                    }
            });
    }

    bind() {
        this.controlsView.bind();

        const applyButton =
            document.getElementById(
                "applyProcessingBtn"
            );

        applyButton.addEventListener(
            "click",
            () => {
                this.applyProcessing();
            }
        );
    }

    render() {
        this.controlsView.render();
        this.renderStatus();
    }

    resetProcessedAudio() {
        this.playbackController.resetTrack(
            "processed"
        );

        setProcessedBuffer(null);
        setProcessedInfo(EMPTY_AUDIO_INFO);

        clearProcessedWaveSurfer();

        this.setStatus("not processed");

        this.exportController.reset();
    }

    markSettingsChanged() {
        if (state.processedBuffer) {
            const status =
                "settings changed — apply processing again";

            this.setStatus(status);
            this.exportController.invalidate(status);
            return;
        }

        this.setStatus("not processed");
        this.exportController.reset();
    }

    async applyProcessing() {
        try {
            await resumeAudioContext();

            if (!state.originalBuffer) {
                throw new Error(
                    "No original audio loaded."
                );
            }

            this.setStatus("processing");
            this.exportController.invalidate(
                "processing audio"
            );

            this.playbackController.resetTrack(
                "processed"
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

            this.playbackController.setupTrack(
                "processed",
                state.audioContext,
                processedBuffer
            );

            await renderProcessedWaveformWithWaveSurfer(
                processedBuffer
            );

            this.setStatus("processed");

            this.exportController.markReady();
        } catch (error) {
            console.error(error);
            alert(error.message);
            this.setStatus("error");
            this.exportController.invalidate(
                "export unavailable"
            );
        }
    }

    setStatus(status) {
        this.status = status;
        this.renderStatus();
    }

    renderStatus() {
        const statusElement =
            document.getElementById(
                "processingStatus"
            );

        statusElement.textContent =
            this.status;
    }
}