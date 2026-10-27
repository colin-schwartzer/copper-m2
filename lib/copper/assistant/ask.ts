"use server";

// Module 2: the server action the Ask Copper chat calls. It streams the
// conversation to the model through callStream (lib/ai/call.ts), with or
// without the tools, and sends back each step as it happens. The contract is
// in specs/module-2/spec.md.
import { stepCountIs } from "ai";
import { callStream, THOUGHT_SUMMARIES } from "@/lib/ai/call";
import { createLive, type Live } from "@/lib/ai/live";
import { COPPER_INSTRUCTIONS } from "@/lib/copper/assistant/instructions";
import type { Progress, ToolStep } from "@/lib/copper/assistant/progress";
import { copperTools } from "@/lib/copper/assistant/tools";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ToolCallRecord = { name: string; input: unknown; output: unknown };

export type AskCopperRequest = {
  messages: ChatMessage[];
  useTools: boolean;
};

export type AskCopperResult = { progress: Live<Progress> };

/** At most this many model steps (tool calls plus the reply) per question. */
const MAX_STEPS = 5;

const NO_ANSWER = "Sorry, I couldn't come up with an answer. Please try again.";
const FAILED = "Sorry, I couldn't answer that just now. Please try again.";

export async function askCopper({
  messages,
  useTools,
}: AskCopperRequest): Promise<AskCopperResult> {
  const live = createLive<Progress>();
  const progress: Progress = { steps: [], reply: "", status: "working" };
  const send = () => live.update(structuredClone(progress));

  const toolStep = (id: string, name: string) => {
    let step = progress.steps.find(
      (s): s is ToolStep => s.type === "tool" && s.id === id,
    );
    if (!step) {
      step = { type: "tool", id, name, state: "calling" };
      progress.steps.push(step);
    }
    return step;
  };

  // Keeps running after the action returns, sending each step as it arrives.
  void (async () => {
    try {
      const result = callStream(
        { module: 2, feature: "ask-copper" },
        {
          messages,
          providerOptions: THOUGHT_SUMMARIES,
          // Tools off means no instructions either: the model gets the bare
          // question, with nothing telling it to check anything.
          ...(useTools
            ? {
                instructions: COPPER_INSTRUCTIONS,
                tools: copperTools,
                stopWhen: stepCountIs(MAX_STEPS),
              }
            : {}),
        },
      );
      for await (const part of result.fullStream) {
        switch (part.type) {
          case "reasoning-delta": {
            const last = progress.steps.at(-1);
            if (last?.type === "thinking") last.text += part.text;
            else progress.steps.push({ type: "thinking", text: part.text });
            break;
          }
          case "tool-input-start":
            toolStep(part.id, part.toolName);
            break;
          case "tool-call":
            toolStep(part.toolCallId, part.toolName).input = part.input;
            break;
          case "tool-result": {
            const step = toolStep(part.toolCallId, part.toolName);
            step.output = part.output;
            step.state = "done";
            break;
          }
          case "tool-error": {
            const step = toolStep(part.toolCallId, part.toolName);
            step.output = String(part.error);
            step.state = "error";
            break;
          }
          case "text-start":
            if (progress.reply) progress.reply += "\n\n";
            continue;
          case "text-delta":
            progress.reply += part.text;
            break;
          case "error":
            throw part.error;
          default:
            continue;
        }
        send();
      }
      progress.reply = progress.reply.trim() || NO_ANSWER;
      progress.status = "done";
    } catch {
      progress.reply = progress.reply.trim() || FAILED;
      progress.status = "error";
    }
    live.done(structuredClone(progress));
  })();

  return { progress: live.live };
}
