import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn, ChildProcess, execSync } from 'child_process';
import { Task, JobExecution, GlobalSettings, TaskPair } from '../src/types.js';
import {
  getDataDir,
  getLogsDir,
  getFilesDir,
  resolveTaskFilesDir,
  getSettings,
  getTasks,
  addJobHistory,
  addAuditLog,
  getTaskById,
  saveDatabase,
  getRcloneConfigPath,
  cleanupDatabaseBackups,
} from './db.js';
import { sendJobNotifications } from './notifications.js';
import {
  saveTaskCsvReports,
  resolveFilePath,
  getLocalFileStat,
  formatMtime,
  CsvReportItem,
} from './csvReports.js';
import { cleanupSystemLogs } from './systemLogger.js';

export interface PairMetrics {
  filesTransferred: number;
  filesTotal: number;
  bytesTransferred: number;
  bytesTotal: number;
  checksChecked?: number;
  checksTotal?: number;
  speed?: string;
  eta?: string;
  percentage?: number;
}

export function getPairChecks(p: PairMetrics, engine: string): { checked: number; total: number } {
  if (engine === 'rclone') {
    // In rclone:
    // "Checks: C / D" counts files that already matched destination and needed no transfer.
    // "Transferred: A / B" counts files that were transferred.
    // Every file in the source is checked against this destination and either transferred or matched!
    // Therefore, total files verified/checked for this pair = checks + filesTransferred.
    const rawChecked = p.checksChecked || 0;
    const rawTotal = p.checksTotal || 0;
    const xfrDone = p.filesTransferred || 0;
    const xfrTot = Math.max(p.filesTransferred || 0, p.filesTotal || 0);

    const checked = rawChecked + xfrDone;
    const total = Math.max(checked, rawTotal + xfrTot);
    return { checked, total };
  } else {
    // For rsync or simulated:
    const checked = p.checksChecked !== undefined ? p.checksChecked : (p.filesTransferred || 0);
    const total = p.checksTotal !== undefined ? p.checksTotal : (p.filesTotal || p.filesTransferred || 0);
    return { checked, total };
  }
}

interface ActiveJobContext {
  job: JobExecution;
  task: Task;
  process?: ChildProcess;
  simulationTimer?: NodeJS.Timeout;
  logFilePath: string;
  cancelled: boolean;
  totalPairs: number;
  currentPairIdx: number;
  completedPairsMetrics: PairMetrics[];
  currentPairMetrics: PairMetrics;
  liveSentItems: CsvReportItem[];
  liveDeletedItems: CsvReportItem[];
  liveSentMap: Map<string, CsvReportItem>;
  liveDeletedMap: Map<string, CsvReportItem>;
  currentPairHadOneDriveLimitError?: boolean;
  oneDriveLongPathsSet?: Set<string>;
}

function parseFormattedSizeToBytes(numStr: string, unitStr?: string): number {
  if (!numStr) return 0;
  const cleanedNum = numStr.replace(/,/g, '').trim();
  const num = parseFloat(cleanedNum);
  if (isNaN(num)) return 0;
  if (!unitStr) return Math.round(num);

  const u = unitStr.toUpperCase().trim();
  if (u.startsWith('B')) return Math.round(num);
  if (u.startsWith('K') || u === 'K') return Math.round(num * 1024);
  if (u.startsWith('M') || u === 'M') return Math.round(num * 1024 * 1024);
  if (u.startsWith('G') || u === 'G') return Math.round(num * 1024 * 1024 * 1024);
  if (u.startsWith('T') || u === 'T') return Math.round(num * 1024 * 1024 * 1024 * 1024);
  if (u.startsWith('P') || u === 'P') return Math.round(num * 1024 * 1024 * 1024 * 1024 * 1024);
  return Math.round(num);
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, safeI)).toFixed(2)) + ' ' + sizes[safeI];
}

const activeJobs = new Map<string, ActiveJobContext>();
const queuedJobs: { job: JobExecution; task: Task; restoredPairIds?: string[] }[] = [];

// Timestamp (ms) of the most recent job completion. Used by processQueue() to
// enforce a configurable breather (settings.queueStartDelaySeconds) before the
// next queued job (chained, manually triggered, or scheduled) is allowed to
// start - regardless of what triggered it.
let lastJobFinishTime = 0;
let queueDelayTimer: NodeJS.Timeout | null = null;

