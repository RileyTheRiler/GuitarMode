/**
 * Pitch-preserving time stretch using overlap-add (OLA).
 *
 * Quality is good enough for practice slowdown (0.5x–1.5x). It does not do
 * phase correction, so harsh polyphony at extreme rates can sound smeared,
 * but for monophonic guitar lines the artifacts are minor.
 *
 * Algorithm:
 *   - Cut the input into grains of `grainSize` samples (Hann-windowed).
 *   - For each output grain at hop `hopOut`, take an input grain starting at
 *     `inPos = grainIndex * hopIn` where `hopIn = hopOut * rate`.
 *   - Sum windowed grains into the output buffer.
 *
 * Result: when rate < 1 we emit more grains per second of original audio,
 * stretching it. When rate > 1 we emit fewer, compressing it. Pitch is
 * preserved because each grain plays at the original sample rate.
 */

const GRAIN_S = 0.05; // ~50 ms

function grainParams(sampleRate: number, rate: number) {
  const grainSize = Math.max(8, Math.round(GRAIN_S * sampleRate));
  const hopOut = Math.max(1, Math.floor(grainSize / 2));
  const hopIn = Math.max(1, Math.round(hopOut * rate));
  return { grainSize, hopOut, hopIn };
}

/** Per-channel overlap-add. Pure — testable without Web Audio. */
export function stretchChannelOLA(
  inData: Float32Array,
  sampleRate: number,
  rate: number
): Float32Array {
  if (rate === 1) return inData.slice();
  const inLen = inData.length;
  const outLen = Math.max(1, Math.round(inLen / rate));
  const { grainSize, hopOut, hopIn } = grainParams(sampleRate, rate);
  const out = new Float32Array(outLen);

  const w = new Float32Array(grainSize);
  for (let i = 0; i < grainSize; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (grainSize - 1));
  }

  let inPosF = 0;
  let outPos = 0;
  while (outPos + grainSize <= outLen) {
    const inStart = Math.floor(inPosF);
    if (inStart + grainSize > inLen) break;
    for (let i = 0; i < grainSize; i++) {
      out[outPos + i] += inData[inStart + i] * w[i];
    }
    inPosF += hopIn;
    outPos += hopOut;
  }

  return out;
}

/** Stretch an AudioBuffer; constructs a new one at the same sample rate. */
export function stretchOLA(buffer: AudioBuffer, rate: number): AudioBuffer {
  if (!(rate > 0) || !Number.isFinite(rate)) {
    throw new Error("stretchOLA: rate must be a positive finite number");
  }
  if (rate === 1) return buffer;

  const sr = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const inLen = buffer.length;
  const outLen = Math.max(grainParams(sr, rate).grainSize, Math.round(inLen / rate));

  const out = new AudioBuffer({
    length: outLen,
    sampleRate: sr,
    numberOfChannels: numChannels,
  });
  for (let ch = 0; ch < numChannels; ch++) {
    const stretched = stretchChannelOLA(buffer.getChannelData(ch), sr, rate);
    out.getChannelData(ch).set(stretched.subarray(0, outLen));
  }
  return out;
}
