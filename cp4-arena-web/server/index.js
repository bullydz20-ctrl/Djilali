import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArenaAppAsync } from './app.js';
import { getPersistenceDiagnostics } from './cloudStore.js';

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

const { app, cloudStore, shutdownResources } = await createArenaAppAsync({
  dbPath: resolvedDbPath,
  uploadsDir: resolvedUploadsDir,
  distDir: path.join(rootDir, 'dist')
});

const diagnostics = getPersistenceDiagnostics({ dbPath: resolvedDbPath, cloudStore });
console.log(`[CP4 ARENA] Persistence mode: ${diagnostics.mode} (durable=${diagnostics.isDurable})`);
if (!diagnostics.isDurable) {
  console.warn('[CP4 ARENA] WARNING: Running on ephemeral filesystem without DATABASE_URL. Set DATABASE_URL to keep data & sub-admins after sleep.');
}

const server = app.listen(port, host, () => {
  console.log(`CP4 ARENA server running at http://${host}:${port}`);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, flushing & shutting down CP4 ARENA gracefully...`);
  server.close(async () => {
    await shutdownResources();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
