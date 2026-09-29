import express from 'express';
import { writeSignal } from '../services/writer.js';

const router = express.Router();

router.post('/confirm', (req, res) => {
  const { draft, actor } = req.body ?? {};

  if (!draft || typeof draft !== 'object') {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_DRAFT',
      message: 'draft is required in the request body.',
    });
  }

  const result = writeSignal(draft, {
    source: 'composer',
    actor: actor || 'ui-user',
  });

  if (!result.ok) {
    return res.status(409).json({
      ok: false,
      error: result.reason || 'WRITE_FAILED',
      verdict: result.verdict,
      issues: result.issues,
    });
  }

  return res.status(201).json({
    ok: true,
    written: true,
    signalId: result.signalId,
    verdict: result.verdict,
    issues: result.issues,
  });
});

export default router;