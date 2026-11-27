import type { RefObject } from 'react';
import {
  CheckCircle2,
  Columns2,
  Crosshair,
  Edit3,
  LayoutList,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Search,
  Trophy,
  XCircle
} from 'lucide-react';
import { STAGE_LABELS } from '../types';
import type { Match, MatchStage, Player } from '../types';

export type BracketViewMode = 'HORIZONTAL' | 'VERTICAL';
export type BracketWingSide = 'LEFT_BLUE' | 'RIGHT_RED' | 'FINAL_GOLD';

export interface BracketRenderModel {
  preFinalStages: MatchStage[];
  rightWingByStage: Map<MatchStage, Map<number, Match>>;
  leftWingByStage: Map<MatchStage, Map<number, Match>>;
  finalMatch: Match | null;
  thirdPlaceMatches: Match[];
  matchNumbersById: Map<number, number>;
  sideBaseSlots: number;
}

export function EsportsCrownIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.72)} viewBox="0 0 48 34" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="cp4CrownGrad" x1="0" y1="0" x2="0" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#F5B82E" />
          <stop offset="100%" stopColor="#B4780D" />
        </linearGradient>
      </defs>
      <path
        d="M5 27L2 9L14 17L24 3L34 17L46 9L43 27H5Z"
        fill="url(#cp4CrownGrad)"
        stroke="#FEF3C7"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <rect x="6" y="28" width="36" height="4" rx="2" fill="url(#cp4CrownGrad)" />
      <circle cx="24" cy="3" r="2.2" fill="#FEF9C3" />
      <circle cx="2" cy="9" r="1.8" fill="#FEF9C3" />
      <circle cx="46" cy="9" r="1.8" fill="#FEF9C3" />
    </svg>
  );
}

export function EsportsTrophyCrest({
  size = 112,
  hasChampion = false
}: {
  size?: number;
  hasChampion?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        filter: hasChampion
          ? 'drop-shadow(0 0 22px rgba(245, 184, 46, 0.75))'
          : 'drop-shadow(0 0 14px rgba(245, 184, 46, 0.42))'
      }}
      aria-label="كأس بطولة CP4 ARENA"
    >
      <svg width={size} height={Math.round(size * 0.88)} viewBox="0 0 160 140" fill="none">
        <defs>
          <radialGradient id="trophyAura" cx="50%" cy="48%" r="50%">
            <stop offset="0%" stopColor="#F5B82E" stopOpacity="0.48" />
            <stop offset="60%" stopColor="#F5B82E" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#F5B82E" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="trophyGold" x1="40" y1="14" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="35%" stopColor="#F5B82E" />
            <stop offset="75%" stopColor="#D99B16" />
            <stop offset="100%" stopColor="#8A5B06" />
          </linearGradient>
        </defs>

        <circle cx="80" cy="68" r="64" fill="url(#trophyAura)" />

        {/* Left & Right Golden Laurel Wreaths */}
        <g stroke="#F5B82E" strokeWidth="2.4" strokeLinecap="round" fill="#FDE68A" fillOpacity="0.78">
          <path d="M52 118C32 104 22 80 26 52C28 38 35 28 42 22" fill="none" strokeWidth="2.6" />
          <ellipse cx="29" cy="95" rx="7" ry="3.2" transform="rotate(-35 29 95)" />
          <ellipse cx="23" cy="79" rx="7" ry="3.2" transform="rotate(-20 23 79)" />
          <ellipse cx="22" cy="62" rx="7" ry="3.2" transform="rotate(-4 22 62)" />
          <ellipse cx="26" cy="46" rx="6.8" ry="3.1" transform="rotate(14 26 46)" />
          <ellipse cx="34" cy="31" rx="6.5" ry="2.9" transform="rotate(32 34 31)" />

          <path d="M108 118C128 104 138 80 134 52C132 38 125 28 118 22" fill="none" strokeWidth="2.6" />
          <ellipse cx="131" cy="95" rx="7" ry="3.2" transform="rotate(35 131 95)" />
          <ellipse cx="137" cy="79" rx="7" ry="3.2" transform="rotate(20 137 79)" />
          <ellipse cx="138" cy="62" rx="7" ry="3.2" transform="rotate(4 138 62)" />
          <ellipse cx="134" cy="46" rx="6.8" ry="3.1" transform="rotate(-14 134 46)" />
          <ellipse cx="126" cy="31" rx="6.5" ry="2.9" transform="rotate(-32 126 31)" />
        </g>

        {/* Trophy Handles */}
        <path
          d="M52 34C37 34 34 54 45 64C50 69 55 71 60 72"
          stroke="url(#trophyGold)"
          strokeWidth="4.8"
          strokeLinecap="round"
        />
        <path
          d="M108 34C123 34 126 54 115 64C110 69 105 71 100 72"
          stroke="url(#trophyGold)"
          strokeWidth="4.8"
          strokeLinecap="round"
        />

        {/* Trophy Cup Body */}
        <path
          d="M50 24H110L103 68C100 84 91 93 80 95C69 93 60 84 57 68L50 24Z"
          fill="url(#trophyGold)"
          stroke="#FEF3C7"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M62 32H73L70 74C65 69 62 56 62 32Z" fill="#FEF9C3" fillOpacity="0.4" />

        {/* Stem & Pedestal Base */}
        <rect x="74" y="94" width="12" height="16" rx="3" fill="url(#trophyGold)" />
        <path d="M58 110H102L108 122H52L58 110Z" fill="url(#trophyGold)" stroke="#FEF3C7" strokeWidth="1.2" />
        <rect x="46" y="122" width="68" height="7" rx="3" fill="#B4780D" stroke="#FDE68A" strokeWidth="1" />

        {/* Center CP4 Crest on Cup */}
        <text
          x="80"
          y="58"
          textAnchor="middle"
          fill="#4A2E00"
          fontSize="14"
          fontWeight="900"
          fontFamily="Barlow Condensed, Cairo, sans-serif"
          letterSpacing="0.8"
        >
          CP4
        </text>
      </svg>
    </div>
  );
}

