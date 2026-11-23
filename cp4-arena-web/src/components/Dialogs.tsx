import { useEffect, useState } from 'react';
import {
  BellRing,
  Copy,
  Download,
  ImagePlus,
  Share2,
  Smartphone,
  Trophy,
  X
} from 'lucide-react';
import { uploadImageFileApi } from '../api';
import { LEVEL_LABELS, STAGE_LABELS } from '../types';
import type { Match, MatchReminder, Player, PlayerLevel } from '../types';
import { PlayerAvatar } from './PlayerAvatar';

export function RegisterPlayerModal({
  gameTitle,
  tournamentName,
  onClose,
  onSubmit
}: {
  gameTitle: string;
  tournamentName: string;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    elysiumNetId: string;
    avatarUrl: string | null;
    level: PlayerLevel;
    clubName: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [elysiumId, setElysiumId] = useState('');
  const [clubName, setClubName] = useState('');
  const [level, setLevel] = useState<PlayerLevel>('INTERMEDIATE');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !elysiumId.trim()) return;
    setErr('');
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        elysiumNetId: elysiumId.trim(),
        avatarUrl,
        level,
        clubName: clubName.trim()
      });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'فشل إرسال الطلب.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.15rem' }}>
              التسجيل في بطولة {gameTitle}
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{tournamentName}</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack-col">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PlayerAvatar avatarUrl={avatarUrl} name={name || 'P'} size={58} />
            <label className="btn btn-outline" style={{ cursor: 'pointer', flex: 1 }}>
              <ImagePlus size={18} />
              <span>{uploading ? 'جاري رفع الصورة...' : avatarUrl ? 'تغيير الصورة الشخصية' : 'رفع صورة اختيارية'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                disabled={uploading}
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="field-group">
            <label className="field-label">اسم اللاعب *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: أحمد بن علي"
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label">معرف اللاعب في ElysiumNet/ XeMoNat *</label>
            <input
              className="input"
              value={elysiumId}
              onChange={(e) => setElysiumId(e.target.value)}
              placeholder="معرف ElysiumNet/ XeMoNat"
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label">الفريق / الشخصية المفضلة (اختياري)</label>
            <input
              className="input"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              placeholder="نادي، منتخب، أو فئة اللعب"
            />
          </div>

          <div className="field-group">
            <label className="field-label">المستوى المبدئي (قابل للتعديل من المشرف)</label>
            <div className="chip-row">
              {(['BEGINNER', 'INTERMEDIATE', 'PRO', 'LEGEND'] as PlayerLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={`chip ${level === lvl ? 'selected' : ''}`}
                  onClick={() => setLevel(lvl)}
                >
                  {LEVEL_LABELS[lvl].label} ({LEVEL_LABELS[lvl].ovr})
                </button>
              ))}
            </div>
          </div>

          {err && (
            <div style={{ color: 'var(--crimson-loss)', fontSize: '0.84rem', fontWeight: 700 }}>{err}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={submitting || uploading || !name.trim() || !elysiumId.trim()}
            >
              {submitting ? 'جاري الإرسال...' : 'إرسال طلب التسجيل'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ScoreEntryModal({
  match,
  player1,
  player2,
  scoreUnitLabel,
  onClose,
  onSave
}: {
  match: Match;
  player1: Player;
  player2: Player;
  scoreUnitLabel: string;
  onClose: () => void;
  onSave: (payload: {
    leg1Score1: number | null;
    leg1Score2: number | null;
    leg2Score1: number | null;
    leg2Score2: number | null;
    penaltyScore1: number | null;
    penaltyScore2: number | null;
  }) => Promise<void>;
}) {
  const [l1s1, setL1s1] = useState(match.leg1Score1 != null ? String(match.leg1Score1) : '');
  const [l1s2, setL1s2] = useState(match.leg1Score2 != null ? String(match.leg1Score2) : '');
  const [l2s1, setL2s1] = useState(match.leg2Score1 != null ? String(match.leg2Score1) : '');
  const [l2s2, setL2s2] = useState(match.leg2Score2 != null ? String(match.leg2Score2) : '');
  const [p1, setP1] = useState(match.penaltyScore1 != null ? String(match.penaltyScore1) : '');
  const [p2, setP2] = useState(match.penaltyScore2 != null ? String(match.penaltyScore2) : '');
  const [saving, setSaving] = useState(false);

  const isKnockout = match.stage !== 'GROUP' && match.stage !== 'LEAGUE';
  const toInt = (v: string) => (v.trim() === '' ? null : Number(v));
  const s1i = toInt(l1s1);
  const s2i = toInt(l1s2);
  const l2s1i = toInt(l2s1);
  const l2s2i = toInt(l2s2);

  const isTiedForKnockout =
    isKnockout &&
    (match.isTwoLegged
      ? s1i != null && s2i != null && l2s1i != null && l2s2i != null && s1i + l2s1i === s2i + l2s2i
      : s1i != null && s2i != null && s1i === s2i);

  async function submitScores(clearAll = false) {
    setSaving(true);
    try {
      if (clearAll) {
        await onSave({
          leg1Score1: null,
          leg1Score2: null,
          leg2Score1: null,
          leg2Score2: null,
          penaltyScore1: null,
          penaltyScore2: null
        });
      } else {
        await onSave({
          leg1Score1: s1i,
          leg1Score2: s2i,
          leg2Score1: match.isTwoLegged ? l2s1i : null,
          leg2Score2: match.isTwoLegged ? l2s2i : null,
          penaltyScore1: isTiedForKnockout ? toInt(p1) : null,
          penaltyScore2: isTiedForKnockout ? toInt(p2) : null
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.1rem' }}>
              تسجيل / تعديل النتيجة ({scoreUnitLabel})
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {STAGE_LABELS[match.stage].label} • {player1.name} ضد {player2.name}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div className="field-group">
          <label className="field-label" style={{ color: 'var(--cyber-sky)' }}>
            {match.isTwoLegged ? 'مباراة الذهاب' : 'النتيجة النهائية'}
          </label>
          <div className="grid-2">
            <div>
              <div className="field-label" style={{ marginBottom: 4 }}>{player1.name}</div>
              <input className="input score-num" type="number" min={0} max={999} value={l1s1} onChange={(e) => setL1s1(e.target.value)} />
            </div>
            <div>
              <div className="field-label" style={{ marginBottom: 4 }}>{player2.name}</div>
              <input className="input score-num" type="number" min={0} max={999} value={l1s2} onChange={(e) => setL1s2(e.target.value)} />
            </div>
          </div>
        </div>

        {match.isTwoLegged && (
          <div className="field-group">
            <label className="field-label" style={{ color: 'var(--cyber-sky)' }}>مباراة الإياب</label>
            <div className="grid-2">
              <input className="input score-num" type="number" min={0} max={999} placeholder={player1.name} value={l2s1} onChange={(e) => setL2s1(e.target.value)} />
              <input className="input score-num" type="number" min={0} max={999} placeholder={player2.name} value={l2s2} onChange={(e) => setL2s2(e.target.value)} />
            </div>
          </div>
        )}

        {isTiedForKnockout && (
          <div className="field-group">
            <label className="field-label" style={{ color: 'var(--championship-gold)' }}>
              تعادل — نتيجة الحسم الإضافي / ركلات الترجيح
            </label>
            <div className="grid-2">
              <input className="input score-num" type="number" min={0} max={99} placeholder={`ترجيح ${player1.name}`} value={p1} onChange={(e) => setP1(e.target.value)} />
              <input className="input score-num" type="number" min={0} max={99} placeholder={`ترجيح ${player2.name}`} value={p2} onChange={(e) => setP2(e.target.value)} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={() => submitScores(false)}>
            {saving ? 'جاري الحفظ...' : 'حفظ النتيجة'}
          </button>
          {match.leg1Score1 != null && (
            <button type="button" className="btn btn-danger-outline" disabled={saving} onClick={() => submitScores(true)}>
              مسح
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export function MatchReminderModal({
  match,
  player1,
  player2,
  existing,
  onClose,
  onSave,
  onCancel
}: {
  match: Match;
  player1: Player | null;
  player2: Player | null;
  existing: MatchReminder | null;
  onClose: () => void;
  onSave: (payload: { matchId: number; matchTitle: string; scheduledAtMillis: number; leadMinutes: number }) => Promise<void>;
  onCancel: (matchId: number) => Promise<void>;
}) {
  const defaultDate = new Date(existing?.scheduledAtMillis ?? Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultLocal = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(defaultDate.getDate())}T${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}`;

  const [dateTimeLocal, setDateTimeLocal] = useState(defaultLocal);
  const [leadMinutes, setLeadMinutes] = useState(existing?.leadMinutes ?? 15);
  const [saving, setSaving] = useState(false);

  const matchTitle = `${player1?.name || 'اللاعب 1'} ضد ${player2?.name || 'اللاعب 2'}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const millis = new Date(dateTimeLocal).getTime();
    if (!Number.isFinite(millis)) return;
    setSaving(true);
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission().catch(() => undefined);
      }
      await onSave({ matchId: match.id, matchTitle, scheduledAtMillis: millis, leadMinutes });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellRing size={20} color="var(--championship-gold)" />
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.08rem' }}>
              جدولة موعد وتذكير المباراة
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--cyber-sky)', fontWeight: 700 }}>{matchTitle}</div>

        <form onSubmit={handleSubmit} className="stack-col">
          <div className="field-group">
            <label className="field-label">تاريخ ووقت المباراة</label>
            <input
              type="datetime-local"
              className="input"
              value={dateTimeLocal}
              onChange={(e) => setDateTimeLocal(e.target.value)}
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label">التذكير قبل الموعد بـ</label>
            <div className="chip-row">
              {[5, 10, 15, 30, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`chip ${leadMinutes === m ? 'selected' : ''}`}
                  onClick={() => setLeadMinutes(m)}
                >
                  {m} دقيقة
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ التذكير'}
            </button>
            {existing && (
              <button type="button" className="btn btn-danger-outline" onClick={() => onCancel(match.id)}>
                حذف
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export function ExportShareModal({
  tournamentId,
  onClose,
  onNotify
}: {
  tournamentId: number;
  onClose: () => void;
  onNotify: (msg: string) => void;
}) {
  const [data, setData] = useState<{ fileName: string; fullText: string; socialText: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/tournaments/${tournamentId}/export`)
      .then((r) => r.json())
      .then((res) => {
        if (active && res.ok) setData(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tournamentId]);

  function downloadTxt() {
    if (!data) return;
    const blob = new Blob([data.fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.fileName;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('تم تنزيل ملف ملخص النتائج بنجاح.');
  }

  async function shareSocial() {
    if (!data) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'نتائج CP4 ARENA', text: data.socialText });
        return;
      } catch {
        // user cancelled or unsupported
      }
    }
    await navigator.clipboard.writeText(data.socialText);
    onNotify('تم نسخ ملخص النتائج الجاهز للمشاركة!');
  }

  async function copyFull() {
    if (!data) return;
    await navigator.clipboard.writeText(data.fullText);
    onNotify('تم نسخ التقرير الكامل إلى الحافظة.');
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={20} color="var(--championship-gold)" />
            <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.1rem' }}>
              تصدير ومشاركة نتائج البطولة
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        {loading || !data ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
            جاري تجهيز التقرير الرسمي...
          </div>
        ) : (
          <>
            <textarea
              readOnly
              className="input"
              value={data.fullText}
              style={{ minHeight: 220, fontSize: '0.8rem', lineHeight: 1.5 }}
            />
            <div className="stack-col" style={{ gap: 8 }}>
              <button type="button" className="btn btn-primary" onClick={downloadTxt}>
                <Download size={18} />
                <span>تنزيل ملف نصي (.txt)</span>
              </button>
              <div className="grid-2">
                <button type="button" className="btn btn-gold" onClick={shareSocial}>
                  <Share2 size={17} />
                  <span>مشاركة سريعة</span>
                </button>
                <button type="button" className="btn btn-outline" onClick={copyFull}>
                  <Copy size={17} />
                  <span>نسخ التقرير</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function InstallPwaModal({
  canNativePrompt,
  onTriggerNativeInstall,
  onClose
}: {
  canNativePrompt: boolean;
  onTriggerNativeInstall: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel stack-col" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="/icons/icon-192.png"
              alt="CP4 ARENA"
              style={{ width: 42, height: 42, borderRadius: 10, border: '1px solid var(--championship-gold)' }}
            />
            <div>
              <h2 style={{ margin: 0, color: 'var(--championship-gold)', fontSize: '1.08rem' }}>
                تثبيت CP4 ARENA على الشاشة الرئيسية
              </h2>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                تشغيل سريع بملء الشاشة على iPhone وAndroid والكمبيوتر
              </div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        {canNativePrompt && (
          <button
            type="button"
            className="btn btn-gold"
            onClick={async () => {
              await onTriggerNativeInstall();
              onClose();
            }}
          >
            <Download size={18} />
            <span>تثبيت التطبيق الآن (Chrome / Android / Desktop)</span>
          </button>
        )}

        <div className="arena-subcard stack-col" style={{ gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--cyber-sky)', fontWeight: 700 }}>
            <Smartphone size={17} />
            <span>خطوات التثبيت على Safari (iPhone / iPad):</span>
          </div>
          <ol style={{ margin: 0, paddingInlineStart: 20, fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
            <li>افتح الموقع عبر متصفح <strong>Safari</strong>.</li>
            <li>اضغط على أيقونة <strong>المشاركة (Share)</strong> أسفل أو أعلى الشاشة.</li>
            <li>اختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.</li>
            <li>اضغط <strong>إضافة (Add)</strong> ليظهر التطبيق باسم وأيقونة <strong>CP4 ARENA</strong>.</li>
          </ol>
        </div>

        <button type="button" className="btn btn-outline" onClick={onClose}>
          حسناً
        </button>
      </div>
    </div>
  );
}
