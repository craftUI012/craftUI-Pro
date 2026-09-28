"use client";

import "./picker.css";
import type * as React from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { BrowseQueryContext } from "@/components/new-hero-section/browse/browse-context";
import type { LibraryId } from "@/components/new-hero-section/data/home-types";

import { CommandNav } from "./variants/command";
import { DockNav } from "./variants/dock";
import { MastheadNav } from "./variants/masthead";
import { RailNav } from "./variants/rail";
import type {
  NavLibrary,
  NavSearchItem,
  NavVariantProps,
} from "./variants/shared";

// PROTOTYPE ONLY. Delete app/prototypes/navigation once a variant is promoted.

const VARIANTS: {
  name: string;
  Nav: (props: NavVariantProps) => React.ReactNode;
  // The dock sits bottom-centre, so the picker moves to the top for it.
  pickerTop?: boolean;
}[] = [
  { Nav: CommandNav, name: "Command" },
  { Nav: RailNav, name: "Rail" },
  { Nav: MastheadNav, name: "Masthead" },
  { Nav: DockNav, name: "Dock", pickerTop: true },
];

const Picker = ({
  current,
  onPick,
  onReplay,
}: {
  current: number;
  onPick: (index: number) => void;
  onReplay: () => void;
}) => {
  const navRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const moveHighlight = useCallback(() => {
    const el = itemRefs.current[current];
    const highlight = highlightRef.current;
    if (el && highlight) {
      highlight.style.width = `${el.offsetWidth}px`;
      highlight.style.transform = `translateX(${el.offsetLeft}px)`;
    }
  }, [current]);

  useLayoutEffect(moveHighlight, [moveHighlight]);

  useEffect(() => {
    window.addEventListener("resize", moveHighlight);
    return () => window.removeEventListener("resize", moveHighlight);
  }, [moveHighlight]);

  // Enable the slide only after first paint, so load doesn't animate.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (navRef.current) {
          navRef.current.dataset.ready = "";
        }
      })
    );
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <nav
      ref={navRef}
      className="proto-picker"
      aria-label="Prototype variants"
      data-position={VARIANTS[current]?.pickerTop ? "top" : undefined}
    >
      <span
        ref={highlightRef}
        className="proto-picker-highlight"
        aria-hidden="true"
      />
      {VARIANTS.map((variant, index) => (
        <button
          key={variant.name}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          type="button"
          className="proto-picker-item"
          data-active={index === current ? "" : undefined}
          aria-current={index === current ? "true" : undefined}
          onClick={() => onPick(index)}
        >
          {variant.name}
        </button>
      ))}
      <span className="proto-picker-divider" aria-hidden="true" />
      <button
        type="button"
        className="proto-picker-item proto-picker-replay"
        aria-label="Replay animation (R)"
        onClick={onReplay}
      >
        ↻
      </button>
    </nav>
  );
};

export const NavigationHarness = ({
  initialVariant,
  libraries,
  panels,
  searchItems,
}: {
  initialVariant: number;
  libraries: NavLibrary[];
  panels: Record<LibraryId, React.ReactNode>;
  searchItems: NavSearchItem[];
}) => {
  const [current, setCurrent] = useState(initialVariant);
  const [mountKey, setMountKey] = useState(0);
  const [active, setActive] = useState<LibraryId>(
    libraries[0]?.id ?? "components"
  );
  const [query, setQuery] = useState("");

  const pick = useCallback((index: number) => {
    if (index < 0 || index >= VARIANTS.length) {
      return;
    }
    setCurrent(index);
    // Switching re-mounts, so entrance animations re-run.
    setMountKey((k) => k + 1);
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(index + 1));
    window.history.replaceState(null, "", url);
    window.scrollTo(0, 0);
  }, []);

  const replay = useCallback(() => setMountKey((k) => k + 1), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
        target.isContentEditable
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const num = Number.parseInt(event.key, 10);
      if (num >= 1 && num <= VARIANTS.length) {
        pick(num - 1);
      } else if (event.key === "ArrowRight") {
        pick((current + 1) % VARIANTS.length);
      } else if (event.key === "ArrowLeft") {
        pick((current - 1 + VARIANTS.length) % VARIANTS.length);
      } else if (event.key === "r" || event.key === "R") {
        replay();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [current, pick, replay]);

  const { Nav } = VARIANTS[current] ?? VARIANTS[0];

  return (
    <BrowseQueryContext value={query}>
      <Nav
        key={`${current}-${mountKey}`}
        active={active}
        libraries={libraries}
        query={query}
        searchItems={searchItems}
        onActiveChange={setActive}
        onQueryChange={setQuery}
      >
        <main className="container flex flex-col gap-16 pt-8 pb-24 md:gap-20 md:pt-10">
          {libraries.map((library) => (
            <div
              key={library.id}
              hidden={library.id !== active}
              className="flex flex-col gap-16 md:gap-24"
            >
              {panels[library.id]}
            </div>
          ))}
        </main>
      </Nav>
      <Picker current={current} onPick={pick} onReplay={replay} />
    </BrowseQueryContext>
  );
};