// Check command availability
export function checkToolAvailability(): { rclone: boolean; rsync: boolean; rcloneVer?: string; rsyncVer?: string } {
  let rclone = false;
  let rsync = false;
  let rcloneVer: string | undefined;
  let rsyncVer: string | undefined;

  try {
    const out = execSync('rclone --version', { timeout: 3000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    rclone = true;
    rcloneVer = out.split('\n')[0].trim();
  } catch {
    rclone = false;
  }

  try {
    const out = execSync('rsync --version', { timeout: 3000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    rsync = true;
    rsyncVer = out.split('\n')[0].trim();
  } catch {
    rsync = false;
  }

  return { rclone, rsync, rcloneVer, rsyncVer };
}

// Sanitize rclone-specific flags when running under rsync to prevent code 1 syntax/unknown option errors
function sanitizeRsyncFlags(customFlagsStr: string, onWarning?: (warning: string) => void): string[] {
  const flags = customFlagsStr.split(' ').filter(Boolean);
  const safeFlags: string[] = [];
  const rcloneValueFlags = new Set(['--transfers', '--checkers', '--drive-chunk-size', '--s3-chunk-size', '--buffer-size', '--tpslimit', '--max-backlog']);
  const rcloneBooleanFlags = new Set(['--fast-list', '--ignore-checksum', '--no-traverse']);

  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i];
    if (rcloneValueFlags.has(flag)) {
      const nextVal = (i + 1 < flags.length && !flags[i + 1].startsWith('-')) ? ` ${flags[i + 1]}` : '';
      if (onWarning) {
        onWarning(`[SyncVault Notice] Pominięto flagę rclone '${flag}${nextVal}' (silnik rsync jej nie obsługuje).`);
      }
      if (nextVal) i++; // skip the parameter value
      continue;
    }
    if (rcloneBooleanFlags.has(flag)) {
      if (onWarning) {
        onWarning(`[SyncVault Notice] Pominięto flagę rclone '${flag}' (silnik rsync jej nie obsługuje).`);
      }
      continue;
    }
    if (flag.startsWith('--transfers=') || flag.startsWith('--checkers=')) {
      if (onWarning) {
        onWarning(`[SyncVault Notice] Pominięto flagę rclone '${flag}' (silnik rsync jej nie obsługuje).`);
      }
      continue;
    }
    safeFlags.push(flag);
  }
  return safeFlags;
}

// Generate command preview
export function generateCommandPreview(
  task: Task,
  mode: 'backup' | 'restore' = 'backup',
  selectedPairIds?: string[]
): string[] {
  const dateStr = new Date().toISOString().split('T')[0];
  const pairs = task.pairs.filter(p => !selectedPairIds || selectedPairIds.length === 0 || selectedPairIds.includes(p.id));
  const commands: string[] = [];

  for (const pair of pairs) {
    let src = mode === 'restore' ? pair.destination : pair.source;
    let dst = mode === 'restore' ? pair.source : pair.destination;

    const excludes = (task.excludeFilters || [])
      .filter(f => f.trim().length > 0)
      .map(f => `--exclude "${f.trim()}"`)
      .join(' ');

    const customFlags = (task.customFlags || '').trim();

    if (task.engine === 'rclone') {
      let cmdType = 'sync';
      if (task.type === 'copy') cmdType = 'copy';
      if (task.type === 'move') cmdType = 'move';

      let trashFlag = '';
      if (task.type === 'mirror' && task.trashEnabled && mode === 'backup') {
        const trashDir = `${dst.replace(/\/+$/, '')}_TRASH/${dateStr}`;
        trashFlag = `--backup-dir "${trashDir}"`;
      }

      const parts = ['rclone', cmdType, `"${src}"`, `"${dst}"`, '-P', '--stats 1s'];
      if (trashFlag) parts.push(trashFlag);
      if (excludes) parts.push(excludes);
      if (customFlags) parts.push(customFlags);

      commands.push(parts.filter(Boolean).join(' '));
    } else {
      // rsync
      const rsyncMode = task.rsyncFlagsMode === 'rtv' ? '-rtv' : '-avh';
      let baseFlags = `${rsyncMode} --info=progress2 --stats`;
      if (task.type === 'mirror') {
        baseFlags += ' --delete';
      } else if (task.type === 'move') {
        baseFlags += ' --remove-source-files';
      }

      let trashFlag = '';
      if (task.type === 'mirror' && task.trashEnabled && mode === 'backup') {
        const trashDir = `${dst.replace(/\/+$/, '')}_TRASH/${dateStr}`;
        trashFlag = `--backup --backup-dir="${trashDir}"`;
      }

      // Add trailing slashes for rsync directories if not remote colon
      const normalizedSrc = src.endsWith('/') || src.includes(':') ? src : `${src}/`;
      const normalizedDst = dst.endsWith('/') || dst.includes(':') ? dst : `${dst}/`;

      const rsyncExcludes = (task.excludeFilters || [])
        .filter(f => f.trim().length > 0)
        .map(f => `--exclude='${f.trim()}'`)
        .join(' ');

      const parts = ['rsync', baseFlags];
      if (trashFlag) parts.push(trashFlag);
      if (rsyncExcludes) parts.push(rsyncExcludes);
      if (customFlags) {
        const safeFlags = sanitizeRsyncFlags(customFlags);
        if (safeFlags.length > 0) parts.push(safeFlags.join(' '));
      }
      parts.push(`"${normalizedSrc}"`);
      parts.push(`"${normalizedDst}"`);

      commands.push(parts.filter(Boolean).join(' '));
    }
  }

  return commands;
}

// Check if task is already running or queued
export function isTaskRunningOrQueued(taskId: string): boolean {
  for (const ctx of activeJobs.values()) {
    if (ctx.task.id === taskId) return true;
  }
  for (const q of queuedJobs) {
    if (q.task.id === taskId) return true;
  }
  return false;
}

// Computes how much of the inter-job breather (settings.queueStartDelaySeconds)
// remains, and how many concurrency slots are currently free. Only the queued
// jobs occupying those free slots (i.e. next in line to start) are actually
// waiting on the delay - the rest are still just waiting on concurrency.
function getQueueDelayStatus(): { remainingMs: number; freeSlots: number } {
  const settings = getSettings();
  const maxConcurrent = Math.max(1, settings.maxConcurrentJobs || 1);
  const delayMs = Math.max(0, settings.queueStartDelaySeconds ?? 5) * 1000;
  const freeSlots = Math.max(0, maxConcurrent - activeJobs.size);

  if (delayMs <= 0 || lastJobFinishTime <= 0 || freeSlots <= 0) {
    return { remainingMs: 0, freeSlots };
  }

  const elapsed = Date.now() - lastJobFinishTime;
  const remainingMs = delayMs - elapsed;
  return { remainingMs: remainingMs > 0 ? remainingMs : 0, freeSlots };
}

export function getActiveJobsList(): JobExecution[] {
  const result: JobExecution[] = [];
  for (const ctx of activeJobs.values()) {
    result.push(ctx.job);
  }
  const { remainingMs, freeSlots } = getQueueDelayStatus();
  queuedJobs.forEach((q, idx) => {
    // Only the first `freeSlots` items in the FIFO queue are actually next
    // up and thus subject to the countdown; anything further back is simply
    // waiting for a concurrency slot to free up.
    q.job.queueDelayRemainingSeconds = (remainingMs > 0 && idx < freeSlots)
      ? Math.ceil(remainingMs / 1000)
      : undefined;
    result.push(q.job);
  });
  return result;
}

export function getJobById(jobId: string): JobExecution | undefined {
  const active = activeJobs.get(jobId);
  if (active) return active.job;
  const queued = queuedJobs.find(q => q.job.id === jobId);
  if (queued) return queued.job;
  return undefined;
}

export function cancelAndRemoveTaskJobs(taskId: string, actorUsername: string = 'system'): void {
  // 1. Remove from queuedJobs
  for (let i = queuedJobs.length - 1; i >= 0; i--) {
    if (queuedJobs[i].task.id === taskId || queuedJobs[i].job.taskId === taskId) {
      const q = queuedJobs.splice(i, 1)[0];
      q.job.status = 'stopped';
      addAuditLog(actorUsername, 'STOP_JOB', `Cancelled queued job for deleted task: ${q.task.name}`);
    }
  }

  // 2. Kill and remove from activeJobs
  for (const [jobId, ctx] of Array.from(activeJobs.entries())) {
    if (ctx.task.id === taskId || ctx.job.taskId === taskId) {
      ctx.cancelled = true;
      ctx.job.status = 'stopped';
      if (ctx.simulationTimer) {
        clearInterval(ctx.simulationTimer);
      }
      if (ctx.process && !ctx.process.killed) {
        try {
          ctx.process.kill('SIGKILL');
        } catch (e) {
          console.error('Error killing process for deleted task:', e);
        }
      }
      activeJobs.delete(jobId);
      addAuditLog(actorUsername, 'STOP_JOB', `Stopped and removed active job for deleted task: ${ctx.task.name}`);
    }
  }
}

export function stopJob(jobId: string, actorUsername: string): boolean {
  // Check queued first
  const qIdx = queuedJobs.findIndex(q => q.job.id === jobId);
  if (qIdx !== -1) {
    const q = queuedJobs.splice(qIdx, 1)[0];
    q.job.status = 'stopped';
    q.job.endTime = new Date().toISOString();
    q.job.error = 'Zadanie anulowane przed uruchomieniem';
    addJobHistory(q.job);
    addAuditLog(actorUsername, 'STOP_JOB', `Cancelled queued job for task: ${q.task.name}`);
    return true;
  }

  const ctx = activeJobs.get(jobId);
  if (!ctx) return false;

  ctx.cancelled = true;
  ctx.job.status = 'stopping';
  addAuditLog(actorUsername, 'STOP_JOB', `Stopping active job: ${ctx.task.name} (${jobId})`);

  if (ctx.simulationTimer) {
    clearInterval(ctx.simulationTimer);
  }

  if (ctx.process && !ctx.process.killed) {
    try {
      ctx.process.kill('SIGTERM');
      setTimeout(() => {
        if (ctx.process && !ctx.process.killed) {
          ctx.process.kill('SIGKILL');
        }
      }, 3000);
    } catch (e) {
      console.error('Error killing process:', e);
    }
  }

  setTimeout(() => {
    finishJob(ctx, 'stopped', 'Zadanie zostało zatrzymane przez użytkownika.');
  }, 500);

  return true;
}

// Trigger a task (either backup or restore)
export function enqueueTask(
  task: Task,
  mode: 'backup' | 'restore' = 'backup',
  restoredPairIds?: string[],
  triggeredBy: string = 'manual'
): JobExecution {
  if (isTaskRunningOrQueued(task.id)) {
    throw new Error(`Zadanie "${task.name}" jest już aktywne lub oczekuje w kolejce.`);
  }

  const previews = generateCommandPreview(task, mode, restoredPairIds);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const taskIdentifier = task.taskNumber ? `${task.taskNumber}` : task.id.slice(0, 8);
  const safeTaskName = task.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const logDirName = `${taskIdentifier}_${safeTaskName}`;
  let logFileName = mode === 'restore' ? `${dateStr}_RESTORE.log` : `${dateStr}.log`;
  const taskLogsDir = path.join(getLogsDir(), logDirName);

  if (!fs.existsSync(taskLogsDir)) {
    fs.mkdirSync(taskLogsDir, { recursive: true });
  }

  let logFilePath = path.join(taskLogsDir, logFileName);
  if (fs.existsSync(logFilePath)) {
    logFileName = mode === 'restore' ? `${dateStr}_${now.getMilliseconds()}_RESTORE.log` : `${dateStr}_${now.getMilliseconds()}.log`;
    logFilePath = path.join(taskLogsDir, logFileName);
  }

  const job: JobExecution = {
    id: crypto.randomUUID(),
    taskId: task.id,
    taskNumber: task.taskNumber,
    taskName: task.name,
    mode,
    restoredPairIds,
    status: 'queued',
    startTime: now.toISOString(),
    filesTransferred: 0,
    filesTotal: 0,
    bytesTransferred: 0,
    bytesTotal: 0,
    speed: '0 B/s',
    eta: '--:--',
    percentage: 0,
    logFile: path.relative(getLogsDir(), logFilePath),
    commandPreviews: previews,
    triggeredBy,
  };

  queuedJobs.push({ job, task, restoredPairIds });
  addAuditLog(triggeredBy, mode === 'restore' ? 'START_RESTORE' : 'START_TASK', `Queued ${mode} job for task ${task.name}`);

  // Try processing next
  processQueue();

  return job;
}

function processQueue(): void {
  const settings = getSettings();
  const maxConcurrent = Math.max(1, settings.maxConcurrentJobs || 1);
  const delayMs = Math.max(0, settings.queueStartDelaySeconds ?? 5) * 1000;

  if (activeJobs.size >= maxConcurrent || queuedJobs.length === 0) {
    return;
  }

  // Enforce a breather since the last job finished, so the next job in the
  // queue (chained, manually triggered, or scheduled) doesn't start
  // immediately back-to-back. A fresh queue with no prior completion
  // (lastJobFinishTime === 0) is exempt - only applies "between" jobs.
  if (delayMs > 0 && lastJobFinishTime > 0) {
    const elapsed = Date.now() - lastJobFinishTime;
    if (elapsed < delayMs) {
      if (!queueDelayTimer) {
        queueDelayTimer = setTimeout(() => {
          queueDelayTimer = null;
          processQueue();
        }, delayMs - elapsed);
      }
      return;
    }
  }

  while (activeJobs.size < maxConcurrent && queuedJobs.length > 0) {
    const item = queuedJobs.shift();
    if (item) {
      runJob(item.job, item.task, item.restoredPairIds);
    }
  }
}

function runJob(job: JobExecution, task: Task, selectedPairIds?: string[]): void {
  job.status = 'running';
  job.startTime = new Date().toISOString();

  const safeTaskName = task.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const logFilePath = path.join(getLogsDir(), job.logFile || `${safeTaskName}/latest.log`);
  fs.writeFileSync(logFilePath, `[SyncVault Job Started at ${job.startTime}]\nTask: ${task.name}\nMode: ${job.mode.toUpperCase()}\nEngine: ${task.engine}\nCommands:\n${job.commandPreviews.join('\n')}\n----------------------------------------\n`, 'utf-8');

  const pairs = task.pairs.filter(p => !selectedPairIds || selectedPairIds.length === 0 || selectedPairIds.includes(p.id));

  const ctx: ActiveJobContext = {
    job,
    task,
    logFilePath,
    cancelled: false,
    totalPairs: pairs.length,
    currentPairIdx: 0,
    completedPairsMetrics: [],
    currentPairMetrics: {
      filesTransferred: 0,
      filesTotal: 0,
      bytesTransferred: 0,
      bytesTotal: 0,
    },
    liveSentItems: [],
    liveDeletedItems: [],
    liveSentMap: new Map(),
    liveDeletedMap: new Map(),
    currentPairHadOneDriveLimitError: false,
    oneDriveLongPathsSet: new Set(job.oneDriveLongPaths || []),
  };

  activeJobs.set(job.id, ctx);
  addJobHistory(job);

  const tools = checkToolAvailability();
  const hasRealTool = (task.engine === 'rclone' && tools.rclone) || (task.engine === 'rsync' && tools.rsync);

  if (hasRealTool) {
    executeRealJob(ctx, selectedPairIds);
  } else {
    // Run robust simulation with real progress calculations and OneDrive 400-char path check
    executeSimulatedJob(ctx);
  }
}

function executeRealJob(ctx: ActiveJobContext, selectedPairIds?: string[]): void {
  const { job, task, logFilePath } = ctx;
  const pairs = task.pairs.filter(p => !selectedPairIds || selectedPairIds.length === 0 || selectedPairIds.includes(p.id));
  ctx.totalPairs = pairs.length;

  let pairSeqIndex = 0;

  const runNextPair = () => {
    if (ctx.cancelled) return;
    if (pairSeqIndex >= pairs.length) {
      finishJob(ctx, 'completed');
      return;
    }

    ctx.currentPairIdx = pairSeqIndex;
    ctx.currentPairHadOneDriveLimitError = false;
    ctx.currentPairMetrics = {
      filesTransferred: 0,
      filesTotal: 0,
      bytesTransferred: 0,
      bytesTotal: 0,
      checksChecked: 0,
      checksTotal: 0,
      speed: '0 B/s',
      eta: '--:--',
      percentage: 0,
    };
    const pair = pairs[pairSeqIndex];
    pairSeqIndex++;

    const dateStr = new Date().toISOString().split('T')[0];
    let src = job.mode === 'restore' ? pair.destination : pair.source;
    let dst = job.mode === 'restore' ? pair.source : pair.destination;

    let cmd = task.engine;
    let args: string[] = [];

    if (task.engine === 'rclone') {
      let action = 'sync';
      if (task.type === 'copy') action = 'copy';
      if (task.type === 'move') action = 'move';
      args = [action, src, dst, '-P', '--stats', '1s'];

      // Ensure verbose output is present so live file transfers and deletions are tracked accurately
      const wantReports = Boolean(task.notifications?.csvReportSent || task.notifications?.csvReportDeleted);
      if (wantReports && !task.customFlags?.includes('-v') && !task.customFlags?.includes('--verbose')) {
        args.push('-v');
      }

      const rcloneConf = getRcloneConfigPath();
      if (fs.existsSync(rcloneConf)) {
        args.push('--config', rcloneConf);
      }

      if (task.type === 'mirror' && task.trashEnabled && job.mode === 'backup') {
        const trashDir = `${dst.replace(/\/+$/, '')}_TRASH/${dateStr}`;
        args.push('--backup-dir', trashDir);
      }

      if (task.excludeFilters) {
        task.excludeFilters.forEach(f => {
          if (f.trim()) args.push('--exclude', f.trim());
        });
      }

      if (task.customFlags) {
        args.push(...task.customFlags.split(' ').filter(Boolean));
      }
    } else {
      // rsync
      const rsyncMode = task.rsyncFlagsMode === 'rtv' ? '-rtv' : '-avh';
      args = [rsyncMode, '--info=progress2', '--stats'];
      const wantReports = Boolean(task.notifications?.csvReportSent || task.notifications?.csvReportDeleted);
      if (wantReports && !task.customFlags?.includes('-i') && !task.customFlags?.includes('--itemize-changes')) {
        args.push('-i');
      }
      if (task.type === 'mirror') args.push('--delete');
      if (task.type === 'move') args.push('--remove-source-files');

      if (task.type === 'mirror' && task.trashEnabled && job.mode === 'backup') {
        const trashDir = `${dst.replace(/\/+$/, '')}_TRASH/${dateStr}`;
        args.push('--backup', `--backup-dir=${trashDir}`);
      }

      if (task.excludeFilters) {
        task.excludeFilters.forEach(f => {
          if (f.trim()) args.push(`--exclude=${f.trim()}`);
        });
      }

      if (task.customFlags) {
        const safeFlags = sanitizeRsyncFlags(task.customFlags, (msg) => {
          fs.appendFileSync(logFilePath, `${msg}\n`);
        });
        args.push(...safeFlags);
      }

      args.push(src.endsWith('/') || src.includes(':') ? src : `${src}/`);
      args.push(dst.endsWith('/') || dst.includes(':') ? dst : `${dst}/`);
    }

    // Check if local source path physically exists in container filesystem
    const rawLocalSrc = src.replace(/\/+$/, '');
    if (!src.includes(':') && !fs.existsSync(rawLocalSrc)) {
      fs.appendFileSync(
        logFilePath,
        `[UWAGA / ŚCIEŻKA DOCKER] Lokalny katalog źródłowy nie istnieje wewnątrz kontenera: "${rawLocalSrc}"\n` +
          `Wskazówka: Kontener Docker ma własny system plików i widzi tylko zamontowane wolumeny.\n` +
          `1. Jeśli Twoje dane znajdują się w folderze ./data na hoście, w aplikacji użyj ścieżki /data/... (np. /data/IN01 - kopia)\n` +
          `2. Jeśli Twoje dane są w osobnym folderze na hoście (np. /DATAtest), musisz dopisać go do pliku docker-compose.yml w sekcji volumes:\n` +
          `     - /DATAtest:/DATAtest\n` +
          `   a następnie wykonać: sudo docker compose up -d --build\n\n`
      );
    }

    const loggedCommand = `${cmd} ` + args.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ');
    fs.appendFileSync(logFilePath, `\nExecuting Pair ${pairSeqIndex}/${pairs.length}: ${loggedCommand}\n`);

    try {
      const proc = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, RCLONE_CONFIG: getRcloneConfigPath() },
      });
      ctx.process = proc;

      proc.stdout.on('data', chunk => {
        const str = chunk.toString();
        fs.appendFileSync(logFilePath, str);
        checkOneDriveLongPathError(ctx, str);
        parseRealOutputProgress(ctx, str);
        parseLiveTransferredFiles(ctx, str);
      });

      proc.stderr.on('data', chunk => {
        const str = chunk.toString();
        const hasStandardLog = /Transferred:|Checks:|INFO\s*:|NOTICE\s*:|ERROR\s*:|Elapsed time:/i.test(str);
        if (hasStandardLog) {
          fs.appendFileSync(logFilePath, str);
        } else {
          fs.appendFileSync(logFilePath, `[STDERR] ${str}`);
        }
        checkOneDriveLongPathError(ctx, str);
        parseRealOutputProgress(ctx, str);
        parseLiveTransferredFiles(ctx, str);
      });

      proc.on('close', code => {
        if (ctx.cancelled) return;
        const hadOneDriveLimitError = Boolean(
          ctx.currentPairHadOneDriveLimitError ||
          (ctx.job.oneDriveLongPaths && ctx.job.oneDriveLongPaths.length > 0)
        );

        if (code === 0 || hadOneDriveLimitError) {
          ctx.currentPairMetrics.percentage = 100;
          ctx.currentPairMetrics.eta = '0s';

          if (code !== 0 && hadOneDriveLimitError) {
            fs.appendFileSync(
              logFilePath,
              `\n[ONEDRIVE 400-CHAR LIMIT DETECTED] Para ${pairSeqIndex}/${pairs.length} zakończona pomyślnie z ostrzeżeniem o limicie 400 znaków OneDrive (kod: ${code}).\n`
            );
          }

          ctx.completedPairsMetrics.push({ ...ctx.currentPairMetrics });
          ctx.currentPairMetrics = {
            filesTransferred: 0,
            filesTotal: 0,
            bytesTransferred: 0,
            bytesTotal: 0,
            checksChecked: 0,
            checksTotal: 0,
            speed: '0 B/s',
            eta: '--:--',
            percentage: 0,
          };
          updateJobAggregatedStats(ctx);

          runNextPair();
        } else {
          finishJob(ctx, 'failed', `Proces zakończony kodem błędu: ${code}`);
        }
      });

      proc.on('error', err => {
        fs.appendFileSync(logFilePath, `[ERROR] ${err.message}\n`);
        finishJob(ctx, 'failed', err.message);
      });
    } catch (e: any) {
      finishJob(ctx, 'failed', e.message);
    }
  };

  runNextPair();
}

