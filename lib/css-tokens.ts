import type { CssTokenSource } from "@/lib/css-vars";
import { varReferences } from "@/lib/css-vars";
import { readOptionalFromRoot } from "@/lib/registry";

export type { CssTokenSource } from "@/lib/css-vars";

const GLOBALS_CSS = "styles/globals.css";

// Body of every top-level `<selector> {` block (a line starting with the
// selector), with nested braces balanced.
const blockBodies = (css: string, selector: string) => {
  const bodies: string[] = [];
  const opener = `\n${selector} {`;
  let from = css.indexOf(opener);

  while (from !== -1) {
    let depth = 0;
    let index = from + opener.length - 1;

    for (; index < css.length; index += 1) {
      if (css[index] === "{") {
        depth += 1;
      } else if (css[index] === "}") {
        depth -= 1;

        if (depth === 0) {
          break;
        }
      }
    }

    bodies.push(css.slice(from + opener.length, index));
    from = css.indexOf(opener, index);
  }

  return bodies;
};

const declarations = (bodies: string[]) => {
  const values: Record<string, string> = {};

  for (const body of bodies) {
    for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      if (name && value) {
        values[name] = value.replaceAll(/\s+/g, " ").trim();
      }
    }
  }

  return values;
};

const pick = (values: Record<string, string>, names: Set<string>) =>
  Object.fromEntries(
    Object.entries(values).filter(([name]) => names.has(name))
  );

// Reads the given custom properties (names without `--`), plus every token
// they reference through var() (followed all the way down), exactly as
// they're written in globals.css, so developer-facing views show the source, not the
// browser's processed values (which turn oklch into lab and resolve var()).
// Server only: reads the file from disk at render (build time for static
// pages).
export const readCssTokens = async (
  names: readonly string[]
): Promise<CssTokenSource> => {
  const source = await readOptionalFromRoot(GLOBALS_CSS);

  if (!source) {
    return { dark: {}, root: {} };
  }

  const css = source.replaceAll(/\/\*[\s\S]*?\*\//g, "");
  const root = declarations(blockBodies(css, ":root"));
  const dark = declarations(blockBodies(css, ".dark"));

  const wanted = new Set<string>();
  const queue = [...names];

  while (queue.length > 0) {
    const name = queue.shift();

    if (!name || wanted.has(name)) {
      continue;
    }

    wanted.add(name);

    for (const value of [root[name], dark[name]]) {
      if (value) {
        queue.push(...varReferences(value));
      }
    }
  }

  return { dark: pick(dark, wanted), root: pick(root, wanted) };
};
