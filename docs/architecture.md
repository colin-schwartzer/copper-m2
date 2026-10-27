# Architecture

How the Copper State Labs app fits together. Each module adds a section at the
end (see [Adding a module](#adding-a-module)) when it changes how the app
works: new pages, tables or AI calls.

_Fictional — for educational use._

## The starter app (Module 0)

A Next.js app that builds, runs and deploys with **no environment variables**.
A Google AI Studio key is optional until a module needs one.

| Piece | Where | What it does |
|---|---|---|
| Pages | `app/` | `layout.tsx` sets the fonts and theme; `page.tsx` is the placeholder home page |
| Brand components | `components/copper/` | `Logo`, `SiteHeader`, `SiteFooter`, `ModeToggle` |
| UI kit | `components/ui/` (shadcn), `components/ai-elements/` (AI Elements) | The only UI libraries the app uses |
| Setup card | `components/setup-required.tsx` | `<SetupRequired service="ai" />`, shown instead of a page whose service isn't configured |
| Company catalog | `lib/copper/catalog.ts`, `lib/copper/data/catalog.json` | Product, plan and privacy facts from the Product Bible (Sections 3, 4, 8 and 10). Pages read prices and plan details from here instead of typing them (added in the Module 1 starter) |
| AI wrapper | `lib/ai/call.ts` | `callText` and `callObject`: every model call goes through these and is logged to the terminal |
| Models and prices | `lib/ai/models.ts`, `lib/ai/pricing.ts` | The approved Gemini models and their token prices |
| Module checks | `specs/module-N/`, `scripts/check.mjs` | Each module's spec, instructions, rubric and acceptance tests; `npm run check` runs them |

## Data flow

1. A user opens a page in `app/`.
2. Server code checks what's configured (`isAiConfigured()`). If the key is
   missing, the page renders `<SetupRequired />` instead of crashing.
3. Data comes from files under `lib/copper/data/`.
4. AI requests go through `callText` / `callObject` in `lib/ai/call.ts`, which
   calls Google and then prints one `[ai_calls]` line: `module`, `feature`,
   `model`, tokens, `cost_usd`, `latency_ms`, `ok`.

```ts
const { text } = await callText(
  { module: 2, feature: "ask-copper" },
  { prompt },
);
```

## Two kinds of "AI tiers"

Don't mix these up:

- **Copper State Labs' product tiers** (On-device, Raw Ore, Refined, the
  Copper Cloud) are part of the fictional company. They are facts in the
  [Product Bible](copper-state-labs/product-bible.md) and rows in the `ai_tiers`
  table.
- **The models this app calls** are real Claude models listed in
  `lib/ai/models.ts`. Their cost is logged in `ai_calls`.

## Decisions

- **No environment variables required.** Every service is optional, so a fresh
  clone builds and deploys before any accounts are set up.
- **One AI wrapper.** Routing every call through `lib/ai/call.ts` gives one
  place to log cost and latency per module and feature.
- **No authentication or row-level security yet.** They arrive in a later
  module.

## Adding a module

When a module changes how the app fits together, add a section here:

```md
## Module N: <feature name>

**Summary:** one or two sentences: what this adds and why.

| Piece | Where | What it does |
|---|---|---|
| Page / route | `app/...` | |
| Components | `components/...` | |
| Data | `lib/copper/data/...` | Data files added |
| AI calls | `lib/ai/call.ts` (module, feature) | Model, prompt purpose, expected cost per call |

**Data flow:** user action → page → server code → database / model → response.

**Decisions and trade-offs:** what you chose, the alternatives, and why.

**Risks and open questions:** cost, privacy, accuracy or safety risks, and how
you handle them.
```

## Module 2: Ask Copper

**Summary:** a floating chat panel that answers price and stock questions by
calling three read-only tools, and streams every step of the agent loop into
the page so shoppers (and students) can see how the answer was found.

| Piece | Where | What it does |
|---|---|---|
| Widget | `components/copper/ask-copper.tsx` | The launcher, the side panel (shadcn `Sheet`), the Use tools switch, and the assay line of stations |
| Tool card | `components/copper/tool-call-card.tsx` | One tool call: what Copper sent above what came back |
| Page | `app/page.tsx` | Renders `<AskCopper ready={isAiConfigured()} />` after the footer. Still the only page |
| Server Action | `lib/copper/assistant/ask.ts` | `askCopper({ messages, useTools })` → `{ progress }`, a live value the page reads update by update |
| Progress | `lib/copper/assistant/progress.ts` | The steps and reply the panel draws, plus `TOOL_LABELS` |
| Live values | `lib/ai/live.ts` | `createLive()` / `readLive()`: a chain of promises, so a Server Action can stream without an API route |
| Streaming calls | `lib/ai/call.ts` | `callStream()` (logged to `ai_calls` like `callText`) and `THOUGHT_SUMMARIES` |
| Tools | `lib/copper/assistant/tools.ts` | `get_products`, `get_prices` and `calculate_cost` (from `lib/copper/catalog.ts`), `check_availability` (from `lib/copper/inventory.ts`) |
| Instructions | `lib/copper/assistant/instructions.ts` | Copper's system prompt: voice, always use tools, prices and stock only |
| Data | `lib/copper/inventory.ts`, `lib/copper/data/inventory.json` | `readInventory()` over stock rows: `sku`, `product`, `color`, `units_in_stock`, `next_shipment`. Named like the database columns it moves to in a later module |
| AI calls | `lib/ai/call.ts` (module 2, `ask-copper`) | Gemini 2.5 Flash by default, up to 5 steps per question, about $0.0005 each |

**Data flow:** shopper types a question → the panel calls the `askCopper`
Server Action with that chat's history → `callStream` streams it to the model
with the tools → the model thinks, calls tools, the app runs them (catalog or
stock list) and returns results → each change is sent to the page as an update →
the panel redraws the stations, then types out the reply.

**Decisions and trade-offs:**
- A Server Action returning a chain of promises, not an API route, keeps the
  site a single page (Module 1's AC-1.4).
- Each update carries the whole state so far, so the panel just redraws and a
  missed update loses nothing.
- Tools on and tools off are separate conversations, and tools off sends no
  instructions either. Sharing a conversation would let the tools-off model copy
  an answer the tools worked out, and a shared system prompt would make the
  comparison about the prompt rather than the tools; both would hide the
  hallucination the module is trying to show.
- Gemini 2.5 Flash with a thinking budget, because it writes a thought summary
  for every question; newer models often skip thinking on easy ones.
- Stock rules (back-ordered at 0, low under 10) live in code, not the prompt,
  so they're tested and the model can't bend them.

**Risks and open questions:** the thinking station shows the model's own words,
including its mistakes, which is honest but exposes internals to customers.
Stock is only as right as `inventory.json`, which nothing keeps in step with a
real warehouse. Tools are read-only, so a wrong answer can't change anything.