function updateJobAggregatedStats(ctx: ActiveJobContext): void {
  const { job, completedPairsMetrics, currentPairMetrics, totalPairs, currentPairIdx } = ctx;

  const completedFilesXfr = completedPairsMetrics.reduce((acc, p) => acc + p.filesTransferred, 0);
  const completedFilesTot = completedPairsMetrics.reduce((acc, p) => acc + p.filesTotal, 0);
  const completedBytesXfr = completedPairsMetrics.reduce((acc, p) => acc + p.bytesTransferred, 0);
  const completedBytesTot = completedPairsMetrics.reduce((acc, p) => acc + p.bytesTotal, 0);

  const completedChecks = completedPairsMetrics.map(p => getPairChecks(p, ctx.task.engine));
  const completedChecksChecked = completedChecks.reduce((acc, c) => acc + c.checked, 0);
  const completedChecksTot = completedChecks.reduce((acc, c) => acc + c.total, 0);

  job.filesTransferred = completedFilesXfr + currentPairMetrics.filesTransferred;
  job.filesTotal = Math.max(job.filesTransferred, completedFilesTot + currentPairMetrics.filesTotal);
  job.bytesTransferred = completedBytesXfr + currentPairMetrics.bytesTransferred;

  const knownTotalBytes = completedBytesTot + currentPairMetrics.bytesTotal;
  if (knownTotalBytes > 0) {
    job.bytesTotal = Math.max(job.bytesTransferred, knownTotalBytes);
  } else {
    // If total bytes not yet determined, keep bytesTotal equal to transferred for display
    job.bytesTotal = job.bytesTransferred;
  }

  const currentChecks = getPairChecks(currentPairMetrics, ctx.task.engine);
  const combinedChecksChecked = completedChecksChecked + currentChecks.checked;
  const combinedChecksTot = completedChecksTot + currentChecks.total;

  if (combinedChecksTot > 0 || combinedChecksChecked > 0) {
    job.checksChecked = combinedChecksChecked;
    job.checksTotal = Math.max(combinedChecksChecked, combinedChecksTot);
  }

  if (currentPairMetrics.speed) {
    job.speed = currentPairMetrics.speed;
  }
  if (currentPairMetrics.eta) {
    job.eta = currentPairMetrics.eta;
  }

  // Calculate percentage:
  // Use weighted multi-pair progress so multi-pair jobs progress accurately without early 99% jumps:
  if (totalPairs > 0) {
    let pairProg = currentPairMetrics.percentage ?? 0;
    // If percentage was not set directly, derive from files or bytes if available:
    if (pairProg === 0) {
      if (currentPairMetrics.bytesTotal > 0 && currentPairMetrics.bytesTransferred > 0) {
        pairProg = Math.round((currentPairMetrics.bytesTransferred / currentPairMetrics.bytesTotal) * 100);
      } else if (currentPairMetrics.filesTotal > 0 && currentPairMetrics.filesTransferred > 0) {
        pairProg = Math.round((currentPairMetrics.filesTransferred / currentPairMetrics.filesTotal) * 100);
      }
    }
    pairProg = Math.min(100, Math.max(0, pairProg));

    // Calculate overall job percentage based on completed pairs + current pair fraction:
    const overall = ((currentPairIdx + (pairProg / 100)) / totalPairs) * 100;
    job.percentage = Math.min(99, Math.max(0, Math.round(overall)));
  } else if (job.bytesTotal > 0 && job.bytesTransferred > 0 && job.bytesTotal > job.bytesTransferred) {
    job.percentage = Math.min(99, Math.round((job.bytesTransferred / job.bytesTotal) * 100));
  }

  addJobHistory(job);
}

