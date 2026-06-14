// Float32 to 16bit PCM Little Endian conversion
export function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

// Convert ArrayBuffer to raw Base64 string
export function base64ArrayBuffer(arrayBuffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Full PCM conversion flow
export function pcmToBase64(float32Array: Float32Array): string {
  const pcmBuffer = floatTo16BitPCM(float32Array);
  return base64ArrayBuffer(pcmBuffer);
}

// Playback queue and node storage
let activeSources: AudioBufferSourceNode[] = [];

// Stop any currently playing audio nodes
export function stopAllPlayerAudio() {
  activeSources.forEach((src) => {
    try { src.stop(); } catch (e) {}
  });
  activeSources = [];
}

// Stream play a 24kHz raw PCM chunk
export function playAudioChunk(audioContext: AudioContext, base64PCM: string) {
  try {
    const binaryString = window.atob(base64PCM);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);
    
    // convert signed int16 raw values back to normalized float32
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768;
    }
    
    // Create mono audio output buffer at 24kHz
    const buffer = audioContext.createBuffer(1, float32Array.length, 24000);
    buffer.copyToChannel(float32Array, 0);
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
    
    activeSources.push(source);
    source.onended = () => {
      activeSources = activeSources.filter((s) => s !== source);
    };
  } catch (error) {
    console.error('Failed playing audio PCM chunk:', error);
  }
}
