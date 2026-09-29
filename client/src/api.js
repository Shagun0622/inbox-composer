const BASE = '/api';

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export async function parsePaste({ permalink, pastedText }) {
  return post('/parse', { permalink, pastedText });
}

export async function validateDraft(draft) {
  return post('/validate', { draft });
}

export async function confirmDraft(draft, actor = 'ui-user') {
  return post('/confirm', { draft, actor });
}