function parseRealOutputProgress(ctx: ActiveJobContext, output: string): void {
  const lines = output.split(/[\r\n]+/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (ctx.task.engine === 'rclone') {
      // 1. Rclone Data Size & Speed:
      // "Transferred: 1.124 MiB / 32.634 MiB, 3%, 0 B/s, ETA -"
      // "Transferred: 32.634 MiB / 32.634 MiB, 100%, 0 B/s, ETA -"
      const dataMatch = line.match(/Transferred:\s+([0-9,.]+)\s*([KMGTPE]?i?B)\s*\/\s*([0-9,.]+)\s*([KMGTPE]?i?B)(?:,\s*([0-9]+)%)?(?:,\s*([0-9,.]+\s*[KMGTPE]?i?B\/s))?(?:,\s*ETA\s*([^\r\n,]+))?/i);
      if (dataMatch) {
        ctx.currentPairMetrics.bytesTransferred = parseFormattedSizeToBytes(dataMatch[1], dataMatch[2]);
        const parsedBytesTotal = parseFormattedSizeToBytes(dataMatch[3], dataMatch[4]);
        ctx.currentPairMetrics.bytesTotal = Math.max(ctx.currentPairMetrics.bytesTotal, parsedBytesTotal);
        if (dataMatch[5]) {
          ctx.currentPairMetrics.percentage = parseInt(dataMatch[5], 10);
        }
        if (dataMatch[6]) {
          ctx.currentPairMetrics.speed = dataMatch[6].trim();
        }
        if (dataMatch[7]) {
          const eta = dataMatch[7].trim();
          ctx.currentPairMetrics.eta = eta === '-' ? '0s' : eta;
        }
      }

      // 2. Rclone Files count:
      // "Transferred: 1 / 6, 17%"
      // "Transferred: 21 / 21, 100%"
      const filesMatch = line.match(/Transferred:\s+([0-9]+)\s*\/\s*([0-9]+)(?:,\s*([0-9]+)%)?/i);
      if (filesMatch && !line.includes('B') && !line.includes('iB')) {
        ctx.currentPairMetrics.filesTransferred = parseInt(filesMatch[1], 10);
        const parsedFilesTotal = parseInt(filesMatch[2], 10);
        ctx.currentPairMetrics.filesTotal = Math.max(ctx.currentPairMetrics.filesTotal, parsedFilesTotal);
        if (filesMatch[3] && !ctx.currentPairMetrics.percentage) {
          ctx.currentPairMetrics.percentage = parseInt(filesMatch[3], 10);
        }
      }

      // 2b. Rclone Errors count:
      // "Errors: 4 (no need to retry)"
      const errCountMatch = line.match(/Errors:\s*([0-9]+)(?:\s*\([^)]*\))?/i);
      if (errCountMatch) {
        const errorsCount = parseInt(errCountMatch[1], 10);
        if (errorsCount > 0) {
          ctx.currentPairMetrics.filesTotal = Math.max(
            ctx.currentPairMetrics.filesTotal,
            ctx.currentPairMetrics.filesTransferred + errorsCount
          );
        }
      }

      // 3. Rclone Checks / Listed:
      // "Checks: 14 / 14, 100%, Listed 1019"
      // "Checks: 8347 / 8347, 100%, Listed 18735"
      const checksMatch = line.match(/Checks:\s+([0-9]+)\s*\/\s*([0-9]+)(?:,\s*([0-9]+)%)?/i);
      if (checksMatch) {
        const checked = parseInt(checksMatch[1], 10);
        const checkTotal = parseInt(checksMatch[2], 10);
        ctx.currentPairMetrics.checksChecked = checked;
        ctx.currentPairMetrics.checksTotal = Math.max(ctx.currentPairMetrics.checksTotal || 0, checkTotal);
        // When no files need to be transferred, percentage reflects check progress
        if (checksMatch[3] && ctx.currentPairMetrics.filesTransferred === 0 && ctx.currentPairMetrics.bytesTotal === 0) {
          ctx.currentPairMetrics.percentage = parseInt(checksMatch[3], 10);
        }
      }
    } else {
      // RSYNC PARSING:
      // 1. In-progress transfer line (--info=progress2 or --progress):
      // e.g.:
      // " 15.54M 45% 5.15MB/s 0:00:02 (xfr#1, to-chk=6/8)"
      // " 15.54M 100% 5.15MB/s 0:00:02 (xfr#1, to-chk=6/8)"
      // " 1.08M 6% 1024.00kB/s 0:00:14"
      const rsyncProgressMatch = line.match(/([0-9,.]+)\s*([KMGTPE]?B?)\s+([0-9]+)%\s+([0-9,.]+\s*[KMGTPE]?B\/s)\s+([0-9:]+)(?:\s+\(xfr#([0-9]+),\s+to-chk=([0-9]+)\/([0-9]+)\))?/i);
      if (rsyncProgressMatch) {
        const currentBytes = parseFormattedSizeToBytes(rsyncProgressMatch[1], rsyncProgressMatch[2]);
        const pct = parseInt(rsyncProgressMatch[3], 10);
        ctx.currentPairMetrics.speed = rsyncProgressMatch[4].trim();
        ctx.currentPairMetrics.eta = rsyncProgressMatch[5].trim();

        const xfrCount = rsyncProgressMatch[6] ? parseInt(rsyncProgressMatch[6], 10) : 0;
        const toChkRem = rsyncProgressMatch[7] !== undefined ? parseInt(rsyncProgressMatch[7], 10) : undefined;
        const toChkTot = rsyncProgressMatch[8] !== undefined ? parseInt(rsyncProgressMatch[8], 10) : undefined;

        if (xfrCount > 0) {
          ctx.currentPairMetrics.filesTransferred = Math.max(ctx.currentPairMetrics.filesTransferred, xfrCount);
          ctx.currentPairMetrics.filesTotal = Math.max(ctx.currentPairMetrics.filesTotal, xfrCount);
        }
        if (toChkTot !== undefined && toChkTot > 0) {
          ctx.currentPairMetrics.checksTotal = toChkTot;
          if (toChkRem !== undefined) {
            ctx.currentPairMetrics.checksChecked = Math.max(0, toChkTot - toChkRem);
          }
        }

        // Percentage determination:
        if (toChkTot !== undefined && toChkTot > 0 && toChkRem !== undefined) {
          const filesDone = toChkTot - toChkRem;
          const filePct = Math.round((filesDone / toChkTot) * 100);
          // If legacy --progress was used, pct reaches 100% on each individual file even if toChkRem > 0
          if (toChkRem > 0 && pct === 100) {
            ctx.currentPairMetrics.percentage = filePct;
          } else {
            // With --info=progress2, pct is the overall byte percentage for this pair
            ctx.currentPairMetrics.percentage = pct;
          }
        } else {
          ctx.currentPairMetrics.percentage = pct;
        }

        if (currentBytes > 0) {
          ctx.currentPairMetrics.bytesTransferred = Math.max(ctx.currentPairMetrics.bytesTransferred, currentBytes);
          // If we have an in-flight percentage and don't yet have bytesTotal from --stats, estimate pair total:
          if (ctx.currentPairMetrics.percentage > 0 && ctx.currentPairMetrics.bytesTotal === 0) {
            const estimatedTot = Math.round(ctx.currentPairMetrics.bytesTransferred / (ctx.currentPairMetrics.percentage / 100));
            if (estimatedTot > ctx.currentPairMetrics.bytesTransferred) {
              ctx.currentPairMetrics.bytesTotal = estimatedTot;
            }
          }
        }
      }

      // 2. Summary stats (--stats):
      // "Number of regular files transferred: 0" or 6
      const regXfrMatch = line.match(/Number of regular files transferred:\s*([0-9,]+)/i);
      if (regXfrMatch) {
        const xfrCount = parseInt(regXfrMatch[1].replace(/,/g, ''), 10);
        ctx.currentPairMetrics.filesTransferred = xfrCount;
        ctx.currentPairMetrics.filesTotal = xfrCount;
      }

      // "Number of files: 8 (reg: 6, dir: 2)"
      // This represents total files/dirs checked in the source directory
      const totalFilesMatch = line.match(/Number of files:\s*([0-9,]+)(?:\s*\(reg:\s*([0-9,]+))?/i);
      if (totalFilesMatch) {
        const totalCount = parseInt(totalFilesMatch[1].replace(/,/g, ''), 10);
        ctx.currentPairMetrics.checksChecked = totalCount;
        ctx.currentPairMetrics.checksTotal = totalCount;
      }

      // "Total transferred file size: 0 bytes" or 15.54M bytes
      // This represents actual file bytes transferred
      const xfrSizeMatch = line.match(/Total transferred file size:\s*([0-9,.]+)\s*([KMGTPE]?)\s*bytes/i);
      if (xfrSizeMatch) {
        const bytes = parseFormattedSizeToBytes(xfrSizeMatch[1], xfrSizeMatch[2]);
        ctx.currentPairMetrics.bytesTransferred = bytes;
        ctx.currentPairMetrics.bytesTotal = bytes;
      }

      // "Total bytes sent: 384,774,905" (fallback if Total transferred file size was missing)
      const bytesSentMatch = line.match(/Total bytes sent:\s*([0-9,]+)/i);
      if (bytesSentMatch && ctx.currentPairMetrics.bytesTransferred === 0) {
        const bytes = parseInt(bytesSentMatch[1].replace(/,/g, ''), 10);
        ctx.currentPairMetrics.bytesTransferred = bytes;
        ctx.currentPairMetrics.bytesTotal = bytes;
      }

      // "sent 859 bytes received 97 bytes 1.91K bytes/sec"
      const speedMatch = line.match(/sent\s+[0-9,]+\s+bytes\s+received\s+[0-9,]+\s+bytes\s+([0-9,.]+\s*[KMGTPE]?\s*bytes\/sec)/i);
      if (speedMatch) {
        ctx.currentPairMetrics.speed = speedMatch[1].trim();
      }
    }
  }

  updateJobAggregatedStats(ctx);
}

function checkOneDriveLongPathError(ctx: ActiveJobContext, text: string): void {
  if (!text) return;
  const lines = text.split(/[\r\n]+/);

  if (!ctx.oneDriveLongPathsSet) {
    ctx.oneDriveLongPathsSet = new Set<string>(ctx.job.oneDriveLongPaths || []);
  }

  const pair = ctx.task.pairs[ctx.currentPairIdx];
  const srcBase = ctx.job.mode === 'restore' ? pair?.destination : pair?.source;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for OneDrive / SharePoint path length limit error indicators:
    // e.g. "pathIsTooLong", "The specified file or folder name is too long", "400 characters or less", "name too long", "path too long"
    const isOneDriveLimit =
      line.includes('pathIsTooLong') ||
      line.includes('The specified file or folder name is too long') ||
      line.includes('400 characters or less') ||
      line.includes('path too long') ||
      line.includes('name too long');

    if (!isOneDriveLimit) continue;

    // Mark current pair as affected by OneDrive limit error
    ctx.currentPairHadOneDriveLimitError = true;

    // Extract specific file path from rclone error output lines:
    // e.g.:
    // "2026/09/25 21:21:21 ERROR : syncthing_OLD/Downloads/motorola edge 50 neo/Metro-w-Porto...png: Failed to copy: invalidRequest: pathIsTooLong: ..."
    // "2026/09/25 21:21:22 ERROR : Wielka księga wartości...: Failed to copy: ..."
    // "[STDERR] 2026/09/25 21:21:21 ERROR : Documents/Books/EPUB/...epub: Failed to copy: ..."
    const cleanLine = line
      .replace(/^\[STDERR\]\s*/i, '')
      .replace(/^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s+(?:ERROR|WARNING|NOTICE|INFO)\s*:\s*/i, '')
      .trim();

    const fileMatch = cleanLine.match(
      /^(.+?):\s*Failed to (?:copy|sync|move|upload)[^:]*:\s*(?:invalidRequest:\s*)?(?:pathIsTooLong|.*(?:path|name|URL).*too long|.*400\s*char)/i
    );

    if (fileMatch) {
      const rawFilePath = fileMatch[1].trim();

      // Guard against generic summary / driver messages
      if (
        !rawFilePath.startsWith('NOTICE') &&
        !rawFilePath.startsWith('Encrypted drive') &&
        !rawFilePath.startsWith("Can't retry") &&
        !rawFilePath.includes('Failed to sync with')
      ) {
        // Construct clear full or relative path for user identification
        let resolvedPath = rawFilePath;
        if (srcBase && !rawFilePath.startsWith('/') && !rawFilePath.includes('://')) {
          const cleanBase = srcBase.replace(/\/+$/, '');
          resolvedPath = `${cleanBase}/${rawFilePath}`;
        }
        ctx.oneDriveLongPathsSet.add(resolvedPath);
      }
    }
  }

  if (ctx.oneDriveLongPathsSet.size > 0) {
    ctx.job.oneDriveLongPaths = Array.from(ctx.oneDriveLongPathsSet);
    const count = ctx.job.oneDriveLongPaths.length;
    ctx.job.warning = `Wykryto ${count} ${count === 1 ? 'plik pominięty' : count < 5 ? 'pliki pominięte' : 'plików pominiętych'} z powodu limitu 400 znaków OneDrive. Zapisano do raportu.`;
  }
}

function parseLiveTransferredFiles(ctx: ActiveJobContext, chunk: string): void {
  const lines = chunk.split(/[\r\n]+/);
  const pair = ctx.task.pairs[ctx.currentPairIdx];
  if (!pair) return;

  const srcBase = ctx.job.mode === 'restore' ? pair.destination : pair.source;
  const dstBase = ctx.job.mode === 'restore' ? pair.source : pair.destination;
  const pairDest = pair.destination;
  const pairKey = pair.id || String(ctx.currentPairIdx);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (ctx.task.engine === 'rclone') {
      const cleanLine = line.replace(/^\[STDERR\]\s*/, '');
      const match = cleanLine.match(/(?:INFO|NOTICE)\s*:\s*(.+?):\s*(Copied \([^)]+\)|Deleted|Moved to backup-dir|Moved to trash|Moved \(server-side\))/i);
      if (match) {
        const relPath = match[1].trim();
        const action = match[2].trim().toLowerCase();

        if (action.startsWith('copied') || action.includes('moved (server-side)')) {
          const fullPath = resolveFilePath(srcBase, relPath);
          const mapKey = `${pairKey}::${fullPath}`;
          if (!ctx.liveSentMap.has(mapKey)) {
            let stat = getLocalFileStat(fullPath);
            if (stat.size === 0 && !dstBase.includes(':')) {
              const altPath = resolveFilePath(dstBase, relPath);
              const altStat = getLocalFileStat(altPath);
              if (altStat.size > 0) stat = altStat;
            }
            const item: CsvReportItem = {
              fullPath,
              destination: pairDest,
              sizeBytes: stat.size,
              sizeFormatted: `${formatBytes(stat.size)} (${stat.size} B)`,
              mtime: stat.mtime,
              status: 'OK',
            };
            ctx.liveSentMap.set(mapKey, item);
            ctx.liveSentItems.push(item);
          }
        } else if (action === 'deleted' || action.includes('backup-dir') || action.includes('trash')) {
          const fullPath = resolveFilePath(dstBase, relPath);
          const delMapKey = `${pairKey}::${fullPath}`;
          if (!ctx.liveDeletedMap.has(delMapKey)) {
            const stat = getLocalFileStat(fullPath);
            const isTmp = action.includes('backup-dir') || action.includes('trash') || (ctx.task.trashEnabled && ctx.task.type === 'mirror');
            const item: CsvReportItem = {
              fullPath,
              destination: pairDest,
              sizeBytes: stat.size,
              sizeFormatted: `${formatBytes(stat.size)} (${stat.size} B)`,
              mtime: stat.mtime,
              status: isTmp ? 'TMP' : 'OK',
            };
            ctx.liveDeletedMap.set(delMapKey, item);
            ctx.liveDeletedItems.push(item);
          }
        }
      }
    } else {
      // rsync
      const delMatch = line.match(/^\*deleting\s+(.+)$/);
      if (delMatch) {
        const relPath = delMatch[1].trim();
        const fullPath = resolveFilePath(dstBase, relPath);
        const delMapKey = `${pairKey}::${fullPath}`;
        if (!ctx.liveDeletedMap.has(delMapKey)) {
          const stat = getLocalFileStat(fullPath);
          const isTmp = ctx.task.trashEnabled && ctx.task.type === 'mirror';
          const item: CsvReportItem = {
            fullPath,
            destination: pairDest,
            sizeBytes: stat.size,
            sizeFormatted: `${formatBytes(stat.size)} (${stat.size} B)`,
            mtime: stat.mtime,
            status: isTmp ? 'TMP' : 'OK',
          };
          ctx.liveDeletedMap.set(delMapKey, item);
          ctx.liveDeletedItems.push(item);
        }
      }

      const xfrMatch = line.match(/^[><]f[^\s]*\s+(.+)$/);
      if (xfrMatch) {
        const relPath = xfrMatch[1].trim();
        const fullPath = resolveFilePath(srcBase, relPath);
        const mapKey = `${pairKey}::${fullPath}`;
        if (!ctx.liveSentMap.has(mapKey)) {
          const stat = getLocalFileStat(fullPath);
          const item: CsvReportItem = {
            fullPath,
            destination: pairDest,
            sizeBytes: stat.size,
            sizeFormatted: `${formatBytes(stat.size)} (${stat.size} B)`,
            mtime: stat.mtime,
            status: 'OK',
          };
          ctx.liveSentMap.set(mapKey, item);
          ctx.liveSentItems.push(item);
        }
      }
    }
  }
}

