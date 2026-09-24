import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { JobExecution, Task, GlobalSettings } from '../src/types.js';
import { getSettings, getLogsDir } from './db.js';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// job.logFile (see executor.ts) is stored as a path RELATIVE to getLogsDir(),
// not an absolute/cwd-relative path - it must be re-joined with getLogsDir()
// before touching the filesystem. Every caller in this file should go through
// this helper rather than using job.logFile directly.
function resolveLogFilePath(logFile?: string): string | undefined {
  if (!logFile) return undefined;
  return path.join(getLogsDir(), logFile);
}

// Matches rclone's own log level tag (" ERROR : ", " WARNING : ") as well as our
// own app-level tags appended elsewhere in this file ([ERROR], [WARN - ...]).
// Deliberately word-bounded so it doesn't match filenames/paths that merely
// happen to contain "error" or "warn" as a substring.
const ERROR_OR_WARNING_LINE = /\b(ERROR|WARN(?:ING)?)\b/i;

function readLogSnippet(logFile?: string, maxLines = 40): string {
  const logFilePath = resolveLogFilePath(logFile);
  if (!logFilePath || !fs.existsSync(logFilePath)) return '(Brak pliku dziennika zdarzeń)';
  try {
    const content = fs.readFileSync(logFilePath, 'utf-8');
    // The {logs} placeholder in notification messages should only surface the
    // lines that actually need attention (errors/warnings) - the full raw log
    // (including routine INFO/NOTICE lines) is still available in its entirety
    // as the email attachment, unaffected by this filter.
    const relevantLines = content.split('\n').filter(line => ERROR_OR_WARNING_LINE.test(line));
    if (relevantLines.length === 0) {
      return '(Brak błędów lub ostrzeżeń w logu)';
    }
    if (relevantLines.length <= maxLines) return relevantLines.join('\n').trim();
    return `[...pominięto wcześniejsze wpisy...]\n` + relevantLines.slice(-maxLines).join('\n').trim();
  } catch (err) {
    return '(Błąd odczytu logów)';
  }
}

function renderPlaceholders(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const re = new RegExp(`\\{${key}\\}`, 'gi');
    result = result.replace(re, value);
  }
  return result;
}

// Detects whether a message was deliberately hand-formatted into aligned columns
// (multiple consecutive spaces, or tabs) - e.g. "Tryb:    {mode}". Plain chat/push
// renderers (Discord, ntfy, most email clients) use a proportional font and also
// collapse runs of whitespace, so column alignment like this only survives when
// rendered in a monospace/code context. We only opt into that context when we
// detect this pattern, so plain single-space templates keep their normal look.
function needsMonospaceRendering(text: string): boolean {
  return /[ ]{2,}|\t/.test(text);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function removePolishDiacritics(str: string): string {
  const map: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
  };
  return str.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, match => map[match] || match);
}

export function sanitizeNtfyHeader(headerVal: string): string {
  // Convert Polish letters to Latin ASCII (np. ó -> o, ł -> l, etc.)
  // and strip any non-printable or non-ASCII characters to comply with HTTP headers RFC
  const dePolished = removePolishDiacritics(headerVal);
  const asciiClean = dePolished
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
  return asciiClean.trim() || 'SyncVault Notification';
}

