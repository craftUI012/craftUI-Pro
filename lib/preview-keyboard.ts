// Keyboard mode in the docs preview: the toolbar's Keyboard switch
// (components/preview-frame.tsx) tells a live item's iframe to number its
// Tab stops and report each focus change, and the box shows a readout under
// the preview: which stop, its role, its accessible name, its state, and
// anything a keyboard or screen-reader user would trip on, with the WCAG
// criterion it breaks. The iframe side is
// components/preview-keyboard-inspector.tsx.
//
// The names and roles here approximate what browsers compute (the
// accessible name and role rules, in their common cases). Good enough to
// catch an unnamed icon button or a focusable div; not a screen reader.

export const KEYBOARD_MESSAGE = {
  // iframe → docs page: a FocusReport
  focus: "craftui:preview-keyboard-focus",
  // iframe → docs page: focus has left the preview (Tab past the last stop)
  left: "craftui:preview-keyboard-left",
  // docs page → iframe: { on: boolean }
  mode: "craftui:preview-keyboard",
  // docs page → iframe: focus the first stop
  start: "craftui:preview-keyboard-start",
  // iframe → docs page: a StopsReport
  stops: "craftui:preview-keyboard-stops",
} as const;

export interface StopIssue {
  // "4.1.2 Name, Role, Value"
  criterion: string;
  text: string;
}

export interface StopInfo {
  issues: StopIssue[];
  name: string;
  role: string;
  states: string[];
}

export interface StopsReport {
  // Stops with at least one issue.
  flagged: number;
  total: number;
}

export interface FocusReport extends StopInfo {
  // 1-based position in Tab order; 0 when focus is on something that isn't
  // a Tab stop (focused by script, tabindex="-1").
  index: number;
  total: number;
}

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "iframe",
  "summary",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]",
].join(",");

const isRendered = (element: HTMLElement) =>
  typeof element.checkVisibility === "function"
    ? element.checkVisibility({ visibilityProperty: true })
    : element.getClientRects().length > 0;

const isTabStop = (element: HTMLElement) =>
  element.tabIndex >= 0 &&
  !(element as HTMLButtonElement).disabled &&
  !element.closest("[inert]") &&
  isRendered(element);

// Tab order: positive tabindex first (ascending, then document order),
// then tabindex 0 in document order. A radio group is one stop: its
// checked radio, or its first.
export const findTabStops = (root: ParentNode = document) => {
  const candidates = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    isTabStop
  );
  const radioSeen = new Set<string>();
  const stops = candidates.filter((element) => {
    if (!(element instanceof HTMLInputElement) || element.type !== "radio") {
      return true;
    }
    const group = `${element.form?.id ?? ""}:${element.name}`;
    if (!element.name) {
      return true;
    }
    const checked = root.querySelector<HTMLInputElement>(
      `input[type='radio'][name='${CSS.escape(element.name)}']:checked`
    );
    if (checked ? checked !== element : radioSeen.has(group)) {
      return false;
    }
    radioSeen.add(group);
    return true;
  });
  const positive = stops
    .filter((element) => element.tabIndex > 0)
    .toSorted((a, b) => a.tabIndex - b.tabIndex);
  return [...positive, ...stops.filter((element) => element.tabIndex === 0)];
};

const INPUT_ROLES: Record<string, string> = {
  button: "button",
  checkbox: "checkbox",
  email: "textbox",
  image: "button",
  number: "spinbutton",
  password: "textbox",
  radio: "radio",
  range: "slider",
  reset: "button",
  search: "searchbox",
  submit: "button",
  tel: "textbox",
  text: "textbox",
  url: "textbox",
};

