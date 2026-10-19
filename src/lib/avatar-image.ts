/*
 * Image processing for the small Luna avatars: Lanczos3 downscaling and an animated GIF encoder.
 * Everything here is pure (typed arrays in, typed arrays out) so it can be tested without a browser.
 */

export interface Rgba {
  /** Straight (not premultiplied) RGBA, row by row. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const LANCZOS_A = 3;

function lanczos3(x: number): number {
  if (x === 0) return 1;
  if (x <= -LANCZOS_A || x >= LANCZOS_A) return 0;
  const px = Math.PI * x;
  return (LANCZOS_A * Math.sin(px) * Math.sin(px / LANCZOS_A)) / (px * px);
}

interface Taps {
  start: Int32Array;
  weights: Float32Array[];
}

/** Source range and normalised Lanczos3 weights for every output pixel along one axis. */
function buildTaps(srcLength: number, dstLength: number): Taps {
  const scale = srcLength / dstLength;
  const filterScale = Math.max(scale, 1); // stretch the kernel when shrinking so it low-passes
  const support = LANCZOS_A * filterScale;
  const start = new Int32Array(dstLength);
  const weights: Float32Array[] = [];
  for (let i = 0; i < dstLength; i++) {
    const center = (i + 0.5) * scale;
    const first = Math.max(0, Math.floor(center - support));
    const last = Math.min(srcLength - 1, Math.ceil(center + support));
    const w = new Float32Array(last - first + 1);
    let sum = 0;
    for (let j = first; j <= last; j++) {
      const weight = lanczos3((j + 0.5 - center) / filterScale);
      w[j - first] = weight;
      sum += weight;
    }
    if (sum !== 0) for (let k = 0; k < w.length; k++) w[k] /= sum;
    start[i] = first;
    weights.push(w);
  }
  return { start, weights };
}

/**
 * Resamples to `width` x `height` with a separable Lanczos3 filter. Colour is weighted by alpha, so
 * transparent pixels do not bleed their (meaningless) colour into the edges.
 */
export function resizeLanczos3(src: Rgba, width: number, height: number = width): Uint8ClampedArray {
  const { width: sw, height: sh } = src;
  const premultiplied = new Float32Array(sw * sh * 4);
  for (let i = 0; i < sw * sh; i++) {
    const a = src.data[i * 4 + 3] / 255;
    premultiplied[i * 4] = src.data[i * 4] * a;
    premultiplied[i * 4 + 1] = src.data[i * 4 + 1] * a;
    premultiplied[i * 4 + 2] = src.data[i * 4 + 2] * a;
    premultiplied[i * 4 + 3] = src.data[i * 4 + 3];
  }

  const horizontal = buildTaps(sw, width);
  const middle = new Float32Array(width * sh * 4);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < width; x++) {
      const w = horizontal.weights[x];
      const from = horizontal.start[x];
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < w.length; k++) {
        const p = (y * sw + from + k) * 4;
        r += premultiplied[p] * w[k];
        g += premultiplied[p + 1] * w[k];
        b += premultiplied[p + 2] * w[k];
        a += premultiplied[p + 3] * w[k];
      }
      const o = (y * width + x) * 4;
      middle[o] = r;
      middle[o + 1] = g;
      middle[o + 2] = b;
      middle[o + 3] = a;
    }
  }

  const vertical = buildTaps(sh, height);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const w = vertical.weights[y];
    const from = vertical.start[y];
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < w.length; k++) {
        const p = ((from + k) * width + x) * 4;
        r += middle[p] * w[k];
        g += middle[p + 1] * w[k];
        b += middle[p + 2] * w[k];
        a += middle[p + 3] * w[k];
      }
      const o = (y * width + x) * 4;
      const alpha = Math.min(255, Math.max(0, a));
      out[o + 3] = alpha;
      if (alpha > 0) {
        const unit = alpha / 255;
        out[o] = r / unit;
        out[o + 1] = g / unit;
        out[o + 2] = b / unit;
      }
    }
  }
  return out;
}

// ---- animated GIF ----

export interface GifFrame {
  /** `size` x `size` straight RGBA. */
  rgba: Uint8ClampedArray;
  /** Display time in centiseconds. */
  delayCs: number;
}

type Color = [number, number, number];

/** Median-cut palette of at most `count` colours for the opaque pixels of all frames. */
function buildPalette(frames: GifFrame[], count: number): Color[] {
  const histogram = new Map<number, number>();
  for (const { rgba } of frames) {
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] < 128) continue;
      const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
      histogram.set(key, (histogram.get(key) ?? 0) + 1);
    }
  }
  if (histogram.size === 0) return [[0, 0, 0]];

  interface Item { r: number; g: number; b: number; n: number }
  const items: Item[] = [...histogram].map(([key, n]) => ({ r: key >> 16, g: (key >> 8) & 255, b: key & 255, n }));
  const channels = ["r", "g", "b"] as const;
  const rangeOf = (box: Item[]) => {
    let best = { channel: "r" as (typeof channels)[number], range: 0 };
    for (const channel of channels) {
      let lo = 255, hi = 0;
      for (const item of box) {
        lo = Math.min(lo, item[channel]);
        hi = Math.max(hi, item[channel]);
      }
      if (hi - lo > best.range) best = { channel, range: hi - lo };
    }
    return best;
  };

  const boxes: Item[][] = [items];
  while (boxes.length < count) {
    let pick = -1, pickRange = 0, pickChannel: (typeof channels)[number] = "r";
    boxes.forEach((box, index) => {
      if (box.length < 2) return;
      const { channel, range } = rangeOf(box);
      if (range > pickRange) { pick = index; pickRange = range; pickChannel = channel; }
    });
    if (pick < 0) break;
    const box = boxes[pick].slice().sort((a, b) => a[pickChannel] - b[pickChannel]);
    const total = box.reduce((sum, item) => sum + item.n, 0);
    let seen = 0, cut = 0;
    while (cut < box.length - 1 && seen + box[cut].n <= total / 2) seen += box[cut++].n;
    cut = Math.max(1, cut);
    boxes.splice(pick, 1, box.slice(0, cut), box.slice(cut));
  }

  return boxes.map((box) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const item of box) {
      r += item.r * item.n;
      g += item.g * item.n;
      b += item.b * item.n;
      n += item.n;
    }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)] as Color;
  });
}

