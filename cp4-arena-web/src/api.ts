import type { AdminAccount, ArenaState, LockoutState, PlayerLevel, PlayerStatus } from './types';

const STORAGE_TOKEN_KEY = 'cp4_admin_token';
const STORAGE_KEEP_KEY = 'cp4_keep_signed_in';
const STORAGE_LAST_USER_KEY = 'cp4_last_admin_username';

function readInitialToken(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return (
      window.localStorage.getItem(STORAGE_TOKEN_KEY) ||
      window.sessionStorage.getItem(STORAGE_TOKEN_KEY) ||
      null
    );
  } catch {
    return null;
  }
}

let inMemoryToken: string | null = readInitialToken();

export function getStoredKeepSignedIn(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    const raw = window.localStorage.getItem(STORAGE_KEEP_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

export function getLastAdminUsername(): string {
  try {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(STORAGE_LAST_USER_KEY) || '';
  } catch {
    return '';
  }
}

export function setLastAdminUsername(username: string | null) {
  try {
    if (typeof window === 'undefined') return;
    const clean = username?.trim();
    if (clean) {
      window.localStorage.setItem(STORAGE_LAST_USER_KEY, clean);
    }
  } catch {
    // ignore storage restriction errors
  }
}

export function setAuthToken(token: string | null, keepSignedIn?: boolean) {
  const cleanToken = token?.trim() || null;
  inMemoryToken = cleanToken;
  try {
    if (typeof window === 'undefined') return;
    if (keepSignedIn !== undefined) {
      window.localStorage.setItem(STORAGE_KEEP_KEY, keepSignedIn ? '1' : '0');
    }
    if (!cleanToken) {
      window.localStorage.removeItem(STORAGE_TOKEN_KEY);
      window.sessionStorage.removeItem(STORAGE_TOKEN_KEY);
      return;
    }
    const persistLongTerm = keepSignedIn ?? getStoredKeepSignedIn();
    if (persistLongTerm) {
      window.localStorage.setItem(STORAGE_TOKEN_KEY, cleanToken);
      window.sessionStorage.removeItem(STORAGE_TOKEN_KEY);
    } else {
      window.sessionStorage.setItem(STORAGE_TOKEN_KEY, cleanToken);
      window.localStorage.removeItem(STORAGE_TOKEN_KEY);
    }
  } catch {
    // ignore storage restriction errors
  }
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body != null) {
    headers.set('Content-Type', 'application/json');
  }
  const activeToken = inMemoryToken || readInitialToken();
  if (activeToken) {
    inMemoryToken = activeToken;
    headers.set('Authorization', `Bearer ${activeToken}`);
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url !== '/api/admin/login' && url !== '/api/admin/setup-head') {
    setAuthToken(null);
  }
  if (!res.ok) {
    const err = new Error(data.error || 'حدث خطأ أثناء الاتصال بالخادم.') as Error & {
      status?: number;
      lockoutState?: LockoutState;
    };
    err.status = res.status;
    err.lockoutState = data.lockoutState;
    throw err;
  }
  return data as T;
}

export async function fetchArenaState(
  tournamentId?: number | null,
  savedUsername?: string | null
): Promise<ArenaState> {
  const params = new URLSearchParams();
  if (tournamentId != null) {
    params.set('tournamentId', String(tournamentId));
  }
  const cleanUser = savedUsername?.trim() || getLastAdminUsername().trim();
  if (cleanUser) {
    params.set('username', cleanUser);
  }
  const qs = params.toString();
  return apiRequest<ArenaState>(`/api/state${qs ? `?${qs}` : ''}`);
}

export async function registerPlayerApi(payload: {
  tournamentId: number;
  name: string;
  elysiumNetId: string;
  avatarUrl: string | null;
  level: PlayerLevel;
  clubName: string;
}) {
  return apiRequest<{ ok: boolean; messageAr: string }>('/api/players/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function setupHeadAdminApi(payload: {
  username: string;
  displayName: string;
  pin: string;
  keepSignedIn: boolean;
}) {
  const res = await apiRequest<{ ok: boolean; token: string; admin: AdminAccount; messageAr: string }>(
    '/api/admin/setup-head',
    { method: 'POST', body: JSON.stringify(payload) }
  );
  setAuthToken(res.token, payload.keepSignedIn);
  setLastAdminUsername(res.admin?.username || payload.username);
  return res;
}

export async function loginAdminApi(payload: { username: string; pin: string; keepSignedIn: boolean }) {
  const res = await apiRequest<{
    ok: boolean;
    token: string;
    admin: AdminAccount;
    lockoutState: LockoutState;
    messageAr: string;
  }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  setAuthToken(res.token, payload.keepSignedIn);
  setLastAdminUsername(res.admin?.username || payload.username);
  return res;
}

export async function logoutAdminApi() {
  try {
    await apiRequest('/api/admin/logout', { method: 'POST' });
  } finally {
    setAuthToken(null);
  }
}

export async function changeOwnPinApi(currentPin: string, newPin: string) {
  const res = await apiRequest<{ ok: boolean; token?: string; messageAr: string }>('/api/admin/change-pin', {
    method: 'POST',
    body: JSON.stringify({ currentPin, newPin })
  });
  if (res.token) {
    setAuthToken(res.token);
  }
  return res;
}

export async function updateOwnProfileApi(payload: { displayName: string; username?: string }) {
  const res = await apiRequest<{ ok: boolean; token?: string; admin: AdminAccount; messageAr: string }>(
    '/api/admin/profile',
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
  );
  if (res.token) {
    setAuthToken(res.token);
  }
  if (res.admin?.username) {
    setLastAdminUsername(res.admin.username);
  }
  return res;
}

export async function createSubAdminApi(payload: {
  username: string;
  displayName: string;
  pin: string;
  canManageTournament: boolean;
  canManagePlayers: boolean;
  canRunDraw: boolean;
  canEditScores: boolean;
  canCrownChampion: boolean;
}) {
  return apiRequest<{ ok: boolean; messageAr: string }>('/api/admin/sub-admins', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateSubAdminApi(
  id: number,
  payload: {
    displayName: string;
    newPin?: string | null;
    isActive: boolean;
    canManageTournament: boolean;
    canManagePlayers: boolean;
    canRunDraw: boolean;
    canEditScores: boolean;
    canCrownChampion: boolean;
  }
) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/admin/sub-admins/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteSubAdminApi(id: number) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/admin/sub-admins/${id}`, {
    method: 'DELETE'
  });
}

export async function createTournamentApi(payload: Record<string, unknown>) {
  return apiRequest<{ ok: boolean; tournament: { id: number }; messageAr: string }>('/api/tournaments', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateTournamentApi(id: number, payload: Record<string, unknown>) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/tournaments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function deleteTournamentApi(id: number) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/tournaments/${id}`, {
    method: 'DELETE'
  });
}

export async function adminAddPlayerApi(
  tournamentId: number,
  payload: {
    name: string;
    elysiumNetId: string;
    avatarUrl: string | null;
    level: PlayerLevel;
    ovrRating?: number;
    clubName: string;
    status?: PlayerStatus;
  }
) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/tournaments/${tournamentId}/players`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updatePlayerStatusApi(id: number, status: PlayerStatus) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/players/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export async function updatePlayerDetailsApi(id: number, payload: Record<string, unknown>) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/players/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deletePlayerApi(id: number) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/players/${id}`, {
    method: 'DELETE'
  });
}

