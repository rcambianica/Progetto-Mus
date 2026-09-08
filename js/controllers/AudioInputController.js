import { setOriginalBuffer, setOriginalFile, setOriginalInfo } from '../state.js';

import { resumeAudioContext } from '../audio/AudioContextManager.js';

import { loadAudioFile } from '../audio/AudioLoader.js';

import { MicrophoneRecorder } from '../audio/MicrophoneRecorder.js';

import { analyzeAudioBuffer, formatDuration } from '../analysis/AudioInfo.js';

import { renderOriginalWaveformWithWaveSurfer } from '../ui/WaveSurferView.js';

export class AudioInputController {
    constructor({ playbackController, processingController }) {
        this.playbackController = playbackController;

        this.processingController = processingController;

        this.microphoneRecorder = null;
        this.recordingAnimationId = null;
        this.recordingStatus = 'inactive';
    }

    bind() {
        this.bindFileInput();
        this.bindRecordingControls();
        this.render();
    }

    render() {
        const statusElement = document.getElementById('recordingStatus');

        const mimeTypeElement = document.getElementById('recordingMimeType');

        statusElement.textContent = this.recordingStatus;

        mimeTypeElement.textContent = this.microphoneRecorder ? this.microphoneRecorder.getMimeType() : '-';
    }

    bindFileInput() {
        const audioFileInput = document.getElementById('audioFileInput');

        audioFileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];

            if (!file) {
                return;
            }

            try {
                await this.useFileAsOriginalAudio(file);
            } catch (error) {
                console.error(error);
                alert(error.message);
            }
        });
    }

    bindRecordingControls() {
        const startButton = document.getElementById('startRecordingBtn');

        const stopButton = document.getElementById('stopRecordingBtn');

        startButton.addEventListener('click', async () => {
            try {
                await resumeAudioContext();

                if (!this.microphoneRecorder) {
                    this.microphoneRecorder = new MicrophoneRecorder();
                }

                await this.microphoneRecorder.start();

                startButton.disabled = true;
                stopButton.disabled = false;

                this.setRecordingStatus('recording');

                this.startRecordingTimer();
            } catch (error) {
                console.error(error);
                alert(error.message);

                this.stopRecordingTimer();

                startButton.disabled = false;
                stopButton.disabled = true;

                this.setRecordingStatus('error');
            }
        });

        stopButton.addEventListener('click', async () => {
            try {
                if (!this.microphoneRecorder) {
                    return;
                }

                const audioBlob = await this.microphoneRecorder.stop();

                if (audioBlob.size === 0) {
                    throw new Error('The microphone recording is empty.');
                }

                this.stopRecordingTimer();

                startButton.disabled = false;
                stopButton.disabled = true;

                this.setRecordingStatus('processing');

                const recordedFile = createFileFromRecording(audioBlob);

                await this.useFileAsOriginalAudio(recordedFile);

                const audioFileInput = document.getElementById('audioFileInput');

                audioFileInput.value = '';

                this.setRecordingStatus('inactive');
            } catch (error) {
                console.error(error);
                alert(error.message);

                this.stopRecordingTimer();

                startButton.disabled = false;
                stopButton.disabled = true;

                this.setRecordingStatus('error');
            }
        });
    }

    async useFileAsOriginalAudio(file) {
        const audioContext = await resumeAudioContext();

        const audioBuffer = await loadAudioFile(file, audioContext);

        const info = analyzeAudioBuffer(audioBuffer);

        this.playbackController.resetTrack('original');

        this.processingController.resetProcessedAudio();

        setOriginalFile(file);
        setOriginalBuffer(audioBuffer);
        setOriginalInfo(info);

        this.playbackController.setupTrack('original', audioContext, audioBuffer);

        await renderOriginalWaveformWithWaveSurfer(file);
    }

    setRecordingStatus(status) {
        this.recordingStatus = status;
        this.render();
    }

    startRecordingTimer() {
        this.stopRecordingTimer();

        const tick = () => {
            this.updateRecordingTime();

            if (this.microphoneRecorder && this.microphoneRecorder.isRecording) {
                this.recordingAnimationId = requestAnimationFrame(tick);
            }
        };

        this.recordingAnimationId = requestAnimationFrame(tick);
    }

    stopRecordingTimer() {
        if (this.recordingAnimationId !== null) {
            cancelAnimationFrame(this.recordingAnimationId);

            this.recordingAnimationId = null;
        }

        this.updateRecordingTime();
    }

    updateRecordingTime() {
        const recordingTimeElement = document.getElementById('recordingTime');

        if (!this.microphoneRecorder || !this.microphoneRecorder.isRecording) {
            recordingTimeElement.textContent = '0:00.000';
            return;
        }

        recordingTimeElement.textContent = formatDuration(this.microphoneRecorder.getElapsedMs());
    }
}

function createFileFromRecording(audioBlob) {
    const extension = getExtensionFromMimeType(audioBlob.type);

    const fileName = `microphone-recording-${Date.now()}.${extension}`;

    return new File([audioBlob], fileName, {
        type: audioBlob.type,
    });
}

function getExtensionFromMimeType(mimeType) {
    if (!mimeType) {
        return 'webm';
    }

    if (mimeType.includes('ogg')) {
        return 'ogg';
    }

    if (mimeType.includes('mp4')) {
        return 'mp4';
    }

    if (mimeType.includes('wav')) {
        return 'wav';
    }

    if (mimeType.includes('mpeg')) {
        return 'mp3';
    }

    return 'webm';
}
