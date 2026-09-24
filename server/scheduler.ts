import { getTasks } from './db.js';
import { enqueueTask, isTaskRunningOrQueued } from './executor.js';
import { TaskSchedule } from '../src/types.js';
import { cleanupSystemLogs } from './systemLogger.js';

let schedulerInterval: NodeJS.Timeout | null = null;
const lastTriggeredMinute = new Map<string, string>(); // scheduleId -> "YYYY-MM-DD-HH:mm"
let lastHourlyCleanupHour = '';

export function startScheduler(): void {
  if (schedulerInterval) return;

  console.log('[Scheduler] Background job scheduler initialized.');

  // Run initial retention cleanup for system logs
  try {
    cleanupSystemLogs();
  } catch (e) {
    console.error('[Scheduler] Initial system logs cleanup error:', e);
  }

  // Check every 30 seconds
  schedulerInterval = setInterval(() => {
    checkSchedules();
  }, 30 * 1000);

  // Initial check
  checkSchedules();
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

function checkSchedules(): void {
  const now = new Date();
  const currentHour = String(now.getHours()).padStart(2, '0');
  const currentMinute = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHour}:${currentMinute}`;
  const currentDayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const currentDayOfMonth = now.getDate();
  const currentDate = now.toISOString().split('T')[0];
  const minuteKey = `${currentDate}-${currentTime}`;
  const hourKey = `${currentDate}-${currentHour}`;

  // Periodic hourly check for daily system logs cleanup
  if (lastHourlyCleanupHour !== hourKey) {
    lastHourlyCleanupHour = hourKey;
    try {
      cleanupSystemLogs();
    } catch {
      // ignore
    }
  }

  const tasks = getTasks();

  for (const task of tasks) {
    if (!task.scheduleEnabled || !task.schedules || task.schedules.length === 0) {
      continue;
    }

    for (const schedule of task.schedules) {
      if (!schedule.enabled) continue;

      const scheduleKey = `${task.id}-${schedule.id}`;
      if (lastTriggeredMinute.get(scheduleKey) === minuteKey) {
        continue; // Already ran this minute
      }

      const shouldTrigger = evaluateSchedule(schedule, currentTime, currentDayOfWeek, currentDayOfMonth, currentDate);

      if (shouldTrigger) {
        lastTriggeredMinute.set(scheduleKey, minuteKey);

        // If one-time, disable after triggering
        if (schedule.type === 'once') {
          schedule.enabled = false;
        }

        if (isTaskRunningOrQueued(task.id)) {
          console.warn(`[Scheduler] Task "${task.name}" is already running or queued. Skipping scheduled trigger.`);
          continue;
        }

        try {
          console.log(`[Scheduler] Triggering task "${task.name}" from schedule (${schedule.type} at ${schedule.time})`);
          enqueueTask(task, 'backup', undefined, `harmonogram:${schedule.type}`);
        } catch (e: any) {
          console.error(`[Scheduler] Failed to trigger task "${task.name}":`, e.message);
        }
      }
    }
  }
}

function evaluateSchedule(
  schedule: TaskSchedule,
  currentTime: string,
  currentDayOfWeek: number,
  currentDayOfMonth: number,
  currentDate: string
): boolean {
  // 'interval' does not match a single fixed time - it matches every N minutes
  // on a fixed grid starting at midnight (00:00), so it is evaluated separately.
  if (schedule.type === 'interval') {
    return evaluateIntervalSchedule(schedule, currentTime);
  }

  if (schedule.time !== currentTime) {
    return false;
  }

  switch (schedule.type) {
    case 'once':
      return !schedule.date || schedule.date === currentDate;

    case 'daily':
      return true;

    case 'weekly':
      if (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0) return true;
      return schedule.daysOfWeek.includes(currentDayOfWeek);

    case 'monthly':
      if (schedule.daysOfMonth && schedule.daysOfMonth.length > 0) {
        return schedule.daysOfMonth.includes(currentDayOfMonth);
      }
      if (schedule.dayOfMonth !== undefined) {
        return schedule.dayOfMonth === currentDayOfMonth;
      }
      return true;

    default:
      return false;
  }
}

// Evaluates an 'interval' schedule: schedule.time (hh:mm) is treated as the STEP,
// e.g. "03:30" = every 3h30min, on a fixed grid starting at midnight (00:00).
// For 03:30 the grid is: 00:00, 03:30, 07:00, 10:30, 14:00, 17:30, 21:00 - the last
// segment before midnight may be shorter than the configured step, and the grid
// resets to 00:00 every day rather than carrying over.
function evaluateIntervalSchedule(schedule: TaskSchedule, currentTime: string): boolean {
  const stepMinutes = parseHHMMToMinutes(schedule.time);
  if (!stepMinutes || stepMinutes <= 0) return false;

  const nowMinutes = parseHHMMToMinutes(currentTime);
  if (nowMinutes === null) return false;

  return nowMinutes % stepMinutes === 0;
}

function parseHHMMToMinutes(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}
