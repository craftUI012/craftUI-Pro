import devices from "./devices.json";
import type { ReelBox, ReelFormat } from "./reel-frame";
import { FORMATS } from "./reel-frame";

// Device mockups for the Studio: Blender renders (scripts/studio-devices,
// `pnpm studio:devices`) with a transparent screen. The clip goes under the
// image, mapped onto the screen's four corners, so it sits in the screen
// even when the device is tilted.
//
// A device is placed by its body (`ReelBox` in frame pixels): the image
// around it is the soft shadow's margin.

export type DeviceId = "desktop-front" | "phone-front" | "phone-three-quarter";

export type DeviceKind = "desktop" | "phone";

type Point = [number, number];

export interface DeviceRender {
  /** The device itself inside the image, in image pixels. */
  body: ReelBox & { h: number };
  height: number;
  /** Screen corners in image pixels: top-left, top-right, bottom-right, bottom-left. */
  screen: Point[];
  /** Screen corner radius as a share of the screen's width. */
  screenRadius: number;
  src: string;
  /** The CSS viewport the screen stands for (a 390×844 phone). */
  viewport: { height: number; width: number };
  width: number;
}

export const DEVICES = devices as unknown as Record<DeviceId, DeviceRender>;

/** The devices, each with its views (the first is its default). */
export const DEVICE_KINDS: {
  kind: DeviceKind;
  label: string;
  views: { id: DeviceId; label: string }[];
}[] = [
  {
    kind: "phone",
    label: "Phone",
    views: [
      { id: "phone-front", label: "Front" },
      { id: "phone-three-quarter", label: "Tilted" },
    ],
  },
  {
    kind: "desktop",
    label: "Desktop",
    views: [{ id: "desktop-front", label: "Front" }],
  },
];

/** The device a view belongs to. */
export const kindOf = (id: DeviceId) =>
  DEVICE_KINDS.find((entry) => entry.views.some((view) => view.id === id)) ??
  DEVICE_KINDS[0];

export const isDeviceId = (value: unknown): value is DeviceId =>
  typeof value === "string" && value in DEVICES;

/**
 * The most of the frame a device may take, as shares of its width and
 * height: a phone is limited by height, a desktop by width in 9:16.
 */
const FIT: Record<DeviceKind, Record<ReelFormat, { h: number; w: number }>> = {
  desktop: { "16:9": { h: 0.84, w: 0.86 }, "9:16": { h: 0.6, w: 0.9 } },
  phone: { "16:9": { h: 0.84, w: 0.9 }, "9:16": { h: 0.7, w: 0.9 } },
};

/** Where a device lands in a frame: centred, at a comfortable size. */
export const fitDevice = (id: DeviceId, format: ReelFormat): ReelBox => {
  const { body } = DEVICES[id];
  const frame = FORMATS[format];
  const limit = FIT[kindOf(id).kind][format];
  const k = Math.min(
    (frame.width * limit.w) / body.w,
    (frame.height * limit.h) / body.h
  );
  const h = body.h * k;
  const w = body.w * k;
  return {
    h: Math.round(h),
    w: Math.round(w),
    x: Math.round((frame.width - w) / 2),
    y: Math.round((frame.height - h) / 2),
  };
};

/**
 * The projective map taking the unit square (0,0) (1,0) (1,1) (0,1) to a
 * quad, as x' = (a u + b v + c) / (g u + h v + 1), y' likewise with d e f
 * (Heckbert's square-to-quad).
 */
const squareToQuad = ([p0, p1, p2, p3]: Point[]) => {
  const dx1 = p1[0] - p2[0];
  const dx2 = p3[0] - p2[0];
  const dx3 = p0[0] - p1[0] + p2[0] - p3[0];
  const dy1 = p1[1] - p2[1];
  const dy2 = p3[1] - p2[1];
  const dy3 = p0[1] - p1[1] + p2[1] - p3[1];
  const det = dx1 * dy2 - dx2 * dy1;
  const g = det === 0 ? 0 : (dx3 * dy2 - dx2 * dy3) / det;
  const h = det === 0 ? 0 : (dx1 * dy3 - dx3 * dy1) / det;
  return {
    a: p1[0] - p0[0] + g * p1[0],
    b: p3[0] - p0[0] + h * p3[0],
    c: p0[0],
    d: p1[1] - p0[1] + g * p1[1],
    e: p3[1] - p0[1] + h * p3[1],
    f: p0[1],
    g,
    h,
  };
};

/**
 * Where to draw a device placed at `box` (its body): the image's rectangle,
 * and the screen as a viewport-sized box plus the CSS matrix3d (origin top
 * left) that lays it onto the screen's corners. Both in frame pixels,
 * relative to the image's top-left.
 */
export const deviceLayout = (id: DeviceId, box: ReelBox) => {
  const device = DEVICES[id];
  const k = box.w / device.body.w;
  const { height: vh, width: vw } = device.viewport;
  const m = squareToQuad(
    device.screen.map(([x, y]) => [x * k, y * k] as Point)
  );
  const matrix = [
    m.a / vw,
    m.d / vw,
    0,
    m.g / vw,
    m.b / vh,
    m.e / vh,
    0,
    m.h / vh,
    0,
    0,
    1,
    0,
    m.c,
    m.f,
    0,
    1,
  ];
  return {
    image: {
      h: device.height * k,
      w: device.width * k,
      x: box.x - device.body.x * k,
      y: box.y - device.body.y * k,
    },
    screen: {
      height: vh,
      radius: device.screenRadius * vw,
      transform: `matrix3d(${matrix.map((n) => Number(n.toFixed(8))).join(",")})`,
      width: vw,
    },
    src: device.src,
  };
};