export async function runDrawApi(
  tournamentId: number,
  manualGroupAssignments: Record<number, number>,
  manualKnockoutOrder: number[]
) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/tournaments/${tournamentId}/draw`, {
    method: 'POST',
    body: JSON.stringify({ manualGroupAssignments, manualKnockoutOrder })
  });
}

export async function generateKnockoutApi(tournamentId: number) {
  return apiRequest<{ ok: boolean; messageAr: string }>(
    `/api/tournaments/${tournamentId}/knockout-from-standings`,
    { method: 'POST' }
  );
}

export async function updateMatchScoreApi(
  matchId: number,
  payload: {
    leg1Score1: number | null;
    leg1Score2: number | null;
    leg2Score1: number | null;
    leg2Score2: number | null;
    penaltyScore1: number | null;
    penaltyScore2: number | null;
  }
) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/matches/${matchId}/score`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function updateKnockoutWinnerApi(matchId: number, winnerPlayerId: number | null) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/matches/${matchId}/winner`, {
    method: 'PATCH',
    body: JSON.stringify({ winnerPlayerId })
  });
}

export async function createRaceApi(
  tournamentId: number,
  payload: { title?: string; stage?: 'REGULAR' | 'QUALIFIER' | 'FINAL'; trackName?: string } = {}
) {
  return apiRequest<{ ok: boolean; race: unknown; messageAr: string }>(`/api/tournaments/${tournamentId}/races`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function saveRaceResultsApi(
  raceId: number,
  payload: {
    title?: string;
    trackName?: string;
    entries: Array<{ playerId: number; position: number; bestLapOrTime?: string; dnf?: boolean }>;
  }
) {
  return apiRequest<{ ok: boolean; race: unknown; messageAr: string }>(`/api/races/${raceId}/results`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function generateFinalRaceApi(
  tournamentId: number,
  payload: { title?: string; trackName?: string; qualifiersCount?: number } = {}
) {
  return apiRequest<{ ok: boolean; race: unknown; messageAr: string }>(
    `/api/tournaments/${tournamentId}/races/generate-final`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteRaceApi(raceId: number) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/races/${raceId}`, {
    method: 'DELETE'
  });
}

export async function bulkImportPlayersApi(
  tournamentId: number,
  linesText: string,
  status: 'APPROVED' | 'PENDING'
) {
  return apiRequest<{ ok: boolean; importedCount: number; skippedCount: number; messageAr: string }>(
    `/api/tournaments/${tournamentId}/players/bulk`,
    {
      method: 'POST',
      body: JSON.stringify({ linesText, status })
    }
  );
}

