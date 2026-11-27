import { useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  Check,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  GitMerge,
  History,
  IdCard,
  ImagePlus,
  Link2,
  Plus,
  Shield,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import {
  fetchDiscordGuildMembersApi,
  fetchDiscordOAuthStartUrlApi,
  uploadImageFileApi
} from '../api';
import type { ApiError } from '../api';
import { MatchResultsTable } from '../components/MatchResultsTable';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { RacingOverviewPanel, isRacingFormat } from '../components/RacingSection';
import {
  ADMIN_PERMISSIONS_META,
  LEVEL_LABELS,
  SUB_ADMIN_PRESETS,
  evaluatePinStrengthClient
} from '../types';
import type {
  AdminAccount,
  ArenaState,
  DiscordGuildMember,
  Match,
  Player,
  PlayerLevel,
  PlayerProfile,
  PlayerStatus,
  RaceEntry,
  RaceStage
} from '../types';

export function AdminPlayersTab({
  state,
  onAdminAddPlayer,
  onBulkImport,
  onStatusChange,
  onUpdateDetails,
  onDeletePlayer,
  onCreatePlayerProfile,
  onUpdatePlayerProfile,
  onMergePlayerProfiles,
  onLinkPlayerDiscord,
  onNotify
}: {
  state: ArenaState;
  onAdminAddPlayer: (payload: {
    profileId?: number | null;
    name: string;
    elysiumNetId: string;
    xeMoNetId?: string;
    discordUserId?: string | null;
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
  onCreatePlayerProfile: (payload: {
    name: string;
    avatarUrl?: string | null;
    elysiumNetId?: string;
    xeMoNetId?: string;
    discordUserId?: string | null;
  }) => Promise<PlayerProfile>;
  onUpdatePlayerProfile: (
    id: number,
    payload: {
      name?: string;
      avatarUrl?: string | null;
      elysiumNetId?: string;
      xeMoNetId?: string;
      discordUserId?: string | null;
    }
  ) => Promise<PlayerProfile>;
  onMergePlayerProfiles: (payload: {
    sourceProfileId: number;
    targetProfileId: number;
    confirmIdentity: boolean;
  }) => Promise<PlayerProfile>;
  onLinkPlayerDiscord: (
    playerId: number,
    payload: {
      targetProfileId?: number | null;
      discordUserId?: string | null;
      discordName?: string | null;
      discordAvatarUrl?: string | null;
      syncIdentity?: boolean;
      confirmMerge?: boolean;
      unlink?: boolean;
    }
  ) => Promise<void>;
  onNotify: (msg: string) => void;
}) {
  const [editing, setEditing] = useState<Player | null>(null);
  const [linkingDiscordPlayer, setLinkingDiscordPlayer] = useState<Player | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [prefillProfile, setPrefillProfile] = useState<PlayerProfile | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<PlayerProfile | null>(null);
  const [showMergeProfilesModal, setShowMergeProfilesModal] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);

  const profiles = state.playerProfiles ?? [];
  const discordStatus = state.discordStatus;
  const unlinkedParticipantsCount = state.players.filter((p) => !p.discordUserId).length;

  async function handleStartDiscordOAuth() {
    setOauthBusy(true);
    try {
      const res = await fetchDiscordOAuthStartUrlApi('/');
      const preferSameTab =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(pointer: coarse)').matches ||
        window.innerWidth < 900;
      if (preferSameTab) {
        window.location.href = res.url;
        return;
      }
      const popup = window.open(res.url, 'cp4_discord_oauth', 'width=520,height=740');
      if (!popup) {
        window.location.href = res.url;
      }
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'تعذر بدء الربط عبر Discord OAuth.');
    } finally {
      setOauthBusy(false);
    }
  }

  return (
    <div className="stack-col">
      {/* Stage 1: Unified Player Profiles Section */}
      <div className="arena-card stack-col" style={{ gap: 12, borderColor: 'rgba(56, 189, 248, 0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, color: 'var(--championship-gold)' }}>
              <IdCard size={18} />
              <span>ملفات اللاعبين الموحدة ({profiles.length})</span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              ملف موحد برقم CP4 ثابت مع منع التكرار عبر Discord User ID
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: '7px 10px', fontSize: '0.78rem' }}
              disabled={oauthBusy}
              onClick={handleStartDiscordOAuth}
              data-testid="discord_oauth_start_btn"
            >
              <Link2 size={15} />
              <span>{oauthBusy ? 'جاري التحويل...' : 'ربط تلقائي (Discord OAuth)'}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '7px 11px', fontSize: '0.78rem' }}
              onClick={() => setShowCreateProfileModal(true)}
              data-testid="create_player_profile_btn"
            >
              <UserPlus size={15} />
              <span>إنشاء / ربط ملف</span>
            </button>
            {profiles.length >= 2 && (
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '7px 10px', fontSize: '0.78rem', color: 'var(--championship-gold)' }}
                onClick={() => setShowMergeProfilesModal(true)}
                data-testid="merge_profiles_btn"
              >
                <GitMerge size={15} />
                <span>دمج ملفين</span>
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.74rem' }}>
          <span
            className="arena-subcard"
            style={{
              padding: '4px 8px',
              color: discordStatus?.oauthConfigured ? 'var(--emerald-win)' : 'var(--text-secondary)'
            }}
          >
            Discord OAuth: {discordStatus?.oauthConfigured ? 'مفعّل' : 'يتطلب إعداد متغيرات الخادم'}
          </span>
          <span
            className="arena-subcard"
            style={{
              padding: '4px 8px',
              color: discordStatus?.botConfigured && discordStatus?.guildIdConfigured ? 'var(--cyber-sky)' : 'var(--text-secondary)'
            }}
          >
            قائمة أعضاء البوت: {discordStatus?.botConfigured && discordStatus?.guildIdConfigured ? 'مفعّلة' : 'يتطلب توكن البوت ومعرّف السيرفر'}
          </span>
        </div>

        {profiles.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            لا توجد ملفات لاعبين موحدة بعد. أنشئ ملفاً يدوياً أو عبر قائمة البوت أو عبر Discord OAuth.
          </div>
        ) : (
          <div className="stack-col" style={{ gap: 8, maxHeight: 340, overflowY: 'auto' }}>
            {profiles.map((prof) => (
              <div
                key={prof.id}
                className="arena-subcard"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <PlayerAvatar avatarUrl={prof.avatarUrl} name={prof.name} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{prof.name}</span>
                      <span
                        className="score-num"
                        style={{
                          fontSize: '0.7rem',
                          padding: '1px 7px',
                          borderRadius: 999,
                          background: 'rgba(245, 184, 46, 0.16)',
                          border: '1px solid rgba(245, 184, 46, 0.45)',
                          color: 'var(--championship-gold)'
                        }}
                      >
                        {prof.cp4Id}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--cyber-sky)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {prof.elysiumNetId && <span>ElysiumNet: {prof.elysiumNetId}</span>}
                      {prof.xeMoNetId && <span>XeMoNet: {prof.xeMoNetId}</span>}
                      {prof.discordUserId && <span>Discord: {prof.discordUserId}</span>}
                      <span>• {prof.tournamentsCount ?? 0} بطولات</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {state.tournament && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: '5px 9px', fontSize: '0.74rem' }}
                      onClick={() => {
                        setPrefillProfile(prof);
                        setShowAddModal(true);
                      }}
                    >
                      <Plus size={14} />
                      <span>إضافة للبطولة</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '5px 9px', fontSize: '0.74rem', color: 'var(--championship-gold)' }}
                    onClick={() => setSelectedProfile(prof)}
                  >
                    <Edit3 size={14} />
                    <span>الملف</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
              onClick={() => {
                setPrefillProfile(null);
                setShowAddModal(true);
              }}
            >
              <UserPlus size={16} />
              <span>إضافة لاعب مباشرة</span>
            </button>
          </div>
        )}
      </div>

      {state.tournament && unlinkedParticipantsCount > 0 && (
        <div
          className="arena-subcard"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            borderColor: 'rgba(88, 101, 242, 0.5)',
            background: 'rgba(88, 101, 242, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
            <Link2 size={16} color="#818CF8" />
            <span>
              يوجد <strong>{unlinkedParticipantsCount}</strong> مشارك مسجل يدوياً غير مربوط بحساب Discord موثق بعد — اضغط{' '}
              <strong>«ربط Discord»</strong> بجانب أي مشارك لربط حسابه مع الحفاظ على نتائجه.
            </span>
          </div>
        </div>
      )}

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
            onLinkDiscord={() => setLinkingDiscordPlayer(p)}
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
          onLinkDiscord={() => setLinkingDiscordPlayer(p)}
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
              onLinkDiscord={() => setLinkingDiscordPlayer(p)}
              onEdit={() => setEditing(p)}
              onDelete={() => onDeletePlayer(p.id)}
            />
          ))}
        </>
      )}

      {showAddModal && (
        <AdminAddPlayerModal
          initialProfile={prefillProfile}
          onClose={() => {
            setShowAddModal(false);
            setPrefillProfile(null);
          }}
          onAdd={async (payload) => {
            await onAdminAddPlayer(payload);
            setShowAddModal(false);
            setPrefillProfile(null);
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

      {showCreateProfileModal && (
        <CreatePlayerProfileModal
          onClose={() => setShowCreateProfileModal(false)}
          onCreate={async (payload) => {
            await onCreatePlayerProfile(payload);
            setShowCreateProfileModal(false);
          }}
          onOpenExisting={(existing) => {
            setShowCreateProfileModal(false);
            setSelectedProfile(existing);
          }}
        />
      )}

      {selectedProfile && (
        <ProfileDetailEditModal
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          onSave={async (payload) => {
            await onUpdatePlayerProfile(selectedProfile.id, payload);
            setSelectedProfile(null);
          }}
          onOpenExisting={(existing) => setSelectedProfile(existing)}
        />
      )}

      {showMergeProfilesModal && (
        <MergeProfilesModal
          profiles={profiles}
          onClose={() => setShowMergeProfilesModal(false)}
          onMerge={async (payload) => {
            await onMergePlayerProfiles(payload);
            setShowMergeProfilesModal(false);
          }}
        />
      )}

      {linkingDiscordPlayer && (
        <LinkPlayerDiscordModal
          player={linkingDiscordPlayer}
          profiles={profiles}
          onClose={() => setLinkingDiscordPlayer(null)}
          onLink={async (payload) => {
            await onLinkPlayerDiscord(linkingDiscordPlayer.id, payload);
            setLinkingDiscordPlayer(null);
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
  onLinkDiscord,
  onEdit,
  onDelete
}: {
  player: Player;
  onApprove?: () => void;
  onReject?: () => void;
  onLinkDiscord: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isDiscordLinked = Boolean(player.discordUserId);
  return (
    <div className="arena-card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 200px' }}>
        <PlayerAvatar avatarUrl={player.avatarUrl} name={player.name} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
            {player.cp4Id && (
              <span
                className="score-num"
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--championship-gold)',
                  border: '1px solid rgba(245, 184, 46, 0.4)',
                  borderRadius: 6,
                  padding: '1px 5px'
                }}
              >
                {player.cp4Id}
              </span>
            )}
            <span
              style={{
                fontSize: '0.68rem',
                padding: '1px 7px',
                borderRadius: 999,
                fontWeight: 700,
                background: isDiscordLinked ? 'rgba(16, 185, 129, 0.16)' : 'rgba(245, 158, 11, 0.16)',
                color: isDiscordLinked ? 'var(--emerald-win)' : 'var(--amber-draw)'
              }}
            >
              {isDiscordLinked ? 'موثق Discord' : 'يدوي — غير مربوط'}
            </span>
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--cyber-sky)' }}>
            {player.elysiumNetId}
            {player.xeMoNetId ? ` • ${player.xeMoNetId}` : ''} • {LEVEL_LABELS[player.level].label} ({player.ovrRating})
            {player.discordUserId ? ` • Discord: ${player.discordUserId}` : ''}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-outline"
          onClick={onLinkDiscord}
          data-testid={`link_discord_player_${player.id}`}
          title={isDiscordLinked ? 'إدارة ربط Discord' : 'ربط حساب المشارك بحساب Discord موثق'}
          style={{
            padding: '5px 9px',
            fontSize: '0.74rem',
            minHeight: 36,
            borderColor: isDiscordLinked ? 'rgba(16, 185, 129, 0.45)' : '#5865F2',
            color: isDiscordLinked ? 'var(--emerald-win)' : '#C7D2FE'
          }}
        >
          <Link2 size={14} />
          <span>{isDiscordLinked ? 'حساب Discord' : 'ربط Discord'}</span>
        </button>
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
  initialProfile,
  onClose,
  onAdd
}: {
  initialProfile?: PlayerProfile | null;
  onClose: () => void;
  onAdd: (payload: {
    profileId?: number | null;
    name: string;
    elysiumNetId: string;
    xeMoNetId?: string;
    discordUserId?: string | null;
    avatarUrl: string | null;
    level: PlayerLevel;
    ovrRating: number;
    clubName: string;
    status: PlayerStatus;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initialProfile?.name || '');
  const [elysiumId, setElysiumId] = useState(initialProfile?.elysiumNetId || '');
  const [xeMoNetId, setXeMoNetId] = useState(initialProfile?.xeMoNetId || '');
  const [clubName, setClubName] = useState('');
  const [level, setLevel] = useState<PlayerLevel>('INTERMEDIATE');
  const [ovrRating, setOvrRating] = useState(String(LEVEL_LABELS.INTERMEDIATE.ovr));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialProfile?.avatarUrl ?? null);
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
        <h3 style={{ margin: 0, color: 'var(--championship-gold)' }}>
          {initialProfile ? `تسجيل ${initialProfile.name} (${initialProfile.cp4Id}) في البطولة` : 'إضافة لاعب مباشرة للبطولة'}
        </h3>

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
        <input className="input" value={elysiumId} onChange={(e) => setElysiumId(e.target.value)} placeholder="معرف اللاعب في ElysiumNet *" />
        <input className="input" value={xeMoNetId} onChange={(e) => setXeMoNetId(e.target.value)} placeholder="معرف XeMoNet (اختياري)" />
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
              setErr('');
              try {
                await onAdd({
                  profileId: initialProfile?.id ?? null,
                  name: name.trim(),
                  elysiumNetId: elysiumId.trim(),
                  xeMoNetId: xeMoNetId.trim(),
                  discordUserId: initialProfile?.discordUserId ?? null,
                  avatarUrl,
                  level,
                  ovrRating: Number(ovrRating) || LEVEL_LABELS[level].ovr,
                  clubName: clubName.trim(),
                  status: autoApprove ? 'APPROVED' : 'PENDING'
                });
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'تعذر إضافة اللاعب.');
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

function CreatePlayerProfileModal({
  onClose,
  onCreate,
  onOpenExisting
}: {
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    avatarUrl?: string | null;
    elysiumNetId?: string;
    xeMoNetId?: string;
    discordUserId?: string | null;
  }) => Promise<void>;
  onOpenExisting: (existing: PlayerProfile) => void;
}) {
  const [sourceMode, setSourceMode] = useState<'MANUAL' | 'BOT'>('MANUAL');
  const [name, setName] = useState('');
  const [discordUserId, setDiscordUserId] = useState('');
  const [elysiumNetId, setElysiumNetId] = useState('');
  const [xeMoNetId, setXeMoNetId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [members, setMembers] = useState<DiscordGuildMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [conflictProfile, setConflictProfile] = useState<PlayerProfile | null>(null);

  async function loadBotMembers() {
    setLoadingMembers(true);
    setMembersError('');
    try {
      const res = await fetchDiscordGuildMembersApi();
      setMembers(res.members || []);
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : 'تعذر جلب أعضاء Discord من البوت.');
    } finally {
      setLoadingMembers(false);
    }
  }

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
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--championship-gold)' }}>إنشاء أو ربط ملف لاعب موحد</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div className="chip-row">
          <button
            type="button"
            className={`chip ${sourceMode === 'MANUAL' ? 'selected' : ''}`}
            onClick={() => setSourceMode('MANUAL')}
          >
            <Edit3 size={14} />
            <span>إدخال يدوي</span>
          </button>
          <button
            type="button"
            className={`chip ${sourceMode === 'BOT' ? 'selected' : ''}`}
            onClick={() => {
              setSourceMode('BOT');
              if (members.length === 0 && !loadingMembers) {
                loadBotMembers();
              }
            }}
          >
            <Bot size={14} />
            <span>اختيار من أعضاء Discord (البوت)</span>
          </button>
        </div>

        {sourceMode === 'BOT' && (
          <div className="arena-subcard stack-col" style={{ gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--cyber-sky)' }}>
                أعضاء السيرفر عبر البوت
              </span>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '4px 9px', fontSize: '0.74rem' }}
                onClick={loadBotMembers}
                disabled={loadingMembers}
              >
                {loadingMembers ? 'جاري الجلب...' : 'تحديث القائمة'}
              </button>
            </div>
            {membersError && (
              <div style={{ fontSize: '0.78rem', color: 'var(--crimson-loss)', fontWeight: 700 }}>{membersError}</div>
            )}
            {!loadingMembers && !membersError && members.length === 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>لم يتم العثور على أعضاء.</div>
            )}
            <div className="stack-col" style={{ gap: 6, maxHeight: 210, overflowY: 'auto' }}>
              {members.map((m) => (
                <div
                  key={m.discordUserId}
                  className="arena-card"
                  style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <PlayerAvatar avatarUrl={m.avatarUrl} name={m.displayName} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.displayName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        @{m.username} • {m.discordUserId}
                      </div>
                    </div>
                  </div>
                  {m.linkedProfileId && m.linkedCp4Id ? (
                    <span className="score-num" style={{ fontSize: '0.72rem', color: 'var(--championship-gold)' }}>
                      مربوط ({m.linkedCp4Id})
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '5px 9px', fontSize: '0.74rem' }}
                      onClick={() => {
                        setName(m.displayName || m.username);
                        setDiscordUserId(m.discordUserId);
                        if (m.avatarUrl) setAvatarUrl(m.avatarUrl);
                        setConflictProfile(null);
                        setErr('');
                        setSourceMode('MANUAL');
                      }}
                    >
                      اختيار
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PlayerAvatar avatarUrl={avatarUrl} name={name || 'P'} size={52} />
          <label className="btn btn-outline" style={{ cursor: 'pointer', flex: 1 }}>
            <ImagePlus size={17} />
            <span>{uploading ? 'جاري الرفع...' : avatarUrl ? 'تغيير الصورة' : 'رفع صورة شخصية (اختياري)'}</span>
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
        <input
          className="input"
          value={discordUserId}
          onChange={(e) => {
            setDiscordUserId(e.target.value);
            setConflictProfile(null);
          }}
          placeholder="Discord User ID (اختياري أو 17-22 رقماً)"
          style={{ direction: 'ltr', textAlign: 'left' }}
        />
        <input className="input" value={elysiumNetId} onChange={(e) => setElysiumNetId(e.target.value)} placeholder="ElysiumNet ID (اختياري)" />
        <input className="input" value={xeMoNetId} onChange={(e) => setXeMoNetId(e.target.value)} placeholder="XeMoNet ID (اختياري)" />

        <div style={{ fontSize: '0.74rem', color: 'var(--cyber-sky)' }}>
          يتم إنشاء رقم CP4 ثابت تلقائياً (مثل CP4-000001) ولا يمكن تعديله لاحقاً.
        </div>

        {conflictProfile && (
          <div className="arena-subcard stack-col" style={{ gap: 8, borderColor: 'var(--championship-gold)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--championship-gold)', fontWeight: 800, fontSize: '0.84rem' }}>
              <AlertTriangle size={16} />
              <span>يوجد ملف لاعب مسجل مسبقاً لهذا Discord User ID ({conflictProfile.cp4Id})</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
              الاسم: {conflictProfile.name}
            </div>
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => onOpenExisting(conflictProfile)}
              data-testid="open_existing_profile_btn"
            >
              <ExternalLink size={15} />
              <span>فتح الملف الموجود</span>
            </button>
          </div>
        )}

        {err && !conflictProfile && (
          <div style={{ color: 'var(--crimson-loss)', fontSize: '0.82rem', fontWeight: 700 }}>{err}</div>
        )}

        <div className="grid-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || uploading || !name.trim()}
            onClick={async () => {
              setSaving(true);
              setErr('');
              setConflictProfile(null);
              try {
                await onCreate({
                  name: name.trim(),
                  avatarUrl,
                  elysiumNetId: elysiumNetId.trim(),
                  xeMoNetId: xeMoNetId.trim(),
                  discordUserId: discordUserId.trim() || null
                });
              } catch (e) {
                const apiErr = e as ApiError;
                if (apiErr.code === 'DUPLICATE_DISCORD_ID' && apiErr.existingProfile) {
                  setConflictProfile(apiErr.existingProfile);
                }
                setErr(apiErr.message || 'تعذر إنشاء ملف اللاعب.');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'جاري الحفظ...' : 'إنشاء الملف الموحد'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileDetailEditModal({
  profile,
  onClose,
  onSave,
  onOpenExisting
}: {
  profile: PlayerProfile;
  onClose: () => void;
  onSave: (payload: {
    name?: string;
    avatarUrl?: string | null;
    elysiumNetId?: string;
    xeMoNetId?: string;
    discordUserId?: string | null;
  }) => Promise<void>;
  onOpenExisting: (existing: PlayerProfile) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [elysiumNetId, setElysiumNetId] = useState(profile.elysiumNetId);
  const [xeMoNetId, setXeMoNetId] = useState(profile.xeMoNetId);
  const [discordUserId, setDiscordUserId] = useState(profile.discordUserId || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [conflictProfile, setConflictProfile] = useState<PlayerProfile | null>(null);

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
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--championship-gold)' }}>ملف اللاعب الموحد</h3>
            <div style={{ fontSize: '0.76rem', color: 'var(--cyber-sky)', marginTop: 2 }}>
              تاريخ الإنشاء: {new Date(profile.createdAt).toLocaleDateString('ar-EG')} • {profile.tournamentsCount ?? 0} بطولات
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div className="field-group">
          <label className="field-label">رقم لاعب CP4 الثابت (غير قابل للتعديل)</label>
          <input className="input score-num" value={profile.cp4Id} readOnly disabled />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PlayerAvatar avatarUrl={avatarUrl} name={name || profile.name} size={52} />
          <label className="btn btn-outline" style={{ cursor: 'pointer', flex: 1 }}>
            <ImagePlus size={17} />
            <span>{uploading ? 'جاري الرفع...' : avatarUrl ? 'تغيير الصورة' : 'رفع صورة'}</span>
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

        <div className="field-group">
          <label className="field-label">اسم اللاعب *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم اللاعب" />
        </div>
        <div className="field-group">
          <label className="field-label">ElysiumNet ID</label>
          <input className="input" value={elysiumNetId} onChange={(e) => setElysiumNetId(e.target.value)} placeholder="ElysiumNet ID" />
        </div>
        <div className="field-group">
          <label className="field-label">XeMoNet ID</label>
          <input className="input" value={xeMoNetId} onChange={(e) => setXeMoNetId(e.target.value)} placeholder="XeMoNet ID" />
        </div>
        <div className="field-group">
          <label className="field-label">Discord User ID</label>
          <input
            className="input"
            value={discordUserId}
            onChange={(e) => {
              setDiscordUserId(e.target.value);
              setConflictProfile(null);
            }}
            placeholder="Discord User ID"
            style={{ direction: 'ltr', textAlign: 'left' }}
          />
        </div>

        {conflictProfile && (
          <div className="arena-subcard stack-col" style={{ gap: 8, borderColor: 'var(--championship-gold)' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--championship-gold)' }}>
              هذا المعرف مرتبط بملف آخر ({conflictProfile.cp4Id}) — {conflictProfile.name}
            </div>
            <button type="button" className="btn btn-gold" onClick={() => onOpenExisting(conflictProfile)}>
              <ExternalLink size={15} />
              <span>فتح الملف الموجود</span>
            </button>
          </div>
        )}

        {err && !conflictProfile && (
          <div style={{ color: 'var(--crimson-loss)', fontSize: '0.82rem', fontWeight: 700 }}>{err}</div>
        )}

        <div className="grid-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || uploading || !name.trim()}
            onClick={async () => {
              setSaving(true);
              setErr('');
              setConflictProfile(null);
              try {
                await onSave({
                  name: name.trim(),
                  avatarUrl,
                  elysiumNetId: elysiumNetId.trim(),
                  xeMoNetId: xeMoNetId.trim(),
                  discordUserId: discordUserId.trim() || null
                });
              } catch (e) {
                const apiErr = e as ApiError;
                if (apiErr.code === 'DUPLICATE_DISCORD_ID' && apiErr.existingProfile) {
                  setConflictProfile(apiErr.existingProfile);
                }
                setErr(apiErr.message || 'تعذر حفظ تعديلات الملف.');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

function MergeProfilesModal({
  profiles,
  onClose,
  onMerge
}: {
  profiles: PlayerProfile[];
  onClose: () => void;
  onMerge: (payload: {
    sourceProfileId: number;
    targetProfileId: number;
    confirmIdentity: boolean;
  }) => Promise<void>;
}) {
  const [targetId, setTargetId] = useState<number>(profiles[0]?.id ?? 0);
  const [sourceId, setSourceId] = useState<number>(profiles[1]?.id ?? 0);
  const [confirmIdentity, setConfirmIdentity] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitMerge size={19} color="var(--championship-gold)" />
            <h3 style={{ margin: 0, color: 'var(--championship-gold)' }}>دمج ملفي لاعب يدوياً</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          لا يتم دمج أي ملفات تلقائياً بتشابه الأسماء. عند التأكيد، تُنقل جميع مشاركات البطولات والمواجهات من الملف الثانوي إلى الملف الأساسي مع الاحتفاظ برقم CP4 للملف الأساسي.
        </div>

        <div className="field-group">
          <label className="field-label">الملف الأساسي (يحتفظ برقمه الثابت CP4)</label>
          <select className="select" value={targetId} onChange={(e) => setTargetId(Number(e.target.value))}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.cp4Id} — {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field-group">
          <label className="field-label">الملف الثانوي (سيُدمج ويُزال)</label>
          <select className="select" value={sourceId} onChange={(e) => setSourceId(Number(e.target.value))}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.cp4Id} — {p.name}
              </option>
            ))}
          </select>
        </div>

        <label className="arena-subcard" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={confirmIdentity}
            onChange={(e) => setConfirmIdentity(e.target.checked)}
          />
          <span>أؤكد أن الملفين يعودان لنفس اللاعب بعد التحقق يدوياً</span>
        </label>

        {err && <div style={{ color: 'var(--crimson-loss)', fontSize: '0.82rem', fontWeight: 700 }}>{err}</div>}

        <div className="grid-2">
          <button
            type="button"
            className="btn btn-gold"
            disabled={saving || !confirmIdentity || !targetId || !sourceId || targetId === sourceId}
            onClick={async () => {
              setSaving(true);
              setErr('');
              try {
                await onMerge({ sourceProfileId: sourceId, targetProfileId: targetId, confirmIdentity: true });
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'تعذر دمج الملفين.');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'جاري الدمج...' : 'تأكيد الدمج اليدوي'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkPlayerDiscordModal({
  player,
  profiles,
  onClose,
  onLink
}: {
  player: Player;
  profiles: PlayerProfile[];
  onClose: () => void;
  onLink: (payload: {
    targetProfileId?: number | null;
    discordUserId?: string | null;
    discordName?: string | null;
    discordAvatarUrl?: string | null;
    syncIdentity?: boolean;
    confirmMerge?: boolean;
    unlink?: boolean;
  }) => Promise<void>;
}) {
  const verifiedDiscordProfiles = profiles.filter(
    (p) => Boolean(p.discordUserId) && p.id !== player.profileId
  );
  const [mode, setMode] = useState<'PROFILES' | 'BOT' | 'MANUAL'>(
    verifiedDiscordProfiles.length > 0 ? 'PROFILES' : 'MANUAL'
  );
  const [search, setSearch] = useState('');
  const [discordUserId, setDiscordUserId] = useState(player.discordUserId || '');
  const [syncIdentity, setSyncIdentity] = useState(true);
  const [members, setMembers] = useState<DiscordGuildMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [conflictProfile, setConflictProfile] = useState<PlayerProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function loadBotMembers() {
    setLoadingMembers(true);
    setMembersError('');
    try {
      const res = await fetchDiscordGuildMembersApi();
      setMembers(res.members || []);
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : 'تعذر جلب أعضاء Discord من البوت.');
    } finally {
      setLoadingMembers(false);
    }
  }

  async function submitLink(payload: {
    targetProfileId?: number | null;
    discordUserId?: string | null;
    discordName?: string | null;
    discordAvatarUrl?: string | null;
    confirmMerge?: boolean;
    unlink?: boolean;
  }) {
    setBusy(true);
    setErr('');
    setConflictProfile(null);
    try {
      await onLink({
        ...payload,
        syncIdentity
      });
    } catch (e) {
      const apiErr = e as ApiError;
      if (apiErr.code === 'DUPLICATE_DISCORD_ID' && apiErr.existingProfile) {
        setConflictProfile(apiErr.existingProfile);
      }
      setErr(apiErr.message || 'تعذر ربط حساب المشارك بـ Discord.');
    } finally {
      setBusy(false);
    }
  }

  const q = search.trim().toLowerCase();
  const filteredVerified = q
    ? verifiedDiscordProfiles.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.cp4Id.toLowerCase().includes(q) ||
          String(p.discordUserId || '').includes(q)
      )
    : verifiedDiscordProfiles;
  const filteredMembers = q
    ? members.filter(
        (m) =>
          m.displayName.toLowerCase().includes(q) ||
          m.username.toLowerCase().includes(q) ||
          m.discordUserId.includes(q)
      )
    : members;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--championship-gold)' }}>ربط المشارك بحساب Discord موثق</h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--cyber-sky)', marginTop: 2 }}>
              {player.name} • {player.elysiumNetId} {player.cp4Id ? `(${player.cp4Id})` : ''}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <label
          className="arena-subcard"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}
        >
          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
            تحديث اسم وصورة المشارك تلقائياً من حساب Discord الموثق
          </span>
          <button
            type="button"
            className={`switch-pill ${syncIdentity ? 'on' : ''}`}
            onClick={() => setSyncIdentity((v) => !v)}
          >
            <span className="switch-knob" />
          </button>
        </label>

        <div className="chip-row">
          <button
            type="button"
            className={`chip ${mode === 'PROFILES' ? 'selected' : ''}`}
            onClick={() => setMode('PROFILES')}
          >
            <Users size={14} />
            <span>حسابات Discord الموثقة ({verifiedDiscordProfiles.length})</span>
          </button>
          <button
            type="button"
            className={`chip ${mode === 'BOT' ? 'selected' : ''}`}
            onClick={() => {
              setMode('BOT');
              if (members.length === 0 && !loadingMembers) {
                loadBotMembers();
              }
            }}
          >
            <Bot size={14} />
            <span>أعضاء السيرفر (البوت)</span>
          </button>
          <button
            type="button"
            className={`chip ${mode === 'MANUAL' ? 'selected' : ''}`}
            onClick={() => setMode('MANUAL')}
          >
            <Edit3 size={14} />
            <span>إدخال Discord ID يدوياً</span>
          </button>
        </div>

        {mode === 'PROFILES' && (
          <div className="arena-subcard stack-col" style={{ gap: 8 }}>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو رقم CP4 أو Discord ID..."
            />
            {filteredVerified.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                لا توجد حسابات Discord موثقة أخرى جاهزة للربط حالياً. يمكنك استخدام قائمة البوت أو إدخال Discord User ID يدوياً.
              </div>
            ) : (
              <div className="stack-col" style={{ gap: 6, maxHeight: 230, overflowY: 'auto' }}>
                {filteredVerified.map((prof) => (
                  <div
                    key={prof.id}
                    className="arena-card"
                    style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <PlayerAvatar avatarUrl={prof.avatarUrl} name={prof.name} size={36} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prof.name}
                        </div>
                        <div className="score-num" style={{ fontSize: '0.72rem', color: 'var(--cyber-sky)' }}>
                          {prof.cp4Id} • {prof.discordUserId}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                      disabled={busy}
                      onClick={() => submitLink({ targetProfileId: prof.id, confirmMerge: true })}
                    >
                      ربط بهذا الحساب
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'BOT' && (
          <div className="arena-subcard stack-col" style={{ gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث في أعضاء السيرفر..."
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '6px 10px', fontSize: '0.74rem' }}
                onClick={loadBotMembers}
                disabled={loadingMembers}
              >
                {loadingMembers ? 'جاري الجلب...' : 'تحديث'}
              </button>
            </div>
            {membersError && (
              <div style={{ fontSize: '0.78rem', color: 'var(--crimson-loss)', fontWeight: 700 }}>{membersError}</div>
            )}
            {!loadingMembers && !membersError && filteredMembers.length === 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>لا يوجد أعضاء مطابقون.</div>
            )}
            <div className="stack-col" style={{ gap: 6, maxHeight: 230, overflowY: 'auto' }}>
              {filteredMembers.map((m) => (
                <div
                  key={m.discordUserId}
                  className="arena-card"
                  style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <PlayerAvatar avatarUrl={m.avatarUrl} name={m.displayName} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.displayName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        @{m.username} • {m.discordUserId}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '5px 10px', fontSize: '0.74rem' }}
                    disabled={busy}
                    onClick={() =>
                      submitLink(
                        m.linkedProfileId
                          ? { targetProfileId: m.linkedProfileId, confirmMerge: true }
                          : {
                              discordUserId: m.discordUserId,
                              discordName: m.displayName || m.username,
                              discordAvatarUrl: m.avatarUrl
                            }
                      )
                    }
                  >
                    {m.linkedCp4Id ? `ربط (${m.linkedCp4Id})` : 'ربط'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === 'MANUAL' && (
          <div className="arena-subcard stack-col" style={{ gap: 8 }}>
            <div className="field-group">
              <label className="field-label">معرف Discord User ID (17–22 رقماً)</label>
              <input
                className="input"
                value={discordUserId}
                onChange={(e) => {
                  setDiscordUserId(e.target.value);
                  setConflictProfile(null);
                  setErr('');
                }}
                placeholder="مثال: 109876543210987654"
                style={{ direction: 'ltr', textAlign: 'left' }}
                data-testid="link_discord_manual_id_input"
              />
            </div>

            {conflictProfile && (
              <div className="arena-card stack-col" style={{ gap: 8, borderColor: 'var(--championship-gold)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--championship-gold)', fontWeight: 800, fontSize: '0.82rem' }}>
                  <AlertTriangle size={15} />
                  <span>
                    هذا الحساب مسجل مسبقاً للملف {conflictProfile.cp4Id} ({conflictProfile.name})
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-gold"
                  disabled={busy}
                  onClick={() => submitLink({ targetProfileId: conflictProfile.id, confirmMerge: true })}
                  data-testid="confirm_merge_discord_link_btn"
                >
                  <GitMerge size={15} />
                  <span>تأكيد الربط والدمج في {conflictProfile.cp4Id}</span>
                </button>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !discordUserId.trim()}
              onClick={() => submitLink({ discordUserId: discordUserId.trim() })}
              data-testid="submit_manual_discord_link_btn"
            >
              {busy ? 'جاري الربط...' : 'حفظ وربط حساب Discord'}
            </button>
          </div>
        )}

        {err && !conflictProfile && (
          <div style={{ color: 'var(--crimson-loss)', fontSize: '0.82rem', fontWeight: 700 }}>{err}</div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {player.discordUserId && (
            <button
              type="button"
              className="btn btn-outline"
              style={{ color: 'var(--crimson-loss)', borderColor: 'rgba(239, 68, 68, 0.45)' }}
              disabled={busy}
              onClick={() => submitLink({ unlink: true })}
            >
              فك ربط Discord
            </button>
          )}
          <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>
            إغلاق
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
