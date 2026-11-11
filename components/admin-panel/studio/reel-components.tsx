"use client";

import { useEffect, useRef } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { deviceLayout } from "./reel-devices";
import type { ReelBox } from "./reel-frame";
import type { ReelDevice } from "./reel-scene";

// Live craftUI components in the device's screen. A component is its docs
// preview page (/preview/<name>) in an iframe as wide as the device's
// viewport (390px for the phone), so it lays out exactly as it would on that
// phone: the site's preview pages reflow by width. It's interactive.
//
// The export can't include it (Remotion's renderer doesn't draw iframes):
// it's recorded into a clip first (the Studio's next step).

export interface StudioComponent {
  library: string;
  name: string;
  title: string;
}

export type ComponentTheme = "light" | "dark";

export const isComponentTheme = (value: unknown): value is ComponentTheme =>
  value === "light" || value === "dark";

// A searchable list of the components, grouped by library.
export const ComponentPicker = ({
  components,
  onOpenChange,
  onPick,
  open,
}: {
  components: StudioComponent[];
  onOpenChange: (open: boolean) => void;
  onPick: (name: string) => void;
  open: boolean;
}) => {
  const groups = Map.groupBy(components, (item) => item.library);
  return (
    <CommandDialog
      description="Pick a craftUI component to run inside the phone."
      onOpenChange={onOpenChange}
      open={open}
      title="Choose a component"
    >
      <CommandInput placeholder="Search components…" />
      <CommandList>
        <CommandEmpty>No component matches.</CommandEmpty>
        {[...groups].map(([library, items]) => (
          <CommandGroup heading={library} key={library}>
            {items.map((item) => (
              <CommandItem
                key={item.name}
                onSelect={() => {
                  onPick(item.name);
                  onOpenChange(false);
                }}
                value={`${item.title} ${item.name}`}
              >
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
};

// Preview pages size to their content (the docs box measures them). In a
// device the page should fill the screen, so the Studio stretches it: the
// preview's outer box (the size reporter's .flow-root div, then <main>) becomes a full-
// height column whose item grows. Same origin, so the Studio can add it.
const FILL_CSS =
  "html,body{height:100%}body>.flow-root{min-height:100%;display:flex;flex-direction:column}main{flex:1 0 auto;display:flex;flex-direction:column}main>*{flex:1 0 auto}";

/**
 * Sets up the component's frame: stretches the preview to the screen
 * (FILL_CSS) and forces its theme (next-themes keeps the theme as a class
 * on <html>), keeping it there if the page's own theme script changes it.
 */
export const useFrameSetup = (
  frame: React.RefObject<HTMLIFrameElement | null>,
  theme: ComponentTheme
) => {
  const observer = useRef<MutationObserver | null>(null);
  const apply = useRef<() => void>(() => {
    // Replaced on every render, below.
  });

  apply.current = () => {
    const root = frame.current?.contentDocument?.documentElement;
    if (!root) {
      return;
    }
    observer.current?.disconnect();
    const doc = root.ownerDocument;
    if (!doc.querySelector("#studio-fill")) {
      const style = doc.createElement("style");
      style.id = "studio-fill";
      style.textContent = FILL_CSS;
      doc.head.append(style);
    }
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
    observer.current = new MutationObserver(() => apply.current());
    observer.current.observe(root, { attributeFilter: ["class"] });
  };

  useEffect(() => {
    apply.current();
    return () => observer.current?.disconnect();
  }, [theme]);

  return () => apply.current();
};

/**
 * The component, live, inside the device on the stage: a frame-sized layer
 * scaled like the player, holding the iframe laid onto the screen's
 * corners (the same matrix as the clip) and a copy of the device image on
 * top, so the camera pill still covers the screen. Only the screen takes
 * the pointer: the device around it can still be dragged.
 */
export const LiveScreen = ({
  device,
  frame,
  name,
  scale,
  theme,
}: {
  device: ReelDevice;
  frame: Pick<ReelBox, "h" | "w">;
  name: string;
  scale: number;
  theme: ComponentTheme;
}) => {
  const iframe = useRef<HTMLIFrameElement>(null);
  const applyTheme = useFrameSetup(iframe, theme);
  const layout = deviceLayout(device.id, device.box);
  return (
    <div
      className="pointer-events-none absolute top-0 left-0 origin-top-left"
      style={{
        height: frame.h,
        transform: `scale(${scale})`,
        width: frame.w,
      }}
    >
      <div
        className="absolute"
        style={{
          height: layout.image.h,
          left: layout.image.x,
          top: layout.image.y,
          width: layout.image.w,
        }}
      >
        <div
          className="bg-background pointer-events-auto absolute top-0 left-0 overflow-hidden"
          style={{
            borderRadius: layout.screen.radius,
            height: layout.screen.height,
            transform: layout.screen.transform,
            transformOrigin: "0 0",
            width: layout.screen.width,
          }}
        >
          <iframe
            className="size-full border-0"
            onLoad={applyTheme}
            ref={iframe}
            src={`/preview/${name}`}
            title="Live component"
          />
        </div>
        {/* oxlint-disable-next-line nextjs/no-img-element -- the same static render the export draws, positioned to the pixel */}
        <img
          alt=""
          className="pointer-events-none absolute top-0 left-0 size-full"
          src={layout.src}
        />
      </div>
    </div>
  );
};
