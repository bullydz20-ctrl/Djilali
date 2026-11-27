import { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, Flag, RefreshCw, X } from 'lucide-react';
import {
  EsportsArenaTopBar,
  EsportsChampionPedestal,
  EsportsMatchCard,
  EsportsStageHexBadge,
  EsportsTrophyCrest,
  VerticalEsportsBracketView
} from '../components/BracketEsportsVisuals';
import type { BracketRenderModel, BracketViewMode, BracketWingSide } from '../components/BracketEsportsVisuals';
import { EmptyStatePanel, PlayerAvatar } from '../components/PlayerAvatar';
import { isRacingFormat } from '../components/RacingSection';
import { STAGE_LABELS, adminHasPermission } from '../types';
import type { ArenaState, Match, MatchStage, Player } from '../types';

const KNOCKOUT_STAGES: MatchStage[] = [
  'ROUND_OF_64',
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'FINAL'
];
const PRE_FINAL_STAGES: MatchStage[] = [
  'ROUND_OF_64',
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL'
];

type WingFilter = 'ALL' | 'RIGHT_WING' | 'LEFT_WING';

function expectedStageCapacity(stage: MatchStage): number {
  switch (stage) {
    case 'ROUND_OF_64':
      return 32;
    case 'ROUND_OF_32':
      return 16;
    case 'ROUND_OF_16':
      return 8;
    case 'QUARTER_FINAL':
      return 4;
    case 'SEMI_FINAL':
      return 2;
    default:
      return 1;
  }
}

function buildSymmetricalBracketModel(knockoutMatches: Match[]): BracketRenderModel {
  const ordered = [...knockoutMatches].sort((a, b) => {
    const orderDiff = STAGE_LABELS[a.stage].order - STAGE_LABELS[b.stage].order;
    if (orderDiff !== 0) return orderDiff;
    if (a.bracketIndex !== b.bracketIndex) return a.bracketIndex - b.bracketIndex;
    return a.id - b.id;
  });

  const matchNumbersById = new Map<number, number>();
  ordered.forEach((m, idx) => matchNumbersById.set(m.id, idx + 1));

  const byStage = new Map<MatchStage, Match[]>();
  for (const m of ordered) {
    const arr = byStage.get(m.stage) || [];
    arr.push(m);
    byStage.set(m.stage, arr);
  }

  const preFinalStages = PRE_FINAL_STAGES.filter((st) => (byStage.get(st)?.length ?? 0) > 0);
  const finalMatch = byStage.get('FINAL')?.[0] ?? null;
  const thirdPlaceMatches = byStage.get('THIRD_PLACE') || [];
  const byId = new Map<number, Match>(ordered.map((m) => [m.id, m]));

  const resolveWingForMatch = (match: Match): boolean => {
    let curr: Match | undefined = match;
    let visited = 0;
    while (curr && visited < 12) {
      if (curr.nextMatchId != null) {
        const parent = byId.get(curr.nextMatchId);
        if (parent?.stage === 'FINAL') {
          return curr.nextMatchSlot !== 2;
        }
        curr = parent;
        visited++;
      } else {
        break;
      }
    }
    const halfCap = Math.max(1, Math.floor(expectedStageCapacity(match.stage) / 2));
    return match.bracketIndex < halfCap;
  };

  const rightWingByStage = new Map<MatchStage, Map<number, Match>>();
  const leftWingByStage = new Map<MatchStage, Map<number, Match>>();

  for (const stage of preFinalStages) {
    const halfCap = Math.max(1, Math.floor(expectedStageCapacity(stage) / 2));
    const stageMatches = [...(byStage.get(stage) || [])].sort((a, b) => a.bracketIndex - b.bracketIndex);
    const rMap = new Map<number, Match>();
    const lMap = new Map<number, Match>();

    for (const m of stageMatches) {
      const isRight = resolveWingForMatch(m);
      const localIdx = isRight
        ? Math.max(0, Math.min(halfCap - 1, m.bracketIndex))
        : Math.max(0, Math.min(halfCap - 1, m.bracketIndex - halfCap));

      const targetMap = isRight ? rMap : lMap;
      if (!targetMap.has(localIdx)) targetMap.set(localIdx, m);
      else targetMap.set(targetMap.size, m);
    }

    rightWingByStage.set(stage, rMap);
    leftWingByStage.set(stage, lMap);
  }

  const sideBaseSlots = preFinalStages.length === 0 ? 1 : 1 << (preFinalStages.length - 1);
  return {
    preFinalStages,
    rightWingByStage,
    leftWingByStage,
    finalMatch,
    thirdPlaceMatches,
    matchNumbersById,
    sideBaseSlots
  };
}