export async function sendJobNotifications(job: JobExecution, task: Task): Promise<void> {
  const settings: GlobalSettings = getSettings();
  const taskNotif = task.notifications || {};

  // Check if notifications are enabled
  const isEnabled = taskNotif.enabled ?? true;
  if (!isEnabled) return;

  const trigger = taskNotif.trigger || settings.notifications.defaultTrigger || 'all';
  const isError = job.status === 'failed' || job.status === 'stopped' || !!job.error;
  const isWarning = !!job.warning || (job.oneDriveLongPaths && job.oneDriveLongPaths.length > 0) || false;
  const isSuccess = job.status === 'completed' && !job.error;

  if (trigger === 'error' && !isError) return;
  if (trigger === 'success' && (!isSuccess || isError)) return;

  const discordUrl = settings.notifications.discordWebhookUrl;
  const ntfyUrl = settings.notifications.ntfyUrl;
  const smtpHost = settings.notifications.smtpHost;

  const isDiscordRequested = taskNotif.discord ?? !!discordUrl;
  const isNtfyRequested = taskNotif.ntfy ?? !!ntfyUrl;
  const isEmailRequested = taskNotif.email ?? !!smtpHost;

  const logSnippet = readLogSnippet(job.logFile);

  const checksCount = job.checksChecked || job.checksTotal || 0;
  const lang = settings.language || 'pl';
  const checksLabel = lang === 'pl' ? 'sprawdzonych' : 'checked';
  const checksText = checksCount > 0 ? `${checksCount} ${checksLabel}` : (lang === 'pl' ? '0 sprawdzonych' : '0 checked');
  const filesFormatted = checksCount > 0
    ? `${job.filesTransferred} / ${job.filesTotal} (${checksCount} ${checksLabel})`
    : `${job.filesTransferred} / ${job.filesTotal}`;

  // Template variables mapping requested by user:
  // Nazwa | Tryb | Status | Pliki | Dane przesłane | Data uruchomienia | Czas | Logi | Sprawdzone
  const vars: Record<string, string> = {
    name: task.name,
    task: task.name,
    mode: job.mode.toUpperCase(),
    status: job.status.toUpperCase(),
    files: filesFormatted,
    filesOnly: `${job.filesTransferred} / ${job.filesTotal}`,
    checks: checksText,
    checksCount: checksCount.toString(),
    checked: checksText,
    data: `${formatBytes(job.bytesTransferred)} / ${formatBytes(job.bytesTotal)}`,
    bytes: formatBytes(job.bytesTransferred),
    transferred: `${formatBytes(job.bytesTransferred)} / ${formatBytes(job.bytesTotal)}`,
    date: new Date(job.startTime).toLocaleString(),
    startTime: new Date(job.startTime).toLocaleString(),
    time: job.durationSeconds ? `${job.durationSeconds}s` : 'N/A',
    duration: job.durationSeconds ? `${job.durationSeconds}s` : 'N/A',
    logs: logSnippet,
    error: job.error || 'Brak',
    warning: job.warning || 'Brak',
    engine: task.engine.toUpperCase(),
    triggeredBy: job.triggeredBy || 'system',
  };

  const defaultTitle = `[SyncVault] Zadanie: ${task.name} - ${job.status.toUpperCase()}`;

  const defaultBody = [
    `Nazwa: ${task.name}`,
    `Tryb: ${job.mode.toUpperCase()}`,
    `Status: ${job.status.toUpperCase()}`,
    `Pliki: ${filesFormatted}`,
    `Dane przesłane: ${formatBytes(job.bytesTransferred)} / ${formatBytes(job.bytesTotal)}`,
    `Data uruchomienia: ${new Date(job.startTime).toLocaleString()}`,
    `Czas: ${job.durationSeconds ? `${job.durationSeconds}s` : 'N/A'}`,
    job.warning ? `Ostrzeżenie: ${job.warning}` : '',
    job.error ? `Błąd: ${job.error}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Per-task title/body templates were removed from the UI - only the global,
  // admin-configured templates (Settings) can override the generated default
  // title/body now. This also avoids sending the same information twice (once
  // as free-form text, once as a structured breakdown), which the fixed Discord
  // "fields" block used to do regardless of any custom template.
  const baseTitle = settings.notifications.discordTitleTemplate
    ? renderPlaceholders(settings.notifications.discordTitleTemplate, vars)
    : defaultTitle;

  // 1. Discord Webhook
  if (isDiscordRequested && discordUrl) {
    try {
      const rawDiscordTitle = settings.notifications.discordTitleTemplate
        ? renderPlaceholders(settings.notifications.discordTitleTemplate, vars)
        : defaultTitle;
      const discordTitle = removePolishDiacritics(rawDiscordTitle);

      const discordContent = settings.notifications.discordBodyTemplate
        ? renderPlaceholders(settings.notifications.discordBodyTemplate, vars)
        : defaultBody;

      // Discord (like most rich-text renderers) uses a proportional font and
      // collapses runs of whitespace in normal text, so hand-aligned columns
      // (e.g. "Tryb:    {mode}") only render correctly inside a code block,
      // which uses a monospace font and preserves whitespace exactly.
      const discordDescription = needsMonospaceRendering(discordContent)
        ? '```\n' + discordContent + '\n```'
        : discordContent;

      const color = isSuccess ? 0x10b981 : isError ? 0xef4444 : 0x3b82f6;
      // NOTE: the embed only carries the description text above - it used to ALSO
      // append a fixed "fields" block repeating Nazwa/Tryb/Status/Pliki/Dane
      // przesłane/Czas, which duplicated whatever the description already said
      // (including a custom template). Only one representation of the data is
      // sent now to avoid that duplication.
      const payload = {
        username: 'SyncVault',
        avatar_url: 'https://raw.githubusercontent.com/rclone/rclone/master/graphics/logo/rclone-logo-256x256.png',
        embeds: [
          {
            title: discordTitle,
            description: discordDescription,
            color,
            footer: { text: 'SyncVault Docker Backup Engine' },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await fetch(discordUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log(`[Notification] Discord notification sent for job ${job.id}`);
    } catch (err) {
      console.error('[Notification] Failed to send Discord webhook:', err);
    }
  }

  // 2. ntfy Notification
  if (isNtfyRequested && ntfyUrl) {
    try {
      const rawNtfyTitle = settings.notifications.ntfyTitleTemplate
        ? renderPlaceholders(settings.notifications.ntfyTitleTemplate, vars)
        : baseTitle;

      // Ensure ntfy Title header does not fail on Polish diacritics (e.g. ó -> o, ą -> a)
      const sanitizedTitle = sanitizeNtfyHeader(rawNtfyTitle);

      const ntfyMessage = settings.notifications.ntfyMessageTemplate
        ? renderPlaceholders(settings.notifications.ntfyMessageTemplate, vars)
        : defaultBody;

      const tag = isSuccess ? 'white_check_mark' : isError ? 'rotating_light' : 'information_source';
      const priority = isError ? 4 : 3;

      // Same reasoning as Discord: ntfy also renders plain text with a
      // proportional font by default and collapses whitespace, so hand-aligned
      // columns need the ntfy Markdown mode + a fenced code block to render
      // (and keep the whitespace) correctly. Only opt into Markdown mode when
      // alignment is actually being attempted, so plain default messages are
      // unaffected on ntfy clients that may not support Markdown rendering.
      const ntfyUsesMonospace = needsMonospaceRendering(ntfyMessage);
      const ntfyBody = ntfyUsesMonospace ? '```\n' + ntfyMessage + '\n```' : ntfyMessage;

      await fetch(ntfyUrl, {
        method: 'POST',
        headers: {
          Title: sanitizedTitle,
          Priority: priority.toString(),
          Tags: tag,
          'Content-Type': 'text/plain; charset=utf-8',
          ...(ntfyUsesMonospace ? { Markdown: 'yes' } : {}),
        },
        body: ntfyBody,
      });
      console.log(`[Notification] ntfy notification sent for job ${job.id}`);
    } catch (err) {
      console.error('[Notification] Failed to send ntfy notification:', err);
    }
  }

  // 3. Email Notification (SMTP / Mail Dispatcher)
  if (isEmailRequested && (settings.notifications.notifyEmailTo || smtpHost)) {
    try {
      const rawEmailSubject = settings.notifications.emailSubjectTemplate
        ? renderPlaceholders(settings.notifications.emailSubjectTemplate, vars)
        : defaultTitle;
      const emailSubject = removePolishDiacritics(rawEmailSubject);

      const emailText = settings.notifications.emailBodyTemplate
        ? renderPlaceholders(settings.notifications.emailBodyTemplate, vars)
        : defaultBody + (isError ? `\n\n--- OSTATNIE LOGI ---\n${logSnippet}` : '');

      // Plain-text emails (nodemailer's `text` field) keep every space exactly as
      // typed, but most mail clients still render plain text with a proportional
      // font, so hand-aligned columns (e.g. "Tryb:              {mode}") won't line
      // up visually even though the spaces are all there. Sending an HTML
      // alternative wrapped in <pre> with a monospace font fixes this for any
      // client that renders HTML, while the `text` field remains as a fallback
      // for clients that only show plain text.
      const emailHtml = `<pre style="font-family: 'Courier New', Consolas, Menlo, monospace; white-space: pre-wrap; font-size: 13px; margin: 0;">${escapeHtml(emailText)}</pre>`;

      // Log attachment condition: 'always' | 'success' | 'warning' | 'error' | 'error_warning' | 'never'
      const logCondition =
        taskNotif.emailLogAttachment ||
        settings.notifications.emailLogAttachment ||
        (taskNotif.emailAttachLogsOnError ?? settings.notifications.emailAttachLogsOnError ?? true ? 'error' : 'never');

      let shouldAttachLogs = false;
      switch (logCondition) {
        case 'always':
          shouldAttachLogs = true;
          break;
        case 'success':
          shouldAttachLogs = isSuccess && !isWarning;
          break;
        case 'warning':
          shouldAttachLogs = isWarning;
          break;
        case 'error':
          shouldAttachLogs = isError;
          break;
        case 'error_warning':
          shouldAttachLogs = isError || isWarning;
          break;
        case 'never':
        default:
          shouldAttachLogs = false;
          break;
      }

      const attachments: Array<{ filename: string; content?: string; path?: string }> = [];

      // Bonus fix: job.logFile is relative to getLogsDir() (see resolveLogFilePath
      // above) - using it directly here (as the code did before) meant this
      // existsSync check almost always failed, so the "Wysyłanie pliku logów w
      // załączniku" setting silently never actually attached anything, and
      // nodemailer's `path` would have pointed at a nonexistent file even on the
      // rare case it got this far.
      const resolvedLogPath = resolveLogFilePath(job.logFile);

      if (shouldAttachLogs && resolvedLogPath && fs.existsSync(resolvedLogPath)) {
        const statusTag = isError ? 'error' : isWarning ? 'warning' : 'success';
        const cleanName = task.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        attachments.push({
          filename: `${cleanName}_#${task.taskNumber || 1}_${job.id.slice(0, 8)}_${statusTag}.log`,
          path: resolvedLogPath,
        });
      }

      if (job.oneDriveLongPaths && job.oneDriveLongPaths.length > 0) {
        attachments.push({
          filename: `onedrive_skipped_paths_${job.id.slice(0, 8)}.txt`,
          content: job.oneDriveLongPaths.join('\n'),
        });
      }

      if (smtpHost && settings.notifications.notifyEmailTo) {
        const transportConfig: any = {
          host: smtpHost,
          port: settings.notifications.smtpPort || 587,
          secure: (settings.notifications.smtpPort || 587) === 465,
        };

        if (settings.notifications.smtpUser && settings.notifications.smtpPass) {
          transportConfig.auth = {
            user: settings.notifications.smtpUser,
            pass: settings.notifications.smtpPass,
          };
        }

        const transporter = nodemailer.createTransport(transportConfig);

        await transporter.sendMail({
          from: settings.notifications.smtpFrom || 'syncvault@localhost',
          to: settings.notifications.notifyEmailTo,
          // Bonus fix found while cleaning up templates: this used to send the raw
          // `customEmailSubject` variable, which no longer exists (and previously
          // could be an un-rendered template string, or undefined entirely if no
          // custom subject was ever configured, sending the email with no subject).
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
          attachments,
        });
        console.log(`[Notification] Email dispatched successfully to ${settings.notifications.notifyEmailTo}`);
      } else {
        console.log(`[Notification] Simulated email dispatched to ${settings.notifications.notifyEmailTo || 'configured recipient'}`);
      }
    } catch (err) {
      console.error('[Notification] Failed to dispatch email:', err);
    }
  }
}

