"use client";

import {
  BlueskyIcon,
  GithubIcon,
  Globe02Icon,
  InstagramIcon,
  Linkedin01Icon,
  NewTwitterIcon,
  TiktokIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence } from "motion/react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { DoneNote, Reveal } from "./motion";
import { StatusButton } from "./status-button";
import { RING, RING_BUTTON } from "./surface";

/* ─────────────────────────────────────────────────────────
 * SOCIAL LINKS: one row per network, each saved on its own.
 *
 *   [ⓘ Instagram]
 *   [instagram.com/ | samdavies        ]
 *
 * The site's address is a fixed prefix, so people type only their
 * username; pasting a whole link ("https://www.instagram.com/samdavies/
 * ?hl=en") is trimmed to the username. Changing a row opens its Cancel /
 * Save (Reveal, 210ms); Save is a StatusButton (its label rolls up to a
 * spinner while saving, fixed width), then the row folds shut and shows
 * "Saved" for 2s. An empty row is fine: it simply isn't shown on the
 * profile.
 * Icons are one-colour marks: a list of eight brand colours would shout.
 * ───────────────────────────────────────────────────────── */

/** A network the profile can link to. */
export interface SocialNetwork {
  /** Unique id, also the key in the saved values, e.g. "instagram". */
  id: string;
  /** Name shown above the field, e.g. "Instagram". */
  label: string;
  /** A Hugeicons icon from `@hugeicons/core-free-icons`. */
  icon: typeof InstagramIcon;
  /**
   * The address before the username, shown in the field, e.g.
   * "instagram.com/". Leave out for a free web address (Website).
   */
  prefix?: string;
  /** Example shown in the empty field, e.g. "username". */
  placeholder: string;
}

export const DEFAULT_SOCIAL_NETWORKS: SocialNetwork[] = [
  {
    icon: NewTwitterIcon,
    id: "x",
    label: "X",
    placeholder: "username",
    prefix: "x.com/",
  },
  {
    icon: InstagramIcon,
    id: "instagram",
    label: "Instagram",
    placeholder: "username",
    prefix: "instagram.com/",
  },
  {
    icon: Linkedin01Icon,
    id: "linkedin",
    label: "LinkedIn",
    placeholder: "your-name",
    prefix: "linkedin.com/in/",
  },
  {
    icon: GithubIcon,
    id: "github",
    label: "GitHub",
    placeholder: "username",
    prefix: "github.com/",
  },
  {
    icon: YoutubeIcon,
    id: "youtube",
    label: "YouTube",
    placeholder: "channel",
    prefix: "youtube.com/@",
  },
  {
    icon: TiktokIcon,
    id: "tiktok",
    label: "TikTok",
    placeholder: "username",
    prefix: "tiktok.com/@",
  },
  {
    icon: BlueskyIcon,
    id: "bluesky",
    label: "Bluesky",
    placeholder: "name.bsky.social",
    prefix: "bsky.app/profile/",
  },
  {
    icon: Globe02Icon,
    id: "website",
    label: "Website",
    placeholder: "https://example.com",
  },
];

const HANDLE = /^[\w.-]{1,60}$/;
const WEB = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i;

// What someone typed or pasted, as the part after the prefix.
const normalise = (raw: string, prefix?: string) => {
  const value = raw.trim();
  if (!prefix) {
    return value;
  }
  const bare = value.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const host = prefix.split("/")[0] ?? "";
  if (host && bare.toLowerCase().startsWith(host.toLowerCase())) {
    const rest = bare.slice(host.length).replace(/^\/+/, "");
    const path = prefix.slice(host.length + 1);
    const trimmed = rest.startsWith(path) ? rest.slice(path.length) : rest;
    return trimmed.split(/[/?#]/)[0]?.replace(/^@/, "") ?? "";
  }
  return value.replace(/^@/, "");
};

const errorFor = (value: string, network: SocialNetwork) => {
  if (value === "") {
    return null;
  }
  if (network.prefix) {
    return HANDLE.test(value)
      ? null
      : "Use letters, numbers, dots, dashes or underscores";
  }
  return WEB.test(value) ? null : "Enter a web address like example.com";
};

const SocialRow = ({
  network,
  onSave,
  saved,
}: {
  network: SocialNetwork;
  onSave: (id: string, value: string) => Promise<void>;
  saved: string;
}) => {
  const id = useId();
  const [stored, setStored] = useState(saved);
  const [value, setValue] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [doneStamp, setDoneStamp] = useState(0);
  const dirty = value !== stored;
  const error = errorFor(value, network);

  const save = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await onSave(network.id, value);
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    setBusy(false);
    setStored(value);
    setDoneStamp(Date.now());
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty && !error && !busy) {
          save();
        }
      }}
    >
      <label
        htmlFor={id}
        className="flex items-center gap-2 text-sm font-medium"
      >
        <HugeiconsIcon
          icon={network.icon}
          strokeWidth={1.75}
          className="text-muted-foreground size-4"
        />
        {network.label}
      </label>
      <div
        className={cn(
          RING,
          "dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex h-9 items-center rounded-md bg-transparent transition-[color,box-shadow] focus-within:ring-[3px]",
          error && "border-destructive"
        )}
      >
        {network.prefix ? (
          <span className="text-muted-foreground shrink-0 pl-3 text-sm select-none">
            {network.prefix}
          </span>
        ) : null}
        <Input
          id={id}
          value={value}
          placeholder={network.placeholder}
          inputMode={network.prefix ? "text" : "url"}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) =>
            setValue(normalise(event.target.value, network.prefix))
          }
          // Override: the box around it draws the ring and focus.
          className={cn(
            "h-full min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent",
            network.prefix && "pl-0.5"
          )}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
      <AnimatePresence initial={false}>
        {dirty ? (
          <Reveal key="actions" className="flex flex-col gap-2 pt-1">
            {failed ? (
              <p aria-live="polite" className="text-destructive text-xs">
                Link not saved. Check your connection and try again.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={RING_BUTTON}
                disabled={busy}
                onClick={() => {
                  setValue(stored);
                  setFailed(false);
                }}
              >
                Cancel
              </Button>
              <StatusButton
                type="submit"
                size="sm"
                // Busy stays at full colour (aria-disabled), not dimmed.
                disabled={!busy && Boolean(error)}
                state={busy ? "busy" : "idle"}
                labels={{ busy: `Saving ${network.label}…`, idle: "Save" }}
              />
            </div>
          </Reveal>
        ) : null}
      </AnimatePresence>
      <DoneNote stamp={doneStamp} hideAfter={2000}>
        Saved
      </DoneNote>
    </form>
  );
};

export const SocialLinks = ({
  networks,
  onSave,
  values,
}: {
  networks: SocialNetwork[];
  onSave: (id: string, value: string) => Promise<void>;
  values: Record<string, string>;
}) => (
  <div className="flex flex-col gap-5">
    {networks.map((network) => (
      <SocialRow
        key={network.id}
        network={network}
        saved={values[network.id] ?? ""}
        onSave={onSave}
      />
    ))}
  </div>
);
