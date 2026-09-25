export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  createdAt: string;
}

export interface TaskPair {
  id: string;
  source: string;
  destination: string;
}

export type ScheduleType = 'once' | 'daily' | 'weekly' | 'monthly' | 'interval';

export interface TaskSchedule {
  id: string;
  type: ScheduleType;
  time: string; // "HH:mm" e.g. "03:30". For type 'interval', this is the STEP (e.g. "03:30" = every 3h30m), applied on a fixed grid starting at midnight (00:00).
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat for weekly
  dayOfMonth?: number; // legacy single day (1-31)
  daysOfMonth?: number[]; // multiple days of month (1-31)
  date?: string; // "YYYY-MM-DD" for once
  enabled: boolean;
}

export type BackupEngine = 'rclone' | 'rsync';
export type BackupType = 'mirror' | 'copy' | 'move';
export type RsyncFlagsMode = 'avh' | 'rtv';

export type EmailLogAttachmentCondition =
  | 'never'
  | 'always'
  | 'success'
  | 'warning'
  | 'error'
  | 'error_warning';

export interface TaskNotifications {
  enabled?: boolean;
  trigger?: 'all' | 'error' | 'success';
  discord?: boolean;
  ntfy?: boolean;
  email?: boolean;
  emailAttachLogsOnError?: boolean;
  emailLogAttachment?: EmailLogAttachmentCondition;
  csvReportSent?: boolean;
  csvReportDeleted?: boolean;
}

export interface Task {
  id: string;
  taskNumber?: number; // Unique human-friendly sequential number, e.g. 1, 2, 3...
  name: string;
  description: string;
  tags: string[];
  engine: BackupEngine;
  type: BackupType;
  rsyncFlagsMode?: RsyncFlagsMode; // 'avh' (domyślne, tryb archiwalny z uprawnieniami) lub 'rtv' (rekurencja i czasy bez wymuszania uprawnień)
  pairs: TaskPair[];
  customFlags: string;
  scheduleEnabled: boolean;
  schedules: TaskSchedule[];
  runAfterTaskId?: string | null;
  excludeFilters: string[];
  restoreEnabled: boolean;
  logRetentionDays?: number | null; // null = use global
  trashEnabled: boolean;
  trashRetentionDays: number;
  oneDriveLongPathsHandling?: boolean; // toggle for OneDrive 400-char path handling
  notifications: TaskNotifications;
  createdAt: string;
  updatedAt: string;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stopping' | 'stopped';

export interface JobExecution {
  id: string;
  taskId: string;
  taskNumber?: number;
  taskName: string;
  mode: 'backup' | 'restore';
  restoredPairIds?: string[];
  status: JobStatus;
  startTime: string;
  endTime?: string;
  durationSeconds?: number;
  filesTransferred: number;
  filesTotal: number;
  bytesTransferred: number;
  bytesTotal: number;
  checksChecked?: number;
  checksTotal?: number;
  speed: string;
  eta: string;
  percentage: number;
  logFile?: string;
  queueDelayRemainingSeconds?: number; // Set only while a queued job is waiting out the inter-job breather (settings.queueStartDelaySeconds) before it can start; undefined/0 once the delay has elapsed or does not apply.
  csvFiles?: {
    sent?: string;
    deleted?: string;
    sentFile?: string;
    deletedFile?: string;
  };
  error?: string;
  warning?: string;
  oneDriveLongPaths?: string[];
  triggeredBy: string;
  commandPreviews: string[];
}

export interface TaskCsvFile {
  filename: string;
  filePath: string;
  type: 'sent' | 'deleted';
  size: number;
  createdAt: string;
}

export interface NotificationSettings {
  discordWebhookUrl: string;
  discordTitleTemplate?: string;
  discordBodyTemplate?: string;
  ntfyUrl: string;
  ntfyTitleTemplate?: string;
  ntfyMessageTemplate?: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  notifyEmailTo: string;
  emailSubjectTemplate?: string;
  emailBodyTemplate?: string;
  emailAttachLogsOnError?: boolean;
  emailLogAttachment?: EmailLogAttachmentCondition;
  defaultTrigger: 'all' | 'error' | 'success';
}

export type AutoLogoutTimeout = '30m' | '1h' | '3h' | 'unlimited';

export interface GlobalSettings {
  maxConcurrentJobs: number;
  queueStartDelaySeconds?: number; // Odstęp (w sekundach) przed startem kolejnego zadania z kolejki po zakończeniu poprzedniego (kolejkowanie/chaining, ręczne uruchomienie, harmonogram). 0 = wyłączone. Domyślnie: 5
  jobMonitorLimit: number; // 10 | 25 | 50
  historyLimit: number; // 100 | 250 | 500 | 1000 | 2000
  defaultLogRetentionDays: number;
  defaultTrashRetentionDays: number;
  csvReportRetentionDays?: number; // Retention limit in days for CSV report files in data/files (0 = unlimited, default matches history/logs retention)
  csvHeaderLanguage?: 'en' | 'pl'; // 'en' (default) | 'pl'
  dbBackupRetentionDays?: number; // Czas przechowywania automatycznych kopii bazy danych syncvault-db.json w data/backupdb/ w dniach (domyślnie 14)
  dbBackupMinCopies?: number; // Minimalna liczba zachowywanych kopii bazy danych w data/backupdb/ (domyślnie 14, nigdy nie usuwa poniżej tej liczby)
  auditLogRetentionDays?: number; // 0 = unlimited, e.g. 7, 14, 30, 90, 180, 365
  auditLogMaxEntries?: number; // hard cap on stored audit log entries; 100 | 250 | 500 | 1000 | 2000 | 5000
  autoLogoutTimeout?: AutoLogoutTimeout; // '30m' | '1h' | '3h' | 'unlimited' (default: '30m')
  unlimitedDays?: number; // default: 7 (range: 1 - 28 days)
  notifications: NotificationSettings;
  theme: 'system' | 'light' | 'dark';
  language: 'pl' | 'en';
}

export interface FsItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  mtime?: string;
}

export interface DbBackupFile {
  filename: string;
  size: number;
  createdAt: string;
  filePath: string;
}

export interface FsBrowseResult {
  currentPath: string;
  parentPath: string | null;
  items: FsItem[];
  quickPaths: string[];
  error?: string;
  warning?: string | null;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  details: string;
  ip?: string;
}

export interface SystemStatus {
  isSetupComplete: boolean;
  currentUser: User | null;
  rcloneAvailable: boolean;
  rsyncAvailable: boolean;
  rcloneVersion?: string;
  rsyncVersion?: string;
  activeJobsCount: number;
  queuedJobsCount: number;
  dataDir: string;
  logsDir: string;
  rcloneConfigExists: boolean;
  autoLogoutTimeout?: AutoLogoutTimeout;
  unlimitedDays?: number;
}

export const DEFAULT_NOTIFICATION_TITLE_PL = '[SyncVault] Zadanie: {name} - {status}';
export const DEFAULT_NOTIFICATION_TITLE_EN = '[SyncVault] Task: {name} - {status}';

export const DEFAULT_NOTIFICATION_BODY_PL = `Nazwa: {name}
Tryb: {mode}
Status: {status}
Pliki: {files}
Dane przesĹ‚ane: {data}
Data uruchomienia: {date}
Czas trwania: {time}`;

export const DEFAULT_NOTIFICATION_BODY_EN = `Task: {name}
Mode: {mode}
Status: {status}
Files: {files}
Transferred: {data}
Start date: {date}
Duration: {time}`;
