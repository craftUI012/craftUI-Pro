"use client";

/* oxlint-disable max-lines, max-lines-per-function, no-magic-numbers */

import {
  Alert02Icon,
  Clapping01Icon,
  Copy01Icon,
  Download04Icon,
  FloppyDiskIcon,
} from "@hugeicons/core-free-icons";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  directVideo,
  saveStoryboard,
} from "@/app/admin-panel-craft/studio/actions";
import { StudioRender } from "@/components/admin-panel/studio-render";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { DirectResult } from "@/lib/studio/director";
import {
  AUDIENCES,
  GROUNDS,
  HOOK_STYLES,
  LENGTHS,
  VIDEO_TYPES,
} from "@/lib/studio/options";
import type {
  AudienceId,
  GroundId,
  HookStyleId,
  LengthId,
  StudioComponentOption,
  VideoTypeId,
} from "@/lib/studio/options";
import type { ProbeResult, ProbeTest } from "@/lib/studio/probe";
import type { Beat, Caption, Shot } from "@/reels/spec";

// The Studio's form and the director's answer: the choices on the left, the
// storyboard on the right as a readable shot list and as the JSON the
// shooter and composer take.

const seconds = (ms: number) =>
  `${(ms / 1000).toFixed(1).replace(/\.0$/, "")} s`;

const targetLabel = (target: string) => target.replace(/^(aria|text|css):/, "");

const describeBeat = (beat: Beat) => {
  switch (beat.do) {
    case "wait": {
      return `Hold ${seconds(beat.ms)}`;
    }
    case "click": {
      return `Click “${targetLabel(beat.target)}”, then hold ${seconds(beat.hold)}`;
    }
    case "hover": {
      return `Hover “${targetLabel(beat.target)}” for ${seconds(beat.ms)}`;
    }
    case "key": {
      return `Press ${beat.key}, then hold ${seconds(beat.hold)}`;
    }
    case "resize": {
      return `Drag the window down to ${beat.to}px wide`;
    }
    case "scroll": {
      return `Scroll to ${typeof beat.to === "number" ? `${beat.to}px` : `“${targetLabel(beat.to)}”`}`;
    }
    case "type": {
      return `Type “${beat.text}” into “${targetLabel(beat.target)}”`;
    }
    default: {
      return "";
    }
  }
};

const shotTitle = (shot: Shot) => {
  switch (shot.kind) {
    case "live": {
      return `Live component · ${shot.frame === "phone" ? "phone" : `browser ${shot.viewport}px`}${shot.theme ? ` · ${shot.theme}` : ""}`;
    }
    case "terminal": {
      return "Terminal · install";
    }
    case "code": {
      return `Code · ${shot.file}`;
    }
    case "end": {
      return "End card";
    }
    default: {
      return "";
    }
  }
};

