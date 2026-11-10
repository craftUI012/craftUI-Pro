import { CALIBRATION, CalibrationScene } from "./reel-scene";
import { soundSrc } from "./reel-sounds";

// Keeping the export's sound in sync with its picture.
//
// An AAC encoder puts a short "priming" stretch of silence before the audio
// (2112 samples, 44 ms, with macOS's encoder). An MP4 should carry an edit
// list telling players to skip it, but the browser's encoder reports the
// primed packets as starting at 0, so Remotion's export has none, and every
// sound plays that much late in players that don't guess (ffmpeg, and
// Instagram's processing). Measured on a 60 fps export: clicks 44.1-44.9 ms
// late after frame rounding.
//
// The fix: once per session, render a tiny reel with one click at a known
// time and measure how late it decodes. After each export, copy its packets
// into a new MP4 (no re-encoding) with the audio moved earlier by that much;
// Mediabunny then writes the edit list itself.

const THRESHOLD = 0.03;
let measuredLead: Promise<number> | null = null;

const firstLoud = (data: Float32Array) =>
  data.findIndex((v) => Math.abs(v) > THRESHOLD);

// When the click crosses the threshold inside its own file.
const ownOnset = async () => {
  const response = await fetch(soundSrc("click"));
  const context = new OfflineAudioContext({
    length: 1,
    numberOfChannels: 1,
    sampleRate: 48_000,
  });
  const audio = await context.decodeAudioData(await response.arrayBuffer());
  return firstLoud(audio.getChannelData(0)) / audio.sampleRate;
};

// When the first loud sample decodes in a rendered file.
const decodedOnset = async (blob: Blob) => {
  const { ALL_FORMATS, AudioSampleSink, BlobSource, Input } =
    await import("mediabunny");
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(blob),
  });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) {
      return null;
    }
    for await (const sample of new AudioSampleSink(track).samples()) {
      const buffer = sample.toAudioBuffer();
      const index = firstLoud(buffer.getChannelData(0));
      const { timestamp } = sample;
      sample.close();
      if (index !== -1) {
        return timestamp + index / buffer.sampleRate;
      }
    }
    return null;
  } finally {
    input.dispose();
  }
};

const measureLead = async () => {
  const { renderMediaOnWeb } = await import("@remotion/web-renderer");
  const { getBlob } = await renderMediaOnWeb({
    composition: {
      component: CalibrationScene,
      durationInFrames: CALIBRATION.frames,
      fps: CALIBRATION.fps,
      height: CALIBRATION.size,
      id: "calibration",
      width: CALIBRATION.size,
    },
    licenseKey: "free-license",
  });
  const [onset, own] = await Promise.all([
    decodedOnset(await getBlob()),
    ownOnset(),
  ]);
  if (onset === null) {
    return 0;
  }
  const lead = onset - (CALIBRATION.at + own);
  // Below a millisecond (or early, which would mean the encoder is already
  // signalled): leave the export alone.
  return lead > 0.001 && lead < 0.2 ? lead : 0;
};

const measureSafely = async () => {
  try {
    return await measureLead();
  } catch {
    // Try again next export; this one goes out unshifted.
    measuredLead = null;
    return 0;
  }
};

// The encoder's delay, measured once per page session.
export const audioLead = () => {
  measuredLead ??= measureSafely();
  return measuredLead;
};

// Copy the export's packets into a new MP4 with the audio `lead` seconds
// earlier. The first audio packet then has a negative timestamp, which
// Mediabunny writes as an edit list, so players skip the priming.
export const shiftAudio = async (blob: Blob, lead: number) => {
  const {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    EncodedAudioPacketSource,
    EncodedPacketSink,
    EncodedVideoPacketSource,
    Input,
    Mp4OutputFormat,
    Output,
  } = await import("mediabunny");
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(blob),
  });
  try {
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    if (!(video?.codec && audio?.codec)) {
      return blob;
    }
    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });
    const videoSource = new EncodedVideoPacketSource(video.codec);
    const audioSource = new EncodedAudioPacketSource(audio.codec);
    output.addVideoTrack(videoSource, { rotation: video.rotation });
    output.addAudioTrack(audioSource);
    await output.start();

    const videoConfig = (await video.getDecoderConfig()) ?? undefined;
    const audioConfig = (await audio.getDecoderConfig()) ?? undefined;
    const videoPackets = [];
    for await (const packet of new EncodedPacketSink(video).packets()) {
      videoPackets.push(packet);
    }
    const audioPackets = [];
    for await (const packet of new EncodedPacketSink(audio).packets()) {
      audioPackets.push(packet.clone({ timestamp: packet.timestamp - lead }));
    }

    // Interleave by time, keeping each track's own (decode) order.
    let v = 0;
    let a = 0;
    while (v < videoPackets.length || a < audioPackets.length) {
      const takeVideo =
        a >= audioPackets.length ||
        (v < videoPackets.length &&
          videoPackets[v].timestamp <= audioPackets[a].timestamp);
      if (takeVideo) {
        await videoSource.add(
          videoPackets[v],
          v === 0 ? { decoderConfig: videoConfig } : undefined
        );
        v += 1;
      } else {
        await audioSource.add(
          audioPackets[a],
          a === 0 ? { decoderConfig: audioConfig } : undefined
        );
        a += 1;
      }
    }
    await output.finalize();
    return target.buffer
      ? new Blob([target.buffer], { type: "video/mp4" })
      : blob;
  } finally {
    input.dispose();
  }
};
