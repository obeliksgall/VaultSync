import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User, Task, JobExecution, GlobalSettings, AuditLogEntry } from '../src/types.js';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
// The database used to be a single combined syncvault-db.json holding
// users/tasks/settings AND the ever-growing job history and audit log. Every
// single mutation (even a one-line audit entry) re-serialized and rewrote the
// ENTIRE file synchronously - increasingly expensive/blocking as history and
// audit logs grow, and riskier (one interrupted write could corrupt users and
// tasks too). It is now split into three independently-saved files; loadDatabase()
// transparently migrates an old combined file the first time it's read.
const DB_FILE = path.join(DATA_DIR, 'syncvault-db.json');
const HISTORY_FILE = path.join(DATA_DIR, 'syncvault-history.json');
const AUDIT_FILE = path.join(DATA_DIR, 'syncvault-audit.json');
const RCLONE_CONFIG_FILE = process.env.RCLONE_CONFIG || process.env.RCLONE_CONFIG_PATH || (
  fs.existsSync('/root/.config/rclone/rclone.conf') ? '/root/.config/rclone/rclone.conf' : path.join(DATA_DIR, 'rclone.conf')
);
const LOGS_DIR = path.join(DATA_DIR, 'logs');
const FILES_DIR = path.join(DATA_DIR, 'files');
const LEGACY_PLIKI_DIR = path.join(DATA_DIR, 'pliki');
const BACKUP_DB_DIR = path.join(DATA_DIR, 'backupdb');

export interface StoredUser extends User {
  passwordHash: string;
}

export interface DatabaseSchema {
  users: StoredUser[];
  tasks: Task[];
  history: JobExecution[];
  settings: GlobalSettings;
  auditLogs: AuditLogEntry[];
  lastTaskNumber?: number;
}

const DEFAULT_SETTINGS: GlobalSettings = {
  maxConcurrentJobs: 2,
  queueStartDelaySeconds: 5,
  jobMonitorLimit: 25,
  historyLimit: 250,
  defaultLogRetentionDays: 30,
  defaultTrashRetentionDays: 14,
  csvReportRetentionDays: 30,
  csvHeaderLanguage: 'en',
  dbBackupRetentionDays: 14,
  dbBackupMinCopies: 14,
  auditLogRetentionDays: 30,
  auditLogMaxEntries: 2000,
  loginMaxAttempts: 5,
  loginLockoutMinutes: 15,
  autoLogoutTimeout: '30m',
  unlimitedDays: 7,
  notifications: {
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
    discordBodyTemplate: '',
    ntfyUrl: process.env.NTFY_URL || '',
    ntfyMessageTemplate: '',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpFrom: process.env.SMTP_FROM || 'syncvault@localhost',
    notifyEmailTo: process.env.NOTIFY_EMAIL_TO || '',
    emailSubjectTemplate: '',
    emailBodyTemplate: '',
    emailAttachLogsOnError: true,
    emailLogAttachment: 'error',
    defaultTrigger: 'all',
  },
  theme: 'system',
  language: 'pl',
};

let dbCache: DatabaseSchema | null = null;

export function ensureDirectories(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUP_DB_DIR)) {
    fs.mkdirSync(BACKUP_DB_DIR, { recursive: true });
  }
  process.env.RCLONE_CONFIG = RCLONE_CONFIG_FILE;
}

export function getDataDir(): string {
  return DATA_DIR;
}

export function getLogsDir(): string {
  return LOGS_DIR;
}

export function getFilesDir(): string {
  if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
  }
  return FILES_DIR;
}

export function getBackupDbDir(): string {
  if (!fs.existsSync(BACKUP_DB_DIR)) {
    fs.mkdirSync(BACKUP_DB_DIR, { recursive: true });
  }
  return BACKUP_DB_DIR;
}

// Backward-compatibility alias
export function getPlikiDir(): string {
  return getFilesDir();
}

/**
 * Generates user-friendly, identifiable directory name for a task
 * Format: <taskNumber>_<safeTaskName> (e.g. 1_SPRAWD_ or 2_KOPIA_DOKUMENTOW)
 */
export function getTaskDirName(task: { id: string; name?: string; taskNumber?: number }): string {
  const taskIdentifier = task.taskNumber !== undefined && task.taskNumber !== null
    ? `${task.taskNumber}`
    : task.id.slice(0, 8);
  const rawName = (task.name || '').trim();
  const safeTaskName = rawName ? rawName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'zadanie';
  return `${taskIdentifier}_${safeTaskName}`;
}

