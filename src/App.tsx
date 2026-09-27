import React, { useState, useEffect, useCallback } from 'react';
import { api, setAuthToken, getAuthToken } from './api.ts';
import { User, Task, JobExecution, SystemStatus } from './types.ts';
import { Language } from './i18n.ts';
import { Navbar } from './components/Navbar.tsx';
import { AdminSetup } from './components/AdminSetup.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { ChangePasswordModal } from './components/ChangePasswordModal.tsx';
import { TasksView } from './components/TasksView.tsx';
import { JobMonitorView } from './components/JobMonitorView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { RcloneConfigView } from './components/RcloneConfigView.tsx';
import { UsersView } from './components/UsersView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { AuditLogView } from './components/AuditLogView.tsx';
import { HelpView } from './components/HelpView.tsx';
import { TaskEditModal } from './components/TaskEditModal.tsx';
import { RestoreModal } from './components/RestoreModal.tsx';
import { QuickCommandPreviewModal } from './components/QuickCommandPreviewModal.tsx';
import { LogViewerModal } from './components/LogViewerModal.tsx';
import { CheckCircle2, AlertCircle, X, ArrowUpRight } from 'lucide-react';

export default function App() {
  // Theme initialization
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('syncvault_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Language initialization
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('syncvault_lang');
    return saved === 'en' ? 'en' : 'pl';
  });

  // App core state
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentTab, setCurrentTab] = useState('tasks');

  // Domain data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [jobs, setJobs] = useState<JobExecution[]>([]);
  const [history, setHistory] = useState<JobExecution[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Modals state
  const [taskEditModalOpen, setTaskEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoringTask, setRestoringTask] = useState<Task | null>(null);
  const [quickPreviewModalOpen, setQuickPreviewModalOpen] = useState(false);
  const [previewingTask, setPreviewingTask] = useState<Task | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [viewingJob, setViewingJob] = useState<JobExecution | null>(null);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [changePasswordTarget, setChangePasswordTarget] = useState<{ id?: string; username?: string }>({});

  // Floating Toast notification state
  const [toast, setToast] = useState<{
    id: number;
    type: 'success' | 'error' | 'info';
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // Session auto-logout countdown timer state and activity tracking
  const [sessionRemainingSeconds, setSessionRemainingSeconds] = useState<number | undefined>(undefined);
  const lastActivityRef = React.useRef<number>(Date.now());
  const lastHeartbeatRef = React.useRef<number>(0);

  const showToast = useCallback(
    (data: {
      type: 'success' | 'error' | 'info';
      message: string;
      actionLabel?: string;
      onAction?: () => void;
    }) => {
      const id = Date.now();
      setToast({ id, ...data });
      setTimeout(() => {
        setToast(prev => (prev?.id === id ? null : prev));
      }, 5000);
    },
    []
  );

  // Set of actively running or queued task IDs
  const activeTaskIds = React.useMemo(() => {
    return new Set(
      jobs
        .filter(j => j.status === 'running' || j.status === 'queued' || j.status === 'stopping')
        .map(j => j.taskId)
    );
  }, [jobs]);

  // Sync theme with HTML document class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('syncvault_theme', theme);
  }, [theme]);

  // Sync language with localStorage
  useEffect(() => {
    localStorage.setItem('syncvault_lang', lang);
  }, [lang]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleLang = () => {
    setLang(prev => (prev === 'pl' ? 'en' : 'pl'));
  };

  // Initial bootstrap
  const checkStatus = useCallback(async () => {
    try {
      const status = await api.getSystemStatus();
      setSystemStatus(status);
      if (status.currentUser) {
        setCurrentUser(status.currentUser);
      } else {
        if (getAuthToken()) {
          setAuthToken(null);
        }
        setCurrentUser(null);
      }
    } catch {
      // Offline / server waking up
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Load domain data
  const refreshTasks = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch {
      // ignore
    }
  }, [currentUser]);

  const refreshJobs = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await api.getJobs();
      setJobs(data);
      // Also update system status active count
      setSystemStatus(prev =>
        prev
          ? {
              ...prev,
              activeJobsCount: data.filter(j => j.status === 'running').length,
              queuedJobsCount: data.filter(j => j.status === 'queued').length,
            }
          : prev
      );
    } catch {
      // ignore
    }
  }, [currentUser]);

  const refreshHistory = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await api.getHistory();
      setHistory(data);
    } catch {
      // ignore
    }
  }, [currentUser]);

  const refreshUsers = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch {
      // ignore
    }
  }, [currentUser]);

  // Load data whenever logged in
  useEffect(() => {
    if (currentUser) {
      refreshTasks();
      refreshJobs();
      refreshHistory();
      if (currentUser.role === 'admin') {
        refreshUsers();
      }
    }
  }, [currentUser, refreshTasks, refreshJobs, refreshHistory, refreshUsers]);

  // Live polling for Job Monitor & active executions (every 1.5 seconds)
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      refreshJobs();
    }, 1500);
    return () => clearInterval(interval);
  }, [currentUser, refreshJobs]);

  // Role guard: Non-admin users (operators) are restricted from admin-only tabs
  // If an operator is logged in and active tab is an admin-only tab, automatically switch to 'tasks'
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      const adminOnlyTabs = ['rclone', 'users', 'settings', 'audit'];
      if (adminOnlyTabs.includes(currentTab)) {
        setCurrentTab('tasks');
      }
    }
  }, [currentUser, currentTab]);

  // Refresh history occasionally (every 10 seconds)
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      refreshHistory();
    }, 10000);
    return () => clearInterval(interval);
  }, [currentUser, refreshHistory]);

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setAuthToken(null);
    setCurrentUser(null);
    setCurrentTab('tasks');
    setSessionRemainingSeconds(undefined);
    lastActivityRef.current = Date.now();
    lastHeartbeatRef.current = 0;
  }, []);

  const getTimeoutSeconds = useCallback(() => {
    const timeout = systemStatus?.autoLogoutTimeout || '30m';
    switch (timeout) {
      case '1h':
        return 3600;
      case '3h':
        return 10800;
      case 'unlimited':
        return (systemStatus?.unlimitedDays || 7) * 86400;
      case '30m':
      default:
        return 1800;
    }
  }, [systemStatus?.autoLogoutTimeout, systemStatus?.unlimitedDays]);

  const handleLoginSuccess = useCallback((user: User) => {
    lastActivityRef.current = Date.now();
    lastHeartbeatRef.current = Date.now();
    const timeoutSec = getTimeoutSeconds();
    setSessionRemainingSeconds(timeoutSec);
    setCurrentTab('tasks');
    setCurrentUser(user);
    checkStatus();
  }, [checkStatus, getTimeoutSeconds]);

  const handleUserActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    const totalSec = getTimeoutSeconds();
    setSessionRemainingSeconds(totalSec);

    // Throttled heartbeat to server: send at most once every 30 seconds
    const now = Date.now();
    if (now - lastHeartbeatRef.current > 30000 && currentUser) {
      lastHeartbeatRef.current = now;
      api.heartbeat().catch(() => {});
    }
  }, [getTimeoutSeconds, currentUser]);

  // Global user activity listeners to extend session
  useEffect(() => {
    if (!currentUser) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const onActivity = () => {
      handleUserActivity();
    };

    events.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));
    return () => {
      events.forEach(evt => window.removeEventListener(evt, onActivity));
    };
  }, [currentUser, handleUserActivity]);

  // Interval ticker: calculates remaining time every second
  useEffect(() => {
    if (!currentUser) {
      setSessionRemainingSeconds(undefined);
      return;
    }

    // Defensive check: If last activity reference is stale (e.g. from a previous auto-logout), reset it immediately
    const totalSec = getTimeoutSeconds();
    if (Date.now() - lastActivityRef.current >= totalSec * 1000) {
      lastActivityRef.current = Date.now();
    }

    const tick = () => {
      const currentTotalSec = getTimeoutSeconds();
      const elapsedSec = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, currentTotalSec - elapsedSec);
      setSessionRemainingSeconds(remaining);

      if (remaining <= 0) {
        handleLogout();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentUser, getTimeoutSeconds, handleLogout]);

  const handleRefreshSession = useCallback(async () => {
    lastActivityRef.current = Date.now();
    lastHeartbeatRef.current = Date.now();
    setSessionRemainingSeconds(getTimeoutSeconds());
    try {
      await api.heartbeat();
      showToast({
        type: 'success',
        message: lang === 'pl' ? 'Sesja została pomyślnie przedłużona.' : 'Session successfully extended.',
      });
    } catch {
      // ignore
    }
  }, [getTimeoutSeconds, lang, showToast]);

  // Task actions
  const handleCreateNewTask = () => {
    setEditingTask(null);
    setTaskEditModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskEditModalOpen(true);
  };

  const handleDuplicateTask = async (taskId: string) => {
    try {
      await api.duplicateTask(taskId);
      refreshTasks();
    } catch (err: any) {
      alert(`Błąd duplikowania: ${err.message}`);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      // Optimistically remove from state so UI updates instantly
      setTasks(prev => prev.filter(t => t.id !== task.id));
      setJobs(prev => prev.filter(j => j.taskId !== task.id));
      setHistory(prev => prev.filter(h => h.taskId !== task.id));

      await api.deleteTask(task.id);
      refreshTasks();
      refreshJobs();
      refreshHistory();
    } catch (err: any) {
      console.error('Delete task error:', err);
      refreshTasks();
      refreshJobs();
      refreshHistory();
      throw err;
    }
  };

  const handleSaveTask = async (task: Task) => {
    try {
      // Use editingTask (not task.id) to decide create vs. update: the modal
      // always assigns a client-side id to a brand-new task before it has ever
      // been persisted, so relying on "does task.id exist" would still send an
      // update (PUT) first and only succeed via the create fallback after a
      // 404 - which works, but shows up as a confusing failed request in the
      // browser console. Knowing here whether we're actually editing an
      // existing task avoids that unnecessary round-trip entirely.
      if (editingTask) {
        await api.updateTask(task.id, task);
      } else {
        await api.createTask(task);
      }
      setTaskEditModalOpen(false);
      refreshTasks();
    } catch (err: any) {
      alert(`Błąd zapisu zadania: ${err.message}`);
    }
  };

  const handleRunTask = async (taskId: string) => {
    try {
      await api.runTask(taskId);
      refreshJobs();
      const task = tasks.find(t => t.id === taskId);
      const name = task ? task.name : '';
      showToast({
        type: 'success',
        message:
          lang === 'pl'
            ? `Zadanie "${name}" zostało pomyślnie uruchomione.`
            : `Task "${name}" has been started.`,
        actionLabel: lang === 'pl' ? 'Otwórz Monitor' : 'Open Monitor',
        onAction: () => setCurrentTab('monitor'),
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        message:
          lang === 'pl'
            ? `Błąd uruchomienia zadania: ${err.message}`
            : `Failed to start task: ${err.message}`,
      });
    }
  };

  const handleRestoreTaskModal = (task: Task) => {
    setRestoringTask(task);
    setRestoreModalOpen(true);
  };

  const handleConfirmRestore = async (taskId: string, selectedPairIds?: string[], password?: string) => {
    try {
      await api.restoreTask(taskId, selectedPairIds, password);
      setRestoreModalOpen(false);
      setRestoringTask(null);
      refreshJobs();
      const task = tasks.find(t => t.id === taskId);
      const name = task ? task.name : '';
      showToast({
        type: 'success',
        message:
          lang === 'pl'
            ? `Przywracanie dla zadania "${name}" zostało uruchomione.`
            : `Restore for "${name}" has been initiated.`,
        actionLabel: lang === 'pl' ? 'Otwórz Monitor' : 'Open Monitor',
        onAction: () => setCurrentTab('monitor'),
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        message:
          lang === 'pl'
            ? `Błąd uruchomienia przywracania: ${err.message}`
            : `Failed to start restore: ${err.message}`,
      });
      throw err;
    }
  };

  const handleStopJob = async (jobId: string) => {
    try {
      await api.stopJob(jobId);
      refreshJobs();
    } catch (err: any) {
      alert(`Błąd zatrzymywania zadania: ${err.message}`);
    }
  };

  const handleViewLogs = (job: JobExecution) => {
    setViewingJob(job);
    setLogModalOpen(true);
  };

  const handleQuickPreview = (task: Task) => {
    setPreviewingTask(task);
    setQuickPreviewModalOpen(true);
  };

  const handleOpenChangePassword = (targetUserId?: string, targetUsername?: string) => {
    setChangePasswordTarget({ id: targetUserId, username: targetUsername });
    setChangePasswordModalOpen(true);
  };

  // Loading state during initial bootstrap
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 text-neutral-500 font-sans text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Inicjalizacja SyncVault...</span>
        </div>
      </div>
    );
  }

  // First run: Admin setup required
  if (systemStatus && !systemStatus.isSetupComplete) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans">
        <AdminSetup
          lang={lang}
          onSetupSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  // Not logged in: Show login screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans">
        <LoginModal
          lang={lang}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        user={currentUser}
        systemStatus={systemStatus}
        theme={theme}
        onToggleTheme={toggleTheme}
        lang={lang}
        onToggleLang={toggleLang}
        onLogout={handleLogout}
        onOpenChangePassword={() => handleOpenChangePassword()}
        sessionRemainingSeconds={sessionRemainingSeconds}
        onRefreshSession={handleRefreshSession}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(currentTab === 'tasks' || (currentUser.role !== 'admin' && !['monitor', 'history', 'help'].includes(currentTab))) && (
          <TasksView
            lang={lang}
            tasks={tasks}
            user={currentUser}
            activeTaskIds={activeTaskIds}
            onNewTask={handleCreateNewTask}
            onEditTask={handleEditTask}
            onDuplicateTask={handleDuplicateTask}
            onDeleteTask={handleDeleteTask}
            onRunTask={handleRunTask}
            onRestoreTask={handleRestoreTaskModal}
            onQuickPreview={handleQuickPreview}
          />
        )}

        {currentTab === 'monitor' && (
          <JobMonitorView
            lang={lang}
            jobs={jobs}
            onStopJob={handleStopJob}
            onViewLogs={handleViewLogs}
          />
        )}

        {currentTab === 'history' && (
          <HistoryView
            lang={lang}
            history={history}
            onViewLogs={handleViewLogs}
          />
        )}

        {currentTab === 'rclone' && currentUser.role === 'admin' && (
          <SettingsView
            lang={lang}
            users={users}
            currentUser={currentUser}
            onRefreshUsers={refreshUsers}
            onOpenChangePassword={(id, uname) => handleOpenChangePassword(id, uname)}
            initialSubTab="rclone"
          />
        )}

        {currentTab === 'users' && currentUser.role === 'admin' && (
          <SettingsView
            lang={lang}
            users={users}
            currentUser={currentUser}
            onRefreshUsers={refreshUsers}
            onOpenChangePassword={(id, uname) => handleOpenChangePassword(id, uname)}
            initialSubTab="users"
          />
        )}

        {currentTab === 'settings' && currentUser.role === 'admin' && (
          <SettingsView
            lang={lang}
            users={users}
            currentUser={currentUser}
            onRefreshUsers={refreshUsers}
            onOpenChangePassword={(id, uname) => handleOpenChangePassword(id, uname)}
          />
        )}

        {currentTab === 'audit' && currentUser.role === 'admin' && (
          <AuditLogView lang={lang} />
        )}

        {currentTab === 'help' && (
          <HelpView lang={lang} />
        )}
      </main>

      {/* Modals */}
      <TaskEditModal
        lang={lang}
        isOpen={taskEditModalOpen}
        onClose={() => setTaskEditModalOpen(false)}
        onSave={handleSaveTask}
        initialTask={editingTask}
        existingTasks={tasks}
      />

      <RestoreModal
        lang={lang}
        isOpen={restoreModalOpen}
        onClose={() => {
          setRestoreModalOpen(false);
          setRestoringTask(null);
        }}
        task={restoringTask}
        currentUser={currentUser}
        onConfirmRestore={handleConfirmRestore}
      />

      <QuickCommandPreviewModal
        isOpen={quickPreviewModalOpen}
        onClose={() => setQuickPreviewModalOpen(false)}
        task={previewingTask}
        lang={lang}
      />

      <LogViewerModal
        isOpen={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        job={viewingJob}
        lang={lang}
      />

      <ChangePasswordModal
        lang={lang}
        isOpen={changePasswordModalOpen}
        onClose={() => setChangePasswordModalOpen(false)}
        targetUserId={changePasswordTarget.id}
        targetUsername={changePasswordTarget.username}
      />

      {/* Floating Toast notification */}
      {toast && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-md w-full p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl flex items-start justify-between gap-3 animate-slide-up"
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-1.5 rounded-xl shrink-0 ${
                toast.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                  : toast.type === 'info'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-neutral-900 dark:text-white leading-snug">
                {toast.message}
              </p>
              {toast.actionLabel && toast.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onAction?.();
                    setToast(null);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline pt-0.5"
                >
                  <span>{toast.actionLabel}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </aside>
      )}
    </div>
  );
}
