import express from 'express';
import cors from 'cors';
import { signals, projects, runLog } from './fixture-loader.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Server is running' });
});

// Fixture summary — proves server can read fixture and expose it
app.get('/api/fixture/summary', (req, res) => {
  res.json({
    ok: true,
    counts: {
      signals: signals.length,
      projects: projects.length,
      runLogRows: runLog.length,
    },
    projects: projects.map(p => ({ id: p.id, name: p.name, type: p.type })),
  });
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});