const roleOf = (element: HTMLElement) => {
  const explicit = element.getAttribute("role")?.trim().split(/\s+/)[0];
  if (explicit) {
    return explicit;
  }
  const tag = element.tagName.toLowerCase();
  if (tag === "a" || tag === "area") {
    return "link";
  }
  if (tag === "button" || tag === "summary") {
    return "button";
  }
  if (element instanceof HTMLInputElement) {
    return INPUT_ROLES[element.type] ?? "textbox";
  }
  if (element instanceof HTMLSelectElement) {
    return element.multiple || element.size > 1 ? "listbox" : "combobox";
  }
  if (tag === "textarea" || element.isContentEditable) {
    return "textbox";
  }
  if (tag === "iframe") {
    return "iframe";
  }
  if (tag === "audio" || tag === "video") {
    return tag;
  }
  return "generic";
};

const isHiddenFromAll = (element: Element) =>
  element.getAttribute("aria-hidden") === "true" ||
  (element instanceof HTMLElement && element.hidden);

const squash = (text: string) => text.replaceAll(/\s+/g, " ").trim();

// The text a subtree contributes to a name: text nodes, images' alt, an
// SVG's <title>, and named descendants' aria-label; hidden parts skipped.
const textOf = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (!(node instanceof Element) || isHiddenFromAll(node)) {
    return "";
  }
  const label = node.getAttribute("aria-label");
  if (label?.trim()) {
    return ` ${label} `;
  }
  if (node instanceof HTMLImageElement) {
    return ` ${node.alt} `;
  }
  if (node instanceof SVGElement && node.tagName.toLowerCase() === "svg") {
    return ` ${node.querySelector("title")?.textContent ?? ""} `;
  }
  if (
    node instanceof HTMLElement &&
    getComputedStyle(node).display === "none"
  ) {
    return "";
  }
  return [...node.childNodes].map(textOf).join("");
};

const labelledBy = (element: HTMLElement) => {
  const ids = element.getAttribute("aria-labelledby")?.trim();
  if (!ids) {
    return "";
  }
  return squash(
    ids
      .split(/\s+/)
      .map((id) => {
        const target = document.querySelector(`#${CSS.escape(id)}`);
        return target ? textOf(target) : "";
      })
      .join(" ")
  );
};

const NAME_FROM_CONTENT = new Set([
  "button",
  "checkbox",
  "link",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "switch",
  "tab",
  "treeitem",
]);

type NameSource =
  | "aria-label"
  | "content"
  | "label"
  | "labelledby"
  | "none"
  | "placeholder"
  | "title";

interface Named {
  from: NameSource;
  name: string;
}

// A form field's name from its <label>s, or a button-like input's value.
const fieldName = (
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): Named | null => {
  const labels = element.labels ? [...element.labels] : [];
  const fromLabels = squash(labels.map(textOf).join(" "));
  if (fromLabels) {
    return { from: "label", name: fromLabels };
  }
  if (!(element instanceof HTMLInputElement)) {
    return null;
  }
  if (element.type === "image") {
    return { from: "content", name: squash(element.alt) };
  }
  if (["button", "submit", "reset"].includes(element.type)) {
    const value = element.value || (element.type === "submit" ? "Submit" : "");
    return value ? { from: "content", name: value } : null;
  }
  return null;
};

const isField = (
  element: HTMLElement
): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLSelectElement ||
  element instanceof HTMLTextAreaElement;

// The accessible name, and where it came from: aria-labelledby, aria-label,
// a field's label or a control's own text, then title, then placeholder.
const nameOf = (element: HTMLElement, role: string): Named => {
  const byIds = labelledBy(element);
  if (byIds) {
    return { from: "labelledby", name: byIds };
  }
  const label = squash(element.getAttribute("aria-label") ?? "");
  if (label) {
    return { from: "aria-label", name: label };
  }
  if (isField(element)) {
    const named = fieldName(element);
    if (named?.name) {
      return named;
    }
  } else if (NAME_FROM_CONTENT.has(role) || role === "generic") {
    const content = squash(textOf(element));
    if (content) {
      return { from: "content", name: content };
    }
  }
  const title = squash(element.title);
  if (title) {
    return { from: "title", name: title };
  }
  const placeholder = squash(element.getAttribute("placeholder") ?? "");
  return placeholder
    ? { from: "placeholder", name: placeholder }
    : { from: "none", name: "" };
};

