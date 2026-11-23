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

export function getOrCreateVoterKey(): string {
  const key = 'cp4_voter_id';
  try {
    if (typeof window === 'undefined') return 'anon-ssr';
    let existing = window.localStorage.getItem(key);
    if (!existing) {
      existing =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(key, existing);
    }
    return existing;
  } catch {
    return `v_${Date.now()}`;
  }
}

export async function toggleMatchCheckInApi(matchId: number, playerSlot: 1 | 2, checkedIn?: boolean) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/matches/${matchId}/checkin`, {
    method: 'POST',
    body: JSON.stringify({ playerSlot, checkedIn })
  });
}

export async function voteMatchPredictionApi(matchId: number, pickedSlot: 1 | 2, voterKey?: string) {
  return apiRequest<{ ok: boolean; votesP1: number; votesP2: number; messageAr: string }>(
    `/api/matches/${matchId}/predict`,
    {
      method: 'POST',
      body: JSON.stringify({ voterKey: voterKey || getOrCreateVoterKey(), pickedSlot })
    }
  );
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

export async function resolveMatchDisputeApi(matchId: number, resolutionNote?: string) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/matches/${matchId}/dispute/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolutionNote })
  });
}

export async function adminWalkoverMatchApi(matchId: number, winnerSlot: 1 | 2, reason?: string) {
  return apiRequest<{ ok: boolean; messageAr: string }>(`/api/matches/${matchId}/walkover`, {
    method: 'POST',
    body: JSON.stringify({ winnerSlot, reason })
  });
}

export async function bulkImportPlayersApi(
  tournamentId: number,
  payload: { linesText: string; status?: 'APPROVED' | 'PENDING' }
) {
  return apiRequest<{
    ok: boolean;
    addedCount: number;
    skippedCount: number;
    skippedReasons: string[];
    messageAr: string;
  }>(`/api/tournaments/${tournamentId}/players/bulk`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function autoScheduleMatchesApi(
  tournamentId: number,
  payload: { startAtMillis?: number; intervalMinutes?: number; onlyUnscheduled?: boolean }
) {
  return apiRequest<{ ok: boolean; scheduledCount: number; messageAr: string }>(
    `/api/tournaments/${tournamentId}/schedule-matches`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
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
