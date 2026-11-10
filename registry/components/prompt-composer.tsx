"use client";

/* oxlint-disable react/no-array-index-key -- the demo lists are static and positional */

import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, PointerEvent, SVGProps } from "react";

import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * Prompt composer. The input surface of an AI assistant: a capsule with
 * Enter to send and a voice button, a quick-prompts tray that unfolds above
 * it, and a footer row for attachments, permission mode, model, reasoning
 * depth and usage limits. A conversation grows above the capsule once you
 * send something.
 * ───────────────────────────────────────────────────────────────────────── */

interface IconProps extends SVGProps<SVGSVGElement> {
  width?: number | string;
  height?: number | string;
  color?: string;
}

const ChevronDownIcon = ({
  width = 24,
  height = 24,
  className,
  ...props
}: IconProps) => (
  <svg
    className={className}
    fill="none"
    height={height}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2.5"
    viewBox="0 0 24 24"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const EnterIcon = ({
  width = 24,
  height = 24,
  className,
  color = "currentColor",
  strokeWidth = 1.5,
  ...props
}: IconProps & { strokeWidth?: number | string }) => (
  <svg
    className={className}
    fill="none"
    height={height}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={strokeWidth}
    viewBox="0 0 24 24"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M13 6H8.5C6.01472 6 4 8.01472 4 10.5C4 12.9853 6.01472 15 8.5 15H20" />
    <path d="M17 12C17 12 20 14.2095 20 15C20 15.7906 17 18 17 18" />
  </svg>
);

const MicrophoneIcon = ({
  width = 24,
  height = 24,
  className,
  color = "currentColor",
  strokeWidth = 1.5,
  ...props
}: IconProps & { strokeWidth?: number | string }) => (
  <svg
    className={className}
    fill="none"
    height={height}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={strokeWidth}
    viewBox="0 0 24 24"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M7 6.5C7 4.01472 9.01472 2 11.5 2C13.9853 2 16 4.01472 16 6.5V11.5C16 13.9853 13.9853 16 11.5 16C9.01472 16 7 13.9853 7 11.5V6.5Z" />
    <path d="M11.5 19H11.0828C7.57267 19 4.57706 16.4623 4 13M11.5 19H11.9172C15.4273 19 18.4229 16.4623 19 13M11.5 19V22" />
  </svg>
);

const OmegaIcon = ({
  width = 24,
  height = 24,
  className,
  color = "currentColor",
  strokeWidth = 1.5,
  ...props
}: IconProps & { strokeWidth?: number | string }) => (
  <svg
    className={className}
    fill="none"
    height={height}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={strokeWidth}
    viewBox="0 0 24 24"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M2 19C2.02342 19.7767 2.11012 20.24 2.43105 20.5607C2.87077 21 3.57849 21 4.99393 21H7.965C8.74255 21 9.13132 21 9.17551 20.8603C9.2197 20.7206 8.88712 20.4868 8.22198 20.0192C5.86888 18.3648 3.99306 15.5091 3.99306 12.2636C3.99306 7.14744 7.57789 3 12 3C16.4221 3 20.0069 7.14744 20.0069 12.2636C20.0069 15.5091 18.1311 18.3648 15.778 20.0192C15.1129 20.4868 14.7803 20.7206 14.8245 20.8603C14.8687 21 15.2574 21 16.035 21H19.0061C20.4215 21 21.1292 21 21.5689 20.5607C21.8899 20.24 21.9766 19.7767 22 19" />
  </svg>
);

const PlusIcon = ({
  width = 24,
  height = 24,
  className,
  ...props
}: IconProps) => (
  <svg
    className={className}
    fill="none"
    height={height}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M12.001 5.00003V19.002" />
    <path d="M19.002 12.002L4.99998 12.002" />
  </svg>
);

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
  marks?: { value: number; label: string }[];
  "aria-label"?: string;
}