export async function autoScheduleMatchesApi(
  tournamentId: number,
  payload: { startAtMillis?: number; intervalMinutes?: number; onlyUnscheduled?: boolean }
) {
  return apiRequest<{ ok: boolean; scheduledCount: number; messageAr: string }>(
    `/api/tournaments/${tournamentId}/auto-schedule`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function toggleMatchCheckInApi(matchId: number, slot: 1 | 2) {
  return apiRequest<{ ok: boolean; checkedIn: boolean; messageAr: string }>(`/api/matches/${matchId}/check-in`, {
    method: 'POST',
    body: JSON.stringify({ slot })
  });
}

export async function voteMatchPredictionApi(matchId: number, slot: 1 | 2) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/matches/${matchId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ slot })
  });
}

export async function submitMatchDisputeApi(
  matchId: number,
  payload: { submittedBy: string; note: string; screenshotUrl?: string | null }
) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/matches/${matchId}/dispute`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function resolveMatchDisputeApi(matchId: number, resolutionNote: string) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/matches/${matchId}/dispute/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolutionNote })
  });
}

export async function walkoverMatchApi(matchId: number, winnerSlot: 1 | 2, reason: string) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/matches/${matchId}/walkover`, {
    method: 'POST',
    body: JSON.stringify({ winnerSlot, reason })
  });
}

export async function crownChampionApi(tournamentId: number, playerId: number | null) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/tournaments/${tournamentId}/champion`, {
    method: 'POST',
    body: JSON.stringify({ playerId })
  });
}

export async function fetchTournamentExportApi(tournamentId: number) {
  return apiRequest<{ ok: boolean; fileName: string; fullText: string; socialText: string }>(
    `/api/tournaments/${tournamentId}/export`
  );
}

export async function scheduleReminderApi(payload: {
  matchId: number;
  matchTitle: string;
  scheduledAtMillis: number;
  leadMinutes: number;
}) {
  return apiRequest<{ ok: boolean; messageAr: string }>('/api/reminders', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function cancelReminderApi(matchId: number) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/reminders/${matchId}`, {
    method: 'DELETE'
  });
}

export async function uploadImageFileApi(file: File): Promise<string> {
  const dataUrl = await compressImageToDataUrl(file, 900, 0.86);
  const res = await apiRequest<{ url: string }>('/api/uploads/image', {
    method: 'POST',
    body: JSON.stringify({ dataUrl })
  });
  return res.url;
}

function compressImageToDataUrl(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الملف المختار.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('الملف المختار ليس صورة صالحة.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('تعذر معالجة الصورة.'));
        ctx.drawImage(img, 0, 0, w, h);
        const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(outType, quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const HEAD_AUTO_BACKUP_KEY = 'cp4_head_auto_backup';

export interface HeadAutoBackupSummary {
  backup: Record<string, unknown>;
  exportedAt: number;
  tournamentsCount: number;
  playersCount: number;
  subAdminsCount: number;
}

export async function fetchBackupJsonApi(): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>('/api/admin/backup');
}

export function saveHeadAutoBackup(backup: Record<string, unknown>) {
  try {
    if (typeof window === 'undefined' || !backup || typeof backup !== 'object') return;
    window.localStorage.setItem(HEAD_AUTO_BACKUP_KEY, JSON.stringify(backup));
  } catch {
    // ignore storage quota errors
  }
}

export function getHeadAutoBackupSummary(): HeadAutoBackupSummary | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(HEAD_AUTO_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || !Array.isArray(parsed.tournaments) || !Array.isArray(parsed.players)) {
      return null;
    }
    const adminList = Array.isArray(parsed.adminAccounts)
      ? (parsed.adminAccounts as Array<Record<string, unknown>>)
      : [];
    return {
      backup: parsed,
      exportedAt: Number(parsed.exportedAt) || Date.now(),
      tournamentsCount: parsed.tournaments.length,
      playersCount: parsed.players.length,
      subAdminsCount: adminList.filter((a) => a.role === 'SUB_ADMIN').length
    };
  } catch {
    return null;
  }
}

export async function downloadBackupApi(): Promise<{ ok: boolean; messageAr: string }> {
  const backup = await fetchBackupJsonApi();
  saveHeadAutoBackup(backup);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const datePart = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `cp4-arena-backup-${datePart}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { ok: true, messageAr: 'تم تنزيل ملف النسخة الاحتياطية الكاملة (JSON) بنجاح.' };
}

export async function restoreBackupApi(backupData: unknown) {
  const res = await apiRequest<{
    ok: boolean;
    token?: string;
    admin?: AdminAccount;
    messageAr: string;
  }>('/api/admin/restore', {
    method: 'POST',
    body: JSON.stringify(backupData)
  });
  if (res.token) {
    setAuthToken(res.token);
  }
  if (res.admin?.username) {
    setLastAdminUsername(res.admin.username);
  }
  return res;
}
