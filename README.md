# Inbox Composer

A visual control plane piece for **Supanova Inbox**: paste a chat permalink, preview the parsed signal, confirm before it enters the ledger.

The Inbox system detects work artifacts (meetings, transcripts, chat threads), gives them stable identity, and records them in a single ledger. This tool adds the missing UI layer for the **chat-thread** path, with a deterministic parser, server-side validation, and a single guarded write path.

---

## What it does

1. **Paste** a chat permalink and the raw text
2. **Preview** the parsed signal with verdict, warnings, and enriched participants
3. **Confirm**: the server re-validates, writes atomically, and logs the audit trail
4. Or **Block**: duplicates, missing identity, or unresolved warnings stop the write

Three deliberate product decisions:

- **No AI in extraction.** Participants are only emails that appear verbatim in the paste. Nothing is inferred, so there is nothing to hallucinate.
- **Verdicts before writes.** Every draft is classified `ready`, `needs_review`, or `blocked`. The Confirm button reflects this honestly.
- **One guarded path.** All writes go through `server/services/writer.js`. Nothing else writes to `signals`.

---

## Stack

- **Backend:** Node.js 22+ (built-in `node:sqlite`) + Express
- **Frontend:** React 18 + Vite
- **Data:** Fixture JSON files are read by the server only. New writes go to `data/inbox.db`.
- **No cloud services, API keys, or accounts.**
- **No native build tools required.** `node:sqlite` ships with Node 22.

---

## Requirements

- **Node.js 22.5 or newer** (tested on 22.19.0), required for the built-in `node:sqlite` module
- **npm 10+**

That's it. No Python, no Visual Studio Build Tools, no Xcode, no `apt install`. Just Node and npm.

> **Note on `node:sqlite`:** Node 22 marks this module as experimental. You will see a warning at startup:
>
> ```
> ExperimentalWarning: SQLite is an experimental feature and might change at any time
> ```
>
> This is informational and safe to ignore. The module is stable for the API surface this project uses.

---

## Setup (from a clean clone)

```bash
# 1. Install dependencies (root, server, client)
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# 2. Seed the SQLite database from the fixture
cd server && npm run seed && cd ..

# 3. Start server (3001) and client (5173)
npm run dev
```

Then open http://localhost:5173/.

`npm run dev` uses `concurrently` to start:

- `server/` on http://localhost:3001 (Express + SQLite)
- `client/` on http://localhost:5173 (Vite dev server, proxies `/api/*` to Express)

If a port is in use:

- **Windows:** `netstat -ano | findstr :3001` then `taskkill /PID <pid> /F`
- **macOS/Linux:** `lsof -ti:3001 | xargs kill`

---

## What the seed does

Loads all 77 signals from `fixture/signal-ledger.json` into `data/inbox.db`.

The fixture intentionally contains 3 duplicate ids (a deliberate defect the task asks us to handle). The seed uses `INSERT OR IGNORE` and reports both counts:

```text
[seed] Empty DB. Loading up to 77 signals from fixture...
  [skip] duplicate id: 2026-07-22_northwind_supply_portal_walkthrough (...)
  [skip] duplicate id: 2026-08-14_manifest_import_retro (...)
  [skip] duplicate id: 2026-08-20_weekly_standup (...)
[seed] ✓ Done. Inserted: 74, Skipped (duplicate ids): 3
[seed] signals table now has 74 rows.
```

Re-running the seed when the DB already has rows does nothing (idempotent).

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Runs server and client together |
| `npm run dev:server` | Runs only the Express server |
| `npm run dev:client` | Runs only the Vite client |
| `cd server && npm run seed` | Loads fixture into SQLite (idempotent) |

### Resetting the database

macOS/Linux:

```bash
rm data/inbox.db data/inbox.db-shm data/inbox.db-wal
cd server && npm run seed
```

Windows PowerShell:

```powershell
Remove-Item data\inbox.db, data\inbox.db-shm, data\inbox.db-wal -ErrorAction SilentlyContinue
cd server; npm run seed
```

---

## Try it

Paste this into the textarea and click **Parse**:

```text
From: dana@northwind.example
To: kit@studio.example
Date: 2026-09-22 14:00

Northwind weekly review round 2
Dana: Let's review the invoice sync error states.
```

You should see:

- **Verdict:** `ready`
- **Participants:** `dana@northwind.example` (known), `kit@studio.example` (internal)
- **Stable id:** `2026-09-22_northwind_weekly_review_round_2`

Click **Confirm**: the signal is written and an audit row is created.

### Try the guards

