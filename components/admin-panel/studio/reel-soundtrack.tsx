"use client";

import {
  Add01Icon,
  AiMagicIcon,
  Cancel01Icon,
  MusicNote01Icon,
  PauseIcon,
  PlayIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import type { PlayerRef } from "@remotion/player";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import type { DirectorPlan } from "@/lib/admin/reel-director";
import { cn } from "@/lib/utils";

import type { ReelClip } from "./reel-clip";
import { formatTime } from "./reel-clip";
import { findMoments } from "./reel-moments";
import type { MusicTrack, TrackShape } from "./reel-music";
import { analyseTrack, placeMusic, searchMusic } from "./reel-music";
import type { ReelCue, ReelSceneProps } from "./reel-scene";
import type { SoundId } from "./reel-sounds";
import { REEL_SOUNDS, SOUND_IDS, soundSrc } from "./reel-sounds";

// The reel's soundtrack: sound effects on moments and a music bed. "Auto-sync
// with Claude" finds the moments in the browser, asks Claude (through
// app/api/admin/studio/direct) which ones get which sound and what music
// fits, then searches Openverse and lines the track's lift up with the key
// moment. Everything stays editable, and the player plays the full mix.

export interface StudioCue extends ReelCue {
  note: string;
}

export interface ChosenMusic {
  drop: number | null;
  dropAt: number;
  loop: boolean;
  shape: TrackShape;
  start: number;
  track: MusicTrack;
  volume: number;
}

interface Status {
  error: boolean;
  text: string;
}

const DIRECTOR_URL = "/api/admin/studio/direct";
const FADE = { fadeIn: 0.6, fadeOut: 1.2 };

const newCueId = () => crypto.randomUUID();
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const useSoundtrack = (clip: ReelClip | null) => {
  const [cues, setCues] = useState<StudioCue[]>([]);
  const [music, setMusic] = useState<ChosenMusic | null>(null);
  const [candidates, setCandidates] = useState<MusicTrack[]>([]);
  const [mix, setMix] = useState({ clip: 1, sfx: 0.9 });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [summary, setSummary] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCues([]);
    setMusic(null);
    setCandidates([]);
    setStatus(null);
    setSummary("");
    setSelected(null);
  }, []);

  const fitTrack = async (
    track: MusicTrack,
    dropAt: number,
    volume: number
  ) => {
    if (!clip) {
      return;
    }
    setStatus({ error: false, text: `Fitting “${track.title}” to the reel…` });
    const shape = await analyseTrack(track.url);
    const placed = placeMusic(shape, clip.duration, dropAt);
    setMusic({ ...placed, dropAt, shape, track, volume });
  };

  const chooseTrack = async (track: MusicTrack) => {
    setBusy(true);
    try {
      await fitTrack(
        track,
        music?.dropAt ?? Math.min(1, clip?.duration ?? 1),
        music?.volume ?? 0.25
      );
      setStatus({ error: false, text: `Music: “${track.title}”.` });
    } catch (error) {
      setStatus({ error: true, text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  };

  const search = async (query: string) => {
    if (!(clip && query.trim())) {
      return;
    }
    setBusy(true);
    setStatus({ error: false, text: `Searching Openverse for “${query}”…` });
    try {
      const tracks = await searchMusic([query], clip.duration);
      setCandidates(tracks);
      setStatus({
        error: false,
        text:
          tracks.length > 0
            ? `${tracks.length} CC0 tracks found.`
            : "Nothing usable found. Try other words.",
      });
    } catch (error) {
      setStatus({ error: true, text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  };

  const autoSync = async (vibe: string) => {
    if (!clip) {
      return;
    }
    setBusy(true);
    try {
      const found = await findMoments(clip.file, (progress) =>
        setStatus({
          error: false,
          text: `Finding moments… ${Math.round(progress * 100)}%`,
        })
      );
      if (found.moments.length === 0) {
        throw new Error(
          "Nothing changes in this recording, so there's nothing to sync to."
        );
      }
      setStatus({
        error: false,
        text: `Claude is looking at ${found.moments.length} moments…`,
      });
      const response = await fetch(DIRECTOR_URL, {
        body: JSON.stringify({
          duration: clip.duration,
          hasClipSound: clip.hasAudio && mix.clip > 0,
          moments: found.moments.map(
            ({ strength: _strength, ...moment }) => moment
          ),
          stills: found.stills,
          vibe: vibe.trim() || undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const plan = (await response.json()) as DirectorPlan & { error?: string };
      if (!response.ok) {
        throw new Error(plan.error ?? "Claude didn't answer. Try again.");
      }
      const labels = new Map(plan.moments.map((m) => [m.id, m.what]));
      setCues(
        plan.cues.map((cue) => ({
          at: cue.at,
          id: newCueId(),
          note: labels.get(cue.moment) ?? cue.why,
          sound: cue.sound,
          volume: cue.volume,
        }))
      );
      setSummary(plan.summary);
      setStatus({ error: false, text: "Finding music on Openverse…" });
      const tracks = await searchMusic(plan.music.queries, clip.duration);
      setCandidates(tracks);
      if (tracks[0]) {
        await fitTrack(tracks[0], plan.music.dropAt, plan.music.volume);
      } else {
        setMusic(null);
      }
      setStatus({
        error: false,
        text: `${plan.cues.length} sounds placed${tracks[0] ? `, music: “${tracks[0].title}”` : ", no music found (search below)"}. Press play to listen.`,
      });
    } catch (error) {
      setStatus({ error: true, text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  };

  const moveDrop = (dropAt: number) => {
    if (!clip) {
      return;
    }
    setMusic((current) => {
      if (!current) {
        return current;
      }
      const start = current.drop === null ? -1 : current.drop - dropAt;
      const fits =
        start >= 0 &&
        (current.loop || start + clip.duration <= current.shape.duration);
      return fits
        ? { ...current, dropAt, start: Number(start.toFixed(2)) }
        : {
            ...current,
            dropAt,
            ...placeMusic(current.shape, clip.duration, dropAt),
          };
    });
  };

  const updateCue = (id: string, patch: Partial<StudioCue>) =>
    setCues((current) =>
      current
        .map((cue) => (cue.id === id ? { ...cue, ...patch } : cue))
        .toSorted((a, b) => a.at - b.at)
    );

  const addCue = (sound: SoundId, at: number) => {
    const cue = { at, id: newCueId(), note: "", sound, volume: 0.8 };
    setCues((current) => [...current, cue].toSorted((a, b) => a.at - b.at));
    setSelected(cue.id);
  };

  const removeCue = (id: string) =>
    setCues((current) => current.filter((cue) => cue.id !== id));

  const sceneAudio: Pick<
    ReelSceneProps,
    "clipVolume" | "cues" | "music" | "sfxVolume"
  > = {
    clipVolume: clip?.hasAudio ? mix.clip : 0,
    cues,
    music: music
      ? {
          ...FADE,
          loop: music.loop,
          src: music.track.url,
          start: music.start,
          volume: music.volume,
        }
      : null,
    sfxVolume: mix.sfx,
  };

  return {
    addCue,
    autoSync,
    busy,
    candidates,
    chooseTrack,
    cues,
    mix,
    moveDrop,
    music,
    removeCue,
    reset,
    sceneAudio,
    search,
    selected,
    setMix,
    setMusic,
    setSelected,
    status,
    summary,
    updateCue,
  };
};

export type Soundtrack = ReturnType<typeof useSoundtrack>;

// One shared element for previews, so a new preview stops the last one.
const usePreview = () => {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  const play = async (key: string, src: string, from = 0) => {
    audio.current?.pause();
    if (playing === key) {
      setPlaying(null);
      return;
    }
    const element = new Audio(src);
    element.currentTime = from;
    element.addEventListener("ended", () => setPlaying(null));
    audio.current = element;
    setPlaying(key);
    try {
      await element.play();
    } catch {
      setPlaying(null);
    }
  };
  return { play, playing };
};

const Heading = ({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) => (
  <h3 className="text-xs font-medium">
    {children}
    {count === undefined ? null : (
      <span className="text-muted-foreground ml-1.5 tabular-nums">{count}</span>
    )}
  </h3>
);

const MixSlider = ({
  disabled,
  id,
  label,
  onChange,
  value,
}: {
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: number) => void;
  value: number;
}) => (
  <div className="flex items-center gap-3">
    <Label className="w-14 shrink-0 text-xs" htmlFor={id}>
      {label}
    </Label>
    <Slider
      className="flex-1"
      disabled={disabled}
      id={id}
      max={100}
      min={0}
      onValueChange={([next]) => onChange(next / 100)}
      step={1}
      value={[Math.round(value * 100)]}
    />
    <span className="text-muted-foreground w-8 text-right text-xs tabular-nums">
      {Math.round(value * 100)}
    </span>
  </div>
);

const CueRow = ({
  cue,
  onPreview,
  onRemove,
  onSeek,
  onSound,
  selected,
}: {
  cue: StudioCue;
  onPreview: () => void;
  onRemove: () => void;
  onSeek: () => void;
  onSound: (sound: SoundId) => void;
  selected: boolean;
}) => (
  <li
    className={cn(
      "flex items-center gap-1.5 rounded-md px-1.5 py-0.5",
      selected && "bg-accent"
    )}
  >
    <button
      className="text-muted-foreground hover:text-foreground w-10 shrink-0 text-left text-xs tabular-nums"
      onClick={onSeek}
      title="Jump here"
      type="button"
    >
      {cue.at.toFixed(2)}s
    </button>
    <NativeSelect
      aria-label="Sound"
      className="w-28 shrink-0"
      onChange={(event) => onSound(event.target.value as SoundId)}
      size="sm"
      value={cue.sound}
    >
      {SOUND_IDS.map((id) => (
        <NativeSelectOption key={id} value={id}>
          {REEL_SOUNDS[id].label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
    <span
      className="text-muted-foreground min-w-0 flex-1 truncate text-xs"
      title={cue.note}
    >
      {cue.note}
    </span>
    <Button
      aria-label={`Hear ${REEL_SOUNDS[cue.sound].label}`}
      className="size-7"
      onClick={onPreview}
      size="icon"
      type="button"
      variant="ghost"
    >
      <Icon icon={PlayIcon} />
    </Button>
    <Button
      aria-label="Remove this sound"
      className="size-7"
      onClick={onRemove}
      size="icon"
      type="button"
      variant="ghost"
    >
      <Icon icon={Cancel01Icon} />
    </Button>
  </li>
);

const MusicPicker = ({
  preview,
  soundtrack,
}: {
  preview: ReturnType<typeof usePreview>;
  soundtrack: Soundtrack;
}) => {
  const { busy, candidates, chooseTrack, music, search, setMusic } = soundtrack;
  const [query, setQuery] = useState("");

  return (
    <>
      {music ? (
        <div className="bg-muted/60 flex items-center gap-2 rounded-md px-2.5 py-2">
          <Icon className="text-muted-foreground" icon={MusicNote01Icon} />
          <div className="min-w-0 flex-1">
            <a
              className="block truncate text-xs font-medium underline-offset-2 hover:underline"
              href={music.track.landing}
              rel="noreferrer"
              target="_blank"
            >
              {music.track.title}
            </a>
            <p className="text-muted-foreground truncate text-xs">
              {music.track.creator} · {music.track.license} · starts{" "}
              {formatTime(music.start)} in{music.loop ? " · loops" : ""}
            </p>
          </div>
          <Button
            aria-label="Remove the music"
            className="size-7 shrink-0"
            onClick={() => setMusic(null)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Icon icon={Cancel01Icon} />
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          No music yet. Auto-sync picks one, or search below.
        </p>
      )}

      {candidates.length > 0 ? (
        <ul className="-mx-1.5 max-h-48 min-h-0 overflow-y-auto lg:max-h-none lg:min-h-[4rem] lg:flex-1">
          {candidates.map((track) => {
            const inUse = music?.track.id === track.id;
            return (
              <li
                className="flex items-center gap-1.5 px-1.5 py-0.5"
                key={track.id}
              >
                <Button
                  aria-label={
                    preview.playing === track.id
                      ? `Stop ${track.title}`
                      : `Preview ${track.title}`
                  }
                  className="size-7 shrink-0"
                  onClick={() => preview.play(track.id, track.url)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Icon
                    icon={preview.playing === track.id ? PauseIcon : PlayIcon}
                  />
                </Button>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-xs",
                    inUse && "font-medium"
                  )}
                  title={track.title}
                >
                  {track.title}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatTime(track.duration)}
                </span>
                <Button
                  className="h-7 w-14 shrink-0 px-2 text-xs"
                  disabled={busy || inUse}
                  onClick={() => chooseTrack(track)}
                  size="sm"
                  type="button"
                  variant={inUse ? "ghost" : "outline"}
                >
                  {inUse ? "In use" : "Use"}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <form
        className="flex gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          search(query);
        }}
      >
        <Input
          aria-label="Search Openverse for music"
          className="h-8 text-xs"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search CC0 music: lofi loop, soft piano…"
          value={query}
        />
        <Button
          aria-label="Search"
          className="size-8 shrink-0"
          disabled={busy || !query.trim()}
          size="icon"
          type="submit"
          variant="outline"
        >
          <Icon icon={Search01Icon} />
        </Button>
      </form>
    </>
  );
};

// The right-hand column: auto-sync, effects, music and the mix, all in view.
// The effect and track lists scroll inside their own boxes.
export const SoundPanel = ({
  clip,
  fps,
  playerRef,
  soundtrack,
}: {
  clip: ReelClip | null;
  fps: number;
  playerRef: RefObject<PlayerRef | null>;
  soundtrack: Soundtrack;
}) => {
  const {
    addCue,
    autoSync,
    busy,
    cues,
    mix,
    music,
    removeCue,
    selected,
    setMix,
    setMusic,
    setSelected,
    status,
    summary,
    updateCue,
  } = soundtrack;
  const [vibe, setVibe] = useState("");
  const [newSound, setNewSound] = useState<SoundId>("click");
  const preview = usePreview();

  const playhead = () => (playerRef.current?.getCurrentFrame() ?? 0) / fps;

  return (
    <div className="flex flex-1 flex-col lg:min-h-0">
      <div className="flex flex-col gap-2 border-b p-4">
        <h2 className="text-sm font-medium">Sound</h2>
        <div className="flex gap-1.5">
          <Input
            aria-label="The feel you want (optional)"
            className="h-8 text-xs"
            disabled={!clip || busy}
            maxLength={200}
            onChange={(event) => setVibe(event.target.value)}
            placeholder="Feel (optional)"
            value={vibe}
          />
          <Button
            aria-label="Auto-sync with Claude"
            className="h-8 shrink-0"
            disabled={!clip || busy}
            onClick={() => autoSync(vibe)}
            size="sm"
            type="button"
          >
            <Icon icon={AiMagicIcon} />
            Auto-sync
          </Button>
        </div>
        <p
          className={cn(
            "text-xs",
            status?.error ? "text-destructive" : "text-muted-foreground"
          )}
          role="status"
          title={summary || undefined}
        >
          {status?.text ??
            "Claude picks a sound for each moment and fits CC0 music to the key one."}
        </p>
      </div>

      <div className="flex flex-col gap-2 border-b p-4 lg:min-h-[9.5rem] lg:flex-1">
        <div className="flex items-center justify-between gap-2">
          <Heading count={cues.length}>Effects</Heading>
          <div className="flex items-center gap-1.5">
            <NativeSelect
              aria-label="Sound to add"
              className="w-28"
              onChange={(event) => setNewSound(event.target.value as SoundId)}
              size="sm"
              value={newSound}
            >
              {SOUND_IDS.map((id) => (
                <NativeSelectOption key={id} value={id}>
                  {REEL_SOUNDS[id].label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button
              aria-label="Add at playhead"
              className="size-8"
              disabled={!clip}
              onClick={() => addCue(newSound, Number(playhead().toFixed(3)))}
              size="icon"
              title="Add this sound at the playhead"
              type="button"
              variant="outline"
            >
              <Icon icon={Add01Icon} />
            </Button>
          </div>
        </div>
        {cues.length > 0 ? (
          <ul className="-mx-1.5 max-h-64 min-h-0 overflow-y-auto lg:max-h-none lg:min-h-[4.5rem] lg:flex-1">
            {cues.map((cue) => (
              <CueRow
                cue={cue}
                key={cue.id}
                onPreview={() => {
                  setSelected(cue.id);
                  preview.play(`cue-${cue.id}`, soundSrc(cue.sound));
                }}
                onRemove={() => removeCue(cue.id)}
                onSeek={() => {
                  setSelected(cue.id);
                  playerRef.current?.seekTo(Math.round(cue.at * fps));
                }}
                onSound={(sound) => updateCue(cue.id, { sound })}
                selected={selected === cue.id}
              />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs">
            None yet. Auto-sync, or add one at the playhead.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-b p-4 lg:min-h-[14rem] lg:flex-1">
        <Heading>Music</Heading>
        <MusicPicker preview={preview} soundtrack={soundtrack} />
      </div>

      <div className="flex flex-col gap-2.5 p-4">
        <Heading>Mix</Heading>
        <MixSlider
          disabled={!clip?.hasAudio}
          id="mix-clip"
          label="Clip"
          onChange={(clipLevel) => setMix({ ...mix, clip: clipLevel })}
          value={clip?.hasAudio ? mix.clip : 0}
        />
        <MixSlider
          id="mix-sfx"
          label="Effects"
          onChange={(sfx) => setMix({ ...mix, sfx })}
          value={mix.sfx}
        />
        <MixSlider
          disabled={!music}
          id="mix-music"
          label="Music"
          onChange={(volume) => setMusic(music ? { ...music, volume } : null)}
          value={music?.volume ?? 0}
        />
      </div>
    </div>
  );
};