export function BracketScreen({
  state,
  onEditMatch,
  onSelectWinner
}: {
  state: ArenaState;
  onEditMatch: (m: Match) => void;
  onSelectWinner: (matchId: number, winnerPlayerId: number | null) => Promise<void>;
}) {
  const [selectedStage, setSelectedStage] = useState<MatchStage | null>(null);
  const [wingFilter, setWingFilter] = useState<WingFilter>('ALL');
  const [winnerDialogMatch, setWinnerDialogMatch] = useState<Match | null>(null);
  const [viewMode, setViewMode] = useState<BracketViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 900 ? 'VERTICAL' : 'HORIZONTAL'
  );

  const playersById = useMemo(
    () => new Map<number, Player>(state.players.map((p) => [p.id, p])),
    [state.players]
  );
  const canEdit = adminHasPermission(state.currentAdmin, 'EDIT_SCORES');
  const bestOf = state.tournament?.bestOf ?? 1;

  const byStage = useMemo(() => {
    const map = new Map<MatchStage, Match[]>();
    for (const st of [...KNOCKOUT_STAGES, 'THIRD_PLACE' as MatchStage]) {
      const list = state.knockoutMatches
        .filter((m) => m.stage === st)
        .sort((a, b) => a.bracketIndex - b.bracketIndex);
      if (list.length > 0) map.set(st, list);
    }
    return map;
  }, [state.knockoutMatches]);

  const activeStages = useMemo(
    () => KNOCKOUT_STAGES.filter((st) => (byStage.get(st)?.length ?? 0) > 0),
    [byStage]
  );

  const model = useMemo(() => buildSymmetricalBracketModel(state.knockoutMatches), [state.knockoutMatches]);

  if (isRacingFormat(state.tournament?.format) && state.knockoutMatches.length === 0) {
    const finalRace = (state.races || []).find((r) => r.stage === 'FINAL');
    const topStandings = (state.racingStandings || []).slice(0, 5);
    return (
      <div className="stack-col">
        <div className="arena-card arena-card-gold stack-col" style={{ gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--championship-gold)', fontWeight: 800 }}>
            <Flag size={20} />
            <span>
              {state.tournament?.format === 'RACE_QUALIFIERS_FINAL'
                ? 'بطولة سباقات (تصفيات ثم السباق النهائي)'
                : 'بطولة سباقات بنظام النقاط والترتيب'}
            </span>
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            {finalRace
              ? `تم فتح ${finalRace.title} (${finalRace.isCompleted ? 'مكتمل' : 'جاري السباق'}) — يمكنك متابعة جدول النقاط والسباقات من تبويب الترتيب والسباقات.`
              : 'تُحتسب نقاط المراكز وتُحدث المراكز مباشرة بعد كل سباق من تبويب الترتيب والسباقات.'}
          </div>
        </div>
        {topStandings.length > 0 && (
          <div className="arena-card stack-col" style={{ gap: 8 }}>
            <div style={{ fontWeight: 800, color: 'var(--cyber-sky)' }}>المتصدرون حالياً</div>
            {topStandings.map((row) => (
              <div
                key={row.player.id}
                className="arena-subcard"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="score-num" style={{ color: 'var(--championship-gold)', fontWeight: 800 }}>
                    #{row.rank}
                  </span>
                  <PlayerAvatar avatarUrl={row.player.avatarUrl} name={row.player.name} size={30} />
                  <span style={{ fontWeight: 700 }}>{row.player.name}</span>
                </div>
                <span className="score-num" style={{ color: 'var(--championship-gold)', fontWeight: 800 }}>
                  {row.totalPoints} نقطة
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (state.knockoutMatches.length === 0) {
    return (
      <EmptyStatePanel
        icon={<GitBranch size={28} />}
        title="لم تبدأ الأدوار الإقصائية بعد"
        subtitle="عند بدء الأدوار الإقصائية أو تأهيل المتصدرين من المجموعات/الدوري عبر لوحة المشرف، ستظهر شجرة المواجهات المتناظرة هنا."
      />
    );
  }

  const completedCount = state.knockoutMatches.filter((m) => m.isCompleted).length;
  const totalCount = state.knockoutMatches.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const resolvedChampion =
    state.championPlayer ?? (model.finalMatch?.winnerId ? playersById.get(model.finalMatch.winnerId) || null : null);

  return (
    <div className="stack-col">
      {/* Header & Progress + Wing/Present-Stage Pills */}
      <div className="bracket-shell-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <GitBranch size={20} color="var(--championship-gold)" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: 'var(--championship-gold)', fontSize: '1rem' }}>
                شجرة الأدوار الإقصائية المتناظرة {bestOf > 1 ? `• Best of ${bestOf}` : ''}
              </div>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--cyber-sky)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {canEdit
                  ? 'المسار الأزرق والأحمر يلتقيان في النهائي الذهبي • اضغط على المواجهة لتحديث الفائز'
                  : 'استعرض المواجهات بالأفقي أو العمودي أو حرّك وقرّب الشجرة نحو النهائي'}
              </div>
            </div>
          </div>

          <span
            className="score-num"
            style={{
              padding: '4px 10px',
              borderRadius: 10,
              background: 'rgba(37,99,235,0.2)',
              border: '1px solid rgba(56,189,248,0.45)',
              color: 'var(--cyber-sky)',
              fontSize: '0.84rem',
              flexShrink: 0
            }}
          >
            {completedCount} / {totalCount}
          </span>
        </div>

        <div className="bracket-progress-track">
          <div className="bracket-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="chip-scroll-row" style={{ padding: '10px 14px' }}>
          <button
            type="button"
            className={`chip ${selectedStage === null && wingFilter === 'ALL' ? 'selected-gold' : ''}`}
            onClick={() => {
              setSelectedStage(null);
              setWingFilter('ALL');
            }}
          >
            الشجرة الكاملة
          </button>

          {model.preFinalStages.length > 0 && (
            <>
              <button
                type="button"
                className={`chip ${selectedStage === null && wingFilter === 'LEFT_WING' ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedStage(null);
                  setWingFilter((prev) => (prev === 'LEFT_WING' ? 'ALL' : 'LEFT_WING'));
                }}
              >
                المسار الأيسر (الأزرق)
              </button>
              <button
                type="button"
                className={`chip ${selectedStage === null && wingFilter === 'RIGHT_WING' ? 'selected-violet' : ''}`}
                onClick={() => {
                  setSelectedStage(null);
                  setWingFilter((prev) => (prev === 'RIGHT_WING' ? 'ALL' : 'RIGHT_WING'));
                }}
                style={
                  selectedStage === null && wingFilter === 'RIGHT_WING'
                    ? { background: '#DC2626', borderColor: '#F87171', color: '#fff' }
                    : undefined
                }
              >
                المسار الأيمن (الأحمر)
              </button>
            </>
          )}

          {activeStages.map((st) => {
            const stageMatches = byStage.get(st) || [];
            const completed = stageMatches.filter((m) => m.isCompleted).length;
            const total = stageMatches.length;
            return (
              <button
                key={st}
                type="button"
                className={`chip ${selectedStage === st ? 'selected' : ''}`}
                onClick={() => {
                  setWingFilter('ALL');
                  setSelectedStage((prev) => (prev === st ? null : st));
                }}
              >
                {STAGE_LABELS[st].shortLabel} ({completed}/{total})
              </button>
            );
          })}

          {model.thirdPlaceMatches.length > 0 && (
            <button
              type="button"
              className={`chip ${selectedStage === 'THIRD_PLACE' ? 'selected' : ''}`}
              onClick={() => {
                setWingFilter('ALL');
                setSelectedStage((prev) => (prev === 'THIRD_PLACE' ? null : 'THIRD_PLACE'));
              }}
            >
              المركز الثالث ({model.thirdPlaceMatches.filter((m) => m.isCompleted).length}/{model.thirdPlaceMatches.length})
            </button>
          )}
        </div>
      </div>

      {selectedStage === null ? (
        <SymmetricalBracketViewport
          model={model}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          wingFilter={wingFilter}
          playersById={playersById}
          championPlayer={resolvedChampion}
          bestOf={bestOf}
          canEdit={canEdit}
          onTapMatch={(m) => setWinnerDialogMatch(m)}
        />
      ) : (
        /* Focused Single Stage List */
        <div className="stack-col" style={{ gap: 10 }}>
          {(byStage.get(selectedStage) || []).map((m) => (
            <div key={m.id} style={{ minHeight: selectedStage === 'FINAL' ? 148 : 126 }}>
              <EsportsMatchCard
                match={m}
                matchNumber={model.matchNumbersById.get(m.id)}
                bestOf={bestOf}
                player1={m.player1Id ? playersById.get(m.player1Id) || null : null}
                player2={m.player2Id ? playersById.get(m.player2Id) || null : null}
                wingSide={selectedStage === 'FINAL' ? 'FINAL_GOLD' : 'LEFT_BLUE'}
                canEdit={canEdit}
                onTap={() => setWinnerDialogMatch(m)}
              />
            </div>
          ))}
          {selectedStage === 'FINAL' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <EsportsTrophyCrest size={98} hasChampion={Boolean(resolvedChampion)} />
              <div style={{ width: '100%', maxWidth: 420 }}>
                <EsportsChampionPedestal champion={resolvedChampion} />
              </div>
            </div>
          )}
        </div>
      )}

      {winnerDialogMatch && winnerDialogMatch.player1Id && winnerDialogMatch.player2Id && (
        <WinnerDialog
          match={winnerDialogMatch}
          p1={playersById.get(winnerDialogMatch.player1Id)!}
          p2={playersById.get(winnerDialogMatch.player2Id)!}
          onClose={() => setWinnerDialogMatch(null)}
          onPickWinner={async (wId) => {
            await onSelectWinner(winnerDialogMatch.id, wId);
            setWinnerDialogMatch(null);
          }}
          onOpenScoreEditor={() => {
            const target = winnerDialogMatch;
            setWinnerDialogMatch(null);
            onEditMatch(target);
          }}
        />
      )}
    </div>
  );
}

function SymmetricalBracketViewport({
  model,
  viewMode,
  onChangeViewMode,
  wingFilter,
  playersById,
  championPlayer,
  bestOf,
  canEdit,
  onTapMatch
}: {
  model: BracketRenderModel;
  viewMode: BracketViewMode;
  onChangeViewMode: (mode: BracketViewMode) => void;
  wingFilter: WingFilter;
  playersById: Map<number, Player>;
  championPlayer: Player | null;
  bestOf: number;
  canEdit: boolean;
  onTapMatch: (m: Match) => void;
}) {
  const CARD_WIDTH = 256;
  const FINAL_CARD_WIDTH = 294;
  const CARD_HEIGHT = 128;
  const FINAL_CARD_HEIGHT = 158;
  const BASE_SLOT_HEIGHT = 148;
  const CONNECTOR_WIDTH = 44;
  const HEADER_HEIGHT = 38;
  const HEADER_GAP = 14;
  const HEADER_OFFSET = HEADER_HEIGHT + HEADER_GAP;
  const TOP_TROPHY_PAD = 124;
  const CHAMPION_STEM = 22;
  const CHAMPION_CARD_HEIGHT = 166;

  const stageCount = model.preFinalStages.length;
  const sideWidth = stageCount === 0 ? 0 : stageCount * CARD_WIDTH + stageCount * CONNECTOR_WIDTH;
  const naturalWidth =
    wingFilter === 'ALL'
      ? stageCount === 0
        ? FINAL_CARD_WIDTH + 36
        : sideWidth * 2 + FINAL_CARD_WIDTH + 36
      : sideWidth + FINAL_CARD_WIDTH + 36;

  const wingsHeight = stageCount === 0 ? FINAL_CARD_HEIGHT + 16 : BASE_SLOT_HEIGHT * model.sideBaseSlots;
  const rawCenterY = wingsHeight / 2;
  const finalCenterY = Math.max(TOP_TROPHY_PAD + FINAL_CARD_HEIGHT / 2, rawCenterY);
  const wingsTopOffset = finalCenterY - rawCenterY;
  const finalTop = finalCenterY - FINAL_CARD_HEIGHT / 2;
  const trophyTop = Math.max(0, finalTop - TOP_TROPHY_PAD);
  const finalBottom = finalTop + FINAL_CARD_HEIGHT;
  const centerHeight = Math.max(wingsTopOffset + wingsHeight, finalBottom + CHAMPION_STEM + CHAMPION_CARD_HEIGHT + 14);
  const thirdPlaceExtra = model.thirdPlaceMatches.length > 0 && wingFilter === 'ALL' ? 204 : 0;
  const naturalHeight = HEADER_OFFSET + centerHeight + thirdPlaceExtra + 44;

  const shellRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const zoomLabelRef = useRef<HTMLSpanElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 960, height: 580 });
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  const applyVisualZoomDom = (nextScale: number) => {
    if (spacerRef.current) {
      spacerRef.current.style.width = `${naturalWidth * nextScale}px`;
      spacerRef.current.style.height = `${naturalHeight * nextScale}px`;
    }
    if (stageRef.current) {
      stageRef.current.style.transform = `scale(${nextScale})`;
    }
    if (zoomLabelRef.current) {
      zoomLabelRef.current.textContent = `${Math.round(nextScale * 100)}%`;
    }
  };

  useEffect(() => {
    if (viewMode === 'HORIZONTAL') {
      applyVisualZoomDom(scale);
    } else if (zoomLabelRef.current) {
      zoomLabelRef.current.textContent = `${Math.round(scale * 100)}%`;
    }
  }, [scale, naturalWidth, naturalHeight, viewMode]);

  const exactFitScale = useMemo(() => {
    const w = Math.max(260, viewportSize.width);
    return Math.max(0.16, Math.min(1, (w - 24) / naturalWidth));
  }, [viewportSize.width, naturalWidth]);
  const minZoomScale = Math.min(0.16, exactFitScale);

  useEffect(() => {
    if (viewMode !== 'HORIZONTAL') return;
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode, isFullscreen]);

  const scrollToDefaultAnchor = (targetScale: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const scaledW = naturalWidth * targetScale;
    const targetLeft =
      wingFilter === 'RIGHT_WING'
        ? Math.max(0, scaledW - el.clientWidth)
        : wingFilter === 'LEFT_WING'
        ? 0
        : Math.max(0, (scaledW - el.clientWidth) / 2);
    const targetTop = Math.max(0, (HEADER_OFFSET + finalCenterY) * targetScale - el.clientHeight * 0.44);
    el.scrollLeft = targetLeft;
    el.scrollTop = targetTop;
  };

  useEffect(() => {
    if (viewMode !== 'HORIZONTAL') {
      scaleRef.current = 1;
      setScale(1);
      return;
    }
    scaleRef.current = 1;
    setScale(1);
    applyVisualZoomDom(1);
    const raf = requestAnimationFrame(() => scrollToDefaultAnchor(1));
    return () => cancelAnimationFrame(raf);
  }, [wingFilter, stageCount, viewMode]);

  // Sync native browser Fullscreen API exits (e.g., ESC key) cleanly
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleFullscreen = () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    try {
      if (next && shellRef.current?.requestFullscreen) {
        shellRef.current.requestFullscreen().catch(() => {});
      } else if (!next && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Fallback CSS fixed-inset overlay handles mobile browsers cleanly
    }
  };

  // Desktop mouse drag-to-scroll & 2-finger touch pinch zoom (preserving 1-finger panning)
  const mouseDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    moved: boolean;
  }>({ active: false, startX: 0, startY: 0, origLeft: 0, origTop: 0, moved: false });
  const pinchDistRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const wheelCommitTimerRef = useRef<number | null>(null);

  const applyFocalZoomDom = (nextScaleRaw: number, focalClientX: number, focalClientY: number) => {
    const el = viewportRef.current;
    const prevScale = scaleRef.current;
    const nextScale = Math.max(minZoomScale, Math.min(1.85, nextScaleRaw));
    if (!el || Math.abs(nextScale - prevScale) < 0.0005) return;

    const rect = el.getBoundingClientRect();
    const viewX = focalClientX - rect.left;
    const viewY = focalClientY - rect.top;
    const contentX = (el.scrollLeft + viewX) / prevScale;
    const contentY = (el.scrollTop + viewY) / prevScale;

    scaleRef.current = nextScale;
    applyVisualZoomDom(nextScale);
    el.scrollLeft = Math.max(0, contentX * nextScale - viewX);
    el.scrollTop = Math.max(0, contentY * nextScale - viewY);
  };

  useEffect(() => {
    if (viewMode !== 'HORIZONTAL') return;
    const el = viewportRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDistRef.current = Math.hypot(dx, dy);
      } else if (e.touches.length !== 2) {
        pinchDistRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        if (!pinchDistRef.current || pinchDistRef.current <= 0) {
          pinchDistRef.current = dist;
          return;
        }
        const ratio = dist / pinchDistRef.current;
        pinchDistRef.current = dist;
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;
        applyFocalZoomDom(scaleRef.current * ratio, midX, midY);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2 && pinchDistRef.current !== null) {
        pinchDistRef.current = null;
        setScale(scaleRef.current);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        applyFocalZoomDom(scaleRef.current * factor, e.clientX, e.clientY);
        if (wheelCommitTimerRef.current !== null) window.clearTimeout(wheelCommitTimerRef.current);
        wheelCommitTimerRef.current = window.setTimeout(() => {
          wheelCommitTimerRef.current = null;
          setScale(scaleRef.current);
        }, 120);
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    el.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      if (wheelCommitTimerRef.current !== null) window.clearTimeout(wheelCommitTimerRef.current);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
      el.removeEventListener('wheel', handleWheel);
    };
  }, [minZoomScale, viewMode]);

  const showLeftWing = (wingFilter === 'ALL' || wingFilter === 'LEFT_WING') && stageCount > 0;
  const showRightWing = (wingFilter === 'ALL' || wingFilter === 'RIGHT_WING') && stageCount > 0;

  return (
    <div ref={shellRef} className={`esports-arena-shell ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <EsportsArenaTopBar
        viewMode={viewMode}
        onChangeViewMode={onChangeViewMode}
        zoomPct={Math.round(scale * 100)}
        zoomLabelRef={zoomLabelRef}
        onZoomOut={() =>
          setScale((prev) =>
            Math.max(viewMode === 'VERTICAL' ? 0.8 : minZoomScale, prev - 0.15)
          )
        }
        onZoomIn={() =>
          setScale((prev) =>
            Math.min(viewMode === 'VERTICAL' ? 1.35 : 1.85, prev + 0.15)
          )
        }
        onZoomFit={() => {
          if (viewMode === 'VERTICAL') {
            setScale(0.9);
          } else {
            setScale(exactFitScale);
            if (viewportRef.current) {
              viewportRef.current.scrollLeft = 0;
              viewportRef.current.scrollTop = 0;
            }
          }
        }}
        onZoomReset={() => {
          setScale(1);
          if (viewMode === 'HORIZONTAL') {
            requestAnimationFrame(() => scrollToDefaultAnchor(1));
          }
        }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {viewMode === 'VERTICAL' ? (
        <VerticalEsportsBracketView
          model={model}
          wingFilter={wingFilter}
          playersById={playersById}
          championPlayer={championPlayer}
          bestOf={bestOf}
          canEdit={canEdit}
          zoomScale={scale}
          onTapMatch={onTapMatch}
        />
      ) : (
        <div
          ref={viewportRef}
          dir="ltr"
          className="bracket-viewport-wrap"
          onPointerDown={(e) => {
            if (e.pointerType !== 'mouse') return;
            const el = viewportRef.current;
            if (!el) return;
            mouseDragRef.current = {
              active: true,
              startX: e.clientX,
              startY: e.clientY,
              origLeft: el.scrollLeft,
              origTop: el.scrollTop,
              moved: false
            };
            suppressClickRef.current = false;
          }}
          onPointerMove={(e) => {
            if (e.pointerType !== 'mouse' || !mouseDragRef.current.active) return;
            const el = viewportRef.current;
            if (!el) return;
            const dx = e.clientX - mouseDragRef.current.startX;
            const dy = e.clientY - mouseDragRef.current.startY;
            if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
              mouseDragRef.current.moved = true;
              suppressClickRef.current = true;
            }
            if (mouseDragRef.current.moved) {
              el.scrollLeft = mouseDragRef.current.origLeft - dx;
              el.scrollTop = mouseDragRef.current.origTop - dy;
            }
          }}
          onPointerUp={() => {
            mouseDragRef.current.active = false;
            setTimeout(() => {
              suppressClickRef.current = false;
            }, 40);
          }}
          onPointerCancel={() => {
            mouseDragRef.current.active = false;
          }}
        >
          <div
            style={{
              width: 'max-content',
              minWidth: '100%',
              minHeight: '100%',
              paddingBottom: 28,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start'
            }}
          >
            <div
              ref={spacerRef}
              style={{
                position: 'relative',
                width: naturalWidth * scale,
                height: naturalHeight * scale,
                flexShrink: 0
              }}
            >
              <div
                ref={stageRef}
                className="bracket-stage-surface"
                style={{
                  width: naturalWidth,
                  height: naturalHeight,
                  padding: '18px 18px 26px',
                  transform: `scale(${scale})`
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 20
                  }}
                >
                  {/* Symmetrical LTR Row: [Left Blue Wing L->R] -> [Center Trophy + VS Final + Champion] <- [Right Red Wing R->L] */}
                  <div dir="ltr" style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
                    {showLeftWing &&
                      model.preFinalStages.map((stage, sIdx) => {
                        const sideMatchCount = 1 << (stageCount - 1 - sIdx);
                        const slotHeight = BASE_SLOT_HEIGHT * (1 << sIdx);
                        const wingMap = model.leftWingByStage.get(stage) || new Map<number, Match>();
                        const nextStage = model.preFinalStages[sIdx + 1];

                        return (
                          <div key={`left_${stage}`} style={{ display: 'flex', alignItems: 'flex-start' }}>
                            <WingColumn
                              stage={stage}
                              wingSide="LEFT_BLUE"
                              sideMatchCount={sideMatchCount}
                              slotHeight={slotHeight}
                              wingsHeight={wingsHeight}
                              wingsTopOffset={wingsTopOffset}
                              wingMap={wingMap}
                              matchNumbersById={model.matchNumbersById}
                              bestOf={bestOf}
                              playersById={playersById}
                              cardWidth={CARD_WIDTH}
                              cardHeight={CARD_HEIGHT}
                              headerHeight={HEADER_HEIGHT}
                              headerGap={HEADER_GAP}
                              canEdit={canEdit}
                              onTapMatch={(m) => {
                                if (!suppressClickRef.current) onTapMatch(m);
                              }}
                            />

                            {nextStage ? (
                              <SymmetricalConnectorSvg
                                childMatchesBySlot={wingMap}
                                nextSideMatchCount={1 << (stageCount - 1 - (sIdx + 1))}
                                childSlotHeight={slotHeight}
                                parentSlotHeight={BASE_SLOT_HEIGHT * (1 << (sIdx + 1))}
                                connectorWidth={CONNECTOR_WIDTH}
                                totalHeight={wingsHeight}
                                headerOffset={HEADER_OFFSET + wingsTopOffset}
                                direction="L_TO_R"
                                wingSide="LEFT_BLUE"
                              />
                            ) : (
                              <SemiToFinalSvg
                                semiMatch={wingMap.get(0)}
                                width={CONNECTOR_WIDTH}
                                height={wingsHeight}
                                headerOffset={HEADER_OFFSET + wingsTopOffset}
                                wingSide="LEFT_BLUE"
                              />
                            )}
                          </div>
                        );
                      })}

                    {/* Center Trophy + Grand Final VS Card + Champion Pedestal */}
                    <div dir="rtl" style={{ width: FINAL_CARD_WIDTH, flexShrink: 0 }}>
                      <div style={{ height: HEADER_HEIGHT, marginBottom: HEADER_GAP }}>
                        <EsportsStageHexBadge stage="FINAL" wingSide="FINAL_GOLD" />
                      </div>

                      <div style={{ position: 'relative', width: FINAL_CARD_WIDTH, height: centerHeight }}>
                        {/* Golden Trophy inside Laurel Wreaths */}
                        <div
                          style={{
                            position: 'absolute',
                            top: trophyTop,
                            left: 0,
                            right: 0,
                            display: 'flex',
                            justifyContent: 'center',
                            pointerEvents: 'none'
                          }}
                        >
                          <EsportsTrophyCrest size={118} hasChampion={Boolean(championPlayer)} />
                        </div>

                        <div style={{ position: 'absolute', top: finalTop, left: 0, right: 0, height: FINAL_CARD_HEIGHT }}>
                          {model.finalMatch ? (
                            <EsportsMatchCard
                              match={model.finalMatch}
                              matchNumber={model.matchNumbersById.get(model.finalMatch.id)}
                              bestOf={bestOf}
                              player1={
                                model.finalMatch.player1Id ? playersById.get(model.finalMatch.player1Id) || null : null
                              }
                              player2={
                                model.finalMatch.player2Id ? playersById.get(model.finalMatch.player2Id) || null : null
                              }
                              wingSide="FINAL_GOLD"
                              canEdit={canEdit}
                              onTap={() => {
                                if (!suppressClickRef.current && model.finalMatch) onTapMatch(model.finalMatch);
                              }}
                            />
                          ) : (
                            <BracketPlaceholderCard stage="FINAL" slotNum={1} height={FINAL_CARD_HEIGHT} wingSide="FINAL_GOLD" />
                          )}
                        </div>

                        {/* Golden vertical beam from Final to Champion Pedestal */}
                        <svg
                          width={FINAL_CARD_WIDTH}
                          height={CHAMPION_STEM}
                          style={{ position: 'absolute', top: finalBottom, left: 0, display: 'block' }}
                        >
                          <line
                            x1={FINAL_CARD_WIDTH / 2}
                            y1={0}
                            x2={FINAL_CARD_WIDTH / 2}
                            y2={CHAMPION_STEM}
                            stroke={championPlayer ? 'rgba(245,184,46,0.38)' : 'rgba(245,184,46,0.2)'}
                            strokeWidth={8}
                            strokeLinecap="round"
                          />
                          <line
                            x1={FINAL_CARD_WIDTH / 2}
                            y1={0}
                            x2={FINAL_CARD_WIDTH / 2}
                            y2={CHAMPION_STEM}
                            stroke={championPlayer ? 'var(--championship-gold)' : 'rgba(245,184,46,0.65)'}
                            strokeWidth={3.2}
                            strokeLinecap="round"
                          />
                        </svg>

                        <div
                          style={{
                            position: 'absolute',
                            top: finalBottom + CHAMPION_STEM,
                            left: 0,
                            right: 0,
                            height: CHAMPION_CARD_HEIGHT
                          }}
                        >
                          <EsportsChampionPedestal champion={championPlayer} compact />
                        </div>
                      </div>
                    </div>

                    {showRightWing &&
                      [...model.preFinalStages].reverse().map((stage, revIdx, reversed) => {
                        const originalIdx = stageCount - 1 - revIdx;
                        const sideMatchCount = 1 << (stageCount - 1 - originalIdx);
                        const slotHeight = BASE_SLOT_HEIGHT * (1 << originalIdx);
                        const wingMap = model.rightWingByStage.get(stage) || new Map<number, Match>();
                        const childOriginalIdx = originalIdx - 1;
                        const childStage = childOriginalIdx >= 0 ? model.preFinalStages[childOriginalIdx] : null;

                        return (
                          <div key={`right_${stage}`} style={{ display: 'flex', alignItems: 'flex-start' }}>
                            {revIdx === 0 && (
                              <SemiToFinalSvg
                                semiMatch={wingMap.get(0)}
                                width={CONNECTOR_WIDTH}
                                height={wingsHeight}
                                headerOffset={HEADER_OFFSET + wingsTopOffset}
                                wingSide="RIGHT_RED"
                              />
                            )}

                            <WingColumn
                              stage={stage}
                              wingSide="RIGHT_RED"
                              sideMatchCount={sideMatchCount}
                              slotHeight={slotHeight}
                              wingsHeight={wingsHeight}
                              wingsTopOffset={wingsTopOffset}
                              wingMap={wingMap}
                              matchNumbersById={model.matchNumbersById}
                              bestOf={bestOf}
                              playersById={playersById}
                              cardWidth={CARD_WIDTH}
                              cardHeight={CARD_HEIGHT}
                              headerHeight={HEADER_HEIGHT}
                              headerGap={HEADER_GAP}
                              canEdit={canEdit}
                              onTapMatch={(m) => {
                                if (!suppressClickRef.current) onTapMatch(m);
                              }}
                            />

                            {revIdx < reversed.length - 1 && childStage && (
                              <SymmetricalConnectorSvg
                                childMatchesBySlot={model.rightWingByStage.get(childStage) || new Map<number, Match>()}
                                nextSideMatchCount={sideMatchCount}
                                childSlotHeight={BASE_SLOT_HEIGHT * (1 << childOriginalIdx)}
                                parentSlotHeight={slotHeight}
                                connectorWidth={CONNECTOR_WIDTH}
                                totalHeight={wingsHeight}
                                headerOffset={HEADER_OFFSET + wingsTopOffset}
                                direction="R_TO_L"
                                wingSide="RIGHT_RED"
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* Third Place Match Centered Underneath */}
                  {wingFilter === 'ALL' && model.thirdPlaceMatches.length > 0 && (
                    <div dir="rtl" className="stack-col" style={{ alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          padding: '5px 14px',
                          borderRadius: 10,
                          background: 'var(--elevated-navy)',
                          border: '1px solid rgba(245,184,46,0.45)',
                          color: 'var(--championship-gold)',
                          fontSize: '0.84rem',
                          fontWeight: 800
                        }}
                      >
                        مباراة تحديد المركز الثالث والرابع
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {model.thirdPlaceMatches.map((m) => (
                          <div key={m.id} style={{ width: FINAL_CARD_WIDTH, height: CARD_HEIGHT }}>
                            <EsportsMatchCard
                              match={m}
                              matchNumber={model.matchNumbersById.get(m.id)}
                              bestOf={bestOf}
                              player1={m.player1Id ? playersById.get(m.player1Id) || null : null}
                              player2={m.player2Id ? playersById.get(m.player2Id) || null : null}
                              wingSide="FINAL_GOLD"
                              canEdit={canEdit}
                              onTap={() => {
                                if (!suppressClickRef.current) onTapMatch(m);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WingColumn({
  stage,
  wingSide,
  sideMatchCount,
  slotHeight,
  wingsHeight,
  wingsTopOffset,
  wingMap,
  matchNumbersById,
  bestOf,
  playersById,
  cardWidth,
  cardHeight,
  headerHeight,
  headerGap,
  canEdit,
  onTapMatch
}: {
  stage: MatchStage;
  wingSide: BracketWingSide;
  sideMatchCount: number;
  slotHeight: number;
  wingsHeight: number;
  wingsTopOffset: number;
  wingMap: Map<number, Match>;
  matchNumbersById: Map<number, number>;
  bestOf: number;
  playersById: Map<number, Player>;
  cardWidth: number;
  cardHeight: number;
  headerHeight: number;
  headerGap: number;
  canEdit: boolean;
  onTapMatch: (m: Match) => void;
}) {
  return (
    <div dir="rtl" style={{ width: cardWidth, flexShrink: 0 }}>
      <div style={{ height: headerHeight, marginBottom: headerGap }}>
        <EsportsStageHexBadge stage={stage} wingSide={wingSide} />
      </div>

      <div style={{ position: 'relative', width: cardWidth, height: wingsTopOffset + wingsHeight }}>
        {Array.from({ length: sideMatchCount }, (_, localIdx) => {
          const centerY = wingsTopOffset + slotHeight * localIdx + slotHeight / 2;
          const top = centerY - cardHeight / 2;
          const match = wingMap.get(localIdx);

          return (
            <div key={localIdx} style={{ position: 'absolute', top, left: 0, right: 0, height: cardHeight }}>
              {match ? (
                <EsportsMatchCard
                  match={match}
                  matchNumber={matchNumbersById.get(match.id)}
                  bestOf={bestOf}
                  player1={match.player1Id ? playersById.get(match.player1Id) || null : null}
                  player2={match.player2Id ? playersById.get(match.player2Id) || null : null}
                  wingSide={wingSide}
                  canEdit={canEdit}
                  onTap={() => onTapMatch(match)}
                />
              ) : (
                <BracketPlaceholderCard stage={stage} slotNum={localIdx + 1} height={cardHeight} wingSide={wingSide} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketPlaceholderCard({
  stage,
  slotNum,
  height,
  wingSide
}: {
  stage: MatchStage;
  slotNum: number;
  height: number;
  wingSide: BracketWingSide;
}) {
  const borderCol =
    wingSide === 'RIGHT_RED'
      ? 'rgba(248,113,113,0.4)'
      : wingSide === 'FINAL_GOLD'
      ? 'rgba(245,184,46,0.5)'
      : 'rgba(56,189,248,0.4)';

  return (
    <div
      style={{
        height,
        borderRadius: 14,
        background: 'rgba(15,21,40,0.48)',
        border: `1px dashed ${borderCol}`,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: 'var(--text-muted)',
        fontSize: '0.8rem'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>
          {STAGE_LABELS[stage].shortLabel} #{slotNum}
        </span>
        <span>بانتظار</span>
      </div>
      <div>مسار مفتوح / BYE</div>
      <span>—</span>
    </div>
  );
}

function SymmetricalConnectorSvg({
  childMatchesBySlot,
  nextSideMatchCount,
  childSlotHeight,
  parentSlotHeight,
  connectorWidth,
  totalHeight,
  headerOffset,
  direction,
  wingSide
}: {
  childMatchesBySlot: Map<number, Match>;
  nextSideMatchCount: number;
  childSlotHeight: number;
  parentSlotHeight: number;
  connectorWidth: number;
  totalHeight: number;
  headerOffset: number;
  direction: 'L_TO_R' | 'R_TO_L';
  wingSide: BracketWingSide;
}) {
  const w = connectorWidth;
  const childX = direction === 'L_TO_R' ? 0 : w;
  const parentX = direction === 'L_TO_R' ? w : 0;
  const midX = w / 2;

  const wingLine = wingSide === 'RIGHT_RED' ? '#F87171' : '#38BDF8';
  const wingGlow = wingSide === 'RIGHT_RED' ? 'rgba(239,68,68,0.34)' : 'rgba(37,99,235,0.36)';
  const idleLine = wingSide === 'RIGHT_RED' ? 'rgba(239,68,68,0.42)' : 'rgba(56,189,248,0.42)';

  const paths: Array<{ d: string; active: boolean; ready: boolean }> = [];
  for (let i = 0; i < nextSideMatchCount; i++) {
    const topY = childSlotHeight * (i * 2) + childSlotHeight / 2;
    const botY = childSlotHeight * (i * 2 + 1) + childSlotHeight / 2;
    const parentY = parentSlotHeight * i + parentSlotHeight / 2;
    const topM = childMatchesBySlot.get(i * 2);
    const botM = childMatchesBySlot.get(i * 2 + 1);

    paths.push({
      d: `M ${childX} ${topY} L ${midX} ${topY} L ${midX} ${parentY} L ${parentX} ${parentY}`,
      active: Boolean(topM?.winnerId),
      ready: Boolean(topM?.player1Id && topM?.player2Id)
    });
    paths.push({
      d: `M ${childX} ${botY} L ${midX} ${botY} L ${midX} ${parentY} L ${parentX} ${parentY}`,
      active: Boolean(botM?.winnerId),
      ready: Boolean(botM?.player1Id && botM?.player2Id)
    });
  }

  return (
    <div style={{ paddingTop: headerOffset, flexShrink: 0 }}>
      <svg width={w} height={totalHeight} style={{ display: 'block' }}>
        {paths
          .filter((p) => !p.active)
          .map((p, idx) => (
            <g key={`in_${idx}`}>
              {p.ready && (
                <path
                  d={p.d}
                  fill="none"
                  stroke={wingGlow}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              <path
                d={p.d}
                fill="none"
                stroke={p.ready ? wingLine : idleLine}
                strokeWidth={p.ready ? 2.8 : 2.1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
        {paths
          .filter((p) => p.active)
          .map((p, idx) => (
            <g key={`ac_${idx}`}>
              <path
                d={p.d}
                fill="none"
                stroke="rgba(245,184,46,0.34)"
                strokeWidth={7.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={p.d}
                fill="none"
                stroke="var(--championship-gold)"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
      </svg>
    </div>
  );
}

function SemiToFinalSvg({
  semiMatch,
  width,
  height,
  headerOffset,
  wingSide
}: {
  semiMatch?: Match;
  width: number;
  height: number;
  headerOffset: number;
  wingSide: BracketWingSide;
}) {
  const y = height / 2;
  const active = Boolean(semiMatch?.winnerId);
  const ready = Boolean(semiMatch?.player1Id && semiMatch?.player2Id);
  const wingLine = wingSide === 'RIGHT_RED' ? '#F87171' : '#38BDF8';
  const wingGlow = wingSide === 'RIGHT_RED' ? 'rgba(239,68,68,0.35)' : 'rgba(37,99,235,0.36)';
  const idleLine = wingSide === 'RIGHT_RED' ? 'rgba(239,68,68,0.45)' : 'rgba(56,189,248,0.45)';

  return (
    <div style={{ paddingTop: headerOffset, flexShrink: 0 }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        <line
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke={active ? 'rgba(245,184,46,0.35)' : ready ? wingGlow : 'transparent'}
          strokeWidth={7.5}
          strokeLinecap="round"
        />
        <line
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke={active ? 'var(--championship-gold)' : ready ? wingLine : idleLine}
          strokeWidth={active ? 3.5 : 2.6}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function WinnerDialog({
  match,
  p1,
  p2,
  onClose,
  onPickWinner,
  onOpenScoreEditor
}: {
  match: Match;
  p1: Player;
  p2: Player;
  onClose: () => void;
  onPickWinner: (id: number | null) => Promise<void>;
  onOpenScoreEditor: () => void;
}) {
  const isFinal = match.stage === 'FINAL';
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.08rem' }}>
              تحديث الفائز — {STAGE_LABELS[match.stage].label}
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {isFinal ? 'اختر بطل البطولة أو سجّل النتيجة الكاملة' : 'اختر المتأهل للدور التالي أو أدخل الأهداف'}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        {[p1, p2].map((player) => {
          const isCurrent = match.winnerId === player.id;
          return (
            <button
              key={player.id}
              type="button"
              className="arena-subcard"
              onClick={() => onPickWinner(player.id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                borderColor: isCurrent ? 'var(--championship-gold)' : 'var(--card-border)',
                background: isCurrent ? 'rgba(245,184,46,0.16)' : 'var(--elevated-navy)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PlayerAvatar avatarUrl={player.avatarUrl} name={player.name} size={38} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: isCurrent ? 'var(--championship-gold)' : 'var(--text-primary)' }}>
                    {player.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{player.elysiumNetId}</div>
                </div>
              </div>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: isCurrent ? 'var(--championship-gold)' : 'rgba(37,99,235,0.25)',
                  color: isCurrent ? 'var(--midnight-surface)' : 'var(--cyber-sky)'
                }}
              >
                {isCurrent ? 'الفائز الحالي ✓' : isFinal ? 'تتويج' : 'تأهيل'}
              </span>
            </button>
          );
        })}

        <button type="button" className="btn btn-primary" onClick={onOpenScoreEditor}>
          إدخال النتيجة التفصيلية
        </button>

        {match.winnerId != null && (
          <button type="button" className="btn btn-danger-outline" onClick={() => onPickWinner(null)}>
            <RefreshCw size={16} />
            <span>إلغاء تحديد الفائز وإعادة الفتح</span>
          </button>
        )}
      </div>
    </div>
  );
}
