import { describe, expect, it } from "vitest";
import { encodeAnimatedGif, resizeLanczos3, type GifFrame } from "./avatar-image";

const solid = (size: number, r: number, g: number, b: number, a = 255) => {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) data.set([r, g, b, a], i * 4);
  return { data, width: size, height: size };
};

describe("resizeLanczos3", () => {
  it("keeps a flat colour flat", () => {
    const out = resizeLanczos3(solid(100, 200, 50, 10), 32);
    expect(out.length).toBe(32 * 32 * 4);
    for (let i = 0; i < out.length; i += 4) {
      expect([out[i], out[i + 1], out[i + 2], out[i + 3]]).toEqual([200, 50, 10, 255]);
    }
  });

  it("does not bleed the colour of transparent pixels into the edge", () => {
    const src = solid(64, 255, 0, 0);
    for (let y = 0; y < 64; y++) {
      for (let x = 32; x < 64; x++) src.data.set([0, 255, 0, 0], (y * 64 + x) * 4); // right half: transparent green
    }
    const out = resizeLanczos3(src, 16);
    const opaqueEdge = out.slice((8 * 16 + 7) * 4, (8 * 16 + 7) * 4 + 4);
    expect(opaqueEdge[1]).toBeLessThan(5); // no green
    expect(opaqueEdge[3]).toBeGreaterThan(100);
  });

  it("reproduces the average of a fine checkerboard", () => {
    const src = solid(64, 0, 0, 0);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if ((x + y) % 2) src.data.set([255, 255, 255, 255], (y * 64 + x) * 4);
    const out = resizeLanczos3(src, 8);
    const center = out[(4 * 8 + 4) * 4];
    expect(center).toBeGreaterThan(110);
    expect(center).toBeLessThan(145);
  });
});

/** Minimal GIF reader for the subset the encoder writes: global table, no interlace, full-size frames. */
function readGif(bytes: Uint8Array) {
  expect(String.fromCharCode(...bytes.slice(0, 6))).toBe("GIF89a");
  const size = bytes[6] | (bytes[7] << 8);
  const tableSize = 2 << (bytes[10] & 7);
  const palette: number[][] = [];
  let p = 13;
  for (let i = 0; i < tableSize; i++, p += 3) palette.push([bytes[p], bytes[p + 1], bytes[p + 2]]);
  const frames: { indices: number[]; delay: number; transparent: number | null; disposal: number }[] = [];
  let gce = { delay: 0, transparent: null as number | null, disposal: 0 };
  while (bytes[p] !== 0x3b) {
    if (bytes[p] === 0x21) {
      if (bytes[p + 1] === 0xf9) {
        gce = { delay: bytes[p + 4] | (bytes[p + 5] << 8), transparent: bytes[p + 3] & 1 ? bytes[p + 6] : null, disposal: (bytes[p + 3] >> 2) & 7 };
      }
      p += 2;
      while (bytes[p] !== 0) p += bytes[p] + 1;
      p++;
    } else if (bytes[p] === 0x2c) {
      p += 10;
      const minCode = bytes[p++];
      const data: number[] = [];
      while (bytes[p] !== 0) {
        data.push(...bytes.slice(p + 1, p + 1 + bytes[p]));
        p += bytes[p] + 1;
      }
      p++;
      frames.push({ indices: lzwDecode(data, minCode, size * size), ...gce });
    } else throw new Error(`bad block ${bytes[p]} at ${p}`);
  }
  return { size, palette, frames };
}

