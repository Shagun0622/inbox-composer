# Product decisions

The mission asked a specific question: how would you keep a model from hallucinating participants that are not in the paste? Answering it required three related decisions.

---

## Decision 1 — No AI in participant extraction

**The question:** how do you prevent hallucinated participants?

**The decision:** don't use an AI model for extraction at all.

**Alternatives considered and rejected:**

| Alternative | Why rejected |
|-------------|--------------|
| Prompt a model with an allowlist of known emails | The model still has freedom to omit or misattribute |
| Fine-tune a small model on the fixture's contacts | Expensive, requires labeled data, breaks for unseen contacts |
| Extract names with a model, then match names to emails | Names are ambiguous; matching adds failure modes |
| **Regex over the pasted text, emails only** | ✅ Chosen — deterministic, testable, zero hallucination surface |

**Three layered defenses:**

1. **Parser** — only verbatim emails become participants. No names, no inference.
2. **Validator** — cross-checks each email against `config.json` and internal domains. Unknown emails are flagged `unverified`, never dropped, never auto-accepted.
3. **UI** — the Confirm button stays disabled until a human ticks an explicit acknowledgment checkbox.

The human's decision is logged in `audit_log`.

**Trade-off accepted:** a chat thread that says "let's invite Alice" without her email won't capture her. Better to miss a signal than to invent one.

---

## Decision 2 — Verdicts before writes

**The decision:** every draft is classified server-side as `ready`, `needs_review`, or `blocked`.

| Verdict | Meaning | UI behavior |
|---------|---------|-------------|
| `ready` | No errors, no warnings | Confirm enabled |
| `needs_review` | Warnings only | Confirm disabled until the warnings checkbox is ticked |
| `blocked` | Errors present | Confirm disabled, no override |

**Alternatives considered and rejected:**

| Alternative | Why rejected |
|-------------|--------------|
| Allow writes, warn after | Violates the mission's "confirm before it enters the ledger" |
| Let the client decide safety | Security issue — client can be wrong or malicious |
| Only block exact duplicates | Misses unknown participants and missing identity |

**Trade-off:** a server round-trip on every edit. Cheap, and keeps the write path safe.

---

## Decision 3 — One guarded write path

**The decision:** `server/services/writer.js` is the only module that inserts into `signals`.

**Alternatives considered and rejected:**

| Alternative | Why rejected |
|-------------|--------------|
| Multiple routes write directly | Hard to audit; easy to miss validation |
| Rely on SQLite UNIQUE constraint | Silently ignores; we want to show the user why |
| Write to JSON directly | Not atomic; crashed writes truncate the ledger |

Inside `writeSignal()`: re-validate → re-check duplicates inside transaction → insert signal + audit row in one SQLite transaction → rollback on failure.

**Trade-off:** every write pays a small overhead. Negligible.

---

## What was deliberately not built

- **No cloud services** — SQLite only, as required.
- **No auth** — local-only internal tool.
- **No editing after write** — the ledger is append-only by design.
- **No dark mode, design system, or animations** — every visual element maps to a decision the operator needs to make (verdict, trust level, write safety).
- **No Slack API integration** — the user pastes text manually. The permalink is stored as `sources.slack_thread` for provenance; nothing is fetched.
- **No reconciliation view for the fixture defects** — the fixture ships with intentional problems (unrouted signals, dangling `analysis_ref`, typo routing hint, 9-day dark feed stretch). The composer handles these without crashing; surfacing them in a health dashboard is the natural next tool.