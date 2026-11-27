import { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Eye, Gamepad2, Swords, X, XCircle } from 'lucide-react';
import { EmptyStatePanel, PlayerAvatar } from '../components/PlayerAvatar';
import type { FriendlyMatch, FriendlyMatchStatus } from '../types';

export function AdminFriendlyMatchesTab({
  friendlyMatches,
  onReviewFriendlyMatch
}: {
  friendlyMatches: FriendlyMatch[];
  onReviewFriendlyMatch: (
    matchId: number,
    payload: { action: 'APPROVE' | 'REJECT'; reviewNote?: string; score1?: number; score2?: number }
  ) => Promise<void>;
}) {
  const [filter, setFilter] = useState<'ALL' | FriendlyMatchStatus>('PENDING');
  const [scoreEdits, setScoreEdits] = useState<Record<number, { score1: string; score2: string }>>({});
  const [notesById, setNotesById] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorById, setErrorById] = useState<Record<number, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const fm of friendlyMatches) {
      if (fm.status === 'PENDING') pending += 1;
      else if (fm.status === 'APPROVED') approved += 1;
      else if (fm.status === 'REJECTED') rejected += 1;
    }
    return { pending, approved, rejected, all: friendlyMatches.length };
  }, [friendlyMatches]);

  const visibleMatches = useMemo(() => {
    if (filter === 'ALL') return friendlyMatches;
    return friendlyMatches.filter((fm) => fm.status === filter);
  }, [friendlyMatches, filter]);

  async function handleAction(fm: FriendlyMatch, action: 'APPROVE' | 'REJECT') {
    const note = (notesById[fm.id] ?? '').trim();
    const edit = scoreEdits[fm.id];
    const nextScore1 = edit ? Number(edit.score1) : fm.score1;
    const nextScore2 = edit ? Number(edit.score2) : fm.score2;

    if (action === 'REJECT' && !note) {
      setErrorById((prev) => ({ ...prev, [fm.id]: 'يرجى كتابة سبب الرفض أولاً.' }));
      return;
    }
    if (
      !Number.isInteger(nextScore1) ||
      !Number.isInteger(nextScore2) ||
      nextScore1 < 0 ||
      nextScore2 < 0 ||
      nextScore1 > 99 ||
      nextScore2 > 99
    ) {
      setErrorById((prev) => ({ ...prev, [fm.id]: 'النتيجة المدخلة غير صالحة.' }));
      return;
    }

    setErrorById((prev) => ({ ...prev, [fm.id]: '' }));
    setBusyId(fm.id);
    try {
      await onReviewFriendlyMatch(fm.id, {
        action,
        reviewNote: note || undefined,
        score1: nextScore1,
        score2: nextScore2
      });
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [fm.id]: err instanceof Error ? err.message : 'تعذر تنفيذ المراجعة.'
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stack-col" data-testid="admin_friendly_matches_tab">
      <div className="arena-card stack-col" style={{ gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--championship-gold)', fontWeight: 800 }}>
            <Swords size={18} />
            <span>مراجعة طلبات المواجهات الودية (خارج البطولات)</span>
          </div>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            تُحتسب في الإحصائيات وقسم «ضحاياك» فقط بعد الاعتماد
          </span>
        </div>

        <div className="chip-row">
          <button
            type="button"
            className={`chip ${filter === 'PENDING' ? 'selected' : ''}`}
            onClick={() => setFilter('PENDING')}
          >
            قيد المراجعة ({counts.pending})
          </button>
          <button
            type="button"
            className={`chip ${filter === 'APPROVED' ? 'selected' : ''}`}
            onClick={() => setFilter('APPROVED')}
          >
            معتمدة ({counts.approved})
          </button>
          <button
            type="button"
            className={`chip ${filter === 'REJECTED' ? 'selected' : ''}`}
            onClick={() => setFilter('REJECTED')}
          >
            مرفوضة ({counts.rejected})
          </button>
          <button
            type="button"
            className={`chip ${filter === 'ALL' ? 'selected' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            الكل ({counts.all})
          </button>
        </div>
      </div>

      {visibleMatches.length === 0 ? (
        <EmptyStatePanel
          icon={<Swords size={28} />}
          title="لا توجد طلبات في هذا القسم"
          subtitle={
            filter === 'PENDING'
              ? 'جميع طلبات المواجهات الودية تمت مراجعتها.'
              : 'ستظهر المواجهات الودية هنا فور إرسالها من اللاعبين.'
          }
        />
      ) : (
        <div className="stack-col" style={{ gap: 10 }}>
          {visibleMatches.map((fm) => {
            const edit = scoreEdits[fm.id] ?? { score1: String(fm.score1), score2: String(fm.score2) };
            const noteValue = notesById[fm.id] ?? fm.reviewNote ?? '';
            const statusColor =
              fm.status === 'APPROVED'
                ? 'var(--emerald-win)'
                : fm.status === 'REJECTED'
                ? 'var(--crimson-loss)'
                : 'var(--championship-gold)';
            const statusText =
              fm.status === 'APPROVED' ? 'معتمدة' : fm.status === 'REJECTED' ? 'مرفوضة' : 'قيد المراجعة';

            return (
              <div
                key={fm.id}
                className="arena-card stack-col"
                style={{ gap: 10, borderColor: fm.status === 'PENDING' ? 'rgba(245, 184, 46, 0.5)' : undefined }}
                data-testid={`friendly_review_card_${fm.id}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 9px',
                        borderRadius: 999,
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        background: 'rgba(56, 189, 248, 0.14)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: 'var(--cyber-sky)'
                      }}
                    >
                      <Gamepad2 size={13} />
                      <span>{fm.gameTitle}</span>
                    </span>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} />
                      {fm.matchDate}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: statusColor }}>{statusText}</span>
                </div>

                <div
                  className="arena-subcard"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <PlayerAvatar avatarUrl={fm.player1AvatarUrl} name={fm.player1Name} size={34} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{fm.player1Name}</div>
                      <div className="score-num" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {fm.player1Cp4Id}
                      </div>
                    </div>
                  </div>

                  <div className="score-num" style={{ fontSize: '1.2rem', color: 'var(--championship-gold)' }}>
                    {fm.score1} : {fm.score2}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{fm.player2Name}</div>
                      <div className="score-num" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {fm.player2Cp4Id}
                      </div>
                    </div>
                    <PlayerAvatar avatarUrl={fm.player2AvatarUrl} name={fm.player2Name} size={34} />
                  </div>
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <span>مُرسل الطلب: {fm.submittedByName}</span>
                  {fm.reviewedBy && (
                    <span>
                      المراجع: {fm.reviewedBy}
                      {fm.reviewNote ? ` • ${fm.reviewNote}` : ''}
                    </span>
                  )}
                </div>

                {fm.proofImageUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <img
                      src={fm.proofImageUrl}
                      alt="صورة إثبات المواجهة"
                      style={{
                        width: 110,
                        height: 68,
                        objectFit: 'cover',
                        borderRadius: 10,
                        border: '1px solid var(--card-border)',
                        cursor: 'pointer'
                      }}
                      onClick={() => setPreviewUrl(fm.proofImageUrl)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: '5px 10px', fontSize: '0.76rem', minHeight: 34 }}
                      onClick={() => setPreviewUrl(fm.proofImageUrl)}
                    >
                      <Eye size={14} />
                      <span>عرض صورة الإثبات</span>
                    </button>
                  </div>
                )}

                <div className="grid-2">
                  <div className="field-group">
                    <label className="field-label">تعديل نتيجة {fm.player1Name}</label>
                    <input
                      className="input score-num"
                      type="number"
                      min={0}
                      max={99}
                      value={edit.score1}
                      onChange={(e) =>
                        setScoreEdits((prev) => ({
                          ...prev,
                          [fm.id]: { ...edit, score1: e.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">تعديل نتيجة {fm.player2Name}</label>
                    <input
                      className="input score-num"
                      type="number"
                      min={0}
                      max={99}
                      value={edit.score2}
                      onChange={(e) =>
                        setScoreEdits((prev) => ({
                          ...prev,
                          [fm.id]: { ...edit, score2: e.target.value }
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">سبب الرفض أو ملاحظة التعديل</label>
                  <input
                    className="input"
                    value={noteValue}
                    onChange={(e) => setNotesById((prev) => ({ ...prev, [fm.id]: e.target.value }))}
                    placeholder="اكتب السبب عند الرفض أو ملاحظة مراجعة النتيجة..."
                    data-testid={`friendly_review_note_${fm.id}`}
                  />
                </div>

                {errorById[fm.id] && (
                  <div style={{ color: 'var(--crimson-loss)', fontSize: '0.78rem', fontWeight: 700 }}>
                    {errorById[fm.id]}
                  </div>
                )}

                <div className="grid-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === fm.id}
                    onClick={() => handleAction(fm, 'APPROVE')}
                    data-testid={`friendly_approve_btn_${fm.id}`}
                  >
                    <CheckCircle2 size={16} />
                    <span>{busyId === fm.id ? 'جاري التنفيذ...' : 'اعتماد النتيجة'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-outline"
                    disabled={busyId === fm.id}
                    onClick={() => handleAction(fm, 'REJECT')}
                    data-testid={`friendly_reject_btn_${fm.id}`}
                  >
                    <XCircle size={16} />
                    <span>رفض مع السبب</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {previewUrl && (
        <div className="modal-backdrop" onClick={() => setPreviewUrl(null)}>
          <div
            className="modal-panel stack-col"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 720, padding: 14 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, color: 'var(--championship-gold)' }}>صورة إثبات المواجهة الودية</span>
              <button type="button" className="icon-btn" onClick={() => setPreviewUrl(null)} aria-label="إغلاق">
                <X size={18} />
              </button>
            </div>
            <img
              src={previewUrl}
              alt="إثبات المواجهة"
              style={{ width: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: 12 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