function executeSimulatedJob(ctx: ActiveJobContext): void {
  const { job, task, logFilePath } = ctx;
  let tick = 0;
  const totalTicks = 8;
  const mockTotalFiles = Math.floor(Math.random() * 25) + 10;
  const mockTotalBytes = mockTotalFiles * 1024 * 1024 * (Math.floor(Math.random() * 8) + 2);

  job.filesTotal = mockTotalFiles;
  job.bytesTotal = mockTotalBytes;
  job.checksTotal = mockTotalFiles;
  job.checksChecked = 0;
  job.speed = '3.4 MB/s';
  job.eta = '8s';

  // Check if OneDrive 400-char path testing is requested or task mentions onedrive
  const isOneDrive = task.pairs.some(p => p.source.toLowerCase().includes('onedrive') || p.destination.toLowerCase().includes('onedrive')) ||
                     task.customFlags.includes('--onedrive-test');

  const timer = setInterval(() => {
    if (ctx.cancelled) {
      clearInterval(timer);
      return;
    }

    tick++;
    const progressRatio = Math.min(1, tick / totalTicks);
    job.percentage = Math.round(progressRatio * 100);
    job.filesTransferred = Math.min(job.filesTotal, Math.round(progressRatio * job.filesTotal));
    job.checksChecked = job.filesTransferred;
    job.bytesTransferred = Math.min(job.bytesTotal, Math.round(progressRatio * job.bytesTotal));
    job.eta = tick >= totalTicks ? '0s' : `${(totalTicks - tick) * 2}s`;
    job.speed = `${(2.5 + Math.random() * 1.5).toFixed(1)} MB/s`;

    const sampleFile = `data/documents/folder_sync/file_${tick}.dat`;
    const mockFileSize = Math.round(mockTotalBytes / mockTotalFiles);
    const simDest = task.pairs[0]?.destination || 'backup_target';
    const simKey = `sim::${simDest}::${sampleFile}`;
    if (!ctx.liveSentMap.has(simKey)) {
      const item: CsvReportItem = {
        fullPath: sampleFile,
        destination: simDest,
        sizeBytes: mockFileSize,
        sizeFormatted: `${formatBytes(mockFileSize)} (${mockFileSize} B)`,
        mtime: formatMtime(new Date()),
        status: 'OK',
      };
      ctx.liveSentMap.set(simKey, item);
      ctx.liveSentItems.push(item);
    }
    const logLine = `[${new Date().toISOString()}] Transferring: ${sampleFile} (${(mockTotalBytes / mockTotalFiles / 1024 / 1024).toFixed(2)} MB) [${job.percentage}%]\n`;
    fs.appendFileSync(logFilePath, logLine);

    // If onedrive test, simulate one excessively long path
    if (isOneDrive && tick === 4 && (!job.oneDriveLongPaths || job.oneDriveLongPaths.length === 0)) {
      const veryLongDir = 'deep/nested/storage/onedrive/personal/archive/projects/2026/backup_enterprise_data_folder_with_extremely_long_nested_subfolders/department_finance_audit_reports_and_tax_declarations_final_version_signed_off_by_management/quarterly_q1_q2_q3_q4_combined_comprehensive_financial_analysis_spreadsheet_master_copy_v4_final_verified_by_auditors_approved_by_board_of_directors_2026_confidential_document.xlsx';
      job.oneDriveLongPaths = [veryLongDir];
      job.warning = `Wykryto 1 plik przekraczający limit 400 znaków OneDrive (${veryLongDir.length} zn.). Pominięto zgodnie z regułą i dodano raport txt.`;
      fs.appendFileSync(logFilePath, `[WARN - OneDrive Limit] Path length (${veryLongDir.length} > 400): ${veryLongDir}\n`);

      // Write onedrive skipped file
      const skippedPath = path.join(path.dirname(logFilePath), 'skipped_onedrive_paths.txt');
      fs.writeFileSync(skippedPath, `Pliki pominięte z powodu przekroczenia limitu 400 znaków w OneDrive:\n1. ${veryLongDir}\n`, 'utf-8');
    }

    addJobHistory(job);

    if (tick >= totalTicks) {
      clearInterval(timer);
      finishJob(ctx, 'completed');
    }
  }, 1000);

  ctx.simulationTimer = timer;
}