const CaptionText = ({ caption }: { caption: Caption }) => (
  <div className="flex flex-col gap-0.5">
    {caption.eyebrow && (
      <span className="text-muted-foreground text-xs">{caption.eyebrow}</span>
    )}
    <span className="text-sm font-medium leading-snug">
      {caption.lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </span>
  </div>
);

const ShotCard = ({ index, shot }: { index: number; shot: Shot }) => (
  <li className="bg-card flex gap-4 rounded-lg border p-4">
    <span className="text-muted-foreground w-5 shrink-0 text-sm tabular-nums">
      {index + 1}
    </span>
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <span className="text-sm font-medium">{shotTitle(shot)}</span>
      {shot.kind !== "end" && shot.caption && (
        <CaptionText caption={shot.caption} />
      )}
      {shot.kind === "live" && (
        <ol className="text-muted-foreground flex flex-col gap-1.5 text-sm">
          {shot.beats.map((beat, i) => (
            <li key={`${i}-${beat.do}`} className="flex flex-col gap-1">
              <span>{describeBeat(beat)}</span>
              {beat.caption && (
                <span className="border-l-2 pl-3">
                  <CaptionText caption={beat.caption} />
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      {shot.kind === "terminal" && (
        <code className="bg-muted rounded-md px-2 py-1.5 font-mono text-xs break-all">
          {shot.command}
        </code>
      )}
      {shot.kind === "code" && (
        <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs leading-relaxed">
          {shot.code}
        </pre>
      )}
      {shot.kind === "end" && (
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{shot.headline}</span>
          <span className="text-muted-foreground">{shot.tagline}</span>
          <span className="text-muted-foreground text-xs">
            {shot.cta}
            {shot.note ? ` · ${shot.note}` : ""}
          </span>
        </div>
      )}
    </div>
  </li>
);

const Field = ({
  children,
  hint,
  id,
  label,
}: {
  children: React.ReactNode;
  hint?: string;
  id: string;
  label: string;
}) => (
  <div className="flex flex-col gap-2 [&_[data-slot=native-select-wrapper]]:w-full">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
  </div>
);

const effectSummary = (effect: NonNullable<ProbeTest["effect"]>) => {
  const parts = effect.sizes.map((size) => `${size.what} ${size.scale}×`);
  if (effect.faded) {
    parts.push(`${effect.faded} faded`);
  }
  if (effect.textChanged) {
    parts.push("text changed");
  }
  return parts.join(" · ") || "no visible change";
};

/** What the live probe tried on the component, and what each did. */
const ProbePanel = ({ probe }: { probe: ProbeResult }) => {
  const nameOf = (id: string | null) =>
    probe.groups.find((g) => g.id === id)?.label || id || "";
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
      <span className="font-medium">What the probe tried</span>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Headless Chrome opened the real preview at {probe.viewport.width}px and
        tried each interaction on a fresh page.
        {probe.ownCursor &&
          " The component draws its own cursor, so the video hides its cursor there."}
      </p>
      <ul className="flex flex-col gap-1 text-xs">
        {probe.tests.map((t) => (
          <li
            key={`${t.action}-${t.group ?? t.key}`}
            className="flex flex-wrap gap-x-2"
          >
            <span
              className={t.responds ? "font-medium" : "text-muted-foreground"}
            >
              {t.action}{" "}
              {t.action === "key"
                ? t.key
                : `${t.group} “${nameOf(t.group).slice(0, 32)}”`}
            </span>
            <span className="text-muted-foreground">
              {t.error ?? (t.effect ? effectSummary(t.effect) : "")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** The Interface Craft feature audit, and which scene shows each feature. */
const FeatureAudit = ({
  audit,
  featureShots,
}: {
  audit: NonNullable<DirectResult["audit"]>;
  featureShots: DirectResult["featureShots"];
}) => (
  <div className="flex flex-col gap-4">
    <p className="text-muted-foreground text-sm leading-relaxed">
      Listed by Interface Craft (Design Critique and Storyboard Animation),
      strongest first. {audit.context}
    </p>
    <ol className="flex flex-col gap-3">
      {audit.features.map((f, i) => {
        const scene = featureShots[i];
        return (
          <li
            key={f.name}
            className="flex flex-col gap-2 rounded-lg border p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {i + 1}
              </span>
              <span className="font-medium">{f.name}</span>
              <Badge variant="secondary">{f.lens}</Badge>
              <Badge variant="outline">
                {f.trigger.action}
                {f.trigger.target ? ` · ${f.trigger.target}` : ""}
              </Badge>
              {scene && <Badge>Shot {scene}</Badge>}
            </div>
            <p className="text-sm leading-relaxed">{f.observation}</p>
            <pre className="bg-muted overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {f.storyboard}
            </pre>
            <p className="text-muted-foreground text-xs leading-relaxed">
              <span className="text-foreground">Evidence:</span> {f.evidence}
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              <span className="text-foreground">Caption:</span> “{f.caption}” ·{" "}
              <span className="tabular-nums">
                visibility {f.visibility}/5 · rarity {f.rarity}/5
              </span>
            </p>
          </li>
        );
      })}
    </ol>
    {audit.do_not_claim.length > 0 && (
      <div className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <span className="font-medium">Never claimed in the video</span>
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-4 text-xs">
          {audit.do_not_claim.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

/** What the director read from the reference videos and took from them. */
const ReferenceResult = ({
  notes,
  references,
}: {
  notes: string;
  references: DirectResult["references"];
}) => {
  if (references.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
      <span className="font-medium">From the reference videos</span>
      <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
        {references.map((r) => (
          <li key={r.url} className="truncate">
            <span className="tabular-nums">
              {r.duration.toFixed(1)}s · {r.width}×{r.height} · {r.cuts.length}{" "}
              {r.cuts.length === 1 ? "cut" : "cuts"} · {r.frames} frames read
            </span>{" "}
            · {r.url}
          </li>
        ))}
      </ul>
      {notes && <p className="leading-relaxed whitespace-pre-wrap">{notes}</p>}
    </div>
  );
};

/** Copy, download and (dev only) save the storyboard. */
const ResultActions = ({
  canSave,
  fileName,
  json,
  spec,
}: {
  canSave: boolean;
  fileName: string;
  json: string;
  spec: DirectResult["spec"];
}) => {
  const [saving, startSaving] = useTransition();

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    toast.success("Storyboard copied.");
  };

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const save = () => {
    startSaving(async () => {
      const answer = await saveStoryboard(spec);
      if ("error" in answer) {
        toast.error(answer.error);
        return;
      }
      toast.success(`Saved reels/specs/${answer.name}.json`);
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={copy}>
        <Icon icon={Copy01Icon} />
        Copy JSON
      </Button>
      <Button size="sm" variant="outline" onClick={download}>
        <Icon icon={Download04Icon} />
        Download
      </Button>
      {canSave && (
        <Button size="sm" variant="outline" onClick={save} disabled={saving}>
          <Icon icon={FloppyDiskIcon} />
          {saving ? "Saving…" : "Save to reels/specs"}
        </Button>
      )}
    </div>
  );
};

const REFERENCE_HINT = {
  dev: "Up to 3 links, one per line: Instagram, YouTube, TikTok or a direct .mp4. The director reads each one frame by frame with ffmpeg (nothing is saved) and follows its structure.",
  hosted:
    "Reference videos are read with ffmpeg, so they only work when Studio runs on a dev machine.",
} as const;

/** The director's plan: storyboard, features (showcase) and JSON. */
const PlanResult = ({
  canSave,
  fileName,
  json,
  result,
}: {
  canSave: boolean;
  fileName: string;
  json: string;
  result: DirectResult;
}) => (
  <Tabs defaultValue="storyboard" className="gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <TabsList>
        <TabsTrigger value="storyboard">Storyboard</TabsTrigger>
        {result.audit && <TabsTrigger value="features">Features</TabsTrigger>}
        <TabsTrigger value="json">JSON</TabsTrigger>
      </TabsList>
      <ResultActions
        canSave={canSave}
        fileName={fileName}
        json={json}
        spec={result.spec}
      />
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium">{result.spec.title}</span>
      <Badge variant="secondary">{result.spec.type}</Badge>
      <Badge variant="secondary">
        about {Math.round(result.estimateSeconds)} s
      </Badge>
      <Badge variant="secondary">{result.spec.shots.length} shots</Badge>
      <Badge variant="outline">{result.model}</Badge>
    </div>

    {canSave && <StudioRender key={json} spec={result.spec} />}

    <TabsContent value="storyboard" className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm leading-relaxed">
        {result.notes}
      </p>
      <ReferenceResult
        notes={result.referenceNotes}
        references={result.references}
      />
      {result.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <ol className="flex flex-col gap-3">
        {result.spec.shots.map((shot, i) => (
          <ShotCard key={`${i}-${shot.kind}`} index={i} shot={shot} />
        ))}
      </ol>
      <p className="text-muted-foreground text-xs">
        Controls the director could use, read from the source:{" "}
        {[
          ...result.interactions.ariaLabels.map((l) => `“${l}”`),
          ...result.interactions.keys,
        ].join(", ") || "none"}
        .
      </p>
    </TabsContent>

    {result.audit && (
      <TabsContent value="features" className="flex flex-col gap-4">
        <FeatureAudit audit={result.audit} featureShots={result.featureShots} />
        {result.probe && <ProbePanel probe={result.probe} />}
      </TabsContent>
    )}

    <TabsContent value="json">
      <pre className="bg-muted max-h-[70vh] overflow-auto rounded-lg p-4 font-mono text-xs leading-relaxed">
        {json}
      </pre>
      {canSave && (
        <p className="text-muted-foreground mt-2 text-xs">
          Saving writes reels/specs/{fileName} (replacing one with that name).
          Then{" "}
          <code className="font-mono">
            pnpm video {fileName.replace(/\.json$/, "")}
          </code>{" "}
          films it.
        </p>
      )}
    </TabsContent>
  </Tabs>
);

export const StudioForm = ({
  canSave,
  components,
}: {
  canSave: boolean;
  components: StudioComponentOption[];
}) => {
  const [item, setItem] = useState(components[0]?.name ?? "");
  const [type, setType] = useState<VideoTypeId>("showcase");
  const [hook, setHook] = useState<HookStyleId>("bold-claim");
  const [audience, setAudience] = useState<AudienceId>("both");
  const [length, setLength] = useState<LengthId>(15);
  const [ground, setGround] = useState<GroundId>("auto");
  const [referenceText, setReferenceText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [result, setResult] = useState<DirectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [directing, startDirecting] = useTransition();

  const libraries = useMemo(() => {
    const groups = new Map<string, StudioComponentOption[]>();
    for (const c of components) {
      groups.set(c.library, [...(groups.get(c.library) ?? []), c]);
    }
    return [...groups.entries()];
  }, [components]);

  const json = result ? JSON.stringify(result.spec, null, 2) : "";
  const fileName = result ? `${result.spec.item}-${result.spec.type}.json` : "";

  const plan = () => {
    setError(null);
    startDirecting(async () => {
      const references = referenceText
        .split(/\s+/)
        .map((link) => link.trim())
        .filter(Boolean);
      const answer = await directVideo({
        audience,
        ground,
        hook,
        instructions,
        item,
        length,
        references,
        type,
      });
      if ("error" in answer) {
        setError(answer.error);
        return;
      }
      setResult(answer.result);
    });
  };

  const typeInfo = VIDEO_TYPES.find((t) => t.id === type);
  const steps = [
    referenceText.trim() && "reading the reference videos with ffmpeg",
    type === "showcase" &&
      "Interface Craft is listing the component's features",
    "the director is planning",
  ].filter(Boolean);
  const planningHint = `In order: ${steps.join(", then ")}. ${
    steps.length > 1
      ? "This takes two or three minutes."
      : "Usually under a minute."
  }`;
  const hookInfo = HOOK_STYLES.find((h) => h.id === hook);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Brief</CardTitle>
          <CardDescription>What the director plans for.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Field id="studio-item" label="Component">
            <NativeSelect
              id="studio-item"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="w-full"
            >
              {libraries.map(([library, list]) => (
                <NativeSelectOptGroup key={library} label={library || "Other"}>
                  {list.map((c) => (
                    <NativeSelectOption key={c.name} value={c.name}>
                      {c.title}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
          </Field>
          <Field
            id="studio-type"
            label="Video type"
            hint={typeInfo?.description}
          >
            <NativeSelect
              id="studio-type"
              value={type}
              onChange={(e) => setType(e.target.value as VideoTypeId)}
              className="w-full"
            >
              {VIDEO_TYPES.map((t) => (
                <NativeSelectOption key={t.id} value={t.id}>
                  {t.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="studio-hook" label="Hook" hint={hookInfo?.description}>
            <NativeSelect
              id="studio-hook"
              value={hook}
              onChange={(e) => setHook(e.target.value as HookStyleId)}
              className="w-full"
            >
              {HOOK_STYLES.map((h) => (
                <NativeSelectOption key={h.id} value={h.id}>
                  {h.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="studio-audience" label="Audience">
            <NativeSelect
              id="studio-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as AudienceId)}
              className="w-full"
            >
              {AUDIENCES.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="studio-length" label="Length">
            <NativeSelect
              id="studio-length"
              value={length}
              onChange={(e) => setLength(Number(e.target.value) as LengthId)}
              className="w-full"
            >
              {LENGTHS.map((l) => (
                <NativeSelectOption key={l.id} value={l.id}>
                  {l.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field
            id="studio-ground"
            label="Look"
            hint="The ground behind the component. Auto builds it from the component's own colours."
          >
            <NativeSelect
              id="studio-ground"
              value={ground}
              onChange={(e) => setGround(e.target.value as GroundId)}
              className="w-full"
            >
              {GROUNDS.map((g) => (
                <NativeSelectOption key={g.id} value={g.id}>
                  {g.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field
            id="studio-references"
            label="Reference videos (optional)"
            hint={canSave ? REFERENCE_HINT.dev : REFERENCE_HINT.hosted}
          >
            <Textarea
              id="studio-references"
              value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
              placeholder="https://www.instagram.com/p/…"
              rows={3}
              disabled={!canSave}
              className="font-mono text-xs"
            />
          </Field>
          <Field
            id="studio-instructions"
            label="Instructions (optional)"
            hint="Anything the director should know: what to show, the mood, what to take from the references."
          >
            <Textarea
              id="studio-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Open on the dark theme, keep it calm, show the keyboard support…"
              rows={4}
              maxLength={2000}
            />
          </Field>
          <Button onClick={plan} disabled={directing || !item}>
            <Icon icon={Clapping01Icon} />
            {directing ? "Directing…" : "Plan with director"}
          </Button>
          {directing && (
            <p className="text-muted-foreground text-xs">{planningHint}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/5 flex gap-3 rounded-lg border p-4 text-sm"
          >
            <Icon
              icon={Alert02Icon}
              className="text-destructive mt-0.5 shrink-0"
            />
            <p className="whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {!result && !error && (
          <div className="text-muted-foreground flex min-h-64 items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm">
            The storyboard shows up here: every shot, its captions and what the
            cursor does.
          </div>
        )}

        {result && (
          <PlanResult
            canSave={canSave}
            fileName={fileName}
            json={json}
            result={result}
          />
        )}
      </div>
    </div>
  );
};
