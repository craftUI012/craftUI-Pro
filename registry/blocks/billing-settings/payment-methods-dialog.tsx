"use client";

import {
  Cancel01Icon,
  CreditCardIcon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useLayoutEffect, useRef, useState } from "react";
import useMeasure from "react-use-measure";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useBillingActions } from "./actions";
import { AddCardForm } from "./add-card-form";
import { MOTION, stepVariants } from "./billing-motion";
import { canCharge, describe } from "./card-data";
import { CardEditor } from "./card-editor";
import { AddCardButton, CardSlot, EmptySlot } from "./card-slot";
import { RollingLabel, StatusButton, useButtonState } from "./status-button";
import { UndoToast } from "./undo-toast";
import { useCardDraft } from "./use-card-draft";
import type { CardBook } from "./use-card-draft";
import { WALLETS, WalletLogo, WalletPanel } from "./wallets";
import type { WalletId, WalletState } from "./wallets";

export type { CardBook } from "./use-card-draft";

/* ─────────────────────────────────────────────────────────
 * PAYMENT METHODS DIALOG
 *
 *   ┌ Payment methods ─────────────────────────────────── × ┐
 *   │ [ ▭ Cards 3/4 | PayPal | Apple Pay | Google Pay ]       │
 *   │ ┌ Saved cards                                  [Edit] ┐ │
 *   │ │ [VISA Default ●]   [MC Backup ○]                   │ │
 *   │ │ [AMEX Expired  ]   ╎ + Add card ╎                  │ │
 *   │ └────────────────────────────────────────────────────┘ │
 *   │ 🔒 Encrypted by Stripe (or Undo toast)   Cancel [Save] │
 *   └─────────────────────────────────────────────────────────┘
 *
 *   method tabs   tiles, icon over label; the chosen one is lifted at
 *                 once (frequent: no sliding); Cards shows 3/4 used
 *   panel         the tray's height follows its content (react-use-measure,
 *                 MOTION.morph spring 0.23s b0, held at auto until the
 *                 dialog has opened) while panels swap with a blur
 *                 cross-fade (stepVariants)
 *   cards         choose = default (pills stay; words roll), Add card
 *                 and Edit happen in the slot itself, remove = instant
 *                 + Undo, Retry / Update on unhealthy cards
 *   wallets       not set up = a dashed slot with Connect; connected =
 *                 a lifted row with Disconnect
 *
 * Cards are a draft until Save. Wallets connect on their own.
 * All durations and curves: billing-motion.ts.
 * ───────────────────────────────────────────────────────── */

const SLOTS = 4;

const OVERLAY_MOTION =
  "bg-black/40 dark:bg-black/60 ease-[cubic-bezier(0.23,1,0.32,1)] data-[state=open]:duration-[250ms] data-[state=closed]:duration-[150ms]";

const PANEL_MOTION = [
  "data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0 fade-out-0",
  "ease-[cubic-bezier(0.23,1,0.32,1)] data-[state=open]:duration-[250ms] data-[state=closed]:duration-[150ms]",
  "[--tw-enter-scale:0.95] [--tw-enter-translate-y:8px] [--tw-exit-scale:0.98]",
  "motion-reduce:[--tw-enter-scale:1] motion-reduce:[--tw-enter-translate-y:0] motion-reduce:[--tw-exit-scale:1]",
].join(" ");

const FLOAT =
  "border border-transparent shadow-[0_2px_4px_-1px_oklch(0_0_0/0.06),0_8px_16px_-4px_oklch(0_0_0/0.1),0_16px_32px_-8px_oklch(0_0_0/0.14)] dark:shadow-[0_12px_24px_-4px_oklch(0_0_0/0.5)]";

type Method = "cards" | WalletId;

const METHODS: Method[] = ["cards", "paypal", "apple", "google"];

const arrowStep = (key: string) =>
  ({ ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1 })[key];

