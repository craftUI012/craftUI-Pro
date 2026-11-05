// Films one live shot (a /reels/shot page) to an MP4 clip, frame by frame.
//
// Stageshow's virtual clock (reels/kit/clock.ts) is installed in the page
// and in every iframe before any of their code runs, so time only moves
// when this steps it. Each step moves timers, animation frames and every
// CSS/WAAPI animation by exactly 1/fps, then the frame is captured. Nothing
// drops or doubles, and every render of the same shot is identical.
//
// The stage cursor drives Chrome's real mouse through the __reelPointer
// binding, so a component's own :hover/:active styles and handlers run.

import { spawn } from "node:child_process";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { chromium } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "../..");

export const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Node strips the types from clock.ts on import, so the function's source
// is plain JS that can run in the page as an init script.
const { installVirtualClock } = await import(
  path.join(ROOT, "reels/kit/clock.ts")
);
const EPOCH = Date.UTC(2026, 10, 4, 10, 0, 0);

/** True once every button in the document has been hydrated by React. */
const hydrated = () => {
  const buttons = [...document.querySelectorAll("button, a, input")];
  return buttons.every((b) =>
    Object.keys(b).some((k) => k.startsWith("__react"))
  );
};

/** Steps the virtual clock by one frame in each of the given frames. */
const step = async (targets) => {
  for (const f of targets) {
    await f.evaluate(() => window.__stageshow?.clock?.step(1));
  }
};

/**
 * Waits until the shot has its images decoded (window.__reel.ready) and the
 * preview's React has hydrated. Polled from here: in the page, timers and
 * animation frames only run when the clock is stepped. The iframe's clock
 * is stepped meanwhile, in case hydration waits on one.
 */
const waitUntilReady = async (frames) => {
  for (let waited = 0; waited < 180_000; waited += 200) {
    await sleep(200);
    const all = frames();
    const inner = all.slice(1);
    await step(inner);
    const shotReady = await all[0].evaluate(
      () => window.__reel?.ready === true
    );
    const innerReady = await Promise.all(
      inner.map((f) => f.evaluate(hydrated))
    );
    if (shotReady && inner.length > 0 && innerReady.every(Boolean)) {
      return;
    }
  }
  throw new Error(
    "the shot never became ready (window.__reel.ready, hydrated preview)"
  );
};

/** ffmpeg reading PNG frames on stdin into an H.264 clip at `out`. */
const encoder = (fps, out) => {
  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      String(fps),
      "-c:v",
      "png",
      "-i",
      "-",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "14",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(fps),
      "-movflags",
      "+faststart",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-colorspace",
      "bt709",
      out,
    ],
    { stdio: ["pipe", "inherit", "inherit"] }
  );
  // `once` rejects if ffmpeg emits "error" first.
  const finished = async () => {
    const [code] = await once(ffmpeg, "close");
    if (code !== 0) {
      throw new Error(`ffmpeg exited ${code}`);
    }
  };
  const done = finished();
  return { done, stdin: ffmpeg.stdin };
};

/**
 * @param {object} o          what to film and where
 * @param {string} o.url        the shot page
 * @param {string} o.out        clip path (.mp4)
 * @param {number} o.width      stage width in CSS px (filmed at 2x)
 * @param {number} o.height     stage height in CSS px
 * @param {number} o.fps      frames per second
 * @param {"light"|"dark"} o.theme  the browser color scheme
 * @param {number} [o.maxSeconds]  stop here if the shot never marks "end"
 * @param {number[]} [o.stills] seconds to also save as PNG beside the clip
 * @param {(msg: string) => void} [o.log]  progress, one word at a time
 * @returns {Promise<{ frames: number, marks: Record<string, number> }>} the
 *   frame count and the frame each stage mark first appeared on
 */
export const filmClip = async ({
  url,
  out,
  width,
  height,
  fps,
  theme,
  maxSeconds = 60,
  stills = [],
  log,
}) => {
  const browser = await chromium.launch({
    args: ["--hide-scrollbars", "--force-color-profile=srgb"],
    executablePath: CHROME,
    headless: true,
  });
  try {
    const context = await browser.newContext({
      colorScheme: theme,
      deviceScaleFactor: 2,
      reducedMotion: "no-preference",
      viewport: { height, width },
    });
    await context.addInitScript(
      `(${installVirtualClock.toString()})({ fps: ${fps}, epoch: ${EPOCH} });`
    );
    const page = await context.newPage();

    // The stage cursor's moves and presses, as real mouse input. Queued so
    // they land in order; the page never waits on them.
    let input = Promise.resolve();
    await page.exposeBinding("__reelPointer", (_source, event) => {
      input = input.then(async () => {
        if (event.type === "move") {
          await page.mouse.move(event.x, event.y);
        } else if (event.type === "down") {
          await page.mouse.move(event.x, event.y);
          await page.mouse.down();
        } else {
          await page.mouse.up();
        }
      });
    });

    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("reel:")) {
        errors.push(msg.text());
      }
    });

    const response = await page.goto(url, {
      timeout: 180_000,
      waitUntil: "load",
    });
    if (!response?.ok()) {
      throw new Error(
        `${url} answered ${response?.status()}. Is pnpm dev running, with environment=development in .env?`
      );
    }

    const frames = () => page.frames().filter((f) => !f.isDetached());

    await waitUntilReady(frames);

    // Let the preview finish its own entrance before frame 0, so the clip
    // opens on a settled picture.
    for (let i = 0; i < Math.round(fps * 1.2); i += 1) {
      await step(frames().slice(1));
    }
    await page.evaluate(() => window.__stageshow?.clock?.flushLayout());

    const ffmpeg = encoder(fps, out);

    const stillFrames = new Set(stills.map((t) => Math.round(t * fps)));
    let count = 0;
    const capture = async () => {
      // Playwright's screenshot honors the emulated 2x device (a raw CDP
      // capture sees the headless window at 1x, minus its chrome).
      const buffer = await page.screenshot({
        animations: "allow",
        caret: "initial",
        type: "png",
      });
      if (stillFrames.has(count)) {
        writeFileSync(
          out.replace(/\.mp4$/, `-${(count / fps).toFixed(1)}s.png`),
          buffer
        );
      }
      if (!ffmpeg.stdin.write(buffer)) {
        await once(ffmpeg.stdin, "drain");
      }
      count += 1;
    };

    const marks = {};
    let lastMark = null;
    const readMark = () =>
      page.evaluate(
        () => document.querySelector(".ss-stage").dataset.mark ?? null
      );

    await capture();
    const max = Math.round(maxSeconds * fps);
    // `count` is advanced by capture(); one capture per pass.
    for (let pass = 1; pass < max; pass += 1) {
      await step(frames());
      await input;
      if (errors.length > 0) {
        throw new Error(errors.join("\n"));
      }
      const mark = await readMark();
      if (mark && mark !== lastMark) {
        marks[mark] = count;
        lastMark = mark;
      }
      await capture();
      if (count % fps === 0) {
        log?.(`${(count / fps).toFixed(0)}s`);
      }
      if (mark === "end") {
        break;
      }
    }
    if (count >= max) {
      log?.(`stopped at ${maxSeconds}s before the shot marked "end"`);
    }
    ffmpeg.stdin.end();
    await ffmpeg.done;
    return { frames: count, marks };
  } finally {
    await browser.close();
  }
};
