export function getPeak(audioBuffer) {
    if (!audioBuffer) {
        return 0;
    }

    let peak = 0;

    for (
        let channel = 0;
        channel < audioBuffer.numberOfChannels;
        channel++
    ) {
        const data = audioBuffer.getChannelData(channel);

        for (let i = 0; i < data.length; i++) {
            const absoluteValue = Math.abs(data[i]);

            if (absoluteValue > peak) {
                peak = absoluteValue;
            }
        }
    }

    return peak;
}

export function linearToDb(value) {
    if (value <= 0) {
        return -Infinity;
    }

    return 20 * Math.log10(value);
}

export function dbToLinear(db) {
    return Math.pow(10, db / 20);
}