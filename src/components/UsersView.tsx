import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  UserCheck,
  KeyRound,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Save,
  Activity,
  Check,
} from 'lucide-react';
import { User, AutoLogoutTimeout } from '../types.ts';
import { Language, translations } from '../i18n.ts';
import { api } from '../api.ts';

interface UsersViewProps {
  lang: Language;
  users: User[];
  currentUser: User | null;
  onRefreshUsers: () => void;
  onOpenChangePassword: (targetUserId?: string, targetUsername?: string) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({
  lang,
  users,
  currentUser,
  onRefreshUsers,
  onOpenChangePassword,
}) => {
  const t = translations[lang];
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-logout configuration state
  const [autoLogoutTimeout, setAutoLogoutTimeout] = useState<AutoLogoutTimeout>('30m');
  const [unlimitedDays, setUnlimitedDays] = useState<number>(7);
  const [autoLogoutSaving, setAutoLogoutSaving] = useState(false);
  const [autoLogoutMsg, setAutoLogoutMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      api.getAutoLogoutSettings()
        .then(res => {
          if (res.autoLogoutTimeout) setAutoLogoutTimeout(res.autoLogoutTimeout as AutoLogoutTimeout);
          if (res.unlimitedDays) setUnlimitedDays(res.unlimitedDays);
        })
        .catch(() => {});
    }
  }, [currentUser]);

  const handleSaveAutoLogout = async () => {
    setAutoLogoutSaving(true);
    setAutoLogoutMsg(null);
    try {
      const res = await api.updateAutoLogoutSettings(autoLogoutTimeout, unlimitedDays);
      setAutoLogoutTimeout(res.autoLogoutTimeout as AutoLogoutTimeout);
      setUnlimitedDays(res.unlimitedDays);
      setAutoLogoutMsg({
        type: 'success',
        text: lang === 'pl' ? 'Pomyślnie zaktualizowano czas automatycznego wylogowania.' : 'Auto-logout timeout updated successfully.',
      });
      setTimeout(() => setAutoLogoutMsg(null), 3500);
    } catch (err: any) {
      setAutoLogoutMsg({
        type: 'error',
        text: err.message || (lang === 'pl' ? 'Błąd podczas zapisywania limitu sesji' : 'Failed to update auto-logout timeout'),
      });
    } finally {
      setAutoLogoutSaving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 9) {
      setError(lang === 'pl' ? 'Hasło musi mieć co najmniej 9 znaków.' : 'Password must be at least 9 characters.');
      return;
    }

    setLoading(true);
    try {
      await api.createUser(newUsername, newPassword, newRole);
      setSuccess(t.users.createdSuccess);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      onRefreshUsers();
      setTimeout(() => {
        setShowCreateModal(false);
        setSuccess(null);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Błąd podczas tworzenia użytkownika');
    } finally {
      setLoading(false);
    }
  };

  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await api.deleteUser(userToDelete.id);
      setUserToDelete(null);
      onRefreshUsers();
    } catch (err: any) {
      setDeleteError(err.message || (lang === 'pl' ? 'Błąd usuwania użytkownika' : 'Failed to delete user'));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>{t.users.title}</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t.users.subtitle}
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-sm shadow-blue-500/20"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t.users.createBtn}</span>
        </button>
      </div>

      {/* Konfiguracja Auto-wylogowania sesji (Zarządzanie użytkownikami) */}
      {currentUser?.role === 'admin' && (
        <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <span>{lang === 'pl' ? 'Automatyczne wylogowanie sesji' : 'Session Auto-Logout'}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                    {autoLogoutTimeout === 'unlimited'
                      ? `${unlimitedDays} ${lang === 'pl' ? 'dni' : 'days'}`
                      : autoLogoutTimeout}
                  </span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {lang === 'pl'
                    ? 'Czas bezczynności, po którym użytkownik zostaje automatycznie wylogowany dla bezpieczeństwa.'
                    : 'Duration of inactivity after which users are automatically logged out for security.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {autoLogoutMsg && (
                <span
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 ${
                    autoLogoutMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                  }`}
                >
                  {autoLogoutMsg.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  <span>{autoLogoutMsg.text}</span>
                </span>
              )}

              <button
                type="button"
                onClick={handleSaveAutoLogout}
                disabled={autoLogoutSaving}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{autoLogoutSaving ? (lang === 'pl' ? 'Zapisywanie...' : 'Saving...') : (lang === 'pl' ? 'Zapisz' : 'Save')}</span>
              </button>
            </div>
          </div>

          {/* Opcje wyboru czasu: 30m, 1h, 3h, unlimited */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { id: '30m', label: '30 min', desc: lang === 'pl' ? 'Domyślny bezpieczny limit' : 'Default secure limit' },
              { id: '1h', label: '1 godzina (1h)', desc: lang === 'pl' ? 'Standardowa sesja robocza' : 'Standard work session' },
              { id: '3h', label: '3 godziny (3h)', desc: lang === 'pl' ? 'Dłuższa sesja bez przerw' : 'Extended work session' },
              {
                id: 'unlimited',
                label: lang === 'pl' ? 'Unlimited / Stała' : 'Unlimited / Persistent',
                desc: lang === 'pl' ? `Domyślnie 7 dni (1 do 28 dni)` : `Default 7 days (1 to 28 days)`,
              },
            ].map(opt => {
              const isSelected = autoLogoutTimeout === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAutoLogoutTimeout(opt.id as AutoLogoutTimeout)}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-all text-xs ${
                    isSelected
                      ? 'border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 shadow-xs'
                      : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold text-neutral-900 dark:text-white text-xs">{opt.label}</span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-neutral-300 dark:border-neutral-600'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{opt.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Konfigurator dni dla opcji Unlimited (od 1 do 28 dni) */}
          {autoLogoutTimeout === 'unlimited' && (
            <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-neutral-900 dark:text-white">
                    {lang === 'pl' ? 'Czas trwania sesji w trybie Unlimited:' : 'Session duration in Unlimited mode:'}
                  </span>
                  <span className="ml-2 font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                    {unlimitedDays} {lang === 'pl' ? 'dni' : 'days'}
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block sm:inline sm:ml-2">
                    ({lang === 'pl' ? 'Wybierz od 1 do 28 dni, domyślnie 7' : 'Select from 1 to 28 days, default 7'})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {[1, 7, 14, 28].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setUnlimitedDays(d)}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                        unlimitedDays === d
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-blue-400'
                      }`}
                    >
                      {d} {lang === 'pl' ? 'dni' : 'd'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <span className="text-[11px] font-semibold text-neutral-500">1 {lang === 'pl' ? 'dzień' : 'day'}</span>
                <input
                  type="range"
                  min="1"
                  max="28"
                  step="1"
                  value={unlimitedDays}
                  onChange={e => setUnlimitedDays(Number(e.target.value))}
                  className="flex-1 accent-blue-600 cursor-pointer"
                />
                <span className="text-[11px] font-semibold text-neutral-500">28 {lang === 'pl' ? 'dni' : 'days'}</span>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={unlimitedDays}
                  onChange={e => setUnlimitedDays(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-16 px-2 py-1 text-center font-mono text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Wyjaśnienie mechanizmu odnawiania sesji */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-300">
            <Activity className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <div className="space-y-0.5">
              <span className="font-bold text-neutral-800 dark:text-neutral-200 block">
                {lang === 'pl' ? 'Automatyczne odnawianie sesji przy aktywności użytkownika' : 'Automatic Session Renewal Upon Activity'}
              </span>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {lang === 'pl'
                  ? 'Sesja użytkownika automatycznie przedłuża się przy każdym kliknięciu, pisaniu, przewijaniu lub wysłaniu żądania API. Czas bezczynności jest liczony dopiero od momentu ostatniej wykonanej akcji.'
                  : 'User session automatically extends with every click, keystroke, scroll, or API request. The inactivity countdown only starts from the moment of the last performed action.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Users List - One under another */}
      <div className="space-y-3">
        {users.map(u => {
          const isSelf = currentUser?.id === u.id;
          return (
            <div
              key={u.id}
              className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
            >
              {/* User details */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    u.role === 'admin'
                      ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400'
                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {u.role === 'admin' ? <Shield className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                      {u.username}
                    </h3>
                    {isSelf && (
                      <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        {lang === 'pl' ? 'Ty' : 'You'}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                        u.role === 'admin'
                          ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {u.role === 'admin' ? t.users.roleAdmin : t.users.roleUser}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 mt-1">
                    <span>Utworzono: {new Date(u.createdAt).toLocaleDateString()}</span>
                    <span className="hidden md:inline text-neutral-300 dark:text-neutral-700">•</span>
                    <span className="hidden md:inline">
                      {u.role === 'admin'
                        ? 'Pełne uprawnienia (konfiguracja, zadania, użytkownicy)'
                        : 'Uprawnienia operatora (uruchamianie zadań, restore, monitorowanie)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-neutral-800 shrink-0">
                <button
                  onClick={() => onOpenChangePassword(u.id, u.username)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 font-medium transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Zmień hasło</span>
                </button>

                {!isSelf && (
                  <button
                    onClick={() => {
                      setDeleteError(null);
                      setUserToDelete(u);
                    }}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title={lang === 'pl' ? 'Usuń użytkownika' : 'Delete user'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-4">
              {t.users.createTitle}
            </h3>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                  {t.users.usernameLabel}
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="np. operator"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                  {t.users.passwordLabel}
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1">
                  {t.users.roleLabel}
                </label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="user">{t.users.roleUser} (Tylko zadania & monitor)</option>
                  <option value="admin">{t.users.roleAdmin} (Pełny dostęp)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? t.common.loading : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {lang === 'pl' ? 'Usunąć użytkownika?' : 'Delete User?'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {lang === 'pl' ? 'Tej operacji nie można cofnąć.' : 'This action cannot be undone.'}
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  {lang === 'pl' ? 'Użytkownik:' : 'Username:'}
                </span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">
                  {userToDelete.username}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                  {userToDelete.role}
                </span>
              </div>
              <p className="text-neutral-500 text-[11px]">
                {lang === 'pl'
                  ? 'Konto zostanie bezpowrotnie usunięte. Użytkownik natychmiast utraci dostęp do SyncVault.'
                  : 'Account will be permanently deleted. User will immediately lose access to SyncVault.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteLoading ? (lang === 'pl' ? 'Usuwanie...' : 'Deleting...') : (lang === 'pl' ? 'Usuń użytkownika' : 'Delete User')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