/**
 * Resolves the absolute directory path where a task's CSV files are stored.
 * Priority order:
 * 1. data/files/<taskNumber>_<safeTaskName>
 * 2. data/files/<taskId>
 * 3. legacy data/pliki/<taskNumber>_<safeTaskName>
 * 4. legacy data/pliki/<taskId>
 * If none exists, creates and returns the canonical data/files/<taskNumber>_<safeTaskName>.
 */
export function resolveTaskFilesDir(task: { id: string; name?: string; taskNumber?: number }): string {
  const filesDir = getFilesDir();
  const canonicalName = getTaskDirName(task);
  const canonicalPath = path.join(filesDir, canonicalName);

  if (fs.existsSync(canonicalPath)) {
    return canonicalPath;
  }

  const legacyCandidates = [
    path.join(filesDir, task.id),
    path.join(DATA_DIR, 'pliki', canonicalName),
    path.join(DATA_DIR, 'pliki', task.id),
  ];

  for (const cand of legacyCandidates) {
    if (fs.existsSync(cand)) {
      try {
        // Automatically migrate to canonical path in data/files/
        if (!fs.existsSync(canonicalPath)) {
          fs.renameSync(cand, canonicalPath);
          console.log(`[SyncVault Files] Migrated ${cand} -> ${canonicalPath}`);
          return canonicalPath;
        }
      } catch (err) {
        console.warn(`[SyncVault Files] Could not auto-rename ${cand} to ${canonicalPath}:`, err);
        return cand;
      }
      return cand;
    }
  }

  if (!fs.existsSync(canonicalPath)) {
    fs.mkdirSync(canonicalPath, { recursive: true });
  }
  return canonicalPath;
}

/**
 * Transparently migrates any legacy 'data/pliki' folder or raw UUID folders in 'data/files'
 * into clear, readable '<taskNumber>_<taskName>' folders in 'data/files'.
 */