function lzwEncode(indices: Uint8Array, minCodeSize: number): number[] {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  const out: number[] = [];
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  let table = new Map<number, number>();
  let buffer = 0, bits = 0;
  const emit = (code: number) => {
    buffer |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      out.push(buffer & 255);
      buffer >>>= 8;
      bits -= 8;
    }
  };

  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = table.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    prefix = k;
    if (next === 4096) {
      emit(clear);
      next = eoi + 1;
      codeSize = minCodeSize + 1;
      table = new Map();
    } else {
      if (next >= 1 << codeSize) codeSize++;
      table.set(key, next++);
    }
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) out.push(buffer & 255);
  return out;
}

/** Encodes frames that share one palette (`tableSize` entries, the last one transparent). */
function writeGif(size: number, frames: { indices: Uint8Array; delayCs: number }[], palette: Color[], tableSize: number, transparent: number, disposal: number): Uint8Array {
  const out: number[] = [];
  const word = (value: number) => out.push(value & 255, (value >> 8) & 255);
  const tableBits = Math.log2(tableSize);

  out.push(...[..."GIF89a"].map((c) => c.charCodeAt(0)));
  word(size);
  word(size);
  out.push(0x80 | 0x70 | (tableBits - 1), 0, 0);
  for (let i = 0; i < tableSize; i++) out.push(...(palette[i] ?? [0, 0, 0]));
  out.push(0x21, 0xff, 0x0b, ...[..."NETSCAPE2.0"].map((c) => c.charCodeAt(0)), 0x03, 0x01, 0, 0, 0); // loop forever

  const minCodeSize = Math.max(2, tableBits);
  for (const frame of frames) {
    out.push(0x21, 0xf9, 0x04, (disposal << 2) | 1);
    word(Math.max(2, frame.delayCs)); // browsers treat delays under 2 cs as 10 cs
    out.push(transparent, 0);
    out.push(0x2c);
    word(0);
    word(0);
    word(size);
    word(size);
    out.push(0);
    out.push(minCodeSize);
    const data = lzwEncode(frame.indices, minCodeSize);
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255);
      out.push(chunk.length, ...chunk);
    }
    out.push(0);
  }
  out.push(0x3b);
  return Uint8Array.from(out);
}

function encodeOnce(size: number, frames: GifFrame[], tableSize: number): Uint8Array {
  const colors = tableSize - 1;
  const transparent = colors;
  const palette = buildPalette(frames, colors);
  const hasAlpha = frames.some((frame) => {
    for (let i = 3; i < frame.rgba.length; i += 4) if (frame.rgba[i] < 128) return true;
    return false;
  });

  const cache = new Map<number, number>();
  const nearest = (r: number, g: number, b: number) => {
    const key = (r << 16) | (g << 8) | b;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    let best = 0, bestDistance = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const dr = palette[i][0] - r, dg = palette[i][1] - g, db = palette[i][2] - b;
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) { bestDistance = distance; best = i; }
    }
    cache.set(key, best);
    return best;
  };

  // Opaque animations only store what changed between frames (the rest is transparent and keeps the
  // previous picture); with real transparency every frame is drawn in full on a cleared canvas.
  let previous: Uint8Array | null = null;
  const encoded = frames.map((frame) => {
    const full = new Uint8Array(size * size);
    for (let p = 0; p < size * size; p++) {
      full[p] = frame.rgba[p * 4 + 3] < 128 ? transparent : nearest(frame.rgba[p * 4], frame.rgba[p * 4 + 1], frame.rgba[p * 4 + 2]);
    }
    let indices = full;
    if (!hasAlpha && previous) {
      indices = full.map((value, p) => (value === previous![p] ? transparent : value));
    }
    previous = full;
    return { indices, delayCs: frame.delayCs };
  });
  return writeGif(size, encoded, palette, tableSize, transparent, hasAlpha ? 2 : 1);
}

/** Every `step`-th frame, with the skipped frames' time added to the one that is kept. */
function decimate(frames: GifFrame[], step: number): GifFrame[] {
  if (step <= 1) return frames;
  const kept: GifFrame[] = [];
  for (let i = 0; i < frames.length; i += step) {
    const group = frames.slice(i, i + step);
    kept.push({ rgba: group[0].rgba, delayCs: group.reduce((sum, frame) => sum + frame.delayCs, 0) });
  }
  return kept;
}

/**
 * Encodes an animation as a GIF of at most `maxBytes`: first with fewer colours, then with fewer frames
 * (keeping the total running time), until it fits. Returns null when even the smallest try is too big.
 */
export function encodeAnimatedGif(size: number, frames: GifFrame[], maxBytes: number): Uint8Array | null {
  for (const step of [1, 2, 3, 4, 6, 8, 12]) {
    const candidate = decimate(frames, step);
    if (candidate.length < 2 && step > 1) break;
    for (const tableSize of [128, 64, 32, 16, 8]) {
      const gif = encodeOnce(size, candidate, tableSize);
      if (gif.length <= maxBytes) return gif;
    }
  }
  return null;
}
