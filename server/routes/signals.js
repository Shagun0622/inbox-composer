import express from 'express';
import db from '../db.js';

const router = express.Router();

router.get('/signals/recent', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? '5', 10), 50);

  const rows = db.prepare(`
    SELECT id, title, date, time, type, source, created_at
    FROM signals
    ORDER BY created_at DESC, date DESC
    LIMIT ?
  `).all(limit);

  res.json({
    ok: true,
    count: rows.length,
    signals: rows,
  });
});

export default router;