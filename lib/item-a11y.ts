// An item's accessibility notes: registry.json `meta.a11y`, shown in the
// docs preview's Accessibility view (components/preview-a11y-panel.tsx).
// Written by reading the item's code and checking it with the preview's
// Reduced motion and Keyboard modes, so a visitor can judge it before
// copying it.
//
//   "a11y": {
//     "reducedMotion": "The dial snaps instead of springing; autoplay starts paused.",
//     "keyboard": [{ "keys": "↑ / ↓", "action": "Step through the projects" }],
//     "notes": ["The dial is a slider named “Selected projects”; its value says the project and its place."],
//     "gaps": []
//   }
//
// `keyboard` is empty for an item with nothing to focus. `gaps` says
// honestly what's missing. Checked by the registry build (lib/taxonomy.ts).

export interface ItemA11yKey {
  action: string;
  // " / " between alternatives, "+" inside a combination: "Tab",
  // "Shift+Tab", "Enter / Space", "↑ / ↓".
  keys: string;
}

export interface ItemA11y {
  gaps: string[];
  keyboard: ItemA11yKey[];
  notes: string[];
  reducedMotion: string;
}

const LIMITS = { entries: 12, text: 240 } as const;

const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

const textListErrors = (at: string, field: string, value: unknown) => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [`${at}: meta.a11y.${field} must be a list of sentences.`];
  }
  const errors: string[] = [];
  if (value.length > LIMITS.entries) {
    errors.push(
      `${at}: meta.a11y.${field} has over ${LIMITS.entries} entries.`
    );
  }
  for (const entry of value) {
    if (!isText(entry)) {
      errors.push(`${at}: meta.a11y.${field} entries must be text.`);
    } else if (entry.length > LIMITS.text) {
      errors.push(
        `${at}: meta.a11y.${field} "${entry.slice(0, 40)}…" is over ${LIMITS.text} characters.`
      );
    }
  }
  return errors;
};

const keyboardErrors = (at: string, value: unknown) => {
  if (!Array.isArray(value)) {
    return [
      `${at}: meta.a11y.keyboard must be a list of { "keys", "action" } (empty when nothing takes focus).`,
    ];
  }
  return value.flatMap((entry) =>
    typeof entry === "object" &&
    entry !== null &&
    isText((entry as ItemA11yKey).keys) &&
    isText((entry as ItemA11yKey).action)
      ? []
      : [`${at}: meta.a11y.keyboard entries need "keys" and "action" text.`]
  );
};

// Problems with an item's meta.a11y, for the registry build. Optional for
// now: no a11y, no errors.
export const itemA11yErrors = (at: string, value: unknown): string[] => {
  if (value === undefined) {
    return [];
  }
  if (typeof value !== "object" || value === null) {
    return [`${at}: meta.a11y must be an object.`];
  }
  const a11y = value as Record<string, unknown>;
  const errors: string[] = [];
  const known = new Set(["gaps", "keyboard", "notes", "reducedMotion"]);
  for (const key of Object.keys(a11y)) {
    if (!known.has(key)) {
      errors.push(
        `${at}: meta.a11y.${key} isn't a field. Use reducedMotion, keyboard, notes and gaps.`
      );
    }
  }
  if (!isText(a11y.reducedMotion)) {
    errors.push(
      `${at}: meta.a11y.reducedMotion is missing: say what changes with reduced motion on.`
    );
  } else if (a11y.reducedMotion.length > LIMITS.text) {
    errors.push(
      `${at}: meta.a11y.reducedMotion is over ${LIMITS.text} characters.`
    );
  }
  errors.push(...keyboardErrors(at, a11y.keyboard));
  errors.push(...textListErrors(at, "notes", a11y.notes));
  errors.push(...textListErrors(at, "gaps", a11y.gaps));
  return errors;
};

// The notes as the docs page shows them, or null when the item has none
// (or they don't check out; the registry build reports why).
export const readItemA11y = (value: unknown): ItemA11y | null => {
  if (itemA11yErrors("", value).length > 0 || value === undefined) {
    return null;
  }
  const a11y = value as Partial<ItemA11y> & { reducedMotion: string };
  return {
    gaps: a11y.gaps ?? [],
    keyboard: a11y.keyboard ?? [],
    notes: a11y.notes ?? [],
    reducedMotion: a11y.reducedMotion,
  };
};
