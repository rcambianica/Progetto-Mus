export class MicrophoneRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.stream = null;
        this.chunks = [];
        this.startTimeMs = 0;
        this.mimeType = "";
        this.isRecording = false;
    }

    async start() {
        if (this.isRecording) {
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error(
                "Microphone recording is not supported by this browser."
            );
        }

        if (typeof MediaRecorder === "undefined") {
            throw new Error(
                "MediaRecorder is not supported by this browser."
            );
        }

        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        this.chunks = [];

        const selectedMimeType = getSupportedAudioMimeType();

        const options = selectedMimeType
            ? { mimeType: selectedMimeType }
            : undefined;

        this.mediaRecorder = new MediaRecorder(
            this.stream,
            options
        );

        this.mimeType =
            this.mediaRecorder.mimeType ||
            selectedMimeType ||
            "browser default";

        this.mediaRecorder.addEventListener(
            "dataavailable",
            event => {
                if (event.data && event.data.size > 0) {
                    this.chunks.push(event.data);
                }
            }
        );

        this.mediaRecorder.start();

        this.startTimeMs = performance.now();
        this.isRecording = true;
    }

    async stop() {
        if (!this.mediaRecorder || !this.isRecording) {
            throw new Error("No active recording.");
        }

        const recorder = this.mediaRecorder;

        const stoppedPromise = new Promise(resolve => {
            recorder.addEventListener(
                "stop",
                resolve,
                { once: true }
            );
        });

        recorder.stop();

        await stoppedPromise;

        this.stopStreamTracks();

        this.isRecording = false;

        const blobType =
            recorder.mimeType ||
            this.chunks[0]?.type ||
            "audio/webm";

        const audioBlob = new Blob(this.chunks, {
            type: blobType
        });

        this.mediaRecorder = null;
        this.stream = null;

        return audioBlob;
    }

    getElapsedMs() {
        if (!this.isRecording) {
            return 0;
        }

        return performance.now() - this.startTimeMs;
    }

    getMimeType() {
        return this.mimeType || "-";
    }

    stopStreamTracks() {
        if (!this.stream) {
            return;
        }

        for (const track of this.stream.getTracks()) {
            track.stop();
        }
    }
}

function getSupportedAudioMimeType() {
    const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp4"
    ];

    for (const mimeType of candidates) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
            return mimeType;
        }
    }

    return "";
}