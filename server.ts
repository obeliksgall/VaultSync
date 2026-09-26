import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import {
  loadDatabase,
  getUsers,
  findUserByUsername,
  findUserById,
  createFirstAdmin,
  createUser,
  updateUserPassword,
  deleteUser,
  getTasks,
  getTaskById,
  saveTask,
  deleteTask,
  getSettings,
  updateSettings,
  getAuditLogs,
  addAuditLog,
  clearAuditLogs,
  saveDatabase,
  getHistory,
  getDataDir,
  getLogsDir,
  getFilesDir,
  getPlikiDir,
  resolveTaskFilesDir,
  getTaskDirName,
  getSessionDurationMs,
  getRcloneConfigPath,
  listDatabaseBackups,
  getDatabaseBackupPath,
  StoredUser,
} from './server/db.js';
import {
  checkToolAvailability,
  generateCommandPreview,
  enqueueTask,
  getActiveJobsList,
  getJobById,
  stopJob,
  cancelAndRemoveTaskJobs,
  handleGracefulShutdown,
  isTaskRunningOrQueued,
  cleanupOldCsvReports,
} from './server/executor.js';
import { startScheduler, stopScheduler } from './server/scheduler.js';
import { encryptConfiguration, decryptConfiguration, EncryptedPayload } from './server/crypto.js';
import { sendTestNotification } from './server/notifications.js';
import { User, Task } from './src/types.js';
import {
  initSystemLogger,
  getAvailableSystemLogDates,
  getSystemLogContent,
  getSystemLogFilePath,
  getSystemLogDateStr,
} from './server/systemLogger.js';

// Initialize container and process logging to /data/logs/logs_YYYY-MM-DD.log
initSystemLogger();

// In-memory token store for sessions with activity tracking
const sessions = new Map<string, { userId: string; username: string; role: 'admin' | 'user'; expiresAt: number; lastActivity: number }>();

// Short-lived single-use download tickets (valid for 60s) for direct browser file downloads
const downloadTickets = new Map<string, { userId: string; username: string; role: 'admin' | 'user'; expiresAt: number }>();

// Failed login attempt tracking for brute-force lockout
interface FailedAttemptInfo {
  count: number;
  lockedUntil?: number;
  firstAttempt: number;
}
const failedLogins = new Map<string, FailedAttemptInfo>();

// Extract accurate client IP respecting Forwarded, X-Forwarded-For, or direct socket
function getClientIp(req: Request): string {
  const forwarded = req.headers['forwarded'];
  if (typeof forwarded === 'string') {
    const match = forwarded.match(/for="?([^";,\s]+)"?/i);
    if (match && match[1]) {
      return match[1];
    }
  }
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string') {
    const ip = xForwardedFor.split(',')[0]?.trim();
    if (ip) return ip;
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

// Built-in sliding-window rate limiter for login endpoint (zero external dependencies)
interface IpRateLimitInfo {
  count: number;
  resetAt: number;
}
const ipRateLimits = new Map<string, IpRateLimitInfo>();

function loginLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const settings = getSettings();
  const lockoutMin = settings.loginLockoutMinutes ?? 15;
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = Math.max(10, (settings.loginMaxAttempts ?? 5) * 4);

  const info = ipRateLimits.get(ip);
  if (!info || now > info.resetAt) {
    ipRateLimits.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  info.count++;
  if (info.count > maxAttempts) {
    res.status(429).json({
      error: `Zbyt wiele prób logowania z tego adresu IP. Odczekaj ${lockoutMin} minut przed kolejną próbą.`,
    });
    return;
  }

  next();
}

function checkAccountLockout(identifier: string): { locked: boolean; waitSeconds?: number } {
  const now = Date.now();
  const info = failedLogins.get(identifier);
  if (!info) return { locked: false };
  if (info.lockedUntil && now < info.lockedUntil) {
    const waitSeconds = Math.ceil((info.lockedUntil - now) / 1000);
    return { locked: true, waitSeconds };
  }
  if (info.lockedUntil && now >= info.lockedUntil) {
    failedLogins.delete(identifier);
    return { locked: false };
  }
  const settings = getSettings();
  const lockoutMin = settings.loginLockoutMinutes ?? 15;
  const windowMs = lockoutMin * 60 * 1000;
  if (now - info.firstAttempt > windowMs) {
    failedLogins.delete(identifier);
    return { locked: false };
  }
  return { locked: false };
}

function recordFailedLogin(identifier: string): boolean {
  const now = Date.now();
  const settings = getSettings();
  const lockoutMin = settings.loginLockoutMinutes ?? 15;
  const maxAttempts = settings.loginMaxAttempts ?? 5;
  const windowMs = lockoutMin * 60 * 1000;
  const lockoutMs = lockoutMin * 60 * 1000;

  let info = failedLogins.get(identifier);
  if (!info || (now - info.firstAttempt > windowMs)) {
    info = { count: 1, firstAttempt: now };
  } else {
    info.count += 1;
  }
  if (info.count >= maxAttempts) {
    info.lockedUntil = now + lockoutMs;
    failedLogins.set(identifier, info);
    return true;
  }
  failedLogins.set(identifier, info);
  return false;
}

function recordSuccessfulLogin(identifier: string): void {
  failedLogins.delete(identifier);
}

// Periodic background sweep for expired sessions, download tickets, and lockouts (runs every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of sessions.entries()) {
    if (now > s.expiresAt) {
      sessions.delete(token);
    }
  }
  for (const [ticket, t] of downloadTickets.entries()) {
    if (now > t.expiresAt) {
      downloadTickets.delete(ticket);
    }
  }
  for (const [key, f] of failedLogins.entries()) {
    if (f.lockedUntil && now > f.lockedUntil + 60000) {
      failedLogins.delete(key);
    } else if (!f.lockedUntil && now - f.firstAttempt > 30 * 60 * 1000) {
      failedLogins.delete(key);
    }
  }
  for (const [ip, l] of ipRateLimits.entries()) {
    if (now > l.resetAt) {
      ipRateLimits.delete(ip);
    }
  }
}, 60 * 1000);

// Sanitized API error responder (prevents leaking internal filesystem paths or raw stacks)
function sendError(res: Response, status: number, defaultMessage: string, err?: any): void {
  if (err) {
    console.error(`[SyncVault API Error ${status}] ${defaultMessage}:`, err);
  }
  const rawMsg = typeof err === 'string' ? err : (err?.message || '');
  const hasSystemPath = rawMsg.includes('/') || rawMsg.includes('\\') || rawMsg.includes('ENOENT') || rawMsg.includes('EACCES');
  const hasStack = rawMsg.includes('at ') || rawMsg.includes('node:internal');

  if (rawMsg && !hasSystemPath && !hasStack && rawMsg.length < 150) {
    res.status(status).json({ error: rawMsg });
  } else {
    res.status(status).json({ error: defaultMessage });
  }
}

