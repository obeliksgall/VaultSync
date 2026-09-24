import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  FileCode,
  Upload,
  Save,
  Check,
  AlertCircle,
  HardDrive,
  RefreshCw,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Language, translations } from '../i18n.ts';
import { api } from '../api.ts';
import { User } from '../types.ts';

interface RcloneConfigViewProps {
  lang: Language;
  currentUser?: User | null;
}

export const RcloneConfigView: React.FC<RcloneConfigViewProps> = ({ lang, currentUser }) => {
  const t = translations[lang];
  const [configContent, setConfigContent] = useState<string>('');
  const [remotes, setRemotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password-lock protection state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const loadConfig = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await api.getRcloneConfig();
      setConfigContent(data.content || '');
      setRemotes(data.remotes || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || (lang === 'pl' ? 'Błąd ładowania pliku rclone.conf' : 'Failed to load rclone.conf') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setUnlockError(lang === 'pl' ? 'Wprowadź hasło konta.' : 'Please enter your account password.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setUnlocking(true);
    setUnlockError(null);
    try {
      await api.verifyPassword(password);
      setIsUnlocked(true);
      setPassword('');
      setUnlockError(null);
      setMessage({
        type: 'success',
        text: lang === 'pl' ? 'Hasło poprawne. Edytor został odblokowany.' : 'Password verified. Editor has been unlocked.',
      });
      setTimeout(() => setMessage(null), 3500);
    } catch (err: any) {
      setUnlockError(err.message || t.rclone.invalidPassword);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      passwordInputRef.current?.focus();
    } finally {
      setUnlocking(false);
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setPassword('');
    setUnlockError(null);
    setMessage({
      type: 'success',
      text: lang === 'pl' ? 'Edytor został ponownie zablokowany.' : 'Editor has been locked.',
    });
    setTimeout(() => setMessage(null), 2500);
  };

  const handleSave = async () => {
    if (!isUnlocked) {
      setUnlockError(lang === 'pl' ? 'Odblokuj edytor hasłem przed zapisaniem zmian.' : 'Unlock editor with password before saving.');
      passwordInputRef.current?.focus();
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await api.saveRcloneConfig(configContent);
      setRemotes(res.remotes || []);
      setMessage({ type: 'success', text: t.rclone.savedSuccess });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || (lang === 'pl' ? 'Błąd zapisu pliku konfiguracyjnego' : 'Failed to save configuration file') });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isUnlocked) {
      setUnlockError(lang === 'pl' ? 'Wprowadź hasło, aby odblokować importowanie pliku.' : 'Enter password to unlock file import.');
      passwordInputRef.current?.focus();
      e.target.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const content = event.target?.result as string;
      if (content !== undefined) {
        setConfigContent(content);
        setMessage({
          type: 'success',
          text: lang === 'pl' ? 'Wczytano plik konfiguracyjny. Kliknij "Zapisz zmiany", aby zapisać.' : 'Configuration file loaded. Click "Save Changes" to apply.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
              <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>{t.rclone.title}</span>
            </h2>
            {isUnlocked ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t.rclone.unlockedBadge}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Lock className="w-3.5 h-3.5" />
                <span>{lang === 'pl' ? 'Zablokowany hasłem' : 'Password Protected'}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t.rclone.subtitle} ({lang === 'pl' ? 'Ścieżka' : 'Path'}: <code className="font-mono text-neutral-600 dark:text-neutral-400">/root/.config/rclone/rclone.conf</code>)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* File Upload / Import */}
          <label
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors shadow-sm ${
              isUnlocked
                ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
            title={!isUnlocked ? t.rclone.lockedNotice : undefined}
          >
            <Upload className="w-4 h-4 text-blue-500" />
            <span>{t.rclone.importBtn}</span>
            <input
              type="file"
              accept=".conf,.txt,*"
              disabled={!isUnlocked}
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Refresh */}
          <button
            onClick={loadConfig}
            disabled={loading}
            className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
            title={lang === 'pl' ? 'Odśwież konfigurację z dysku' : 'Refresh configuration from disk'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || loading || !isUnlocked}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold transition-colors shadow-sm ${
              isUnlocked
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                : 'bg-neutral-400 dark:bg-neutral-700 cursor-not-allowed opacity-60'
            }`}
            title={!isUnlocked ? (lang === 'pl' ? 'Wprowadź hasło, aby odblokować zapis' : 'Enter password to unlock saving') : undefined}
          >
            <Save className="w-4 h-4" />
            <span>{saving ? t.common.loading : t.rclone.saveBtn}</span>
          </button>

          {/* Re-lock Button if Unlocked */}
          {isUnlocked && (
            <button
              onClick={handleLock}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-neutral-600 dark:text-neutral-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium transition-colors shadow-sm"
              title={t.rclone.lockBtn}
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.rclone.lockBtn}</span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300'
          }`}
        >
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Detected Remotes Chips */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 flex items-center gap-2">
          <span>{t.rclone.detectedRemotes}</span>
          {remotes.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              {remotes.length}
            </span>
          )}
        </h3>
        {remotes.length === 0 ? (
          <p className="text-xs text-neutral-400 italic">
            {t.rclone.noRemotesHelp}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {remotes.map(rem => (
              <span
                key={rem}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 shadow-sm"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>{rem}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Direct Editor with Blur & Security Lock */}
      <div className="relative rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-950 overflow-hidden shadow-sm">
        {/* Editor Top Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 text-xs font-mono text-neutral-400">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-neutral-200">rclone.conf</span>
            <span className="text-[11px] text-neutral-500 hidden sm:inline">(/root/.config/rclone/rclone.conf)</span>
          </div>

          <div className="flex items-center gap-3">
            {isUnlocked ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-sans">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {lang === 'pl' ? 'Tryb edycji aktywny' : 'Edit mode active'}
                </span>
                <button
                  onClick={handleLock}
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[10px] font-sans font-medium transition-colors"
                >
                  {t.rclone.lockBtn}
                </button>
              </div>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-amber-400 font-sans">
                <Lock className="w-3 h-3" />
                <span>{lang === 'pl' ? 'Zabezpieczono hasłem' : 'Password locked'}</span>
              </span>
            )}
            <span className="text-neutral-500 hidden sm:inline">UTF-8 • INI syntax</span>
          </div>
        </div>

        {/* Textarea & Blur Container */}
        <div className="relative">
          <textarea
            value={configContent || `[gdrive]\ntype = drive\nclient_id = 123456789.apps.googleusercontent.com\nclient_secret = GOCSPX-secret_example\nscope = drive\ntoken = {"access_token":"ya29.a0AfH6SM...","token_type":"Bearer","refresh_token":"1//04..."}\n\n[remote_s3]\ntype = s3\nprovider = AWS\nenv_auth = false\naccess_key_id = AKIAIOSFODNN7EXAMPLE\nsecret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\nregion = eu-central-1`}
            onChange={e => isUnlocked && setConfigContent(e.target.value)}
            rows={18}
            readOnly={!isUnlocked}
            tabIndex={!isUnlocked ? -1 : 0}
            placeholder={t.rclone.placeholder}
            spellCheck={false}
            className={`w-full p-4 bg-neutral-950 text-neutral-100 font-mono text-xs leading-relaxed focus:outline-none selection:bg-blue-600 selection:text-white transition-all duration-300 ${
              isUnlocked
                ? 'filter-none select-text pointer-events-auto opacity-100 resize-y'
                : 'filter blur-[7px] select-none pointer-events-none opacity-40 resize-none'
            }`}
            style={!isUnlocked ? { userSelect: 'none', WebkitUserSelect: 'none' } : undefined}
          />

          {/* Locked Overlay Card */}
          {!isUnlocked && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-[2px]">
              <div
                className={`max-w-md w-full p-6 rounded-2xl border border-neutral-800 bg-neutral-900/95 shadow-2xl space-y-4 text-center ${
                  shake ? 'animate-bounce ring-2 ring-rose-500/50' : ''
                }`}
              >
                {/* Shield / Key Icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-indigo-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/10">
                  <ShieldAlert className="w-7 h-7" />
                </div>

                {/* Card Title & Desc */}
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>{t.rclone.protectedTitle}</span>
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed px-2">
                    {t.rclone.protectedDesc}
                  </p>
                </div>

                {/* Current User Badge */}
                {currentUser && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800/80 border border-neutral-700/60 text-[11px] text-neutral-300">
                    <span className="text-neutral-500">{lang === 'pl' ? 'Konto:' : 'Account:'}</span>
                    <strong className="text-white font-semibold">{currentUser.username}</strong>
                    <span className="text-blue-400 text-[10px] uppercase font-mono">({currentUser.role})</span>
                  </div>
                )}

                {/* Password Form */}
                <form onSubmit={handleUnlock} className="space-y-3 pt-1">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={t.rclone.passwordPlaceholder}
                      autoFocus
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-700 bg-neutral-800/90 text-white placeholder:text-neutral-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {unlockError && (
                    <div className="p-2.5 rounded-xl border border-rose-900/50 bg-rose-950/40 text-rose-300 text-xs flex items-center justify-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span>{unlockError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={unlocking || !password}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-800 disabled:text-neutral-600 text-white text-xs font-semibold transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {unlocking ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t.rclone.unlocking}</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>{t.rclone.unlockBtn}</span>
                      </>
                    )}
                  </button>
                </form>

                <p className="text-[11px] text-neutral-500">
                  {lang === 'pl'
                    ? 'Wprowadź hasło logowania, aby odsłonić konfigurację.'
                    : 'Enter your current account password to reveal the configuration.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
