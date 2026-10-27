"use client";

import {
  ArrowUpIcon,
  BrainIcon,
  ToolCaseIcon,
  TriangleAlertIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ToolCallCard } from "@/components/copper/tool-call-card";
import { SetupRequired } from "@/components/setup-required";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { readLive } from "@/lib/ai/live";
import { askCopper, type ChatMessage } from "@/lib/copper/assistant/ask";
import { type Progress, TOOL_LABELS } from "@/lib/copper/assistant/progress";
import { cn } from "@/lib/utils";

// Ask Copper: a floating button that opens a chat panel on the right (full
// width on phones). The header's "Ask Copper" link and /#ask open it too.

type Turn = ChatMessage & { progress?: Progress; usedTools?: boolean };

/**
 * Tools on and tools off are two separate conversations, so the tools-off
 * chat can't copy an answer the tools did the work for.
 */
type Session = "tools" | "noTools";

const MASCOT = "/assets/brand/copper-mascot.png";

const SUGGESTIONS = [
  "How much is Copper Home with Copper Plus, paid yearly, for 2 years?",
  "Is Copper Notes in Night Sky in stock?",
  "Is Copper Plus cheaper monthly or yearly?",
];

/** `ready` is false when there's no AI key. */
export function AskCopper({ ready }: { ready: boolean }) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<Record<Session, Turn[]>>({
    tools: [],
    noTools: [],
  });
  const [useTools, setUseTools] = useState(true);
  const session: Session = useTools ? "tools" : "noTools";
  const turns = sessions[session];
  // The answer being streamed, and the conversation it belongs to.
  const [live, setLive] = useState<{
    session: Session;
    progress: Progress;
  } | null>(null);

  // Open when the address ends in #ask (the header link, or a shared link).
  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === "#ask") setOpen(true);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    // Clicking the header link again when the address is already #ask fires no
    // hashchange, so watch the click too or the link only works once.
    const openFromClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(
        'a[href$="#ask"]',
      );
      if (link) setOpen(true);
    };
    document.addEventListener("click", openFromClick);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      document.removeEventListener("click", openFromClick);
    };
  }, []);

  function changeOpen(next: boolean) {
    setOpen(next);
    // Clear #ask on close, so the header link opens the panel again.
    if (!next && window.location.hash === "#ask") {
      history.replaceState(null, "", window.location.pathname);
    }
  }

  async function send(content: string) {
    if (!content || live) return;
    // The answer goes back to the conversation it was asked in, even if the
    // switch is flipped while Copper is working.
    const askedIn = session;
    const askedWithTools = useTools;
    const history: Turn[] = [...turns, { role: "user", content }];
    setSessions((all) => ({ ...all, [askedIn]: history }));
    let progress: Progress = { steps: [], reply: "", status: "working" };
    setLive({ session: askedIn, progress });
    try {
      const { progress: stream } = await askCopper({
        messages: history.map(({ role, content }) => ({ role, content })),
        useTools: askedWithTools,
      });
      // Each update carries everything so far, so the panel can just redraw.
      for await (const update of readLive(stream)) {
        progress = update;
        setLive({ session: askedIn, progress });
      }
    } catch {
      progress = {
        ...progress,
        reply: "Sorry, I couldn't answer that just now. Please try again.",
        status: "error",
      };
    }
    setSessions((all) => ({
      ...all,
      [askedIn]: [
        ...history,
        {
          role: "assistant",
          content: progress.reply,
          progress,
          usedTools: askedWithTools,
        },
      ],
    }));
    setLive(null);
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          data-testid="ask-copper-launcher"
          onClick={() => setOpen(true)}
          className="bg-foreground text-background animate-in fade-in slide-in-from-bottom-4 fixed right-4 bottom-4 z-40 flex items-center gap-2.5 rounded-full py-2 pr-5 pl-2 shadow-xl ring-2 ring-white/10 transition hover:-translate-y-0.5 hover:shadow-2xl sm:right-6 sm:bottom-6"
        >
          <span className="bg-primary relative flex size-10 items-center justify-center rounded-full">
            <Image
              src={MASCOT}
              alt="Copper the robot mascot"
              width={40}
              height={40}
              className="size-9"
            />
            <span className="bg-chart-4 ring-foreground absolute -top-0.5 -right-0.5 size-3 animate-pulse rounded-full ring-2" />
          </span>
          <span className="font-heading text-base font-bold">Ask Copper</span>
        </button>
      )}

      <Sheet open={open} onOpenChange={changeOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          data-testid="ask-copper"
          className="bg-secondary gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <header className="bg-foreground text-background px-5 pt-5 pb-4">
            <div className="flex items-start gap-3">
              <span className="bg-primary flex size-11 shrink-0 items-center justify-center rounded-full">
                <Image
                  src={MASCOT}
                  alt="Copper the robot mascot"
                  width={44}
                  height={44}
                  className="size-10"
                />
              </span>
              <div className="flex-1">
                <SheetTitle className="font-heading text-background text-xl font-extrabold">
                  Ask Copper
                </SheetTitle>
                <SheetDescription className="text-background/70 text-sm">
                  Prices, totals and stock, checked with tools.
                </SheetDescription>
              </div>
              <SheetClose
                aria-label="Close Ask Copper"
                className="text-background/70 hover:text-background rounded-md p-1 transition"
              >
                <XIcon className="size-5" />
              </SheetClose>
            </div>
            {ready && (
              <div className="bg-background/10 mt-4 flex items-center justify-between rounded-lg px-3 py-2">
                <Label htmlFor="use-tools" className="text-background">
                  Use tools
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-background/60 text-xs">
                    {useTools ? "Checks every answer" : "Model guesses alone"}
                  </span>
                  <Switch
                    id="use-tools"
                    checked={useTools}
                    onCheckedChange={setUseTools}
                  />
                </div>
              </div>
            )}
          </header>

          {ready ? (
            <Chat
              key={session}
              turns={turns}
              useTools={useTools}
              live={live?.session === session ? live.progress : null}
              onSend={send}
            />
          ) : (
            <div className="flex-1 overflow-y-auto px-4">
              <SetupRequired service="ai" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Chat({
  turns,
  useTools,
  live,
  onSend,
}: {
  turns: Turn[];
  useTools: boolean;
  /** The answer being streamed right now, if any. */
  live: Progress | null;
  onSend: (question: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo?.({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, live]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const content = question.trim();
    if (!content) return;
    setQuestion("");
    onSend(content);
  }

  return (
    <>
      <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-5">
        {turns.length === 0 && !live && (
          <div className="space-y-3">
            {useTools ? (
              <p className="text-muted-foreground text-sm">
                Try one of these, then watch Copper think, pick a tool and read
                what it sent back:
              </p>
            ) : (
              <p className="border-chart-3/40 bg-chart-3/10 rounded-lg border px-3 py-2 text-sm">
                <strong className="text-chart-3">Tools are off.</strong> This is
                a separate chat, so Copper can&apos;t copy answers from your
                tools-on chat. Ask the same questions and compare.
              </p>
            )}
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSend(suggestion)}
                className="bg-card hover:border-primary w-full rounded-xl border px-4 py-3 text-left text-sm transition"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <ol className="space-y-4" aria-live="polite">
          {turns.map((turn, i) =>
            turn.role === "user" ? (
              <li key={i} className="flex justify-end">
                <p className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm">
                  {turn.content}
                </p>
              </li>
            ) : (
              <li key={i}>
                <Answer
                  progress={turn.progress}
                  reply={turn.content}
                  usedTools={turn.usedTools}
                />
              </li>
            ),
          )}
          {live && (
            <li>
              <Answer progress={live} reply={live.reply} usedTools={useTools} />
            </li>
          )}
        </ol>

        {/* The same starters stay on offer between answers, so a shopper can
            keep going without thinking up a question. Hidden while an answer
            is streaming, so nothing moves under the cursor mid-reply. */}
        {turns.length > 0 && !live && (
          <div className="mt-5 space-y-2">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Ask another
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onSend(suggestion)}
                  className="bg-card hover:border-primary rounded-full border px-3 py-1.5 text-left text-xs transition"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={submit}
        className="bg-background flex items-center gap-2 border-t p-3"
      >
        <Input
          aria-label="Your question"
          placeholder="Ask about prices or stock…"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="h-11 rounded-full px-4"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          disabled={Boolean(live)}
          className="size-11 shrink-0 rounded-full"
        >
          <ArrowUpIcon className="size-5" />
        </Button>
      </form>
    </>
  );
}

/**
 * One answer from Copper, drawn as an assay line: each thing the model did is
 * a station on a copper rail, in the order it happened, ending with the
 * refined answer.
 */
function Answer({
  progress,
  reply,
  usedTools,
}: {
  progress?: Progress;
  reply: string;
  usedTools?: boolean;
}) {
  const steps = progress?.steps ?? [];
  const working = progress?.status === "working";
  const showLine = steps.length > 0 || working;
  const noTools = usedTools === false;
  let toolNumber = 0;

  return (
    <div className="space-y-3">
      {showLine && (
        <div className="relative space-y-3 pl-7">
          {/* The rail every station hangs off. */}
          <span
            aria-hidden
            className={cn(
              "absolute top-2 bottom-2 left-[11px] w-0.5 bg-gradient-to-b",
              noTools
                ? "from-chart-3/60 to-chart-3/20"
                : "from-primary via-accent to-accent/30",
            )}
          />

          <Station
            icon={<ToolCaseIcon className="size-3.5" />}
            label={
              noTools ? "Tools given to Copper: none" : "Tools Copper can use"
            }
            tone={noTools ? "warning" : "accent"}
          >
            <div className="flex flex-wrap gap-1">
              {Object.keys(TOOL_LABELS).map((name) => {
                const used = steps.some(
                  (step) => step.type === "tool" && step.name === name,
                );
                return (
                  <code
                    key={name}
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[10px] transition",
                      noTools && "text-muted-foreground/60 line-through",
                      !noTools &&
                        (used
                          ? "bg-accent text-background font-bold"
                          : "bg-muted text-muted-foreground"),
                    )}
                  >
                    {name}
                  </code>
                );
              })}
            </div>
            {noTools && (
              <p className="text-muted-foreground mt-1 text-xs">
                Copper has to answer from memory alone.
              </p>
            )}
          </Station>

          {steps.map((step, i) =>
            step.type === "thinking" ? (
              <Station
                key={i}
                icon={<BrainIcon className="size-3.5" />}
                label="Copper is thinking"
                tone={noTools ? "warning" : "primary"}
              >
                <p
                  data-testid="thinking"
                  className={cn(
                    "text-muted-foreground border-l-2 pl-3 text-sm whitespace-pre-wrap italic",
                    noTools ? "border-chart-3/40" : "border-primary/30",
                  )}
                >
                  <Thought text={step.text} />
                </p>
              </Station>
            ) : (
              <Station
                key={i}
                icon={<WrenchIcon className="size-3.5" />}
                label={
                  step.state === "calling"
                    ? "Copper is calling a tool"
                    : "Copper called a tool"
                }
              >
                <ToolCallCard step={step} number={++toolNumber} />
              </Station>
            ),
          )}

          {working && (
            <Station icon={<Dots />} label="" pulse>
              <p className="text-muted-foreground text-sm">
                {steps.length === 0
                  ? "Reading your question…"
                  : reply
                    ? "Writing the answer…"
                    : noTools
                      ? "Answering from memory…"
                      : "Deciding what to do next…"}
              </p>
            </Station>
          )}
        </div>
      )}

      {(reply || !working) && (
        <div className="bg-card max-w-[92%] rounded-2xl rounded-bl-sm border px-4 py-3 shadow-sm">
          <p className="text-primary mb-1 text-xs font-bold tracking-wide">
            Copper
          </p>
          {usedTools === false && (
            <div className="border-chart-3/40 bg-chart-3/10 mb-2 rounded-lg border px-3 py-2 text-xs">
              <p className="text-chart-3 flex items-center gap-1.5 font-semibold">
                <TriangleAlertIcon aria-hidden className="size-3.5" />
                Answered without tools: may be made up
              </p>
              <p className="text-muted-foreground mt-1">
                With tools off, Copper can&apos;t see today&apos;s prices or
                stock. The AI only has what it learned in training, so it fills
                the gaps with guesses that sound right. That&apos;s a
                hallucination.
              </p>
            </div>
          )}
          <p className="whitespace-pre-wrap">
            {reply}
            {working && <Caret />}
          </p>
        </div>
      )}
    </div>
  );
}

/** One stop on the assay line: a node on the rail, a label and its contents. */
function Station({
  icon,
  label,
  children,
  tone = "accent",
  pulse = false,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  tone?: "accent" | "primary" | "warning";
  pulse?: boolean;
}) {
  const nodeColor = {
    accent: "bg-accent text-background",
    primary: "bg-primary text-primary-foreground",
    warning: "bg-chart-3 text-background",
  }[tone];
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 relative duration-300">
      <span
        aria-hidden
        className={cn(
          "ring-secondary absolute top-0.5 -left-7 flex size-6 items-center justify-center rounded-full ring-4",
          nodeColor,
          pulse && "animate-pulse",
        )}
      >
        {icon}
      </span>
      {label && (
        <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-[0.16em] uppercase">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}

/** The three dots that show Copper is still working. */
function Dots() {
  return (
    <span className="flex gap-0.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          style={{ animationDelay: `${delay}ms` }}
          className="bg-background size-1 animate-bounce rounded-full"
        />
      ))}
    </span>
  );
}

/** The blinking block at the end of text that's still arriving. */
function Caret() {
  return (
    <span
      aria-hidden
      className="bg-primary ml-0.5 inline-block h-4 w-1.5 animate-pulse align-middle"
    />
  );
}

/**
 * Gemini writes its thought summaries in markdown: **bold headings** and
 * `code` for the names it is working with. Show those rather than the marks.
 */
function Thought({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="text-foreground not-italic">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="text-primary font-mono not-italic">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </>
  );
}