function createSession(user: StoredUser): string {
  const token = crypto.randomBytes(32).toString('hex');
  const settings = getSettings();
  const durationMs = getSessionDurationMs(settings);
  const now = Date.now();
  sessions.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: now + durationMs,
    lastActivity: now,
  });
  return token;
}

function getSessionUser(req: Request): { userId: string; username: string; role: 'admin' | 'user' } | null {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // Accept short-lived, single-use download ticket (for direct file downloads via browser)
  if (!token && req.query && typeof req.query.ticket === 'string') {
    const ticketStr = req.query.ticket;
    const ticket = downloadTickets.get(ticketStr);
    if (ticket && Date.now() <= ticket.expiresAt) {
      downloadTickets.delete(ticketStr); // single-use: consumed immediately
      return {
        userId: ticket.userId,
        username: ticket.username,
        role: ticket.role,
      };
    }
    return null;
  }

  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  // Extend session if user performed any action or sent activity header
  // Periodic background status pollers without explicit activity do not prolong session
  const isPassiveStatusPoll = req.path === '/api/jobs' || req.path === '/api/system/status';
  const hasUserActivity = req.headers['x-user-activity'] === 'true' || req.headers['x-user-activity'] === '1' || !isPassiveStatusPoll;

  if (hasUserActivity) {
    const settings = getSettings();
    const durationMs = getSessionDurationMs(settings);
    session.lastActivity = Date.now();
    session.expiresAt = Date.now() + durationMs;
  }

  return session;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Brak autoryzacji lub sesja wygasła.' });
    return;
  }
  (req as any).user = user;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Brak autoryzacji.' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Wymagane uprawnienia administratora.' });
    return;
  }
  (req as any).user = user;
  next();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable trust proxy so Express correctly resolves client IP behind reverse proxy / load balancer
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '15mb' }));

  // Diagnostic boot log: helps definitively confirm whether /data was seen
  // as empty (fresh volume/wrong path) vs. an actual in-app data-loss bug.
  {
    const resolvedDataDir = getDataDir();
    const dbFileExisted = fs.existsSync(path.join(resolvedDataDir, 'syncvault-db.json'));
    console.log(`[SyncVault] Boot diagnostics: DATA_DIR="${resolvedDataDir}" | syncvault-db.json existed at boot: ${dbFileExisted}`);
  }

  // Seed default sample task if no tasks exist
  const db = loadDatabase();
  console.log(`[SyncVault] Boot diagnostics: loaded ${db.users.length} user(s), ${db.tasks.length} task(s) from disk.`);
  if (db.tasks.length === 0) {
    const sampleTask: Task = {
      id: crypto.randomUUID(),
      name: 'Kopia wolumenów (Docker)',
      description: 'Przykładowa synchronizacja danych aplikacji i bazy do katalogu kopii zapasowej',
      tags: ['docker', 'kopia-lokalna', 'mirror'],
      engine: 'rclone',
      type: 'mirror',
      pairs: [
        {
          id: crypto.randomUUID(),
          source: '/data/app_storage',
          destination: '/data/backups/app_storage',
        },
        {
          id: crypto.randomUUID(),
          source: '/data/database_dump',
          destination: '/data/backups/database_dump',
        },
      ],
      customFlags: '',
      scheduleEnabled: true,
      schedules: [
        {
          id: crypto.randomUUID(),
          type: 'daily',
          time: '02:00',
          enabled: true,
        },
        {
          id: crypto.randomUUID(),
          type: 'weekly',
          time: '04:00',
          daysOfWeek: [0], // Sunday
          enabled: true,
        },
      ],
      runAfterTaskId: null,
      excludeFilters: ['*.tmp', '*.log', 'node_modules/', '.cache/'],
      restoreEnabled: true,
      logRetentionDays: 30,
      trashEnabled: true,
      trashRetentionDays: 14,
      notifications: {
        enabled: true,
        trigger: 'all',
        discord: true,
        ntfy: true,
        email: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.tasks.push(sampleTask);
    addAuditLog('SYSTEM', 'INIT_SAMPLE', 'Utworzono przykładowe zadanie kopii zapasowej');
  }

  // --- REST API ENDPOINTS ---

  // Root API Information & Healthcheck
  app.get(['/api', '/api/', '/api/health', '/api/health/'], (req: Request, res: Response) => {
    res.json({
      name: 'SyncVault REST API',
      status: 'online',
      version: '1.0.0',
      description: 'Zarządzanie zadaniami synchronizacji rsync/rclone, harmonogramem i raportami',
      endpoints: {
        systemStatus: 'GET /api/system/status',
        auth: {
          login: 'POST /api/auth/login',
          me: 'GET /api/auth/me',
          renew: 'POST /api/auth/renew',
          changePassword: 'POST /api/auth/change-password',
        },
        tasks: {
          list: 'GET /api/tasks',
          create: 'POST /api/tasks',
          get: 'GET /api/tasks/:id',
          update: 'PUT /api/tasks/:id',
          delete: 'DELETE /api/tasks/:id',
          run: 'POST /api/tasks/:id/run',
          restore: 'POST /api/tasks/:id/restore',
          csvFiles: 'GET /api/tasks/:id/files',
        },
        jobs: {
          active: 'GET /api/jobs/active',
          cancel: 'POST /api/jobs/:id/cancel',
        },
        history: 'GET /api/history',
        settings: 'GET /api/settings',
        audit: 'GET /api/audit',
      },
    });
  });

  // 1. System status
  app.get('/api/system/status', (req: Request, res: Response) => {
    const users = getUsers();
    const isSetupComplete = users.length > 0;
    const sessionUser = getSessionUser(req);
    const tools = checkToolAvailability();
    const activeJobs = getActiveJobsList();
    const settings = getSettings();

    res.json({
      isSetupComplete,
      currentUser: sessionUser ? { id: sessionUser.userId, username: sessionUser.username, role: sessionUser.role, createdAt: '' } : null,
      rcloneAvailable: tools.rclone,
      rsyncAvailable: tools.rsync,
      rcloneVersion: tools.rcloneVer,
      rsyncVersion: tools.rsyncVer,
      activeJobsCount: activeJobs.filter(j => j.status === 'running').length,
      queuedJobsCount: activeJobs.filter(j => j.status === 'queued').length,
      dataDir: getDataDir(),
      logsDir: getLogsDir(),
      rcloneConfigExists: fs.existsSync(getRcloneConfigPath()),
      autoLogoutTimeout: settings.autoLogoutTimeout || '30m',
      unlimitedDays: settings.unlimitedDays || 7,
    });
  });

  // 2. Auth: Initial Admin Setup
  app.post('/api/auth/setup-admin', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password || username.length < 3 || password.length < 9) {
      res.status(400).json({ error: 'Nazwa użytkownika (min. 3 znaki) i hasło (min. 9 znaków) są wymagane.' });
      return;
    }

    const users = getUsers();
    if (users.length > 0) {
      res.status(400).json({ error: 'Konto administratora zostało już utworzone.' });
      return;
    }

    try {
      const admin = await createFirstAdmin(username.trim(), password);
      const stored = findUserById(admin.id)!;
      const token = createSession(stored);
      res.json({ success: true, token, user: admin });
    } catch (e: any) {
      sendError(res, 400, 'Błąd konfiguracji administratora.', e);
    }
  });

  // 3. Auth: Login (with rate limiting and brute-force lockout)
  app.post('/api/auth/login', loginLimiter, async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Podaj nazwę użytkownika i hasło.' });
      return;
    }

    const clientIp = getClientIp(req);
    const cleanUsername = String(username).trim();

    // Check account or IP lockout
    const ipLockout = checkAccountLockout(clientIp);
    const userLockout = checkAccountLockout(cleanUsername.toLowerCase());
    if (ipLockout.locked || userLockout.locked) {
      const waitSeconds = Math.max(ipLockout.waitSeconds || 0, userLockout.waitSeconds || 0);
      res.status(429).json({
        error: `Konto lub adres IP zostało zablokowane z powodu zbyt wielu nieudanych prób logowania. Odczekaj ${waitSeconds}s przed kolejną próbą.`,
      });
      return;
    }

    const user = findUserByUsername(cleanUsername);
    const isPasswordValid = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !isPasswordValid) {
      const ipLocked = recordFailedLogin(clientIp);
      const userLocked = recordFailedLogin(cleanUsername.toLowerCase());
      addAuditLog(cleanUsername, 'LOGIN_FAILED', 'Nieudana próba logowania', clientIp);

      if (ipLocked || userLocked) {
        const lockoutMin = getSettings().loginLockoutMinutes ?? 15;
        addAuditLog(cleanUsername, 'LOGIN_LOCKOUT', `Konto lub adres IP (${clientIp}) zablokowane na ${lockoutMin} minut po przekroczeniu ${getSettings().loginMaxAttempts ?? 5} nieudanych prób logowania`, clientIp);
        res.status(429).json({
          error: `Zbyt wiele nieudanych prób logowania. Konto zostało tymczasowo zablokowane na ${lockoutMin} minut.`,
        });
        return;
      }

      res.status(401).json({ error: 'Nieprawidłowa nazwa użytkownika lub hasło.' });
      return;
    }

    recordSuccessfulLogin(clientIp);
    recordSuccessfulLogin(cleanUsername.toLowerCase());

    const token = createSession(user);
    addAuditLog(user.username, 'LOGIN_SUCCESS', `Zalogowano do panelu (${user.role})`, clientIp);
    const { passwordHash: _, ...safeUser } = user;
    res.json({ success: true, token, user: safeUser });
  });

  // 4. Auth: Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      sessions.delete(token);
    }
    res.json({ success: true });
  });

  // 4b. Auth: Heartbeat & Active Session Touch
  app.post('/api/auth/heartbeat', requireAuth, (req: Request, res: Response) => {
    const settings = getSettings();
    const token = req.headers.authorization?.substring(7);
    if (token && sessions.has(token)) {
      const session = sessions.get(token)!;
      session.lastActivity = Date.now();
      session.expiresAt = Date.now() + getSessionDurationMs(settings);
      res.json({
        success: true,
        expiresAt: session.expiresAt,
        timeout: settings.autoLogoutTimeout || '30m',
        unlimitedDays: settings.unlimitedDays || 7,
      });
      return;
    }
    res.json({ success: true });
  });

  // 4c. Auth: Issue short-lived, single-use download ticket (60s validity)
  app.post('/api/auth/download-ticket', requireAuth, (req: Request, res: Response) => {
    const user = (req as any).user;
    const ticket = crypto.randomBytes(32).toString('hex');
    downloadTickets.set(ticket, {
      userId: user.userId,
      username: user.username,
      role: user.role,
      expiresAt: Date.now() + 60 * 1000,
    });
    res.json({ ticket });
  });

  // 5. Auth: Change Password
  app.post('/api/auth/change-password', requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { currentPassword, newPassword, targetUserId } = req.body;

    if (!newPassword || newPassword.length < 9) {
      res.status(400).json({ error: 'Nowe hasło musi mieć minimum 9 znaków.' });
      return;
    }

    const targetId = targetUserId && user.role === 'admin' ? targetUserId : user.userId;
    const target = findUserById(targetId);
    if (!target) {
      res.status(404).json({ error: 'Użytkownik nie istnieje.' });
      return;
    }

    // If changing own password, verify current password
    if (targetId === user.userId) {
      const isCurrentValid = currentPassword ? await bcrypt.compare(currentPassword, target.passwordHash) : false;
      if (!isCurrentValid) {
        res.status(400).json({ error: 'Aktualne hasło jest nieprawidłowe.' });
        return;
      }
    }

    try {
      await updateUserPassword(targetId, newPassword, user.username);
      res.json({ success: true, message: 'Hasło zostało pomyślnie zmienione.' });
    } catch (e: any) {
      sendError(res, 400, 'Błąd zmiany hasła.', e);
    }
  });

  // 5b. Auth: Verify Password (for sensitive actions like unlocking rclone.conf)
  app.post('/api/auth/verify-password', requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: 'Podaj hasło do weryfikacji.' });
      return;
    }
    const target = findUserById(user.userId);
    const isMatch = target ? await bcrypt.compare(password, target.passwordHash) : false;
    if (!isMatch) {
      res.status(401).json({ error: 'Nieprawidłowe hasło.' });
      return;
    }
    res.json({ success: true });
  });

  // 6. Users management (Admin only)
  app.get('/api/users', requireAdmin, (req: Request, res: Response) => {
    res.json(getUsers());
  });

  app.post('/api/users', requireAdmin, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { username, password, role } = req.body;

    if (!username || !password || username.length < 3 || password.length < 9) {
      res.status(400).json({ error: 'Nazwa użytkownika (min. 3 znaki) i hasło (min. 9 znaków) są wymagane.' });
      return;
    }

    try {
      const created = await createUser(user.username, username.trim(), password, role === 'admin' ? 'admin' : 'user');
      res.json({ success: true, user: created });
    } catch (e: any) {
      sendError(res, 400, 'Błąd tworzenia użytkownika.', e);
    }
  });

  app.delete('/api/users/:id', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user;
    try {
      deleteUser(req.params.id, user.username);
      res.json({ success: true });
    } catch (e: any) {
      sendError(res, 400, 'Błąd usuwania użytkownika.', e);
    }
  });

  // 6b. Auto-logout Configuration (Managed in User Management)
  app.get('/api/users/auto-logout', requireAdmin, (req: Request, res: Response) => {
    const settings = getSettings();
    res.json({
      autoLogoutTimeout: settings.autoLogoutTimeout || '30m',
      unlimitedDays: settings.unlimitedDays || 7,
    });
  });

  app.put('/api/users/auto-logout', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user;
    const { autoLogoutTimeout, unlimitedDays } = req.body;

    const validTimeouts = ['30m', '1h', '3h', 'unlimited'];
    if (autoLogoutTimeout && !validTimeouts.includes(autoLogoutTimeout)) {
      res.status(400).json({ error: 'Nieprawidłowa wartość autowylogowania. Wybierz 30m, 1h, 3h lub unlimited.' });
      return;
    }

    const daysNum = typeof unlimitedDays === 'number' ? Math.min(28, Math.max(1, unlimitedDays)) : undefined;

    const updated = updateSettings({
      autoLogoutTimeout,
      unlimitedDays: daysNum,
    }, user.username);

    addAuditLog(
      user.username,
      'UPDATE_AUTO_LOGOUT',
      `Zmieniono czas automatycznego wylogowania na ${autoLogoutTimeout}${autoLogoutTimeout === 'unlimited' ? ` (${daysNum ?? 7} dni)` : ''}`
    );

    res.json({
      success: true,
      autoLogoutTimeout: updated.autoLogoutTimeout || '30m',
      unlimitedDays: updated.unlimitedDays || 7,
    });
  });

  // 7. Tasks
  app.get('/api/tasks', requireAuth, (req: Request, res: Response) => {
    res.json(getTasks());
  });

  app.get('/api/tasks/:id', requireAuth, (req: Request, res: Response) => {
    const task = getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Zadanie nie zostało znalezione.' });
      return;
    }
    res.json(task);
  });

  app.post('/api/tasks', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user;
    const data = req.body;

    if (!data.name || !data.pairs || data.pairs.length === 0) {
      res.status(400).json({ error: 'Nazwa oraz co najmniej jedna para źródło->cel są wymagane.' });
      return;
    }

    const newTask: Task = {
      id: crypto.randomUUID(),
      name: data.name.trim(),
      description: data.description || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      engine: data.engine === 'rsync' ? 'rsync' : 'rclone',
      type: data.type === 'copy' ? 'copy' : data.type === 'move' ? 'move' : 'mirror',
      rsyncFlagsMode: data.engine === 'rsync' ? (data.rsyncFlagsMode === 'rtv' ? 'rtv' : 'avh') : undefined,
      pairs: data.pairs.map((p: any) => ({
        id: p.id || crypto.randomUUID(),
        source: p.source.trim(),
        destination: p.destination.trim(),
      })),
      customFlags: data.customFlags || '',
      scheduleEnabled: !!data.scheduleEnabled,
      schedules: (data.schedules || []).slice(0, 30).map((s: any) => ({
        id: s.id || crypto.randomUUID(),
        type: s.type || 'daily',
        time: s.time || '00:00',
        daysOfWeek: s.daysOfWeek || [],
        dayOfMonth: s.dayOfMonth,
        daysOfMonth: Array.isArray(s.daysOfMonth) ? s.daysOfMonth : undefined,
        date: s.date,
        enabled: s.enabled !== false,
      })),
      runAfterTaskId: data.runAfterTaskId || null,
      excludeFilters: Array.isArray(data.excludeFilters) ? data.excludeFilters : [],
      restoreEnabled: data.restoreEnabled !== false,
      logRetentionDays: data.logRetentionDays !== undefined ? data.logRetentionDays : null,
      trashEnabled: !!data.trashEnabled,
      trashRetentionDays: data.trashRetentionDays ?? 14,
      oneDriveLongPathsHandling: data.oneDriveLongPathsHandling !== false,
      notifications: data.notifications || { enabled: true, trigger: 'all', discord: true, ntfy: true, email: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveTask(newTask, user.username, true);
    res.json({ success: true, task: newTask });
  });

  app.put('/api/tasks/:id', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user;
    const task = getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Zadanie nie istnieje.' });
      return;
    }

    if (isTaskRunningOrQueued(req.params.id)) {
      res.status(400).json({
        error: 'Zadanie jest aktualnie uruchomione lub oczekuje w kolejce. Nie można edytować zadania w trakcie pracy.',
      });
      return;
    }

    const data = req.body;
    const updated: Task = {
      ...task,
      name: data.name ? data.name.trim() : task.name,
      description: data.description !== undefined ? data.description : task.description,
      tags: Array.isArray(data.tags) ? data.tags : task.tags,
      engine: data.engine || task.engine,
      type: data.type || task.type,
      rsyncFlagsMode: (data.engine || task.engine) === 'rsync'
        ? (data.rsyncFlagsMode !== undefined ? data.rsyncFlagsMode : (task.rsyncFlagsMode || 'avh'))
        : undefined,
      pairs: data.pairs ? data.pairs.map((p: any) => ({
        id: p.id || crypto.randomUUID(),
        source: p.source.trim(),
        destination: p.destination.trim(),
      })) : task.pairs,
      customFlags: data.customFlags !== undefined ? data.customFlags : task.customFlags,
      scheduleEnabled: data.scheduleEnabled !== undefined ? data.scheduleEnabled : task.scheduleEnabled,
      schedules: (data.schedules || []).slice(0, 30).map((s: any) => ({
        id: s.id || crypto.randomUUID(),
        type: s.type || 'daily',
        time: s.time || '00:00',
        daysOfWeek: s.daysOfWeek || [],
        dayOfMonth: s.dayOfMonth,
        daysOfMonth: Array.isArray(s.daysOfMonth) ? s.daysOfMonth : undefined,
        date: s.date,
        enabled: s.enabled !== false,
      })),
      runAfterTaskId: data.runAfterTaskId !== undefined ? data.runAfterTaskId : task.runAfterTaskId,
      excludeFilters: Array.isArray(data.excludeFilters) ? data.excludeFilters : task.excludeFilters,
      restoreEnabled: data.restoreEnabled !== undefined ? data.restoreEnabled : task.restoreEnabled,
      logRetentionDays: data.logRetentionDays !== undefined ? data.logRetentionDays : task.logRetentionDays,
      trashEnabled: data.trashEnabled !== undefined ? data.trashEnabled : task.trashEnabled,
      trashRetentionDays: data.trashRetentionDays !== undefined ? data.trashRetentionDays : task.trashRetentionDays,
      oneDriveLongPathsHandling: data.oneDriveLongPathsHandling !== undefined ? data.oneDriveLongPathsHandling : (task.oneDriveLongPathsHandling !== false),
      notifications: data.notifications || task.notifications,
      updatedAt: new Date().toISOString(),
    };

    saveTask(updated, user.username, false);
    res.json({ success: true, task: updated });
  });

  app.delete('/api/tasks/:id', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user;
    // Cancel any active/queued processes for this task and remove them from Job Monitor
    cancelAndRemoveTaskJobs(req.params.id, user.username);
    // Delete task definition, history records, and folders from disk
    deleteTask(req.params.id, user.username);
    res.json({ success: true });
  });

  app.post('/api/tasks/:id/duplicate', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user;
    const original = getTaskById(req.params.id);
    if (!original) {
      res.status(404).json({ error: 'Zadanie nie istnieje.' });
      return;
    }

    // Determine unique name with _001, _002, etc.
    const allTasks = getTasks();
    const baseName = original.name.replace(/_\d{3}$/, '');
    let counter = 1;
    let candidateName = `${baseName}_${String(counter).padStart(3, '0')}`;
    while (allTasks.some(t => t.name.trim().toLowerCase() === candidateName.trim().toLowerCase())) {
      counter++;
      candidateName = `${baseName}_${String(counter).padStart(3, '0')}`;
    }

    const duplicated: Task = {
      ...original,
      id: crypto.randomUUID(),
      taskNumber: undefined, // auto-assigned sequentially by saveTask (never reused)
      name: candidateName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pairs: original.pairs.map(p => ({ ...p, id: crypto.randomUUID() })),
      schedules: original.schedules.map(s => ({ ...s, id: crypto.randomUUID() })),
    };

    saveTask(duplicated, user.username, true);
    res.json({ success: true, task: duplicated });
  });

  // Command preview generator
  app.post('/api/tasks/preview-command', requireAuth, (req: Request, res: Response) => {
    const { task, mode, selectedPairIds } = req.body;
    if (!task) {
      res.status(400).json({ error: 'Brak danych zadania.' });
      return;
    }
    const commands = generateCommandPreview(task, mode || 'backup', selectedPairIds);
    res.json({ commands });
  });

  // Run Task (Backup) - available to both admin and normal user
  app.post('/api/tasks/:id/run', requireAuth, (req: Request, res: Response) => {
    const user = (req as any).user;
    const task = getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Zadanie nie istnieje.' });
      return;
    }

    try {
      const job = enqueueTask(task, 'backup', undefined, user.username);
      res.json({ success: true, job });
    } catch (e: any) {
      sendError(res, 400, 'Błąd uruchamiania zadania.', e);
    }
  });

  // Run Restore - available to both admin and normal user (if task.restoreEnabled)
  // When triggered by an operator (non-admin), password verification is strictly required
  app.post('/api/tasks/:id/restore', requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const task = getTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Zadanie nie istnieje.' });
      return;
    }

    if (!task.restoreEnabled) {
      res.status(403).json({ error: 'Funkcja przywracania (Restore) jest wyłączona dla tego zadania.' });
      return;
    }

    // Restore przez operatora - po kliknięciu Potwierdź i Uruchom restore MUSI wpisać hasło
    if (user.role !== 'admin') {
      const { password } = req.body;
      if (!password || typeof password !== 'string') {
        res.status(400).json({ error: 'Procedura przywracania danych (RESTORE) wymaga wpisania hasła konta operatora.' });
        return;
      }
      const dbUser = findUserById(user.userId);
      if (!dbUser) {
        res.status(401).json({ error: 'Użytkownik nie istnieje.' });
        return;
      }
      const isPasswordValid = await bcrypt.compare(password, dbUser.passwordHash);
      if (!isPasswordValid) {
        addAuditLog(user.username, 'RESTORE_PASSWORD_FAIL', `Nieudana autoryzacja hasłem procedury Restore dla zadania "${task.name}"`);
        res.status(401).json({ error: 'Nieprawidłowe hasło użytkownika. Procedura Restore została zablokowana.' });
        return;
      }
    }

    const { selectedPairIds } = req.body; // e.g. undefined for all, or array of pair IDs
    try {
      const job = enqueueTask(task, 'restore', selectedPairIds, `${user.username} (RESTORE)`);
      addAuditLog(user.username, 'START_TASK_RESTORE', `Uruchomiono procedurę przywracania danych (RESTORE) dla zadania "${task.name}"`);
      res.json({ success: true, job });
    } catch (e: any) {
      sendError(res, 400, 'Błąd uruchamiania procedury restore.', e);
    }
  });

  // 8. Job Monitor & History
  app.get('/api/jobs', requireAuth, (req: Request, res: Response) => {
    const settings = getSettings();
    const active = getActiveJobsList();
    const limit = settings.jobMonitorLimit || 25;
    const recent = getHistory(limit);

    // Merge active jobs on top of recent unique ones
    const seen = new Set<string>();
    const combined = [];

    for (const a of active) {
      seen.add(a.id);
      combined.push(a);
    }
    for (const r of recent) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        combined.push(r);
      }
    }

    res.json(combined.slice(0, limit));
  });

  app.post('/api/jobs/:id/stop', requireAuth, (req: Request, res: Response) => {
    const user = (req as any).user;
    const success = stopJob(req.params.id, user.username);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Zadanie nie jest aktywne lub już się zakończyło.' });
    }
  });

  app.get('/api/history', requireAuth, (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string, 10) || undefined;
    res.json(getHistory(limit));
  });

  app.get('/api/jobs/:id/logs', requireAuth, (req: Request, res: Response) => {
    const job = getJobById(req.params.id) || getHistory().find(h => h.id === req.params.id);
    if (!job || !job.logFile) {
      res.status(404).json({ error: 'Logi dla tego zadania nie zostały znalezione.' });
      return;
    }

    const fullLogPath = path.join(getLogsDir(), job.logFile);
    if (!fs.existsSync(fullLogPath)) {
      res.json({ logs: `[Brak pliku logów pod ścieżką: ${job.logFile}]` });
      return;
    }

    try {
      const logs = fs.readFileSync(fullLogPath, 'utf-8');
      res.json({ logs, filePath: job.logFile });
    } catch (e: any) {
      sendError(res, 500, 'Błąd odczytu pliku logów zadania.', e);
    }
  });

  app.get('/api/jobs/:id/download-log', requireAuth, (req: Request, res: Response) => {
    const job = getJobById(req.params.id) || getHistory().find(h => h.id === req.params.id);
    if (!job || !job.logFile) {
      res.status(404).send('Logi dla tego zadania nie zostały znalezione.');
      return;
    }

    const fullLogPath = path.join(getLogsDir(), job.logFile);
    if (!fs.existsSync(fullLogPath)) {
      res.status(404).send(`Brak pliku logów pod ścieżką: ${job.logFile}`);
      return;
    }

    const filename = job.logFile.split('/').pop() || `${job.taskName}_${job.id}.log`;
    res.download(fullLogPath, filename);
  });

  app.get('/api/jobs/:id/onedrive-report', requireAuth, (req: Request, res: Response) => {
    const job = getJobById(req.params.id) || getHistory().find(h => h.id === req.params.id);
    if (!job || !job.oneDriveLongPaths || job.oneDriveLongPaths.length === 0) {
      res.status(404).send('Brak raportu OneDrive dla tego zadania.');
      return;
    }

    const reportFilename = `onedrive_400char_skipped_${job.id}.txt`;
    const logsDir = getLogsDir();
    let diskPath: string | null = null;

    if (job.logFile) {
      const taskFolder = path.dirname(path.join(logsDir, job.logFile));
      if (fs.existsSync(taskFolder)) {
        diskPath = path.join(taskFolder, reportFilename);
      }
    }

    const reportContent =
      `================================================================================\n` +
      `SyncVault - Raport plików pominiętych z powodu limitu 400 znaków OneDrive\n` +
      `================================================================================\n` +
      `Zadanie: ${job.taskName}\n` +
      `Job ID: ${job.id}\n` +
      `Data wykonania: ${job.startTime}\n` +
      `Liczba pominiętych plików: ${job.oneDriveLongPaths.length}\n\n` +
      `UWAGA: Microsoft OneDrive oraz SharePoint narzucają sztywny limit maksymalnie 400 znaków\n` +
      `dla pełnej ścieżki URL pliku i katalogu. W przypadku użycia szyfrowania rclone (crypt)\n` +
      `ścieżki są kodowane i ulegają wydłużeniu o ok. 1.6x, co powoduje odrzucenie pliku przez chmurę.\n\n` +
      `Lista pominiętych plików:\n` +
      `--------------------------------------------------------------------------------\n` +
      job.oneDriveLongPaths.map((p, i) => `${i + 1}. [Długość: ${p.length} zn.] ${p}`).join('\n') +
      `\n--------------------------------------------------------------------------------\n`;

    if (diskPath) {
      if (!fs.existsSync(diskPath)) {
        try {
          fs.writeFileSync(diskPath, reportContent, 'utf-8');
        } catch (e) {
          console.error('[OneDrive Report] Error writing report file to disk:', e);
        }
      }
      res.download(diskPath, reportFilename);
      return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${reportFilename}"`);
    res.send(reportContent);
  });

  // 8c. Daily System / Container Logs (/data/logs/logs_YYYY-MM-DD.log) - Admin only
  app.get('/api/system/logs', requireAdmin, (req: Request, res: Response) => {
    const date = req.query.date as string | undefined;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Nieprawidłowy format daty logu (oczekiwano formatu YYYY-MM-DD).' });
      return;
    }
    const dates = getAvailableSystemLogDates();
    const logData = getSystemLogContent(date);
    res.json({
      dates,
      currentDate: date || getSystemLogDateStr(),
      logs: logData.content,
      filename: logData.filename,
      exists: logData.exists,
    });
  });

  app.get('/api/system/logs/download', requireAdmin, (req: Request, res: Response) => {
    const date = req.query.date as string | undefined;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).send('Nieprawidłowy format daty logu (oczekiwano formatu YYYY-MM-DD).');
      return;
    }
    try {
      const filePath = getSystemLogFilePath(date);
      if (!fs.existsSync(filePath)) {
        res.status(404).send('Plik logów systemowych dla wybranej daty nie istnieje.');
        return;
      }
      const filename = path.basename(filePath);
      res.download(filePath, filename);
    } catch (e: any) {
      console.error('[SyncVault API Error 400] Błąd odczytu pliku logów:', e);
      res.status(400).send('Błąd odczytu pliku logów.');
    }
  });

  // 8d. Database Safety Backups (/data/backupdb/syncvault-db_YYYY-MM-DD_HH-mm-ss.json)
  app.get('/api/system/db-backups', requireAdmin, (req: Request, res: Response) => {
    res.json(listDatabaseBackups());
  });

  app.get('/api/system/db-backups/download', requireAdmin, (req: Request, res: Response) => {
    const filename = req.query.file as string | undefined;
    if (!filename) {
      res.status(400).send('Nie podano nazwy pliku kopii bazy.');
      return;
    }
    const filePath = getDatabaseBackupPath(filename);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).send('Plik kopii zapasowej bazy danych nie istnieje.');
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.download(filePath, filename);
  });

  // 8b. CSV Reports for Jobs and Tasks (data/pliki/<id_zadanie>/)
  app.get('/api/jobs/:id/csv/:type', requireAuth, (req: Request, res: Response) => {
    const type = req.params.type as 'sent' | 'deleted';
    if (type !== 'sent' && type !== 'deleted') {
      res.status(400).send('Nieprawidłowy typ raportu CSV. Dozwolone: sent, deleted.');
      return;
    }

    const job = getJobById(req.params.id) || getHistory().find(h => h.id === req.params.id);
    if (!job) {
      res.status(404).send('Zadanie nie zostało znalezione.');
      return;
    }

    let relPath = type === 'sent' ? (job.csvFiles?.sentFile || job.csvFiles?.sent) : (job.csvFiles?.deletedFile || job.csvFiles?.deleted);

    let fullPath = relPath ? path.join(getDataDir(), relPath) : '';
    if (relPath && fullPath && !fs.existsSync(fullPath)) {
      // Check alternative path (files/ vs pliki/)
      const altRelPath = relPath.startsWith('pliki/')
        ? relPath.replace(/^pliki\//, 'files/')
        : relPath.replace(/^files\//, 'pliki/');
      const altFullPath = path.join(getDataDir(), altRelPath);
      if (fs.existsSync(altFullPath)) {
        fullPath = altFullPath;
      } else {
        fullPath = '';
      }
    }

    // Fallback: Check in resolved task directory if not directly found
    if (!fullPath) {
      const task = getTasks().find(t => t.id === job.taskId);
      const taskFilesDir = task ? resolveTaskFilesDir(task) : path.join(getFilesDir(), job.taskId);
      if (fs.existsSync(taskFilesDir)) {
        const files = fs.readdirSync(taskFilesDir);
        const suffix = type === 'sent' ? '_wyslane.csv' : '_usuniete.csv';
        const match = files.find(f => f.includes(job.id.slice(0, 8)) && f.endsWith(suffix));
        if (match) {
          fullPath = path.join(taskFilesDir, match);
        }
      }
    }

    if (!fullPath || !fs.existsSync(fullPath)) {
      res.status(404).send(`Raport CSV (${type === 'sent' ? 'wysłane pliki' : 'usunięte pliki'}) nie został odnaleziony.`);
      return;
    }

    const downloadName = path.basename(fullPath);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.download(fullPath, downloadName);
  });

  // List all CSV report files for a Task in data/files/<taskNumber>_<safeTaskName>/ (Admin only)
  app.get('/api/tasks/:id/files', requireAdmin, (req: Request, res: Response) => {
    const taskId = req.params.id;
    const task = getTasks().find(t => t.id === taskId);
    const taskFilesDir = task ? resolveTaskFilesDir(task) : path.join(getFilesDir(), taskId);
    if (!fs.existsSync(taskFilesDir)) {
      res.json([]);
      return;
    }

    try {
      const dirBasename = path.basename(taskFilesDir);
      const filenames = fs.readdirSync(taskFilesDir);
      const items = filenames
        .filter(fn => fn.endsWith('.csv'))
        .map(fn => {
          const fullPath = path.join(taskFilesDir, fn);
          const stat = fs.statSync(fullPath);
          const isSent = fn.includes('_sent') || fn.includes('_wyslane');
          const isDeleted = fn.includes('_deleted') || fn.includes('_usuniete');
          return {
            filename: fn,
            filePath: `files/${dirBasename}/${fn}`,
            type: isSent ? 'sent' : isDeleted ? 'deleted' : 'other',
            size: stat.size,
            createdAt: stat.mtime.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(items);
    } catch (e: any) {
      sendError(res, 500, 'Błąd pobierania listy plików raportów.', e);
    }
  });

  // Download specific CSV report file for a Task (Admin only)
  app.get('/api/tasks/:id/files/download', requireAdmin, (req: Request, res: Response) => {
    const taskId = req.params.id;
    const filename = req.query.file as string;

    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      res.status(400).send('Nieprawidłowa nazwa pliku.');
      return;
    }

    const task = getTasks().find(t => t.id === taskId);
    const taskFilesDir = task ? resolveTaskFilesDir(task) : path.join(getFilesDir(), taskId);
    let fullPath = path.join(taskFilesDir, filename);

    if (!fs.existsSync(fullPath)) {
      // Check legacy paths
      const legacyPaths = [
        path.join(getDataDir(), 'pliki', taskId, filename),
        path.join(getFilesDir(), taskId, filename),
      ];
      const found = legacyPaths.find(p => fs.existsSync(p));
      if (found) {
        fullPath = found;
      } else {
        res.status(404).send('Plik nie został znaleziony.');
        return;
      }
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.download(fullPath, filename);
  });

  // 9. Rclone Config Management (Admin only)
  app.get('/api/rclone/config', requireAdmin, (req: Request, res: Response) => {
    const confPath = getRcloneConfigPath();
    let content = '';
    const remotes: string[] = [];

    if (fs.existsSync(confPath)) {
      content = fs.readFileSync(confPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const m = line.trim().match(/^\[([^\]]+)\]$/);
        if (m) remotes.push(m[1]);
      }
    }

    res.json({ path: confPath, exists: fs.existsSync(confPath), content, remotes });
  });

  app.post('/api/rclone/config', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user;
    const { content } = req.body;
    const confPath = getRcloneConfigPath();

    try {
      fs.mkdirSync(path.dirname(confPath), { recursive: true });
      fs.writeFileSync(confPath, content || '', 'utf-8');
      addAuditLog(user.username, 'UPDATE_RCLONE_CONFIG', 'Zaktualizowano zawartość pliku rclone.conf');
      res.json({ success: true, message: 'Konfiguracja rclone została zapisana.' });
    } catch (e: any) {
      sendError(res, 500, 'Błąd zapisu konfiguracji rclone.', e);
    }
  });

  // 10. Global Settings
  app.get('/api/settings', requireAuth, (req: Request, res: Response) => {
    const settings = getSettings();
    // Mask sensitive credentials for non-admin or pass sanitized
    res.json(settings);
  });

  app.put('/api/settings', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user;
    const body = { ...req.body };
    if (body.loginMaxAttempts !== undefined) {
      body.loginMaxAttempts = Math.max(1, Math.min(50, parseInt(body.loginMaxAttempts, 10) || 5));
    }
    if (body.loginLockoutMinutes !== undefined) {
      body.loginLockoutMinutes = Math.max(1, Math.min(1440, parseInt(body.loginLockoutMinutes, 10) || 15));
    }
    const updated = updateSettings(body, user.username);
    cleanupOldCsvReports();
    res.json({ success: true, settings: updated });
  });

  app.post('/api/settings/test-notification', requireAdmin, async (req: Request, res: Response) => {
    const { type, customTarget } = req.body;
    try {
      const result = await sendTestNotification(type, customTarget);
      res.json(result);
    } catch (e: any) {
      sendError(res, 400, 'Błąd wysyłania powiadomienia testowego.', e);
    }
  });

  // 11. Audit Trail
  app.get('/api/audit', requireAdmin, (req: Request, res: Response) => {
    res.json(getAuditLogs(150));
  });

  app.post('/api/audit/clear', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user;
    clearAuditLogs(user.username);
    res.json({ success: true, message: 'Wyczyszczono historię dziennika audytu.' });
  });

  // 11b. Local Directory / File Browser (Admin only)
  app.get('/api/fs/browse', requireAdmin, (req: Request, res: Response) => {
    const reqPath = (req.query.path as string) || '/';
    if (reqPath.includes('\0')) {
      res.status(400).json({ error: 'Nieprawidłowa ścieżka.' });
      return;
    }
    const resolvedPath = path.resolve(reqPath);

    try {
      let targetPath = resolvedPath;
      let fallbackWarning: string | null = null;

      if (!fs.existsSync(targetPath)) {
        // Find closest existing parent directory
        let curr = path.dirname(targetPath);
        while (curr !== '/' && !fs.existsSync(curr)) {
          curr = path.dirname(curr);
        }
        if (!fs.existsSync(curr)) {
          curr = fs.existsSync('/data') ? '/data' : '/';
        }
        fallbackWarning = `Ścieżka '${resolvedPath}' nie istnieje wewnątrz kontenera Docker. Wyświetlono katalog '${curr}'. Upewnij się, że katalog z danymi został podmontowany w docker-compose.yml (np. ./data:/data lub twój-folder:/DATAtest).`;
        targetPath = curr;
      }

      const stat = fs.statSync(targetPath);
      if (!stat.isDirectory()) {
        targetPath = path.dirname(targetPath);
      }

      const dirents = fs.readdirSync(targetPath, { withFileTypes: true });
      const items: any[] = [];

      for (const d of dirents) {
        try {
          const itemPath = path.join(targetPath, d.name);
          const isDir = d.isDirectory();
          let size: number | undefined;
          let mtime: string | undefined;
          try {
            const itemStat = fs.statSync(itemPath);
            size = itemStat.size;
            mtime = itemStat.mtime.toISOString();
          } catch {
            // ignore item stat error
          }

          items.push({
            name: d.name,
            path: itemPath,
            isDirectory: isDir,
            size,
            mtime,
          });
        } catch {
          // ignore unreadable file/folder
        }
      }

      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

      const parentPath = targetPath === '/' ? null : path.dirname(targetPath);

      // List helpful container shortcuts
      const rootCustomDirs: string[] = [];
      try {
        const rootEntries = fs.readdirSync('/', { withFileTypes: true });
        for (const e of rootEntries) {
          if (e.isDirectory() && !['proc', 'sys', 'dev', 'run', 'etc', 'lib', 'usr', 'bin', 'sbin'].includes(e.name)) {
            rootCustomDirs.push(`/${e.name}`);
          }
        }
      } catch {}

      const candidatePaths = ['/data', '/', ...rootCustomDirs, '/source', '/destination', '/mnt', '/var/log', '/tmp', '/app', process.cwd()];
      const quickPaths = candidatePaths.filter((p, idx, arr) => fs.existsSync(p) && arr.indexOf(p) === idx);

      res.json({
        currentPath: targetPath,
        parentPath,
        items,
        quickPaths,
        warning: fallbackWarning,
      });
    } catch (err: any) {
      sendError(res, 500, 'Błąd przeglądania katalogu.', err);
    }
  });

  // 12. Encrypted Config Export & Import (Admin only)
  app.post('/api/config/export', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user;
    const { password } = req.body;

    if (!password || password.length < 9) {
      res.status(400).json({ error: 'Wprowadź hasło szyfrowania (min. 9 znaków).' });
      return;
    }

    try {
      const db = loadDatabase();
      const rclonePath = getRcloneConfigPath();
      const rcloneContent = fs.existsSync(rclonePath) ? fs.readFileSync(rclonePath, 'utf-8') : '';

      const exportPackage = {
        exportedAt: new Date().toISOString(),
        exportedBy: user.username,
        tasks: db.tasks,
        settings: db.settings,
        users: db.users.map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt })),
        rcloneConfig: rcloneContent,
      };

      const encrypted = encryptConfiguration(exportPackage, password);
      addAuditLog(user.username, 'EXPORT_CONFIG', 'Wyeksportowano zaszyfrowaną konfigurację systemu');
      res.json({ success: true, package: encrypted });
    } catch (e: any) {
      sendError(res, 400, 'Błąd eksportu konfiguracji.', e);
    }
  });

  app.post('/api/config/import', requireAdmin, (req: Request, res: Response) => {
    const user = (req as any).user;
    const { payload, password } = req.body;

    if (!payload || !password || password.length < 9) {
      res.status(400).json({ error: 'Wymagany jest zaszyfrowany plik oraz hasło deszyfrowania (min. 9 znaków).' });
      return;
    }

    try {
      const decrypted = decryptConfiguration(payload, password);
      if (!decrypted || typeof decrypted !== 'object') {
        throw new Error('Odszyfrowana zawartość ma niepoprawną strukturę danych.');
      }

      const db = loadDatabase();
      let importedTasksCount = 0;

      if (Array.isArray(decrypted.tasks)) {
        db.tasks = decrypted.tasks;
        importedTasksCount = decrypted.tasks.length;
        // Keep lastTaskNumber consistent
        let maxNumber = 0;
        for (const t of db.tasks) {
          if (typeof t.taskNumber === 'number' && t.taskNumber > maxNumber) {
            maxNumber = t.taskNumber;
          }
        }
        db.lastTaskNumber = Math.max(db.lastTaskNumber || 0, maxNumber);
      }

      if (decrypted.settings && typeof decrypted.settings === 'object') {
        db.settings = { ...db.settings, ...decrypted.settings };
      }

      if (decrypted.rcloneConfig && typeof decrypted.rcloneConfig === 'string') {
        const confPath = getRcloneConfigPath();
        fs.mkdirSync(path.dirname(confPath), { recursive: true });
        fs.writeFileSync(confPath, decrypted.rcloneConfig, 'utf-8');
      }

      saveDatabase(db);
      addAuditLog(user.username, 'IMPORT_CONFIG', `Zaimportowano konfigurację (${importedTasksCount} zadań)`);
      res.json({ success: true, message: `Pomyślnie zaimportowano konfigurację (${importedTasksCount} zadań).` });
    } catch (e: any) {
      sendError(res, 400, 'Błąd deszyfrowania lub importu konfiguracji.', e);
    }
  });

  // Clean up any interrupted zombie jobs from previous container crash or sudden shutdown
  try {
    const db = loadDatabase();
    const zombieJobs = db.history.filter(h => h.status === 'running' || h.status === 'queued' || h.status === 'stopping');
    if (zombieJobs.length > 0) {
      console.log(`[SyncVault] Recovering ${zombieJobs.length} interrupted zombie jobs from previous container shutdown/restart...`);
      for (const job of zombieJobs) {
        job.status = 'failed';
        job.endTime = new Date().toISOString();
        job.error = 'Zadanie przerwane: Nieoczekiwane zatrzymanie lub restart kontenera Docker (Container restarted while job was active).';
        addAuditLog('system', 'RECOVER_ZOMBIE_JOB', `Oznaczono przerwane zadanie '${job.taskName}' (ID: ${job.id}) jako Błąd z powodu restartu kontenera.`);
      }
      saveDatabase(db);
    }
  } catch (e) {
    console.error('[SyncVault] Error during zombie job recovery:', e);
  }

  // Start background scheduler
  startScheduler();

  // Handle graceful container shutdown
  const shutdown = async () => {
    stopScheduler();
    await handleGracefulShutdown();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SyncVault Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