function finishJob(ctx: ActiveJobContext, finalStatus: 'completed' | 'failed' | 'stopped', errorMsg?: string): void {
  const { job, task, logFilePath } = ctx;

  job.status = finalStatus;
  job.endTime = new Date().toISOString();
  const startMs = new Date(job.startTime).getTime();
  const endMs = new Date(job.endTime).getTime();
  job.durationSeconds = Math.max(1, Math.round((endMs - startMs) / 1000));

  if (errorMsg) {
    job.error = errorMsg;
  }

  if (finalStatus === 'completed') {
    job.percentage = 100;
    const totalFilesTransferred = ctx.completedPairsMetrics?.reduce((acc, p) => acc + p.filesTransferred, 0) || 0;
    const totalFilesTotal = ctx.completedPairsMetrics?.reduce((acc, p) => acc + p.filesTotal, 0) || 0;
    const totalBytesTransferred = ctx.completedPairsMetrics?.reduce((acc, p) => acc + p.bytesTransferred, 0) || 0;
    const totalBytesTotal = ctx.completedPairsMetrics?.reduce((acc, p) => acc + p.bytesTotal, 0) || 0;

    const completedChecks = (ctx.completedPairsMetrics || []).map(p => getPairChecks(p, ctx.task.engine));
    const totalChecksChecked = completedChecks.reduce((acc, c) => acc + c.checked, 0);
    const totalChecksTotal = completedChecks.reduce((acc, c) => acc + c.total, 0);

    job.filesTransferred = totalFilesTransferred;
    job.filesTotal = Math.max(totalFilesTransferred, totalFilesTotal);
    job.bytesTransferred = totalBytesTransferred;
    job.bytesTotal = Math.max(totalBytesTransferred, totalBytesTotal);
    if (totalChecksChecked > 0 || totalChecksTotal > 0) {
      job.checksChecked = totalChecksChecked;
      job.checksTotal = Math.max(totalChecksChecked, totalChecksTotal);
    }

    job.eta = 'Zakończono';
  }

  const weightInfo = job.bytesTransferred > 0 ? ` (${formatBytes(job.bytesTransferred)})` : '';
  const checksInfo = (job.checksTotal || 0) > 0 ? `, Checked: ${job.checksChecked || job.checksTotal}/${job.checksTotal} files` : '';
  fs.appendFileSync(logFilePath, `\n----------------------------------------\n[SyncVault Job ${finalStatus.toUpperCase()} at ${job.endTime}]\nDuration: ${job.durationSeconds}s\nTransferred: ${job.filesTransferred}/${job.filesTotal} files${weightInfo}${checksInfo}\nStatus: ${finalStatus}\n`);

  // Save OneDrive skipped paths report file to disk if any occurred
  if (job.oneDriveLongPaths && job.oneDriveLongPaths.length > 0) {
    try {
      const taskFolder = path.dirname(logFilePath);
      const reportFilename = `onedrive_400char_skipped_${job.id}.txt`;
      const reportPath = path.join(taskFolder, reportFilename);
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
      fs.appendFileSync(logFilePath, `\n[RAPORT ONEDRIVE >400 ZN.] Zapisano raport pominiętych plików (${job.oneDriveLongPaths.length} pozycji) do: ${reportPath}\n`);
    } catch (e: any) {
      console.error('[OneDrive Report] Error writing report file:', e);
    }
  }

  // Generate & save CSV reports from live execution data if requested in task notifications
  if (task.notifications?.csvReportSent || task.notifications?.csvReportDeleted) {
    try {
      const csvFiles = saveTaskCsvReports(job, task, ctx.liveSentItems || [], ctx.liveDeletedItems || []);
      job.csvFiles = {
        sentFile: csvFiles.sentFile,
        deletedFile: csvFiles.deletedFile,
        sent: csvFiles.sentFile,
        deleted: csvFiles.deletedFile,
      };
      if (csvFiles.sentFile || csvFiles.deletedFile) {
        const sentCount = ctx.liveSentItems ? ctx.liveSentItems.length : 0;
        const deletedCount = ctx.liveDeletedItems ? ctx.liveDeletedItems.length : 0;
        fs.appendFileSync(
          logFilePath,
          `\n[RAPORTY CSV ZADANIA]\n` +
            (csvFiles.sentFile ? `  - Wysłane pliki: data/${csvFiles.sentFile} (${sentCount} plików)\n` : '') +
            (csvFiles.deletedFile ? `  - Usunięte pliki: data/${csvFiles.deletedFile} (${deletedCount} plików)\n` : '') +
            `----------------------------------------\n`
        );
      }
    } catch (e: any) {
      console.error('[CSV Reports] Error saving CSV reports:', e);
    }
  }

  activeJobs.delete(job.id);
  lastJobFinishTime = Date.now();
  addJobHistory(job);

  // Send notifications
  sendJobNotifications(job, task).catch(e => console.error('Notification error:', e));

  // Run cleanup routines: Trash purge, Log retention, CSV report retention, System logs retention, and DB backup retention
  cleanupTrashFolders(task);
  cleanupOldLogs(task);
  cleanupOldCsvReports(task);
  cleanupSystemLogs();
  cleanupDatabaseBackups();

  // Chained task execution: "uruchom po zakończeniu innego zadania - kolejkowanie"
  if (finalStatus === 'completed' && job.mode === 'backup') {
    triggerChainedTasks(task.id);
  }

  // Process next queued job
  processQueue();
}

