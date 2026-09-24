import fs from 'fs';
import path from 'path';
import util from 'util';
import { getLogsDir, getSettings } from './db.js';

let isInitialized = false;

// Format current local date as YYYY-MM-DD
export function getSystemLogDateStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format current local timestamp as YYYY-MM-DD HH:mm:ss
export function getSystemTimestampStr(date: Date = new Date()): string {
  const datePart = getSystemLogDateStr(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${datePart} ${hours}:${minutes}:${seconds}`;
}

// Get the full path for a daily system log file
export function getSystemLogFilePath(dateStr?: string): string {
  const dir = getLogsDir();
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }
  }
  const name = `logs_${dateStr || getSystemLogDateStr()}.log`;
  return path.join(dir, name);
}

// Strip ANSI color / control characters from string
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

// Internal append function
function appendToSystemLog(level: string, message: string): void {
  try {
    const filePath = getSystemLogFilePath();
    const timestamp = getSystemTimestampStr();
    const cleanMessage = stripAnsi(message);
    const line = `[${timestamp}] [${level}] ${cleanMessage}\n`;
    fs.appendFileSync(filePath, line, 'utf-8');
  } catch {
    // Fail silently to avoid breaking stdout/stderr
  }
}

/**
 * Initializes intercepting of console.log/info/warn/error so that
 * all stdout/stderr output from the server and Docker container
 * is mirrored into /data/logs/logs_yyyy-mm-dd.log while preserving
 * standard terminal output.
 */
export function initSystemLogger(): void {
  if (isInitialized) return;
  isInitialized = true;

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: any[]) => {
    originalLog.apply(console, args);
    const msg = util.format(...args);
    appendToSystemLog('INFO', msg);
  };

  console.info = (...args: any[]) => {
    originalInfo.apply(console, args);
    const msg = util.format(...args);
    appendToSystemLog('INFO', msg);
  };

  console.warn = (...args: any[]) => {
    originalWarn.apply(console, args);
    const msg = util.format(...args);
    appendToSystemLog('WARN', msg);
  };

  console.error = (...args: any[]) => {
    originalError.apply(console, args);
    const msg = util.format(...args);
    appendToSystemLog('ERROR', msg);
  };

  // Ensure logs directory exists right away
  try {
    const dir = getLogsDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    originalError('[SystemLogger] Could not ensure logs directory:', e);
  }
}

/**
 * Automatically cleans up daily system logs (logs_YYYY-MM-DD.log)
 * according to settings.defaultLogRetentionDays (default: 30 days).
 */
export function cleanupSystemLogs(): void {
  try {
    const settings = getSettings();
    const days = settings.defaultLogRetentionDays !== undefined && settings.defaultLogRetentionDays !== null
      ? settings.defaultLogRetentionDays
      : 30;

    // 0 days = keep indefinitely (or 0 means instant cleanup? In SyncVault defaultLogRetentionDays 0 is keep or clear; standard is cutoff if days > 0)
    if (days === 0) return;

    const logsDir = getLogsDir();
    if (!fs.existsSync(logsDir)) return;

    const files = fs.readdirSync(logsDir);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    for (const f of files) {
      // Matches logs_YYYY-MM-DD.log
      const match = /^logs_(\d{4}-\d{2}-\d{2})\.log$/.exec(f);
      if (!match) continue;

      const dateStr = match[1];
      const fileDate = new Date(`${dateStr}T23:59:59`);
      const filePath = path.join(logsDir, f);

      let shouldDelete = false;
      if (!isNaN(fileDate.getTime())) {
        shouldDelete = fileDate < cutoff;
      } else {
        const stats = fs.statSync(filePath);
        shouldDelete = stats.mtime < cutoff;
      }

      if (shouldDelete) {
        fs.unlinkSync(filePath);
        console.log(`[Log Cleanup] Pruned expired daily system log file: ${f} (Retention: ${days} days)`);
      }
    }
  } catch (e) {
    console.error('[SystemLogger] Error cleaning up old system logs:', e);
  }
}

/**
 * Returns a list of available daily log dates (e.g. ['2026-09-22', '2026-09-21'])
 */
export function getAvailableSystemLogDates(): string[] {
  try {
    const logsDir = getLogsDir();
    if (!fs.existsSync(logsDir)) return [];
    const files = fs.readdirSync(logsDir);
    const dates: string[] = [];

    for (const f of files) {
      const match = /^logs_(\d{4}-\d{2}-\d{2})\.log$/.exec(f);
      if (match) {
        dates.push(match[1]);
      }
    }
    return dates.sort().reverse();
  } catch {
    return [];
  }
}

/**
 * Reads the content of a daily system log file
 */
export function getSystemLogContent(dateStr?: string, maxBytes: number = 2 * 1024 * 1024): { content: string; filename: string; exists: boolean } {
  const targetDate = dateStr || getSystemLogDateStr();
  const filename = `logs_${targetDate}.log`;
  const filePath = path.join(getLogsDir(), filename);

  if (!fs.existsSync(filePath)) {
    return { content: `[Brak pliku logów systemowych dla daty ${targetDate}]`, filename, exists: false };
  }

  try {
    const stats = fs.statSync(filePath);
    if (stats.size > maxBytes) {
      // Read the last maxBytes
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(maxBytes);
      fs.readSync(fd, buffer, 0, maxBytes, stats.size - maxBytes);
      fs.closeSync(fd);
      return {
        content: `... [obcięto wcześniejszą treść - wyświetlanie ostatnich 2MB logu] ...\n` + buffer.toString('utf-8'),
        filename,
        exists: true,
      };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, filename, exists: true };
  } catch (e: any) {
    return { content: `Błąd odczytu pliku logów: ${e.message}`, filename, exists: false };
  }
}
