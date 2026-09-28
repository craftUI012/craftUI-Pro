"use client";

import {
  BatteryFull,
  Monitor,
  MousePointerClick,
  Signal,
  Smartphone,
  Tablet,
  Wifi,
} from "lucide-react";
import {
  AnimatePresence,
  LazyMotion,
  animate,
  domAnimation,
  m,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import * as React from "react";

import type {
  DeviceId,
  TemplateSlug,
} from "@/components/hero-templates/templates-data";
import {
  DEVICES,
  DEVICE_MOTION,
  STAND,
  TEMPLATES,
} from "@/components/hero-templates/templates-data";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ROUTES } from "@/constants/routes";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

type Device = (typeof DEVICES)[number];

const ICONS = { desktop: Monitor, mobile: Smartphone, tablet: Tablet } as const;
// Room under the device for its floor shadow (px).
const FLOOR_SPACE = 28;
// Below md the stage starts on the phone, the device people are holding.
const PHONE_QUERY = "(max-width: 47.99rem)";

const deviceById = (id: DeviceId) =>
  DEVICES.find((device) => device.id === id) ?? DEVICES[0];

// Largest screen with the device's aspect ratio that fits the stage, leaving
// room for the bezel, the monitor's stand and the floor shadow.
const fitDevice = (
  device: Device,
  stage: { height: number; width: number }
) => {
  const stand = device.id === "desktop" ? STAND.height + STAND.baseHeight : 0;
  const ratio = device.viewport.width / device.viewport.height;
  const width = Math.max(
    0,
    Math.min(
      stage.width - device.bezel * 2,
      (stage.height - stand - FLOOR_SPACE - device.bezel * 2) * ratio
    )
  );

  return {
    height: width / ratio,
    scale: width / device.viewport.width,
    width,
  };
};

// Aluminium: darker at the edges, lit in the middle.
const METAL =
  "linear-gradient(90deg, color-mix(in oklab, var(--color-device-stand) 78%, black), var(--color-device-stand) 45%, color-mix(in oklab, var(--color-device-stand) 82%, black))";

const Stand = ({ width }: { width: number }) => (
  <m.div
    key="stand"
    aria-hidden
    initial={{ opacity: 0, y: -16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -16 }}
    transition={DEVICE_MOTION.detail}
    className="flex flex-col items-center"
  >
    <div
      style={{
        background: METAL,
        clipPath: "polygon(10% 0, 90% 0, 100% 100%, 0 100%)",
        height: STAND.height,
        width: width * STAND.neckWidth,
      }}
    />
    <div
      className="rounded-t-sm rounded-b-[40%] shadow-sm"
      style={{
        background: METAL,
        height: STAND.baseHeight,
        width: width * STAND.neckWidth * 2.4,
      }}
    />
  </m.div>
);

// The system status bar at the top of a phone or tablet screen, drawn at
// the device's CSS size and scaled with the page, so the page starts below it
// (and below the Dynamic Island) as it does on the device.
const StatusBar = ({ device, scale }: { device: Device; scale: number }) => (
  <div
    aria-hidden
    className="bg-background text-foreground absolute top-0 left-0 flex origin-top-left items-center justify-between font-semibold"
    style={{
      fontSize: device.id === "mobile" ? 15 : 12,
      height: device.statusBar,
      paddingInline: device.id === "mobile" ? 32 : 20,
      paddingTop: device.id === "mobile" ? 6 : 0,
      transform: `scale(${scale})`,
      width: device.viewport.width,
    }}
  >
    <span className="tabular-nums">9:41</span>
    <span className="flex items-center gap-1.5 [&_svg]:size-[1.1em]">
      <Signal />
      <Wifi />
      <BatteryFull />
    </span>
  </div>
);

// Front camera / Dynamic Island, per device.
// The island is drawn at its real size in device px (126 x 37, 11 from the
// top) and scaled with the screen, so it always sits inside the status bar.
const Camera = ({ device, scale }: { device: Device; scale: number }) => {
  if (device.id === "mobile") {
    return (
      <m.span
        key="island"
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={DEVICE_MOTION.detail}
        className="absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-black"
        style={{
          height: 37 * scale,
          top: device.bezel + 11 * scale,
          width: 126 * scale,
        }}
      />
    );
  }

  return (
    <m.span
      key={`camera-${device.id}`}
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={DEVICE_MOTION.detail}
      className="absolute top-[calc(var(--bezel)/2)] left-1/2 z-20 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15"
    />
  );
};

