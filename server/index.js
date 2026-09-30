import express from 'express';
import cors from 'cors';
import { signals, projects, runLog } from './fixture-loader.js';
import parseRoutes from './routes/parse.js';
import validateRoutes from './routes/validate.js';
import confirmRoutes from './routes/confirm.js';
import signalRoutes from './routes/signals.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Server is running' });
});

// Fixture summary
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

// Mission routes
app.use('/api', parseRoutes);
app.use('/api', validateRoutes);
app.use('/api', confirmRoutes);
app.use('/api', signalRoutes);

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    ok: false,
    error: 'NOT_FOUND',
    message: `No route for ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[server] unhandled error:', err.message);
  res.status(500).json({
    ok: false,
    error: 'INTERNAL',
    message: 'Something went wrong on the server.',
  });
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});