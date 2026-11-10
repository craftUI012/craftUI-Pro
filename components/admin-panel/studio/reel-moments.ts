import type { CanvasSink as Sink } from "mediabunny";

// Finding the moments in a recording that might want a sound: where the
// picture changes, how much, where, and for how long. Runs in the browser on
// small frames (Mediabunny decodes, a canvas compares). The strongest
// moments get a before/after still for Claude to look at.

export type MomentKind = "change" | "cut" | "motion";

export interface MomentRegion {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface ReelMoment {
  // Share of the frame that changed at the moment's peak, 0-1.
  area: number;
  // When the change starts (first changed frame) and when it settles.
  at: number;
  end: number;
  id: string;
  kind: MomentKind;
  // Where the change is, as fractions of the frame.
  region: MomentRegion;
  // Smaller pulses inside a longer moment (typing, a counter, steps).
  steps: number[];
  strength: number;
}

export interface MomentStill {
  id: string;
  // Base64 JPEG, no data: prefix.
  jpeg: string;
}

const SAMPLE_FPS = 15;
const STEP = 1 / SAMPLE_FPS;
const SMALL_WIDTH = 160;
const STILL_WIDTH = 320;
// A pixel counts as changed when its brightness moves by more than this.
const PIXEL_DELTA = 18;
// A sample is active when at least this share of the frame changed.
const MIN_AREA = 0.002;
const MAX_MOMENTS = 14;
const MAX_SECONDS = 180;

interface Sample {
  area: number;
  box: MomentRegion | null;
  t: number;
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

const lumaOf = (canvas: AnyCanvas) => {
  const context = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!context) {
    return null;
  }
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const luma = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0; i < luma.length; i += 1) {
    luma[i] = (data[i * 4] * 3 + data[i * 4 + 1] * 6 + data[i * 4 + 2]) / 10;
  }
  return luma;
};

const compare = (
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  width: number,
  height: number
) => {
  let changed = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (Math.abs(a[i] - b[i]) > PIXEL_DELTA) {
        changed += 1;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const box =
    changed === 0
      ? null
      : {
          h: (maxY - minY + 1) / height,
          w: (maxX - minX + 1) / width,
          x: minX / width,
          y: minY / height,
        };
  return { area: changed / (width * height), box };
};

const unite = (a: MomentRegion | null, b: MomentRegion | null) => {
  if (!(a && b)) {
    return a ?? b;
  }
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    h: Math.max(a.y + a.h, b.y + b.h) - y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    x,
    y,
  };
};

// Group active samples into moments, allowing one quiet sample inside.
const group = (samples: Sample[]) => {
  const groups: Sample[][] = [];
  let current: Sample[] = [];
  let quiet = 0;
  for (const sample of samples) {
    if (sample.area >= MIN_AREA) {
      current.push(sample);
      quiet = 0;
    } else if (current.length > 0) {
      quiet += 1;
      if (quiet > 1) {
        groups.push(current);
        current = [];
        quiet = 0;
      }
    }
  }
  if (current.length > 0) {
    groups.push(current);
  }
  return groups;
};

const toMoment = (samples: Sample[], index: number): ReelMoment => {
  let [peak] = samples;
  let region: MomentRegion | null = null;
  for (const sample of samples) {
    if (sample.area > peak.area) {
      peak = sample;
    }
    region = unite(region, sample.box);
  }
  const start = samples[0].t - STEP;
  const end = samples.at(-1)?.t ?? peak.t;
  const length = end - start;
  // Pulses: local peaks inside a longer moment.
  const steps =
    length >= 0.3
      ? samples
          .filter(
            (s, i) =>
              s.area >= peak.area * 0.3 &&
              s.area >= (samples[i - 1]?.area ?? 0) &&
              s.area > (samples[i + 1]?.area ?? 0)
          )
          .map((s) => Number((s.t - STEP / 2).toFixed(2)))
          .slice(0, 16)
      : [];
  let kind: MomentKind = "change";
  if (peak.area > 0.45 && length <= STEP * 2.5) {
    kind = "cut";
  } else if (length >= 0.35) {
    kind = "motion";
  }
  return {
    area: Number(peak.area.toFixed(4)),
    at: Math.max(0, start),
    end,
    id: `m${index + 1}`,
    kind,
    region: region ?? { h: 1, w: 1, x: 0, y: 0 },
    steps,
    strength: peak.area * (1 + Math.min(length, 2)),
  };
};

const sampleTimes = (from: number, to: number, step: number) => {
  const times: number[] = [];
  for (let t = from; t < to; t += step) {
    times.push(Number(t.toFixed(4)));
  }
  return times;
};