export function migrateLegacyPlikiDir(tasks?: Task[]): void {
  try {
    const plikiDir = LEGACY_PLIKI_DIR;
    const filesDir = getFilesDir();

    // 1. Move any directories from data/pliki to data/files
    if (fs.existsSync(plikiDir)) {
      const entries = fs.readdirSync(plikiDir);
      for (const entry of entries) {
        const srcPath = path.join(plikiDir, entry);
        let stat;
        try {
          stat = fs.statSync(srcPath);
        } catch {
          continue;
        }
        if (!stat.isDirectory()) continue;

        let targetSubdir = entry;
        if (tasks && tasks.length > 0) {
          const matchedTask = tasks.find(t =>
            t.id === entry ||
            String(t.taskNumber) === entry ||
            getTaskDirName(t) === entry
          );
          if (matchedTask) {
            targetSubdir = getTaskDirName(matchedTask);
          }
        }

        const dstPath = path.join(filesDir, targetSubdir);
        if (!fs.existsSync(dstPath)) {
          fs.renameSync(srcPath, dstPath);
          console.log(`[SyncVault Migration] Moved legacy CSV reports: pliki/${entry} -> files/${targetSubdir}`);
        } else {
          // Merge files
          const innerFiles = fs.readdirSync(srcPath);
          for (const f of innerFiles) {
            const fSrc = path.join(srcPath, f);
            const fDst = path.join(dstPath, f);
            if (!fs.existsSync(fDst)) {
              fs.renameSync(fSrc, fDst);
            }
          }
          try {
            fs.rmdirSync(srcPath);
          } catch {}
        }
      }

      // Check if plikiDir is empty now
      try {
        const remaining = fs.readdirSync(plikiDir);
        if (remaining.length === 0) {
          fs.rmdirSync(plikiDir);
          console.log(`[SyncVault Migration] Removed empty legacy directory: data/pliki`);
        }
      } catch {}
    }

    // 2. In data/files, upgrade raw UUID folders to '<taskNumber>_<safeTaskName>'
    if (tasks && tasks.length > 0 && fs.existsSync(filesDir)) {
      const entries = fs.readdirSync(filesDir);
      for (const entry of entries) {
        const currentPath = path.join(filesDir, entry);
        let stat;
        try {
          stat = fs.statSync(currentPath);
        } catch {
          continue;
        }
        if (!stat.isDirectory()) continue;

        const matchedTask = tasks.find(t => t.id === entry);
        if (matchedTask) {
          const properName = getTaskDirName(matchedTask);
          if (properName !== entry) {
            const properPath = path.join(filesDir, properName);
            if (!fs.existsSync(properPath)) {
              fs.renameSync(currentPath, properPath);
              console.log(`[SyncVault Migration] Upgraded UUID directory in files/: ${entry} -> ${properName}`);
            } else {
              const innerFiles = fs.readdirSync(currentPath);
              for (const f of innerFiles) {
                const fSrc = path.join(currentPath, f);
                const fDst = path.join(properPath, f);
                if (!fs.existsSync(fDst)) {
                  fs.renameSync(fSrc, fDst);
                }
              }
              try { fs.rmdirSync(currentPath); } catch {}
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[SyncVault Migration] Error migrating legacy directories:', err);
  }
}

/**
 * Automatically consolidates older log folders in 'data/logs' into the canonical
 * '<taskNumber>_<taskName>' folder (e.g. 'HDD_to_OneDrive' or '<shortId>_HDD_to_OneDrive' -> '4_HDD_to_OneDrive').
 */
export function migrateLegacyLogsDir(tasks?: Task[]): void {
  try {
    const logsDir = getLogsDir();
    if (!fs.existsSync(logsDir)) return;
    if (!tasks || tasks.length === 0) return;

    const entries = fs.readdirSync(logsDir);
    let historyModified = false;
    const db = loadDatabase();

    for (const entry of entries) {
      const currentPath = path.join(logsDir, entry);
      let stat;
      try {
        stat = fs.statSync(currentPath);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      // Find matching task for this directory
      const matchedTask = tasks.find(t => {
        const canonical = getTaskDirName(t);
        if (entry === canonical) return false; // Already canonical, skip!
        const safeName = (t.name || '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const shortId = t.id.slice(0, 8);
        return (
          entry === t.id ||
          entry === safeName ||
          entry === `${shortId}_${safeName}` ||
          entry.endsWith(`_${safeName}`) ||
          entry === `${t.taskNumber}`
        );
      });

      if (!matchedTask) continue;

      const targetDirName = getTaskDirName(matchedTask);
      const targetDir = path.join(logsDir, targetDirName);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Move all files (.log, .txt, etc.) from old directory to target directory
      const files = fs.readdirSync(currentPath);
      for (const file of files) {
        const srcFile = path.join(currentPath, file);
        const dstFile = path.join(targetDir, file);
        if (!fs.existsSync(dstFile)) {
          fs.renameSync(srcFile, dstFile);
          console.log(`[SyncVault Migration] Moved log file: logs/${entry}/${file} -> logs/${targetDirName}/${file}`);
        }

        // Update references in history
        const oldRel = `${entry}/${file}`;
        const newRel = `${targetDirName}/${file}`;
        for (const h of db.history) {
          if (h.logFile === oldRel) {
            h.logFile = newRel;
            historyModified = true;
          }
        }
      }

      // Remove old directory if empty
      try {
        const remaining = fs.readdirSync(currentPath);
        if (remaining.length === 0) {
          fs.rmdirSync(currentPath);
          console.log(`[SyncVault Migration] Removed old log directory: logs/${entry}`);
        }
      } catch {}
    }

    if (historyModified) {
      saveHistoryFile(db);
    }
  } catch (err) {
    console.error('[SyncVault Migration] Error migrating logs dir:', err);
  }
}

/**
 * Ensures that all completed/historical jobs with oneDriveLongPaths have their
 * onedrive_400char_skipped_<jobId>.txt report file saved to disk in the task's log directory.
 */
export function syncOneDriveReportsOnDisk(history?: JobExecution[], tasks?: Task[]): void {
  try {
    const logsDir = getLogsDir();
    if (!fs.existsSync(logsDir)) return;
    const historyList = history || (loadDatabase().history);
    if (!historyList || historyList.length === 0) return;

    for (const job of historyList) {
      if (!job.oneDriveLongPaths || job.oneDriveLongPaths.length === 0) continue;

      const reportFilename = `onedrive_400char_skipped_${job.id}.txt`;
      let targetDir: string | null = null;

      if (job.logFile) {
        const fullLogPath = path.join(logsDir, job.logFile);
        const dir = path.dirname(fullLogPath);
        if (fs.existsSync(dir)) {
          targetDir = dir;
        }
      }

      if (!targetDir && tasks && tasks.length > 0) {
        const matchedTask = tasks.find(t => t.id === job.taskId || t.name === job.taskName);
        if (matchedTask) {
          const canonical = getTaskDirName(matchedTask);
          const dir = path.join(logsDir, canonical);
          if (fs.existsSync(dir)) {
            targetDir = dir;
          }
        }
      }

      if (!targetDir) {
        // Fallback: search for directory matching job.taskName in logsDir
        const safeTaskName = (job.taskName || '').replace(/[^a-zA-Z0-9_-]/g, '_');
        try {
          const entries = fs.readdirSync(logsDir);
          for (const entry of entries) {
            if (entry.includes(safeTaskName)) {
              const candidate = path.join(logsDir, entry);
              if (fs.statSync(candidate).isDirectory()) {
                targetDir = candidate;
                break;
              }
            }
          }
        } catch {}
      }

      if (targetDir) {
        const reportPath = path.join(targetDir, reportFilename);
        if (!fs.existsSync(reportPath)) {
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

          fs.writeFileSync(reportPath, reportContent, 'utf-8');
          console.log(`[SyncVault] Synced missing OneDrive 400-char report to disk: ${path.relative(logsDir, reportPath)}`);
        }
      }
    }
  } catch (err) {
    console.error('[SyncVault] Error syncing OneDrive reports to disk:', err);
  }
}

export function getSessionDurationMs(settings: GlobalSettings): number {
  const timeout = settings.autoLogoutTimeout || '30m';
  switch (timeout) {
    case '30m':
      return 30 * 60 * 1000;
    case '1h':
      return 60 * 60 * 1000;
    case '3h':
      return 3 * 60 * 60 * 1000;
    case 'unlimited': {
      const days = Math.min(28, Math.max(1, settings.unlimitedDays || 7));
      return days * 24 * 60 * 60 * 1000;
    }
    default:
      return 30 * 60 * 1000;
  }
}

export function getRcloneConfigPath(): string {
  return RCLONE_CONFIG_FILE;
}

// Writes JSON to a temp file in the same directory, then renames it over the
// target. The rename is atomic on the same filesystem, so a container
// crash/kill mid-write can never leave a half-written/corrupted target file -
// worst case, the .tmp file is left behind and the previous good version of
// the target is untouched.
function writeJsonAtomic(filePath: string, data: unknown): void {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function readJsonFile<T = any>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch (err) {
    console.error(`[SyncVault] Failed to parse ${filePath}, ignoring it:`, err);
    return null;
  }
}

/**
 * Creates a safety backup of syncvault-db.json in data/backupdb/ before writing changes.
 * Filename format: syncvault-db_YYYY-MM-DD_HH-mm-ss.json
 * Retention rule: keeps backups up to retentionDays (default 14), but NEVER fewer than minCopies (default 14).
 */
export function backupCoreDbBeforeSave(settings?: GlobalSettings): void {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    const stat = fs.statSync(DB_FILE);
    if (stat.size < 10) return;

    const backupDir = getBackupDbDir();
    const existingContent = fs.readFileSync(DB_FILE, 'utf-8');

    // Check existing backups to avoid creating an identical duplicate file if content hasn't changed
    const existingFiles = fs.readdirSync(backupDir)
      .filter(fn => fn.startsWith('syncvault-db_') && fn.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));

    if (existingFiles.length > 0) {
      const latestPath = path.join(backupDir, existingFiles[0]);
      try {
        const latestContent = fs.readFileSync(latestPath, 'utf-8');
        if (latestContent === existingContent) {
          // Content is identical to the latest backup, no need to duplicate
          return;
        }
      } catch {}
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    let backupFilename = `syncvault-db_${dateStr}.json`;
    let backupPath = path.join(backupDir, backupFilename);

    // If a backup with this exact second already exists, append a millisecond suffix
    if (fs.existsSync(backupPath)) {
      backupFilename = `syncvault-db_${dateStr}_${now.getMilliseconds()}.json`;
      backupPath = path.join(backupDir, backupFilename);
    }

    fs.writeFileSync(backupPath, existingContent, 'utf-8');
    console.log(`[SyncVault BackupDB] Created database safety backup before save: ${backupFilename}`);

    // Retention cleanup
    cleanupDatabaseBackups(settings);
  } catch (err) {
    console.error('[SyncVault BackupDB] Error during database backup before save:', err);
  }
}

export function cleanupDatabaseBackups(settings?: GlobalSettings): void {
  try {
    const backupDir = getBackupDbDir();
    if (!fs.existsSync(backupDir)) return;

    const s = settings || getSettings();
    const retentionDays = s?.dbBackupRetentionDays !== undefined ? s.dbBackupRetentionDays : 14;
    const minCopies = s?.dbBackupMinCopies !== undefined ? s.dbBackupMinCopies : 14;

    const allBackups = fs.readdirSync(backupDir)
      .filter(fn => fn.startsWith('syncvault-db_') && fn.endsWith('.json'))
      .map(fn => {
        const full = path.join(backupDir, fn);
        let mtimeMs = 0;
        try {
          mtimeMs = fs.statSync(full).mtimeMs;
        } catch {}
        return { filename: fn, fullPath: full, mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    // If total backups are within minCopies, never prune
    if (allBackups.length <= minCopies) {
      return;
    }

    if (retentionDays > 0) {
      const cutoffMs = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      // Only consider pruning items beyond the first `minCopies`
      for (let i = minCopies; i < allBackups.length; i++) {
        const item = allBackups[i];
        if (item.mtimeMs < cutoffMs) {
          try {
            fs.unlinkSync(item.fullPath);
            console.log(`[SyncVault BackupDB] Pruned old database backup (older than ${retentionDays}d): ${item.filename}`);
          } catch (e) {
            console.warn(`[SyncVault BackupDB] Failed to delete old backup ${item.filename}:`, e);
          }
        }
      }
    }
  } catch (err) {
    console.error('[SyncVault BackupDB] Error during retention cleanup:', err);
  }
}

export function listDatabaseBackups(): Array<{ filename: string; size: number; createdAt: string; filePath: string }> {
  const backupDir = getBackupDbDir();
  if (!fs.existsSync(backupDir)) return [];

  try {
    const files = fs.readdirSync(backupDir)
      .filter(fn => fn.startsWith('syncvault-db_') && fn.endsWith('.json'));

    return files.map(fn => {
      const full = path.join(backupDir, fn);
      const stat = fs.statSync(full);
      return {
        filename: fn,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        filePath: `backupdb/${fn}`,
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('[SyncVault BackupDB] Error listing database backups:', err);
    return [];
  }
}

export function getDatabaseBackupPath(filename: string): string | null {
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return null;
  }
  if (!filename.startsWith('syncvault-db_') || !filename.endsWith('.json')) {
    return null;
  }
  const full = path.join(getBackupDbDir(), filename);
  return fs.existsSync(full) ? full : null;
}

// Targeted saves: each only serializes/writes the one file that actually
// changed, instead of the old approach of rewriting users+tasks+settings+
// history+auditLogs together on every single mutation.
function saveCore(db: DatabaseSchema): void {
  ensureDirectories();
  backupCoreDbBeforeSave(db.settings);
  writeJsonAtomic(DB_FILE, {
    users: db.users,
    tasks: db.tasks,
    settings: db.settings,
    lastTaskNumber: db.lastTaskNumber,
  });
}

function saveHistoryFile(db: DatabaseSchema): void {
  ensureDirectories();
  writeJsonAtomic(HISTORY_FILE, { history: db.history });
}

function saveAuditFile(db: DatabaseSchema): void {
  ensureDirectories();
  writeJsonAtomic(AUDIT_FILE, { auditLogs: db.auditLogs });
}

export function loadDatabase(): DatabaseSchema {
  if (dbCache) return dbCache;
  ensureDirectories();

  const coreExisted = fs.existsSync(DB_FILE);
  const coreParsed: any = readJsonFile(DB_FILE) || {};
  const historyParsed: any = readJsonFile(HISTORY_FILE);
  const auditParsed: any = readJsonFile(AUDIT_FILE);

  // Migration: an older syncvault-db.json may still have history/auditLogs
  // embedded directly in it (from before the split). Detect that and pull the
  // data out into its own file below, exactly once.
  const legacyHistoryEmbedded = !historyParsed && Array.isArray(coreParsed.history);
  const legacyAuditEmbedded = !auditParsed && Array.isArray(coreParsed.auditLogs);

  dbCache = {
    users: coreParsed.users || [],
    tasks: coreParsed.tasks || [],
    settings: { ...DEFAULT_SETTINGS, ...(coreParsed.settings || {}) },
    history: (historyParsed && historyParsed.history) || coreParsed.history || [],
    auditLogs: (auditParsed && auditParsed.auditLogs) || coreParsed.auditLogs || [],
    lastTaskNumber: typeof coreParsed.lastTaskNumber === 'number' ? coreParsed.lastTaskNumber : 0,
  };

  // Ensure all tasks have a stable unique sequential taskNumber (1, 2, 3...)
  let coreDirty = false;
  const highestExisting = Math.max(
    0,
    ...dbCache.tasks.map(t => (typeof t.taskNumber === 'number' ? t.taskNumber : 0))
  );
  if ((dbCache.lastTaskNumber || 0) > highestExisting) {
    dbCache.lastTaskNumber = highestExisting;
    coreDirty = true;
  }
  let maxTaskNum = dbCache.lastTaskNumber || 0;
  for (const t of dbCache.tasks) {
    if (typeof t.taskNumber === 'number' && t.taskNumber > maxTaskNum) {
      maxTaskNum = t.taskNumber;
    }
  }
  for (const t of dbCache.tasks) {
    if (!t.taskNumber) {
      maxTaskNum += 1;
      t.taskNumber = maxTaskNum;
      coreDirty = true;
    }
  }
  if (maxTaskNum > (dbCache.lastTaskNumber || 0)) {
    dbCache.lastTaskNumber = maxTaskNum;
    coreDirty = true;
  }

  if (legacyHistoryEmbedded || legacyAuditEmbedded) {
    console.log('[SyncVault] Migrating legacy combined database file into separate history/audit files...');
  }
  if (legacyHistoryEmbedded) {
    saveHistoryFile(dbCache);
    // The core file must be rewritten too, so the now-duplicated history array
    // is dropped from syncvault-db.json rather than lingering there forever.
    coreDirty = true;
  }
  if (legacyAuditEmbedded) {
    saveAuditFile(dbCache);
    coreDirty = true;
  }

  if (coreDirty || !coreExisted) {
    saveCore(dbCache);
  }
  // Fresh install (or a core file with no legacy data): make sure the
  // dedicated history/audit files exist on disk right away, same as before.
  if (!historyParsed && !legacyHistoryEmbedded) {
    saveHistoryFile(dbCache);
  }
  if (!auditParsed && !legacyAuditEmbedded) {
    saveAuditFile(dbCache);
  }

  // Migrate legacy data/pliki directory and raw UUID folders into data/files/<taskNumber>_<safeTaskName>
  migrateLegacyPlikiDir(dbCache.tasks);

  // Migrate legacy log folders into data/logs/<taskNumber>_<safeTaskName>
  migrateLegacyLogsDir(dbCache.tasks);

  // Sync any historical OneDrive 400-char reports to disk if missing
  syncOneDriveReportsOnDisk(dbCache.history, dbCache.tasks);

  return dbCache;
}

export function saveDatabase(db?: DatabaseSchema): void {
  const dataToSave = db || dbCache;
  if (!dataToSave) return;
  saveCore(dataToSave);
  saveHistoryFile(dataToSave);
  saveAuditFile(dataToSave);
  dbCache = dataToSave;
}

// User helpers
export function getUsers(): User[] {
  const db = loadDatabase();
  return db.users.map(({ passwordHash, ...user }) => user);
}

export function findUserByUsername(username: string): StoredUser | undefined {
  const db = loadDatabase();
  return db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

export function findUserById(id: string): StoredUser | undefined {
  const db = loadDatabase();
  return db.users.find(u => u.id === id);
}

export async function createFirstAdmin(username: string, passwordPlain: string): Promise<User> {
  const db = loadDatabase();
  if (db.users.length > 0) {
    throw new Error('Konto administratora zostało już utworzone.');
  }
  if (!passwordPlain || passwordPlain.length < 9) {
    throw new Error('Hasło musi mieć minimum 9 znaków.');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(passwordPlain, salt);

  const adminUser: StoredUser = {
    id: crypto.randomUUID(),
    username,
    role: 'admin',
    createdAt: new Date().toISOString(),
    passwordHash,
  };

  db.users.push(adminUser);
  saveCore(db);
  addAuditLog('SYSTEM', 'SETUP_ADMIN', `Utworzono początkowe konto administratora: ${username}`);
  const { passwordHash: _, ...safeUser } = adminUser;
  return safeUser;
}

export async function createUser(creatorUsername: string, username: string, passwordPlain: string, role: 'admin' | 'user' = 'user'): Promise<User> {
  const db = loadDatabase();
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Użytkownik o takiej nazwie już istnieje.');
  }
  if (!passwordPlain || passwordPlain.length < 9) {
    throw new Error('Hasło musi mieć minimum 9 znaków.');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(passwordPlain, salt);

  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    username,
    role,
    createdAt: new Date().toISOString(),
    passwordHash,
  };

  db.users.push(newUser);
  saveCore(db);
  addAuditLog(creatorUsername, 'CREATE_USER', `Utworzono użytkownika ${username} z rolą ${role}`);
  const { passwordHash: _, ...safeUser } = newUser;
  return safeUser;
}

export async function updateUserPassword(userId: string, newPasswordPlain: string, actorUsername: string): Promise<void> {
  const db = loadDatabase();
  const user = db.users.find(u => u.id === userId);
  if (!user) throw new Error('Użytkownik nie istnieje.');
  if (!newPasswordPlain || newPasswordPlain.length < 9) {
    throw new Error('Nowe hasło musi mieć minimum 9 znaków.');
  }

  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(newPasswordPlain, salt);
  saveCore(db);
  addAuditLog(actorUsername, 'CHANGE_PASSWORD', `Zmieniono hasło dla użytkownika ${user.username}`);
}

export function deleteUser(userId: string, actorUsername: string): void {
  const db = loadDatabase();
  const userIndex = db.users.findIndex(u => u.id === userId);
  if (userIndex === -1) throw new Error('User not found.');
  const user = db.users[userIndex];
  if (user.role === 'admin' && db.users.filter(u => u.role === 'admin').length <= 1) {
    throw new Error('Cannot delete the last administrator.');
  }
  db.users.splice(userIndex, 1);
  saveCore(db);
  addAuditLog(actorUsername, 'DELETE_USER', `Deleted user ${user.username}`);
}

// Tasks
export function getTasks(): Task[] {
  const db = loadDatabase();
  return db.tasks;
}

export function getTaskById(id: string): Task | undefined {
  const db = loadDatabase();
  return db.tasks.find(t => t.id === id);
}

export function saveTask(task: Task, actorUsername: string, isNew: boolean): Task {
  const db = loadDatabase();

  // Enforce unique task name (case-insensitive check against other tasks)
  const trimmedName = task.name.trim();
  const nameCollision = db.tasks.some(
    t => t.id !== task.id && t.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (nameCollision) {
    throw new Error(`Zadanie o nazwie "${trimmedName}" już istnieje. Nazwa zadania musi być unikalna.`);
  }

  if (!task.taskNumber) {
    const existingMax = Math.max(
      0,
      ...db.tasks.map(t => (typeof t.taskNumber === 'number' ? t.taskNumber : 0))
    );
    // If lastTaskNumber is higher than any existing task (e.g. latest task was deleted),
    // roll it back to existingMax so there are no empty gaps when re-creating the latest task.
    if ((db.lastTaskNumber || 0) > existingMax) {
      db.lastTaskNumber = existingMax;
    }
    const maxTaskNum = Math.max(db.lastTaskNumber || 0, existingMax, 0);
    task.taskNumber = maxTaskNum + 1;
    db.lastTaskNumber = task.taskNumber;
  } else {
    // If task already has a number, ensure db.lastTaskNumber is at least that
    if (!db.lastTaskNumber || task.taskNumber > db.lastTaskNumber) {
      db.lastTaskNumber = task.taskNumber;
    }
  }

  if (isNew) {
    db.tasks.push(task);
    addAuditLog(actorUsername, 'CREATE_TASK', `Created task #${task.taskNumber}: ${task.name} (${task.engine}/${task.type})`);
  } else {
    const idx = db.tasks.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      db.tasks[idx] = task;
      addAuditLog(actorUsername, 'EDIT_TASK', `Updated task #${task.taskNumber}: ${task.name}`);
    } else {
      db.tasks.push(task);
    }
  }
  saveCore(db);
  return task;
}

/**
 * Deletes all log and CSV file directories associated with a task
 * from data/logs, data/files, and legacy data/pliki.
 */
export function deleteTaskDirectories(task: { id: string; name?: string; taskNumber?: number }): void {
  const dirName = getTaskDirName(task);
  const safeName = (task.name || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const shortId = task.id ? task.id.slice(0, 8) : '';
  const numStr = task.taskNumber !== undefined && task.taskNumber !== null ? `${task.taskNumber}` : '';

  const rootDirs = [
    getLogsDir(),
    getFilesDir(),
    path.join(DATA_DIR, 'pliki'),
  ];

  for (const root of rootDirs) {
    if (!fs.existsSync(root)) continue;
    try {
      const entries = fs.readdirSync(root);
      for (const entry of entries) {
        let isMatch = false;
        if (numStr && (entry === numStr || entry.startsWith(`${numStr}_`))) {
          isMatch = true;
        } else if (entry === task.id || (shortId && entry.startsWith(`${shortId}_`))) {
          isMatch = true;
        } else if (entry === dirName || (safeName && entry === safeName) || (task.name && entry === task.name)) {
          isMatch = true;
        }

        if (isMatch) {
          const targetPath = path.join(root, entry);
          try {
            fs.rmSync(targetPath, { recursive: true, force: true });
            console.log(`[SyncVault] Deleted task directory on task removal: ${targetPath}`);
          } catch (err) {
            console.error(`[SyncVault] Failed to delete task directory ${targetPath}:`, err);
          }
        }
      }
    } catch (e) {
      console.error(`[SyncVault] Error scanning directory ${root} for task deletion:`, e);
    }
  }
}

export function deleteHistoryByTaskId(taskId: string): number {
  const db = loadDatabase();
  const initialLen = db.history.length;
  db.history = db.history.filter(h => h.taskId !== taskId);
  if (db.history.length !== initialLen) {
    saveHistoryFile(db);
  }
  return initialLen - db.history.length;
}

export function deleteTask(id: string, actorUsername: string): void {
  const db = loadDatabase();
  const idx = db.tasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    const task = db.tasks[idx];
    db.tasks.splice(idx, 1);
    // Also remove chaining references
    db.tasks.forEach(t => {
      if (t.runAfterTaskId === id) {
        t.runAfterTaskId = null;
      }
    });

    // If the deleted task had the highest task number (e.g. accidental duplicate),
    // roll back lastTaskNumber to the highest remaining task number so that ID can be reused immediately.
    const remainingMax = Math.max(
      0,
      ...db.tasks.map(t => (typeof t.taskNumber === 'number' ? t.taskNumber : 0))
    );
    if ((db.lastTaskNumber || 0) > remainingMax) {
      db.lastTaskNumber = remainingMax;
    }

    saveCore(db);
    addAuditLog(actorUsername, 'DELETE_TASK', `Deleted task: ${task.name}`);

    // Remove task directories from data/logs, data/files and data/pliki
    deleteTaskDirectories(task);

    // Remove all history records and job monitor entries for this task
    const removedHistoryCount = deleteHistoryByTaskId(id);
    if (removedHistoryCount > 0) {
      console.log(`[SyncVault] Deleted ${removedHistoryCount} history/job monitor entries for task: ${task.name} (${id})`);
    }
  }
}

// Settings
export function getSettings(): GlobalSettings {
  const db = loadDatabase();
  return db.settings;
}

export function updateSettings(settings: Partial<GlobalSettings>, actorUsername: string): GlobalSettings {
  const db = loadDatabase();
  db.settings = { ...db.settings, ...settings };
  saveCore(db);
  addAuditLog(actorUsername, 'UPDATE_SETTINGS', 'Updated global configuration settings');
  return db.settings;
}

// Audit Logs
export function pruneAuditLogs(dbParam?: DatabaseSchema): void {
  const db = dbParam || loadDatabase();
  const retentionDays = db.settings.auditLogRetentionDays ?? 30;
  if (retentionDays > 0) {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const initialLen = db.auditLogs.length;
    db.auditLogs = db.auditLogs.filter(entry => {
      const ts = new Date(entry.timestamp).getTime();
      return !isNaN(ts) && ts >= cutoff;
    });
    if (db.auditLogs.length !== initialLen && !dbParam) {
      saveAuditFile(db);
    }
  }
}

export function clearAuditLogs(actorUsername: string): void {
  const db = loadDatabase();
  db.auditLogs = [];
  addAuditLog(actorUsername, 'CLEAR_AUDIT_LOGS', 'Wyczyszczono historię dziennika audytu (Audit Log)');
}

export function getAuditLogs(limit: number = 100): AuditLogEntry[] {
  pruneAuditLogs();
  const db = loadDatabase();
  return [...db.auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
}

export function addAuditLog(username: string, action: string, details: string, ip?: string): void {
  const db = loadDatabase();
  const entry: AuditLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    username: username || 'anonymous',
    action,
    details,
    ip,
  };
  db.auditLogs.unshift(entry);
  pruneAuditLogs(db);
  const maxEntries = db.settings.auditLogMaxEntries || 2000;
  if (db.auditLogs.length > maxEntries) {
    db.auditLogs.length = maxEntries;
  }
  saveAuditFile(db);
}

// History
export function getHistory(limit?: number): JobExecution[] {
  const db = loadDatabase();
  const max = limit || db.settings.historyLimit || DEFAULT_SETTINGS.historyLimit;
  return [...db.history].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).slice(0, max);
}

export function addJobHistory(job: JobExecution): void {
  const db = loadDatabase();
  const idx = db.history.findIndex(h => h.id === job.id);
  if (idx !== -1) {
    db.history[idx] = { ...job };
  } else {
    db.history.unshift({ ...job });
  }
  // Both this and getHistory() above now fall back to the same
  // DEFAULT_SETTINGS.historyLimit (250) if historyLimit is somehow unset -
  // they used to disagree (250 vs 500), which meant a job could still be
  // stored past what the History tab would ever actually display.
  const max = db.settings.historyLimit || DEFAULT_SETTINGS.historyLimit;
  if (db.history.length > max) {
    db.history.length = max;
  }
  saveHistoryFile(db);
}
