import db from '../db.js';
import {
  projects,
  internalDomains,
  routingHints,
  fallbacks,
} from '../fixture-loader.js';

/**
 * Validate a parsed draft against the fixture config + existing ledger.
 * Returns { ok, enriched, verdict, issues }
 */
export function validateDraft(draft) {
  const issues = [];

  // 1. Enrich participants: known / internal / unverified
  const enrichedParticipants = draft.participants.map(p => {
    const status = classifyParticipant(p.email);
    if (status === 'unverified') {
      issues.push({
        level: 'warn',
        code: 'UNVERIFIED_PARTICIPANT',
        message: `${p.email} is not in any project's contacts or internal domain.`,
        field: 'attendees',
      });
    }
    return { ...p, verified: status };
  });

  // 2. Assign a project
  const assignedProjects = assignProjects(draft, enrichedParticipants);
  if (
    assignedProjects.length === 0 ||
    assignedProjects[0] === fallbacks.unrouted
  ) {
    issues.push({
      level: 'warn',
      code: 'UNROUTED',
      message: 'No project matched. Signal will be routed to internal_unsorted.',
      field: 'projects',
    });
  }

  // 3. Check identity validity
  if (!draft.id) {
    issues.push({
      level: 'error',
      code: 'MISSING_ID',
      message: 'Cannot write a signal without a stable id (missing date).',
      field: 'id',
    });
  }

  // 4. Duplicate detection
  if (draft.id) {
    const existing = db
      .prepare('SELECT id, title FROM signals WHERE id = ?')
      .get(draft.id);
    if (existing) {
      issues.push({
        level: 'error',
        code: 'DUPLICATE_ID',
        message: `Signal with id "${draft.id}" already exists ("${existing.title}").`,
        field: 'id',
      });
    }
  }

  // Near-duplicate: same match_key on a different date
  if (draft.match_key) {
    const nearDup = db
      .prepare('SELECT id, title, date FROM signals WHERE match_key = ? AND date != ?')
      .get(draft.match_key, draft.date);
    if (nearDup) {
      issues.push({
        level: 'warn',
        code: 'NEAR_DUPLICATE',
        message: `Similar signal exists on ${nearDup.date}: "${nearDup.title}".`,
        field: 'match_key',
      });
    }
  }

  // 5. Compute verdict
  const hasError = issues.some(i => i.level === 'error');
  const hasWarn = issues.some(i => i.level === 'warn');
  const verdict = hasError ? 'blocked' : hasWarn ? 'needs_review' : 'ready';

  // 6. Build the enriched draft (ready to show in preview)
  const enriched = {
    ...draft,
    participants: enrichedParticipants,
    attendees: enrichedParticipants.map(p => p.email),
    projects: assignedProjects,
  };

  return {
    ok: !hasError,
    enriched,
    verdict,
    issues,
  };
}

// ---- Helpers ----

function classifyParticipant(email) {
  const lower = email.toLowerCase();
  const domain = lower.split('@')[1] || '';

  // Internal?
  if (internalDomains.includes(domain)) return 'internal';

  // Known client contact?
  for (const project of projects) {
    if (project.emails.includes(lower)) return 'known';
  }

  // Known domain?
  for (const project of projects) {
    if (project.domains.includes(domain)) return 'known';
  }

  return 'unverified';
}

function assignProjects(draft, participants) {
  const assigned = new Set();

  // a) Explicit routing hints first (they override keywords)
  for (const hint of routingHints) {
    if (!projectExists(hint.project)) continue; // silently drop bad hints
    if (hint.type === 'keyword' && draft.title.toLowerCase().includes(hint.match.toLowerCase())) {
      assigned.add(hint.project);
    }
    if (hint.type === 'domain') {
      for (const p of participants) {
        if (p.email.endsWith('@' + hint.match)) assigned.add(hint.project);
      }
    }
  }

  // b) Keyword match on title
  const titleLower = (draft.title || '').toLowerCase();
  for (const project of projects) {
    for (const kw of project.keywords) {
      if (titleLower.includes(kw.toLowerCase())) {
        assigned.add(project.id);
      }
    }
  }

  // c) Email/domain match from participants
  for (const project of projects) {
    for (const p of participants) {
      if (project.emails.includes(p.email)) assigned.add(project.id);
      const domain = p.email.split('@')[1];
      if (project.domains.includes(domain)) assigned.add(project.id);
    }
  }

  // d) Fallback
  if (assigned.size === 0) {
    return [fallbacks.unrouted];
  }

  return Array.from(assigned);
}

function projectExists(id) {
  return projects.some(p => p.id === id);
}