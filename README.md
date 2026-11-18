# ts-learner

Learn TypeScript in a terminal that shows what the compiler knows.

You type real TypeScript, one line or block at a time. The real compiler runs in your browser on every keystroke, and the code view shows what it figured out that the code doesn't say: inferred types, narrowed types in each branch, what a generic inferred, expanded type aliases, and the exact path to a type error.

## Two modes

**Path:** 113 short missions in 17 units, from beginner to mastery, following the order of the [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/). About a fifth of them ask you to break something on purpose, so you learn what TypeScript rejects as well as what it accepts.

| Level | Units |
|---|---|
| Beginner | Values · Arrays & tuples · Objects · Functions · Unions |
| Intermediate | Narrowing · Generics · Classes · Async · Enums & const |
| Advanced | Type operators · Utility types · Conditional types · Mapped types |
| Mastery | Recursive types · Tuple & string types · Patterns |

**Build:** describe a project ("a recipe manager with shopping lists") and Claude plans 30–45 steps that build it while covering every unit. Each planned step is compiled before you see it; steps that fail are sent back to Claude with the compiler's errors and fixed. At the end you download a runnable project (`src/index.ts`, `package.json`, `tsconfig.json`). A built-in example (a habit tracker) works without any API key.

Completed steps collect in a searchable cheat sheet (`/sheet`) that you can copy as Markdown.

## Run locally

```sh
npm install
npx vercel dev        # serves public/ and api/ on http://localhost:3000
```

The Path and the example project need nothing else. For Build mode, copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`.

## Deploy to Vercel

1. Import this repo at [vercel.com/new](https://vercel.com/new). No framework or build step is needed.
2. In **Settings → Environment Variables**, add `ANTHROPIC_API_KEY` (only if you want Build mode).
3. Deploy.

| Variable | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Turns on Build mode. Without it, Build shows only the example. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Model used to write plans. |
| `PLAN_DAILY_LIMIT` | `10` | Plan and repair requests per visitor per day. |

**Cost.** Only Build mode calls the API. A plan is roughly 1K input tokens and 4K output tokens, plus up to two repair rounds, which is a few cents to about $0.30 per project on Sonnet. The daily limit is kept in memory per server instance, so it is best-effort; for real traffic, move it to a shared store such as Vercel KV or Upstash Redis.

**Safety.** `api/plan.js` builds the prompt itself from the curriculum and only accepts a project idea (and, for repairs, a plan and the compiler's problems), with length limits. Visitors can't use it as a general-purpose Claude proxy, and the API key never reaches the browser.

## How it works

| File | |
|---|---|
| `public/index.html` | The app: path sidebar, code view with inline hints, terminal, mission card, cheat sheet, Build mode |
| `public/engine.js` | Runs the TypeScript compiler on the session; turns types into a model; inline hints (narrowing, inference, expansion, union distribution); plain-English errors |
| `public/missions.js` | The 113 missions and how each is checked (by type, not exact text) |
| `public/build.js` | Plan prompt, compiler verification, repair loop, project export |
| `public/libs.js` | The ES2019 standard library type definitions the compiler checks against |
| `api/plan.js` | Serverless function that streams a plan from Claude |
| `scripts/test.js` | `npm test`: runs every mission and the example project through the compiler |

Your code runs in a sandboxed Web Worker with a 2-second limit. Progress is saved in `localStorage`.

The TypeScript compiler (5.4.5) loads from jsDelivr, so the first visit takes a few seconds.

## Commands

| | |
|---|---|
| `Tab` | Insert the suggested line |
| `Enter` / `Shift+Enter` | Run / new line |
| `/sheet` | Cheat sheet |
| `/undo` | Remove the last accepted line |
| `/skip`, `/back` | Move between missions |
| `/export` | Download the Build project |
| `/clear`, `/reset` | Clear the session / restart |