export async function sendTestNotification(
  type: 'discord' | 'ntfy' | 'email',
  customTarget?: string
): Promise<{ success: boolean; message: string }> {
  const settings = getSettings();

  if (type === 'discord') {
    const url = customTarget || settings.notifications.discordWebhookUrl;
    if (!url) throw new Error('Brak skonfigurowanego Discord Webhook URL');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '🔔 **SyncVault Test Notification**: Połączenie z webhookiem Discord działa prawidłowo!',
      }),
    });
    if (!res.ok) throw new Error(`Discord zwrócił kod błędu: ${res.status}`);
    return { success: true, message: 'Powiadomienie Discord wysłane pomyślnie!' };
  }

  if (type === 'ntfy') {
    const url = customTarget || settings.notifications.ntfyUrl;
    if (!url) throw new Error('Brak skonfigurowanego ntfy URL');
    const testVars = {
      name: 'Test Zadania',
      task: 'Test Zadania',
      mode: 'TEST',
      status: 'SUKCES',
      files: '1 / 1 (10 sprawdzonych)',
      filesOnly: '1 / 1',
      checks: '10 sprawdzonych',
      checksCount: '10',
      checked: '10 sprawdzonych',
      data: '10 MB',
      bytes: '10 MB',
      date: new Date().toLocaleString(),
      time: '1s',
      duration: '1s',
    };
    const rawTitle = settings.notifications.ntfyTitleTemplate
      ? renderPlaceholders(settings.notifications.ntfyTitleTemplate, testVars)
      : 'SyncVault - Test Powiadomienia';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Title: sanitizeNtfyHeader(rawTitle),
        Tags: 'white_check_mark,bell',
      },
      body: '🔔 Połączenie z usługą ntfy działa prawidłowo!',
    });
    if (!res.ok) throw new Error(`ntfy zwrócił błąd: ${res.status}`);
    return { success: true, message: 'Powiadomienie ntfy wysłane pomyślnie!' };
  }

  if (type === 'email') {
    const smtp = settings.notifications;
    if (!smtp.smtpHost && !customTarget) {
      return {
        success: true,
        message: 'Tryb symulacji: Skonfiguruj serwer SMTP, użytkownika i hasło, aby wysyłać prawdziwe e-maile.',
      };
    }

    try {
      const transportConfig: any = {
        host: customTarget || smtp.smtpHost,
        port: smtp.smtpPort || 587,
        secure: (smtp.smtpPort || 587) === 465,
      };

      if (smtp.smtpUser && smtp.smtpPass) {
        transportConfig.auth = {
          user: smtp.smtpUser,
          pass: smtp.smtpPass,
        };
      }

      const transporter = nodemailer.createTransport(transportConfig);

      if (smtp.notifyEmailTo) {
        await transporter.sendMail({
          from: smtp.smtpFrom || 'syncvault@localhost',
          to: smtp.notifyEmailTo,
          subject: removePolishDiacritics('[SyncVault Test] Wiadomość testowa SMTP'),
          text: 'To jest testowa wiadomość wysłana z aplikacji SyncVault potwierdzająca poprawność konfiguracji SMTP.',
        });
        return { success: true, message: `Wiadomość testowa została wysłana na adres: ${smtp.notifyEmailTo}!` };
      } else {
        await transporter.verify();
        return { success: true, message: 'Połączenie z serwerem SMTP zostało pomyślnie zweryfikowane!' };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Błąd połączenia SMTP: ${err.message}`,
      };
    }
  }

  throw new Error('Nieznany typ powiadomienia');
}

