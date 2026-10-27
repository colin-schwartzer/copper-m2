# Module 2: Ask Copper, the shopping chatbot

_Fictional — for educational use._

Shoppers on the Copper State Labs site keep asking what things cost and what's in stock. **Ask Copper** is the answer: a chat panel that uses **tools** (small pieces of code that look up prices, do the math and check stock) instead of guessing.

The panel shows its work. As the answer arrives, you watch Copper pick a tool, send it numbers, read the result and write the reply. By the end you'll be able to explain exactly what a tool is, and show someone what happens without one.

**This module comes built.** You don't write the chatbot — it's already here, passing all 27 checks. Your job is to run it, read it, break it on purpose and write up what you find. The requirements it was built against are in **`specs/module-2/spec.md`**, and the code is yours to read and change.

| | |
|---|---|
| **You'll do** | Run it, compare tools on vs. off, change the stock data, and write your report |
| **Your repo** | `copper-m2` (public, on your GitHub account; a new repo, separate from `copper-m1`) |
| **Points** | 75 from tests (already passing), plus 10 for your report (a TA) and 15 for the live site |
| **Submit** | Your repo link, your Vercel link, and a screenshot of `npm run check` (see [What to submit](#what-to-submit)) |

---

## Before you start

- Module 1 is done: you have a `copper-m1` repo and a live Vercel site.
- Your tools still work: `node --version` starts with v24, and `gh auth status` says you're logged in.
- You have a **Google AI Studio API key**: sign in at [aistudio.google.com](https://aistudio.google.com), click **Get API key**, and copy it. It's free and needs no credit card. It's the only key this module uses.

## Step 1: Get the code and make it yours

```bash
cd ~/Developer        # or wherever you keep your projects
git clone --branch module-2-part-1 https://github.com/CIS-591/class-examples.git copper-m2
cd copper-m2
npm run start-module  # creates github.com/YOUR-USERNAME/copper-m2 (public)
npm ci
```

Check that it arrived in one piece:

```bash
npm run check
```

**27 of 27.** All of Module 1, and all fifteen of Module 2. `REPORT` and `DEPLOY` show as "checked later" — those two are yours to earn in Steps 4 and 7.

## Step 2: Run it

1. Create a file called `.env.local` in the `copper-m2` folder with one line in it:

   ```
   GOOGLE_GENERATIVE_AI_API_KEY=paste-your-key-here
   ```

   Never commit this file. It's already in `.gitignore`.
2. `npm run dev`, open http://localhost:3000, and click **Ask Copper** at the bottom right.
3. Ask: *"How much is Copper Home with Copper Plus, paid yearly, for 2 years?"*

Watch the four stations appear in order: the tools Copper could choose from, what it was thinking, the tool it called with what it sent and what came back, then the answer. It should come to **$307**.

Then try these:

- *"Is Copper Notes in Night Sky in stock?"* — calls `check_availability`, which reads `lib/copper/data/inventory.json`.
- *"What colors does Copper Home come in?"* — calls `get_products`, straight from the catalog, without looking at stock at all.
- *"Is Copper Notes in Patina Teal in stock?"* — there's no such color, and Copper says so rather than guessing.
- *"How long is the warranty?"* — out of scope, so Copper points you to the Copper Crew.

Each question's cost and time print in the terminal running `npm run dev`, on a line starting `[ai_calls]`. They're fractions of a cent.

## Step 3: Read how it works

Five files do the whole job. Read them in this order — it's the order the answer travels:

| File | What to look for |
|---|---|
| `lib/copper/assistant/tools.ts` | The four tools. Each has a description the model reads, a zod schema that rejects bad input, and an `execute` that runs your code. Notice no price is typed in: they all come from the catalog |
| `lib/copper/assistant/instructions.ts` | Copper's instructions, in plain English. This is the difference between a chatbot that checks and one that guesses |
| `lib/copper/assistant/ask.ts` | The Server Action. It streams, and builds up a `Progress` as each part arrives |
| `components/copper/ask-copper.tsx` | The panel: the two chats, the **Use tools** switch, and the stations |
| `components/copper/tool-call-card.tsx` | One tool call, drawn open: what Copper sent, and what came back |

Ask your AI agent to walk you through any of them. A good prompt:

```
Read lib/copper/assistant/tools.ts and explain calculate_cost to me as if I
don't code. What does the zod schema stop the model from doing, and why does
Copper Plus only get charged once?
```

## Step 4: Turn the tools off

This is the point of the module, so do it carefully.

1. In the panel, switch **Use tools** off. It's a separate conversation, so it starts empty.
2. Ask the same four questions from Step 2.
3. Switch back on and ask them again.

With the tools off the model gets no tools, no data and no instructions — just your question. It will answer confidently, and some of the prices will be invented. That's not a bug, and it's not a bad model: it's what every chatbot does when nothing connects it to the real numbers. Keep the wrong answers; you'll quote one in your report.

## Step 5: Change the data, not the code

Stock lives outside the code, in `lib/copper/data/inventory.json`, because in
real life it changes every day.

1. Ask *"Is Copper Notes in Night Sky in stock?"* and note the answer.
2. Open `lib/copper/data/inventory.json` and change that row's
   `units_in_stock` to `0`. Save it.
3. Ask again, without restarting anything and without touching a line of code.

The answer changes, because `check_availability` calls `readInventory()` fresh
every single time instead of remembering what it saw. That one habit is the
difference between a chatbot that's right today and one that was right last
Tuesday. Put the original number back when you're done.

## Step 6: Write your report

Open `specs/module-2/report.md` and fill it in:

1. Ask the five test questions with **Use tools on**, then ask the same five in the **tools-off** chat.
2. Mark each answer right or wrong, and copy its cost and time from `ai_calls`.
3. Read one tool card and one thought summary closely, and write down what they say.
4. Change a stock level in `lib/copper/data/inventory.json`, ask again, and see the answer change without touching any code.

The REPORT rubric in `spec.md` is what the TA uses. All of this costs well under a dollar, and Google's free tier may cover it entirely.

This is the one part of the module that needs real keys: the 75 test points never call a model, but the report is written from your own runs.

## Step 7: Check your work

```bash
npm run check       # aim for 27 of 27: all of Module 1 and Module 2
npm test            # the app's own tests
npm run lint        # code style
npm run typecheck   # type errors
npm run format      # tidies the spacing; the other four pass without it
```

`npm run lint` includes React's newer rules. If it complains that a variable
can't be reassigned after render, count with something the rule allows (an
index, or a running total you work out before the JSX) rather than changing a
variable inside a `.map()`.

## Step 8: Push and deploy

```bash
git push
```

1. Go to https://vercel.com/new and import your **`copper-m2`** repository.
2. Under **Environment Variables**, add `GOOGLE_GENERATIVE_AI_API_KEY`. Click **Deploy**.
3. Open your Vercel link and ask Copper a question.

The grader looks for "Ask Copper" on your live site. It shows even without the keys, but add them so your chatbot really works.

## What to submit

In Canvas:

1. Your GitHub repo link (`https://github.com/YOUR-USERNAME/copper-m2`)
2. Your Vercel link
3. A screenshot of `npm run check` showing **27 of 27** criteria passed

Your report is graded from `specs/module-2/report.md` in your repo, so make sure it's committed and pushed.

## How it's graded

| Part | Points | How |
|---|---|---|
| Part A: the chat widget (AC-M2.1 to AC-M2.4) | 20 | Tests |
| Part B: the tools (AC-M2.5 to AC-M2.10) | 30 | Tests |
| Part C: streaming (AC-M2.11 to AC-M2.15) | 25 | Tests (with a fake model and database, so they cost nothing) |
| REPORT: tools on vs. off | 10 | A TA, using the REPORT rubric in `spec.md` |
| DEPLOY: live on Vercel | 15 | The grader checks your live site |

Your last commit before the deadline is graded. Tests are run with your instructor's copy, so changing them in your repo doesn't change your grade.

## Rules

- **Don't edit** `specs/*/tests`, `specs/*/rubric.md`, `lib/copper/catalog.ts`, `lib/copper/inventory.ts` or `lib/copper/data/`.
- **Write Copper's instructions yourself.** You can ask your agent to critique them, but the words should be yours.
- **Never commit `.env.local` or paste keys into code.**
- **Everything about Copper State Labs is fictional.** Don't use real company names, logos or products.

## Troubleshooting

| Problem | Fix |
|---|---|
| The panel says "Set up Google AI" | Add `GOOGLE_GENERATIVE_AI_API_KEY` to `.env.local` and restart `npm run dev`. On Vercel, add it in Project Settings > Environment Variables and redeploy |
| Copper answers but no tool card appears | Use tools is off, or the model answered without a tool. Check your instructions say to **always** use the tools |
| Copper says nothing at all with tools off | You sent Copper's "always use your tools" instructions with no tools. With tools off, send no instructions at all |
| No thinking station appears | `providerOptions: THOUGHT_SUMMARIES` is missing from your `callStream` call |
| The answer appears all at once | You're waiting for the whole stream before sending an update. Send one on every change |
| Copper says stock can't be checked | `readInventory()` returned nothing. Check `lib/copper/data/inventory.json` is still valid JSON |
| AC-M2.5 fails with $386.88 or similar | Copper Plus is being counted once per device. It's once per household |
| AC-M2.6 fails | A price is typed into `tools.ts`. Read every price from `getProducts()` and `getPlans()` |
| AC-M2.7 or AC-M2.10 fails | An input schema is still `z.any()`, or lets in something the contract doesn't allow |
| AC-M2.9 fails after the stock changes | The tool saved the table once instead of reading it each time |
| AC-M2.10 fails on Patina Teal | It says "out of stock" instead of `"not_a_color"`. Check the color against the product's colors in the catalog first |
| AC-M2.11 fails | The model gets only one step, so it never sees the tool's result. Add `stopWhen: stepCountIs(5)` |
| AC-M2.12 fails | The tool step is added only when the input arrives. Add it at `tool-input-start`, when only the name is known |
| AC-1.4 (Module 1) fails | You added an API route or page. Use a Server Action (`"use server"`) in `lib/copper/assistant/ask.ts` instead |
| AC-4.1 (Module 1) fails | The new chat code uses a non-brand color. Swap it for a theme class |
| `npm run check` says "could not run" | A compile error. `npm run typecheck` shows it |
| `check_availability` finds no rows | A stock row's `product` holds "Copper Notes", not `copper-notes`. Look the name up with `getProducts()` first |
| Two tool cards appear for one tool call | `tool-input-start` gives `part.id`; the later parts give the same id as `part.toolCallId`. Match on it |
| `npm run build` stops with a Next.js security notice | Run it again; it continues. The course pins this version, so don't upgrade it |

Stuck for more than 20 minutes? Post in the course forum with the command you ran and the full error message, or come to office hours.