function triggerChainedTasks(finishedTaskId: string): void {
  const allTasks = getTasks();
  const chained = allTasks.filter(t => t.runAfterTaskId === finishedTaskId);

  for (const chainedTask of chained) {
    try {
      console.log(`[Chaining] Triggering queued follow-up task "${chainedTask.name}" after completion of task ${finishedTaskId}`);
      enqueueTask(chainedTask, 'backup', undefined, `chain:${finishedTaskId}`);
    } catch (err: any) {
      console.warn(`[Chaining] Could not start chained task ${chainedTask.name}: ${err.message}`);
    }
  }
}

// Trash retention cleanup
function cleanupTrashFolders(task: Task): void {
  if (!task.trashEnabled) return;
  const settings = getSettings();
  const days = task.trashRetentionDays ?? settings.defaultTrashRetentionDays ?? 14;
  if (days <= 0) return;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  for (const pair of task.pairs) {
    // For local directory targets, scan and remove expired _TRASH/YYYY-MM-DD
    const targetDir = pair.destination;
    if (targetDir && !targetDir.includes(':')) {
      const trashParent = `${targetDir.replace(/\/+$/, '')}_TRASH`;
      if (fs.existsSync(trashParent)) {
        try {
          const subdirs = fs.readdirSync(trashParent);
          for (const sub of subdirs) {
            const subPath = path.join(trashParent, sub);
            const dateMatch = sub.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (dateMatch) {
              const folderDate = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
              if (folderDate < cutoff) {
                fs.rmSync(subPath, { recursive: true, force: true });
                console.log(`[Trash Cleanup] Removed expired trash directory: ${subPath}`);
              }
            }
          }
        } catch (e) {
          console.error('[Trash Cleanup] Error pruning trash:', e);
        }
      }
    }
  }
}

