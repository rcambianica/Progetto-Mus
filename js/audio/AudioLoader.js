export async function loadAudioFile(file, audioContext) {
  if (!file) {
    throw new Error("No audio file selected.");
  }

  const arrayBuffer = await file.arrayBuffer();

  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    throw new Error("Unable to decode audio file. The format may not be supported by this browser.");
  }
}