export function EsportsStageHexBadge({
  stage,
  wingSide
}: {
  stage: MatchStage;
  wingSide: BracketWingSide;
}) {
  const label = stage === 'FINAL' ? 'النهائي' : STAGE_LABELS[stage].shortLabel;
  const variant =
    wingSide === 'FINAL_GOLD' ? 'wing-final' : wingSide === 'RIGHT_RED' ? 'wing-right' : 'wing-left';

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {wingSide === 'FINAL_GOLD' && (
        <div
          style={{
            position: 'absolute',
            top: -15,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3,
            pointerEvents: 'none'
          }}
        >
          <EsportsCrownIcon size={24} />
        </div>
      )}
      <div className={`esports-hex-header ${variant}`}>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function EsportsArenaTopBar({
  viewMode,
  onChangeViewMode,
  zoomPct,
  zoomLabelRef,
  onZoomOut,
  onZoomIn,
  onZoomFit,
  onZoomReset,
  isFullscreen,
  onToggleFullscreen
}: {
  viewMode: BracketViewMode;
  onChangeViewMode: (mode: BracketViewMode) => void;
  zoomPct: number;
  zoomLabelRef?: RefObject<HTMLSpanElement | null>;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomFit: () => void;
  onZoomReset: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <div className="esports-top-bar" dir="ltr">
      {/* Horizontal / Vertical Switch Capsule */}
      <div className="esports-mode-capsule" role="tablist" aria-label="وضع عرض الشجرة" dir="rtl">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'HORIZONTAL'}
          className={`esports-mode-btn ${viewMode === 'HORIZONTAL' ? 'active' : ''}`}
          onClick={() => onChangeViewMode('HORIZONTAL')}
        >
          <Columns2 size={15} />
          <span>أفقي</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'VERTICAL'}
          className={`esports-mode-btn ${viewMode === 'VERTICAL' ? 'active' : ''}`}
          onClick={() => onChangeViewMode('VERTICAL')}
        >
          <LayoutList size={15} />
          <span>عمودي</span>
        </button>
      </div>

      {/* Centered Crown + CP4 ARENA / TOURNAMENT BRACKET Lockup */}
      <div className="esports-brand-center">
        <EsportsCrownIcon size={28} />
        <div className="esports-brand-wordmark">
          <span className="esports-brand-cp4">CP4</span>
          <span className="esports-brand-arena">ARENA</span>
        </div>
        <div className="esports-brand-sub">
          <span className="esports-sub-chevrons" />
          <span>TOURNAMENT BRACKET</span>
          <span className="esports-sub-chevrons rev" />
        </div>
      </div>

      {/* Right Action Capsule: Zoom & Fit & Reset & Fullscreen */}
      <div className="esports-zoom-capsule" dir="rtl">
        <button
          type="button"
          className="esports-zoom-btn"
          aria-label="تكبير الشجرة"
          title="تكبير"
          onClick={onZoomIn}
        >
          <Plus size={14} />
        </button>

        <span ref={zoomLabelRef} className="esports-zoom-pct">
          {zoomPct}%
        </span>

        <button
          type="button"
          className="esports-zoom-btn"
          aria-label="تصغير الشجرة"
          title="تصغير"
          onClick={onZoomOut}
        >
          <Minus size={14} />
        </button>

        <button
          type="button"
          className="esports-zoom-btn"
          aria-label="عرض الشجرة كاملة"
          title="عرض الكل"
          onClick={onZoomFit}
        >
          <Search size={14} color="var(--cyber-sky)" />
          <span>الكل</span>
        </button>

        <button
          type="button"
          className="esports-zoom-btn"
          aria-label="إعادة ضبط العرض 100%"
          title="إعادة التمركز على النهائي"
          onClick={onZoomReset}
          style={{ color: 'var(--championship-gold)' }}
        >
          <Crosshair size={14} />
          <span>100%</span>
        </button>

        <button
          type="button"
          className="esports-zoom-btn"
          aria-label={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
          title={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  );
}

function EsportsAvatarBadge({
  player,
  wingSide,
  isWinner,
  isEliminated,
  size = 28
}: {
  player: Player | null;
  wingSide: BracketWingSide;
  isWinner: boolean;
  isEliminated: boolean;
  size?: number;
}) {
  const ringColor = isWinner
    ? 'var(--championship-gold)'
    : isEliminated
    ? 'rgba(239,68,68,0.45)'
    : wingSide === 'RIGHT_RED'
    ? 'rgba(248,113,113,0.75)'
    : wingSide === 'FINAL_GOLD'
    ? 'rgba(245,184,46,0.75)'
    : 'rgba(56,189,248,0.8)';

  const bgGradient =
    wingSide === 'RIGHT_RED'
      ? 'linear-gradient(135deg, rgba(239,68,68,0.42), rgba(127,29,29,0.7))'
      : wingSide === 'FINAL_GOLD'
      ? 'linear-gradient(135deg, rgba(245,184,46,0.35), rgba(30,41,59,0.85))'
      : 'linear-gradient(135deg, rgba(37,99,235,0.45), rgba(15,23,42,0.85))';

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `1.5px solid ${ringColor}`,
        background: bgGradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: isWinner ? '0 0 10px rgba(245,184,46,0.45)' : undefined
      }}
    >
      {player?.avatarUrl ? (
        <img
          src={player.avatarUrl}
          alt={player.name}
          loading="lazy"
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <svg width={Math.round(size * 0.68)} height={Math.round(size * 0.68)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8.5" r="4" fill={player ? '#F8FAFC' : '#94A3B8'} />
          <path
            d="M4.5 20C5.3 15.8 8.3 13.8 12 13.8C15.7 13.8 18.7 15.8 19.5 20"
            fill={player ? '#E2E8F0' : '#64748B'}
          />
        </svg>
      )}
    </div>
  );
}

