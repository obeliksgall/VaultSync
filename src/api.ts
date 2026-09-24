import {
  SystemStatus,
  User,
  Task,
  JobExecution,
  GlobalSettings,
  AuditLogEntry,
  FsBrowseResult,
} from './types.ts';

const TOKEN_KEY = 'syncvault_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function removeAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    let errorMsg = `Błąd żądania: ${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {}
    // Keep the real HTTP status on the error object: callers (e.g. saveTask's
    // update->create fallback) must not rely on parsing it out of errorMsg, since
    // the server's JSON `error` text (e.g. "Zadanie nie istnieje.") overwrites it above.
    const error: Error & { status?: number } = new Error(errorMsg);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export const api = {
  // System
  getSystemStatus: () => request<SystemStatus>('/api/system/status'),

  // Auth
  setupAdmin: (username: string, password: string) =>
    request<{ success: boolean; token: string; user: User }>('/api/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  login: (username: string, password: string) =>
    request<{ success: boolean; token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),

  changePassword: (newPassword: string, currentPassword?: string, targetUserId?: string) =>
    request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword, currentPassword, targetUserId }),
    }),

  verifyPassword: (password: string) =>
    request<{ success: boolean }>('/api/auth/verify-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  // Users
  getUsers: () => request<User[]>('/api/users'),

  createUser: (username: string, password: string, role: 'admin' | 'user') =>
    request<{ success: boolean; user: User }>('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    }),

  deleteUser: (id: string) =>
    request<{ success: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),

  // Tasks
  getTasks: () => request<Task[]>('/api/tasks'),

  getTask: (id: string) => request<Task>(`/api/tasks/${id}`),

  createTask: (task: Partial<Task>) =>
    request<{ success: boolean; task: Task }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    }),

  updateTask: (id: string, task: Partial<Task>) =>
    request<{ success: boolean; task: Task }>(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(task),
    }),

  saveTask: async (task: Task) => {
    if (task.id) {
      try {
        return await api.updateTask(task.id, task);
      } catch (err: any) {
        // A 404 here means the task only exists client-side (e.g. a brand-new task
        // whose id was generated in the UI before it was ever persisted) - fall back
        // to creating it. Check the real HTTP status, not the error message text,
        // since the server's JSON `error` field (e.g. "Zadanie nie istnieje.")
        // overwrites the generic "404 ..." message in api.ts's request().
        if (err && err.status === 404) {
          return await api.createTask(task);
        }
        throw err;
      }
    }
    return await api.createTask(task);
  },

  deleteTask: (id: string) =>
    request<{ success: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),

  duplicateTask: (id: string) =>
    request<{ success: boolean; task: Task }>(`/api/tasks/${id}/duplicate`, { method: 'POST' }),

  previewCommand: (task: Partial<Task>, mode: 'backup' | 'restore' = 'backup', selectedPairIds?: string[]) =>
    request<{ commands: string[] }>('/api/tasks/preview-command', {
      method: 'POST',
      body: JSON.stringify({ task, mode, selectedPairIds }),
    }),

  runTask: (id: string) =>
    request<{ success: boolean; job: JobExecution }>(`/api/tasks/${id}/run`, { method: 'POST' }),

  restoreTask: (id: string, selectedPairIds?: string[]) =>
    request<{ success: boolean; job: JobExecution }>(`/api/tasks/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ selectedPairIds }),
    }),

  // Jobs
  getJobs: () => request<JobExecution[]>('/api/jobs'),

  stopJob: (id: string) =>
    request<{ success: boolean }>(`/api/jobs/${id}/stop`, { method: 'POST' }),

  getHistory: (limit?: number) =>
    request<JobExecution[]>(`/api/history${limit ? `?limit=${limit}` : ''}`),

  getJobLogs: (id: string) =>
    request<{ logs: string; filePath?: string }>(`/api/jobs/${id}/logs`),

  // Rclone Config
  getRcloneConfig: () =>
    request<{ path: string; exists: boolean; content: string; remotes: string[] }>('/api/rclone/config'),

  saveRcloneConfig: (content: string) =>
    request<{ success: boolean; message?: string; remotes?: string[] }>('/api/rclone/config', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  // Settings
  getSettings: () => request<GlobalSettings>('/api/settings'),

  updateSettings: (settings: Partial<GlobalSettings>) =>
    request<{ success: boolean; settings: GlobalSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  saveSettings: (settings: Partial<GlobalSettings>) =>
    request<{ success: boolean; settings: GlobalSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  testNotification: (type: 'discord' | 'ntfy' | 'email', customTarget?: string) =>
    request<{ success: boolean; message: string }>('/api/settings/test-notification', {
      method: 'POST',
      body: JSON.stringify({ type, customTarget }),
    }),

  // Audit
  getAuditLogs: () => request<AuditLogEntry[]>('/api/audit'),

  clearAuditLogs: () =>
    request<{ success: boolean; message: string }>('/api/audit/clear', { method: 'POST' }),

  // File system browser
  browseFs: (path?: string) =>
    request<FsBrowseResult>(`/api/fs/browse${path ? `?path=${encodeURIComponent(path)}` : ''}`),

  // Auto-logout in User Management & Session Heartbeat
  heartbeat: () =>
    request<{ success: boolean; expiresAt: number; timeout: string; unlimitedDays: number }>('/api/auth/heartbeat', {
      method: 'POST',
    }),

  getAutoLogoutSettings: () =>
    request<{ autoLogoutTimeout: string; unlimitedDays: number }>('/api/users/auto-logout'),

  updateAutoLogoutSettings: (autoLogoutTimeout: string, unlimitedDays?: number) =>
    request<{ success: boolean; autoLogoutTimeout: string; unlimitedDays: number }>('/api/users/auto-logout', {
      method: 'PUT',
      body: JSON.stringify({ autoLogoutTimeout, unlimitedDays }),
    }),

  // CSV Task Reports
  getTaskFiles: (taskId: string) =>
    request<Array<{ filename: string; filePath: string; type: 'sent' | 'deleted' | 'other'; size: number; createdAt: string }>>(
      `/api/tasks/${taskId}/files`
    ),

  getJobCsvDownloadUrl: (jobId: string, type: 'sent' | 'deleted') => {
    const token = getAuthToken();
    return `/api/jobs/${encodeURIComponent(jobId)}/csv/${type}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  getTaskFileDownloadUrl: (taskId: string, filename: string) => {
    const token = getAuthToken();
    return `/api/tasks/${encodeURIComponent(taskId)}/files/download?file=${encodeURIComponent(filename)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
  },

  // Config Export & Import
  exportConfig: (password: string) =>
    request<{ success: boolean; package: any }>('/api/config/export', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  importConfig: (payload: any, password: string) =>
    request<{ success: boolean; message: string }>('/api/config/import', {
      method: 'POST',
      body: JSON.stringify({ payload, password }),
    }),

  // System / Container logs (/data/logs/logs_YYYY-MM-DD.log)
  getSystemLogs: (date?: string) =>
    request<{ dates: string[]; currentDate: string; logs: string; filename: string; exists: boolean }>(
      `/api/system/logs${date ? `?date=${encodeURIComponent(date)}` : ''}`
    ),

  getSystemLogDownloadUrl: (date?: string) => {
    const token = getAuthToken();
    return `/api/system/logs/download${date ? `?date=${encodeURIComponent(date)}` : ''}${token ? `${date ? '&' : '?'}token=${encodeURIComponent(token)}` : ''}`;
  },
};
