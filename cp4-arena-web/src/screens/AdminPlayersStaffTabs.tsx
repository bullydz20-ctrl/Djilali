import { useState } from 'react';
import { CalendarClock, Check, Edit3, FileSpreadsheet, History, ImagePlus, Plus, Trash2, Trophy, UserPlus, X } from 'lucide-react';
import { uploadImageFileApi } from '../api';
import { MatchResultsTable } from '../components/MatchResultsTable';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { RacingOverviewPanel, isRacingFormat } from '../components/RacingSection';
import {
  ADMIN_PERMISSIONS_META,
  LEVEL_LABELS,
  SUB_ADMIN_PRESETS,
  evaluatePinStrengthClient
} from '../types';
import type { AdminAccount, ArenaState, Match, Player, PlayerLevel, PlayerStatus, RaceEntry, RaceStage } from '../types';

export function AdminPlayersTab({
  state,
  onAdminAddPlayer,
  onBulkImport,
  onStatusChange,
  onUpdateDetails,
  onDeletePlayer
}: {
  state: ArenaState;
  onAdminAddPlayer: (payload: {
    name: string;
    elysiumNetId: string;
    avatarUrl: string | null;
    level: PlayerLevel;
    ovrRating: number;
    clubName: string;
    status: PlayerStatus;
  }) => Promise<void>;
  onBulkImport: (linesText: string, status: 'APPROVED' | 'PENDING') => Promise<void>;
  onStatusChange: (id: number, status: PlayerStatus) => Promise<void>;
  onUpdateDetails: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onDeletePlayer: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Player | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  return (
    <div className="stack-col">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>
          طلبات التسجيل الجديدة ({state.pendingPlayers.length})
        </div>
        {state.tournament && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: '7px 11px', fontSize: '0.8rem' }}
              onClick={() => setShowBulkModal(true)}
            >
              <FileSpreadsheet size={15} />
              <span>استيراد دفعة</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '7px 12px', fontSize: '0.82rem' }}
              onClick={() => setShowAddModal(true)}
            >
              <UserPlus size={16} />
              <span>إضافة لاعب مباشرة</span>
            </button>
          </div>
        )}
      </div>

      {state.pendingPlayers.length === 0 ? (
        <div className="arena-card" style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
          لا توجد طلبات بانتظار المراجعة حالياً.
        </div>
      ) : (
        state.pendingPlayers.map((p) => (
          <AdminPlayerRow
            key={p.id}
            player={p}
            onApprove={() => onStatusChange(p.id, 'APPROVED')}
            onReject={() => onStatusChange(p.id, 'REJECTED')}
            onEdit={() => setEditing(p)}
            onDelete={() => onDeletePlayer(p.id)}
          />
        ))
      )}

      <div style={{ fontWeight: 800, color: 'var(--emerald-win)' }}>
        اللاعبون المعتمدون ({state.approvedPlayers.length})
      </div>
      {state.approvedPlayers.map((p) => (
        <AdminPlayerRow
          key={p.id}
          player={p}
          onReject={() => onStatusChange(p.id, 'REJECTED')}
          onEdit={() => setEditing(p)}
          onDelete={() => onDeletePlayer(p.id)}
        />
      ))}

      {state.rejectedPlayers.length > 0 && (
        <>
          <div style={{ fontWeight: 800, color: 'var(--crimson-loss)' }}>
            المرفوضون ({state.rejectedPlayers.length})
          </div>
          {state.rejectedPlayers.map((p) => (
            <AdminPlayerRow
              key={p.id}
              player={p}
              onApprove={() => onStatusChange(p.id, 'APPROVED')}
              onEdit={() => setEditing(p)}
              onDelete={() => onDeletePlayer(p.id)}
            />
          ))}
        </>
      )}

      {showAddModal && (
        <AdminAddPlayerModal
          onClose={() => setShowAddModal(false)}
          onAdd={async (payload) => {
            await onAdminAddPlayer(payload);
            setShowAddModal(false);
          }}
        />
      )}

      {showBulkModal && (
        <BulkImportPlayersModal
          onClose={() => setShowBulkModal(false)}
          onImport={async (linesText, status) => {
            await onBulkImport(linesText, status);
            setShowBulkModal(false);
          }}
        />
      )}

      {editing && (
        <EditPlayerModal
          player={editing}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            await onUpdateDetails(editing.id, payload);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function BulkImportPlayersModal({
  onClose,
  onImport
}: {
  onClose: () => void;
  onImport: (linesText: string, status: 'APPROVED' | 'PENDING') => Promise<void>;
}) {
  const [linesText, setLinesText] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [saving, setSaving] = useState(false);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--championship-gold)' }}>استيراد قائمة لاعبين دفعة واحدة</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          اكتب كل لاعب في سطر منفصل بالصيغة:
          <br />
          <strong style={{ color: 'var(--cyber-sky)' }}>الاسم | معرف ElysiumNet/ XeMoNat | النادي (اختياري)</strong>
        </div>
        <textarea
          className="input"
          style={{ minHeight: 150, direction: 'ltr', textAlign: 'left' }}
          value={linesText}
          onChange={(e) => setLinesText(e.target.value)}
          placeholder={'أحمد | ahmed_x1 | Real Madrid\nسالم | salem_pro | Barcelona'}
        />
        <div className="arena-subcard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>اعتماد اللاعبين تلقائياً فور الاستيراد</span>
          <button type="button" className={`switch-pill ${autoApprove ? 'on' : ''}`} onClick={() => setAutoApprove((v) => !v)}>
            <span className="switch-knob" />
          </button>
        </div>
        <div className="grid-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !linesText.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await onImport(linesText, autoApprove ? 'APPROVED' : 'PENDING');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'جاري الاستيراد...' : 'تنفيذ الاستيراد'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminPlayerRow({
  player,
  onApprove,
  onReject,
  onEdit,
  onDelete
}: {
  player: Player;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="arena-card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <PlayerAvatar avatarUrl={player.avatarUrl} name={player.name} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--cyber-sky)' }}>
            {player.elysiumNetId} • {LEVEL_LABELS[player.level].label} ({player.ovrRating})
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {onApprove && (
          <button type="button" className="icon-btn" onClick={onApprove} title="اعتماد" style={{ color: 'var(--emerald-win)' }}>
            <Check size={16} />
          </button>
        )}
        {onReject && (
          <button type="button" className="icon-btn" onClick={onReject} title="رفض" style={{ color: 'var(--crimson-loss)' }}>
            <X size={16} />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={onEdit} title="تعديل" style={{ color: 'var(--championship-gold)' }}>
          <Edit3 size={16} />
        </button>
        <button type="button" className="icon-btn" onClick={onDelete} title="حذف">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function AdminAddPlayerModal({
  onClose,
  onAdd
}: {
  onClose: () => void;
  onAdd: (payload: {
    name: string;
    elysiumNetId: string;
    avatarUrl: string | null;
    level: PlayerLevel;
    ovrRating: number;
    clubName: string;
    status: PlayerStatus;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [elysiumId, setElysiumId] = useState('');
  const [clubName, setClubName] = useState('');
  const [level, setLevel] = useState<PlayerLevel>('INTERMEDIATE');
  const [ovrRating, setOvrRating] = useState(String(LEVEL_LABELS.INTERMEDIATE.ovr));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      const url = await uploadImageFileApi(file);
      setAvatarUrl(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'تعذر رفع الصورة.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, color: 'var(--championship-gold)' }}>إضافة لاعب مباشرة للبطولة</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PlayerAvatar avatarUrl={avatarUrl} name={name || 'P'} size={52} />
          <label className="btn btn-outline" style={{ cursor: 'pointer', flex: 1 }}>
            <ImagePlus size={17} />
            <span>{uploading ? 'جاري الرفع...' : avatarUrl ? 'تغيير الصورة' : 'رفع صورة (اختياري)'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
          </label>
          {avatarUrl && (
            <button type="button" className="icon-btn" onClick={() => setAvatarUrl(null)} title="إزالة الصورة">
              <X size={16} />
            </button>
          )}
        </div>

        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم اللاعب *" />
        <input className="input" value={elysiumId} onChange={(e) => setElysiumId(e.target.value)} placeholder="معرف اللاعب في ElysiumNet/ XeMoNat *" />
        <input className="input" value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder="النادي / الشخصية المفضلة" />
        <input className="input" type="number" min={60} max={99} value={ovrRating} onChange={(e) => setOvrRating(e.target.value)} placeholder="التقييم (60-99)" />

        <div className="chip-row">
          {(['BEGINNER', 'INTERMEDIATE', 'PRO', 'LEGEND'] as PlayerLevel[]).map((lvl) => (
            <button
              key={lvl}
              type="button"
              className={`chip ${level === lvl ? 'selected' : ''}`}
              onClick={() => {
                setLevel(lvl);
                setOvrRating(String(LEVEL_LABELS[lvl].ovr));
              }}
            >
              {LEVEL_LABELS[lvl].label}
            </button>
          ))}
        </div>

        <div className="arena-subcard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>اعتماد اللاعب مباشرة في البطولة</span>
          <button type="button" className={`switch-pill ${autoApprove ? 'on' : ''}`} onClick={() => setAutoApprove((v) => !v)}>
            <span className="switch-knob" />
          </button>
        </div>

        {err && <div style={{ color: 'var(--crimson-loss)', fontSize: '0.82rem', fontWeight: 700 }}>{err}</div>}

        <div className="grid-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || uploading || !name.trim() || !elysiumId.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await onAdd({
                  name: name.trim(),
                  elysiumNetId: elysiumId.trim(),
                  avatarUrl,
                  level,
                  ovrRating: Number(ovrRating) || LEVEL_LABELS[level].ovr,
                  clubName: clubName.trim(),
                  status: autoApprove ? 'APPROVED' : 'PENDING'
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'جاري الإضافة...' : 'إضافة اللاعب'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPlayerModal({
  player,
  onClose,
  onSave
}: {
  player: Player;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(player.name);
  const [elysiumId, setElysiumId] = useState(player.elysiumNetId);
  const [clubName, setClubName] = useState(player.clubName);
  const [level, setLevel] = useState<PlayerLevel>(player.level);
  const [ovrRating, setOvrRating] = useState(String(player.ovrRating));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(player.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      const url = await uploadImageFileApi(file);
      setAvatarUrl(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'تعذر رفع الصورة.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, color: 'var(--championship-gold)' }}>تعديل بيانات اللاعب</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PlayerAvatar avatarUrl={avatarUrl} name={name || player.name} size={52} />
          <label className="btn btn-outline" style={{ cursor: 'pointer', flex: 1 }}>
            <ImagePlus size={17} />
            <span>{uploading ? 'جاري الرفع...' : avatarUrl ? 'تغيير الصورة' : 'إضافة صورة'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
          </label>
          {avatarUrl && (
            <button type="button" className="icon-btn" onClick={() => setAvatarUrl(null)} title="إزالة الصورة">
              <X size={16} />
            </button>
          )}
        </div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" />
        <input className="input" value={elysiumId} onChange={(e) => setElysiumId(e.target.value)} placeholder="معرف اللاعب في ElysiumNet/ XeMoNat" />
        <input className="input" value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder="النادي / الفريق" />
        <input className="input" type="number" min={60} max={99} value={ovrRating} onChange={(e) => setOvrRating(e.target.value)} placeholder="التقييم (60-99)" />
        <div className="chip-row">
          {(['BEGINNER', 'INTERMEDIATE', 'PRO', 'LEGEND'] as PlayerLevel[]).map((lvl) => (
            <button
              key={lvl}
              type="button"
              className={`chip ${level === lvl ? 'selected' : ''}`}
              onClick={() => {
                setLevel(lvl);
                setOvrRating(String(LEVEL_LABELS[lvl].ovr));
              }}
            >
              {LEVEL_LABELS[lvl].label}
            </button>
          ))}
        </div>
        {err && <div style={{ color: 'var(--crimson-loss)', fontSize: '0.82rem', fontWeight: 700 }}>{err}</div>}
        <div className="grid-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={uploading || !name.trim() || !elysiumId.trim()}
            onClick={() => onSave({ name, elysiumNetId: elysiumId, clubName, level, ovrRating: Number(ovrRating) || 81, avatarUrl })}
          >
            حفظ
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminMatchesTab({
  state,
  onEditMatch,
  onQuickUpdateGoals,
  onAutoSchedule,
  onToggleCheckIn,
  onOpenDispute,
  onCreateRace,
  onEditRace,
  onGenerateFinalRace,
  onDeleteRace
}: {
  state: ArenaState;
  onEditMatch: (m: Match) => void;
  onQuickUpdateGoals: (m: Match, g1: number, g2: number) => void;
  onAutoSchedule: (payload: { startAtMillis?: number; intervalMinutes?: number; onlyUnscheduled?: boolean }) => Promise<void>;
  onToggleCheckIn: (m: Match, slot: 1 | 2) => void;
  onOpenDispute: (m: Match) => void;
  onCreateRace?: (payload: { title?: string; stage?: RaceStage; trackName?: string }) => Promise<void>;
  onEditRace?: (race: RaceEntry) => void;
  onGenerateFinalRace?: (payload?: { title?: string; trackName?: string; qualifiersCount?: number }) => Promise<void>;
  onDeleteRace?: (raceId: number) => Promise<void>;
}) {
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [busySchedule, setBusySchedule] = useState(false);
  const playersById = new Map(state.players.map((p) => [p.id, p]));
  const openDisputesCount = state.allMatches.filter((m) => m.disputeStatus === 'OPEN').length;

  if (isRacingFormat(state.tournament?.format)) {
    return (
      <RacingOverviewPanel
        state={state}
        canEdit={true}
        canRunDraw={true}
        onCreateRace={onCreateRace}
        onEditRace={onEditRace}
        onGenerateFinalRace={onGenerateFinalRace}
        onDeleteRace={onDeleteRace}
      />
    );
  }

  return (
    <div className="stack-col">
      {state.tournament && state.allMatches.length > 0 && (
        <div className="arena-card stack-col" style={{ gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--championship-gold)', fontWeight: 800 }}>
              <CalendarClock size={18} />
              <span>تحديد مواعيد المباريات بضغطة واحدة</span>
            </div>
            {openDisputesCount > 0 && (
              <span style={{ color: 'var(--crimson-loss)', fontSize: '0.78rem', fontWeight: 800 }}>
                يوجد {openDisputesCount} طعن بانتظار الحسم
              </span>
            )}
          </div>
          <div className="chip-row">
            {[15, 20, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                className={`chip ${intervalMinutes === mins ? 'selected' : ''}`}
                onClick={() => setIntervalMinutes(mins)}
              >
                كل {mins} دقيقة
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busySchedule}
            onClick={async () => {
              setBusySchedule(true);
              try {
                await onAutoSchedule({
                  startAtMillis: Date.now() + 15 * 60 * 1000,
                  intervalMinutes,
                  onlyUnscheduled: false
                });
              } finally {
                setBusySchedule(false);
              }
            }}
          >
            <CalendarClock size={17} />
            <span>{busySchedule ? 'جاري الجدولة...' : `توزيع مواعيد المباريات تلقائياً (كل ${intervalMinutes} د)`}</span>
          </button>
        </div>
      )}

      <MatchResultsTable
        title="جدول إدارة نتائج المباريات"
        matches={state.allMatches}
        playersById={playersById}
        canEdit={true}
        scoreUnitLabel={state.tournament?.scoreUnitLabel || 'نقطة'}
        onQuickUpdateGoals={onQuickUpdateGoals}
        onOpenDetailedEditor={onEditMatch}
        onToggleCheckIn={onToggleCheckIn}
        onOpenDispute={onOpenDispute}
      />
    </div>
  );
}

export function AdminSubAdminsTab({
  state,
  onChangeOwnPin,
  onCreateSubAdmin,
  onUpdateSubAdmin,
  onDeleteSubAdmin
}: {
  state: ArenaState;
  onChangeOwnPin: (currentPin: string, newPin: string) => Promise<void>;
  onCreateSubAdmin: (payload: {
    username: string;
    displayName: string;
    pin: string;
    canManageTournament: boolean;
    canManagePlayers: boolean;
    canRunDraw: boolean;
    canEditScores: boolean;
    canCrownChampion: boolean;
  }) => Promise<void>;
  onUpdateSubAdmin: (
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
  ) => Promise<void>;
  onDeleteSubAdmin: (id: number) => Promise<void>;
}) {
  const subAdmins = state.adminAccounts.filter((a) => a.role === 'SUB_ADMIN');
  const [showChangePin, setShowChangePin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [deleting, setDeleting] = useState<AdminAccount | null>(null);

  return (
    <div className="stack-col">
      <div className="arena-card arena-card-gold" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>حماية المشرف الرئيسي والتشفير</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            التحقق محمي بتشفير PBKDF2-SHA256 وقفل تلقائي بعد 5 محاولات خاطئة.
          </div>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => setShowChangePin(true)}>
          تغيير PIN
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>
            الحسابات المساعدة ({subAdmins.length} / 5)
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            أنشئ وعدّل واحذف حتى 5 حسابات مساعدة مع صلاحيات مخصصة لكل حساب.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={subAdmins.length >= 5}
          onClick={() => setShowCreate(true)}
        >
          <UserPlus size={17} />
          <span>إضافة</span>
        </button>
      </div>

      <div style={{ height: 6, borderRadius: 999, background: 'var(--elevated-navy)', overflow: 'hidden' }}>
        <div style={{ width: `${(subAdmins.length / 5) * 100}%`, height: '100%', background: 'var(--cyber-sky)' }} />
      </div>

      {Array.from({ length: 5 }, (_, slotIdx) => {
        const acc = subAdmins[slotIdx];
        if (!acc) {
          return (
            <button
              key={`empty_${slotIdx}`}
              type="button"
              className="arena-card"
              onClick={() => setShowCreate(true)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                background: 'rgba(15,21,40,0.55)',
                textAlign: 'right'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>خانة مساعد #{slotIdx + 1} — شاغرة</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--cyber-sky)' }}>اضغط لإنشاء حساب مساعد وتحديد صلاحياته</div>
              </div>
              <Plus size={20} color="var(--cyber-sky)" />
            </button>
          );
        }

        const granted = ADMIN_PERMISSIONS_META.filter((m) => acc[m.field]);

        return (
          <div
            key={acc.id}
            className="arena-card stack-col"
            style={{
              gap: 10,
              borderColor: acc.isActive ? 'rgba(37,99,235,0.6)' : 'rgba(239,68,68,0.6)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: 'rgba(37,99,235,0.22)',
                      color: 'var(--cyber-sky)',
                      fontSize: '0.72rem',
                      fontWeight: 700
                    }}
                  >
                    حساب #{slotIdx + 1}
                  </span>
                  <span style={{ fontWeight: 800 }}>
                    {acc.displayName} (@{acc.username})
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: acc.isActive ? 'var(--emerald-win)' : 'var(--crimson-loss)', marginTop: 3 }}>
                  {acc.isActive ? 'الحالة: نشط ومسموح بالدخول' : 'الحالة: موقوف مؤقتاً'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="icon-btn" onClick={() => setEditing(acc)} style={{ color: 'var(--championship-gold)' }}>
                  <Edit3 size={16} />
                </button>
                <button type="button" className="icon-btn" onClick={() => setDeleting(acc)} style={{ color: 'var(--crimson-loss)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="chip-row">
              {granted.length === 0 ? (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>بدون صلاحيات مفعلة</span>
              ) : (
                granted.map((g) => (
                  <span
                    key={g.key}
                    style={{
                      padding: '4px 9px',
                      borderRadius: 8,
                      background: 'var(--elevated-navy)',
                      border: '1px solid rgba(56,189,248,0.45)',
                      color: 'var(--cyber-sky)',
                      fontSize: '0.74rem',
                      fontWeight: 700
                    }}
                  >
                    {g.title}
                  </span>
                ))
              )}
            </div>
          </div>
        );
      })}

      {showChangePin && (
        <ChangePinModal
          onClose={() => setShowChangePin(false)}
          onConfirm={async (curr, next) => {
            await onChangeOwnPin(curr, next);
            setShowChangePin(false);
          }}
        />
      )}

      {showCreate && (
        <SubAdminFormModal
          initial={null}
          onClose={() => setShowCreate(false)}
          onSave={async (f) => {
            await onCreateSubAdmin({
              username: f.username,
              displayName: f.displayName,
              pin: f.pin,
              canManageTournament: f.canManageTournament,
              canManagePlayers: f.canManagePlayers,
              canRunDraw: f.canRunDraw,
              canEditScores: f.canEditScores,
              canCrownChampion: f.canCrownChampion
            });
            setShowCreate(false);
          }}
        />
      )}

      {editing && (
        <SubAdminFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (f) => {
            await onUpdateSubAdmin(editing.id, {
              displayName: f.displayName,
              newPin: f.pin || null,
              isActive: f.isActive,
              canManageTournament: f.canManageTournament,
              canManagePlayers: f.canManagePlayers,
              canRunDraw: f.canRunDraw,
              canEditScores: f.canEditScores,
              canCrownChampion: f.canCrownChampion
            });
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <div className="modal-backdrop" onClick={() => setDeleting(null)}>
          <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, color: 'var(--crimson-loss)' }}>تأكيد حذف الحساب المساعد</h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              هل تريد حذف حساب {deleting.displayName} (@{deleting.username}) نهائياً؟ سيتم إنهاء أي جلسة مفتوحة له.
            </p>
            <div className="grid-2">
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await onDeleteSubAdmin(deleting.id);
                  setDeleting(null);
                }}
              >
                حذف نهائي
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setDeleting(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangePinModal({
  onClose,
  onConfirm
}: {
  onClose: () => void;
  onConfirm: (currentPin: string, newPin: string) => Promise<void>;
}) {
  const [curr, setCurr] = useState('');
  const [nextPin, setNextPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const strength = evaluatePinStrengthClient(nextPin);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, color: 'var(--championship-gold)' }}>تغيير رمز PIN للمشرف الرئيسي</h3>
        <input className="input score-num" type="password" inputMode="numeric" maxLength={6} placeholder="رمز PIN الحالي (6 أرقام)" value={curr} onChange={(e) => setCurr(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        <input className="input score-num" type="password" inputMode="numeric" maxLength={6} placeholder="رمز PIN الجديد (6 أرقام)" value={nextPin} onChange={(e) => setNextPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        {nextPin && <div style={{ fontSize: '0.76rem', color: 'var(--cyber-sky)' }}>قوة الرمز: {strength.label}</div>}
        <input className="input score-num" type="password" inputMode="numeric" maxLength={6} placeholder="تأكيد رمز PIN الجديد" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        <div className="grid-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!/^\d{6}$/.test(curr) || !/^\d{6}$/.test(nextPin) || nextPin !== confirm}
            onClick={() => onConfirm(curr, nextPin)}
          >
            تحديث الرمز
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

function SubAdminFormModal({
  initial,
  onClose,
  onSave
}: {
  initial: AdminAccount | null;
  onClose: () => void;
  onSave: (form: {
    username: string;
    displayName: string;
    pin: string;
    isActive: boolean;
    canManageTournament: boolean;
    canManagePlayers: boolean;
    canRunDraw: boolean;
    canEditScores: boolean;
    canCrownChampion: boolean;
  }) => Promise<void>;
}) {
  const [username, setUsername] = useState(initial?.username || '');
  const [displayName, setDisplayName] = useState(initial?.displayName || '');
  const [pin, setPin] = useState('');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [perms, setPerms] = useState({
    canManageTournament: initial?.canManageTournament ?? false,
    canManagePlayers: initial?.canManagePlayers ?? true,
    canRunDraw: initial?.canRunDraw ?? false,
    canEditScores: initial?.canEditScores ?? true,
    canCrownChampion: initial?.canCrownChampion ?? false
  });

  const pinOk = initial ? pin === '' || /^\d{6}$/.test(pin) : /^\d{6}$/.test(pin);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, color: 'var(--championship-gold)' }}>
          {initial ? `تعديل حساب ${initial.displayName}` : 'إضافة مشرف مساعد'}
        </h3>
        {!initial && (
          <input className="input" placeholder="اسم المستخدم للدخول *" value={username} onChange={(e) => setUsername(e.target.value)} />
        )}
        <input className="input" placeholder="الاسم الظاهر *" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        {initial && (
          <div className="arena-subcard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>حساب نشط (مسموح بالدخول)</span>
            <button type="button" className={`switch-pill ${isActive ? 'on' : ''}`} onClick={() => setIsActive((v) => !v)}>
              <span className="switch-knob" />
            </button>
          </div>
        )}
        <input
          className="input score-num"
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder={initial ? 'رمز PIN جديد (اختياري - 6 أرقام)' : 'رمز PIN (6 أرقام) *'}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <div style={{ fontSize: '0.76rem', color: 'var(--cyber-sky)', fontWeight: 700 }}>قوالب صلاحيات جاهزة:</div>
        <div className="chip-row">
          {SUB_ADMIN_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="chip"
              onClick={() =>
                setPerms({
                  canManageTournament: preset.permissions.includes('MANAGE_TOURNAMENT'),
                  canManagePlayers: preset.permissions.includes('MANAGE_PLAYERS'),
                  canRunDraw: preset.permissions.includes('RUN_DRAW'),
                  canEditScores: preset.permissions.includes('EDIT_SCORES'),
                  canCrownChampion: preset.permissions.includes('CROWN_CHAMPION')
                })
              }
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.76rem', color: 'var(--championship-gold)', fontWeight: 700 }}>تحديد الصلاحيات بدقة:</div>
        {ADMIN_PERMISSIONS_META.map((item) => (
          <div key={item.key} className="arena-subcard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{item.title}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{item.desc}</div>
            </div>
            <button
              type="button"
              className={`switch-pill ${perms[item.field] ? 'on' : ''}`}
              onClick={() => setPerms((prev) => ({ ...prev, [item.field]: !prev[item.field] }))}
            >
              <span className="switch-knob" />
            </button>
          </div>
        ))}

        <div className="grid-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={(!initial && username.trim().length < 3) || !displayName.trim() || !pinOk}
            onClick={() =>
              onSave({
                username,
                displayName,
                pin,
                isActive,
                ...perms
              })
            }
          >
            حفظ
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminChampionTab({
  state,
  onCrownChampion,
  onOpenExportShare
}: {
  state: ArenaState;
  onCrownChampion: (playerId: number | null) => Promise<void>;
  onOpenExportShare: () => void;
}) {
  const isRacing = isRacingFormat(state.tournament?.format);
  const completedRaces = (state.races || []).filter((r) => r.isCompleted).length;
  const totalRaces = (state.races || []).length;
  const { completedMatches, totalMatches } = state.overviewStats;
  const completedCount = isRacing ? completedRaces : completedMatches;
  const totalCount = isRacing ? totalRaces : totalMatches;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const finalMatch = state.knockoutMatches.find((m) => m.stage === 'FINAL');
  const finalRace = (state.races || []).find((r) => r.stage === 'FINAL' && r.isCompleted);
  const finalRaceTopPlayerId = finalRace?.results?.find((r) => !r.dnf && r.position === 1)?.playerId ?? null;
  const finalWinner = isRacing
    ? finalRaceTopPlayerId
      ? state.approvedPlayers.find((p) => p.id === finalRaceTopPlayerId) || null
      : (state.racingStandings?.[0]?.player ?? null)
    : finalMatch?.winnerId
      ? state.approvedPlayers.find((p) => p.id === finalMatch.winnerId) || null
      : null;

  return (
    <div className="stack-col">
      <div className="arena-card stack-col" style={{ gap: 8 }}>
        <div style={{ fontWeight: 800, color: 'var(--cyber-sky)' }}>متابعة تقدم البطولة</div>
        <div style={{ fontSize: '0.88rem' }}>
          {isRacing ? `السباقات المكتملة: ${completedCount} من ${totalCount}` : `المباريات المكتملة: ${completedCount} من ${totalCount}`}
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--elevated-navy)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--championship-gold)' }} />
        </div>
      </div>

      <div className="arena-card arena-card-gold stack-col" style={{ gap: 10 }}>
        <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>اختيار بطل البطولة وإعلان النتائج النهائية</div>
        {finalWinner && (
          <button type="button" className="btn btn-gold" onClick={() => onCrownChampion(finalWinner.id)}>
            <Trophy size={18} />
            <span>{isRacing ? `تتويج المتصدر: ${finalWinner.name}` : `تتويج الفائز بالنهائي: ${finalWinner.name}`}</span>
          </button>
        )}

        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 700 }}>أو اختر البطل يدوياً:</div>
        <div className="chip-row">
          {state.approvedPlayers.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip ${state.championPlayer?.id === p.id ? 'selected-gold' : ''}`}
              onClick={() => onCrownChampion(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>

        {state.championPlayer && (
          <button type="button" className="btn btn-danger-outline" onClick={() => onCrownChampion(null)}>
            إلغاء اعتماد البطل الحالي
          </button>
        )}
      </div>

      <button type="button" className="btn btn-primary" onClick={onOpenExportShare}>
        فتح نافذة التصدير والمشاركة
      </button>
    </div>
  );
}

export function AdminAuditLogTab({ state }: { state: ArenaState }) {
  const logs = state.auditLogs || [];
  return (
    <div className="arena-card stack-col" style={{ gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--championship-gold)', fontWeight: 800 }}>
        <History size={18} />
        <span>سجل نشاط المشرفين ({logs.length})</span>
      </div>
      {logs.length === 0 ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          لا توجد عمليات إدارية مسجلة حتى الآن.
        </div>
      ) : (
        <div className="stack-col" style={{ gap: 8 }}>
          {logs.map((entry) => (
            <div key={entry.id} className="arena-subcard stack-col" style={{ gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--cyber-sky)' }}>
                  {entry.actorDisplayName} (@{entry.actorUsername})
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {new Date(entry.createdAt).toLocaleString('ar-EG')}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{entry.summaryAr}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
