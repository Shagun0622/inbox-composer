import express from 'express';
import { parseChat } from '../services/parser.js';
import { validateDraft } from '../services/validator.js';

const router = express.Router();

router.post('/parse', (req, res) => {
  const { permalink, pastedText } = req.body ?? {};

  if (typeof pastedText !== 'string' || pastedText.trim().length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_PASTE',
      message: 'pastedText is required.',
    });
  }

  const parsed = parseChat({ permalink, pastedText });
  if (!parsed.ok) {
    return res.status(422).json({
      ok: false,
      error: 'PARSE_FAILED',
      message: parsed.errors.join(' '),
      issues: parsed.errors.map(e => ({ level: 'error', message: e })),
    });
  }

  // Run validator to enrich + flag issues. No writing happens here.
  const validation = validateDraft(parsed.draft);

  return res.json({
    ok: true,
    draft: validation.enriched,
    verdict: validation.verdict,
    issues: validation.issues,
    warnings: parsed.warnings,
  });
});

export default router;