// Sits left of Cancel / Save; the Undo toast takes its place while it
// shows, then the note comes back (cross-fade, popLayout).
const TrustNote = () => (
  <motion.p
    initial={{ opacity: 0 }}
    animate={{ opacity: 1, transition: MOTION.enter }}
    exit={{ opacity: 0, transition: MOTION.exit }}
    className="text-muted-foreground flex items-center gap-1.5 text-xs text-pretty"
  >
    <HugeiconsIcon
      icon={SquareLock02Icon}
      strokeWidth={1.75}
      className="size-3.5 shrink-0"
    />
    Card details are encrypted and stored by Stripe. We never see your full
    number.
  </motion.p>
);

const removalDetail = (wasBackup: boolean) =>
  wasBackup
    ? "It was your backup. Failed payments won't be retried on another card."
    : "Nothing changes for your plan.";

// The method switcher: tiles, icon over label (as in the checkout
// button). Switching is frequent, so the chosen tile changes at once:
// lifted, on the background colour. No sliding indicator.
const TILE = [
  "relative h-14 flex-1 flex-col gap-1 rounded-xl border-transparent px-2 text-xs font-normal",
  "transition-[color,background-color,box-shadow] duration-150 ease-out",
  "not-data-active:bg-muted/60 not-data-active:text-muted-foreground dark:not-data-active:bg-muted/30",
  "not-data-active:hover:bg-muted not-data-active:hover:text-foreground",
  "data-active:bg-background data-active:text-foreground dark:data-active:bg-muted dark:data-active:border-transparent",
  "data-active:shadow-[0_1px_2px_0_oklch(0_0_0/0.05),0_2px_8px_-2px_oklch(0_0_0/0.08),0_8px_24px_-8px_oklch(0_0_0/0.08)] dark:data-active:shadow-none",
].join(" ");

const MethodTabs = ({
  cardCount,
  wallets,
}: {
  cardCount: number;
  wallets: WalletState;
}) => (
  <TabsList className="grid h-auto w-full grid-cols-4 gap-2 bg-transparent p-0">
    {METHODS.map((each) => (
      <TabsTrigger key={each} value={each} className={TILE}>
        {each === "cards" ? (
          <HugeiconsIcon
            icon={CreditCardIcon}
            strokeWidth={1.75}
            className="size-[18px]"
          />
        ) : (
          <WalletLogo id={each} className="size-[18px]" />
        )}
        <span className="leading-none">
          {each === "cards" ? "Cards" : WALLETS[each].label}
        </span>
        {each === "cards" ? (
          <span className="text-muted-foreground absolute top-1.5 right-2 text-xs leading-none tabular-nums">
            {cardCount}/{SLOTS}
            <span className="sr-only"> cards saved</span>
          </span>
        ) : null}
        {each !== "cards" && wallets[each] ? (
          <span className="sr-only">, connected</span>
        ) : null}
      </TabsTrigger>
    ))}
  </TabsList>
);