export function EsportsMatchCard({
  match,
  matchNumber,
  bestOf,
  player1,
  player2,
  wingSide,
  canEdit,
  onTap
}: {
  match: Match;
  matchNumber?: number;
  bestOf: number;
  player1: Player | null;
  player2: Player | null;
  wingSide: BracketWingSide;
  canEdit: boolean;
  onTap: () => void;
}) {
  const isFinal = wingSide === 'FINAL_GOLD' || match.stage === 'FINAL';
  const isReady = player1 != null && player2 != null;
  const canTap = canEdit && isReady;
  const p1Won = match.isCompleted && match.winnerId != null && match.winnerId === player1?.id;
  const p2Won = match.isCompleted && match.winnerId != null && match.winnerId === player2?.id;
  const displayNum = matchNumber ?? match.bracketIndex + 1;

  const statusLabel = match.isWalkover
    ? 'انسحاب'
    : match.isCompleted
    ? 'مكتملة'
    : isReady
    ? 'جاهزة'
    : 'بانتظار';
  const statusColor = match.isWalkover
    ? 'var(--amber-draw)'
    : match.isCompleted
    ? 'var(--emerald-win)'
    : isReady
    ? wingSide === 'RIGHT_RED'
      ? 'var(--neon-crimson)'
      : 'var(--cyber-sky)'
    : 'var(--text-muted)';

  const s1 = match.isTwoLegged
    ? match.leg1Score1 != null
      ? String(match.leg1Score1 + (match.leg2Score1 ?? 0))
      : '-'
    : match.leg1Score1 != null
    ? String(match.leg1Score1)
    : '-';

  const s2 = match.isTwoLegged
    ? match.leg1Score2 != null
      ? String(match.leg1Score2 + (match.leg2Score2 ?? 0))
      : '-'
    : match.leg1Score2 != null
    ? String(match.leg1Score2)
    : '-';

  const wingClass =
    wingSide === 'FINAL_GOLD' ? 'wing-final' : wingSide === 'RIGHT_RED' ? 'wing-right' : 'wing-left';

  return (
    <div
      dir="rtl"
      onClick={canTap ? onTap : undefined}
      role={canTap ? 'button' : undefined}
      tabIndex={canTap ? 0 : undefined}
      className={`esports-match-card ${wingClass} ${canTap ? 'editable' : ''} ${match.isCompleted ? 'completed' : ''}`}
      style={{ height: '100%' }}
    >
      {/* Top Match Meta Strip */}
      <div
        style={{
          background: isFinal
            ? 'rgba(245, 184, 46, 0.16)'
            : wingSide === 'RIGHT_RED'
            ? 'rgba(127, 29, 29, 0.34)'
            : 'rgba(15, 33, 79, 0.55)',
          padding: '4px 9px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.72rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <span
            className="score-num"
            style={{
              padding: '1px 6px',
              borderRadius: 5,
              background: isFinal
                ? 'var(--championship-gold)'
                : wingSide === 'RIGHT_RED'
                ? 'rgba(239, 68, 68, 0.25)'
                : 'rgba(37, 99, 235, 0.3)',
              color: isFinal
                ? '#161004'
                : wingSide === 'RIGHT_RED'
                ? '#FCA5A5'
                : '#7DD3FC',
              fontWeight: 800,
              fontSize: '0.72rem'
            }}
          >
            #{displayNum}
          </span>
          <span
            style={{
              color: isFinal ? 'var(--championship-gold)' : 'var(--text-secondary)',
              fontWeight: isFinal ? 800 : 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {isFinal ? 'النهائي الكبير' : STAGE_LABELS[match.stage].shortLabel}
          </span>
          {bestOf > 1 && match.stage !== 'THIRD_PLACE' && (
            <span style={{ color: 'var(--championship-gold)', fontWeight: 700 }}>Bo{bestOf}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {match.penaltyScore1 != null && match.penaltyScore2 != null && (
            <span style={{ color: 'var(--championship-gold)', fontWeight: 800 }}>
              ر.ت {match.penaltyScore1}-{match.penaltyScore2}
            </span>
          )}
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 6,
              background: 'rgba(7, 9, 19, 0.78)',
              color: statusColor,
              fontWeight: 700
            }}
          >
            {statusLabel}
          </span>
          {canTap && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 4px',
                borderRadius: 5,
                background: 'rgba(245, 184, 46, 0.18)',
                color: 'var(--championship-gold)'
              }}
            >
              <Edit3 size={11} />
            </span>
          )}
        </div>
      </div>

      <EsportsSlotRow
        player={player1}
        score={s1}
        isWinner={p1Won}
        isEliminated={p2Won}
        wingSide={wingSide}
        isFinal={isFinal}
      />

      {isFinal ? (
        <div className="esports-vs-divider">
          <span className="esports-vs-pill">VS</span>
        </div>
      ) : (
        <div
          style={{
            height: 1,
            background:
              wingSide === 'RIGHT_RED'
                ? 'rgba(248, 113, 113, 0.25)'
                : 'rgba(56, 189, 248, 0.25)'
          }}
        />
      )}

      <EsportsSlotRow
        player={player2}
        score={s2}
        isWinner={p2Won}
        isEliminated={p1Won}
        wingSide={wingSide}
        isFinal={isFinal}
      />
    </div>
  );
}

function EsportsSlotRow({
  player,
  score,
  isWinner,
  isEliminated,
  wingSide,
  isFinal
}: {
  player: Player | null;
  score: string;
  isWinner: boolean;
  isEliminated: boolean;
  wingSide: BracketWingSide;
  isFinal: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isFinal ? '5px 11px' : '3px 10px',
        gap: 6,
        background: isWinner
          ? 'linear-gradient(90deg, rgba(245, 184, 46, 0.2), rgba(245, 184, 46, 0.06))'
          : isEliminated
          ? 'rgba(4, 6, 14, 0.45)'
          : 'transparent'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        <EsportsAvatarBadge
          player={player}
          wingSide={wingSide}
          isWinner={isWinner}
          isEliminated={isEliminated}
          size={isFinal ? 32 : 27}
        />
        <span
          title={player?.name || 'بانتظار المتأهل'}
          style={{
            fontSize: isFinal ? '0.94rem' : '0.88rem',
            fontWeight: isWinner ? 800 : 600,
            color: isWinner
              ? 'var(--championship-gold)'
              : isEliminated
              ? 'var(--text-muted)'
              : player
              ? 'var(--text-primary)'
              : 'var(--text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0
          }}
        >
          {player?.name || 'بانتظار المتأهل'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        {isWinner &&
          (isFinal ? (
            <Trophy size={15} color="var(--championship-gold)" />
          ) : (
            <CheckCircle2 size={14} color="var(--championship-gold)" />
          ))}
        {!isWinner && isEliminated && <XCircle size={13} color="rgba(239,68,68,0.8)" />}

        <span
          className="score-num"
          style={{
            minWidth: 30,
            textAlign: 'center',
            padding: '2px 8px',
            borderRadius: 7,
            background: isWinner
              ? 'rgba(245, 184, 46, 0.26)'
              : isEliminated
              ? 'rgba(7, 9, 19, 0.65)'
              : wingSide === 'RIGHT_RED'
              ? 'rgba(127, 29, 29, 0.45)'
              : 'rgba(23, 37, 84, 0.65)',
            border: `1px solid ${
              isWinner
                ? 'rgba(245, 184, 46, 0.65)'
                : wingSide === 'RIGHT_RED'
                ? 'rgba(248, 113, 113, 0.35)'
                : 'rgba(56, 189, 248, 0.35)'
            }`,
            color: isWinner
              ? 'var(--championship-gold)'
              : isEliminated
              ? 'var(--text-muted)'
              : '#F8FAFC',
            fontSize: '0.96rem'
          }}
        >
          {score}
        </span>
      </div>
    </div>
  );
}

export function EsportsChampionPedestal({
  champion,
  compact = false
}: {
  champion: Player | null;
  compact?: boolean;
}) {
  return (
    <div className="esports-champion-box" style={{ height: compact ? '100%' : undefined }}>
      <EsportsCrownIcon size={22} />

      <div className="esports-champion-ribbon">
        <span>CHAMPION</span>
      </div>

      {champion ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 2 }}>
          <EsportsAvatarBadge player={champion} wingSide="FINAL_GOLD" isWinner isEliminated={false} size={36} />
          <div style={{ textAlign: 'right', minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: '0.96rem', color: 'var(--championship-gold)' }}>
              {champion.name}
            </div>
            {champion.clubName && (
              <div style={{ fontSize: '0.72rem', color: 'var(--cyber-sky)' }}>{champion.clubName}</div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: 2 }}>
          بطل البطولة — يتحدد بعد النهائي
        </div>
      )}

      <div className="esports-podium-rings" aria-hidden="true" />
    </div>
  );
}

