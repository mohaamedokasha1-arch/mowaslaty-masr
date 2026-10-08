'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiPost, getToken, saveSession } from '@/lib/api';

interface LoginResponse {
  token: string;
  user: { id: string; email: string; name?: string; role: string };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace('/');
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await apiPost<LoginResponse>('/api/admin/auth/login', { email, password });
      saveSession(res.token, res.user);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: '2.6rem' }}>🚌</div>
          <h1 style={{ fontSize: '1.3rem' }}>لوحة تحكم مواصلاتي مصر</h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
            سجّل الدخول بحساب إداري للمتابعة
          </p>
        </div>

        <div className="field">
          <label>البريد الإلكتروني</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@mowaslaty.com"
            required
            dir="ltr"
          />
        </div>

        <div className="field">
          <label>كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            dir="ltr"
          />
        </div>

        {error && <div className="notice notice-error">{error}</div>}

        <button className="btn btn-brand" style={{ width: '100%', padding: 12 }} disabled={submitting}>
          {submitting ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
        </button>

        <p style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', marginTop: 16, textAlign: 'center' }}>
          للتطوير المحلي: admin@mowaslaty.com / admin123
        </p>
      </form>
    </div>
  );
}
