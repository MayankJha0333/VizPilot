# VizPilot

Turn a CSV, a pasted table or a sample dataset into a clean, shareable report with charts — inspired by the Graphy experience.

**Flow:** Sign up → Log in → Dashboard → Create report → Add data → Generate charts (auto-suggest or Ask AI) → Edit / style → Save → Share a public link.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, TypeScript) + Tailwind CSS v4 |
| Auth | Firebase Authentication (email/password + Google) — ID tokens verified server-side with `firebase-admin` |
| Database | MongoDB via Mongoose (`users`, `datasets`, `reports`, `charts`) |
| Widgets | Recharts-based interactive widgets: column, bar, stacked, line, area, pie, donut, scatter, KPI (with period delta + sparkline), table, text blocks. Hover tooltips with totals, click-to-hide legend, expand with data table, PNG/CSV export, drag-to-reorder, 4 widths, present mode. |
| Data import | CSV/TSV (PapaParse), Excel (SheetJS), paste, manual table, 6 realistic sample datasets (e-commerce, SaaS, marketing, support tickets, web traffic, expenses) |
| Chart engine | Sum/avg/min/max/count aggregation, filters, **count-based charts for text-only data**, non-additive measures (hours, scores, rates) averaged automatically, date roll-ups (day/week/month/quarter/year), rule-based suggestions that lay out a dashboard (KPI + trend + breakdowns) |
| Ask AI | Graphy-style analyst: understands the question, plans the analysis with the model, computes the answer from your rows, and shows *how it built it* (grouping, aggregation, filters, sort). Returns a chart, a direct answer, or insights; supports follow-ups ("make it a bar", "top 5", "monthly", "only Europe"). Falls back to a rules engine, so it always answers. |
| AI providers | Groq → Gemini → Mistral → GitHub Models → OpenRouter → Z.ai → Hugging Face. Automatic fallback with per-provider circuit breakers (auth / rate-limit / timeout cooldowns), JSON repair + retry, and a status page in Settings. |

## 1. Setup

```bash
npm install
cp .env.example .env      # then fill it in (see below)
npm run dev               # http://localhost:3000
```

### `.env`

```
# MongoDB (already added)
MONGODB_URI=...
MONGODB_USERNAME=...
MONGODB_PASSWORD=...
MONGODB_DB=vizpilot

# Firebase web app (Firebase console → Project settings → Your apps → Web)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_APP_ID=

# AI keys (optional)
GROQ_API_KEY=...
GEMINI_API_KEY=...
```

In the Firebase console, turn on **Authentication → Sign-in method → Email/Password** and **Google**. Add `localhost` (and your deployed domain) under **Authentication → Settings → Authorized domains**.

`MONGODB_URI` can keep the `<db_username>` / `<db_password>` placeholders from Atlas — they're filled from `MONGODB_USERNAME` / `MONGODB_PASSWORD` automatically.

### Running without a Firebase project (local emulator)

```bash
npm run emulators        # starts the Firebase Auth emulator on 127.0.0.1:9099
```

and in `.env`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=demo-key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-vizpilot
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-vizpilot.firebaseapp.com
NEXT_PUBLIC_FIREBASE_APP_ID=1:1:web:demo
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

### AI keys (optional but recommended)

