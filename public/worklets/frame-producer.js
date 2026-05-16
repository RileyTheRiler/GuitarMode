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
    if (this.hopSize <= 0 || this.hopSize > this.frameSize) {
      throw new Error("hopSize must be in (0, frameSize]");
    }
    // Linear buffer: append-then-slide-by-hop. Sized to absorb a typical
    // render quantum (128 samples) on top of one full frame.
    this.buffer = new Float32Array(this.frameSize + 256);
    this.fill = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels || channels.length === 0) return true;
    const input = channels[0];
    if (!input) return true;

    // Grow if a render quantum is larger than reserved headroom.
    if (this.fill + input.length > this.buffer.length) {
      const next = new Float32Array(this.fill + input.length + 256);
      next.set(this.buffer.subarray(0, this.fill));
      this.buffer = next;
    }
    this.buffer.set(input, this.fill);
    this.fill += input.length;

    // Emit one frame per accumulated hop. Slide by hopSize after each emit
    // so the next frame overlaps by (frameSize - hopSize) samples.
    while (this.fill >= this.frameSize) {
      const out = new Float32Array(this.frameSize);
      out.set(this.buffer.subarray(0, this.frameSize));
      this.port.postMessage({ frame: out }, [out.buffer]);
      this.buffer.copyWithin(0, this.hopSize, this.fill);
      this.fill -= this.hopSize;
    }
    return true;
  }
}

registerProcessor("frame-producer", FrameProducer);
