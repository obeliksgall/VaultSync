import React, { useState } from 'react';
import { ShieldCheck, Lock, UserCheck, AlertCircle } from 'lucide-react';
import { api, setAuthToken } from '../api.ts';
import { User } from '../types.ts';
import { Language, translations } from '../i18n.ts';

interface AdminSetupProps {
  lang: Language;
  onSetupSuccess: (user: User) => void;
}

export const AdminSetup: React.FC<AdminSetupProps> = ({ lang, onSetupSuccess }) => {
  const t = translations[lang];
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError(lang === 'pl' ? 'Hasła nie są identyczne.' : 'Passwords do not match.');
      return;
    }

    if (password.length < 9) {
      setError(lang === 'pl' ? 'Hasło musi mieć co najmniej 9 znaków.' : 'Password must be at least 9 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.setupAdmin(username, password);
      setAuthToken(res.token);
      onSetupSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas tworzenia konta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl p-8 border border-neutral-200 dark:border-neutral-800 shadow-xl shadow-neutral-200/50 dark:shadow-none">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mb-4 border border-blue-100 dark:border-blue-900/50">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {t.firstRun.title}
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            {t.firstRun.subtitle}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
              {t.firstRun.username}
            </label>
            <div className="relative">
              <input
                id="setup-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t.firstRun.usernamePlaceholder}
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <UserCheck className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
              {t.firstRun.password}
            </label>
            <div className="relative">
              <input
                id="setup-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
              {t.firstRun.passwordConfirm}
            </label>
            <div className="relative">
              <input
                id="setup-password-confirm"
                type="password"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
            </div>
          </div>

          <button
            id="setup-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? t.common.loading : t.firstRun.submit}
          </button>
        </form>
      </div>
    </div>
  );
};
