import crypto from 'node:crypto';
import { AdminRole } from './constants.js';

export const PIN_LENGTH = 6;
export const MAX_SUB_ADMINS = 5;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 30_000;
export const PBKDF2_ITERATIONS = 65_536;
export const PBKDF2_KEY_LEN = 32;
export const SESSION_TTL_EPHEMERAL_MS = 12 * 60 * 60 * 1000;
export const SESSION_TTL_PERSISTENT_MS = 30 * 24 * 60 * 60 * 1000;

const SESSION_SECRET =
  process.env.CP4_SESSION_SECRET && process.env.CP4_SESSION_SECRET.trim().length >= 16
    ? process.env.CP4_SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

export function isValidPinFormat(pin) {
  return typeof pin === 'string' && /^\d{6}$/.test(pin);
}

export function evaluatePinStrength(pin) {
  if (!isValidPinFormat(pin)) {
    return { code: 'INVALID', labelAr: 'يجب أن يكون 6 أرقام' };
  }
  const uniqueDigits = new Set(pin.split('')).size;
  if (uniqueDigits <= 2) {
    return { code: 'WEAK', labelAr: 'ضعيف (أرقام مكررة)' };
  }
  const sequential = ['012345', '123456', '234567', '345678', '456789', '987654', '876543', '765432', '654321', '543210'];
  if (sequential.includes(pin)) {
    return { code: 'WEAK', labelAr: 'ضعيف (تسلسل واضح)' };
  }
  if (uniqueDigits >= 4) {
    return { code: 'STRONG', labelAr: 'قوي ومشفر' };
  }
  return { code: 'GOOD', labelAr: 'مقبول' };
}

export function generateSalt() {
  return crypto.randomBytes(16).toString('base64');
}

export function hashPin(pin, saltBase64) {
  const saltBytes = Buffer.from(saltBase64, 'base64');
  const derived = crypto.pbkdf2Sync(pin, saltBytes, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, 'sha256');
  return `pbkdf2_v1:${derived.toString('base64')}`;
}

export function verifyPin(pin, saltBase64, expectedHash) {
  if (!isValidPinFormat(pin) || !saltBase64 || !expectedHash) return false;
  try {
    const computed = hashPin(pin, saltBase64);
    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(expectedHash, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function computePermissionsHash({
  username,
  role,
  canManageTournament,
  canManagePlayers,
  canRunDraw,
  canEditScores,
  canCrownChampion,
  pinSalt,
  pinHash
}) {
  const payload = [
    String(username).trim().toLowerCase(),
    role,
    canManageTournament ? '1' : '0',
    canManagePlayers ? '1' : '0',
    canRunDraw ? '1' : '0',
    canEditScores ? '1' : '0',
    canCrownChampion ? '1' : '0',
    pinSalt,
    pinHash
  ].join('|');
  const digest = crypto.createHash('sha256').update(payload, 'utf8').digest('base64');
  return `perm_v1:${digest}`;
}

export function verifyPermissionsIntegrity(admin) {
  if (!admin) return false;
  const expected = computePermissionsHash({
    username: admin.username,
    role: admin.role,
    canManageTournament: Boolean(admin.canManageTournament),
    canManagePlayers: Boolean(admin.canManagePlayers),
    canRunDraw: Boolean(admin.canRunDraw),
    canEditScores: Boolean(admin.canEditScores),
    canCrownChampion: Boolean(admin.canCrownChampion),
    pinSalt: admin.pinSalt,
    pinHash: admin.pinHash
  });
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(admin.permissionsHash || ''), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function hasPermission(admin, permission) {
  if (!admin || !admin.isActive || !verifyPermissionsIntegrity(admin)) return false;
  if (admin.role === AdminRole.HEAD_ADMIN) return true;
  switch (permission) {
    case 'MANAGE_TOURNAMENT':
      return Boolean(admin.canManageTournament);
    case 'MANAGE_PLAYERS':
      return Boolean(admin.canManagePlayers);
    case 'RUN_DRAW':
      return Boolean(admin.canRunDraw);
    case 'EDIT_SCORES':
      return Boolean(admin.canEditScores);
    case 'CROWN_CHAMPION':
      return Boolean(admin.canCrownChampion);
    default:
      return false;
  }
}

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(String(token), 'utf8').digest('hex');
}

export function sanitizeAdminPublic(admin) {
  return {
    id: admin.id,
    username: admin.username,
    displayName: admin.displayName,
    role: admin.role,
    canManageTournament: Boolean(admin.canManageTournament),
    canManagePlayers: Boolean(admin.canManagePlayers),
    canRunDraw: Boolean(admin.canRunDraw),
    canEditScores: Boolean(admin.canEditScores),
    canCrownChampion: Boolean(admin.canCrownChampion),
    isActive: Boolean(admin.isActive),
    lastLoginAt: admin.lastLoginAt ?? null,
    createdAt: admin.createdAt
  };
}
