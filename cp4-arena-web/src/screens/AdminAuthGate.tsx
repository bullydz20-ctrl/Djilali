import { useEffect, useState } from 'react';
import { AlertTriangle, Lock, LockKeyholeOpen, Shield, ShieldCheck, User } from 'lucide-react';
import { getHeadAutoBackupSummary, getLastAdminUsername, getStoredKeepSignedIn } from '../api';
import { evaluatePinStrengthClient } from '../types';
import type { AdminDirectoryEntry, LockoutState, PersistenceInfo } from '../types';

export function AdminAuthGate({
  hasHeadAdmin,
  adminDirectory,
  lockoutState,
  persistence,
  onSetupHead,
  onLogin
}: {
  hasHeadAdmin: boolean;
  adminDirectory: AdminDirectoryEntry[];
  lockoutState: LockoutState;
  persistence?: PersistenceInfo;
  onSetupHead: (payload: { username: string; displayName: string; pin: string; keepSignedIn: boolean }) => Promise<void>;
  onLogin: (payload: { username: string; pin: string; keepSignedIn: boolean }) => Promise<void>;
}) {
  const [nowMillis, setNowMillis] = useState(() => Date.now());
  const isLocked = lockoutState.lockedUntilMillis > nowMillis;
  const remainingSec = Math.max(0, Math.ceil((lockoutState.lockedUntilMillis - nowMillis) / 1000));

  useEffect(() => {
    if (lockoutState.lockedUntilMillis <= Date.now()) return;
    const id = setInterval(() => {
      setNowMillis(Date.now());
    }, 500);
    return () => clearInterval(id);
  }, [lockoutState.lockedUntilMillis]);

  const [setupUser, setSetupUser] = useState('Djilali');
  const [setupDisplay, setSetupDisplay] = useState('Djilali');
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');

  const [loginUser, setLoginUser] = useState(() => {
    const savedUser = getLastAdminUsername();
    if (savedUser && adminDirectory.some((a) => a.username.toLowerCase() === savedUser.toLowerCase())) {
      return savedUser;
    }
    return adminDirectory.find((a) => a.isActive)?.username || adminDirectory[0]?.username || savedUser || 'Djilali';
  });
  const [loginPin, setLoginPin] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(() => getStoredKeepSignedIn());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (adminDirectory.length > 0 && !adminDirectory.some((a) => a.username.toLowerCase() === loginUser.toLowerCase())) {
      const savedUser = getLastAdminUsername();
      const matchedSaved = savedUser
        ? adminDirectory.find((a) => a.username.toLowerCase() === savedUser.toLowerCase())?.username
        : undefined;
      setLoginUser(matchedSaved || adminDirectory.find((a) => a.isActive)?.username || adminDirectory[0].username);
    }
  }, [adminDirectory, loginUser]);

  const strength = evaluatePinStrengthClient(setupPin);
  const localAutoBackup = !hasHeadAdmin ? getHeadAutoBackupSummary() : null;
  const isEphemeralServer = persistence?.mode === 'ephemeral';

  async function handleSetupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSetupHead({
        username: setupUser.trim(),
        displayName: setupDisplay.trim() || setupUser.trim(),
        pin: setupPin,
        keepSignedIn
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء الحساب.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onLogin({ username: loginUser.trim(), pin: loginPin, keepSignedIn });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بيانات الدخول غير صحيحة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
      <div className="arena-card stack-col" style={{ width: '100%', maxWidth: 480, padding: 22 }}>
        <div style={{ textAlign: 'center' }}>
          <ShieldCheck size={44} color="var(--championship-gold)" style={{ margin: '0 auto 8px' }} />
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 999,
              background: 'var(--elevated-navy)',
              border: '1px solid rgba(37,99,235,0.55)',
              fontSize: '0.73rem',
              color: 'var(--cyber-sky)',
              fontWeight: 700
            }}
          >
            <span>تشفير خادمي PBKDF2-SHA256 • حماية الجلسة</span>
          </div>
        </div>

        {!hasHeadAdmin ? (
          <form onSubmit={handleSetupSubmit} className="stack-col">
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ margin: '4px 0', fontSize: '1.15rem' }}>إعداد حساب المشرف الرئيسي</h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                أنشئ رمز PIN مكوناً من 6 أرقام لتأمين لوحة إدارة CP4 ARENA على الخادم، وبعدها يمكنك إضافة حتى 5 مشرفين مساعدين.
              </p>
            </div>

            {isEphemeralServer && (
              <div
                className="arena-subcard stack-col"
                style={{
                  gap: 6,
                  borderColor: 'rgba(245, 158, 11, 0.7)',
                  background: 'rgba(245, 158, 11, 0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--championship-gold)', fontWeight: 800, fontSize: '0.82rem' }}>
                  <AlertTriangle size={16} />
                  <span>لماذا ظهرت هذه الخانة بعد سكون الموقع؟</span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  الخادم يعمل حالياً على قرص مؤقت بدون <code dir="ltr">DATABASE_URL</code>؛ في باقة Render المجانية تُمسح قاعدة البيانات المحلية عند كل سكون. أضف <code dir="ltr">DATABASE_URL</code> (PostgreSQL مجاني) + <code dir="ltr">JWT_SECRET</code> في Render لمنع ظهور هذه الخانة نهائياً.
                </div>
                {localAutoBackup && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--emerald-win)', fontWeight: 700 }}>
                    ✓ توجد نسخة محفوظة في متصفحك ({localAutoBackup.tournamentsCount} بطولة • {localAutoBackup.playersCount} لاعب • {localAutoBackup.subAdminsCount} مساعد)؛ سجّل الدخول الآن لاستعادتها بنقرة واحدة.
                  </div>
                )}
              </div>
            )}

            <div className="field-group">
              <label className="field-label">اسم المستخدم للدخول *</label>
              <input className="input" value={setupUser} onChange={(e) => setSetupUser(e.target.value)} minLength={3} required />
            </div>

            <div className="field-group">
              <label className="field-label">الاسم الظاهر *</label>
              <input className="input" value={setupDisplay} onChange={(e) => setSetupDisplay(e.target.value)} required />
            </div>

            <div className="field-group">
              <label className="field-label">رمز PIN المكون من 6 أرقام *</label>
              <input
                className="input score-num"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={setupPin}
                onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                required
              />
              {setupPin && (
                <div style={{ fontSize: '0.76rem', color: strength.code === 'STRONG' ? 'var(--emerald-win)' : 'var(--cyber-sky)' }}>
                  حالة أمان الرمز: {strength.label}
                </div>
              )}
            </div>

            <div className="field-group">
              <label className="field-label">تأكيد رمز PIN *</label>
              <input
                className="input score-num"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                required
              />
            </div>

            <div
              className="arena-subcard"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
            >
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>حفظ حساب المشرف وتسجيل الدخول تلقائياً</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {keepSignedIn ? 'تبقى الجلسة محفوظة تلقائياً عند إعادة فتح الموقع' : 'جلسة مؤقتة تُغلق عند إغلاق المتصفح'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={keepSignedIn}
                className={`switch-pill ${keepSignedIn ? 'on' : ''}`}
                onClick={() => setKeepSignedIn((v) => !v)}
              >
                <span className="switch-knob" />
              </button>
            </div>

            {error && <div style={{ color: 'var(--crimson-loss)', fontSize: '0.84rem', fontWeight: 700 }}>{error}</div>}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || setupUser.trim().length < 3 || !/^\d{6}$/.test(setupPin) || setupPin !== setupConfirm}
            >
              <LockKeyholeOpen size={18} />
              <span>{busy ? 'جاري التشفير والحفظ...' : 'اعتماد المشرف الرئيسي والدخول'}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleLoginSubmit} className="stack-col">
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ margin: '4px 0', fontSize: '1.15rem' }}>تسجيل دخول المشرف والمساعدين</h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                اختر حسابك وأدخل رمز PIN المكون من 6 أرقام لفتح لوحة التحكم.
              </p>
            </div>

            {isLocked && (
              <div
                className="arena-subcard"
                style={{
                  borderColor: 'var(--crimson-loss)',
                  background: 'rgba(239,68,68,0.14)',
                  color: 'var(--crimson-loss)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.84rem',
                  fontWeight: 700
                }}
              >
                <Lock size={17} />
                <span>تم قفل الدخول مؤقتاً للحماية من التخمين. المتبقي: {remainingSec} ثانية</span>
              </div>
            )}

            {!isLocked && lockoutState.failedAttempts > 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--amber-draw)', fontWeight: 700 }}>
                تنبيه أمان: متبقي {Math.max(1, 5 - lockoutState.failedAttempts)} محاولات قبل القفل المؤقت
              </div>
            )}

            {adminDirectory.length > 0 && (
              <div className="field-group">
                <label className="field-label" style={{ color: 'var(--cyber-sky)' }}>
                  اختر الحساب ({adminDirectory.length}):
                </label>
                <div className="chip-row">
                  {adminDirectory.map((acc) => {
                    const isHead = acc.role === 'HEAD_ADMIN';
                    const selected = acc.username.toLowerCase() === loginUser.toLowerCase();
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        className={`chip ${selected ? (isHead ? 'selected-gold' : 'selected') : ''}`}
                        onClick={() => setLoginUser(acc.username)}
                      >
                        {isHead ? <Shield size={14} /> : <User size={14} />}
                        <span>
                          {acc.displayName} ({isHead ? 'رئيسي' : 'مساعد'})
                          {!acc.isActive ? ' [موقوف]' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="field-group">
              <label className="field-label">اسم المستخدم</label>
              <input
                className="input"
                value={loginUser}
                disabled={isLocked}
                onChange={(e) => setLoginUser(e.target.value)}
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label">رمز PIN (6 أرقام)</label>
              <input
                className="input score-num"
                type="password"
                inputMode="numeric"
                maxLength={6}
                disabled={isLocked}
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                required
              />
            </div>

            <div
              className="arena-subcard"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
            >
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>حفظ حساب المشرف وتسجيل الدخول تلقائياً</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {keepSignedIn ? 'جلسة محفوظة تلقائياً حتى بعد إعادة فتح المتصفح أو الخادم' : 'جلسة مؤقتة تُغلق عند إغلاق المتصفح'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={keepSignedIn}
                className={`switch-pill ${keepSignedIn ? 'on' : ''}`}
                onClick={() => setKeepSignedIn((v) => !v)}
              >
                <span className="switch-knob" />
              </button>
            </div>

            {error && <div style={{ color: 'var(--crimson-loss)', fontSize: '0.84rem', fontWeight: 700 }}>{error}</div>}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || isLocked || !loginUser.trim() || !/^\d{6}$/.test(loginPin)}
            >
              <LockKeyholeOpen size={18} />
              <span>{busy ? 'جاري التحقق...' : 'دخول إلى لوحة التحكم'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
