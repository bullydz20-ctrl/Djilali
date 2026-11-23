import type { AdminAccount, ArenaState, LockoutState, PlayerLevel, PlayerStatus } from './types';

// Held strictly in JS memory (never localStorage or sessionStorage)
let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body != null) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
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

export async function fetchArenaState(tournamentId?: number | null): Promise<ArenaState> {
  const qs = tournamentId != null ? `?tournamentId=${encodeURIComponent(String(tournamentId))}` : '';
  return apiRequest<ArenaState>(`/api/state${qs}`);
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
  setAuthToken(res.token);
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
  setAuthToken(res.token);
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
  return apiRequest<{ ok: boolean; messageAr: string }>('/api/admin/change-pin', {
    method: 'POST',
    body: JSON.stringify({ currentPin, newPin })
  });
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
