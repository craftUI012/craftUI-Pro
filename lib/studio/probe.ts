import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { repoPath } from "@/lib/studio/paths";

// The live interaction probe (scripts/probe.mjs), run before the feature
// audit: headless Chrome opens the component's real preview, finds every
// element that reacts to input, tries hover, click, a cursor glide, a drag
// and the source's keys, and reports what changed on screen. The audit then
// picks features from interactions that are proven to work, instead of
// guessing from the source's literal aria-labels. Dev only: it needs the
// dev server and Chrome.

export interface ProbeEffect {
  appeared: number;
  faded: number;
  maxScale: number;
  moved: number;
  newText: string;
  removed: number;
  resized: number;
  /** What grew or shrank, by element, with its scale. */
  sizes: { count: number; scale: number; what: string }[];
  textChanged: boolean;
}

export interface ProbeGroup {
  /** "G1", "G2"…: how the audit names a target. */
  id: string;
  selector: string;
  /** Look-alike elements in the group (a rail of tiles is one group). */
  count: number;
  visibleCount: number;
  handlers: string[];
  /** The CSS cursor over it; "none" means the component draws its own. */
  cursor: string;
  label: string;
  labels: string[];
  tag: string;
  role: string | null;
  rect: { x: number; y: number; width: number; height: number };
}

export interface ProbeTest {
  action: "hover" | "click" | "sweep" | "drag" | "key";
  group: string | null;
  key?: string;
  across?: string;
  selector?: string | null;
  responds?: boolean;
  effect?: ProbeEffect;
  error?: string;
}

export interface ProbeResult {
  /** The component reads as dark (sampled from its screenshot). */
  dark: boolean;
  /** Its strongest distinct colours (#rrggbb), for the Auto ground. */
  palette: string[];
  groups: ProbeGroup[];
  /** What changes on its own, measured first, so drift isn't a response. */
  idle: ProbeEffect;
  ownCursor: boolean;
  tests: ProbeTest[];
  viewport: { width: number; height: number };
}

const exec = promisify(execFile);
const TIMEOUT_MS = 180_000;

export const runProbe = async (
  item: string,
  keys: string[]
): Promise<ProbeResult> => {
  const base = `http://localhost:${process.env.PORT ?? 3000}`;
  try {
    const { stdout } = await exec(
      process.execPath,
      ["scripts/probe.mjs", item, "--base", base, "--keys", keys.join(",")],
      {
        cwd: repoPath(),
        killSignal: "SIGKILL",
        maxBuffer: 8 * 1024 * 1024,
        timeout: TIMEOUT_MS,
      }
    );
    const line = stdout.trim().split("\n").at(-1) ?? "";
    return JSON.parse(line) as ProbeResult;
  } catch (error) {
    const failure = error as { killed?: boolean; stderr?: string };
    if (failure.killed) {
      throw new Error(
        `The interaction probe took longer than ${TIMEOUT_MS / 1000}s.`,
        {
          cause: error,
        }
      );
    }
    const last = failure.stderr
      ?.split("\n")
      .findLast(
        (l) =>
          l.trim() &&
          !l.includes("MODULE_TYPELESS") &&
          !l.includes("Reparsing") &&
          !l.includes('type": "module"') &&
          !l.includes("trace-warnings")
      );
    throw new Error(`The interaction probe failed: ${last ?? String(error)}`, {
      cause: error,
    });
  }
};

const effectText = (e: ProbeEffect) => {
  const parts = e.sizes.map((s) => `${s.count} × ${s.what} scaled ${s.scale}×`);
  if (e.faded) {
    parts.push(`${e.faded} faded in or out`);
  }
  if (e.appeared || e.removed) {
    parts.push(`${e.appeared} appeared, ${e.removed} went away`);
  }
  if (e.textChanged) {
    parts.push(`text changed${e.newText ? ` to "${e.newText}"` : ""}`);
  }
  return parts.join("; ") || "nothing visible changed";
};

/** The probe as the audit reads it. */
export const probeReport = (probe: ProbeResult) => {
  const groups = probe.groups.map(
    (g) =>
      `${g.id}: ${g.count > 1 ? `${g.count} × ` : ""}<${g.tag}${g.role ? ` role="${g.role}"` : ""}> "${g.label}" at ${g.rect.x},${g.rect.y} ${g.rect.width}×${g.rect.height}px; handlers ${g.handlers.join(", ") || "none (native)"}; cursor ${g.cursor}`
  );
  const tests = probe.tests.map((t) => {
    const what =
      t.action === "key"
        ? `key ${t.key}`
        : `${t.action} ${t.group}${t.across ? ` (across ${t.across})` : ""}`;
    if (t.error) {
      return `${what}: could not run (${t.error})`;
    }
    return `${what}: ${t.responds ? "RESPONDS" : "no response"}; ${t.effect ? effectText(t.effect) : ""}`;
  });
  return `<interaction_probe viewport="${probe.viewport.width}x${probe.viewport.height}" own_cursor="${probe.ownCursor}">
Idle, with no input, over ${0.7}s: ${effectText(probe.idle)} (and ${probe.idle.moved} elements moved on their own).

Interactive groups:
${groups.join("\n")}

What each interaction did, tried for real on a fresh page:
${tests.join("\n")}
</interaction_probe>`;
};

/** Whether the probe saw this interaction work. */
export const probeResponds = (
  probe: ProbeResult,
  action: ProbeTest["action"],
  target: string
) =>
  probe.tests.some(
    (t) =>
      t.action === action &&
      t.responds === true &&
      (action === "key" ? t.key === target : t.group === target)
  );
