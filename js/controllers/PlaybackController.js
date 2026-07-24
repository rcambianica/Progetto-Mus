import {
    state
} from "../state.js";

import {
    resumeAudioContext
} from "../audio/AudioContextManager.js";

import {
    AudioPlayer
} from "../audio/AudioPlayer.js";

import {
    formatDuration
} from "../analysis/AudioInfo.js";

export class PlaybackController {
    constructor({
        syncOriginalWaveformToTime,
        syncProcessedWaveformToTime
    }) {
        this.tracks = {
            original: createTrack({
                name: "original",
                getBuffer: () => state.originalBuffer,
                syncWaveformToTime:
                    syncOriginalWaveformToTime,
                missingAudioMessage:
                    "No original audio loaded."
            }),

            processed: createTrack({
                name: "processed",
                getBuffer: () => state.processedBuffer,
                syncWaveformToTime:
                    syncProcessedWaveformToTime,
                missingAudioMessage:
                    "No processed audio available. Apply processing first."
            })
        };
    }

    bind() {
        this.bindTrackControls(
            this.tracks.original
        );

        this.bindTrackControls(
            this.tracks.processed
        );
    }

    setupTrack(
        trackName,
        audioContext,
        audioBuffer
    ) {
        const track =
            this.getTrack(trackName);

        if (!track.player) {
            track.player =
                new AudioPlayer(audioContext);
        }

        track.player.setBuffer(audioBuffer);
        track.syncWaveformToTime(0);

        this.renderTrack(track);
    }

    resetTrack(trackName) {
        const track =
            this.getTrack(trackName);

        if (track.player) {
            track.player.stop();
        }

        this.stopPlaybackAnimation(track);
        track.syncWaveformToTime(0);

        const seekSlider =
            document.getElementById(
                track.seekSliderId
            );

        if (seekSlider) {
            seekSlider.value = 0;
        }

        this.renderTrack(track);
    }

    handleWaveformInteraction(
        trackName,
        timeMs
    ) {
        const track =
            this.getTrack(trackName);

        if (!track.player || !track.getBuffer()) {
            return;
        }

        track.player.seek(timeMs);

        updateSeekSliderValue(
            track.seekSliderId,
            timeMs,
            track.player.getDurationMs()
        );

        this.renderTrack(track);

        if (track.player.isPlaying) {
            this.startPlaybackAnimation(track);
        }
    }

    render() {
        this.renderTrack(
            this.tracks.original
        );

        this.renderTrack(
            this.tracks.processed
        );
    }

    bindTrackControls(track) {
        const playButton =
            document.getElementById(
                track.playButtonId
            );

        const pauseButton =
            document.getElementById(
                track.pauseButtonId
            );

        const stopButton =
            document.getElementById(
                track.stopButtonId
            );

        const seekSlider =
            document.getElementById(
                track.seekSliderId
            );

        playButton.addEventListener(
            "click",
            async () => {
                try {
                    await resumeAudioContext();

                    const buffer =
                        track.getBuffer();

                    if (!track.player && buffer) {
                        track.player =
                            new AudioPlayer(
                                state.audioContext
                            );

                        track.player.setBuffer(
                            buffer
                        );
                    }

                    if (!track.player) {
                        throw new Error(
                            track.missingAudioMessage
                        );
                    }

                    track.player.play();

                    track.syncWaveformToTime(
                        track.player
                            .getCurrentTimeMs()
                    );

                    this.startPlaybackAnimation(
                        track
                    );
                } catch (error) {
                    console.error(error);
                    alert(error.message);
                }
            }
        );

        pauseButton.addEventListener(
            "click",
            () => {
                if (!track.player) {
                    return;
                }

                track.player.pause();

                track.syncWaveformToTime(
                    track.player
                        .getCurrentTimeMs()
                );

                this.stopPlaybackAnimation(track);
                this.renderTrack(track);
            }
        );

        stopButton.addEventListener(
            "click",
            () => {
                if (!track.player) {
                    return;
                }

                track.player.stop();
                track.syncWaveformToTime(0);

                this.stopPlaybackAnimation(track);
                this.renderTrack(track);
            }
        );

        seekSlider.addEventListener(
            "input",
            () => {
                track.isUserSeeking = true;

                this.renderSliderPreview(track);
            }
        );

        seekSlider.addEventListener(
            "change",
            () => {
                if (!track.player) {
                    return;
                }

                const durationMs =
                    track.player.getDurationMs();

                const ratio =
                    Number(seekSlider.value) /
                    1000;

                const targetTimeMs =
                    durationMs * ratio;

                track.player.seek(
                    targetTimeMs
                );

                track.syncWaveformToTime(
                    targetTimeMs
                );

                track.isUserSeeking = false;

                this.renderTrack(track);

                if (track.player.isPlaying) {
                    this.startPlaybackAnimation(
                        track
                    );
                }
            }
        );
    }

