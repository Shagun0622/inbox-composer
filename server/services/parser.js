// Deterministic chat parser.
// NO AI. NO inference. Every extracted value must appear verbatim in the paste.

/**
 * Parse a pasted chat thread + permalink into a structured draft.
 * Returns { ok, draft, warnings, errors }
 */
export function parseChat({ permalink, pastedText }) {
  const errors = [];
  const warnings = [];

  if (!pastedText || typeof pastedText !== 'string') {
    errors.push('Pasted text is required.');
    return { ok: false, draft: null, warnings, errors };
  }
  if (pastedText.trim().length < 20) {
    errors.push('Pasted text is too short to parse.');
    return { ok: false, draft: null, warnings, errors };
  }

  // 1. Extract participants (emails only — deterministic, verbatim)
  const participants = extractParticipants(pastedText, warnings);

  // 2. Extract date (from permalink if possible, else from paste)
  const date = extractDate(permalink, pastedText, warnings);

  // 3. Extract time (from paste if present)
  const time = extractTime(pastedText);

  // 4. Extract title (from first non-empty line)
  const title = extractTitle(pastedText);

  // 5. Build a normalized match_key from the title
  const matchKey = normalizeKey(title);

  // 6. Build the id: {date}_{matchKey}
  const id = date && matchKey ? `${date}_${matchKey}` : null;

  if (participants.length === 0) {
    warnings.push('No email addresses found in the paste. Participants list will be empty.');
  }

  const draft = {
    id,
    match_key: matchKey,
    type: 'slack_thread',      // this mission is chat threads
    date,
    time,
    title,
    detected_on: new Date().toISOString().slice(0, 10),
    attendees: participants.map(p => p.email),
    participants,               // includes {email, verified} for UI
    projects: [],               // filled in by validator
    summary: null,
    expected_files: [],
    notes: null,
    status: {},
    sources: {
      slack_thread: permalink || null,
      transcript: null,
      recording: null,
    },
  };

  return { ok: true, draft, warnings, errors };
}

// ---- Participant extraction ----

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function extractParticipants(text, warnings) {
  const seen = new Map(); // lowercase email -> original form

  // Only match emails that literally appear in the paste
  const matches = text.match(EMAIL_REGEX) || [];
  for (const raw of matches) {
    const lower = raw.toLowerCase();
    if (!seen.has(lower)) {
      seen.set(lower, raw);
    }
  }

  // Also look for emails in the permalink header, e.g. "From: alice@..."
  // But we only count emails that appear in the pasted text itself.
  // (We deliberately do NOT scan the permalink URL for emails.)

  const participants = [];
  for (const [lower, original] of seen.entries()) {
    participants.push({
      email: lower,
      display: original,
      verified: null,       // filled in later by validator (unknown known/unverified)
      context: 'in_paste',
    });
  }

  if (participants.length === 0) {
    warnings.push('No participants found — every person must appear verbatim in the paste.');
  }

  return participants;
}

// ---- Date extraction ----

function extractDate(permalink, text, warnings) {
  // Try YYYY-MM-DD anywhere in the paste
  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  // Try "Month D, YYYY" or "D Month YYYY"
  const monthNames = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
  };
  const monthRe = new RegExp(`\\b(${Object.keys(monthNames).join('|')})\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`, 'i');
  const m = text.match(monthRe);
  if (m) {
    const mon = monthNames[m[1].toLowerCase()];
    const day = m[2].padStart(2, '0');
    return `${m[3]}-${mon}-${day}`;
  }

  // Try YYYY/MM/DD in permalink
  if (permalink) {
    const slash = permalink.match(/(20\d{2})\/(\d{1,2})\/(\d{1,2})/);
    if (slash) {
      return `${slash[1]}-${slash[2].padStart(2, '0')}-${slash[3].padStart(2, '0')}`;
    }
  }

  warnings.push('Could not determine a date from the permalink or paste.');
  return null;
}

// ---- Time extraction ----

function extractTime(text) {
  // Match HH:MM (24h) or H:MM AM/PM
  const twentyFour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFour) {
    return `${twentyFour[1].padStart(2, '0')}:${twentyFour[2]}`;
  }
  const twelve = text.match(/\b(1[0-2]|0?[1-9]):([0-5]\d)\s*(am|pm)\b/i);
  if (twelve) {
    let h = parseInt(twelve[1], 10);
    const m = twelve[2];
    const ampm = twelve[3].toLowerCase();
    if (ampm === 'pm' && h !== 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  return null;
}

// ---- Title extraction ----

function extractTitle(text) {
  // First non-empty, non-"From:/To:" line, max 80 chars
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^(from|to|cc|bcc|subject|date|sent|on .* wrote):/i.test(line)) continue;
    if (line.length >= 3) return line.slice(0, 80);
  }
  return 'Untitled chat thread';
}

// ---- Normalize key ----

export function normalizeKey(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}