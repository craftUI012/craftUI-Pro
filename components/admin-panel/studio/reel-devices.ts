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

export type DeviceId = "phone-front" | "phone-three-quarter";

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

export const DEVICE_OPTIONS: { id: DeviceId; label: string }[] = [
  { id: "phone-front", label: "Front" },
  { id: "phone-three-quarter", label: "Tilted" },
];

export const isDeviceId = (value: unknown): value is DeviceId =>
  typeof value === "string" && value in DEVICES;

/** How tall the device's body is, as a share of the frame's height. */
const FIT_HEIGHT: Record<ReelFormat, number> = { "16:9": 0.84, "9:16": 0.7 };

/** Where a device lands in a frame: centred, at a comfortable size. */
export const fitDevice = (id: DeviceId, format: ReelFormat): ReelBox => {
  const { body } = DEVICES[id];
  const frame = FORMATS[format];
  const h = frame.height * FIT_HEIGHT[format];
  const w = (h * body.w) / body.h;
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