// Logs retention cleanup
function cleanupOldLogs(task: Task): void {
  const settings = getSettings();
  const days = task.logRetentionDays !== undefined && task.logRetentionDays !== null
    ? task.logRetentionDays
    : settings.defaultLogRetentionDays ?? 30;

  const taskIdentifier = task.taskNumber ? `${task.taskNumber}` : task.id.slice(0, 8);
  const safeTaskName = task.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dirNames = [`${taskIdentifier}_${safeTaskName}`, safeTaskName];

  for (const dirName of dirNames) {
    const taskLogsDir = path.join(getLogsDir(), dirName);
    if (!fs.existsSync(taskLogsDir)) continue;

    // If 0 days -> instant cleanup
    if (days === 0) {
      try {
        const files = fs.readdirSync(taskLogsDir);
        for (const f of files) {
          fs.unlinkSync(path.join(taskLogsDir, f));
        }
        console.log(`[Log Cleanup] Retention is 0 days, cleared all logs in ${taskLogsDir}`);
      } catch (e) {
        console.error('[Log Cleanup] Error clearing logs:', e);
      }
      continue;
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    try {
      const files = fs.readdirSync(taskLogsDir);
      for (const f of files) {
        const filePath = path.join(taskLogsDir, f);
        const stats = fs.statSync(filePath);
        if (stats.mtime < cutoff) {
          fs.unlinkSync(filePath);
          console.log(`[Log Cleanup] Removed expired log file: ${filePath}`);
        }
      }
    } catch (e) {
      console.error('[Log Cleanup] Error pruning logs:', e);
    }
  }
}

// CSV reports retention cleanup in data/files/<taskDirectory>/
export function cleanupOldCsvReports(task?: Task): void {
  const settings = getSettings();
  // Retention limit in days; defaults to defaultLogRetentionDays or 30
  const days = settings.csvReportRetentionDays !== undefined && settings.csvReportRetentionDays !== null
    ? settings.csvReportRetentionDays
    : settings.defaultLogRetentionDays ?? 30;

  // 0 days = unlimited retention (keep all)
  if (days === 0) return;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dataDir = getDataDir();
  const searchDirs = [getFilesDir(), path.join(dataDir, 'pliki')].filter(d => fs.existsSync(d));

  for (const rootDir of searchDirs) {
    try {
      const taskDirs = task ? [resolveTaskFilesDir(task)] : fs.readdirSync(rootDir).map(d => path.join(rootDir, d));
      for (const taskFilesDir of taskDirs) {
        if (!fs.existsSync(taskFilesDir)) continue;
        try {
          const statsDir = fs.statSync(taskFilesDir);
          if (!statsDir.isDirectory()) continue;
        } catch {
          continue;
        }

        try {
          const files = fs.readdirSync(taskFilesDir);
          for (const f of files) {
            if (!f.endsWith('.csv')) continue;
            const filePath = path.join(taskFilesDir, f);
            try {
              const stats = fs.statSync(filePath);
              if (stats.mtime < cutoff) {
                fs.unlinkSync(filePath);
                console.log(`[CSV Cleanup] Removed expired CSV report (${days}d limit): ${filePath}`);
              }
            } catch (err) {
              console.error(`[CSV Cleanup] Error pruning CSV file ${filePath}:`, err);
            }
          }
        } catch (e) {
          console.error(`[CSV Cleanup] Error reading directory ${taskFilesDir}:`, e);
        }
      }
    } catch (e) {
      console.error(`[CSV Cleanup] Error pruning CSV reports in ${rootDir}:`, e);
    }
  }
}

// Graceful container shutdown: "Obsługę zatrzymywania kontenera czyli np aktywne zadanie najpierw zostaje zatrzymane"
export function handleGracefulShutdown(): Promise<void> {
  console.log('[SyncVault] Initiating graceful container shutdown...');
  return new Promise(resolve => {
    // Also clear queued jobs
    while (queuedJobs.length > 0) {
      const q = queuedJobs.shift();
      if (q) {
        q.job.status = 'failed';
        q.job.endTime = new Date().toISOString();
        q.job.error = 'Zadanie anulowane: Kontener Docker został zamknięty zanim rozpoczęło się wykonywanie.';
        addJobHistory(q.job);
      }
    }

    const activeCount = activeJobs.size;
    if (activeCount === 0) {
      saveDatabase();
      resolve();
      return;
    }

    console.log(`[SyncVault] Stopping ${activeCount} active jobs before shutdown...`);
    for (const [id, ctx] of activeJobs.entries()) {
      ctx.cancelled = true;
      if (ctx.simulationTimer) clearInterval(ctx.simulationTimer);
      if (ctx.process && !ctx.process.killed) {
        try {
          ctx.process.kill('SIGTERM');
        } catch {}
      }
      finishJob(ctx, 'failed', 'Zadanie przerwane: Kontener Docker został zatrzymany (SIGTERM/SIGINT).');
    }

    saveDatabase();
    setTimeout(() => {
      resolve();
    }, 1000);
  });
}