    startPlaybackAnimation(track) {
        this.stopPlaybackAnimation(track);

        const tick = () => {
            this.renderTrack(track);

            if (track.player) {
                track.syncWaveformToTime(
                    track.player
                        .getCurrentTimeMs()
                );
            }

            if (
                track.player &&
                track.player.isPlaying
            ) {
                track.playbackAnimationId =
                    requestAnimationFrame(tick);
            }
        };

        track.playbackAnimationId =
            requestAnimationFrame(tick);
    }

    stopPlaybackAnimation(track) {
        if (
            track.playbackAnimationId ===
            null
        ) {
            return;
        }

        cancelAnimationFrame(
            track.playbackAnimationId
        );

        track.playbackAnimationId = null;
    }

    renderTrack(track) {
        const seekSlider =
            document.getElementById(
                track.seekSliderId
            );

        const currentTimeElement =
            document.getElementById(
                track.currentTimeId
            );

        const totalTimeElement =
            document.getElementById(
                track.totalTimeId
            );

        if (!track.getBuffer() || !track.player) {
            seekSlider.value = 0;
            currentTimeElement.textContent =
                "0:00.000";
            totalTimeElement.textContent =
                "0:00.000";
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

        if (
            !track.isUserSeeking &&
            durationMs > 0
        ) {
            seekSlider.value =
                Math.round(
                    currentTimeMs /
                    durationMs *
                    1000
                );
        }
    }

    renderSliderPreview(track) {
        if (!track.player) {
            return;
        }

        const seekSlider =
            document.getElementById(
                track.seekSliderId
            );

        const currentTimeElement =
            document.getElementById(
                track.currentTimeId
            );

        const totalTimeElement =
            document.getElementById(
                track.totalTimeId
            );

        const durationMs =
            track.player.getDurationMs();

        const previewTimeMs =
            durationMs *
            Number(seekSlider.value) /
            1000;

        currentTimeElement.textContent =
            formatDuration(previewTimeMs);

        totalTimeElement.textContent =
            formatDuration(durationMs);
    }

    getTrack(trackName) {
        const track =
            this.tracks[trackName];

        if (!track) {
            throw new Error(
                `Unknown playback track: ${trackName}`
            );
        }

        return track;
    }
}

function createTrack({
    name,
    getBuffer,
    syncWaveformToTime,
    missingAudioMessage
}) {
    return {
        name,
        player: null,
        playbackAnimationId: null,
        isUserSeeking: false,

        getBuffer,

        playButtonId: `${name}PlayBtn`,
        pauseButtonId: `${name}PauseBtn`,
        stopButtonId: `${name}StopBtn`,

        seekSliderId: `${name}SeekSlider`,
        currentTimeId: `${name}CurrentTime`,
        totalTimeId: `${name}TotalTime`,

        syncWaveformToTime,
        missingAudioMessage
    };
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
            timeMs /
            durationMs *
            1000
        );
}