import React, { useState, useEffect } from 'react';
import {
  Settings,
  Bell,
  HardDrive,
  Download,
  Upload,
  Save,
  Check,
  AlertCircle,
  KeyRound,
  FileKey,
  Layers,
  Send,
  Sliders,
  CloudCog,
  Users,
  Eye,
  EyeOff,
  Mail,
  MessageSquare,
  FileText,
  Paperclip,
  Clock,
  Database,
  Activity,
  Calendar,
  FileSpreadsheet,
  Terminal,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  GlobalSettings,
  User,
  DEFAULT_NOTIFICATION_TITLE_PL,
  DEFAULT_NOTIFICATION_TITLE_EN,
  DEFAULT_NOTIFICATION_BODY_PL,
  DEFAULT_NOTIFICATION_BODY_EN,
} from '../types.ts';
import { Language, translations } from '../i18n.ts';
import { api } from '../api.ts';
import { RcloneConfigView } from './RcloneConfigView.tsx';
import { UsersView } from './UsersView.tsx';

const formatBytesLocal = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface SettingsViewProps {
  lang: Language;
  users?: User[];
  currentUser?: User | null;
  onRefreshUsers?: () => void;
  onOpenChangePassword?: (userId?: string, username?: string) => void;
  initialSubTab?: 'general' | 'notifications' | 'rclone' | 'users' | 'backup_docker';
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  lang,
  users = [],
  currentUser = null,
  onRefreshUsers = () => {},
  onOpenChangePassword = () => {},
  initialSubTab = 'general',
}) => {
  const t = translations[lang];
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'notifications' | 'rclone' | 'users' | 'backup_docker'>(
    initialSubTab
  );
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Export / Import passphrase
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Notification testing states
  const [testingDiscord, setTestingDiscord] = useState(false);
  const [testingNtfy, setTestingNtfy] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  // Database Safety Backups state (/data/backupdb/)
  const [dbBackups, setDbBackups] = useState<Array<{ filename: string; size: number; createdAt: string; filePath: string }>>([]);
  const [loadingDbBackups, setLoadingDbBackups] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadDbBackups = async () => {
    if (currentUser?.role !== 'admin') return;
    setLoadingDbBackups(true);
    try {
      const list = await api.getDatabaseBackups();
      setDbBackups(list);
    } catch (err) {
      console.warn('Failed to load database backups:', err);
    } finally {
      setLoadingDbBackups(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'backup_docker') {
      loadDbBackups();
    }
  }, [activeSubTab]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Błąd ładowania ustawień' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setMessage(null);
    try {
      const res = await api.saveSettings(settings);
      setSettings(res.settings);
      loadDbBackups();
      setMessage({ type: 'success', text: t.settings.savedSuccess });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Błąd zapisu ustawień' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async (channel: 'discord' | 'ntfy' | 'email') => {
    if (!settings) return;
    if (channel === 'discord') setTestingDiscord(true);
    if (channel === 'ntfy') setTestingNtfy(true);
    if (channel === 'email') setTestingEmail(true);

    try {
      const target =
        channel === 'discord'
          ? settings.notifications?.discordWebhookUrl
          : channel === 'ntfy'
          ? settings.notifications?.ntfyUrl
          : undefined;
      await api.testNotification(channel, target);
      alert(t.settings.testSuccess);
    } catch (err: any) {
      alert(`${t.settings.testFailed}: ${err.message}`);
    } finally {
      if (channel === 'discord') setTestingDiscord(false);
      if (channel === 'ntfy') setTestingNtfy(false);
      if (channel === 'email') setTestingEmail(false);
    }
  };

  const handleExport = async () => {
    if (!exportPassphrase || exportPassphrase.length < 4) {
      alert('Podaj hasło szyfrujące (min. 4 znaki).');
      return;
    }

    setExporting(true);
    try {
      const res = await api.exportConfig(exportPassphrase);
      const content = typeof res.package === 'string' ? res.package : JSON.stringify(res.package, null, 2);
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `syncvault_backup_encrypted_${new Date().toISOString().slice(0, 10)}.svb`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Błąd eksportu: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // System logs state (/data/logs/logs_YYYY-MM-DD.log)
  const [systemLogsDate, setSystemLogsDate] = useState<string>('');
  const [systemLogDates, setSystemLogDates] = useState<string[]>([]);
  const [systemLogsText, setSystemLogsText] = useState<string>('');
  const [systemLogsLoading, setSystemLogsLoading] = useState<boolean>(false);
  const [systemLogsFilename, setSystemLogsFilename] = useState<string>('');

  const loadSystemLogs = async (selectedDate?: string) => {
    setSystemLogsLoading(true);
    try {
      const data = await api.getSystemLogs(selectedDate);
      setSystemLogDates(data.dates || []);
      setSystemLogsText(data.logs || '');
      setSystemLogsFilename(data.filename || '');
      if (data.currentDate) {
        setSystemLogsDate(data.currentDate);
      }
    } catch (e: any) {
      setSystemLogsText(`Błąd pobierania logów: ${e.message}`);
    } finally {
      setSystemLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'backup_docker') {
      loadSystemLogs(systemLogsDate || undefined);
    }
  }, [activeSubTab]);

  const handleImport = async () => {
    if (!importFile) {
      alert('Wybierz plik kopii zapasowej (*.svb).');
      return;
    }
    if (!importPassphrase) {
      alert('Podaj hasło deszyfrujące.');
      return;
    }

    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async event => {
        const rawContent = (event.target?.result as string) || '';
        let payloadToSend: any = rawContent;
        try {
          payloadToSend = JSON.parse(rawContent.trim());
        } catch {
          payloadToSend = rawContent.trim();
        }

        try {
          const res = await api.importConfig(payloadToSend, importPassphrase);
          alert(res.message || t.settings.importSuccess);
          window.location.reload();
        } catch (err: any) {
          alert(`Błąd importu: ${err.message}`);
        } finally {
          setImporting(false);
        }
      };
      reader.readAsText(importFile);
    } catch (err: any) {
      alert(`Błąd odczytu pliku: ${err.message}`);
      setImporting(false);
    }
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-neutral-400">Ładowanie ustawień...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>{t.settings.title}</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t.settings.subtitle}
          </p>
        </div>

        {(activeSubTab === 'general' || activeSubTab === 'notifications' || activeSubTab === 'backup_docker') && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-sm shadow-blue-500/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? t.common.loading : t.settings.saveBtn}</span>
          </button>
        )}
      </div>

      {/* Settings Subtabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
        <button
          type="button"
          onClick={() => setActiveSubTab('general')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeSubTab === 'general'
              ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{lang === 'pl' ? 'Ogólne i limity' : 'General & Limits'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('notifications')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeSubTab === 'notifications'
              ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>{t.settings.notificationsTitle}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('rclone')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeSubTab === 'rclone'
              ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <CloudCog className="w-3.5 h-3.5" />
          <span>Rclone Config</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('users')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeSubTab === 'users'
              ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{t.nav.users}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('backup_docker')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeSubTab === 'backup_docker'
              ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>{lang === 'pl' ? 'Kopia & Docker' : 'Backup & Docker'}</span>
        </button>
      </div>

      {message && (activeSubTab === 'general' || activeSubTab === 'notifications' || activeSubTab === 'backup_docker') && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300'
          }`}
        >
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* SECTION 1: Engine & Performance Parameters */}
      {activeSubTab === 'general' && (
      <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{lang === 'pl' ? 'Parametry wykonania i limity' : 'Execution Parameters & Limits'}</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              {lang === 'pl'
                ? 'Konfiguracja równoległości, retencji logów zadań, wpisów audit log oraz limitów wyświetlania.'
                : 'Configure concurrency, job log retention, audit log cleanup, and view display limits.'}
            </p>
          </div>
        </div>

        {/* Vertical list - one under another, styled like task rows */}
        <div className="space-y-3">
          {/* Item 1: Concurrency */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {t.settings.maxJobs}
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {lang === 'pl'
                    ? 'Maksymalna liczba zadań wykonywanych w tym samym czasie. Nadmiarowe zadania czekają w kolejce FIFO.'
                    : 'Maximum number of tasks executing concurrently. Excess jobs wait in FIFO queue.'}
                </p>
              </div>
            </div>
            <div className="w-full sm:w-64 shrink-0">
              <input
                type="number"
                min={1}
                max={50}
                value={settings.maxConcurrentJobs}
                onChange={e => setSettings({ ...settings, maxConcurrentJobs: parseInt(e.target.value, 10) || 1 })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
              />
            </div>
          </div>

          {/* Item 1b: Delay Between Queued Jobs */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {lang === 'pl' ? 'Odstęp przed kolejnym zadaniem' : 'Delay before next queued job'}
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {lang === 'pl'
                    ? 'Ile sekund odczekać po zakończeniu zadania, zanim ruszy następne z kolejki - dotyczy kolejkowania (Uruchom po zakończeniu innego zadania), uruchomienia ręcznego oraz z harmonogramu. 0 = wyłączone (start natychmiastowy).'
                    : 'How many seconds to wait after a job finishes before the next queued job starts - applies to chaining ("Run after another task finishes"), manual runs, and scheduled runs. 0 = disabled (instant start).'}
                </p>
              </div>
            </div>
            <div className="w-full sm:w-64 shrink-0 relative">
              <input
                type="number"
                min={0}
                max={3600}
                value={settings.queueStartDelaySeconds ?? 5}
                onChange={e => setSettings({ ...settings, queueStartDelaySeconds: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                className="w-full pl-3 pr-12 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-neutral-400 pointer-events-none">
                {lang === 'pl' ? 'sek.' : 'sec'}
              </span>
            </div>
          </div>

          {/* Item 2: Job Log Retention */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {t.settings.defaultRetention}
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {lang === 'pl'
                    ? 'Automatyczne czyszczenie plików dziennika zadań starszych niż zadana liczba dni.'
                    : 'Automatic pruning of task execution log files older than the specified days.'}
                </p>
              </div>
            </div>
            <div className="w-full sm:w-64 shrink-0 relative">
              <input
                type="number"
                min={1}
                max={3650}
                value={settings.defaultLogRetentionDays}
                onChange={e => setSettings({ ...settings, defaultLogRetentionDays: parseInt(e.target.value, 10) || 30 })}
                className="w-full pl-3 pr-12 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
              />
              <span className="absolute right-3 top-2.5 text-xs text-neutral-400 dark:text-neutral-500 font-medium pointer-events-none">
                {lang === 'pl' ? 'dni' : 'days'}
              </span>
            </div>
          </div>

          {/* Item 2b: CSV Reports Retention */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {lang === 'pl' ? 'Retencja raportów CSV (dni)' : 'CSV Reports Retention (days)'}
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {lang === 'pl'
                    ? 'Automatyczne usuwanie wygenerowanych plików CSV (wysłane/usunięte) z katalogu data/files/ starszych niż zadana liczba dni (0 = brak limitu, domyślnie tyle samo co limit historii/logów).'
                    : 'Automatic pruning of generated CSV report files (sent/deleted) from data/files/ older than the specified days (0 = unlimited, defaults to history/log retention).'}
                </p>
              </div>
            </div>
            <div className="w-full sm:w-64 shrink-0 relative">
              <input
                type="number"
                min={0}
                max={3650}
                value={settings.csvReportRetentionDays ?? settings.defaultLogRetentionDays ?? 30}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  setSettings({ ...settings, csvReportRetentionDays: isNaN(val) ? 0 : Math.max(0, val) });
                }}
                className="w-full pl-3 pr-12 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
                placeholder={String(settings.defaultLogRetentionDays ?? 30)}
              />
              <span className="absolute right-3 top-2.5 text-xs text-neutral-400 dark:text-neutral-500 font-medium pointer-events-none">
                {lang === 'pl' ? 'dni' : 'days'}
              </span>
            </div>
          </div>

          {/* Item 2b: CSV Report Headers Language */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {lang === 'pl' ? 'Język nagłówków raportów CSV' : 'CSV Report Headers Language'}
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {lang === 'pl'
                    ? 'Wybierz język kolumn w generowanych plikach CSV (_sent.csv / _deleted.csv). Domyślnie zawsze angielski dla maksymalnej kompatybilności.'
                    : 'Select column language in generated CSV reports (_sent.csv / _deleted.csv). Default is always English for maximum compatibility.'}
                </p>
              </div>
            </div>
            <div className="w-full sm:w-64 shrink-0">
              <select
                value={settings.csvHeaderLanguage ?? 'en'}
                onChange={e => setSettings({ ...settings, csvHeaderLanguage: e.target.value as 'en' | 'pl' })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="en">
                  {lang === 'pl' ? 'Angielski (EN) - domyślny' : 'English (EN) - default'}
                </option>
                <option value="pl">
                  {lang === 'pl' ? 'Polski (PL)' : 'Polish (PL)'}
                </option>
              </select>
            </div>
          </div>

          {/* Item 3: Audit Log Retention */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {t.settings.auditRetention || (lang === 'pl' ? 'Retencja Audit Log' : 'Audit Log Retention')}
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {lang === 'pl'
                    ? 'Po jakim czasie mają być automatycznie czyszczone wpisy w dzienniku zdarzeń (Audit Log).'
                    : 'Retention period after which Audit Log events are automatically purged.'}
                </p>
              </div>
            </div>
            <div className="w-full sm:w-64 shrink-0">
              <select
                value={settings.auditLogRetentionDays ?? 30}
                onChange={e => setSettings({ ...settings, auditLogRetentionDays: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
              >
                <option value={7}>{lang === 'pl' ? '7 dni (1 tydzień)' : '7 days (1 week)'}</option>
                <option value={14}>{lang === 'pl' ? '14 dni (2 tygodnie)' : '14 days (2 weeks)'}</option>
                <option value={30}>{lang === 'pl' ? '30 dni (1 miesiąc)' : '30 days (1 month)'}</option>
                <option value={60}>{lang === 'pl' ? '60 dni (2 miesiące)' : '60 days (2 months)'}</option>
                <option value={90}>{lang === 'pl' ? '90 dni (3 miesiące)' : '90 days (3 months)'}</option>
                <option value={180}>{lang === 'pl' ? '180 dni (pół roku)' : '180 days (6 months)'}</option>
                <option value={365}>{lang === 'pl' ? '365 dni (1 rok)' : '365 days (1 year)'}</option>
                <option value={0}>{lang === 'pl' ? 'Bez limitu (nie usuwaj)' : 'Unlimited (keep all)'}</option>
              </select>
            </div>
          </div>

          {/* Item 3b: Audit Log Max Entries (hard count cap, independent of the time-based retention above) */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {t.settings.auditMaxEntries}
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t.settings.auditMaxEntriesDesc}
                </p>
              </div>
            </div>
            <div className="w-full sm:w-64 shrink-0">
              <select
                value={settings.auditLogMaxEntries ?? 2000}
                onChange={e => setSettings({ ...settings, auditLogMaxEntries: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
              >
                <option value={100}>{lang === 'pl' ? 'Maks. 100 wpisów' : 'Max 100 entries'}</option>
                <option value={250}>{lang === 'pl' ? 'Maks. 250 wpisów' : 'Max 250 entries'}</option>
                <option value={500}>{lang === 'pl' ? 'Maks. 500 wpisów' : 'Max 500 entries'}</option>
                <option value={1000}>{lang === 'pl' ? 'Maks. 1000 wpisów' : 'Max 1000 entries'}</option>
                <option value={2000}>{lang === 'pl' ? 'Maks. 2000 wpisów' : 'Max 2000 entries'}</option>
                <option value={5000}>{lang === 'pl' ? 'Maks. 5000 wpisów' : 'Max 5000 entries'}</option>
              </select>
            </div>
          </div>

          {/* Item 4: Job Monitor Limit */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {t.settings.jobMonitorLimit}
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {lang === 'pl'
                    ? 'Liczba ostatnio zakończonych procesów wyświetlanych w zakładce Job Monitor.'
                    : 'Number of recent completed executions shown in the Job Monitor view.'}
                </p>
              </div>
            </div>
            <div className="w-full sm:w-64 shrink-0">
              <select
                value={settings.jobMonitorLimit}
                onChange={e => setSettings({ ...settings, jobMonitorLimit: parseInt(e.target.value, 10) as any })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
              >
                <option value={10}>{lang === 'pl' ? 'Ostatnie 10 zadań' : 'Last 10 jobs'}</option>
                <option value={25}>{lang === 'pl' ? 'Ostatnie 25 zadań' : 'Last 25 jobs'}</option>
                <option value={50}>{lang === 'pl' ? 'Ostatnie 50 zadań' : 'Last 50 jobs'}</option>
              </select>
            </div>
          </div>

          {/* Item 5: History Limit */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {t.settings.historyLimit}
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {lang === 'pl'
                    ? 'Maksymalna liczba wpisów archiwalnych pobieranych do tabeli w zakładce Historia.'
                    : 'Maximum number of archived records loaded into the History tab.'}
                </p>
              </div>
            </div>
            <div className="w-full sm:w-64 shrink-0">
              <select
                value={settings.historyLimit}
                onChange={e => setSettings({ ...settings, historyLimit: parseInt(e.target.value, 10) as any })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
              >
                <option value={100}>{lang === 'pl' ? 'Ostatnie 100 wpisów' : 'Last 100 entries'}</option>
                <option value={250}>{lang === 'pl' ? 'Ostatnie 250 wpisów' : 'Last 250 entries'}</option>
                <option value={500}>{lang === 'pl' ? 'Ostatnie 500 wpisów' : 'Last 500 entries'}</option>
                <option value={1000}>{lang === 'pl' ? 'Ostatnie 1000 wpisów' : 'Last 1000 entries'}</option>
                <option value={2000}>{lang === 'pl' ? 'Ostatnie 2000 wpisów' : 'Last 2000 entries'}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* SECTION 2: Global Notification Channels */}
      {activeSubTab === 'notifications' && (
      <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{t.settings.notificationsTitle}</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              {lang === 'pl'
                ? 'Skonfiguruj kanały powiadomień oraz dostosuj treść wiadomości, zmienne i załączniki logów.'
                : 'Configure notification channels and customize message templates, variables, and log attachments.'}
            </p>
          </div>
        </div>

        {/* Helper variable pill renderer */}
        {(() => {
          const tags = [
            { tag: '{name}', label: lang === 'pl' ? 'Nazwa' : 'Name' },
            { tag: '{mode}', label: lang === 'pl' ? 'Tryb' : 'Mode' },
            { tag: '{status}', label: 'Status' },
            { tag: '{files}', label: lang === 'pl' ? 'Pliki (+ sprawdzone)' : 'Files (+ checked)' },
            { tag: '{checks}', label: lang === 'pl' ? 'Tylko sprawdzone' : 'Checked only' },
            { tag: '{filesOnly}', label: lang === 'pl' ? 'Tylko przesłane' : 'Transferred only' },
            { tag: '{data}', label: lang === 'pl' ? 'Dane przesłane' : 'Data' },
            { tag: '{date}', label: lang === 'pl' ? 'Data uruchomienia' : 'Start date' },
            { tag: '{time}', label: lang === 'pl' ? 'Czas' : 'Duration' },
            { tag: '{logs}', label: lang === 'pl' ? 'Logi' : 'Logs' },
          ];

          const renderVariablePills = (onInsert: (tag: string) => void) => (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase mr-1">
                {lang === 'pl' ? 'Wstaw zmienną:' : 'Insert variable:'}
              </span>
              {tags.map(t => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => onInsert(t.tag)}
                  className="px-2 py-0.5 text-[11px] font-mono rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors border border-neutral-200 dark:border-neutral-700"
                  title={`${t.label}: ${t.tag}`}
                >
                  {t.tag} <span className="font-sans text-[10px] text-neutral-500 dark:text-neutral-400">({t.label})</span>
                </button>
              ))}
            </div>
          );

          return (
            <div className="space-y-6">
              {/* Discord */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      Discord Webhook
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTestNotification('discord')}
                    disabled={testingDiscord || !settings.notifications?.discordWebhookUrl}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>{testingDiscord ? (lang === 'pl' ? 'Wysyłanie...' : 'Sending...') : t.settings.testNotification}</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-500 mb-1">Webhook URL</label>
                  <input
                    type="text"
                    value={settings.notifications?.discordWebhookUrl || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          discordWebhookUrl: e.target.value,
                        },
                      })
                    }
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <label className="block text-[11px] text-neutral-500">
                        {lang === 'pl' ? 'Tytuł wiadomości Discord (Title template)' : 'Discord Title Template'}
                      </label>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        {lang === 'pl' ? '✓ Auto-transliteracja polskich znaków (np. ó→o, ł→l)' : '✓ Auto-transliterates non-ASCII headers'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            discordTitleTemplate: lang === 'pl' ? DEFAULT_NOTIFICATION_TITLE_PL : DEFAULT_NOTIFICATION_TITLE_EN,
                          },
                        })
                      }
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {lang === 'pl' ? 'Wstaw domyślny tytuł do edycji' : 'Insert default title to edit'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={settings.notifications?.discordTitleTemplate || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          discordTitleTemplate: e.target.value,
                        },
                      })
                    }
                    placeholder={lang === 'pl' ? DEFAULT_NOTIFICATION_TITLE_PL : DEFAULT_NOTIFICATION_TITLE_EN}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
                  />
                  {renderVariablePills(tag => {
                    const current = settings.notifications?.discordTitleTemplate || '';
                    setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        discordTitleTemplate: current ? `${current} ${tag}` : tag,
                      },
                    });
                  })}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] text-neutral-500">
                      {lang === 'pl' ? 'Treść wiadomości Discord (Body template)' : 'Discord Message Content (Body template)'}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            discordBodyTemplate: lang === 'pl' ? DEFAULT_NOTIFICATION_BODY_PL : DEFAULT_NOTIFICATION_BODY_EN,
                          },
                        })
                      }
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {lang === 'pl' ? 'Wstaw domyślną treść do edycji' : 'Insert default body to edit'}
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={settings.notifications?.discordBodyTemplate || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          discordBodyTemplate: e.target.value,
                        },
                      })
                    }
                    placeholder={lang === 'pl' ? DEFAULT_NOTIFICATION_BODY_PL : DEFAULT_NOTIFICATION_BODY_EN}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono whitespace-pre"
                  />
                  {renderVariablePills(tag => {
                    const current = settings.notifications?.discordBodyTemplate || '';
                    setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        discordBodyTemplate: current ? `${current} ${tag}` : tag,
                      },
                    });
                  })}
                </div>
              </div>

              {/* ntfy.sh */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      ntfy.sh (Push Notifications)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTestNotification('ntfy')}
                    disabled={testingNtfy || !settings.notifications?.ntfyUrl}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>{testingNtfy ? (lang === 'pl' ? 'Wysyłanie...' : 'Sending...') : t.settings.testNotification}</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-500 mb-1">{t.settings.ntfyUrl}</label>
                  <input
                    type="text"
                    value={settings.notifications?.ntfyUrl || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          ntfyUrl: e.target.value,
                        },
                      })
                    }
                    placeholder="https://ntfy.sh/syncvault_backup_alert"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <label className="block text-[11px] text-neutral-500">
                        {lang === 'pl' ? 'Tytuł powiadomienia push (Title template)' : 'Push Notification Title (Title template)'}
                      </label>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        {lang === 'pl' ? '✓ Auto-transliteracja polskich znaków (np. ó→o, ł→l)' : '✓ Auto-transliterates non-ASCII headers'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            ntfyTitleTemplate: lang === 'pl' ? DEFAULT_NOTIFICATION_TITLE_PL : DEFAULT_NOTIFICATION_TITLE_EN,
                          },
                        })
                      }
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {lang === 'pl' ? 'Wstaw domyślny tytuł do edycji' : 'Insert default title to edit'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={settings.notifications?.ntfyTitleTemplate || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          ntfyTitleTemplate: e.target.value,
                        },
                      })
                    }
                    placeholder={lang === 'pl' ? DEFAULT_NOTIFICATION_TITLE_PL : DEFAULT_NOTIFICATION_TITLE_EN}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
                  />
                  {renderVariablePills(tag => {
                    const current = settings.notifications?.ntfyTitleTemplate || '';
                    setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        ntfyTitleTemplate: current ? `${current} ${tag}` : tag,
                      },
                    });
                  })}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] text-neutral-500">
                      {lang === 'pl' ? 'Treść powiadomienia push (Message template)' : 'Push Message Content (Message template)'}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            ntfyMessageTemplate: lang === 'pl' ? DEFAULT_NOTIFICATION_BODY_PL : DEFAULT_NOTIFICATION_BODY_EN,
                          },
                        })
                      }
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {lang === 'pl' ? 'Wstaw domyślną treść do edycji' : 'Insert default body to edit'}
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={settings.notifications?.ntfyMessageTemplate || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          ntfyMessageTemplate: e.target.value,
                        },
                      })
                    }
                    placeholder={lang === 'pl' ? DEFAULT_NOTIFICATION_BODY_PL : DEFAULT_NOTIFICATION_BODY_EN}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono whitespace-pre"
                  />
                  {renderVariablePills(tag => {
                    const current = settings.notifications?.ntfyMessageTemplate || '';
                    setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        ntfyMessageTemplate: current ? `${current} ${tag}` : tag,
                      },
                    });
                  })}
                </div>
              </div>

              {/* Email SMTP */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      E-mail (SMTP)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTestNotification('email')}
                    disabled={testingEmail || !settings.notifications?.smtpHost || !settings.notifications?.notifyEmailTo}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>{testingEmail ? (lang === 'pl' ? 'Wysyłanie...' : 'Sending...') : t.settings.testNotification}</span>
                  </button>
                </div>

                {/* Server Host & Port */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-neutral-500 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={settings.notifications?.smtpHost || ''}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            smtpHost: e.target.value,
                          },
                        })
                      }
                      placeholder="smtp.example.com"
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">SMTP Port</label>
                    <input
                      type="number"
                      value={settings.notifications?.smtpPort || 587}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            smtpPort: parseInt(e.target.value, 10) || 587,
                          },
                        })
                      }
                      placeholder="587"
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
                    />
                  </div>
                </div>

                {/* SMTP Credentials: User & Pass */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">
                      SMTP User (SMTP_USER)
                    </label>
                    <input
                      type="text"
                      value={settings.notifications?.smtpUser || ''}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            smtpUser: e.target.value,
                          },
                        })
                      }
                      placeholder="user@example.com"
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">
                      SMTP Password (SMTP_PASS)
                    </label>
                    <div className="relative">
                      <input
                        type={showSmtpPassword ? 'text' : 'password'}
                        value={settings.notifications?.smtpPass || ''}
                        onChange={e =>
                          setSettings({
                            ...settings,
                            notifications: {
                              ...settings.notifications,
                              smtpPass: e.target.value,
                            },
                          })
                        }
                        placeholder="••••••••••••"
                        className="w-full px-3 py-1.5 pr-8 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                        title={showSmtpPassword ? (lang === 'pl' ? 'Ukryj hasło' : 'Hide password') : (lang === 'pl' ? 'Pokaż hasło' : 'Show password')}
                      >
                        {showSmtpPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* From & To */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">
                      {lang === 'pl' ? 'Nadawca (From)' : 'Sender (From)'}
                    </label>
                    <input
                      type="text"
                      value={settings.notifications?.smtpFrom || ''}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            smtpFrom: e.target.value,
                          },
                        })
                      }
                      placeholder="SyncVault <syncvault@example.com>"
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">
                      {lang === 'pl' ? 'Adres odbiorcy (To)' : 'Recipient (To)'}
                    </label>
                    <input
                      type="email"
                      value={settings.notifications?.notifyEmailTo || ''}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            notifyEmailTo: e.target.value,
                          },
                        })
                      }
                      placeholder="admin@example.com"
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
                    />
                  </div>
                </div>

                {/* Logs attachment condition selector */}
                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Paperclip className="w-4 h-4 text-neutral-500 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-neutral-900 dark:text-white block">
                        {lang === 'pl' ? 'Wysyłanie logów w wiadomości E-mail' : 'Email Log Attachment Policy'}
                      </span>
                      <span className="text-[11px] text-neutral-400 block">
                        {lang === 'pl'
                          ? 'Określ, kiedy do powiadomienia e-mail ma być dołączony pełny plik dziennika (.log)'
                          : 'Specify when the full execution .log file should be attached to email notifications'}
                      </span>
                    </div>
                  </div>
                  <div className="w-full sm:w-64 shrink-0">
                    <select
                      value={settings.notifications?.emailLogAttachment || (settings.notifications?.emailAttachLogsOnError === false ? 'never' : 'error')}
                      onChange={e => {
                        const val = e.target.value as any;
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            emailLogAttachment: val,
                            emailAttachLogsOnError: val !== 'never',
                          },
                        });
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="error">{lang === 'pl' ? 'Tylko błąd (Domyślne)' : 'Error only (Default)'}</option>
                      <option value="error_warning">{lang === 'pl' ? 'Błąd i ostrzeżenie (Warning)' : 'Error and Warning'}</option>
                      <option value="warning">{lang === 'pl' ? 'Tylko ostrzeżenie (Warning)' : 'Warning only'}</option>
                      <option value="success">{lang === 'pl' ? 'Tylko sukces' : 'Success only'}</option>
                      <option value="always">{lang === 'pl' ? 'Zawsze (każda wiadomość)' : 'Always (every email)'}</option>
                      <option value="never">{lang === 'pl' ? 'Nigdy (bez załącznika)' : 'Never (no logs)'}</option>
                    </select>
                  </div>
                </div>

                {/* Custom Email Subject & Body */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <label className="block text-[11px] text-neutral-500">
                          {lang === 'pl' ? 'Tytuł wiadomości e-mail (Subject template)' : 'Email Subject Template'}
                        </label>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          {lang === 'pl' ? '✓ Auto-transliteracja polskich znaków (np. ó→o, ł→l)' : '✓ Auto-transliterates non-ASCII headers'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            notifications: {
                              ...settings.notifications,
                              emailSubjectTemplate: lang === 'pl' ? DEFAULT_NOTIFICATION_TITLE_PL : DEFAULT_NOTIFICATION_TITLE_EN,
                            },
                          })
                        }
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {lang === 'pl' ? 'Wstaw domyślny temat do edycji' : 'Insert default subject to edit'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={settings.notifications?.emailSubjectTemplate || ''}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            emailSubjectTemplate: e.target.value,
                          },
                        })
                      }
                      placeholder={lang === 'pl' ? DEFAULT_NOTIFICATION_TITLE_PL : DEFAULT_NOTIFICATION_TITLE_EN}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
                    />
                    {renderVariablePills(tag => {
                      const current = settings.notifications?.emailSubjectTemplate || '';
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          emailSubjectTemplate: current ? `${current} ${tag}` : tag,
                        },
                      });
                    })}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] text-neutral-500">
                        {lang === 'pl' ? 'Treść wiadomości e-mail (Body template)' : 'Email Body Template'}
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            notifications: {
                              ...settings.notifications,
                              emailBodyTemplate: lang === 'pl' ? DEFAULT_NOTIFICATION_BODY_PL : DEFAULT_NOTIFICATION_BODY_EN,
                            },
                          })
                        }
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {lang === 'pl' ? 'Wstaw domyślną treść do edycji' : 'Insert default body to edit'}
                      </button>
                    </div>
                    <textarea
                      rows={6}
                      value={settings.notifications?.emailBodyTemplate || ''}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            emailBodyTemplate: e.target.value,
                          },
                        })
                      }
                      placeholder={lang === 'pl' ? DEFAULT_NOTIFICATION_BODY_PL : DEFAULT_NOTIFICATION_BODY_EN}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono whitespace-pre"
                    />
                    {renderVariablePills(tag => {
                      const current = settings.notifications?.emailBodyTemplate || '';
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          emailBodyTemplate: current ? `${current} ${tag}` : tag,
                        },
                      });
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      )}

      {/* SUBTAB 3: Rclone Config */}
      {activeSubTab === 'rclone' && (
        <div>
          <RcloneConfigView lang={lang} currentUser={currentUser} />
        </div>
      )}

      {/* SUBTAB 4: Users */}
      {activeSubTab === 'users' && (
        <div>
          <UsersView
            lang={lang}
            users={users}
            currentUser={currentUser}
            onRefreshUsers={onRefreshUsers}
            onOpenChangePassword={onOpenChangePassword}
          />
        </div>
      )}

      {/* SUBTAB 5: Backup & Docker */}
      {activeSubTab === 'backup_docker' && (
        <div className="space-y-6">
          {/* SECTION 3: Encrypted Import & Export */}
          <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-6">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
          <FileKey className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Szyfrowany Eksport & Import konfiguracji (AES-256-GCM)</span>
        </h3>
        <p className="text-xs text-neutral-500">
          Umożliwia pełne przeniesienie lub wykonanie kopii bezpieczeństwa zadań, ustawień i użytkowników zabezpieczonych hasłem.
        </p>

        {/* Zawartość kopii zapasowej .svb */}
        <div className="p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-200 space-y-1.5">
          <span className="font-bold flex items-center gap-1.5">
            📦 {lang === 'pl' ? 'Co dokładnie zawiera plik kopii (.svb)?' : 'What is included in the (.svb) backup?'}
          </span>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-neutral-600 dark:text-neutral-300">
            <li>
              <strong>{lang === 'pl' ? 'Wszystkie zadania kopii:' : 'All backup tasks:'}</strong> {lang === 'pl' ? 'nazwy, pary ścieżek źródło-cel, silniki (rsync/rclone), tryby, harmonogramy CRON, powiązania kolejkowania, filtry wykluczeń i opcje kosza.' : 'names, source-dest pairs, engines, modes, CRON schedules, chained triggers, exclude rules and trash settings.'}
            </li>
            <li>
              <strong>{lang === 'pl' ? 'Ustawienia globalne aplikacji:' : 'Global application settings:'}</strong> {lang === 'pl' ? 'limity równoległych zadań, retencja logów i kosza, konfiguracje powiadomień (Discord, ntfy, SMTP wraz z szablonami wiadomości).' : 'concurrency limits, log/trash retentions, notification configs (Discord, ntfy, SMTP credentials and templates).'}
            </li>
            <li>
              <strong>{lang === 'pl' ? 'Konta użytkowników:' : 'User accounts:'}</strong> {lang === 'pl' ? 'identyfikatory kont, loginy oraz role (administrator/operator).' : 'user IDs, usernames, and roles (admin/operator).'}
            </li>
            <li>
              <strong>{lang === 'pl' ? 'Plik konfiguracyjny chmur rclone.conf:' : 'Cloud configuration file rclone.conf:'}</strong> {lang === 'pl' ? 'pełna zawartość ze wszystkimi zdefiniowanymi zdalnymi dyskami (Google Drive, OneDrive, S3, SFTP itp.).' : 'full configuration with all configured cloud remotes.'}
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Export Box */}
          <div className="flex flex-col justify-between h-full p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{t.settings.exportTitle}</span>
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium">
                AES-256-GCM
              </span>
            </div>

            <div className="space-y-3 pt-1">
              <input
                type="password"
                value={exportPassphrase}
                onChange={e => setExportPassphrase(e.target.value)}
                placeholder={lang === 'pl' ? 'Hasło szyfrowania (min. 4 znaki)...' : 'Encryption passphrase (min. 4 chars)...'}
                className="w-full h-10 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="w-full h-10 flex items-center justify-center gap-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>{exporting ? (lang === 'pl' ? 'Generowanie...' : 'Generating...') : t.settings.exportBtn}</span>
              </button>
            </div>
          </div>

          {/* Import Box */}
          <div className="flex flex-col justify-between h-full p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t.settings.importTitle}</span>
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                .svb
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {/* Wybierz plik obok hasła deszyfrowania */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center justify-center gap-1.5 w-full h-10 px-3 py-2 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-medium cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-neutral-750 transition-colors truncate shadow-sm">
                  <Upload className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                  <span className="truncate">
                    {importFile ? importFile.name : (lang === 'pl' ? 'Wybierz plik .svb' : 'Select .svb file')}
                  </span>
                  <input
                    type="file"
                    accept=".svb,.json,.txt"
                    onChange={e => setImportFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                </label>

                <input
                  type="password"
                  value={importPassphrase}
                  onChange={e => setImportPassphrase(e.target.value)}
                  placeholder={lang === 'pl' ? 'Hasło deszyfrowania pliku...' : 'File decryption passphrase...'}
                  className="w-full h-10 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="w-full h-10 flex items-center justify-center gap-2 px-4 rounded-lg bg-neutral-800 hover:bg-neutral-700 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>{importing ? (lang === 'pl' ? 'Odszyfrowywanie...' : 'Decrypting...') : t.settings.importBtn}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3B: Automatic Database Safety Backups (/data/backupdb/syncvault-db_YYYY-MM-DD_HH-mm-ss.json) */}
      <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>
                {lang === 'pl'
                  ? 'Automatyczne kopie bezpieczeństwa bazy danych (/data/backupdb/)'
                  : 'Automatic Database Pre-Save Backups (/data/backupdb/)'}
              </span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              {lang === 'pl'
                ? 'Przed każdą modyfikacją pliku bazy syncvault-db.json (zadania, użytkownicy, konfiguracja) system automatycznie odkłada migawkę stanu do podkatalogu data/backupdb/.'
                : 'Before any write to syncvault-db.json, a complete safety snapshot is automatically archived into data/backupdb/.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={loadDbBackups}
              disabled={loadingDbBackups}
              className="h-9 flex items-center gap-1.5 px-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
              title={lang === 'pl' ? 'Odśwież listę kopii' : 'Refresh backup list'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDbBackups ? 'animate-spin text-blue-500' : ''}`} />
              <span>{lang === 'pl' ? 'Odśwież listę' : 'Refresh list'}</span>
            </button>
          </div>
        </div>

        {/* Parametry retencji kopii bazy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <label className="text-xs font-bold text-neutral-900 dark:text-white">
                  {lang === 'pl' ? 'Czas przechowywania kopii (retencja w dniach)' : 'Backup retention (days)'}
                </label>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">
                {lang === 'pl'
                  ? 'Po ilu dniach stare kopie mogą być usuwane (domyślnie 14 dni).'
                  : 'Days after which old backups can be pruned (default 14 days).'}
              </p>
            </div>
            <div className="relative mt-4">
              <input
                type="number"
                min={1}
                max={3650}
                value={settings.dbBackupRetentionDays ?? 14}
                onChange={e => setSettings({ ...settings, dbBackupRetentionDays: Math.max(1, parseInt(e.target.value, 10) || 14) })}
                className="w-full pl-3 pr-14 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
              <span className="absolute right-3 top-2.5 text-xs text-neutral-400 dark:text-neutral-500 font-medium pointer-events-none">
                {lang === 'pl' ? 'dni' : 'days'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <label className="text-xs font-bold text-neutral-900 dark:text-white">
                  {lang === 'pl' ? 'Gwarantowana minimalna liczba kopii' : 'Guaranteed minimum copies'}
                </label>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">
                {lang === 'pl'
                  ? 'Niezależnie od upływu czasu system NIGDY nie usunie kopii, jeśli w folderze zostanie ich mniej niż ta liczba (domyślnie 14 kopii).'
                  : 'Regardless of age, the system will NEVER prune backups below this minimum count (default 14 copies).'}
              </p>
            </div>
            <div className="relative mt-4">
              <input
                type="number"
                min={1}
                max={500}
                value={settings.dbBackupMinCopies ?? 14}
                onChange={e => setSettings({ ...settings, dbBackupMinCopies: Math.max(1, parseInt(e.target.value, 10) || 14) })}
                className="w-full pl-3 pr-14 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
              <span className="absolute right-3 top-2.5 text-xs text-neutral-400 dark:text-neutral-500 font-medium pointer-events-none">
                {lang === 'pl' ? 'kopii' : 'copies'}
              </span>
            </div>
          </div>
        </div>

        {/* Lista zarchiwizowanych kopii */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              {lang === 'pl' ? 'Zarchiwizowane kopie bazy danych:' : 'Archived database backups:'}
            </span>
            <span className="text-xs font-medium text-neutral-500">
              {lang === 'pl' ? `Dostępnych kopii: ${dbBackups.length}` : `Available copies: ${dbBackups.length}`}
            </span>
          </div>

          {loadingDbBackups ? (
            <div className="p-6 text-center text-xs text-neutral-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-500 mb-2" />
              <span>{lang === 'pl' ? 'Wczytywanie listy kopii zapasowych bazy...' : 'Loading database backups...'}</span>
            </div>
          ) : dbBackups.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 text-center text-xs text-neutral-500 dark:text-neutral-400">
              {lang === 'pl'
                ? 'Katalog /data/backupdb/ jest obecnie pusty. Pierwsza kopia zostanie utworzona automatycznie przy najbliższym zapisie zadania, użytkownika lub ustawień.'
                : 'Directory /data/backupdb/ is currently empty. The first backup will be created automatically upon the next task, user, or settings save.'}
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
              {dbBackups.map(b => (
                <div key={b.filename} className="p-3 bg-neutral-50/50 dark:bg-neutral-850/50 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 flex items-center justify-between gap-3 text-xs transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-mono text-neutral-900 dark:text-white font-medium truncate">
                        {b.filename}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        {new Date(b.createdAt).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-US')} • {formatBytesLocal(b.size)}
                      </div>
                    </div>
                  </div>

                  <a
                    href={api.getDatabaseBackupDownloadUrl(b.filename)}
                    download
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 text-xs font-semibold shrink-0 transition-colors shadow-sm"
                    title={lang === 'pl' ? 'Pobierz tę kopię bazy danych' : 'Download this database backup'}
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{lang === 'pl' ? 'Pobierz .json' : 'Download .json'}</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3C: General / Docker Container Logs (/data/logs/logs_YYYY-MM-DD.log) */}
      <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>
                {lang === 'pl'
                  ? 'Ogólne logi systemowe i kontenera Docker (/data/logs/logs_YYYY-MM-DD.log)'
                  : 'General System & Docker Container Logs (/data/logs/logs_YYYY-MM-DD.log)'}
              </span>
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              {lang === 'pl'
                ? `Wszystkie komunikaty konsoli kontenera (odpowiednik sudo docker logs syncvault) są automatycznie zapisywane do dziennych plików logów i rotowane według retencji (${settings.defaultLogRetentionDays ?? 30} dni).`
                : `All container console outputs (equivalent to sudo docker logs syncvault) are continuously captured into daily log files and purged per retention (${settings.defaultLogRetentionDays ?? 30} days).`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {systemLogDates.length > 0 && (
              <select
                value={systemLogsDate}
                onChange={e => {
                  setSystemLogsDate(e.target.value);
                  loadSystemLogs(e.target.value);
                }}
                className="h-9 px-3 py-1 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {systemLogDates.map(date => (
                  <option key={date} value={date}>
                    logs_{date}.log
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => loadSystemLogs(systemLogsDate)}
              disabled={systemLogsLoading}
              className="h-9 flex items-center gap-1.5 px-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
              title={lang === 'pl' ? 'Odśwież logi' : 'Refresh logs'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${systemLogsLoading ? 'animate-spin text-blue-500' : ''}`} />
              <span>{lang === 'pl' ? 'Odśwież' : 'Refresh'}</span>
            </button>

            <a
              href={api.getSystemLogDownloadUrl(systemLogsDate)}
              download
              className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-sm"
              title={lang === 'pl' ? 'Pobierz plik logu' : 'Download log file'}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'pl' ? 'Pobierz .log' : 'Download .log'}</span>
            </a>
          </div>
        </div>

        {/* Terminal log output */}
        <div className="relative">
          <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900 text-neutral-400 text-[10px] font-mono rounded-t-xl border border-b-0 border-neutral-800">
            <span>{systemLogsFilename || `logs_${systemLogsDate || 'system'}.log`}</span>
            <span>{systemLogsLoading ? (lang === 'pl' ? 'Wczytywanie...' : 'Loading...') : (lang === 'pl' ? 'Tryb na żywo (odświeżany)' : 'Live mode (on refresh)')}</span>
          </div>
          <div className="p-4 rounded-b-xl bg-neutral-950 text-neutral-200 font-mono text-[11px] leading-relaxed border border-neutral-800 h-80 overflow-y-auto select-text whitespace-pre-wrap">
            {systemLogsLoading ? (
              <span className="text-neutral-500">{lang === 'pl' ? 'Pobieranie zawartości pliku logów...' : 'Fetching system log content...'}</span>
            ) : systemLogsText ? (
              systemLogsText
            ) : (
              <span className="text-neutral-500">{lang === 'pl' ? 'Brak wpisów w wybranym pliku logów.' : 'No entries found in the selected log file.'}</span>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: Docker Architecture & Volume Guide */}
      <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>{lang === 'pl' ? 'Integracja ze środowiskiem Docker i wolumenami' : 'Docker Environment & Volume Integration'}</span>
        </h3>
        <p className="text-xs text-neutral-500">
          {lang === 'pl'
            ? 'Kontener mapuje wolumeny z systemu hosta. Ścieżki w zadaniach (np. /source i /destination) odpowiadają montowaniom zadeklarowanym w docker-compose.yml:'
            : 'The container maps volumes from the host system. Task paths (e.g. /source and /destination) match mount points defined in docker-compose.yml:'}
        </p>

        <div className="p-4 rounded-xl bg-neutral-950 text-neutral-200 font-mono text-xs border border-neutral-800 overflow-x-auto">
          <pre>{`services:
  syncvault:
    image: syncvault:latest
    ports:
      - "3000:3000"
    volumes:
      - /path/on/host/data:/source:ro         # ${lang === 'pl' ? 'Źródło danych (dozwolony read-only)' : 'Data source (read-only recommended)'}
      - /path/on/host/backups:/destination    # ${lang === 'pl' ? 'Wolumen docelowy' : 'Destination volume'}
      - ./syncvault_data:/app/data                # ${lang === 'pl' ? 'Baza danych i zadania' : 'Database and task configuration'}
      - ./rclone_config:/root/.config/rclone      # rclone.conf
      - ./syncvault_logs:/logs                    # ${lang === 'pl' ? 'Trwałe logi operacji' : 'Persistent execution logs'}
    restart: unless-stopped`}</pre>
        </div>
      </div>
        </div>
      )}
    </div>
  );
};