function lzwDecode(data: number[], minCode: number, count: number): number[] {
  const clear = 1 << minCode;
  const eoi = clear + 1;
  let codeSize = minCode + 1;
  let table: number[][] = [];
  const reset = () => {
    table = [];
    for (let i = 0; i < clear; i++) table.push([i]);
    table.push([], []);
    codeSize = minCode + 1;
  };
  reset();
  const out: number[] = [];
  let buffer = 0, bits = 0, index = 0, previous: number[] | null = null;
  while (out.length < count) {
    while (bits < codeSize) { buffer |= data[index++] << bits; bits += 8; }
    const code = buffer & ((1 << codeSize) - 1);
    buffer >>>= codeSize;
    bits -= codeSize;
    if (code === clear) { reset(); previous = null; continue; }
    if (code === eoi) break;
    let entry: number[];
    if (code < table.length) entry = table[code];
    else if (previous) entry = [...previous, previous[0]];
    else throw new Error("bad code");
    out.push(...entry);
    if (previous) table.push([...previous, entry[0]]);
    previous = entry;
    if (table.length === 1 << codeSize && codeSize < 12) codeSize++;
  }
  return out;
}

const frameOf = (size: number, paint: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data.set(paint(x, y), (y * size + x) * 4);
  return data;
};

describe("encodeAnimatedGif", () => {
  const size = 32;
  const frames: GifFrame[] = [0, 1, 2, 3].map((step) => ({
    rgba: frameOf(size, (x, y) => (Math.abs(x - (4 + step * 7)) < 4 && Math.abs(y - 16) < 4 ? [255, 40, 40, 255] : [20, 30, 200, 255])),
    delayCs: 5 + step,
  }));

  it("writes a GIF that decodes back to the same pictures", () => {
    const gif = encodeAnimatedGif(size, frames, 6000)!;
    expect(gif).not.toBeNull();
    const { palette, frames: decoded } = readGif(gif);
    expect(decoded).toHaveLength(4);
    expect(decoded.map((f) => f.delay)).toEqual([5, 6, 7, 8]);

    // Rebuild every picture the way a viewer does (opaque animations draw only the changes).
    let canvas: number[][] = Array.from({ length: size * size }, () => [0, 0, 0]);
    decoded.forEach((frame, n) => {
      frame.indices.forEach((index, p) => {
        if (index !== frame.transparent) canvas[p] = palette[index];
      });
      for (let p = 0; p < size * size; p++) {
        const want = [frames[n].rgba[p * 4], frames[n].rgba[p * 4 + 1], frames[n].rgba[p * 4 + 2]];
        expect(canvas[p]).toEqual(want);
      }
    });
    // Later frames carry only the difference, so they are mostly transparent.
    expect(decoded[1].indices.filter((i) => i === decoded[1].transparent).length).toBeGreaterThan(size * size * 0.8);
  });

  it("keeps real transparency (full frames, disposal 2)", () => {
    const see: GifFrame[] = [0, 1].map((n) => ({ rgba: frameOf(size, (x) => (x < 16 + n * 4 ? [255, 255, 0, 255] : [0, 0, 0, 0])), delayCs: 10 }));
    const { frames: decoded, palette } = readGif(encodeAnimatedGif(size, see, 6000)!);
    expect(decoded[0].disposal).toBe(2);
    const t = decoded[1].transparent!;
    expect(decoded[1].indices[31]).toBe(t); // right edge is transparent
    expect(palette[decoded[1].indices[0]]).toEqual([255, 255, 0]);
  });

  it("drops frames, keeping the running time, when the size budget is tight", () => {
    const noisy: GifFrame[] = Array.from({ length: 24 }, (_, n) => ({
      rgba: frameOf(size, (x, y) => [(x * 8 + n * 11) & 255, (y * 8 + n * 5) & 255, (x * y + n * 17) & 255, 255]),
      delayCs: 4,
    }));
    const roomy = encodeAnimatedGif(size, noisy, 1_000_000)!;
    const tight = encodeAnimatedGif(size, noisy, Math.floor(roomy.length / 2));
    expect(tight).not.toBeNull();
    expect(tight!.length).toBeLessThanOrEqual(Math.floor(roomy.length / 2));
    const { frames: decoded } = readGif(tight!);
    expect(decoded.reduce((sum, f) => sum + f.delay, 0)).toBe(24 * 4);
  });

  it("gives up (null) when nothing fits", () => {
    expect(encodeAnimatedGif(size, frames, 50)).toBeNull();
  });
});