Add any of these to `.env`: `GROQ_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `GITHUB_MODELS_TOKEN`, `OPENROUTER_API_KEY`, `ZAI_API_KEY`, `HUGGINGFACE_API_KEY`. Without a key, Ask AI uses the built-in rules engine (`src/lib/charts/intent.ts`).

**How fallback works** (`src/lib/ai/`):

- `providers.ts` – one adapter per provider (OpenAI-compatible chat endpoints + Gemini). Models and URLs live here.
- `client.ts` – the orchestrator. Providers are tried in order (`AI_PROVIDER_ORDER=groq,gemini,…` overrides it). A failure is classified (`auth`, `rate_limit`, `server`, `timeout`, `network`, `bad_response`, `config`) and puts that provider on a cooldown (auth 30 min, rate-limit 90 s, timeout 45 s, … with exponential escalation), so the next request skips straight to a healthy provider. When every provider is cooling, the one closest to recovery is retried. `completeJSON()` extracts JSON from any reply and retries once with a stricter prompt.
- `analyst.ts` – the Ask AI engine: builds a dataset brief (columns, stats, distinct values, samples), asks the model for a *plan* (chart config / answer / insights), validates and repairs it against the real columns, then computes the numbers deterministically from your rows.
- **Settings → AI providers** shows live status per provider, lets you test each one or the whole chain, and clear cooldowns. `GET /api/ai/providers` returns the same data.

## 2. Project layout

```
src/
  app/
    (marketing)/page.tsx        Landing page
    (auth)/login|signup|forgot-password
    (app)/                      Signed-in area (AppShell + auth gate)
      dashboard/                Home: start cards, recent reports, one-click templates, datasets
      reports/                  All reports (search, sort, grid/list)
      reports/new/              2-step wizard: add data → set up report (auto-charts); ?mode= & template deep links
      reports/[id]/             Report editor: 12-col widget grid (drag to reorder, 4 widths), widget editor, Ask AI panel + ⌘K composer, present mode, data modal, share
      datasets/, datasets/[id]/ Dataset list + editable table view
      settings/                 Profile, AI provider status/tests, workspace status
    share/[shareId]/            Public, read-only report
    api/                        REST routes (all verify the Firebase ID token)
  components/                   UI, auth, layout, charts, data, reports, ai
  lib/
    db.ts                       Mongoose connection (cached)
    models/                     User, Dataset, Report, Chart
    firebase/                   client SDK + admin verification
    auth-server.ts              requireUser() helper for API routes
    data/                       parse.ts (CSV/Excel/paste + type inference), transform.ts (aggregation), samples.ts
    charts/                     types + palettes, suggest.ts (dashboard suggestions), intent.ts (rules: natural language → chart, follow-ups)
    data/dates.ts               date parsing + day/week/month/quarter/year bucketing
    ai/                         providers.ts (adapters), client.ts (fallback + circuit breakers), analyst.ts (Ask AI engine)
  proxy.ts                      Cookie-based redirects for protected/auth pages
```

## 3. API

| Method | Route | What it does |
| --- | --- | --- |
| POST / DELETE | `/api/auth/session` | Sync Firebase user into MongoDB, set/clear session cookie |
| GET / POST | `/api/datasets` | List (no rows) / create dataset |
| GET / PATCH / DELETE | `/api/datasets/:id` | Read (with rows) / edit / delete (blocked while a report uses it) |
| GET / POST | `/api/reports` | List with chart counts + preview / create (optionally auto-build charts) |
| GET / PATCH / DELETE | `/api/reports/:id` | Read with charts + dataset / update (title, theme, public, chart order…) / delete |
| POST | `/api/reports/:id/duplicate` | Copy report and its charts |
| POST | `/api/charts` | Create chart in a report |
| PATCH / POST / DELETE | `/api/charts/:id` | Update / duplicate / delete |
| POST | `/api/ai/ask` | Ask AI: `{datasetId, prompt, history, lastConfig}` → chart / answer / insights + "how I built this" steps |
| GET / POST | `/api/ai/providers` | Provider status; `{action:"test", provider?}` pings one or the chain, `{action:"reset"}` clears cooldowns |
| GET | `/api/share/:shareId` | Public report payload |
| GET | `/api/health` | DB / Firebase / AI provider status |

## 4. Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run start       # serve the build
npm run lint        # eslint
npm run emulators   # Firebase Auth emulator (needs firebase-tools: npm i -g firebase-tools)
```

## 5. Deploying

Works on Vercel or any Node host. Set the same environment variables there, and add the deployed domain to Firebase's authorized domains. Mongo Atlas needs the host's IP range allowed (or `0.0.0.0/0` for testing).
