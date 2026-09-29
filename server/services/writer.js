import db from '../db.js';
import { validateDraft } from './validator.js';

/**
 * THE ONLY WAY TO WRITE A SIGNAL.
 * Do not insert into `signals` from anywhere else.
 *
 * @param {object} draft - the parsed + (optionally) user-edited draft
 * @param {object} context - { source: 'composer', actor: 'ui-user' }
 * @returns {object} { ok, written, signalId, verdict, issues, reason }
 */
export function writeSignal(draft, context = {}) {
  const source = context.source || 'composer';
  const actor = context.actor || 'ui-user';

  // Defensive: guard against null/undefined drafts
  const safeDraft = draft && typeof draft === 'object' ? draft : {};

  // --- 1. Re-validate on the server. Never trust the browser. ---
  const validation = validateDraft(safeDraft);
  if (!validation.ok) {
    logAudit({
      action: 'confirm_signal',
      signalId: draft?.id ?? null,
      payload: draft,
      result: 'blocked',
      message: `Blocked by validator: ${validation.issues
        .filter(i => i.level === 'error')
        .map(i => i.code)
        .join(', ')}`,
      actor,
    });
    return {
      ok: false,
      written: false,
      signalId: null,
      verdict: validation.verdict,
      issues: validation.issues,
      reason: 'VALIDATION_FAILED',
    };
  }

  const enriched = validation.enriched;

  // --- 2. The atomic write. One transaction, both tables, all-or-nothing. ---
  const insertSignal = db.prepare(`
    INSERT INTO signals (
      id, match_key, type, date, time, title, detected_on,
      attendees, projects, summary, expected_files, notes, status, sources, source
    ) VALUES (
      @id, @match_key, @type, @date, @time, @title, @detected_on,
      @attendees, @projects, @summary, @expected_files, @notes, @status, @sources, @source
    )
  `);

  const insertAudit = db.prepare(`
    INSERT INTO audit_log (action, signal_id, payload, result, message, actor)
    VALUES (@action, @signal_id, @payload, @result, @message, @actor)
  `);

  const txn = db.transaction((sig) => {
    // Inside the transaction, re-check for duplicate id.
    // (Someone could have written the same id a millisecond ago.)
    const existing = db.prepare('SELECT id FROM signals WHERE id = ?').get(sig.id);
    if (existing) {
      throw new Error(`DUPLICATE_ID: ${sig.id} already exists`);
    }

    insertSignal.run({
      id: sig.id,
      match_key: sig.match_key,
      type: sig.type,
      date: sig.date,
      time: sig.time ?? null,
      title: sig.title,
      detected_on: sig.detected_on,
      attendees: JSON.stringify(sig.attendees ?? []),
      projects: JSON.stringify(sig.projects ?? []),
      summary: sig.summary ?? null,
      expected_files: JSON.stringify(sig.expected_files ?? []),
      notes: sig.notes ?? null,
      status: JSON.stringify(sig.status ?? {}),
      sources: JSON.stringify(sig.sources ?? {}),
      source,
    });

    insertAudit.run({
      action: 'confirm_signal',
      signal_id: sig.id,
      payload: JSON.stringify(sig),
      result: 'success',
      message: `Written from ${source} by ${actor}`,
      actor,
    });
  });

  try {
    txn(enriched);
    return {
      ok: true,
      written: true,
      signalId: enriched.id,
      verdict: validation.verdict,
      issues: validation.issues,
      reason: null,
    };
  } catch (err) {
    // Transaction rolled back automatically. Log the failure in a separate audit row.
    logAudit({
      action: 'confirm_signal',
      signalId: enriched?.id ?? null,
      payload: enriched,
      result: 'error',
      message: `Write failed: ${err.message}`,
      actor,
    });
    return {
      ok: false,
      written: false,
      signalId: null,
      verdict: 'blocked',
      issues: validation.issues,
      reason: err.message,
    };
  }
}

// ---- Internal audit helper (used outside the transaction for pre-flight failures) ----

function logAudit({ action, signalId, payload, result, message, actor = 'system' }) {
  try {
    db.prepare(`
      INSERT INTO audit_log (action, signal_id, payload, result, message, actor)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      action,
      signalId,
      JSON.stringify(payload ?? null),
      result,
      message,
      actor
    );
  } catch (e) {
    // Best-effort. Never crash the caller just because audit failed.
    console.error('[writer] audit log failed:', e.message);
  }
}