import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArenaApp } from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function loadLocalEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let val = trimmed.slice(eqIndex + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadLocalEnvFile(path.join(rootDir, '.env'));

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST?.trim() || '0.0.0.0';
const resolvedDbPath = process.env.CP4_DB_PATH?.trim()
  ? path.resolve(process.env.CP4_DB_PATH.trim())
  : path.join(rootDir, 'data', 'cp4_arena.db');
const resolvedUploadsDir = process.env.CP4_UPLOADS_DIR?.trim()
  ? path.resolve(process.env.CP4_UPLOADS_DIR.trim())
  : path.join(path.dirname(resolvedDbPath), 'uploads');

const { app, db } = createArenaApp({
  dbPath: resolvedDbPath,
  uploadsDir: resolvedUploadsDir,
  distDir: path.join(rootDir, 'dist')
});

const server = app.listen(port, host, () => {
  console.log(`CP4 ARENA server running at http://${host}:${port}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down CP4 ARENA gracefully...`);
  server.close(() => {
    try {
      db.close();
    } catch {
      // ignore close errors during exit
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

