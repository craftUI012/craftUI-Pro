// Music for the reel: CC0 and public-domain tracks from Openverse (mostly
// Freesound loops and beds), filtered to things that sound like music, and
// placed so the track's biggest lift lands on the reel's key moment.
// Openverse's API and its audio hosts (cdn.freesound.org,
// upload.wikimedia.org) allow browser requests, so this runs client-side.
// Anonymous Openverse use is limited to 20 searches a minute.

export interface MusicTrack {
  creator: string;
  duration: number;
  id: string;
  landing: string;
  license: string;
  source: string;
  title: string;
  url: string;
}

export interface TrackShape {
  // Where the energy rises most, strongest first.
  drops: { at: number; rise: number }[];
  duration: number;
}

const API = "https://api.openverse.org/v1/audio/";
const MUSIC_WORDS =
  /loop|music|beat|melod|piano|synth|lo-?fi|chill|ambient|groove|track|song|bpm|guitar|pad|bass|drum|electro|house|jazz|hip ?hop|instrumental|soundtrack|tune|chord/i;
const NOT_MUSIC =
  /voice|vocal|speech|talk|pronunciation|noise|footstep|door|rain|crowd|traffic|city|street|bird|sfx|effect|glitch|robot|hard drive|vacuum|engine|field recording|alarm|siren/i;

interface OpenverseResult {
  category?: string | null;
  creator?: string | null;
  duration?: number | null;
  filetype?: string | null;
  foreign_landing_url?: string;
  id: string;
  license: string;
  source: string;
  tags?: { name: string }[];
  title?: string | null;
  url: string;
}

const scoreTrack = (result: OpenverseResult, minSeconds: number) => {
  const seconds = (result.duration ?? 0) / 1000;
  const text = `${result.title ?? ""} ${(result.tags ?? []).map((tag) => tag.name).join(" ")}`;
  if (
    seconds < 6 ||
    result.category === "pronunciation" ||
    NOT_MUSIC.test(text)
  ) {
    return null;
  }
  let score = MUSIC_WORDS.test(text) ? 3 : 0;
  if (seconds >= minSeconds) {
    score += 2;
  } else if (/loop/i.test(text)) {
    score += 1;
  }
  return score;
};

export const searchMusic = async (
  queries: string[],
  minSeconds: number
): Promise<MusicTrack[]> => {
  const found = new Map<string, MusicTrack & { score: number }>();
  for (const q of queries.slice(0, 3)) {
    const params = new URLSearchParams({
      license: "cc0,pdm",
      mature: "false",
      page_size: "20",
      q,
    });
    const response = await fetch(`${API}?${params}`);
    if (response.status === 429) {
      throw new Error("Openverse's search limit is reached. Wait a minute.");
    }
    if (!response.ok) {
      continue;
    }
    const data = (await response.json()) as { results?: OpenverseResult[] };
    for (const result of data.results ?? []) {
      const score = scoreTrack(result, minSeconds);
      if (score === null || found.has(result.id)) {
        continue;
      }
      found.set(result.id, {
        creator: result.creator ?? "Unknown",
        duration: (result.duration ?? 0) / 1000,
        id: result.id,
        landing: result.foreign_landing_url ?? result.url,
        license: result.license.toUpperCase(),
        score,
        source: result.source,
        title: (result.title ?? "Untitled").replace(
          /\.(wav|mp3|flac|ogg|aiff?)$/i,
          ""
        ),
        url: result.url,
      });
    }
  }
  return [...found.values()]
    .toSorted((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ score: _score, ...track }) => track);
};

const HOP = 0.05;
// Hops either side of a point: 1 s.
const WINDOW = 20;

// Decode the track and find where its loudness rises most (a drop, a beat
// coming in, a new section).
export const analyseTrack = async (url: string): Promise<TrackShape> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Couldn't download that track.");
  }
  const context = new OfflineAudioContext({
    length: 1,
    numberOfChannels: 1,
    sampleRate: 22_050,
  });
  const audio = await context.decodeAudioData(await response.arrayBuffer());
  const hop = Math.round(audio.sampleRate * HOP);
  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) =>
    audio.getChannelData(i)
  );
  const energy: number[] = [];
  for (let start = 0; start + hop <= audio.length; start += hop) {
    let sum = 0;
    for (const channel of channels) {
      for (let i = start; i < start + hop; i += 1) {
        sum += channel[i] * channel[i];
      }
    }
    energy.push(10 * Math.log10(sum / (hop * channels.length) + 1e-10));
  }
  const mean = (from: number, to: number) => {
    let sum = 0;
    for (let i = from; i < to; i += 1) {
      sum += energy[i];
    }
    return sum / Math.max(1, to - from);
  };
  const rises: { at: number; rise: number }[] = [];
  for (let i = WINDOW; i < energy.length - WINDOW; i += 1) {
    rises.push({
      at: i * HOP,
      rise: mean(i, i + WINDOW) - mean(i - WINDOW, i),
    });
  }
  // The strongest rises, at least 2 s apart.
  const drops: { at: number; rise: number }[] = [];
  for (const candidate of rises.toSorted((a, b) => b.rise - a.rise)) {
    if (candidate.rise < 2 || drops.length >= 8) {
      break;
    }
    if (drops.every((drop) => Math.abs(drop.at - candidate.at) >= 2)) {
      drops.push(candidate);
    }
  }
  return { drops, duration: audio.duration };
};

// Where in the track the reel should start so its biggest usable rise lands
// at `dropAt`. A track shorter than the reel loops.
export const placeMusic = (
  shape: TrackShape,
  reelSeconds: number,
  dropAt: number
) => {
  const loop = shape.duration < reelSeconds;
  for (const drop of shape.drops) {
    const start = drop.at - dropAt;
    const fits = loop
      ? start >= 0 && start < shape.duration
      : start >= 0 && start + reelSeconds <= shape.duration;
    if (fits) {
      return { drop: drop.at, loop, start: Number(start.toFixed(2)) };
    }
  }
  return { drop: null, loop, start: 0 };
};
