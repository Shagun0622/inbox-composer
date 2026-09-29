import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixture');

function readJson(filename) {
  const filePath = path.join(FIXTURE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[fixture-loader] Missing file: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(`[fixture-loader] Invalid JSON in ${filename}: ${err.message}`);
  }
}

function readJsonl(filename) {
  const filePath = path.join(FIXTURE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[fixture-loader] Missing file: ${filePath}`);
  }
  const lines = fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
  return lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(`[fixture-loader] Invalid JSONL at line ${i + 1} of ${filename}: ${err.message}`);
    }
  });
}

// Load once
const ledgerData = readJson('signal-ledger.json');
const configData = readJson('config.json');
const routingHintsData = readJson('routing-hints.json');
const runLogData = readJsonl('run-log.jsonl');

// Frozen bundle
export const fixture = Object.freeze({
  ledger: ledgerData,
  config: configData,
  routingHints: routingHintsData,
  runLog: runLogData,
});

// Named exports — every name matches what other modules import
export const signals = ledgerData.signals;
export const projects = configData.projects;
export const fallbacks = configData.fallbacks;
export const internalDomains = configData.internal_domains;
export const feedFreshnessThresholdDays = configData.feed_freshness_threshold_days;
export const routingHints = routingHintsData;
export const runLog = runLogData;

export default fixture;