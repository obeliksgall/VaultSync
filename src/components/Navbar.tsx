import React from 'react';
import {
  FolderSync,
  Activity,
  History,
  ShieldCheck,
  Settings,
  Sun,
  Moon,
  LogOut,
  KeyRound,
  HardDrive,
  Terminal,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { User, SystemStatus } from '../types.ts';
import { Language, translations } from '../i18n.ts';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  user: User | null;
  systemStatus: SystemStatus | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  lang: Language;
  onToggleLang: () => void;
  onLogout: () => void;
  onOpenChangePassword: () => void;
  sessionRemainingSeconds?: number;
  onRefreshSession?: () => void;
}

function formatSessionTime(seconds: number): string {
  if (seconds <= 0) return '00:00';
  if (seconds >= 86400) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    return `${d}d ${h}h`;
  }
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  user,
  systemStatus,
  theme,
  onToggleTheme,
  lang,
  onToggleLang,
  onLogout,
  onOpenChangePassword,
  sessionRemainingSeconds,
  onRefreshSession,
}) => {
  const t = translations[lang];
  const isAdmin = user?.role === 'admin';
  const activeJobs = systemStatus?.activeJobsCount || 0;
  const queuedJobs = systemStatus?.queuedJobsCount || 0;

  const leftNavItems = [
    { id: 'tasks', label: t.nav.tasks, icon: FolderSync },
    {
      id: 'monitor',
      label: t.nav.jobMonitor,
      icon: Activity,
      badge: activeJobs > 0 ? `${activeJobs}` : undefined,
      pulse: activeJobs > 0,
    },
    { id: 'history', label: t.nav.history, icon: History },
    ...(isAdmin
      ? [
          { id: 'settings', label: t.nav.settings, icon: Settings },
          { id: 'audit', label: t.nav.audit || 'Audit Log', icon: ShieldCheck },
        ]
      : []),
  ];

  const helpItem = { id: 'help', label: t.nav.help, icon: HelpCircle };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md">
      {/* ROW 1: Brand & Logo on Left, Tools & User Controls on Right */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo & Brand (Clicking navigates to Tasks) */}
          <button
            type="button"
            id="nav-brand-logo"
            onClick={() => onSelectTab('tasks')}
            className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none transition-transform active:scale-[0.98]"
            title={lang === 'pl' ? 'Przejdź do Zadań' : 'Go to Tasks'}
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 group-hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-colors">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-neutral-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  SyncVault
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                  Docker
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 hidden sm:block leading-none">
                rsync & rclone backup engine
              </p>
            </div>
          </button>

          {/* Right: Engine Tools, Language Switch, Theme Switch, and User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Tool status pill (rclone / rsync) */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
              <Terminal className="w-3.5 h-3.5 text-neutral-400" />
              <span
                className={`font-semibold ${
                  systemStatus?.rcloneAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400'
                }`}
                title={systemStatus?.rcloneVersion || 'rclone'}
              >
                rclone
              </span>
              <span className="text-neutral-300 dark:text-neutral-700">|</span>
              <span
                className={`font-semibold ${
                  systemStatus?.rsyncAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400'
                }`}
                title={systemStatus?.rsyncVersion || 'rsync'}
              >
                rsync
              </span>
            </div>

            {/* Language Switcher */}
            <button
              id="btn-toggle-lang"
              type="button"
              onClick={onToggleLang}
              className="px-2 py-1 text-xs font-semibold rounded-md border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
              title="Przełącz język / Switch language"
            >
              {lang === 'pl' ? 'PL' : 'EN'}
            </button>

            {/* Theme Toggle */}
            <button
              id="btn-toggle-theme"
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-600" />}
            </button>

            {/* User Controls */}
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-neutral-200 dark:border-neutral-800">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
                    {user.username}
                  </span>
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    {user.role === 'admin' ? t.common.admin : t.common.user}
                  </span>
                </div>

                <button
                  id="btn-change-password"
                  type="button"
                  onClick={onOpenChangePassword}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  title={t.common.changePassword}
                >
                  <KeyRound className="w-4 h-4" />
                </button>

                {/* Session countdown timer between change password and logout */}
                {sessionRemainingSeconds !== undefined && (
                  <button
                    id="btn-session-timer"
                    type="button"
                    onClick={onRefreshSession}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all border shadow-2xs select-none ${
                      sessionRemainingSeconds <= 120
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-900/80 animate-pulse'
                        : sessionRemainingSeconds <= 300
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-900/80'
                        : 'bg-neutral-100/90 dark:bg-neutral-800/90 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700/80 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
                    }`}
                    title={
                      lang === 'pl'
                        ? `Pozostały czas sesji: ${formatSessionTime(sessionRemainingSeconds)}. Przedłuża się automatycznie przy aktywności. Kliknij, aby odnowić natychmiast.`
                        : `Session time remaining: ${formatSessionTime(sessionRemainingSeconds)}. Extends automatically on activity. Click to refresh immediately.`
                    }
                  >
                    <Clock className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
                    <span>{formatSessionTime(sessionRemainingSeconds)}</span>
                  </button>
                )}

                <button
                  id="btn-logout"
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  title={t.common.logout}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 2 (Wiersz niżej): Main Navigation Bar (Zadania, Job Monitor, Historia, Audit log, Ustawienia, Pomoc) */}
      <div className="border-t border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-1.5 overflow-x-auto no-scrollbar">
            {/* Left Nav Tabs */}
            <nav className="flex items-center gap-1.5 shrink-0">
              {leftNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-tab-${item.id}`}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    className={`relative flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                      isActive
                        ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-xs border border-neutral-200 dark:border-neutral-700'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500'}`} />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={`inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold leading-none text-white rounded-full ${
                          item.pulse ? 'bg-amber-500 animate-pulse' : 'bg-neutral-500'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Group: Pinned Help button & System Queue indicator */}
            <div className="flex items-center gap-3 shrink-0 ml-auto pl-4">
              {/* Help Tab pinned to the right */}
              <button
                id="nav-tab-help"
                type="button"
                onClick={() => onSelectTab(helpItem.id)}
                className={`relative flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                  currentTab === helpItem.id
                    ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-xs border border-neutral-200 dark:border-neutral-700'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60'
                }`}
              >
                <HelpCircle className={`w-3.5 h-3.5 ${currentTab === helpItem.id ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500'}`} />
                <span>{helpItem.label}</span>
              </button>

              <div className="hidden sm:flex items-center gap-2 border-l border-neutral-200 dark:border-neutral-800 pl-3 text-[11px] text-neutral-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className={`w-1.5 h-1.5 rounded-full ${activeJobs > 0 ? 'bg-blue-500 animate-ping' : 'bg-emerald-500'}`} />
                  <span>
                    {activeJobs > 0
                      ? `${activeJobs} ${lang === 'pl' ? 'aktywnych' : 'running'}`
                      : lang === 'pl' ? 'Gotowy' : 'Idle'}
                  </span>
                </span>
                {queuedJobs > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium ml-1">
                    ({lang === 'pl' ? `Kolejka: ${queuedJobs}` : `Queue: ${queuedJobs}`})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