const Slider = ({
  value,
  min = 1,
  max = 3,
  step = 1,
  onChange,
  className,
  disabled = false,
  marks,
  "aria-label": ariaLabel = "Model depth selector",
}: SliderProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragRatio, setDragRatio] = useState<number | null>(null);

  // Target snap ratio based on discrete value (0 to 1)
  const targetRatio = (value - min) / (max - min);

  // Current visual ratio: while dragging, follows mouse exactly; otherwise matches target snap
  const currentRatio =
    isDragging && dragRatio !== null ? dragRatio : targetRatio;
  const percentage = Math.max(0, Math.min(100, currentRatio * 100));

  const calculateRatioFromPointer = useCallback((clientX: number) => {
    if (!trackRef.current) {
      return 0;
    }
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, ratio));
  }, []);

  const getSteppedValueFromRatio = useCallback(
    (ratio: number) => {
      const rawVal = min + ratio * (max - min);
      const steppedVal = Math.round(rawVal / step) * step;
      return Math.max(min, Math.min(max, steppedVal));
    },
    [max, min, step]
  );

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);

    const ratio = calculateRatioFromPointer(e.clientX);
    setDragRatio(ratio);
    const stepped = getSteppedValueFromRatio(ratio);
    if (stepped !== value) {
      onChange(stepped);
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const ratio = calculateRatioFromPointer(e.clientX);
    setDragRatio(ratio);
    const stepped = getSteppedValueFromRatio(ratio);
    if (stepped !== value) {
      onChange(stepped);
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragRatio(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(max, value + step));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(min, value - step));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(min);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(max);
    }
  };

  return (
    <div
      className={cn(
        "relative flex w-full select-none flex-col gap-1.5",
        className
      )}
    >
      <div
        aria-label={ariaLabel}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        className={cn(
          "group relative flex h-4 w-full touch-none items-center cursor-pointer outline-none",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onKeyDown={handleKeyDown}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
      >
        {/* Track Background */}
        <div className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-zinc-200">
          <div
            className={cn(
              "h-full bg-zinc-800",
              isDragging
                ? "transition-none"
                : "transition-all duration-200 ease-out"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Thumb */}
        <div
          className={cn(
            "absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full border border-zinc-300 bg-white shadow-xs ring-offset-background",
            isDragging
              ? "scale-110 ring-2 ring-zinc-400/50 transition-none"
              : "transition-all duration-200 ease-out group-hover:scale-105"
          )}
          style={{ left: `${percentage}%` }}
        />
      </div>

      {/* Optional Marks (only rendered if explicitly provided) */}
      {marks && marks.length > 0 && (
        <div className="flex w-full justify-between text-[9px] text-zinc-500 px-0.5 select-none font-normal">
          {marks.map((mark) => (
            <button
              className={cn(
                "cursor-pointer transition-colors hover:text-zinc-800",
                mark.value === value
                  ? "text-zinc-800 font-medium"
                  : "text-zinc-400 font-normal"
              )}
              key={mark.value}
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) {
                  onChange(mark.value);
                }
              }}
              type="button"
            >
              {mark.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

interface LatticeModel {
  id: string;
  name: string;
  version?: string;
  description: string;
  speed: string;
}

const PRE_PROMPTS = [
  "Which deals need my attention?",
  "Prepare me for my next meeting.",
  "Which customers need a follow-up?",
  "Give me an overview of my sales pipeline.",
  "Show me failed workflow executions.",
  "What has changed in our CRM recently?",
];

const CRM_PROMPT_ANSWERS: Record<string, string> = {
  "Give me an overview of my sales pipeline.":
    "Total pipeline is $186,000 (↑ 12% vs prior 7d) with 8 deals won, 24 new leads added this week, and 6 deals flagged at risk.",
  "Prepare me for my next meeting.":
    "Upcoming at 10:30 AM: Product demo with Acme Technologies (Alex Morgan, 45 minutes) to review enterprise reporting requirements.",
  "Show me failed workflow executions.":
    "New Lead Assignment failed 6 executions (last failure 32 minutes ago). 4 incoming website leads are waiting for owner assignment.",
  "What has changed in our CRM recently?":
    "12m ago: Acme Technologies moved to Negotiation ($24k). 34m ago: Olivia Chen added by Sarah Wilson. 1h ago: Vertex Cloud onboarding completed.",
  "Which customers need a follow-up?":
    "Olivia Chen at Meridian Labs needs a follow-up email after yesterday's product demonstration. James Walker at Vertex Cloud is waiting on custom pricing.",
  "Which deals need my attention?":
    "Acme Technologies ($24,000) has had no activity in 12 days during negotiation. Northstar Systems ($18,500) closes in 2 days with no next step scheduled.",
};

const LATTICE_MODELS: LatticeModel[] = [
  {
    description:
      "Routes requests to the optimal model based on task complexity and context.",
    id: "auto",
    name: "Auto",
    speed: "Dynamic",
  },
  {
    description:
      "Understands business context, interprets requests, and assists with everyday tasks.",
    id: "modula-core",
    name: "Modula Core",
    speed: "Standard",
    version: "1.4",
  },
  {
    description:
      "Analyzes statistics, identifies trends, and transforms data into visualizations.",
    id: "modula-forma",
    name: "Modula Forma",
    speed: "Fast",
    version: "2.1",
  },
  {
    description:
      "Interprets text, summarizes meetings, and extracts action items and follow-ups.",
    id: "modula-scribe",
    name: "Modula Scribe",
    speed: "Deep",
    version: "1.2",
  },
];

const DEPTH_STEPS = [
  { label: "Quick", value: 1 },
  { label: "Standard", value: 2 },
  { label: "Extended", value: 3 },
  { label: "Maximum", value: 4 },
];

interface PermissionMode {
  id: "auto-approve" | "full-access";
  label: string;
  subtitle: string;
}

const PERMISSION_MODES: PermissionMode[] = [
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
      "Runs all CRM actions, data updates, and workflows without prompting.",
  },
];

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
        className="stroke-zinc-200"
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
  layoutId = "model-hover-indicator",
  rounded = "rounded-lg",
  isActive = false,
  bg = "bg-zinc-200/60",
}: {
  layoutId?: string;
  rounded?: string;
  isActive?: boolean;
  bg?: string;
}) => (
  <motion.div
    layoutId={layoutId}
    layout="position"
    className={cn("pointer-events-none absolute inset-0", bg, rounded)}
    initial={{ opacity: 0 }}
    animate={{ opacity: isActive ? 0 : 1 }}
    exit={{ opacity: 0 }}
    transition={{
      duration: 0.16,
      ease: "easeOut",
    }}
  />
);

export const QuickPromptsDropdown = ({
  isVisible = true,
  onSelectPrompt,
}: {
  isVisible?: boolean;
  onSelectPrompt: (prompt: string) => void;
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

  const renderPromptItem = (prompt: string, index: number) => {
    const isHovered = hoveredPrompt === index;
    return (
      <button
        key={index}
        type="button"
        onClick={() => onSelectPrompt(prompt)}
        onMouseEnter={() => setHoveredPrompt(index)}
        className="group text-[10px] relative flex w-full cursor-pointer items-center justify-between rounded-xl py-1.5 pr-2 pl-2 text-left font-normal text-zinc-600 transition-colors duration-150 ease-out select-none hover:text-zinc-800"
      >
        {/* Unified Hover Container: moving indicator pill and enter icon together */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              layoutId="v2-quick-prompts-indicator"
              layout="position"
              className="pointer-events-none absolute inset-0 flex items-center justify-end rounded-xl bg-zinc-200/60 pr-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.16,
                ease: "easeOut",
              }}
            >
              <EnterIcon
                width={12}
                height={12}
                strokeWidth={1.5}
                color="currentColor"
                className="text-zinc-600"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <span className="relative z-10 truncate leading-snug whitespace-nowrap">
          {prompt}
        </span>

        {/* Space reservation so text never overlaps the icon */}
        <div className="pointer-events-none ml-2 h-3.5 w-3.5 shrink-0 opacity-0" />
      </button>
    );
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
          className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5"
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
              "pointer-events-auto w-max rounded-2xl p-1 transition-colors duration-250 ease-out",
              promptsExpanded ? "bg-zinc-100" : "bg-transparent"
            )}
          >
            {/* Prompts list: Placed ABOVE the title Quick Prompts. Stays in DOM so clipPath physically slices through on exit */}
            <div
              onMouseLeave={() => setHoveredPrompt(null)}
              className={cn(
                "flex w-max flex-col space-y-0.5 pb-0.5",
                !promptsExpanded && "pointer-events-none"
              )}
            >
              {PRE_PROMPTS.map((prompt, idx) => renderPromptItem(prompt, idx))}
            </div>

            {/* Header: Fixed at bottom-left */}
            <button
              className="group flex w-max cursor-pointer items-center gap-1.5 px-2 py-1 select-none"
              onClick={handleToggle}
              ref={headerRef}
              type="button"
            >
              <span className="text-[10px] font-normal whitespace-nowrap text-zinc-400 transition-colors duration-150 ease-out group-hover:text-zinc-800">
                Quick prompts
              </span>
              <span className="pointer-events-none flex shrink-0 items-center justify-center p-0.5 text-zinc-400 transition-colors duration-150 ease-out group-hover:text-zinc-800">
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
                  <ChevronDownIcon width={12} height={12} strokeWidth={1.5} />
                </motion.span>
              </span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export interface PromptComposerProps {
  /** Extra classes for the root canvas, e.g. a height or border. */
  className?: string;
}

export const PromptComposer = ({ className }: PromptComposerProps) => {
  const [selectedModelId, setSelectedModelId] = useState<string>("auto");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  const [selectedPermissionId, setSelectedPermissionId] = useState<
    "auto-approve" | "full-access"
  >("auto-approve");
  const [permissionDropdownOpen, setPermissionDropdownOpen] = useState(false);
  const [hoveredPermission, setHoveredPermission] = useState<string | null>(
    null
  );

  const [usagePopupOpen, setUsagePopupOpen] = useState(false);
  const usageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUsageMouseEnter = () => {
    if (usageTimeoutRef.current) {
      clearTimeout(usageTimeoutRef.current);
    }
    usageTimeoutRef.current = setTimeout(() => {
      setUsagePopupOpen(true);
    }, 400);
  };

  const handleUsageMouseLeave = () => {
    if (usageTimeoutRef.current) {
      clearTimeout(usageTimeoutRef.current);
    }
    usageTimeoutRef.current = setTimeout(() => {
      setUsagePopupOpen(false);
    }, 150);
  };

  useEffect(
    () => () => {
      if (usageTimeoutRef.current) {
        clearTimeout(usageTimeoutRef.current);
      }
    },
    []
  );

  const [modelDepth, setModelDepth] = useState<number>(2);
  const [chatInput, setChatInput] = useState<string>("");
  const [messages, setMessages] = useState<
    { sender: "user" | "lattice"; text: string }[]
  >([]);

  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const permissionDropdownRef = useRef<HTMLDivElement>(null);

  const currentModel =
    LATTICE_MODELS.find((m) => m.id === selectedModelId) || LATTICE_MODELS[0];
  const currentPermission =
    PERMISSION_MODES.find((p) => p.id === selectedPermissionId) ||
    PERMISSION_MODES[0];

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(event.target as Node)
      ) {
        setModelDropdownOpen(false);
        setHoveredModel(null);
      }
      if (
        permissionDropdownRef.current &&
        !permissionDropdownRef.current.contains(event.target as Node)
      ) {
        setPermissionDropdownOpen(false);
        setHoveredPermission(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSendMessage = () => {
    if (!chatInput.trim()) {
      return;
    }
    const userText = chatInput.trim();
    setMessages((prev) => [
      ...prev,
      { sender: "user", text: userText },
      {
        sender: "lattice",
        text:
          CRM_PROMPT_ANSWERS[userText] ||
          `Processing with ${currentModel.name} at ${DEPTH_STEPS.find((d) => d.value === modelDepth)?.label} depth.`,
      },
    ]);
    setChatInput("");
  };

  const handleSelectPrompt = (promptText: string) => {
    setMessages((prev) => [
      ...prev,
      { sender: "user", text: promptText },
      {
        sender: "lattice",
        text:
          CRM_PROMPT_ANSWERS[promptText] ||
          `Processing with ${currentModel.name} at ${DEPTH_STEPS.find((d) => d.value === modelDepth)?.label} depth.`,
      },
    ]);
  };

  return (
    <div
      className={cn(
        "flex h-full w-full overflow-hidden text-zinc-800",
        className
      )}
    >
      {/* Main column: on a fresh chat the composer sits in the middle; once
          a conversation starts it drops to the bottom with the thread above. */}
      <div className="relative flex h-full w-full flex-col overflow-hidden px-6">
        {messages.length > 0 && (
          <div className="mx-auto flex w-full max-w-[480px] min-h-0 flex-1 flex-col justify-end space-y-2 overflow-hidden pt-6 pb-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-1 select-none">
              <span className="text-[10px] text-zinc-400">Conversation</span>
              <button
                type="button"
                onClick={() => setMessages([])}
                className="text-[10px] cursor-pointer text-zinc-400 transition-[color,transform] duration-150 ease-out hover:text-zinc-800 active:scale-[0.97]"
              >
                Reset
              </button>
            </div>
            <div className="min-h-0 flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-2 overflow-y-auto pr-1">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-0.5",
                    m.sender === "user" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl px-3.5 py-1.5 text-xs leading-relaxed",
                      m.sender === "user"
                        ? "bg-zinc-900 font-normal text-zinc-50"
                        : "bg-zinc-100 font-normal text-zinc-800"
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prompt box: centred on a fresh chat, anchored under the thread once
            the conversation starts. */}
        <div
          className={cn(
            "relative z-30 mx-auto w-full max-w-[480px]",
            messages.length === 0 ? "my-auto" : "pb-6"
          )}
        >
          {/* Chat Window Outer Container */}
          <div className="relative w-full">
            {/* Quick Prompts Extension */}
            <QuickPromptsDropdown
              isVisible={messages.length === 0}
              onSelectPrompt={handleSelectPrompt}
            />

            {/* Stable Prompt Capsule: input and enter button stay rock-solid */}
            <div className="w-full rounded-2xl bg-zinc-100 p-1">
              {/* Prompt Input Row */}
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask Lattice about deals, pipeline risks, or schedule..."
                  className="w-full bg-transparent pl-2 text-xs font-normal text-zinc-800 placeholder:text-zinc-400 focus:outline-none"
                />
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors duration-150 ease-out hover:bg-zinc-200/60 hover:text-zinc-800"
                    title="Voice input"
                    aria-label="Voice input"
                  >
                    <MicrophoneIcon
                      width={12}
                      height={12}
                      strokeWidth={1.5}
                      color="currentColor"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    className="flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 p-1 px-2 text-zinc-100 shadow-xs duration-150 ease-out hover:bg-zinc-700"
                    title="Send"
                  >
                    <EnterIcon
                      width={12}
                      height={12}
                      strokeWidth={1.75}
                      color="currentColor"
                      className="text-zinc-100"
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Prompt Footer Row: Add Button & Permission Mode on Left, Limit & Model Selector on Right */}
            <div className="relative mt-1.5 flex items-center justify-between px-2">
              {/* Left End: Add Icon Button & Permission Mode Selector */}
              <div
                className="flex items-center gap-1"
                ref={permissionDropdownRef}
              >
                <button
                  type="button"
                  className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors select-none hover:bg-zinc-200/60 hover:text-zinc-800"
                  title="Add attachment"
                  aria-label="Add attachment"
                >
                  <PlusIcon
                    width={12}
                    height={12}
                    strokeWidth={2}
                    className="shrink-0"
                  />
                </button>

                {/* Permission Mode Selector Toggle */}
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => setPermissionDropdownOpen((prev) => !prev)}
                    className={cn(
                      "text-[10px] flex h-5 cursor-pointer items-center gap-1 rounded-md border-none bg-transparent px-1.5 font-normal transition-colors select-none hover:bg-zinc-200/60",
                      selectedPermissionId === "full-access"
                        ? "text-red-500 hover:text-red-600"
                        : "text-zinc-600 hover:text-zinc-800"
                    )}
                  >
                    <span className="leading-none">
                      {currentPermission.label}
                    </span>
                    <ChevronDownIcon
                      width={10}
                      height={10}
                      strokeWidth={1.5}
                      className={cn(
                        "shrink-0 transition-transform",
                        selectedPermissionId === "full-access"
                          ? "text-red-400"
                          : "text-zinc-400",
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
                        className="absolute bottom-full left-0 z-50 mb-1.5 w-60 origin-bottom-left rounded-2xl border border-zinc-200 bg-zinc-100 p-1.5 shadow-xl will-change-transform select-none"
                      >
                        <div className="space-y-1">
                          {PERMISSION_MODES.map((mode) => {
                            const isActive = selectedPermissionId === mode.id;
                            const isHovered = hoveredPermission === mode.id;
                            return (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() => {
                                  setSelectedPermissionId(mode.id);
                                  setPermissionDropdownOpen(false);
                                }}
                                onMouseEnter={() =>
                                  setHoveredPermission(mode.id)
                                }
                                onMouseLeave={() => {
                                  if (hoveredPermission === mode.id) {
                                    setHoveredPermission(null);
                                  }
                                }}
                                className={cn(
                                  "group text-[10px] relative flex w-full cursor-pointer flex-col rounded-xl p-2 text-left transition-colors select-none",
                                  isActive
                                    ? "bg-zinc-200/60"
                                    : "hover:text-zinc-800"
                                )}
                              >
                                <AnimatePresence>
                                  {isHovered && (
                                    <HoverIndicator
                                      layoutId="v2-permission-hover-indicator"
                                      rounded="rounded-xl"
                                      isActive={isActive}
                                      bg="bg-zinc-200/60"
                                    />
                                  )}
                                </AnimatePresence>
                                <div className="relative z-10 flex w-full items-center justify-between">
                                  <div
                                    className={cn(
                                      "text-[10px] font-medium",
                                      mode.id === "full-access"
                                        ? "text-red-500"
                                        : "text-zinc-800"
                                    )}
                                  >
                                    {mode.label}
                                  </div>
                                </div>
                                <div className="text-[10px] relative z-10 mt-0.5 leading-snug font-normal text-zinc-600">
                                  {mode.subtitle}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right End: Grouped Model Selector & Limit Remaining */}
              <div className="flex items-center gap-1" ref={modelDropdownRef}>
                {/* Model Selector Toggle */}
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    className="text-[10px] flex h-5 cursor-pointer items-center gap-1 rounded-md border-none bg-transparent px-1.5 font-normal text-zinc-600 transition-colors select-none hover:bg-zinc-200/60 hover:text-zinc-800"
                  >
                    <span className="leading-none">{currentModel.name}</span>
                    <ChevronDownIcon
                      width={10}
                      height={10}
                      strokeWidth={1.5}
                      className={cn(
                        "shrink-0 text-zinc-400 transition-transform",
                        modelDropdownOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {/* Dropdown Menu: Appears UP aligned to right (`right-0 bottom-full mb-1.5`), rounded-2xl with fade + subtle scale */}
                  <AnimatePresence>
                    {modelDropdownOpen && (
                      <motion.div
                        key="model-dropdown-menu"
                        onClick={(e) => e.stopPropagation()}
                        onMouseLeave={() => setHoveredModel(null)}
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
                        className="absolute right-0 bottom-full z-50 mb-1.5 w-48 origin-bottom-right rounded-2xl border border-zinc-200 bg-zinc-100 p-2 shadow-xl will-change-transform"
                      >
                        <div className="space-y-0.5">
                          {LATTICE_MODELS.map((model) => {
                            const isActive = selectedModelId === model.id;
                            const isHovered = hoveredModel === model.id;
                            return (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => {
                                  setSelectedModelId(model.id);
                                  setModelDropdownOpen(false);
                                }}
                                onMouseEnter={() => setHoveredModel(model.id)}
                                onMouseLeave={() => {
                                  if (hoveredModel === model.id) {
                                    setHoveredModel(null);
                                  }
                                }}
                                className={cn(
                                  "group text-[10px] relative flex w-full cursor-pointer items-center rounded-lg px-2.5 py-1 text-left transition-colors select-none",
                                  isActive
                                    ? "bg-zinc-200/60"
                                    : "hover:text-zinc-800"
                                )}
                              >
                                <AnimatePresence>
                                  {isHovered && (
                                    <HoverIndicator
                                      layoutId="v2-model-hover-indicator"
                                      rounded="rounded-lg"
                                      isActive={isActive}
                                      bg="bg-zinc-200/60"
                                    />
                                  )}
                                </AnimatePresence>
                                <span
                                  className={cn(
                                    "relative z-10 flex items-center gap-1.5 font-normal whitespace-nowrap transition-colors duration-150",
                                    isActive ? "text-zinc-800" : "text-zinc-600"
                                  )}
                                >
                                  <span>{model.name}</span>
                                  {model.version && (
                                    <>
                                      <span className="text-zinc-400 select-none">
                                        —
                                      </span>
                                      <span className="inline-flex items-center gap-0.5 font-normal text-zinc-600">
                                        <OmegaIcon
                                          width={10}
                                          height={10}
                                          strokeWidth={1.5}
                                          className="shrink-0 text-zinc-600"
                                        />
                                        <span>{model.version}</span>
                                      </span>
                                    </>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Full-width Divider */}
                        <div className="-mx-2 my-1.5 border-t border-zinc-200" />

                        {/* Slider inside dropdown with selected depth value on left */}
                        <div className="flex flex-col gap-1.5 px-2.5 pb-0.5">
                          <div className="text-[10px] flex items-center select-none">
                            <span className="font-normal text-zinc-800">
                              {
                                DEPTH_STEPS.find((d) => d.value === modelDepth)
                                  ?.label
                              }
                            </span>
                          </div>
                          <Slider
                            value={modelDepth}
                            min={1}
                            max={4}
                            step={1}
                            onChange={setModelDepth}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Limit Remaining: placed after model selector (hovers with 400ms delay to show limits) */}
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onMouseEnter={handleUsageMouseEnter}
                    onMouseLeave={handleUsageMouseLeave}
                    onClick={() => setUsagePopupOpen((prev) => !prev)}
                    className="text-[10px] flex h-5 cursor-pointer items-center gap-1.5 rounded-md px-1.5 font-normal text-zinc-600 transition-colors select-none hover:bg-zinc-200/60 hover:text-zinc-800"
                    aria-label="Usage limits"
                  >
                    <span className="leading-none">56%</span>
                    <CircularProgress value={56} size={10} strokeWidth={1.5} />
                  </button>

                  {/* Usage Limits Popup */}
                  <AnimatePresence>
                    {usagePopupOpen && (
                      <motion.div
                        key="usage-limits-popup"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{
                          duration: 0.16,
                          ease: [0.23, 1, 0.32, 1],
                        }}
                        style={{
                          transform: "translateZ(0)",
                          willChange: "transform, opacity",
                        }}
                        onMouseEnter={handleUsageMouseEnter}
                        onMouseLeave={handleUsageMouseLeave}
                        className="absolute right-0 bottom-full z-50 mb-1.5 w-56 origin-bottom-right rounded-2xl border border-zinc-200 bg-zinc-100 p-3 shadow-xl will-change-transform select-none"
                      >
                        <div className="flex flex-col gap-2.5">
                          {/* 5hr Limit Item */}
                          <div className="flex flex-col gap-1">
                            <div className="text-[10px] flex items-center justify-between">
                              <span className="font-normal text-zinc-800">
                                5hr limit
                              </span>
                              <span className="font-normal text-zinc-600">
                                56% left
                              </span>
                            </div>
                            {/* Micro linear progress bar */}
                            <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
                                style={{ width: "56%" }}
                              />
                            </div>
                            <div className="text-[10px] font-normal text-zinc-600">
                              Resets in 2h 14m
                            </div>
                          </div>

                          {/* Full-width Divider */}
                          <div className="-mx-3 border-t border-zinc-200" />

                          {/* Weekly Limit Item */}
                          <div className="flex flex-col gap-1">
                            <div className="text-[10px] flex items-center justify-between">
                              <span className="font-normal text-zinc-800">
                                Weekly limit
                              </span>
                              <span className="font-normal text-zinc-600">
                                82% left
                              </span>
                            </div>
                            {/* Micro linear progress bar */}
                            <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
                                style={{ width: "82%" }}
                              />
                            </div>
                            <div className="text-[10px] font-normal text-zinc-600">
                              Resets Monday at 9:00 AM
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptComposer;
