/**
 * Frame producer AudioWorklet.
 *
 * Buffers mono input into fixed-size hops (default 2048 samples, 50% overlap)
 * and posts each completed frame to the main thread where pitchy + the chroma
 * detector run. Audio I/O happens on the dedicated realtime thread, so frame
 * delivery does not depend on requestAnimationFrame (which throttles in
 * background tabs).
 */
class FrameProducer extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.frameSize = opts.frameSize || 2048;
    this.hopSize = opts.hopSize || this.frameSize / 2;
    this.buffer = new Float32Array(this.frameSize);
    this.fill = 0;
    this.sinceLastHop = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels || channels.length === 0) return true;
    const input = channels[0];
    if (!input) return true;

    for (let i = 0; i < input.length; i++) {
      if (this.fill < this.frameSize) {
        this.buffer[this.fill++] = input[i];
        continue;
      }
      // Buffer is full; shift by one hop each time we've accumulated hopSize
      // new samples, then copy in.
      // Slide the buffer left by one sample and append a new one at the end.
      // For hopSize=1024, fftSize=2048 this effectively keeps a rolling frame.
      this.buffer.copyWithin(0, 1);
      this.buffer[this.frameSize - 1] = input[i];
      this.sinceLastHop++;
      if (this.sinceLastHop >= this.hopSize) {
        this.sinceLastHop = 0;
        // Transfer a copy so the main thread owns a fresh buffer.
        const out = new Float32Array(this.frameSize);
        out.set(this.buffer);
        this.port.postMessage({ frame: out }, [out.buffer]);
      }
    }
    return true;
  }
}

registerProcessor("frame-producer", FrameProducer);
