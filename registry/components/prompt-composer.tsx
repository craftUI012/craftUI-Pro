"use client";

/* oxlint-disable react/no-array-index-key, eslint/complexity -- the demo lists are static and complex compound selector components */

import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  File,
  Folder,
  Globe,
  Image,
  Mic,
  Plus,
  ShieldCheck,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ComponentProps, RefObject } from "react";

import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * Prompt composer. The input surface of an AI assistant: a capsule with
 * Enter to send and a voice button, a quick-prompts tray that unfolds above
 * it, and a footer row for attachments, permission mode, model, reasoning
 * depth and usage limits. Fully customizable via props.
 * ───────────────────────────────────────────────────────────────────────── */

/* ── Exported Types & Defaults ─────────────────────────────────────────── */

export interface ModelDepth {
  id: string;
  label: string;
}

export interface Model {
  id: string;
  name: string;
  description: string;
  speed: string;
  depths: ModelDepth[];
}

export interface PermissionMode {
  id: string;
  label: string;
  subtitle: string;
}

export interface UsageLimit {
  id: string;
  label: string;
  percentLeft: number;
  resetLabel: string;
}

export interface ComposerAttachment {
  id: string;
  name: string;
  type: AddAttachmentType;
  size?: string;
  file?: globalThis.File;
}

export type AddAttachmentType =
  | "file"
  | "image"
  | "folders"
  | "browser"
  | "commands";

export const DEFAULT_PRE_PROMPTS = [
  "Summarize key updates from this week.",
  "Help me draft a concise announcement.",
  "Review my draft and suggest improvements.",
  "Brainstorm ideas for our next launch.",
  "Explain this concept in simple terms.",
  "What tasks should I prioritize today?",
];

export const DEFAULT_MODELS: Model[] = [
  {
    depths: [
      { id: "quick", label: "Quick" },
      { id: "standard", label: "Standard" },
      { id: "extended", label: "Extended" },
    ],
    description:
      "OpenAI's flagship chatbot. All-rounder with the broadest feature set.",
    id: "chatgpt",
    name: "ChatGPT",
    speed: "Standard",
  },
  {
    depths: [
      { id: "quick", label: "Quick" },
      { id: "standard", label: "Standard" },
      { id: "extended", label: "Extended" },
      { id: "maximum", label: "Maximum" },
    ],
    description:
      "Anthropic's careful, long-context model. Strong at writing and coding.",
    id: "claude",
    name: "Claude",
    speed: "Deep",
  },
  {
    depths: [
      { id: "quick", label: "Quick" },
      { id: "standard", label: "Standard" },
    ],
    description:
      "Google's multimodal model, built into Android, Gmail and Search.",
    id: "gemini",
    name: "Gemini",
    speed: "Fast",
  },
  {
    depths: [
      { id: "quick", label: "Quick" },
      { id: "standard", label: "Standard" },
      { id: "extended", label: "Extended" },
    ],
    description:
      "Open-weight reasoning model at very low cost. Strong at math and code.",
    id: "deepseek",
    name: "DeepSeek",
    speed: "Fast",
  },
];

export const DEFAULT_PERMISSION_MODES: PermissionMode[] = [
  {
    id: "auto-approve",
    label: "Auto-approve",
    subtitle:
      "Asks for confirmation before modifying records or sending communications.",
  },
  {
    id: "full-access",
    label: "Full access",
    subtitle:
      "Runs all actions, data updates, and workflows without prompting.",
  },
];

export const DEFAULT_USAGE_LIMITS: UsageLimit[] = [
  {
    id: "5hr",
    label: "5hr limit",
    percentLeft: 56,
    resetLabel: "Resets in 2h 14m",
  },
  {
    id: "weekly",
    label: "Weekly limit",
    percentLeft: 82,
    resetLabel: "Resets Monday at 9:00 AM",
  },
];

/* ── Shared primitives ──────────────────────────────────────────────────── */

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const useDismissOnOutside = (
  ref: RefObject<HTMLDivElement | null>,
  onDismiss: () => void
) => {
  const handlerRef = useRef(onDismiss);

  useEffect(() => {
    handlerRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handlerRef.current();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref]);
};

const CircularProgress = ({
  value = 56,
  size = 10,
  strokeWidth = 1.5,
  className,
}: {
  value?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0 -rotate-90", className)}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className="stroke-border"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className="stroke-emerald-500 transition-[stroke-dashoffset] duration-300 ease-out"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
};

const HoverIndicator = ({
  layoutId,
  rounded = "rounded-lg",
  bg = "bg-accent",
}: {
  layoutId: string;
  rounded?: string;
  bg?: string;
}) => (
  <motion.div
    layoutId={layoutId}
    layout="position"
    className={cn("pointer-events-none absolute inset-0", bg, rounded)}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.16, ease: "easeOut" }}
  />
);

const QuickPromptsIndicator = ({
  layoutId,
  rounded = "rounded-2xl",
}: {
  layoutId: string;
  rounded?: string;
}) => (
  <motion.div
    layoutId={layoutId}
    layout="position"
    className={cn(
      "pointer-events-none absolute inset-0 flex items-center justify-end bg-foreground/5 dark:bg-foreground/10",
      rounded
    )}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.16, ease: "easeOut" }}
  />
);

/* ── Input capsule buttons ──────────────────────────────────────────────── */