- **Duplicate:** click "Start a new paste", paste the same text, Parse. `DUPLICATE_ID` blocks it.
- **Unknown participant:** change `To:` to `alice@fake.example`. `UNVERIFIED_PARTICIPANT` warns, and Confirm requires an explicit checkbox.
- **Missing date:** remove the `Date:` line. `MISSING_ID` blocks it. Add a date via the picker and the verdict updates live.

---

## API

All routes are server-side. The client never touches the fixture or the database directly.

| Route | Purpose |
|-------|---------|
| `POST /api/parse` | Body: `{ permalink, pastedText }`. Returns `{ ok, draft, verdict, issues, warnings }`. |
| `POST /api/validate` | Body: `{ draft }`. Re-runs validation on an edited draft. Returns the same shape. |
| `POST /api/confirm` | Body: `{ draft, actor? }`. Validates, writes atomically, returns `{ ok, written, signalId }` or `409` with `{ ok:false, verdict, issues }`. |
| `GET /api/health` | Liveness check. |
| `GET /api/fixture/summary` | Counts of fixture signals, projects, run-log rows. |
| `GET /api/signals/recent?limit=N` | Latest N signals from the ledger. |

---

## Project structure

```text
inbox-composer/
├── client/                     React + Vite UI
│   └── src/
│       ├── App.jsx              state machine: paste → preview → result
│       ├── api.js               all fetch calls live here
│       └── components/
│           ├── PasteBox.jsx
│           ├── PreviewCard.jsx
│           └── ResultCard.jsx
├── server/                     Express API
│   ├── index.js                app, route mounting, error handler
│   ├── db.js                   SQLite schema (signals + audit_log) via node:sqlite
│   ├── seed.js                 one-shot fixture → DB loader (idempotent)
│   ├── fixture-loader.js       server-only fixture reader
│   ├── routes/
│   │   ├── parse.js            POST /api/parse
│   │   ├── validate.js         POST /api/validate
│   │   ├── confirm.js          POST /api/confirm
│   │   └── signals.js          GET  /api/signals/recent
│   └── services/
│       ├── parser.js           deterministic extraction (no AI)
│       ├── validator.js        classification + duplicate detection
│       └── writer.js           THE guarded write path
├── fixture/                    synthetic data (read-only source)
├── docs/
│   └── product-decisions.md    the three decisions, in writing
├── data/                       SQLite database (gitignored; .gitkeep only)
└── README.md
```

---

## The mission question

**How would you keep a model from hallucinating participants that are not in the paste?**

The extraction layer doesn't use a model at all.

- Participants are only emails matched verbatim in the pasted text.
- Names mentioned in prose ("Alice should join") are ignored.
- A participant that appears in the paste but isn't in any project's contacts is classified `unverified`. It is neither silently dropped nor silently accepted: it becomes a warning that requires the operator to tick an explicit confirmation box.

Three layers of defense:

1. **Parser:** only verbatim emails
2. **Validator:** cross-check against known contacts and internal domains
3. **UI:** explicit human acknowledgment for unknowns

The decision is logged in `audit_log`.

---

## Assumptions

- **Permalink format:** Slack-style permalinks (`https://slack.example.com/archives/.../p...`). The parser doesn't depend on URL structure; it extracts from the pasted body. The permalink is stored as `sources.slack_thread` for provenance.
- **Participant identity is email-only.** Display names are intentionally not extracted, to avoid ambiguity.
- **The seed is idempotent.** It uses `INSERT OR IGNORE` and reports how many rows were skipped. The fixture contains duplicate ids (a deliberate defect).
- **No auth.** Local, single-user internal tool.
- **No AI in extraction.** This is the answer to the hallucination question.
- **Append-only ledger.** Signals are never updated. Identity fields (`id`, `match_key`, `type`, `sources`) are immutable.

---

## What I cut

- **Real Slack integration:** no OAuth or API calls; the user pastes text manually.
- **Multi-project status editing:** the schema supports multiple projects per signal, but the UI writes only the routed project's status.
- **Feed health monitoring UI:** `run-log.jsonl` shows a 9-day dark stretch on the granola feed and two failed runs. A real control plane would surface these; this build covers only the chat-thread composer path.
- **Analytics:** no dashboards or charts.
- **Edit/delete after write:** signals are append-only.

---

## Time spent

Roughly 15 hours, split approximately as:

- ~1h planning and reading the fixture
- ~5h server (parser, validator, writer, routes, seed)
- ~5h client (paste → preview → confirm UI)
- ~2h debugging the fixture's intentional defects and the `node:sqlite` migration
- ~2h README and walkthrough

---

## License

Authored for the Supanova Labs build task. No client data or confidential information.
