import { Audio, Video } from "@remotion/media";
import type { CSSProperties } from "react";
import { AbsoluteFill, interpolate, Sequence, useVideoConfig } from "remotion";

import type { SoundId } from "./reel-sounds";
import { REEL_SOUNDS, soundSrc } from "./reel-sounds";

// The reel itself: a 1080x1920 frame filled with one colour, the recording
// placed on it, and the soundtrack (the clip's own sound, a music bed and
// sound effects on moments). The Studio's player previews this component
// and the export renders it, so what you see and hear is what you get.
//
// Remotion's in-browser renderer redraws the page onto a canvas and supports
// only some CSS (remotion.dev/docs/client-side-rendering/limitations). Keep to
// what's here: background colour, a positioned box, border radius with
// overflow hidden, and a plain box shadow (no spread, no inset). Audio from
// every mounted <Audio> and <Video> is mixed into the export.

export const REEL = { height: 1920, width: 1080 } as const;

export interface ReelBox {
  h: number;
  w: number;
  x: number;
  y: number;
}

// One sound effect: `at` is when its anchor (onset or peak) lands, in
// seconds from the start of the reel.
export interface ReelCue {
  at: number;
  id: string;
  sound: SoundId;
  volume: number;
}

// A line of text on the frame, centred on (x, y) in reel pixels.
export interface ReelText {
  color: string;
  id: string;
  size: number;
  text: string;
  weight: 400 | 500;
  x: number;
  y: number;
}

// Inter (the site loads it as --font-inter), centred, wrapping at 960px.
// The Studio's drag handles reuse this exact style, so they match the text.
export const TEXT_FONT =
  "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif";

export const textStyle = (item: ReelText): CSSProperties => ({
  fontFamily: TEXT_FONT,
  fontSize: item.size,
  fontWeight: item.weight,
  left: item.x,
  letterSpacing: "-0.02em",
  lineHeight: 1.15,
  maxWidth: REEL.width - 120,
  position: "absolute",
  textAlign: "center",
  top: item.y,
  transform: "translate(-50%, -50%)",
  whiteSpace: "pre-wrap",
  width: "max-content",
});

// The music bed: `start` is where in the track the reel begins.
export interface ReelMusic {
  fadeIn: number;
  fadeOut: number;
  loop: boolean;
  src: string;
  start: number;
  volume: number;
}

// A type, not an interface: Remotion wants props assignable to
// Record<string, unknown>.
// oxlint-disable-next-line typescript/consistent-type-definitions
export type ReelSceneProps = {
  background: string;
  box: ReelBox;
  clipVolume: number;
  cues: ReelCue[];
  muted: boolean;
  music: ReelMusic | null;
  radius: number;
  sfxVolume: number;
  shadow: boolean;
  src: string;
  texts: ReelText[];
};

const SHADOW = "0 24px 64px rgba(0, 0, 0, 0.22)";

const MusicBed = ({ music }: { music: ReelMusic }) => {
  const { durationInFrames, fps } = useVideoConfig();
  // Fade points must rise strictly, even on a very short reel.
  const inEnd = Math.max(1, Math.round(music.fadeIn * fps));
  const outStart = Math.max(
    inEnd + 1,
    durationInFrames - Math.round(music.fadeOut * fps)
  );
  const end = Math.max(outStart + 1, durationInFrames);
  return (
    <Audio
      disallowFallbackToHtml5Audio
      loop={music.loop}
      src={music.src}
      trimBefore={Math.round(music.start * fps)}
      volume={(frame) =>
        music.volume *
        interpolate(frame, [0, inEnd, outStart, end], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  );
};

// Sequences start on whole frames, so a cue starts on the next frame and
// skips the same fraction of a frame into its file: the sound lands on the
// exact sample, not the nearest frame (±8 ms at 60 fps). A cue in the first
// instant starts at frame 0 and skips further in.
const CueSound = ({ cue, gain }: { cue: ReelCue; gain: number }) => {
  const { fps } = useVideoConfig();
  const sound = REEL_SOUNDS[cue.sound];
  const exact = (cue.at - sound.anchor) * fps;
  const from = Math.max(0, Math.ceil(exact));
  const skip = from - exact;
  const frames = Math.ceil(sound.length * fps - skip) + 1;
  if (frames <= 0) {
    return null;
  }
  return (
    <Sequence
      durationInFrames={frames}
      from={from}
      layout="none"
      name={sound.label}
    >
      <Audio
        disallowFallbackToHtml5Audio
        src={soundSrc(cue.sound)}
        trimBefore={skip}
        volume={cue.volume * gain}
      />
    </Sequence>
  );
};

// A tiny reel with one click at CALIBRATION.at, rendered once per session to
// measure the AAC encoder's priming delay (see reel-clip.ts).
export const CALIBRATION = { at: 0.1, fps: 30, frames: 12, size: 64 } as const;

export const CalibrationScene = () => (
  <AbsoluteFill style={{ backgroundColor: "#000000" }}>
    <Sequence from={Math.round(CALIBRATION.at * CALIBRATION.fps)} layout="none">
      <Audio disallowFallbackToHtml5Audio src={soundSrc("click")} />
    </Sequence>
  </AbsoluteFill>
);

export const ReelScene = ({
  background,
  box,
  clipVolume,
  cues,
  muted,
  music,
  radius,
  sfxVolume,
  shadow,
  src,
  texts,
}: ReelSceneProps) => (
  <AbsoluteFill style={{ backgroundColor: background }}>
    {src ? (
      <div
        style={{
          borderRadius: radius,
          boxShadow: shadow ? SHADOW : undefined,
          height: box.h,
          left: box.x,
          overflow: "hidden",
          position: "absolute",
          top: box.y,
          width: box.w,
        }}
      >
        {/* A fallback to <OffthreadVideo> can't render in the browser, so
            fail loudly instead of exporting a blank box. */}
        <Video
          disallowFallbackToOffthreadVideo
          muted={muted}
          objectFit="cover"
          src={src}
          style={{ height: "100%", width: "100%" }}
          volume={clipVolume}
        />
      </div>
    ) : null}
    {texts.map((item) => (
      <div key={item.id} style={{ ...textStyle(item), color: item.color }}>
        {item.text}
      </div>
    ))}
    {music ? <MusicBed music={music} /> : null}
    {cues.map((cue) => (
      <CueSound cue={cue} gain={sfxVolume} key={cue.id} />
    ))}
  </AbsoluteFill>
);
