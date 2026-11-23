import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Dices, GitBranch, ImagePlus, PlusCircle, Save, Trash2 } from 'lucide-react';
import { uploadImageFileApi } from '../api';
import {
  DRAW_MODE_LABELS,
  FORMAT_LABELS,
  TIE_RULE_LABELS,
  getGroupDisplayName
} from '../types';
import type {
  ArenaState,
  DrawMode,
  KnockoutTieRule,
  Tournament,
  TournamentFormat
} from '../types';

export function AdminTournamentSettingsTab({
  state,
  onSaveSettings,
  onCreateFresh,
  onDeleteTournament
}: {
  state: ArenaState;
  onSaveSettings: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onCreateFresh: (payload: Record<string, unknown>) => Promise<void>;
  onDeleteTournament: (id: number) => Promise<void>;
}) {
  const t: Tournament | null = state.tournament;
  const defaultGame = state.gameCatalog[0];
  const [name, setName] = useState(t?.name ?? 'بطولة CP4 ARENA الجديدة');
  const [gameTitle, setGameTitle] = useState(t?.gameTitle ?? defaultGame?.label ?? 'FIFA 22');
  const [gameCategory, setGameCategory] = useState(t?.gameCategory ?? defaultGame?.categoryAr ?? 'كرة قدم');
  const [scoreUnitLabel, setScoreUnitLabel] = useState(t?.scoreUnitLabel ?? defaultGame?.scoreUnitLabel ?? 'هدف');
  const [description, setDescription] = useState(
    t?.description ?? 'البطولة الرسمية لمجتمع Discord لألعاب PS4 عبر شبكة ElysiumNet.'
  );
  const [bannerUrl, setBannerUrl] = useState<string | null>(t?.bannerUrl ?? null);
  const [startDateTime, setStartDateTime] = useState(t?.startDateTime ?? 'يُحدد لاحقاً');
  const [maxParticipants, setMaxParticipants] = useState(String(t?.maxParticipants ?? 16));
  const [format, setFormat] = useState<TournamentFormat>(t?.format ?? 'GROUPS_KNOCKOUT');
  const [groupCount, setGroupCount] = useState(String(t?.groupCount ?? 4));
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(String(t?.qualifiersPerGroup ?? 2));
  const [drawMode, setDrawMode] = useState<DrawMode>(t?.drawMode ?? 'RANDOM');
  const [tieRule, setTieRule] = useState<KnockoutTieRule>(t?.knockoutTieRule ?? 'SINGLE_MATCH_PENALTIES');
  const [matchDuration, setMatchDuration] = useState(String(t?.matchDurationMinutes ?? 12));
  const [targetGoalsRule, setTargetGoalsRule] = useState(
    t?.targetGoalsRule ?? defaultGame?.defaultRule ?? 'المباراة الكاملة'
  );
  const [manualClosed, setManualClosed] = useState(t?.isRegistrationClosedManual ?? false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
    if (!t) {
      setName('بطولة CP4 ARENA الجديدة');
      setGameTitle(defaultGame?.label ?? 'FIFA 22');
      setGameCategory(defaultGame?.categoryAr ?? 'كرة قدم');
      setScoreUnitLabel(defaultGame?.scoreUnitLabel ?? 'هدف');
      setDescription('البطولة الرسمية لمجتمع Discord لألعاب PS4 عبر شبكة ElysiumNet.');
      setBannerUrl(null);
      setStartDateTime('يُحدد لاحقاً');
      setMaxParticipants('16');
      setFormat('GROUPS_KNOCKOUT');
      setGroupCount('4');
      setQualifiersPerGroup('2');
      setDrawMode('RANDOM');
      setTieRule('SINGLE_MATCH_PENALTIES');
      setMatchDuration('12');
      setTargetGoalsRule(defaultGame?.defaultRule ?? 'المباراة الكاملة');
      setManualClosed(false);
      return;
    }
    setName(t.name);
    setGameTitle(t.gameTitle);
    setGameCategory(t.gameCategory);
    setScoreUnitLabel(t.scoreUnitLabel);
    setDescription(t.description);
    setBannerUrl(t.bannerUrl);
    setStartDateTime(t.startDateTime);
    setMaxParticipants(String(t.maxParticipants));
    setFormat(t.format);
    setGroupCount(String(t.groupCount));
    setQualifiersPerGroup(String(t.qualifiersPerGroup));
    setDrawMode(t.drawMode);
    setTieRule(t.knockoutTieRule);
    setMatchDuration(String(t.matchDurationMinutes));
    setTargetGoalsRule(t.targetGoalsRule);
    setManualClosed(t.isRegistrationClosedManual);
  }, [t?.id, t]);

  async function handleBannerFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageFileApi(file);
      setBannerUrl(url);
    } finally {
      setUploading(false);
    }
  }

  function buildPayload(asFresh = false) {
    const customName = name.trim() || `بطولة ${gameTitle || 'جديدة'} — CP4 ARENA`;
    return {
      name: asFresh && t ? `بطولة ${gameTitle || 'جديدة'} — CP4 ARENA` : customName,
      gameTitle: gameTitle.trim() || 'FIFA 22',
      gameCategory: gameCategory.trim() || 'ألعاب إلكترونية',
      scoreUnitLabel: scoreUnitLabel.trim() || 'نقطة',
      description,
      bannerUrl: asFresh && t ? null : bannerUrl,
      startDateTime: asFresh && t ? 'يُحدد لاحقاً' : startDateTime,
      maxParticipants: Number(maxParticipants) || 16,
      format,
      groupCount: Number(groupCount) || 4,
      qualifiersPerGroup: Number(qualifiersPerGroup) || 2,
      drawMode,
      knockoutTieRule: tieRule,
      matchDurationMinutes: Number(matchDuration) || 12,
      targetGoalsRule,
      isRegistrationClosedManual: asFresh ? false : manualClosed
    };
  }

  return (
    <div className="stack-col">
      {!t && (
        <div className="arena-card arena-card-gold stack-col" style={{ gap: 6 }}>
          <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>لا توجد بطولة نشطة حالياً</div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            اختر اللعبة واضبط القواعد أدناه ثم اضغط «إنشاء البطولة الجديدة».
          </div>
        </div>
      )}
      <div className="arena-card stack-col">
        <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>تفاصيل البطولة واختيار اللعبة</div>

        <div className="field-group">
          <label className="field-label">اختر اللعبة من القائمة أو خصصها (يدعم جميع الألعاب)</label>
          <div className="chip-row">
            {state.gameCatalog.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chip ${gameTitle === item.label ? 'selected-gold' : ''}`}
                onClick={() => {
                  setGameTitle(item.label);
                  setGameCategory(item.categoryAr);
                  setScoreUnitLabel(item.scoreUnitLabel);
                  setTargetGoalsRule(item.defaultRule);
                  setMatchDuration(String(item.defaultDuration));
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <div className="field-group">
            <label className="field-label">اسم اللعبة المخصصة *</label>
            <input className="input" value={gameTitle} onChange={(e) => setGameTitle(e.target.value)} placeholder="مثال: Tekken 8 أو GTA" />
          </div>
          <div className="field-group">
            <label className="field-label">وحدة التسجيل (هدف / جولة / نقطة)</label>
            <input className="input" value={scoreUnitLabel} onChange={(e) => setScoreUnitLabel(e.target.value)} />
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">اسم البطولة *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field-group">
          <label className="field-label">وصف البطولة والقوانين العامة</label>
          <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="field-group">
          <label className="field-label">موعد البداية</label>
          <input className="input" value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="btn btn-outline" style={{ flex: 1, cursor: 'pointer' }}>
            <ImagePlus size={17} />
            <span>{uploading ? 'جاري الرفع...' : bannerUrl ? 'تحديث صورة الغلاف' : 'تغيير صورة الغلاف'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => handleBannerFile(e.target.files?.[0] || null)}
            />
          </label>
          {bannerUrl && (
            <button type="button" className="btn btn-outline" onClick={() => setBannerUrl(null)}>
              الافتراضية
            </button>
          )}
        </div>
      </div>

      <div className="arena-card stack-col">
        <div style={{ fontWeight: 800, color: 'var(--cyber-sky)' }}>النظام والقواعد المخصصة</div>

        <div className="field-group">
          <label className="field-label">نظام البطولة</label>
          <div className="chip-row">
            {(['GROUPS_KNOCKOUT', 'LEAGUE_KNOCKOUT', 'DIRECT_KNOCKOUT'] as TournamentFormat[]).map((fmt) => (
              <button key={fmt} type="button" className={`chip ${format === fmt ? 'selected' : ''}`} onClick={() => setFormat(fmt)}>
                {FORMAT_LABELS[fmt]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <div className="field-group">
            <label className="field-label">الحد الأقصى للمشاركين</label>
            <input className="input" type="number" min={2} max={64} value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} />
          </div>
          {format === 'GROUPS_KNOCKOUT' && (
            <div className="field-group">
              <label className="field-label">عدد المجموعات</label>
              <input className="input" type="number" min={1} max={8} value={groupCount} onChange={(e) => setGroupCount(e.target.value)} />
            </div>
          )}
        </div>

        {format !== 'DIRECT_KNOCKOUT' && (
          <div className="field-group">
            <label className="field-label">
              {format === 'GROUPS_KNOCKOUT' ? 'المتأهلون من كل مجموعة' : 'عدد المتأهلين من الدوري للإقصائيات'}
            </label>
            <input className="input" type="number" min={1} max={16} value={qualifiersPerGroup} onChange={(e) => setQualifiersPerGroup(e.target.value)} />
          </div>
        )}

        <div className="field-group">
          <label className="field-label">نظام القرعة</label>
          <div className="chip-row">
            {(['RANDOM', 'MANUAL'] as DrawMode[]).map((dm) => (
              <button key={dm} type="button" className={`chip ${drawMode === dm ? 'selected-violet' : ''}`} onClick={() => setDrawMode(dm)}>
                {DRAW_MODE_LABELS[dm]}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">قواعد الأدوار الإقصائية</label>
          <div className="chip-row">
            {(['SINGLE_MATCH_PENALTIES', 'TWO_LEGS_FINAL_SINGLE'] as KnockoutTieRule[]).map((r) => (
              <button key={r} type="button" className={`chip ${tieRule === r ? 'selected' : ''}`} onClick={() => setTieRule(r)}>
                {TIE_RULE_LABELS[r].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <div className="field-group">
            <label className="field-label">مدة المواجهة (دقيقة)</label>
            <input className="input" type="number" min={3} max={60} value={matchDuration} onChange={(e) => setMatchDuration(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">قاعدة اللعب / النقاط</label>
            <input className="input" value={targetGoalsRule} onChange={(e) => setTargetGoalsRule(e.target.value)} />
          </div>
        </div>

        <div className="arena-subcard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>إغلاق التسجيل يدوياً</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>يُغلق تلقائياً أيضاً عند اكتمال العدد</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={manualClosed}
            className={`switch-pill ${manualClosed ? 'on' : ''}`}
            onClick={() => setManualClosed((v) => !v)}
          >
            <span className="switch-knob" />
          </button>
        </div>

        {t ? (
          <button type="button" className="btn btn-primary" onClick={() => onSaveSettings(t.id, buildPayload(false))}>
            <Save size={18} />
            <span>حفظ إعدادات البطولة</span>
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => onCreateFresh(buildPayload(true))}>
            <PlusCircle size={18} />
            <span>إنشاء البطولة الجديدة</span>
          </button>
        )}
      </div>

      {t && (
        <div className="grid-2">
          <button type="button" className="btn btn-outline" onClick={() => onCreateFresh(buildPayload(true))}>
            <PlusCircle size={17} />
            <span>إنشاء بطولة جديدة إضافية</span>
          </button>
          <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={17} />
            <span>حذف البطولة الحالية</span>
          </button>
        </div>
      )}

      {confirmDelete && t && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(false)}>
          <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, color: 'var(--crimson-loss)' }}>تأكيد حذف البطولة</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              سيتم حذف جميع اللاعبين والمجموعات والمباريات لهذه البطولة نهائياً.
            </p>
            <div className="grid-2">
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  setConfirmDelete(false);
                  await onDeleteTournament(t.id);
                }}
              >
                حذف نهائي
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setConfirmDelete(false)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminDrawTab({
  state,
  onRunDraw,
  onGenerateKnockout
}: {
  state: ArenaState;
  onRunDraw: (manualGroups: Record<number, number>, manualOrder: number[]) => Promise<void>;
  onGenerateKnockout: () => Promise<void>;
}) {
  const t = state.tournament;
  const approved = state.approvedPlayers;
  const [groupAssignments, setGroupAssignments] = useState<Record<number, number>>({});
  const [manualOrder, setManualOrder] = useState<number[]>([]);

  useEffect(() => {
    if (!t) return;
    const initGroups: Record<number, number> = {};
    approved.forEach((p, idx) => {
      initGroups[p.id] = idx % Math.max(1, t.groupCount);
    });
    setGroupAssignments(initGroups);
    setManualOrder(approved.map((p) => p.id));
  }, [approved, t]);

  if (!t) return null;

  const playersById = new Map(approved.map((p) => [p.id, p]));
  const gCount = Math.max(1, Math.min(t.groupCount, Math.max(1, approved.length)));

  function swapOrder(i: number, j: number) {
    setManualOrder((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <div className="stack-col">
      <div className="arena-card stack-col">
        <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>
          استوديو القرعة ({DRAW_MODE_LABELS[t.drawMode]})
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          اللاعبون المعتمدون الجاهزون للقرعة: {approved.length} • النظام: {FORMAT_LABELS[t.format]}
        </div>

        {t.drawMode === 'MANUAL' && approved.length > 0 && (
          <div className="stack-col" style={{ gap: 10 }}>
            {t.format === 'GROUPS_KNOCKOUT' ? (
              <>
                <div style={{ fontSize: '0.84rem', color: 'var(--cyber-sky)', fontWeight: 700 }}>
                  وزّع اللاعبين يدوياً على المجموعات:
                </div>
                {approved.map((p) => {
                  const currentG = groupAssignments[p.id] ?? 0;
                  return (
                    <div key={p.id} className="arena-subcard stack-col" style={{ gap: 6 }}>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div className="chip-row">
                        {Array.from({ length: gCount }, (_, gIdx) => (
                          <button
                            key={gIdx}
                            type="button"
                            className={`chip ${currentG === gIdx ? 'selected' : ''}`}
                            onClick={() => setGroupAssignments((prev) => ({ ...prev, [p.id]: gIdx }))}
                          >
                            {getGroupDisplayName(gIdx)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                <div style={{ fontSize: '0.84rem', color: 'var(--cyber-sky)', fontWeight: 700 }}>
                  رتّب اللاعبين يدوياً للمواجهات:
                </div>
                {manualOrder.map((pId, idx) => {
                  const p = playersById.get(pId);
                  if (!p) return null;
                  return (
                    <div
                      key={pId}
                      className="arena-subcard"
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <span style={{ fontWeight: 700 }}>
                        {idx + 1}. {p.name}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="icon-btn" disabled={idx === 0} onClick={() => swapOrder(idx, idx - 1)}>
                          <ArrowUp size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={idx === manualOrder.length - 1}
                          onClick={() => swapOrder(idx, idx + 1)}
                        >
                          <ArrowDown size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          disabled={approved.length < 2}
          onClick={() => onRunDraw(groupAssignments, manualOrder)}
        >
          <Dices size={18} />
          <span>
            {t.drawMode === 'RANDOM'
              ? 'إجراء القرعة العشوائية وتوليد المباريات'
              : 'اعتماد القرعة اليدوية وتوليد المباريات'}
          </span>
        </button>
      </div>

      {t.format !== 'DIRECT_KNOCKOUT' && (state.groupsWithStandings.length > 0 || state.leagueStandings.length > 0) && (
        <div className="arena-card arena-card-gold stack-col">
          <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>الانتقال للأدوار الإقصائية</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            يأخذ النظام المتأهلين تلقائياً حسب الترتيب الحالي ويبني مخطط دور الـ 16 أو ربع النهائي أو نصف النهائي مع ربط كل مواجهة بالتالية.
          </div>
          <button type="button" className="btn btn-violet" onClick={onGenerateKnockout}>
            <GitBranch size={18} />
            <span>تأهيل المتصدرين وبناء المخطط الإقصائي</span>
          </button>
        </div>
      )}
    </div>
  );
}
