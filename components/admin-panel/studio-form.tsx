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
import type { DirectResult } from "@/lib/studio/director";
import {
  AUDIENCES,
  HOOK_STYLES,
  LENGTHS,
  VIDEO_TYPES,
} from "@/lib/studio/options";
import type {
  AudienceId,
  HookStyleId,
  LengthId,
  StudioComponentOption,
  VideoTypeId,
} from "@/lib/studio/options";
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
  const [length, setLength] = useState<LengthId>(30);
  const [result, setResult] = useState<DirectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [directing, startDirecting] = useTransition();
  const [saving, startSaving] = useTransition();

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
      const answer = await directVideo({ audience, hook, item, length, type });
      if ("error" in answer) {
        setError(answer.error);
        return;
      }
      setResult(answer.result);
    });
  };

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
    if (!result) {
      return;
    }
    startSaving(async () => {
      const answer = await saveStoryboard(result.spec);
      if ("error" in answer) {
        toast.error(answer.error);
        return;
      }
      toast.success(`Saved reels/specs/${answer.name}.json`);
    });
  };

  const typeInfo = VIDEO_TYPES.find((t) => t.id === type);
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
          <Button onClick={plan} disabled={directing || !item}>
            <Icon icon={Clapping01Icon} />
            {directing ? "Directing…" : "Plan with director"}
          </Button>
          {directing && (
            <p className="text-muted-foreground text-xs">
              Claude is reading the component and planning. This usually takes
              under a minute.
            </p>
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
          <Tabs defaultValue="storyboard" className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="storyboard">Storyboard</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={save}
                    disabled={saving}
                  >
                    <Icon icon={FloppyDiskIcon} />
                    {saving ? "Saving…" : "Save to reels/specs"}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{result.spec.title}</span>
              <Badge variant="secondary">{result.spec.type}</Badge>
              <Badge variant="secondary">
                about {Math.round(result.estimateSeconds)} s
              </Badge>
              <Badge variant="secondary">
                {result.spec.shots.length} shots
              </Badge>
              <Badge variant="outline">{result.model}</Badge>
            </div>

            {canSave && <StudioRender key={json} spec={result.spec} />}

            <TabsContent value="storyboard" className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm leading-relaxed">
                {result.notes}
              </p>
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

            <TabsContent value="json">
              <pre className="bg-muted max-h-[70vh] overflow-auto rounded-lg p-4 font-mono text-xs leading-relaxed">
                {json}
              </pre>
              {canSave && (
                <p className="text-muted-foreground mt-2 text-xs">
                  Saving writes reels/specs/{fileName} (replacing one with that
                  name). Then{" "}
                  <code className="font-mono">
                    pnpm video {fileName.replace(/\.json$/, "")}
                  </code>{" "}
                  films it.
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};