// The templates showcase: a template section (hero, team, features: the
// left picker) on a desktop monitor, tablet or phone (the right switcher). The page inside is the real template in an
// iframe at the device's own width, so it reflows the way it would on that
// device. Switching device follows the storyboard in templates-data.ts: the
// screen fades out, the hardware reshapes, the screen fades back in.
// Switching section fades the screen out, loads the new section, and fades
// it back in once the page has loaded.
//
// The screen only takes scrolling after a click (like an embedded map):
// otherwise a page-sized iframe would catch the visitor's page scroll. Until
// then a button covers the iframe. (Not pointer-events: none on the iframe:
// Chrome keeps routing the wheel to the page after it's switched back on.)
export const DevicePreview = () => {
  const [slug, setSlug] = React.useState<TemplateSlug>(TEMPLATES[0].slug);
  const template = TEMPLATES.find((item) => item.slug === slug) ?? TEMPLATES[0];
  // Set while a section switch waits for the new page to load.
  const pendingLoad = React.useRef(false);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const reduceMotion = useReducedMotion();
  const screenOpacity = useMotionValue(1);
  const pendingReveal = React.useRef(false);

  const [stage, setStage] = React.useState({ height: 0, width: 0 });
  const [deviceId, setDeviceId] = React.useState<DeviceId>("desktop");
  const [loaded, setLoaded] = React.useState(false);
  const [scrollable, setScrollable] = React.useState(false);

  // Measure the stage; on the first measure also pick the starting device,
  // so the hardware first renders already at its size and shape.
  React.useLayoutEffect(() => {
    const node = stageRef.current;

    if (!node) {
      return;
    }

    if (matchMedia(PHONE_QUERY).matches) {
      setDeviceId("mobile");
    }

    const measure = () =>
      setStage({ height: node.clientHeight, width: node.clientWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const device = deviceById(deviceId);
  const screen = fitDevice(device, stage);
  const bezelWidth = screen.width + device.bezel * 2;

  const select = async (next: DeviceId) => {
    if (next === deviceId) {
      return;
    }

    setScrollable(false);

    if (reduceMotion) {
      setDeviceId(next);

      return;
    }

    pendingReveal.current = true;
    await animate(screenOpacity, 0, DEVICE_MOTION.screenOut);
    setDeviceId(next);
  };

  const reveal = () => {
    if (pendingReveal.current) {
      pendingReveal.current = false;
      animate(screenOpacity, 1, DEVICE_MOTION.screenIn);
    }
  };

  const selectTemplate = async (next: TemplateSlug) => {
    if (next === slug) {
      return;
    }

    setScrollable(false);

    if (!reduceMotion) {
      pendingLoad.current = true;
      await animate(screenOpacity, 0, DEVICE_MOTION.screenOut);
    }

    setLoaded(false);
    setSlug(next);
  };

  const onFrameLoad = () => {
    setLoaded(true);

    if (pendingLoad.current) {
      pendingLoad.current = false;
      animate(screenOpacity, 1, DEVICE_MOTION.screenIn);
    }
  };

  const startScrolling = () => {
    setScrollable(true);
    iframeRef.current?.focus();
  };

  return (
    <LazyMotion features={domAnimation}>
      <div className="flex flex-col items-center gap-minor">
        {/* Section picker (what to preview) and device switcher (where). */}
        <div className="flex w-full flex-col items-center gap-3 md:flex-row md:justify-between">
          <ToggleGroup
            type="single"
            variant="outline"
            value={slug}
            onValueChange={(value) =>
              value && selectTemplate(value as TemplateSlug)
            }
            aria-label="Template section"
          >
            {TEMPLATES.map((item) => (
              <ToggleGroupItem
                key={item.slug}
                value={item.slug}
                className="px-3"
              >
                {/* "Hero", "My team", "Features" on phones; full labels from sm. */}
                <span className="sm:hidden">
                  {item.label.replace(/ section$/, "")}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup
            type="single"
            variant="outline"
            value={deviceId}
            onValueChange={(value) => value && select(value as DeviceId)}
            aria-label="Preview the template on"
          >
            {DEVICES.map((item) => {
              const Icon = ICONS[item.id];

              return (
                <ToggleGroupItem
                  key={item.id}
                  value={item.id}
                  aria-label={item.label}
                  className="gap-2 px-3"
                >
                  <Icon />
                  <span className="hidden sm:inline">{item.label}</span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>

        {/* Stage: tall enough for the desktop at full width (16:10 screen,
            bezel, stand and floor), never shorter than 34rem, so switching
            devices never changes the page height. */}
        <div className="@container w-full">
          <div
            ref={stageRef}
            className="relative flex h-[max(34rem,calc(100cqw*0.625+8.5rem))] w-full flex-col items-center justify-center"
          >
            {stage.width > 0 && (
              <>
                <m.div
                  initial={false}
                  animate={{
                    borderRadius: device.radius,
                    height: screen.height + device.bezel * 2,
                    padding: device.bezel,
                    width: bezelWidth,
                  }}
                  transition={
                    reduceMotion ? { duration: 0 } : DEVICE_MOTION.morph
                  }
                  onAnimationComplete={reveal}
                  onMouseLeave={() => setScrollable(false)}
                  className="bg-device-frame relative z-10 shrink-0 shadow-device"
                  style={
                    { "--bezel": `${device.bezel}px` } as React.CSSProperties
                  }
                >
                  <AnimatePresence initial={false}>
                    <Camera
                      key={device.id}
                      device={device}
                      scale={screen.scale}
                    />
                  </AnimatePresence>
                  <m.div
                    initial={false}
                    animate={{ borderRadius: device.screenRadius }}
                    transition={
                      reduceMotion ? { duration: 0 } : DEVICE_MOTION.morph
                    }
                    className="bg-background relative size-full overflow-hidden"
                    style={{ opacity: screenOpacity }}
                  >
                    <iframe
                      ref={iframeRef}
                      src={`${ROUTES.TEMPLATE_PREVIEW}/${template.slug}`}
                      title={`${template.label} template on ${device.label.toLowerCase()}`}
                      loading="lazy"
                      tabIndex={scrollable ? 0 : -1}
                      onLoad={onFrameLoad}
                      className="absolute left-0 origin-top-left border-0"
                      style={{
                        height: device.viewport.height - device.statusBar,
                        top: device.statusBar * screen.scale,
                        transform: `scale(${screen.scale})`,
                        width: device.viewport.width,
                      }}
                    />
                    {device.statusBar > 0 && (
                      <StatusBar device={device} scale={screen.scale} />
                    )}
                    {!loaded && (
                      <Skeleton className="absolute inset-0 rounded-none" />
                    )}
                    {!scrollable && (
                      <button
                        type="button"
                        onClick={startScrolling}
                        aria-label={`Scroll the ${template.label.toLowerCase()} template`}
                        className="group/screen focus-visible:ring-ring/50 absolute inset-0 flex cursor-pointer items-end justify-center pb-4 outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
                      >
                        <span
                          className={cn(
                            TYPE.cardCaption,
                            "bg-background/90 flex items-center gap-1.5 rounded-full px-3 py-1.5 opacity-0 shadow-elevated backdrop-blur transition-opacity duration-200 ease-out group-hover/screen:opacity-100 group-focus-visible/screen:opacity-100 motion-reduce:transition-none"
                          )}
                        >
                          <MousePointerClick className="size-3.5" />
                          Click to scroll the page
                        </span>
                      </button>
                    )}
                  </m.div>
                </m.div>

                <AnimatePresence initial={false}>
                  {device.id === "desktop" && <Stand width={bezelWidth} />}
                </AnimatePresence>

                {/* Contact shadow on the "floor" under the device. */}
                <m.div
                  aria-hidden
                  initial={false}
                  animate={{
                    width:
                      device.id === "desktop"
                        ? bezelWidth * STAND.neckWidth * 3.2
                        : bezelWidth * 0.9,
                  }}
                  transition={
                    reduceMotion ? { duration: 0 } : DEVICE_MOTION.morph
                  }
                  className="-mt-2.5 h-5 shrink-0 rounded-[50%]"
                  style={{
                    background:
                      "radial-gradient(closest-side, var(--color-device-floor), transparent)",
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </LazyMotion>
  );
};