const MicButton = ({
  isListening,
  onToggle,
}: {
  isListening?: boolean;
  onToggle?: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    className={cn(
      "flex p-2 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all duration-150 ease-out select-none",
      isListening
        ? "bg-foreground/10 text-foreground ring-1 ring-inset ring-foreground/20 dark:ring-foreground/30"
        : "text-muted-foreground hover:bg-foreground/5 dark:hover:bg-foreground/10 hover:text-foreground"
    )}
    title={isListening ? "Stop listening" : "Voice input"}
    aria-label={isListening ? "Stop listening" : "Voice input"}
    aria-pressed={isListening}
  >
    <Mic width={14} height={14} strokeWidth={2} color="currentColor" />
  </button>
);

const ListeningWave = () => {
  const bars = [
    { delay: 0, duration: 0.6, maxScale: 1, minScale: 0.25 },
    { delay: 0.15, duration: 0.5, maxScale: 1.15, minScale: 0.35 },
    { delay: 0.3, duration: 0.7, maxScale: 0.85, minScale: 0.2 },
    { delay: 0.1, duration: 0.55, maxScale: 1.25, minScale: 0.4 },
    { delay: 0.25, duration: 0.65, maxScale: 0.95, minScale: 0.3 },
  ];

  return (
    <div className="flex h-6 items-center gap-1 px-2 select-none">
      {bars.map((bar, i) => (
        <motion.span
          key={i}
          className="h-4 w-0.5 origin-center rounded-full bg-foreground/70"
          initial={{ scaleY: bar.minScale }}
          animate={{ scaleY: [bar.minScale, bar.maxScale, bar.minScale] }}
          transition={{
            delay: bar.delay,
            duration: bar.duration,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      ))}
      <span className="ml-2 text-base text-muted-foreground animate-pulse">
        Listening...
      </span>
    </div>
  );
};

const SendButton = ({
  onClick,
  disabled = false,
}: {
  onClick?: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex p-2 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary px-4 text-primary-foreground shadow-xs ring-1 ring-inset ring-black/40 duration-150 ease-out hover:bg-primary/90",
      disabled && "opacity-50 cursor-not-allowed hover:bg-primary"
    )}
    title="Send"
  >
    <CornerDownLeft
      width={14}
      height={14}
      strokeWidth={2}
      color="currentColor"
      className="text-primary-foreground"
    />
  </button>
);

/* ── Attachments ────────────────────────────────────────────────────────── */

interface AddAttachmentOption {
  id: AddAttachmentType;
  label: string;
  icon: LucideIcon;
}

const ADD_ATTACHMENT_OPTIONS: AddAttachmentOption[] = [
  { icon: File, id: "file", label: "File" },
  { icon: Image, id: "image", label: "Image" },
  { icon: Folder, id: "folders", label: "Folders" },
  { icon: Globe, id: "browser", label: "Browser" },
  { icon: Terminal, id: "commands", label: "Commands" },
];

const AttachmentMenuItem = ({
  option,
  isHovered,
  onHover,
  onSelect,
}: {
  option: AddAttachmentOption;
  isHovered: boolean;
  onHover: () => void;
  onSelect: () => void;
}) => {
  const IconComponent = option.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      className="group text-xs relative flex w-full cursor-pointer items-center rounded-xl px-2 py-1.5 text-left font-normal text-muted-foreground transition-colors duration-150 ease-out select-none hover:text-foreground"
    >
      <AnimatePresence>
        {isHovered && (
          <HoverIndicator
            layoutId="v2-add-menu-hover-indicator"
            rounded="rounded-xl"
            bg="bg-accent"
          />
        )}
      </AnimatePresence>
      <span className="relative z-10 flex items-center gap-2">
        <IconComponent
          width={13}
          height={13}
          strokeWidth={1.5}
          className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        />
        <span className="leading-snug">{option.label}</span>
      </span>
    </button>
  );
};

export interface AddAttachmentDropdownProps {
  /** Called when an attachment option is chosen. */
  onSelect: (type: AddAttachmentType) => void;
  /** Extra class names for the trigger container. */
  className?: string;
}

export const AddAttachmentDropdown = ({
  onSelect,
  className,
}: AddAttachmentDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHoveredIndex(null);
      }
    };
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setHoveredIndex(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={cn("relative flex items-center", className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex p-2 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors select-none hover:bg-accent hover:text-foreground",
          open && "bg-accent text-foreground"
        )}
        title="Add attachment"
        aria-label="Add attachment"
        aria-expanded={open}
      >
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="flex items-center justify-center"
        >
          <Plus width={14} height={14} strokeWidth={2} className="shrink-0" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="add-attachment-menu"
            initial={{
              opacity: 0,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              scale: 0.96,
            }}
            transition={{
              duration: 0.16,
              ease: [0.23, 1, 0.32, 1],
            }}
            style={{
              transform: "translateZ(0)",
              willChange: "transform, opacity",
            }}
            className="absolute bottom-full left-0 z-50 mb-1.5 w-44 origin-bottom-left rounded-2xl bg-popover p-1.5 shadow-[0_4px_16px_rgb(0_0_0/0.12),0_12px_32px_rgb(0_0_0/0.18)] max-w-[calc(100vw-2rem)] will-change-transform select-none"
          >
            <div
              className="space-y-0.5"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {ADD_ATTACHMENT_OPTIONS.map((option, index) => (
                <AttachmentMenuItem
                  key={option.id}
                  option={option}
                  isHovered={hoveredIndex === index}
                  onHover={() => setHoveredIndex(index)}
                  onSelect={() => {
                    onSelect(option.id);
                    setOpen(false);
                    setHoveredIndex(null);
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Attachment Pills Preview ───────────────────────────────────────────── */

const AttachmentPill = ({
  attachment,
  onRemove,
}: {
  attachment: ComposerAttachment;
  onRemove: (id: string) => void;
}) => {
  const getIcon = () => {
    switch (attachment.type) {
      case "image": {
        return Image;
      }
      case "folders": {
        return Folder;
      }
      case "browser": {
        return Globe;
      }
      case "commands": {
        return Terminal;
      }
      default: {
        return File;
      }
    }
  };

  const IconComp = getIcon();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/5 dark:bg-foreground/10 px-2 py-1 text-xs text-foreground select-none"
    >
      <IconComp className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="max-w-[120px] sm:max-w-[160px] truncate">
        {attachment.name}
      </span>
      {attachment.size && (
        <span className="text-[10px] text-muted-foreground">
          {attachment.size}
        </span>
      )}
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className="ml-0.5 -mr-0.5 p-0.5 rounded-sm hover:bg-foreground/10 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        title="Remove attachment"
        aria-label={`Remove ${attachment.name}`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </motion.div>
  );
};

/* ── Quick prompts ──────────────────────────────────────────────────────── */

const QuickPromptItem = ({
  prompt,
  isHovered,
  onHover,
  onSelect,
}: {
  prompt: string;
  isHovered: boolean;
  onHover: () => void;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    onMouseEnter={onHover}
    className="group text-sm relative flex w-full cursor-pointer items-center justify-between rounded-2xl p-2 text-left font-normal text-muted-foreground transition-colors duration-150 ease-out select-none hover:text-foreground"
  >
    {/* Unified Hover Container: moving indicator pill (no enter icon) */}
    <AnimatePresence>
      {isHovered && (
        <QuickPromptsIndicator layoutId="v2-quick-prompts-indicator" />
      )}
    </AnimatePresence>

    <span className="relative z-10 truncate text-xs sm:text-sm">{prompt}</span>

    {/* Space reservation so text never overlaps the icon */}
    <div className="pointer-events-none ml-2 h-3.5 w-3.5 shrink-0 opacity-0" />
  </button>
);

export const QuickPromptsDropdown = ({
  isVisible = true,
  prompts = DEFAULT_PRE_PROMPTS,
  onSelectPrompt,
}: {
  isVisible?: boolean;
  prompts?: string[];
  onSelectPrompt?: (prompt: string) => void;
}) => {
  const [promptsExpanded, setPromptsExpanded] = useState<boolean>(false);
  const [hoveredPrompt, setHoveredPrompt] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLButtonElement>(null);
  const isInitialMount = useRef<boolean>(true);

  // Store the exact pixel insets required to crop the full box down to the header pill
  const [cropInsets, setCropInsets] = useState<{
    top: number;
    right: number;
  } | null>(null);

  const measure = () => {
    if (!containerRef.current || !headerRef.current) {
      return;
    }
    const container = containerRef.current;
    const header = headerRef.current;

    const containerRect = container.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();

    const leftPadding = Math.max(0, headerRect.left - containerRect.left);
    const bottomPadding = Math.max(0, containerRect.bottom - headerRect.bottom);

    // Exact top inset to crop down to the top of the header pill with matching top padding
    const topInset = Math.max(
      0,
      headerRect.top - containerRect.top - bottomPadding
    );
    // Exact right inset to crop in to the right of the header pill with matching right padding
    const collapsedWidth = headerRect.width + leftPadding * 2;
    const rightInset = Math.max(0, containerRect.width - collapsedWidth);

    setCropInsets({
      right: Math.round(rightInset),
      top: Math.round(topInset),
    });
  };

  useIsomorphicLayoutEffect(() => {
    measure();
    if (typeof document !== "undefined" && document.fonts) {
      const onFontsReady = async () => {
        await document.fonts.ready;
        measure();
      };
      void onFontsReady();
    }
    const timer = setTimeout(() => {
      isInitialMount.current = false;
    }, 60);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const handleToggle = () => {
    isInitialMount.current = false;
    measure();
    setPromptsExpanded((prev) => !prev);
  };

  const collapsedClipPath = cropInsets
    ? `inset(${cropInsets.top}px ${cropInsets.right}px 0px 0px round 16px)`
    : "inset(100% 100% 0px 0px round 16px)";
  const clipPath = promptsExpanded
    ? "inset(0px 0px 0px 0px round 16px)"
    : collapsedClipPath;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] },
            y: 6,
          }}
          className="pointer-events-none absolute bottom-full left-0 z-20 mb-2"
        >
          {/*
            Look closely at the geometry:
            When collapsed, the box sits at `bottom-0 left-0`.
            As it expands, the WHOLE container translates upward smoothly while `clipPath`
            unveils the bottom and right edges with a live 16px border radius!
          */}
          <motion.div
            ref={containerRef}
            initial={false}
            animate={{ clipPath }}
            transition={
              isInitialMount.current
                ? { duration: 0 }
                : {
                    duration: 0.25,
                    ease: [0.23, 1, 0.32, 1],
                  }
            }
            style={{
              opacity: cropInsets ? 1 : 0,
            }}
            className={cn(
              "pointer-events-auto w-max max-w-[calc(100vw-3rem)] sm:max-w-[600px] rounded-3xl p-2 transition-colors duration-250 ease-out",
              promptsExpanded ? "bg-muted" : "bg-transparent"
            )}
          >
            {/* Prompts list: Placed ABOVE the title Quick Prompts. Stays in DOM so clipPath physically slices through on exit */}
            <div
              onMouseLeave={() => setHoveredPrompt(null)}
              className={cn(
                "flex w-full flex-col space-y-0.5 pb-0.5",
                !promptsExpanded && "pointer-events-none"
              )}
            >
              {prompts.map((prompt, idx) => (
                <QuickPromptItem
                  key={prompt}
                  prompt={prompt}
                  isHovered={hoveredPrompt === idx}
                  onHover={() => setHoveredPrompt(idx)}
                  onSelect={() => onSelectPrompt?.(prompt)}
                />
              ))}
            </div>

            {/* Header: Fixed at bottom-left */}
            <button
              className="group flex w-max pt-2 cursor-pointer items-center gap-1 px-2 py-1 select-none"
              onClick={handleToggle}
              ref={headerRef}
              type="button"
            >
              <span className="text-sm font-normal whitespace-nowrap text-muted-foreground transition-colors duration-150 ease-out group-hover:text-foreground ">
                Quick prompts
              </span>
              <span className="pointer-events-none flex shrink-0 items-center justify-center p-0.5 text-muted-foreground transition-colors duration-150 ease-out group-hover:text-foreground">
                <motion.span
                  animate={{ rotate: promptsExpanded ? 180 : 0 }}
                  className="flex"
                  initial={false}
                  transition={
                    isInitialMount.current
                      ? { duration: 0 }
                      : { duration: 0.25, ease: [0.23, 1, 0.32, 1] }
                  }
                >
                  <ChevronDown width={14} height={14} strokeWidth={2} />
                </motion.span>
              </span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ── Permission (access) selector ───────────────────────────────────────── */

const PermissionMenuItem = ({
  mode,
  isActive,
  isHovered,
  subtitleVisible,
  onHover,
  onLeave,
  onSelect,
}: {
  mode: PermissionMode;
  isActive: boolean;
  isHovered: boolean;
  subtitleVisible: boolean;
  onHover: () => void;
  onLeave: () => void;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    className={cn(
      "group text-xs relative flex w-full cursor-pointer flex-col rounded-xl p-2 text-left transition-colors select-none",
      isActive
        ? "text-foreground"
        : "text-muted-foreground hover:text-foreground"
    )}
  >
    <AnimatePresence>
      {isHovered && (
        <HoverIndicator
          layoutId="v2-permission-hover-indicator"
          rounded="rounded-xl"
          bg="bg-accent"
        />
      )}
    </AnimatePresence>
    <div className="relative z-10 flex w-full items-center gap-2">
      {mode.id === "full-access" ? (
        <Zap size={12} className="shrink-0 text-destructive" />
      ) : (
        <ShieldCheck size={12} className="shrink-0 text-muted-foreground" />
      )}
      <div
        className={cn(
          "text-xs font-medium",
          mode.id === "full-access" ? "text-destructive" : "text-foreground"
        )}
      >
        {mode.label}
      </div>
    </div>
    {subtitleVisible && (
      <div className="absolute left-full top-0 z-50 ml-2 w-44 rounded-lg bg-popover p-2 text-xs leading-snug font-normal text-muted-foreground shadow-[0_4px_16px_rgb(0_0_0/0.12),0_12px_32px_rgb(0_0_0/0.18)]">
        {mode.subtitle}
      </div>
    )}
  </button>
);

interface PermissionSelectorProps {
  modes?: PermissionMode[];
  selectedModeId?: string;
  onSelectMode?: (id: string) => void;
}

const PermissionSelector = ({
  modes = DEFAULT_PERMISSION_MODES,
  selectedModeId,
  onSelectMode,
}: PermissionSelectorProps) => {
  const [internalModeId, setInternalModeId] = useState<string>(
    selectedModeId ?? modes[0]?.id ?? "auto-approve"
  );
  const [permissionDropdownOpen, setPermissionDropdownOpen] = useState(false);
  const [hoveredPermission, setHoveredPermission] = useState<string | null>(
    null
  );
  const [permissionSubtitleVisible, setPermissionSubtitleVisible] =
    useState(false);
  const permissionSubtitleTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const permissionDropdownRef = useRef<HTMLDivElement>(null);

  const activeModeId = selectedModeId ?? internalModeId;

  useDismissOnOutside(permissionDropdownRef, () => {
    setPermissionDropdownOpen(false);
    setHoveredPermission(null);
  });

  useEffect(
    () => () => {
      if (permissionSubtitleTimerRef.current) {
        clearTimeout(permissionSubtitleTimerRef.current);
      }
    },
    []
  );

  const currentPermission =
    modes.find((p) => p.id === activeModeId) || modes[0];

  const handleModeHover = (modeId: string) => {
    setHoveredPermission(modeId);
    if (permissionSubtitleTimerRef.current) {
      clearTimeout(permissionSubtitleTimerRef.current);
    }
    permissionSubtitleTimerRef.current = setTimeout(() => {
      setPermissionSubtitleVisible(true);
    }, 1000);
  };

  const handleModeLeave = (modeId: string) => {
    if (permissionSubtitleTimerRef.current) {
      clearTimeout(permissionSubtitleTimerRef.current);
    }
    if (hoveredPermission === modeId) {
      setHoveredPermission(null);
    }
    setPermissionSubtitleVisible(false);
  };

  const handleSelect = (modeId: string) => {
    setInternalModeId(modeId);
    onSelectMode?.(modeId);
    setPermissionDropdownOpen(false);
  };

  return (
    <div className="relative flex items-center" ref={permissionDropdownRef}>
      <button
        type="button"
        onClick={() => setPermissionDropdownOpen((prev) => !prev)}
        className={cn(
          "text-sm flex cursor-pointer items-center gap-2 rounded-full border-none bg-transparent px-2 py-2 font-normal transition-colors select-none hover:bg-foreground/5 dark:hover:bg-foreground/10",
          activeModeId === "full-access"
            ? "text-destructive hover:text-destructive/90"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {activeModeId === "full-access" ? (
          <Zap size={14} className="shrink-0" />
        ) : (
          <ShieldCheck size={14} className="shrink-0" />
        )}
        <span className="leading-none">{currentPermission?.label}</span>
        <ChevronDown
          width={14}
          height={14}
          strokeWidth={2}
          className={cn(
            "shrink-0 transition-transform",
            activeModeId === "full-access"
              ? "text-destructive"
              : "text-muted-foreground",
            permissionDropdownOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu: Appears UP aligned to left (`left-0 bottom-full mb-1.5`) */}
      <AnimatePresence>
        {permissionDropdownOpen && (
          <motion.div
            key="permission-dropdown-menu"
            onClick={(e) => e.stopPropagation()}
            onMouseLeave={() => setHoveredPermission(null)}
            initial={{
              opacity: 0,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              scale: 0.96,
            }}
            transition={{
              duration: 0.16,
              ease: [0.23, 1, 0.32, 1],
            }}
            style={{
              transform: "translateZ(0)",
              willChange: "transform, opacity",
            }}
            className="absolute bottom-full left-0 z-50 mb-1.5 w-44 origin-bottom-left rounded-2xl bg-popover p-1.5 shadow-[0_4px_16px_rgb(0_0_0/0.12),0_12px_32px_rgb(0_0_0/0.18)] max-w-[calc(100vw-2rem)] will-change-transform select-none"
          >
            <div className="space-y-1">
              {modes.map((mode) => (
                <PermissionMenuItem
                  key={mode.id}
                  mode={mode}
                  isActive={activeModeId === mode.id}
                  isHovered={hoveredPermission === mode.id}
                  subtitleVisible={
                    permissionSubtitleVisible && hoveredPermission === mode.id
                  }
                  onHover={() => handleModeHover(mode.id)}
                  onLeave={() => handleModeLeave(mode.id)}
                  onSelect={() => handleSelect(mode.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Usage ──────────────────────────────────────────────────────────────── */

const UsageLimitRow = ({ limit }: { limit: UsageLimit }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-normal text-foreground">{limit.label}</span>
      <span className="text-xs leading-snug font-normal text-muted-foreground">
        {limit.resetLabel}
      </span>
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="text-xs font-normal text-muted-foreground">
        {limit.percentLeft}%
      </span>
      <CircularProgress value={limit.percentLeft} size={12} strokeWidth={1.5} />
    </div>
  </div>
);

/* ── Model selector ─────────────────────────────────────────────────────── */

interface ModelSelectorProps {
  models?: Model[];
  selectedModelId?: string;
  selectedDepthId?: string;
  onSelectModel?: (modelId: string, depthId: string) => void;
  usageLimits?: UsageLimit[];
}

const ModelSelector = ({
  models = DEFAULT_MODELS,
  selectedModelId,
  selectedDepthId,
  onSelectModel,
  usageLimits = DEFAULT_USAGE_LIMITS,
}: ModelSelectorProps) => {
  const [internalModelId, setInternalModelId] = useState<string>(
    selectedModelId ?? models[0]?.id ?? "chatgpt"
  );
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [openSubmenuModelId, setOpenSubmenuModelId] = useState<string | null>(
    null
  );
  const [hoveredDepth, setHoveredDepth] = useState<string | null>(null);
  const [selectedDepths, setSelectedDepths] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        models.map((m) => [
          m.id,
          m.id === selectedModelId && selectedDepthId
            ? selectedDepthId
            : (m.depths[0]?.id ?? ""),
        ])
      )
  );
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const submenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeModelId = selectedModelId ?? internalModelId;

  useDismissOnOutside(modelDropdownRef, () => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
    }
    setModelDropdownOpen(false);
    setHoveredModel(null);
    setOpenSubmenuModelId(null);
    setHoveredDepth(null);
  });

  useEffect(
    () => () => {
      if (submenuTimeoutRef.current) {
        clearTimeout(submenuTimeoutRef.current);
      }
    },
    []
  );

  const handleModelMouseEnter = (modelId: string) => {
    setHoveredModel(modelId);
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
    }
    submenuTimeoutRef.current = setTimeout(() => {
      setOpenSubmenuModelId(modelId);
    }, 400);
  };

  const handleModelMouseLeave = (modelId: string) => {
    if (hoveredModel === modelId) {
      setHoveredModel(null);
    }
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
    }
    submenuTimeoutRef.current = setTimeout(() => {
      setOpenSubmenuModelId(null);
      setHoveredDepth(null);
    }, 400);
  };

  const currentModel = models.find((m) => m.id === activeModelId) || models[0];
  const activeDepthId =
    (currentModel && selectedDepths[currentModel.id]) ||
    currentModel?.depths[0]?.id;
  const currentDepthLabel =
    currentModel?.depths.find((d) => d.id === activeDepthId)?.label ??
    currentModel?.depths[0]?.label;

  const handleSelectModel = (modelId: string, depthId?: string) => {
    setInternalModelId(modelId);
    const targetModel = models.find((m) => m.id === modelId);
    const nextDepth =
      depthId ?? selectedDepths[modelId] ?? targetModel?.depths[0]?.id ?? "";
    setSelectedDepths((prev) => ({
      ...prev,
      [modelId]: nextDepth,
    }));
    onSelectModel?.(modelId, nextDepth);
  };

  return (
    <div className="relative flex items-center" ref={modelDropdownRef}>
      <button
        type="button"
        onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
        className="text-sm flex cursor-pointer items-center gap-1 rounded-full border-none bg-transparent px-3 py-2 font-normal text-muted-foreground transition-colors select-none hover:bg-foreground/5 dark:hover:bg-foreground/10 hover:text-foreground"
      >
        <span className="leading-none flex gap-1">
          <span className="text-xs font-light tracking-wide ">
            {currentDepthLabel}
          </span>
          {currentModel?.name}
        </span>
        <ChevronDown
          width={14}
          height={14}
          strokeWidth={2}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            modelDropdownOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu: Appears UP aligned to right, rounded-2xl with fade + subtle scale */}
      <AnimatePresence>
        {modelDropdownOpen && (
          <motion.div
            key="model-dropdown-menu"
            onClick={(e) => e.stopPropagation()}
            onMouseLeave={() => {
              if (submenuTimeoutRef.current) {
                clearTimeout(submenuTimeoutRef.current);
              }
              setHoveredModel(null);
              setOpenSubmenuModelId(null);
              setHoveredDepth(null);
            }}
            initial={{
              opacity: 0,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              scale: 0.96,
            }}
            transition={{
              duration: 0.16,
              ease: [0.23, 1, 0.32, 1],
            }}
            style={{
              transform: "translateZ(0)",
              willChange: "transform, opacity",
            }}
            className="absolute left-0 sm:left-auto  bottom-full z-50 mb-1.5 w-56 origin-bottom-left sm:origin-bottom-right rounded-2xl bg-popover p-2 shadow-[0_4px_16px_rgb(0_0_0/0.12),0_12px_32px_rgb(0_0_0/0.18)] max-w-[calc(100vw-2rem)] will-change-transform select-none"
          >
            <div className="space-y-0.5">
              {models.map((model) => {
                const isActive = activeModelId === model.id;
                const modelSelectedDepthId = selectedDepths[model.id];
                const isSubmenuOpen = openSubmenuModelId === model.id;
                return (
                  <div
                    key={model.id}
                    className="relative"
                    onMouseEnter={() => handleModelMouseEnter(model.id)}
                    onMouseLeave={() => handleModelMouseLeave(model.id)}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectModel(model.id)}
                      className={cn(
                        "group text-xs relative flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors select-none",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <AnimatePresence>
                        {hoveredModel === model.id && (
                          <HoverIndicator
                            layoutId="v2-model-hover-indicator"
                            rounded="rounded-lg"
                            bg="bg-accent"
                          />
                        )}
                      </AnimatePresence>
                      <span className="relative z-10 font-normal">
                        {model.name}
                      </span>
                      <ChevronRight
                        width={14}
                        height={14}
                        strokeWidth={1.5}
                        className="relative z-10 shrink-0 text-muted-foreground"
                      />
                    </button>

                    <AnimatePresence>
                      {isSubmenuOpen && (
                        <motion.div
                          key={`${model.id}-depth-menu`}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{
                            duration: 0.14,
                            ease: [0.23, 1, 0.32, 1],
                          }}
                          className="absolute left-full top-0 z-50 ml-1.5 w-40 origin-top-left rounded-xl bg-popover p-1.5 shadow-[0_4px_16px_rgb(0_0_0/0.12),0_12px_32px_rgb(0_0_0/0.18)] max-w-[calc(100vw-2rem)] sm:max-w-none"
                        >
                          <div className="space-y-0.5">
                            {model.depths.map((depth) => {
                              const isDepthActive =
                                modelSelectedDepthId === depth.id;
                              const depthHoverKey = `${model.id}:${depth.id}`;
                              return (
                                <button
                                  key={depth.id}
                                  type="button"
                                  onClick={() =>
                                    handleSelectModel(model.id, depth.id)
                                  }
                                  onMouseEnter={() =>
                                    setHoveredDepth(depthHoverKey)
                                  }
                                  onMouseLeave={() => {
                                    if (hoveredDepth === depthHoverKey) {
                                      setHoveredDepth(null);
                                    }
                                  }}
                                  className={cn(
                                    "relative flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-xs transition-colors select-none",
                                    isDepthActive
                                      ? "text-foreground"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <AnimatePresence>
                                    {hoveredDepth === depthHoverKey && (
                                      <HoverIndicator
                                        layoutId="v2-model-depth-hover-indicator"
                                        rounded="rounded-md"
                                        bg="bg-accent"
                                      />
                                    )}
                                  </AnimatePresence>
                                  <span className="relative z-10 flex w-full items-center justify-between">
                                    <span>{depth.label}</span>
                                    {isDepthActive && (
                                      <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                                    )}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Full-width Divider */}
            {usageLimits && usageLimits.length > 0 && (
              <>
                <div className="-mx-2 my-1.5 border-t border-border" />

                {/* Usage limits */}
                <div className="flex flex-col gap-2.5 px-2.5 pb-0.5">
                  {usageLimits.map((limit) => (
                    <UsageLimitRow key={limit.id} limit={limit} />
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Prompt capsule ─────────────────────────────────────────────────────── */

interface PromptCapsuleProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (prompt: string) => void;
  placeholder?: string;
  isListening?: boolean;
  onListeningChange?: (listening: boolean) => void;
  models?: Model[];
  selectedModelId?: string;
  selectedDepthId?: string;
  onSelectModel?: (modelId: string, depthId: string) => void;
  permissionModes?: PermissionMode[];
  selectedPermissionId?: string;
  onSelectPermission?: (id: string) => void;
  usageLimits?: UsageLimit[];
  attachments?: ComposerAttachment[];
  onRemoveAttachment?: (id: string) => void;
  onSelectAttachment?: (type: AddAttachmentType) => void;
  disabled?: boolean;
}

const PromptCapsule = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask anything...",
  isListening: controlledListening,
  onListeningChange,
  models,
  selectedModelId,
  selectedDepthId,
  onSelectModel,
  permissionModes,
  selectedPermissionId,
  onSelectPermission,
  usageLimits,
  attachments = [],
  onRemoveAttachment,
  onSelectAttachment,
  disabled = false,
}: PromptCapsuleProps) => {
  const [internalValue, setInternalValue] = useState("");
  const [internalListening, setInternalListening] = useState(false);

  const inputValue = value === undefined ? internalValue : value;
  const isListening =
    controlledListening === undefined ? internalListening : controlledListening;

  const handleSend = () => {
    if (!inputValue.trim() && attachments.length === 0) {
      return;
    }
    onSubmit?.(inputValue);
    if (value === undefined) {
      setInternalValue("");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (value === undefined) {
      setInternalValue(e.target.value);
    }
    onChange?.(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleToggleListening = () => {
    const next = !isListening;
    if (controlledListening === undefined) {
      setInternalListening(next);
    }
    onListeningChange?.(next);
  };

  return (
    <motion.div
      layout
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      className="w-full rounded-3xl bg-muted p-2"
    >
      {/* Optional Attachments Pill Row */}
      <AnimatePresence initial={false}>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-wrap items-center gap-1.5 px-2 pt-1 pb-1.5 overflow-hidden"
          >
            {attachments.map((att) => (
              <AttachmentPill
                key={att.id}
                attachment={att}
                onRemove={(id) => onRemoveAttachment?.(id)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt Input Row */}
      <div className="flex items-center gap-2 py-1 pl-1 min-h-[36px]">
        {isListening ? (
          <ListeningWave />
        ) : (
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full bg-transparent px-2 text-base font-normal text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
          />
        )}
      </div>

      {/* Controls Row: access on the left, model, voice and send on the right */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <AddAttachmentDropdown
            onSelect={(type) => onSelectAttachment?.(type)}
          />
          <div className="hidden min-[512px]:flex items-center">
            <ModelSelector
              models={models}
              selectedModelId={selectedModelId}
              selectedDepthId={selectedDepthId}
              onSelectModel={onSelectModel}
              usageLimits={usageLimits}
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="hidden min-[512px]:flex items-center">
            <PermissionSelector
              modes={permissionModes}
              selectedModeId={selectedPermissionId}
              onSelectMode={onSelectPermission}
            />
          </div>
          <div className="ml-1 flex shrink-0 items-center gap-1">
            <MicButton
              isListening={isListening}
              onToggle={handleToggleListening}
            />
            <SendButton
              onClick={handleSend}
              disabled={
                disabled || (!inputValue.trim() && attachments.length === 0)
              }
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Prompt composer ────────────────────────────────────────────────────── */

export interface PromptComposerProps extends Omit<
  ComponentProps<"div">,
  "onSubmit" | "onChange"
> {
  /** The controlled text value for the prompt input. */
  value?: string;
  /** Called whenever the text input value changes. */
  onChange?: (value: string) => void;
  /** Called when the user presses Enter or clicks the Send button. */
  onSubmit?: (prompt: string, attachments: ComposerAttachment[]) => void;
  /** Input placeholder string. Defaults to "Ask anything...". */
  placeholder?: string;
  /** Whether quick prompts drawer above the composer is visible. Defaults to true. */
  showQuickPrompts?: boolean;
  /** List of quick prompt strings to show in the dropdown. */
  quickPrompts?: string[];
  /**
   * Called when a quick prompt is clicked.
   * If omitted or returns true/undefined, the composer automatically fills the prompt input.
   */
  onSelectQuickPrompt?: (prompt: string) => void;
  /** Controlled voice listening state. */
  isListening?: boolean;
  /** Called when the microphone voice listening state toggles. */
  onListeningChange?: (listening: boolean) => void;
  /**
   * Available AI models with depths and descriptions.
   * Defaults to ChatGPT, Claude, Gemini, DeepSeek.
   */
  models?: Model[];
  /** Controlled selected model ID. */
  selectedModelId?: string;
  /** Controlled selected depth ID. */
  selectedDepthId?: string;
  /** Called when a model or reasoning depth is selected. */
  onSelectModel?: (modelId: string, depthId: string) => void;
  /** Available permission modes (e.g. Auto-approve, Full access). */
  permissionModes?: PermissionMode[];
  /** Controlled selected permission mode ID. */
  selectedPermissionId?: string;
  /** Called when a permission mode is chosen. */
  onSelectPermission?: (id: string) => void;
  /** Usage limit indicators shown at the bottom of the model dropdown. */
  usageLimits?: UsageLimit[];
  /**
   * Controlled attachments list. When provided, attachments pills are shown above the input.
   * If omitted, a sample mock attachment is created on clicking file/image/folders to demonstrate the UI.
   */
  attachments?: ComposerAttachment[];
  /** Called when an attachment is added. */
  onAddAttachment?: (attachment: ComposerAttachment) => void;
  /** Called when an attachment pill is dismissed. */
  onRemoveAttachment?: (id: string) => void;
  /** Raw attachment type click handler if custom handling (e.g. opening a system file picker) is needed. */
  onSelectAttachmentType?: (type: AddAttachmentType) => void;
  /** Disable the composer inputs and buttons. */
  disabled?: boolean;
}

export const PromptComposer = ({
  className,
  value,
  onChange,
  onSubmit,
  placeholder,
  showQuickPrompts = true,
  quickPrompts = DEFAULT_PRE_PROMPTS,
  onSelectQuickPrompt,
  isListening,
  onListeningChange,
  models = DEFAULT_MODELS,
  selectedModelId,
  selectedDepthId,
  onSelectModel,
  permissionModes = DEFAULT_PERMISSION_MODES,
  selectedPermissionId,
  onSelectPermission,
  usageLimits = DEFAULT_USAGE_LIMITS,
  attachments: controlledAttachments,
  onAddAttachment,
  onRemoveAttachment,
  onSelectAttachmentType,
  disabled = false,
  ...props
}: PromptComposerProps) => {
  const [internalValue, setInternalValue] = useState("");
  const [internalAttachments, setInternalAttachments] = useState<
    ComposerAttachment[]
  >([]);

  const inputValue = value === undefined ? internalValue : value;
  const currentAttachments =
    controlledAttachments === undefined
      ? internalAttachments
      : controlledAttachments;

  const handleInputChange = (val: string) => {
    if (value === undefined) {
      setInternalValue(val);
    }
    onChange?.(val);
  };

  const handleQuickPrompt = (prompt: string) => {
    if (onSelectQuickPrompt) {
      onSelectQuickPrompt(prompt);
    } else {
      handleInputChange(prompt);
    }
  };

  /*
   * Handle attachment selection.
   * NOTE FOR CONSUMERS / DEVELOPERS:
   * To connect real file inputs, use onSelectAttachmentType to open an `<input type="file" />`
   * or a system file dialog, then pass files through `attachments` or `onAddAttachment`.
   * For quick previewing, clicking File/Image/Folder automatically adds a relevant sample attachment.
   */
  const handleAttachmentSelect = (type: AddAttachmentType) => {
    onSelectAttachmentType?.(type);

    if (type === "commands") {
      // Intentionally no-op for commands as requested; consumers can hook via onSelectAttachmentType.
      return;
    }

    // Default mock file sample if no custom file-picker callback overrides it
    const sampleNames: Record<
      AddAttachmentType,
      { name: string; size: string }
    > = {
      browser: { name: "https://craftui.com", size: "web" },
      commands: { name: "run.sh", size: "script" },
      file: { name: "dataset.csv", size: "240 KB" },
      folders: { name: "project-docs/", size: "4 items" },
      image: { name: "mockup-v2.png", size: "1.2 MB" },
    };

    const sample = sampleNames[type] ?? {
      name: "document.pdf",
      size: "500 KB",
    };
    const newAttachment: ComposerAttachment = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: sample.name,
      size: sample.size,
      type,
    };

    if (controlledAttachments === undefined) {
      setInternalAttachments((prev) => [...prev, newAttachment]);
    }
    onAddAttachment?.(newAttachment);
  };

  const handleRemoveAttachment = (id: string) => {
    if (controlledAttachments === undefined) {
      setInternalAttachments((prev) => prev.filter((a) => a.id !== id));
    }
    onRemoveAttachment?.(id);
  };

  const handleSubmit = (promptText: string) => {
    onSubmit?.(promptText, currentAttachments);
    if (controlledAttachments === undefined) {
      setInternalAttachments([]);
    }
  };

  return (
    <div
      className={cn(
        "flex h-full w-full overflow-hidden bg-transparent text-foreground px-4 sm:px-6 lg:px-8",
        className
      )}
      data-slot="prompt-composer"
      {...props}
    >
      {/* Prompt box: centred */}
      <div className="relative z-30 mx-auto w-full max-w-[640px] my-auto">
        {/* Chat Window Outer Container */}
        <div className="relative w-full">
          {/* Quick Prompts Extension */}
          <QuickPromptsDropdown
            isVisible={showQuickPrompts}
            prompts={quickPrompts}
            onSelectPrompt={handleQuickPrompt}
          />

          {/* Stable Prompt Capsule: input row with controls and attachment pills */}
          <PromptCapsule
            value={inputValue}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            placeholder={placeholder}
            isListening={isListening}
            onListeningChange={onListeningChange}
            models={models}
            selectedModelId={selectedModelId}
            selectedDepthId={selectedDepthId}
            onSelectModel={onSelectModel}
            permissionModes={permissionModes}
            selectedPermissionId={selectedPermissionId}
            onSelectPermission={onSelectPermission}
            usageLimits={usageLimits}
            attachments={currentAttachments}
            onRemoveAttachment={handleRemoveAttachment}
            onSelectAttachment={handleAttachmentSelect}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

export default PromptComposer;
