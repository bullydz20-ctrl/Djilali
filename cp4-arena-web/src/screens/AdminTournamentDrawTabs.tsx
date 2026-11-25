import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Dices,
  Flag,
  GitBranch,
  ImagePlus,
  PlusCircle,
  Save,
  ShieldCheck,
  Trash2,
  Trophy
} from 'lucide-react';
import { uploadImageFileApi } from '../api';
import { isRacingFormat } from '../components/RacingSection';
import {
  DRAW_MODE_LABELS,
  FORMAT_LABELS,
  PLAY_MODE_LABELS,
  TIE_RULE_LABELS,
  getGroupDisplayName
} from '../types';
import type {
  ArenaState,
  DrawMode,
  GameCatalogItem,
  KnockoutTieRule,
  PlayMode,
  Tournament,
  TournamentFormat
} from '../types';

const DEFAULT_RACING_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

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
  const catalog = state.gameCatalog || [];
  const defaultGame = catalog[0];

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
  const [format, setFormat] = useState<TournamentFormat>(
    t?.format ?? defaultGame?.defaultFormat ?? 'GROUPS_KNOCKOUT'
  );
  const [playMode, setPlayMode] = useState<PlayMode>(t?.playMode ?? defaultGame?.defaultPlayMode ?? 'TEAMS');
  const [teamSize, setTeamSize] = useState(String(t?.teamSize ?? defaultGame?.defaultTeamSize ?? 2));
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(t?.bestOf ?? defaultGame?.defaultBestOf ?? 1);
  const [racingPointsText, setRacingPointsText] = useState(
    (t?.racingPointsConfig?.length ? t.racingPointsConfig : DEFAULT_RACING_POINTS).join(', ')
  );
  const [groupCount, setGroupCount] = useState(String(t?.groupCount ?? 4));
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(String(t?.qualifiersPerGroup ?? 2));
  const [drawMode, setDrawMode] = useState<DrawMode>(t?.drawMode ?? 'RANDOM');
  const [tieRule, setTieRule] = useState<KnockoutTieRule>(t?.knockoutTieRule ?? 'SINGLE_MATCH_PENALTIES');
  const [matchDuration, setMatchDuration] = useState(String(t?.matchDurationMinutes ?? 12));
  const [targetGoalsRule, setTargetGoalsRule] = useState(
    t?.targetGoalsRule ?? defaultGame?.defaultRule ?? 'المباراة الكاملة (6 دقائق لكل شوط)'
  );
  const [manualClosed, setManualClosed] = useState(t?.isRegistrationClosedManual ?? false);
  const [isThirdPlaceEnabled, setIsThirdPlaceEnabled] = useState(t?.isThirdPlaceEnabled ?? true);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedPreset: GameCatalogItem | null =
    catalog.find((g) => g.label.toLowerCase() === gameTitle.trim().toLowerCase() || g.id.toLowerCase() === gameTitle.trim().toLowerCase()) ??
    null;

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
      setFormat(defaultGame?.defaultFormat ?? 'GROUPS_KNOCKOUT');
      setPlayMode(defaultGame?.defaultPlayMode ?? 'TEAMS');
      setTeamSize(String(defaultGame?.defaultTeamSize ?? 2));
      setBestOf(defaultGame?.defaultBestOf ?? 1);
      setRacingPointsText(DEFAULT_RACING_POINTS.join(', '));
      setGroupCount('4');
      setQualifiersPerGroup('2');
      setDrawMode('RANDOM');
      setTieRule('SINGLE_MATCH_PENALTIES');
      setMatchDuration(String(defaultGame?.defaultDuration ?? 12));
      setTargetGoalsRule(defaultGame?.defaultRule ?? 'المباراة الكاملة');
      setManualClosed(false);
      setIsThirdPlaceEnabled(true);
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
    setPlayMode(t.playMode ?? 'SOLO_1V1');
    setTeamSize(String(t.teamSize ?? 1));
    setBestOf(t.bestOf ?? 1);
    setRacingPointsText((t.racingPointsConfig?.length ? t.racingPointsConfig : DEFAULT_RACING_POINTS).join(', '));
    setGroupCount(String(t.groupCount));
    setQualifiersPerGroup(String(t.qualifiersPerGroup));
    setDrawMode(t.drawMode);
    setTieRule(t.knockoutTieRule);
    setMatchDuration(String(t.matchDurationMinutes));
    setTargetGoalsRule(t.targetGoalsRule);
    setManualClosed(t.isRegistrationClosedManual);
    setIsThirdPlaceEnabled(t.isThirdPlaceEnabled ?? true);
  }, [t?.id, t]);

  function applyGamePreset(item: GameCatalogItem) {
    setGameTitle(item.label);
    setGameCategory(item.categoryAr);
    setScoreUnitLabel(item.scoreUnitLabel);
    setTargetGoalsRule(item.defaultRule);
    setMatchDuration(String(item.defaultDuration));
    if (!item.supportedFormats.includes(format)) {
      setFormat(item.defaultFormat);
    }
    if (!item.supportedPlayModes.includes(playMode)) {
      setPlayMode(item.defaultPlayMode);
    }
    if (item.categoryType === 'RACING') {
      setPlayMode('RACE_POINTS');
      setTeamSize('1');
      setBestOf(1);
    } else if (item.categoryType === 'FIGHTING') {
      setPlayMode('SOLO_1V1');
      setTeamSize('1');
      setBestOf(item.defaultBestOf);
    } else {
      setTeamSize(String(item.defaultTeamSize));
      setBestOf(item.supportsBestOf ? item.defaultBestOf : 1);
    }
  }

  function parsedRacePoints(): number[] {
    const nums = racingPointsText
      .split(/[,،\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0)
      .map((n) => Math.floor(n))
      .slice(0, 32);
    return nums.length > 0 ? nums : [...DEFAULT_RACING_POINTS];
  }

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
    const isTeams = playMode === 'TEAMS';
    return {
      name: asFresh && t ? `بطولة ${gameTitle || 'جديدة'} — CP4 ARENA` : customName,
      gameTitle: gameTitle.trim() || defaultGame?.label || 'FIFA 22',
      gameCategory: gameCategory.trim() || selectedPreset?.categoryAr || 'ألعاب إلكترونية',
      scoreUnitLabel: scoreUnitLabel.trim() || selectedPreset?.scoreUnitLabel || 'نقطة',
      description,
      bannerUrl: asFresh && t ? null : bannerUrl,
      startDateTime: asFresh && t ? 'يُحدد لاحقاً' : startDateTime,
      maxParticipants: Number(maxParticipants) || 16,
      format,
      playMode,
      teamSize: isTeams ? Math.max(2, Math.min(11, Number(teamSize) || 2)) : 1,
      bestOf: selectedPreset?.supportsBestOf || !selectedPreset ? bestOf : 1,
      racingPointsConfig: parsedRacePoints(),
      groupCount: Number(groupCount) || 4,
      qualifiersPerGroup: Number(qualifiersPerGroup) || 2,
      drawMode,
      knockoutTieRule: tieRule,
      matchDurationMinutes: Number(matchDuration) || 12,
      targetGoalsRule,
      isRegistrationClosedManual: asFresh ? false : manualClosed,
      isThirdPlaceEnabled
    };
  }

  const supportedFormats: TournamentFormat[] =
    selectedPreset?.supportedFormats ?? [
      'GROUPS_KNOCKOUT',
      'LEAGUE_KNOCKOUT',
      'DIRECT_KNOCKOUT',
      'RACE_POINTS',
      'RACE_QUALIFIERS_FINAL'
    ];
  const supportedPlayModes: PlayMode[] =
    selectedPreset?.supportedPlayModes ?? ['SOLO_1V1', 'TEAMS', 'RACE_POINTS'];
  const isRacing = isRacingFormat(format) || selectedPreset?.categoryType === 'RACING';
  const showTeamSize =
    (selectedPreset ? selectedPreset.supportsTeamSize : true) && playMode === 'TEAMS';
  const showBestOf = selectedPreset ? selectedPreset.supportsBestOf : !isRacing;

  return (
    <div className="stack-col">
      {!t && (
        <div className="arena-card arena-card-gold stack-col" style={{ gap: 6 }}>
          <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>لا توجد بطولة نشطة حالياً</div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            اختر اللعبة المعتمدة واضبط القواعد أدناه ثم اضغط «إنشاء البطولة الجديدة».
          </div>
        </div>
      )}

      <div className="arena-card stack-col">
        <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>اختيار اللعبة المعتمدة وتفاصيل البطولة</div>

        <div className="field-group">
          <label className="field-label">الألعاب المعتمدة ({catalog.length})</label>
          <div className="chip-row">
            {catalog.map((item) => {
              const isSelected =
                gameTitle.trim().toLowerCase() === item.label.toLowerCase() ||
                gameTitle.trim().toLowerCase() === item.id.toLowerCase();
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`chip ${isSelected ? 'selected-gold' : ''}`}
                  onClick={() => applyGamePreset(item)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Compatibility Status Notice */}
        {selectedPreset ? (
          <div
            className="arena-subcard stack-col"
            style={{
              gap: 5,
              borderColor:
                selectedPreset.onlineStatus === 'LOCAL_OR_LAN_ONLY'
                  ? 'rgba(245, 184, 46, 0.7)'
                  : 'rgba(56, 189, 248, 0.55)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontWeight: 800,
                fontSize: '0.83rem',
                color:
                  selectedPreset.onlineStatus === 'LOCAL_OR_LAN_ONLY'
                    ? 'var(--championship-gold)'
                    : 'var(--cyber-sky)'
              }}
            >
              {selectedPreset.onlineStatus === 'LOCAL_OR_LAN_ONLY' ? (
                <AlertTriangle size={16} />
              ) : (
                <ShieldCheck size={16} />
              )}
              <span>{selectedPreset.onlineStatusLabelAr}</span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {selectedPreset.compatibilityNoteAr}
            </div>
          </div>
        ) : (
          <div className="arena-subcard" style={{ borderColor: 'rgba(245,184,46,0.55)', fontSize: '0.78rem', color: 'var(--championship-gold)' }}>
            بطولة سابقة محفوظة للعبة: <strong>{gameTitle}</strong> — يتم الحفاظ على جميع بياناتها ونتائجها بالكامل.
          </div>
        )}

        <div className="field-group">
          <label className="field-label">اسم البطولة *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid-2">
          <div className="field-group">
            <label className="field-label">الفئة المعتمدة</label>
            <input className="input" value={gameCategory} onChange={(e) => setGameCategory(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">وحدة التسجيل (هدف / جولة / نقطة)</label>
            <input className="input" value={scoreUnitLabel} onChange={(e) => setScoreUnitLabel(e.target.value)} />
          </div>
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

      {/* Dynamic Rules Panel Adapted Per Selected Game */}
      <div className="arena-card stack-col">
        <div style={{ fontWeight: 800, color: 'var(--cyber-sky)' }}>
          النظام والإعدادات الخاصة بـ {selectedPreset?.label ?? gameTitle}
        </div>

        {/* Play Mode */}
        <div className="field-group">
          <label className="field-label">نمط اللعب المعتمد</label>
          <div className="chip-row">
            {supportedPlayModes.map((pm) => (
              <button
                key={pm}
                type="button"
                className={`chip ${playMode === pm ? 'selected-gold' : ''}`}
                onClick={() => setPlayMode(pm)}
              >
                {PLAY_MODE_LABELS[pm]}
              </button>
            ))}
          </div>
        </div>

        {showTeamSize && (
          <div className="field-group">
            <label className="field-label">عدد اللاعبين في كل فريق</label>
            <div className="chip-row" style={{ marginBottom: 6 }}>
              {[2, 3, 4, 5, 6, 11].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  className={`chip ${Number(teamSize) === sz ? 'selected' : ''}`}
                  onClick={() => setTeamSize(String(sz))}
                >
                  {sz} ضد {sz}
                </button>
              ))}
            </div>
            <input
              className="input"
              type="number"
              min={2}
              max={11}
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
            />
          </div>
        )}

        {/* Tournament Format */}
        <div className="field-group">
          <label className="field-label">نظام البطولة</label>
          <div className="chip-row">
            {supportedFormats.map((fmt) => (
              <button
                key={fmt}
                type="button"
                className={`chip ${format === fmt ? 'selected' : ''}`}
                onClick={() => setFormat(fmt)}
              >
                {FORMAT_LABELS[fmt]}
              </button>
            ))}
          </div>
        </div>

        {/* Best of selector for Fighting / Call of Duty */}
        {showBestOf && (
          <div className="field-group">
            <label className="field-label">عدد الجولات لحسم المواجهة (Best of)</label>
            <div className="chip-row">
              {([1, 3, 5] as const).map((bo) => (
                <button
                  key={bo}
                  type="button"
                  className={`chip ${bestOf === bo ? 'selected-gold' : ''}`}
                  onClick={() => {
                    setBestOf(bo);
                    setTargetGoalsRule(
                      bo === 1
                        ? 'مباراة من جولة واحدة (Best of 1)'
                        : `الفائز بأفضل من ${bo} جولات (Best of ${bo})`
                    );
                  }}
                >
                  Best of {bo}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid-2">
          <div className="field-group">
            <label className="field-label">الحد الأقصى للمشاركين</label>
            <input
              className="input"
              type="number"
              min={2}
              max={64}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
            />
          </div>
          {format === 'GROUPS_KNOCKOUT' && (
            <div className="field-group">
              <label className="field-label">عدد المجموعات</label>
              <input
                className="input"
                type="number"
                min={1}
                max={8}
                value={groupCount}
                onChange={(e) => setGroupCount(e.target.value)}
              />
            </div>
          )}
        </div>

        {(format === 'GROUPS_KNOCKOUT' || format === 'LEAGUE_KNOCKOUT' || format === 'RACE_QUALIFIERS_FINAL') && (
          <div className="field-group">
            <label className="field-label">
              {format === 'GROUPS_KNOCKOUT'
                ? 'المتأهلون من كل مجموعة'
                : format === 'RACE_QUALIFIERS_FINAL'
                  ? 'عدد المتأهلين للسباق النهائي'
                  : 'عدد المتأهلين من الدوري للإقصائيات'}
            </label>
            <input
              className="input"
              type="number"
              min={1}
              max={32}
              value={qualifiersPerGroup}
              onChange={(e) => setQualifiersPerGroup(e.target.value)}
            />
          </div>
        )}

        {/* Racing Custom Placement Points */}
        {isRacing && (
          <div className="arena-subcard stack-col" style={{ gap: 8, borderColor: 'rgba(245, 184, 46, 0.45)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--championship-gold)', fontWeight: 800, fontSize: '0.86rem' }}>
              <Flag size={16} />
              <span>تخصيص نقاط المراكز (من المركز الأول وما بعده)</span>
            </div>
            <div className="chip-row">
              <button
                type="button"
                className="chip"
                onClick={() => setRacingPointsText('25, 18, 15, 12, 10, 8, 6, 4, 2, 1')}
              >
                نظام الجائزة الكبرى (25-18-15...)
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => setRacingPointsText('15, 12, 10, 8, 6, 4, 2, 1')}
              >
                نقاط متقاربة (15-12-10...)
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => setRacingPointsText('10, 6, 4, 2, 1')}
              >
                سريع (10-6-4-2-1)
              </button>
            </div>
            <input
              className="input"
              dir="ltr"
              value={racingPointsText}
              onChange={(e) => setRacingPointsText(e.target.value)}
              placeholder="25, 18, 15, 12, 10, 8, 6, 4, 2, 1"
            />
            <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
              المعاينة: {parsedRacePoints().slice(0, 6).map((pts, i) => `#${i + 1}=${pts}`).join(' • ')}
            </div>
          </div>
        )}

        {/* Match Draw / Knockout Rules (hidden cleanly for pure Racing formats) */}
        {!isRacing && (
          <>
            <div className="field-group">
              <label className="field-label">نظام القرعة</label>
              <div className="chip-row">
                {(['RANDOM', 'MANUAL'] as DrawMode[]).map((dm) => (
                  <button
                    key={dm}
                    type="button"
                    className={`chip ${drawMode === dm ? 'selected-violet' : ''}`}
                    onClick={() => setDrawMode(dm)}
                  >
                    {DRAW_MODE_LABELS[dm]}
                  </button>
                ))}
              </div>
            </div>

            {(!selectedPreset || selectedPreset.categoryType === 'FOOTBALL' || selectedPreset.categoryType === 'SHOOTER') && (
              <div className="field-group">
                <label className="field-label">قواعد الأدوار الإقصائية</label>
                <div className="chip-row">
                  {(['SINGLE_MATCH_PENALTIES', 'TWO_LEGS_FINAL_SINGLE'] as KnockoutTieRule[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`chip ${tieRule === r ? 'selected' : ''}`}
                      onClick={() => setTieRule(r)}
                    >
                      {TIE_RULE_LABELS[r].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="arena-subcard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>مباراة تحديد المركز الثالث والرابع</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  تأهيل خاسري نصف النهائي تلقائياً للعب على البرونزية
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isThirdPlaceEnabled}
                className={`switch-pill ${isThirdPlaceEnabled ? 'on' : ''}`}
                onClick={() => setIsThirdPlaceEnabled((v: boolean) => !v)}
              >
                <span className="switch-knob" />
              </button>
            </div>
          </>
        )}

        <div className="grid-2">
          <div className="field-group">
            <label className="field-label">{isRacing ? 'مدة الجلسة / السباق (دقيقة)' : 'مدة المواجهة (دقيقة)'}</label>
            <input
              className="input"
              type="number"
              min={3}
              max={60}
              value={matchDuration}
              onChange={(e) => setMatchDuration(e.target.value)}
            />
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
              سيتم حذف جميع اللاعبين والمجموعات والمباريات والسباقات لهذه البطولة نهائياً.
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
  onGenerateKnockout,
  onGenerateFinalRace
}: {
  state: ArenaState;
  onRunDraw: (manualGroups: Record<number, number>, manualOrder: number[]) => Promise<void>;
  onGenerateKnockout: () => Promise<void>;
  onGenerateFinalRace?: () => Promise<void>;
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

  const isRacing = isRacingFormat(t.format);
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
          {isRacing ? 'انطلاقة السباقات وتوزيع المتسابقين' : `استوديو القرعة (${DRAW_MODE_LABELS[t.drawMode]})`}
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {isRacing
            ? `المتسابقون المعتمدون: ${approved.length} • النظام: ${FORMAT_LABELS[t.format]}`
            : `اللاعبون المعتمدون الجاهزون للقرعة: ${approved.length} • النظام: ${FORMAT_LABELS[t.format]}`}
        </div>

        {!isRacing && t.drawMode === 'MANUAL' && approved.length > 0 && (
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
          {isRacing ? <Flag size={18} /> : <Dices size={18} />}
          <span>
            {isRacing
              ? 'إغلاق التسجيل وفتح السباق الأول'
              : t.drawMode === 'RANDOM'
                ? 'إجراء القرعة العشوائية وتوليد المباريات'
                : 'اعتماد القرعة اليدوية وتوليد المباريات'}
          </span>
        </button>
      </div>

      {!isRacing && t.format !== 'DIRECT_KNOCKOUT' && (state.groupsWithStandings.length > 0 || state.leagueStandings.length > 0) && (
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

      {t.format === 'RACE_QUALIFIERS_FINAL' && (state.racingStandings?.length || 0) >= 2 && onGenerateFinalRace && (
        <div className="arena-card arena-card-gold stack-col">
          <div style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>تأهيل المتصدرين للسباق النهائي</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            تأهيل أفضل {t.qualifiersPerGroup} متسابقين من ترتيب التصفيات لخوض السباق النهائي وحسم اللقب.
          </div>
          <button type="button" className="btn btn-gold" onClick={onGenerateFinalRace}>
            <Trophy size={18} />
            <span>توليد السباق النهائي الآن</span>
          </button>
        </div>
      )}
    </div>
  );
}
