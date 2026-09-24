import fs from 'fs';
import path from 'path';
import { Task, JobExecution } from '../src/types.js';
import { resolveTaskFilesDir, getSettings } from './db.js';

export interface CsvReportItem {
  fullPath: string;
  destination?: string;
  sizeFormatted: string;
  sizeBytes: number;
  mtime: string;
  status: 'OK' | 'TMP' | 'ERR';
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, safeI)).toFixed(2)) + ' ' + sizes[safeI];
}

export function formatMtime(date: Date): string {
  try {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  } catch {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }
}

export function escapeCsvCell(val: string): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function writeCsvFile(filePath: string, items: CsvReportItem[], headerLang?: 'en' | 'pl'): void {
  const currentLang = headerLang || getSettings()?.csvHeaderLanguage || 'en';
  const header = currentLang === 'pl'
    ? '"Nazwa (pełna ścieżka)";"Cel";"Waga";"Data modyfikacji (mtime)";"Status"\r\n'
    : '"Name (full path)";"Destination";"Size";"Modified (mtime)";"Status"\r\n';

  const rows = items.map(item => {
    return `${escapeCsvCell(item.fullPath)};${escapeCsvCell(item.destination || '')};${escapeCsvCell(item.sizeFormatted)};${escapeCsvCell(item.mtime)};${escapeCsvCell(item.status)}\r\n`;
  }).join('');

  // UTF-8 BOM so Excel and Polish applications open it with correct diacritics
  const content = '\uFEFF' + header + rows;
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Saves the CSV reports directly from collected live job execution items.
 */
export function saveTaskCsvReports(
  job: JobExecution,
  task: Task,
  sentItems: CsvReportItem[],
  deletedItems: CsvReportItem[]
): { sentFile?: string; deletedFile?: string } {
  const wantSent = Boolean(task.notifications?.csvReportSent);
  const wantDeleted = Boolean(task.notifications?.csvReportDeleted);

  if (!wantSent && !wantDeleted) {
    return {};
  }

  const taskFilesDir = resolveTaskFilesDir(task);
  const taskDirName = path.basename(taskFilesDir);

  const now = new Date(job.startTime || Date.now());
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const shortId = job.id.slice(0, 8);

  const sentFilename = `${dateStr}_${shortId}_sent.csv`;
  const deletedFilename = `${dateStr}_${shortId}_deleted.csv`;

  const sentFilePath = path.join(taskFilesDir, sentFilename);
  const deletedFilePath = path.join(taskFilesDir, deletedFilename);

  const result: { sentFile?: string; deletedFile?: string } = {};

  if (wantSent) {
    writeCsvFile(sentFilePath, sentItems);
    result.sentFile = `files/${taskDirName}/${sentFilename}`;
    console.log(`[CSV Reports] Saved sent files CSV with ${sentItems.length} items: ${sentFilePath}`);
  }

  if (wantDeleted) {
    writeCsvFile(deletedFilePath, deletedItems);
    result.deletedFile = `files/${taskDirName}/${deletedFilename}`;
    console.log(`[CSV Reports] Saved deleted files CSV with ${deletedItems.length} items: ${deletedFilePath}`);
  }

  return result;
}

export function resolveFilePath(baseDir: string, relPath: string): string {
  if (baseDir.includes(':')) {
    return `${baseDir.replace(/\/+$/, '')}/${relPath.replace(/^\/+/, '')}`;
  }
  return path.resolve(baseDir, relPath);
}

export function getLocalFileStat(fullPath: string): { size: number; mtime: string } {
  try {
    if (!fullPath.includes(':') && fs.existsSync(fullPath)) {
      const s = fs.statSync(fullPath);
      return {
        size: s.size,
        mtime: formatMtime(s.mtime),
      };
    }
  } catch {}
  return { size: 0, mtime: formatMtime(new Date()) };
}
