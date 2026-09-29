import express from 'express';
import { validateDraft } from '../services/validator.js';

const router = express.Router();

router.post('/validate', (req, res) => {
  const draft = req.body?.draft;

  if (!draft || typeof draft !== 'object') {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_DRAFT',
      message: 'draft is required in the request body.',
    });
  }

  // Re-run validation with whatever the user edited
  const validation = validateDraft(draft);

  return res.json({
    ok: true,
    draft: validation.enriched,
    verdict: validation.verdict,
    issues: validation.issues,
  });
});

export default router;