// A value's own wording if it has one (null for "say nothing"), else the
// fallback.
const pick = (
  value: string,
  words: Record<string, string | null>,
  fallback: string
) => (Object.hasOwn(words, value) ? words[value] : fallback);

// aria-expanded, -pressed, -checked (or a native checkbox's), -selected,
// -current, -disabled and -haspopup, as a screen reader would say them.
const ariaStates = (element: HTMLElement) => {
  const aria = (key: string) => element.getAttribute(`aria-${key}`);
  const said: Record<string, (value: string) => string | null> = {
    checked: (value) => (value === "true" ? "checked" : "not checked"),
    current: (value) =>
      pick(value, { false: null, true: "current" }, `current ${value}`),
    disabled: (value) => (value === "true" ? "unavailable" : null),
    expanded: (value) => (value === "true" ? "expanded" : "collapsed"),
    haspopup: (value) =>
      value === "false" ? null : `opens a ${value === "true" ? "menu" : value}`,
    pressed: (value) =>
      pick(value, { false: null, mixed: "partly pressed" }, "pressed"),
    selected: (value) => (value === "true" ? "selected" : null),
  };
  const native =
    element instanceof HTMLInputElement &&
    (element.type === "checkbox" || element.type === "radio")
      ? String(element.checked)
      : null;
  return Object.entries(said).flatMap(([key, say]) => {
    const value = aria(key) ?? (key === "checked" ? native : null);
    const text = value === null ? null : say(value);
    return text ? [text] : [];
  });
};

// A slider's value, and whether the field is required.
const valueStates = (element: HTMLElement) => {
  const states: string[] = [];
  const value =
    element.getAttribute("aria-valuetext") ??
    element.getAttribute("aria-valuenow") ??
    (element instanceof HTMLInputElement && element.type === "range"
      ? element.value
      : null);
  if (value) {
    states.push(`value ${value}`);
  }
  if (
    (element as HTMLInputElement).required ||
    element.getAttribute("aria-required") === "true"
  ) {
    states.push("required");
  }
  return states;
};

const statesOf = (element: HTMLElement) => [
  ...ariaStates(element),
  ...valueStates(element),
];

// The text a sighted user sees on the control (hidden parts left out).
const visibleText = (element: HTMLElement) =>
  squash(textOf(element)).toLowerCase();

export const describeStop = (element: HTMLElement): StopInfo => {
  const role = roleOf(element);
  const { from, name } = nameOf(element, role);
  const issues: StopIssue[] = [];
  if (!name && role !== "iframe") {
    issues.push({
      criterion: "4.1.2 Name, Role, Value",
      text: "No accessible name: a screen reader announces only its role",
    });
  }
  if (role === "generic") {
    issues.push({
      criterion: "4.1.2 Name, Role, Value",
      text: "Focusable but has no role: give it a native element or a role",
    });
  }
  if (element.tabIndex > 0) {
    issues.push({
      criterion: "2.4.3 Focus Order",
      text: `tabindex="${element.tabIndex}" moves it out of the page's Tab order`,
    });
  }
  if (element.closest("[aria-hidden='true']")) {
    issues.push({
      criterion: "4.1.2 Name, Role, Value",
      text: "Focusable inside aria-hidden: reachable by Tab, silent to screen readers",
    });
  }
  if (from === "placeholder") {
    issues.push({
      criterion: "3.3.2 Labels or Instructions",
      text: "Named only by its placeholder, which disappears as you type",
    });
  }
  if (from === "aria-label" || from === "labelledby") {
    const shown = visibleText(element);
    if (shown && shown.length < 60 && !name.toLowerCase().includes(shown)) {
      issues.push({
        criterion: "2.5.3 Label in Name",
        text: `Its name doesn't include the text it shows ("${shown}"), so voice control can't find it`,
      });
    }
  }
  return { issues, name, role, states: statesOf(element) };
};
