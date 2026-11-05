import { homedir } from "node:os";
import path from "node:path";

// Every file the Studio reads or writes is resolved here, from the repo
// root at runtime. The comment tells Next.js not to trace the dynamic path:
// traced, it pulled most of the project (public/ images included) into the
// Studio's server bundle. The data files the Studio does read in production
// are listed in next.config.mjs (outputFileTracingIncludes).

/** An absolute path inside the repo. */
export const repoPath = (...parts: string[]) =>
  // oxlint-disable-next-line no-inline-comments -- Next.js reads this comment.
  path.join(/* turbopackIgnore: true */ process.cwd(), ...parts);

/**
 * Where Interface Craft (Josh Puckett's skill) is installed on this machine.
 * It isn't in the repo, so the feature audit reads it from the user's skills
 * folder; INTERFACE_CRAFT_DIR overrides the location.
 */
export const interfaceCraftPath = (...parts: string[]) =>
  path.join(
    // oxlint-disable-next-line no-inline-comments -- Next.js reads this comment.
    /* turbopackIgnore: true */ process.env.INTERFACE_CRAFT_DIR ??
      path.join(homedir(), ".claude/skills/interface-craft"),
    ...parts
  );
