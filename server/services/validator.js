import db from '../db.js';
import {
  projects,
  internalDomains,
  routingHints,
  fallbacks,
} from '../fixture-loader.js';

export function validateDraft(draft) {
  const issues = [];

  // Defensive normalization — never crash on missing fields
  const safeDraft = {
    id: draft?.id ?? null,
    match_key: draft?.match_key ?? '',
    type: draft?.type ?? 'slack_thread',
    date: draft?.date ?? null,
    time: draft?.time ?? null,
    title: draft?.title ?? '',
    detected_on: draft?.detected_on ?? new Date().toISOString().slice(0, 10),
    participants: Array.isArray(draft?.participants) ? draft.participants : [],
    attendees: Array.isArray(draft?.attendees) ? draft.attendees : [],
    projects: Array.isArray(draft?.projects) ? draft.projects : [],
    summary: draft?.summary ?? null,
    expected_files: Array.isArray(draft?.expected_files) ? draft.expected_files : [],
    notes: draft?.notes ?? null,
    status: draft?.status ?? {},
    sources: draft?.sources ?? {},
  };

  // 1. Enrich participants
  const enrichedParticipants = safeDraft.participants.map(p => {
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

  // 2. Assign project
  const assignedProjects = assignProjects(safeDraft, enrichedParticipants);
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

  // 3. Identity validity
  if (!safeDraft.id) {
    issues.push({
      level: 'error',
      code: 'MISSING_ID',
      message: 'Cannot write a signal without a stable id (missing date).',
      field: 'id',
    });
  }

  // 4. Exact duplicate
  if (safeDraft.id) {
    const existing = db
      .prepare('SELECT id, title FROM signals WHERE id = ?')
      .get(safeDraft.id);
    if (existing) {
      issues.push({
        level: 'error',
        code: 'DUPLICATE_ID',
        message: `Signal with id "${safeDraft.id}" already exists ("${existing.title}").`,
        field: 'id',
      });
    }
  }

  // 5. Near duplicate
  if (safeDraft.match_key && safeDraft.date) {
    const nearDup = db
      .prepare('SELECT id, title, date FROM signals WHERE match_key = ? AND date != ?')
      .get(safeDraft.match_key, safeDraft.date);
    if (nearDup) {
      issues.push({
        level: 'warn',
        code: 'NEAR_DUPLICATE',
        message: `Similar signal exists on ${nearDup.date}: "${nearDup.title}".`,
        field: 'match_key',
      });
    }
  }

  // 6. Verdict
  const hasError = issues.some(i => i.level === 'error');
  const hasWarn = issues.some(i => i.level === 'warn');
  const verdict = hasError ? 'blocked' : hasWarn ? 'needs_review' : 'ready';

  const enriched = {
    ...safeDraft,
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

function classifyParticipant(email) {
  const lower = email.toLowerCase();
  const domain = lower.split('@')[1] || '';
  if (internalDomains.includes(domain)) return 'internal';
  for (const project of projects) {
    if (project.emails.includes(lower)) return 'known';
  }
  for (const project of projects) {
    if (project.domains.includes(domain)) return 'known';
  }
  return 'unverified';
}

function assignProjects(draft, participants) {
  const assigned = new Set();

  for (const hint of routingHints) {
    if (!projectExists(hint.project)) continue;
    if (hint.type === 'keyword' && draft.title.toLowerCase().includes(hint.match.toLowerCase())) {
      assigned.add(hint.project);
    }
    if (hint.type === 'domain') {
      for (const p of participants) {
        if (p.email.endsWith('@' + hint.match)) assigned.add(hint.project);
      }
    }
  }

  const titleLower = (draft.title || '').toLowerCase();
  for (const project of projects) {
    for (const kw of project.keywords) {
      if (titleLower.includes(kw.toLowerCase())) {
        assigned.add(project.id);
      }
    }
  }

  for (const project of projects) {
    for (const p of participants) {
      if (project.emails.includes(p.email)) assigned.add(project.id);
      const domain = p.email.split('@')[1];
      if (project.domains.includes(domain)) assigned.add(project.id);
    }
  }

  if (assigned.size === 0) return [fallbacks.unrouted];
  return Array.from(assigned);
}

function projectExists(id) {
  return projects.some(p => p.id === id);
}