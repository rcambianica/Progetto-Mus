export function drawWaveform(canvas, audioBuffer) {
    if (!canvas || !audioBuffer) {
        return;
    }

    const context = canvas.getContext("2d");

    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    const devicePixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(displayWidth * devicePixelRatio);
    canvas.height = Math.floor(displayHeight * devicePixelRatio);

    context.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0
    );

    clearCanvas(context, displayWidth, displayHeight);

    const numberOfChannels = audioBuffer.numberOfChannels;
    const channelHeight = displayHeight / numberOfChannels;

    for (
        let channel = 0;
        channel < numberOfChannels;
        channel++
    ) {
        drawChannelWaveform(
            context,
            audioBuffer,
            channel,
            displayWidth,
            channelHeight,
            channel * channelHeight
        );
    }

    drawChannelSeparators(
        context,
        displayWidth,
        displayHeight,
        numberOfChannels
    );
}

export function clearWaveform(canvas) {
    if (!canvas) {
        return;
    }

    const context = canvas.getContext("2d");

    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    const devicePixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(displayWidth * devicePixelRatio);
    canvas.height = Math.floor(displayHeight * devicePixelRatio);

    context.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0
    );

    clearCanvas(context, displayWidth, displayHeight);
}

function clearCanvas(context, width, height) {
    context.clearRect(0, 0, width, height);

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
}

function drawChannelWaveform(
    context,
    audioBuffer,
    channelIndex,
    width,
    channelHeight,
    yOffset
) {
    const channelData =
        audioBuffer.getChannelData(channelIndex);

    const samplesPerPixel =
        Math.ceil(channelData.length / width);

    const centerY =
        yOffset + channelHeight / 2;

    const amplitude =
        channelHeight / 2 * 0.9;

    context.beginPath();
    context.strokeStyle = "#18181b";
    context.lineWidth = 1;

    for (let x = 0; x < width; x++) {
        const start =
            x * samplesPerPixel;

        const end =
            Math.min(
                start + samplesPerPixel,
                channelData.length
            );

        let min = 1;
        let max = -1;

        for (let i = start; i < end; i++) {
            const sample = channelData[i];

            if (sample < min) {
                min = sample;
            }

            if (sample > max) {
                max = sample;
            }
        }

        const yMin =
            centerY - max * amplitude;

        const yMax =
            centerY - min * amplitude;

        context.moveTo(x, yMin);
        context.lineTo(x, yMax);
    }

    context.stroke();

    drawZeroLine(
        context,
        width,
        centerY
    );

    drawChannelLabel(
        context,
        channelIndex,
        yOffset
    );
}

function drawZeroLine(context, width, centerY) {
    context.beginPath();
    context.strokeStyle = "#a1a1aa";
    context.lineWidth = 1;
    context.moveTo(0, centerY);
    context.lineTo(width, centerY);
    context.stroke();
}

function drawChannelLabel(context, channelIndex, yOffset) {
    context.fillStyle = "#71717a";
    context.font = "12px system-ui, sans-serif";
    context.fillText(
        `Channel ${channelIndex + 1}`,
        8,
        yOffset + 18
    );
}

function drawChannelSeparators(
    context,
    width,
    height,
    numberOfChannels
) {
    if (numberOfChannels <= 1) {
        return;
    }

    const channelHeight =
        height / numberOfChannels;

    context.beginPath();
    context.strokeStyle = "#e4e4e7";
    context.lineWidth = 1;

    for (
        let channel = 1;
        channel < numberOfChannels;
        channel++
    ) {
        const y =
            channel * channelHeight;

        context.moveTo(0, y);
        context.lineTo(width, y);
    }

    context.stroke();
}