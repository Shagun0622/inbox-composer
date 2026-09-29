import { useState } from 'react';
import { confirmDraft, validateDraft } from '../api.js';

export default function PreviewCard({
  draft, setDraft,
  issues, setIssues,
  warnings,
  verdict, setVerdict,
  onConfirmed, onCancel,
}) {
  const [confirming, setConfirming] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const hasError = issues.some(i => i.level === 'error');
  const hasWarn = issues.some(i => i.level === 'warn');
  const canConfirm = !hasError && (!hasWarn || accepted);

  async function handleEdit(field, value) {
    const next = { ...draft, [field]: value };
    if (field === 'date' && draft.match_key) {
      next.id = value ? `${value}_${draft.match_key}` : null;
    }
    setDraft(next);

    const { data } = await validateDraft(next);
    if (data.ok) {
      setDraft(data.draft);
      setIssues(data.issues || []);
      setVerdict(data.verdict);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    const { status, data } = await confirmDraft(draft);
    setConfirming(false);
    onConfirmed({ status, ...data });
  }

  return (
    <div className="card">
      <h2>Preview</h2>

      <div className={`verdict verdict-${verdict}`}>
        Verdict: <strong>{verdict}</strong>
      </div>

      {(issues.length > 0 || warnings.length > 0) && (
        <div className="issues">
          {issues.map((iss, i) => (
            <div key={i} className={`issue issue-${iss.level}`}>
              <span className="issue-code">{iss.code}</span>
              <span>{iss.message}</span>
              {iss.field && <span className="issue-field">→ {iss.field}</span>}
            </div>
          ))}
          {warnings.map((w, i) => (
            <div key={`w${i}`} className="issue issue-warn">
              <span className="issue-code">WARNING</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="fields">
        <label>
          Title
          <input value={draft.title || ''} onChange={e => handleEdit('title', e.target.value)} />
        </label>

        <label>
          Date {!draft.date && <em>(required)</em>}
          <input
            type="date"
            value={draft.date || ''}
            onChange={e => handleEdit('date', e.target.value)}
          />
        </label>

        <label>
          Time
          <input
            type="time"
            value={draft.time || ''}
            onChange={e => handleEdit('time', e.target.value)}
          />
        </label>

        <label>
          Projects
          <input value={(draft.projects || []).join(', ')} readOnly />
        </label>
      </div>

      <h3>Participants ({draft.participants?.length || 0})</h3>
      <ul className="participants">
        {(draft.participants || []).map(p => (
          <li key={p.email} className={`participant participant-${p.verified}`}>
            <span className="email">{p.email}</span>
            <span className="tag">{p.verified}</span>
          </li>
        ))}
      </ul>

      {draft.id && <p className="meta">Will be saved as: <code>{draft.id}</code></p>}

      {hasWarn && !hasError && (
        <label className="accept">
          <input
            type="checkbox"
            checked={accepted}
            onChange={e => setAccepted(e.target.checked)}
          />
          I have reviewed the warnings and confirm this is correct.
        </label>
      )}

      <div className="actions">
        <button type="button" onClick={onCancel} className="secondary">Cancel</button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm || confirming}
        >
          {confirming ? 'Writing…' : 'Confirm & write to ledger'}
        </button>
      </div>
    </div>
  );
}