export function VerticalEsportsBracketView({
  model,
  wingFilter,
  playersById,
  championPlayer,
  bestOf,
  canEdit,
  zoomScale,
  onTapMatch
}: {
  model: BracketRenderModel;
  wingFilter: 'ALL' | 'RIGHT_WING' | 'LEFT_WING';
  playersById: Map<number, Player>;
  championPlayer: Player | null;
  bestOf: number;
  canEdit: boolean;
  zoomScale: number;
  onTapMatch: (m: Match) => void;
}) {
  const showLeft = wingFilter === 'ALL' || wingFilter === 'LEFT_WING';
  const showRight = wingFilter === 'ALL' || wingFilter === 'RIGHT_WING';
  const cardMinHeight = Math.round(122 * Math.max(0.85, Math.min(1.22, zoomScale)));

  return (
    <div className="esports-vertical-flow esports-vertical-scroll" dir="rtl">
      {model.preFinalStages.map((stage) => {
        const leftMatches = [...(model.leftWingByStage.get(stage)?.entries() ?? [])]
          .sort((a, b) => a[0] - b[0])
          .map(([, m]) => m);
        const rightMatches = [...(model.rightWingByStage.get(stage)?.entries() ?? [])]
          .sort((a, b) => a[0] - b[0])
          .map(([, m]) => m);

        return (
          <div key={`v_stage_${stage}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <EsportsStageHexBadge
              stage={stage}
              wingSide={wingFilter === 'RIGHT_WING' ? 'RIGHT_RED' : 'LEFT_BLUE'}
            />

            {showLeft && leftMatches.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="esports-wing-section-tag left">المسار الأيسر (الأزرق)</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {leftMatches.filter((m) => m.isCompleted).length}/{leftMatches.length} مكتمل
                  </span>
                </div>
                {leftMatches.map((m) => (
                  <div key={m.id} style={{ minHeight: cardMinHeight }}>
                    <EsportsMatchCard
                      match={m}
                      matchNumber={model.matchNumbersById.get(m.id)}
                      bestOf={bestOf}
                      player1={m.player1Id ? playersById.get(m.player1Id) || null : null}
                      player2={m.player2Id ? playersById.get(m.player2Id) || null : null}
                      wingSide="LEFT_BLUE"
                      canEdit={canEdit}
                      onTap={() => onTapMatch(m)}
                    />
                  </div>
                ))}
              </div>
            )}

            {showRight && rightMatches.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="esports-wing-section-tag right">المسار الأيمن (الأحمر)</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {rightMatches.filter((m) => m.isCompleted).length}/{rightMatches.length} مكتمل
                  </span>
                </div>
                {rightMatches.map((m) => (
                  <div key={m.id} style={{ minHeight: cardMinHeight }}>
                    <EsportsMatchCard
                      match={m}
                      matchNumber={model.matchNumbersById.get(m.id)}
                      bestOf={bestOf}
                      player1={m.player1Id ? playersById.get(m.player1Id) || null : null}
                      player2={m.player2Id ? playersById.get(m.player2Id) || null : null}
                      wingSide="RIGHT_RED"
                      canEdit={canEdit}
                      onTap={() => onTapMatch(m)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Vertical glowing flow connector arrow down to next round */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0' }} aria-hidden="true">
              <svg width="88" height="22" viewBox="0 0 88 22" fill="none">
                <path d="M18 2V11H44V20" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M70 2V11H44V20" stroke="#F87171" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="44" cy="18" r="3" fill="#F5B82E" />
              </svg>
            </div>
          </div>
        );
      })}

      {/* Grand Final Trophy + Match + Champion Pedestal */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          paddingTop: 10
        }}
      >
        <EsportsTrophyCrest size={102} hasChampion={Boolean(championPlayer)} />
        <div style={{ width: '100%', maxWidth: 420 }}>
          <EsportsStageHexBadge stage="FINAL" wingSide="FINAL_GOLD" />
        </div>

        {model.finalMatch && (
          <div style={{ width: '100%', maxWidth: 420, minHeight: 146 }}>
            <EsportsMatchCard
              match={model.finalMatch}
              matchNumber={model.matchNumbersById.get(model.finalMatch.id)}
              bestOf={bestOf}
              player1={model.finalMatch.player1Id ? playersById.get(model.finalMatch.player1Id) || null : null}
              player2={model.finalMatch.player2Id ? playersById.get(model.finalMatch.player2Id) || null : null}
              wingSide="FINAL_GOLD"
              canEdit={canEdit}
              onTap={() => model.finalMatch && onTapMatch(model.finalMatch)}
            />
          </div>
        )}

        <div style={{ width: '100%', maxWidth: 420 }}>
          <EsportsChampionPedestal champion={championPlayer} />
        </div>

        {wingFilter === 'ALL' && model.thirdPlaceMatches.length > 0 && (
          <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                textAlign: 'center',
                padding: '4px 12px',
                borderRadius: 10,
                background: 'var(--elevated-navy)',
                border: '1px solid rgba(245,184,46,0.45)',
                color: 'var(--championship-gold)',
                fontSize: '0.82rem',
                fontWeight: 800
              }}
            >
              مباراة تحديد المركز الثالث والرابع
            </div>
            {model.thirdPlaceMatches.map((m) => (
              <div key={m.id} style={{ minHeight: 124 }}>
                <EsportsMatchCard
                  match={m}
                  matchNumber={model.matchNumbersById.get(m.id)}
                  bestOf={bestOf}
                  player1={m.player1Id ? playersById.get(m.player1Id) || null : null}
                  player2={m.player2Id ? playersById.get(m.player2Id) || null : null}
                  wingSide="LEFT_BLUE"
                  canEdit={canEdit}
                  onTap={() => onTapMatch(m)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
