import React, { useState } from 'react';
import {
  Activity,
  Square,
  FileText,
  Clock,
  HardDrive,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  StopCircle,
} from 'lucide-react';
import { JobExecution } from '../types.ts';
import { Language, translations } from '../i18n.ts';
import { api } from '../api.ts';

interface JobMonitorViewProps {
  lang: Language;
  jobs: JobExecution[];
  onStopJob: (jobId: string) => void;
  onViewLogs: (job: JobExecution) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const JobMonitorView: React.FC<JobMonitorViewProps> = ({
  lang,
  jobs,
  onStopJob,
  onViewLogs,
}) => {
  const t = translations[lang];
  const [stoppingJobId, setStoppingJobId] = useState<string | null>(null);
  const [jobToStop, setJobToStop] = useState<{ id: string; name: string } | null>(null);

  const activeOrQueuedJobs = jobs.filter(j => j.status === 'running' || j.status === 'queued' || j.status === 'stopping');
  const recentCompletedJobs = jobs.filter(j => j.status !== 'running' && j.status !== 'queued' && j.status !== 'stopping');

  const handleConfirmStop = (jobId: string) => {
    setStoppingJobId(jobId);
    onStopJob(jobId);
    setJobToStop(null);
    setTimeout(() => setStoppingJobId(null), 2000);
  };

  const getStatusBadge = (status: string, job?: JobExecution) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
            <Loader2 className="w-3 h-3 animate-spin" />
            {t.status.running}
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
            <Clock className="w-3 h-3" />
            {t.status.queued}
            {!!job?.queueDelayRemainingSeconds && (
              <span className="font-mono font-bold tabular-nums">
                · {lang === 'pl' ? 'start za' : 'starts in'} {job.queueDelayRemainingSeconds}s
              </span>
            )}
          </span>
        );
      case 'stopping':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
            <StopCircle className="w-3 h-3 animate-pulse" />
            {t.status.stopping}
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
            <CheckCircle2 className="w-3 h-3" />
            {t.status.completed}
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
            <XCircle className="w-3 h-3" />
            {t.status.failed}
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
            <Square className="w-3 h-3" />
            {t.status.stopped}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>{t.jobMonitor.title}</span>
            {activeOrQueuedJobs.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-600 text-white">
                {activeOrQueuedJobs.length} {lang === 'pl' ? 'aktywne' : 'active'}
              </span>
            )}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t.jobMonitor.subtitle}
          </p>
        </div>
      </div>

      {/* SECTION 1: Active / Queued Live Jobs */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
          {lang === 'pl' ? 'Aktualnie przetwarzane i w kolejce' : 'Currently running and queued'} ({activeOrQueuedJobs.length})
        </h3>

        {activeOrQueuedJobs.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-white/40 dark:bg-neutral-900/40">
            <div className="inline-flex p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 mb-2">
              <Activity className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
              {t.jobMonitor.noActiveJobs}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeOrQueuedJobs.map(job => (
              <div
                key={job.id}
                className="p-5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-neutral-900 shadow-md shadow-blue-500/5 space-y-4"
              >
                {/* Job Title Bar */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                        #{job.taskNumber ?? job.taskId.slice(0, 6)}
                      </span>
                      <h4 className="text-base font-bold text-neutral-900 dark:text-white">
                        {job.taskName}
                      </h4>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                          job.mode === 'restore'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                            : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                        }`}
                      >
                        {job.mode}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 font-mono mt-1">
                      Job ID: {job.id.slice(0, 8)} • Start: {new Date(job.startTime).toLocaleTimeString()} • {lang === 'pl' ? 'Uruchomił' : 'Triggered by'}: {job.triggeredBy}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(job.status, job)}

                    <button
                      onClick={() => setJobToStop({ id: job.id, name: job.taskName })}
                      disabled={stoppingJobId === job.id || job.status === 'stopping'}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors disabled:opacity-50"
                      title={t.jobMonitor.stopJob}
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>{lang === 'pl' ? 'Zatrzymaj' : 'Stop'}</span>
                    </button>

                    <button
                      onClick={() => onViewLogs(job)}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      title={t.common.viewLogs}
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar & percentage */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {lang === 'pl' ? 'Postęp zadania' : 'Job progress'}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">
                      {job.percentage}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(3, job.percentage)}%` }}
                    />
                  </div>
                </div>

                {/* Real-time stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-100 dark:border-neutral-800 text-xs">
                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase font-semibold">
                      {t.jobMonitor.filesTransferred}
                    </span>
                    <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                      {job.filesTransferred} / {job.filesTotal}
                    </span>
                    {(job.checksTotal || 0) > 0 && (
                      <span className="block text-[10px] text-neutral-500 dark:text-neutral-400 font-normal font-sans">
                        ({(job.checksChecked ?? job.checksTotal ?? 0).toLocaleString()} {lang === 'pl' ? 'sprawdzonych' : 'checked'})
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase font-semibold">
                      {t.jobMonitor.transferredSize}
                    </span>
                    <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                      {formatBytes(job.bytesTransferred)} / {formatBytes(job.bytesTotal)}
                    </span>
                  </div>

                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase font-semibold">
                      {t.jobMonitor.speed}
                    </span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {job.speed || '0 B/s'}
                    </span>
                  </div>

                  <div>
                    <span className="text-neutral-400 block text-[10px] uppercase font-semibold">
                      {t.jobMonitor.eta}
                    </span>
                    <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                      {job.eta || '--:--'}
                    </span>
                  </div>
                </div>

                {/* Warning notice if OneDrive 400-char path was encountered */}
                {job.warning && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-700 dark:text-amber-300 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{job.warning}</span>
                    </div>
                    {job.oneDriveLongPaths && job.oneDriveLongPaths.length > 0 && (
                      <a
                        href={api.getOneDriveReportDownloadUrl(job.id)}
                        download
                        className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors shrink-0 flex items-center gap-1 shadow-sm"
                        title={lang === 'pl' ? 'Pobierz raport .txt ze spisem pominiętych plików' : 'Download text report with skipped files'}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{lang === 'pl' ? 'Pobierz raport .txt' : 'Download .txt'}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Recent Completed Jobs (Configured limit 10/25/50) */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
          {lang === 'pl' ? 'Ostatnio zakończone procesy' : 'Recently completed jobs'} ({recentCompletedJobs.length})
        </h3>

        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">{t.common.name}</th>
                <th className="py-3 px-4">{t.common.status}</th>
                <th className="py-3 px-4">{t.jobMonitor.filesTransferred}</th>
                <th className="py-3 px-4">{t.jobMonitor.transferredSize}</th>
                <th className="py-3 px-4">{lang === 'pl' ? 'Start / Koniec' : 'Start / End'}</th>
                <th className="py-3 px-4">{t.common.duration}</th>
                <th className="py-3 px-4 text-right">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-mono">
              {recentCompletedJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-neutral-400 font-sans">
                    {lang === 'pl' ? 'Brak historii ostatnich procesów.' : 'No recent job history.'}
                  </td>
                </tr>
              ) : (
                recentCompletedJobs.map(job => (
                  <tr key={job.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-sans font-bold text-neutral-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                          #{job.taskNumber ?? job.taskId.slice(0, 6)}
                        </span>
                        <span>{job.taskName}</span>
                        {job.mode === 'restore' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                            Restore
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-400 font-normal">
                        {lang === 'pl' ? 'przez' : 'by'} {job.triggeredBy}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(job.status, job)}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-700 dark:text-neutral-300">
                      <div>{job.filesTransferred} / {job.filesTotal}</div>
                      {(job.checksTotal || 0) > 0 && (
                        <div className="text-[10px] text-neutral-400 font-normal font-sans">
                          {((job.checksChecked ?? job.checksTotal) ?? 0).toLocaleString()} {lang === 'pl' ? 'sprawdzonych' : 'checked'}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-700 dark:text-neutral-300">
                      {formatBytes(job.bytesTransferred ?? 0)}
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-neutral-500">
                      <div>{new Date(job.startTime).toLocaleString()}</div>
                      {job.endTime && (
                        <div className="text-neutral-400">{new Date(job.endTime).toLocaleTimeString()}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-700 dark:text-neutral-300">
                      {job.durationSeconds ? `${job.durationSeconds}s` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => onViewLogs(job)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-sans font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{lang === 'pl' ? 'Logi' : 'Logs'}</span>
                        </button>

                        {job.oneDriveLongPaths && job.oneDriveLongPaths.length > 0 && (
                          <a
                            href={api.getOneDriveReportDownloadUrl(job.id)}
                            download
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-sans font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                            title={lang === 'pl' ? `Raport pominiętych plików (>400 zn.): ${job.oneDriveLongPaths.length}` : `OneDrive >400 report: ${job.oneDriveLongPaths.length}`}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>OD&gt;400 ({job.oneDriveLongPaths.length})</span>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stop Job Confirmation Modal */}
      {jobToStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50">
                <Square className="w-6 h-6 fill-current" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {lang === 'pl' ? 'Zatrzymać proces zadania?' : 'Stop Running Job?'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {lang === 'pl' ? 'Proces rsync/rclone zostanie przerwany (SIGTERM/SIGKILL).' : 'The sync process will be terminated.'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 text-xs">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                {lang === 'pl' ? 'Zadanie:' : 'Task:'}
              </span>{' '}
              <span className="font-mono font-bold text-neutral-900 dark:text-white">{jobToStop.name}</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setJobToStop(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmStop(jobToStop.id)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{lang === 'pl' ? 'Zatrzymaj zadanie' : 'Stop Job'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