// Draw "before | after" side by side, with the change boxed on the right.
const drawStill = (
  before: AnyCanvas,
  after: AnyCanvas,
  region: MomentRegion
) => {
  const gap = 8;
  const canvas = document.createElement("canvas");
  canvas.width = before.width * 2 + gap;
  canvas.height = before.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return "";
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(before, 0, 0);
  context.drawImage(after, before.width + gap, 0);
  context.strokeStyle = "#ff2d2d";
  context.lineWidth = 2;
  context.strokeRect(
    before.width + gap + region.x * after.width,
    region.y * after.height,
    Math.max(4, region.w * after.width),
    Math.max(4, region.h * after.height)
  );
  return canvas.toDataURL("image/jpeg", 0.72).split(",")[1] ?? "";
};

interface Size {
  height: number;
  width: number;
}

// 1. Sample the whole clip and measure change between samples.
const sampleClip = async (
  sink: Sink,
  size: Size,
  duration: number,
  onProgress: (progress: number) => void
) => {
  const times = sampleTimes(0, duration, STEP);
  const samples: Sample[] = [];
  let previous: Uint8ClampedArray | null = null;
  let index = 0;
  for await (const wrapped of sink.canvasesAtTimestamps(times)) {
    const t = times[index];
    index += 1;
    const luma = wrapped ? lumaOf(wrapped.canvas) : null;
    if (luma && previous) {
      samples.push({ t, ...compare(previous, luma, size.width, size.height) });
    }
    previous = luma ?? previous;
    onProgress(index / times.length);
  }
  return samples;
};

// 3. Pin a moment's start to its first changed frame (60 fps steps).
const pinStart = async (sink: Sink, size: Size, moment: ReelMoment) => {
  const fine = sampleTimes(moment.at, moment.at + STEP + 0.001, 1 / 60);
  let base: Uint8ClampedArray | null = null;
  for await (const wrapped of sink.canvasesAtTimestamps(fine)) {
    const luma = wrapped ? lumaOf(wrapped.canvas) : null;
    if (wrapped && luma && base) {
      if (compare(base, luma, size.width, size.height).area >= MIN_AREA) {
        return Number(wrapped.timestamp.toFixed(3));
      }
    } else if (luma) {
      base = luma;
    }
  }
  return moment.at;
};

// 4. A before/after still for a moment.
const stillFor = async (
  sink: Sink,
  moment: ReelMoment,
  duration: number
): Promise<MomentStill | null> => {
  const before = Math.max(0, moment.at - 0.08);
  const after = Math.min(
    duration - 0.01,
    moment.kind === "motion" ? moment.end + 0.08 : moment.at + 0.35
  );
  const frames: AnyCanvas[] = [];
  for await (const wrapped of sink.canvasesAtTimestamps([before, after])) {
    if (wrapped) {
      frames.push(wrapped.canvas);
    }
  }
  return frames.length === 2
    ? { id: moment.id, jpeg: drawStill(frames[0], frames[1], moment.region) }
    : null;
};

export const findMoments = async (
  file: File,
  onProgress: (progress: number) => void
): Promise<{ moments: ReelMoment[]; stills: MomentStill[] }> => {
  const { ALL_FORMATS, BlobSource, CanvasSink, Input } =
    await import("mediabunny");
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file),
  });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      throw new Error("This file has no video in it.");
    }
    const duration = Math.min(await input.computeDuration(), MAX_SECONDS);
    const aspect = track.displayWidth / track.displayHeight;
    const size = {
      height: Math.max(2, Math.round(SMALL_WIDTH / aspect)),
      width: SMALL_WIDTH,
    };
    const sink = new CanvasSink(track, { ...size, fit: "fill" });
    const samples = await sampleClip(sink, size, duration, onProgress);

    // 2. The strongest moments, back in time order.
    const moments = group(samples)
      .map((g, i) => toMoment(g, i))
      .toSorted((a, b) => b.strength - a.strength)
      .slice(0, MAX_MOMENTS)
      .toSorted((a, b) => a.at - b.at)
      .map((moment, i) => ({ ...moment, id: `m${i + 1}` }));

    for (const moment of moments) {
      moment.at = await pinStart(sink, size, moment);
    }

    const stillSink = new CanvasSink(track, {
      fit: "fill",
      height: Math.max(2, Math.round(STILL_WIDTH / aspect)),
      width: STILL_WIDTH,
    });
    const stills: MomentStill[] = [];
    for (const moment of moments) {
      const still = await stillFor(stillSink, moment, duration);
      if (still) {
        stills.push(still);
      }
    }
    return { moments, stills };
  } finally {
    input.dispose();
  }
};