export const PaymentMethodsDialog = ({
  open,
  onOpenChange,
  saved,
  onSave,
  initialWallets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: CardBook;
  onSave: (next: CardBook) => void;
  /** Connected wallets when the dialog first opens (null = not set up). */
  initialWallets: WalletState;
}) => {
  const actions = useBillingActions();
  const reduce = useReducedMotion();
  const draft = useCardDraft(saved);
  const { book } = draft;
  const [method, setMethod] = useState<Method>("cards");
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [wallets, setWallets] = useState<WalletState>(initialWallets);
  const [state, run] = useButtonState();
  // Height stays "auto" until the dialog has finished opening, so the
  // first measure never fights the opening scale.
  const [opened, setOpened] = useState(false);
  // The tray: measure the inner div, animate the outer to its height.
  // offsetSize: layout size, not the on-screen box, so the dialog's
  // opening scale (0.95 → 1) doesn't shrink the first measure.
  const [ref, bounds] = useMeasure({ offsetSize: true });
  const opener = useRef<HTMLElement | null>(null);
  const latest = useRef(saved);
  latest.current = saved;

  // Each opening starts from what's saved, on the Cards tab (reset on
  // open, not on close, so nothing jumps while the panel fades out).
  useLayoutEffect(() => {
    if (open) {
      draft.reset(latest.current);
      setMethod("cards");
      setEditMode(false);
      setEditingId(null);
      setAdding(false);
      opener.current = document.activeElement as HTMLElement | null;
    } else {
      setOpened(false);
    }
    // Only an opening resets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choosable = book.cards.filter(canCharge);
  const empties = Math.max(0, SLOTS - book.cards.length);
  const move = reduce ? { duration: 0 } : MOTION.layout;
  const swapStep = stepVariants(Boolean(reduce));

  const openEditor = (id: string) => {
    setEditMode(true);
    setEditingId((value) => (value === id ? null : id));
  };

  const cardsPanel = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 pl-1">
        <p className="text-sm font-medium">Saved cards</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Edit cards"
            aria-pressed={editMode}
            onClick={() => {
              setEditMode((on) => !on);
              setEditingId(null);
            }}
            className="h-7 px-2"
          >
            <RollingLabel
              state="idle"
              labels={{ idle: editMode ? "Done" : "Edit" }}
              reserve={["Edit", "Done"]}
            />
          </Button>
        </div>
      </div>

      {/* A radiogroup to choose; a plain group while editing. */}
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        role={editMode ? "group" : "radiogroup"}
        aria-label={editMode ? "Saved cards" : "Default card"}
        onKeyDown={(event) => {
          const step = editMode ? undefined : arrowStep(event.key);
          if (!step || choosable.length === 0) {
            return;
          }
          event.preventDefault();
          const at = choosable.findIndex((card) => card.id === book.defaultId);
          const next =
            choosable[(at + step + choosable.length) % choosable.length];
          if (next) {
            draft.choose(next.id);
            event.currentTarget
              .querySelector<HTMLElement>(`[data-card="${next.id}"]`)
              ?.focus();
          }
        }}
        // relative: popLayout lifts a leaving card out against it.
        className="relative grid gap-3 sm:grid-cols-2"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {book.cards.map((card) => (
            <motion.div
              key={card.id}
              // Position only: a slot that grows into an editor must not
              // be scaled (text would stretch); its neighbours glide.
              layout="position"
              initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...MOTION.enter, layout: move }}
              exit={
                reduce
                  ? { opacity: 0, transition: MOTION.exit }
                  : {
                      filter: "blur(4px)",
                      opacity: 0,
                      scale: 0.92,
                      transition: MOTION.leave,
                    }
              }
              className="relative"
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={card.id === editingId ? "edit" : "face"}
                  {...swapStep}
                >
                  {card.id === editingId ? (
                    <CardEditor
                      card={card}
                      isDefault={card.id === book.defaultId}
                      isBackup={card.id === book.backupId}
                      onCancel={() => setEditingId(null)}
                      onUpdate={(edit) => {
                        draft.update(card.id, edit);
                        setEditingId(null);
                      }}
                    />
                  ) : (
                    <CardSlot
                      card={card}
                      isDefault={card.id === book.defaultId}
                      isBackup={card.id === book.backupId}
                      editMode={editMode}
                      editing={false}
                      onSelect={() => draft.choose(card.id)}
                      onEdit={() => openEditor(card.id)}
                      onRemove={() => draft.remove(card.id)}
                      onRetry={async () => {
                        const update = await actions.retryCard(card);
                        draft.retried(card.id, update);
                      }}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          ))}
          {Array.from({ length: empties }, (_, index) => (
            <motion.div
              // Empty slots are positions, not things.
              // oxlint-disable-next-line react/no-array-index-key
              key={`empty-${index}`}
              layout="position"
              initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: MOTION.exit }}
              transition={{
                default: { ...MOTION.enter, delay: 0.12 },
                layout: move,
              }}
            >
              {index === 0 && adding ? (
                <AddCardForm
                  onCancel={() => setAdding(false)}
                  onAdded={(card) => {
                    draft.add(card);
                    setAdding(false);
                  }}
                />
              ) : (
                <EmptySlot>
                  {index === 0 ? (
                    <AddCardButton onClick={() => setAdding(true)} />
                  ) : null}
                </EmptySlot>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={OVERLAY_MOTION} />
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => {
            // Start on the method switcher: pick what to work on first.
            event.preventDefault();
            (event.currentTarget as HTMLElement)
              .querySelector<HTMLElement>("[role=tab][data-active]")
              ?.focus();
          }}
          onAnimationEnd={(event) => {
            // Only the panel's own opening animation, not its children's.
            if (event.target === event.currentTarget && open) {
              setOpened(true);
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          className={cn(
            FLOAT,
            PANEL_MOTION,
            "bg-background dark:bg-card fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto overscroll-contain rounded-2xl p-5 outline-none sm:max-w-3xl"
          )}
        >
          <TooltipProvider delay={200}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <DialogTitle className="text-lg font-medium">
                  Payment methods
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm">
                  Choose how you pay: a saved card or a wallet.
                </DialogDescription>
              </div>
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close"
                  className="-mt-1 -mr-1 size-8"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    strokeWidth={1.75}
                    className="size-4"
                  />
                </Button>
              </DialogPrimitive.Close>
            </div>

            <Tabs
              value={method}
              onValueChange={(value) => setMethod(value as Method)}
              className="gap-3"
            >
              <MethodTabs cardCount={book.cards.length} wallets={wallets} />

              {/* The tray eases to each panel's height. */}
              <motion.div
                animate={{
                  height:
                    reduce || !opened || bounds.height === 0
                      ? "auto"
                      : bounds.height,
                }}
                transition={MOTION.morph}
                className="bg-muted/60 dark:bg-muted/30 overflow-hidden rounded-2xl"
              >
                <div ref={ref} className="relative p-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.div key={method} {...swapStep}>
                      {/* keepMounted + hidden={false}: the leaving panel stays
                          visible while it fades out (Base UI would hide it). */}
                      <TabsContent
                        value={method}
                        keepMounted
                        render={(props) => <div {...props} hidden={false} />}
                      >
                        {method === "cards" ? (
                          cardsPanel
                        ) : (
                          <WalletPanel
                            id={method}
                            account={wallets[method]}
                            onChange={(account) =>
                              setWallets((value) => ({
                                ...value,
                                [method]: account,
                              }))
                            }
                          />
                        )}
                      </TabsContent>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </Tabs>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex min-h-9 items-center">
                <AnimatePresence initial={false} mode="popLayout">
                  {draft.removed ? (
                    <UndoToast
                      key={draft.removed.key}
                      message={`${describe(draft.removed.card)} removed.`}
                      detail={removalDetail(draft.removed.wasBackup)}
                      onUndo={draft.undo}
                      onDone={draft.clearRemoved}
                    />
                  ) : (
                    <TrustNote key="trust" />
                  )}
                </AnimatePresence>
              </div>
              <div className="flex justify-end gap-2">
                <DialogPrimitive.Close asChild>
                  <Button type="button" variant="ghost" size="sm">
                    Cancel
                  </Button>
                </DialogPrimitive.Close>
                <StatusButton
                  type="button"
                  size="sm"
                  state={state}
                  labels={{ busy: "Saving…", done: "Saved", idle: "Save" }}
                  onClick={async () => {
                    if (await run(() => actions.saveCards(book))) {
                      onSave(book);
                      setTimeout(() => onOpenChange(false), 450);
                    }
                  }}
                />
              </div>
            </div>
          </TooltipProvider>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};
