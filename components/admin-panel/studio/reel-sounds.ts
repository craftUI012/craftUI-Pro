// The Studio's sound effects: 14 clean takes cut from earshot's launch-kit
// demo (public/studio/sfx, MIT, see LICENSE.txt there). Shared by the
// client and the Claude route, so it holds plain data only.
//
// `anchor` is the point inside the file that should land on the moment: the
// onset for a click, the peak for a whoosh, the hit for the riser. A cue at
// 2.0s plays the file from 2.0 - anchor.

export const SOUND_IDS = [
  "click",
  "key",
  "enter",
  "tick",
  "pop",
  "land",
  "knock",
  "confirm",
  "chime",
  "snap",
  "swish",
  "whoosh",
  "rise-hit",
  "pluck",
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

export interface ReelSound {
  anchor: number;
  label: string;
  length: number;
  use: string;
}

export const REEL_SOUNDS: Record<SoundId, ReelSound> = {
  chime: {
    anchor: 0,
    label: "Chime",
    length: 0.452,
    use: "a bright glockenspiel note over a soft chord: something completes or a result appears",
  },
  click: {
    anchor: 0.004,
    label: "Click",
    length: 0.132,
    use: "a dry, crisp click: the cursor presses a button, toggle, tab or menu item",
  },
  confirm: {
    anchor: 0.004,
    label: "Confirm",
    length: 0.249,
    use: "a short mid-pitched ding: an action is confirmed, saved or sent",
  },
  enter: {
    anchor: 0.009,
    label: "Enter key",
    length: 0.21,
    use: "a heavier keyboard key: the end of typing, submitting a field",
  },
  key: {
    anchor: 0.009,
    label: "Key tap",
    length: 0.212,
    use: "one clicky keyboard key: a character or word being typed",
  },
  knock: {
    anchor: 0.012,
    label: "Wood knock",
    length: 0.153,
    use: "a small wooden knock: a tile, chip or card snaps into place",
  },
  land: {
    anchor: 0.001,
    label: "Land",
    length: 0.171,
    use: "a soft rounded thud: something that flew in settles",
  },
  pluck: {
    anchor: 0.007,
    label: "Pluck",
    length: 0.461,
    use: "a gentle mallet pluck: a final line or logo resolves at the end",
  },
  pop: {
    anchor: 0.003,
    label: "Pop",
    length: 0.18,
    use: "a soft bubbly pop: a small element appears (badge, chip, tooltip, avatar)",
  },
  "rise-hit": {
    anchor: 0.658,
    label: "Riser into hit",
    length: 0.94,
    use: "a dark build that lands on a punchy hit: the one big reveal or climax (use at most once)",
  },
  snap: {
    anchor: 0,
    label: "Camera snap",
    length: 0.241,
    use: "a camera shutter: a snap zoom, a screenshot, a hard cut",
  },
  swish: {
    anchor: 0.131,
    label: "Swish",
    length: 0.433,
    use: "a short crisp whoosh, peak on the moment: a panel, drawer or card slides",
  },
  tick: {
    anchor: 0.001,
    label: "Tick",
    length: 0.039,
    use: "a tiny high tick: a counter steps, a slider notch, a list item highlights",
  },
  whoosh: {
    anchor: 0.138,
    label: "Big whoosh",
    length: 0.675,
    use: "a full whoosh with a thump, peak on the moment: a page transition or a large element sweeping in",
  },
};

export const soundSrc = (id: SoundId) => `/studio/sfx/${id}.wav`;

export const isSoundId = (value: string): value is SoundId =>
  (SOUND_IDS as readonly string[]).includes(value);
