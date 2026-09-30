// The akta design language's CSS, shared by the akta sections (hero.tsx and
// features.tsx) and rendered inside each one's <style> rather than in
// globals.css. Every property, class and keyframe is akta- prefixed so it
// cannot collide with the app's own tokens in either direction. It covers
// what a utility cannot express: the notch's masked pseudo-element, the hatch
// gradient, the rolling label, the tick field's indexed stagger, the plate,
// and the entrance / scroll-reveal keyframes. The @property registrations are
// server-rendered with the page, so they are parsed before the notch
// transitions need them.
export const AKTA_CSS = `
@property --akta-notch-arm {
  syntax: "<length>";
  inherits: true;
  initial-value: 12px;
}

@property --akta-notch-inset {
  syntax: "<length>";
  inherits: true;
  initial-value: 6px;
}

@layer components {
  .akta-notch {
    position: relative;
    --akta-notch-color: oklch(0.488 0.243 264.376);
    --akta-notch-weight: 1.5px;
    --akta-notch-rest: 6px;
  }
  .akta-notch::before {
    content: "";
    position: absolute;
    inset: calc(var(--akta-notch-inset) * -1);
    border: var(--akta-notch-weight, 1.5px) solid var(--akta-notch-color, currentColor);
    pointer-events: none;
    --akta-notch-window: linear-gradient(#000 0 0) no-repeat;
    -webkit-mask: var(--akta-notch-window) top left / var(--akta-notch-arm) var(--akta-notch-arm), var(--akta-notch-window) top right / var(--akta-notch-arm) var(--akta-notch-arm), var(--akta-notch-window) bottom left / var(--akta-notch-arm) var(--akta-notch-arm), var(--akta-notch-window) bottom right / var(--akta-notch-arm) var(--akta-notch-arm);
    mask: var(--akta-notch-window) top left / var(--akta-notch-arm) var(--akta-notch-arm), var(--akta-notch-window) top right / var(--akta-notch-arm) var(--akta-notch-arm), var(--akta-notch-window) bottom left / var(--akta-notch-arm) var(--akta-notch-arm), var(--akta-notch-window) bottom right / var(--akta-notch-arm) var(--akta-notch-arm);
  }
  .akta-notch-top::before {
    -webkit-mask: var(--akta-notch-window) top left / var(--akta-notch-arm) var(--akta-notch-arm), var(--akta-notch-window) top right / var(--akta-notch-arm) var(--akta-notch-arm);
    mask: var(--akta-notch-window) top left / var(--akta-notch-arm) var(--akta-notch-arm), var(--akta-notch-window) top right / var(--akta-notch-arm) var(--akta-notch-arm);
  }
  .akta-notch-bottom::before {
    -webkit-mask: var(--akta-notch-window) bottom left / var(--akta-notch-arm) var(--akta-notch-arm), var(--akta-notch-window) bottom right / var(--akta-notch-arm) var(--akta-notch-arm);
    mask: var(--akta-notch-window) bottom left / var(--akta-notch-arm) var(--akta-notch-arm), var(--akta-notch-window) bottom right / var(--akta-notch-arm) var(--akta-notch-arm);
  }
  .akta-notch-diagonal::before {
    -webkit-mask: var(--akta-notch-window) top left / var(--akta-notch-arm) var(--akta-notch-arm), var(--akta-notch-window) bottom right / var(--akta-notch-arm) var(--akta-notch-arm);
    mask: var(--akta-notch-window) top left / var(--akta-notch-arm) var(--akta-notch-arm), var(--akta-notch-window) bottom right / var(--akta-notch-arm) var(--akta-notch-arm);
  }
  .akta-notch-reveal {
    --akta-notch-inset: var(--akta-notch-rest, 6px);
  }
  .akta-notch-reveal:hover, .akta-notch-reveal:focus-visible {
    --akta-notch-inset: 0px;
  }
  .akta-hatch {
    background-image: repeating-linear-gradient(var(--akta-hatch-angle, 45deg), transparent 0, transparent var(--akta-hatch-gap, 7px), var(--akta-hatch-color, color-mix(in oklab, currentColor 12%, transparent)) var(--akta-hatch-gap, 7px), var(--akta-hatch-color, color-mix(in oklab, currentColor 12%, transparent)) calc(var(--akta-hatch-gap, 7px) + var(--akta-hatch-weight, 1px)));
  }
  .akta-hatch-reverse {
    --akta-hatch-angle: -45deg;
  }
  .akta-hatch-dense {
    --akta-hatch-gap: 4px;
  }
  .akta-plate {
    max-width: 90rem;
    background-color: oklch(0.985 0.002 247.839);
    background-image: var(--akta-plate-image, none), repeating-linear-gradient(45deg, transparent 0, transparent 7px, oklch(0.928 0.006 264.531) 7px, oklch(0.928 0.006 264.531) 8px);
    background-size: cover, auto;
    background-position: center center, 0 0;
    background-repeat: no-repeat, repeat;
  }
  .akta-roll {
    position: relative;
    display: inline-flex;
    overflow: hidden;
  }
  .akta-roll-face {
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
  }
  .akta-roll-face-next {
    position: absolute;
    inset: 0;
    transform: translateY(100%);
  }
  .akta-roll-host:hover .akta-roll-face, .akta-roll-host:focus-visible .akta-roll-face {
    transform: translateY(-100%);
  }
  .akta-roll-host:hover .akta-roll-face-next, .akta-roll-host:focus-visible .akta-roll-face-next {
    transform: translateY(0);
  }
  .akta-roll-diagonal .akta-roll-face {
    position: absolute;
    inset: 0;
    justify-content: center;
  }
  .akta-roll-diagonal .akta-roll-face-next {
    transform: translate(-100%, 100%);
  }
  .akta-roll-host:hover .akta-roll-diagonal .akta-roll-face, .akta-roll-host:focus-visible .akta-roll-diagonal .akta-roll-face {
    transform: translate(100%, -100%);
  }
  .akta-roll-host:hover .akta-roll-diagonal .akta-roll-face-next, .akta-roll-host:focus-visible .akta-roll-diagonal .akta-roll-face-next {
    transform: translate(0, 0);
  }
  .akta-tick {
    flex: none;
  }
  .akta-tick-noise {
    opacity: 0.16;
  }
  [data-akta-signal="armed"] .akta-tick-noise {
    opacity: 1;
  }
  @media (max-width: 639px) {
    .akta-notch-reveal {
      --akta-notch-arm: 8px;
      --akta-notch-weight: 1px;
      --akta-notch-rest: 4px;
    }
    .akta-roll-face {
      gap: 0.375rem;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .akta-notch-reveal::before {
      transition: inset 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .akta-roll-face {
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    [data-akta-signal="run"] .akta-tick-noise {
      animation: akta-denoise 0.45s ease-out both;
      animation-delay: calc(var(--akta-i) * 3ms);
    }
    [data-akta-enter] {
      animation: akta-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards;
    }
    [data-akta-enter="1"] {
      animation-delay: 0.05s;
    }
    [data-akta-enter="2"] {
      animation-delay: 0.12s;
    }
    [data-akta-enter="3"] {
      animation-delay: 0.19s;
    }
    [data-akta-enter="4"] {
      animation-delay: 0.26s;
    }
    [data-akta-enter="5"] {
      animation-delay: 0.34s;
    }
    [data-akta-enter="6"] {
      animation-delay: 0.41s;
    }
  }
  @supports (animation-timeline: view()) {
    @media (prefers-reduced-motion: no-preference) {
      [data-akta-reveal] {
        animation: akta-enter 1s linear both;
        animation-timeline: view();
        animation-range: entry 10% cover 28%;
      }
    }
  }
  .dark .akta-notch {
    --akta-notch-color: oklch(0.546 0.245 262.881);
  }
  .dark .akta-plate {
    background-color: oklch(0.13 0.028 261.692);
    background-image: var(--akta-plate-image, none), repeating-linear-gradient(45deg, transparent 0, transparent 7px, oklch(0.278 0.033 256.848) 7px, oklch(0.278 0.033 256.848) 8px);
  }
}

@keyframes akta-denoise {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.16;
  }
}

@keyframes akta-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;
