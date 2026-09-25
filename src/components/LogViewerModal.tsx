import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Download, FileText, AlertTriangle, Terminal, FileSpreadsheet } from 'lucide-react';
import { JobExecution } from '../types.ts';
import { api, getAuthToken } from '../api.ts';
import { Language } from '../i18n.ts';
import { copyToClipboard } from '../utils.ts';

interface LogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobExecution | null;
  lang: Language;
}

export const LogViewerModal: React.FC<LogViewerModalProps> = ({
  isOpen,
  onClose,
  job,
  lang,
}) => {
  const [logs, setLogs] = useState<string>(lang === 'pl' ? 'Ładowanie logów...' : 'Loading logs...');
  const [filePath, setFilePath] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (job && isOpen) {
      setLoading(true);
      setLogs(lang === 'pl' ? 'Ładowanie logów...' : 'Loading logs...');
      api
        .getJobLogs(job.id)
        .then(res => {
          setLogs(res.logs);
          setFilePath(res.filePath || job.logFile || '');
        })
        .catch(err => {
          setLogs(lang === 'pl' ? `Błąd ładowania pliku logu: ${err.message}` : `Error loading log file: ${err.message}`);
        })
        .finally(() => setLoading(false));
    }
  }, [job, isOpen, lang]);

  if (!isOpen || !job) return null;

  const handleCopy = async () => {
    await copyToClipboard(logs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = filePath ? filePath.split('/').pop() || 'job.log' : `${job.taskName}_${job.id}.log`;
    const token = getAuthToken();

    // Prefer native server download to prevent Chromium blob URL warnings over plain HTTP
    if (token && job.id) {
      const downloadUrl = `/api/jobs/${encodeURIComponent(job.id)}/download-log?token=${encodeURIComponent(token)}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const blob = new Blob([logs], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadOneDriveReport = () => {
    if (!job.oneDriveLongPaths || job.oneDriveLongPaths.length === 0) return;
    const token = getAuthToken();
    if (token && job.id) {
      const downloadUrl = api.getOneDriveReportDownloadUrl(job.id);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `onedrive_400char_skipped_${job.id}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const content =
      `================================================================================\n` +
      `SyncVault - Raport plików pominiętych z powodu limitu 400 znaków OneDrive\n` +
      `================================================================================\n` +
      `Zadanie: ${job.taskName}\n` +
      `Job ID: ${job.id}\n` +
      `Data wykonania: ${new Date(job.startTime).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-US')}\n` +
      `Liczba pominiętych plików: ${job.oneDriveLongPaths.length}\n\n` +
      `UWAGA: Microsoft OneDrive oraz SharePoint narzucają sztywny limit maksymalnie 400 znaków\n` +
      `dla pełnej ścieżki URL pliku i katalogu. W przypadku użycia szyfrowania rclone (crypt)\n` +
      `ścieżki są kodowane i ulegają wydłużeniu o ok. 1.6x, co powoduje odrzucenie pliku przez chmurę.\n\n` +
      `Lista pominiętych plików:\n` +
      `--------------------------------------------------------------------------------\n` +
      job.oneDriveLongPaths.map((p, i) => `${i + 1}. [Długość: ${p.length} zn.] ${p}`).join('\n') +
      `\n--------------------------------------------------------------------------------\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `onedrive_400char_skipped_${job.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = (type: 'sent' | 'deleted') => {
    if (!job) return;
    const url = api.getJobCsvDownloadUrl(job.id, type);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${job.taskName}_${type}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadBothCsv = () => {
    handleDownloadCsv('sent');
    setTimeout(() => {
      handleDownloadCsv('deleted');
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-neutral-950 rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden text-neutral-100 font-mono">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/90 font-sans">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{job.taskName}</h3>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                    job.mode === 'restore' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  {job.mode}
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono">
                {filePath || job.logFile || 'log'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors"
              title={lang === 'pl' ? 'Kopiuj do schowka' : 'Copy to clipboard'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? (lang === 'pl' ? 'Skopiowano' : 'Copied') : (lang === 'pl' ? 'Kopiuj' : 'Copy')}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors"
              title={lang === 'pl' ? 'Pobierz plik .log' : 'Download .log file'}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'pl' ? 'Pobierz' : 'Download'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* OneDrive 400-char path warning banner */}
        {job.oneDriveLongPaths && job.oneDriveLongPaths.length > 0 && (
          <div className="px-6 py-3 bg-amber-950/40 border-b border-amber-900/60 font-sans flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {lang === 'pl'
                  ? `Wykryto ${job.oneDriveLongPaths.length} ścieżek przekraczających limit 400 znaków OneDrive.`
                  : `Detected ${job.oneDriveLongPaths.length} paths exceeding Microsoft OneDrive 400-char limit.`}
              </span>
            </div>
            <button
              onClick={handleDownloadOneDriveReport}
              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors"
            >
              {lang === 'pl' ? 'Pobierz plik .txt z pominiętymi plikami' : 'Download .txt with skipped paths'}
            </button>
          </div>
        )}

        {/* CSV Reports Banner */}
        {(job.csvFiles?.sentFile || job.csvFiles?.deletedFile) && (
          <div className="px-6 py-2.5 bg-emerald-950/40 border-b border-emerald-900/60 font-sans flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {lang === 'pl'
                  ? 'Dostępne raporty CSV (ścieżka, waga, data modyfikacji, status):'
                  : 'Generated CSV reports available (path, weight, mtime, status):'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {job.csvFiles?.sentFile && (
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('sent')}
                  className="px-2.5 py-1 rounded bg-emerald-800/60 hover:bg-emerald-700/80 text-emerald-100 text-xs font-semibold flex items-center gap-1 transition-colors"
                  title={lang === 'pl' ? 'Pobierz CSV wysłanych plików' : 'Download sent files CSV'}
                >
                  <Download className="w-3 h-3" />
                  <span>{lang === 'pl' ? 'CSV: Wysłane' : 'CSV: Sent'}</span>
                </button>
              )}

              {job.csvFiles?.deletedFile && (
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('deleted')}
                  className="px-2.5 py-1 rounded bg-rose-800/60 hover:bg-rose-700/80 text-rose-100 text-xs font-semibold flex items-center gap-1 transition-colors"
                  title={lang === 'pl' ? 'Pobierz CSV usuniętych plików' : 'Download deleted files CSV'}
                >
                  <Download className="w-3 h-3" />
                  <span>{lang === 'pl' ? 'CSV: Usunięte' : 'CSV: Deleted'}</span>
                </button>
              )}

              {job.csvFiles?.sentFile && job.csvFiles?.deletedFile && (
                <button
                  type="button"
                  onClick={handleDownloadBothCsv}
                  className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-xs font-semibold flex items-center gap-1 transition-colors"
                  title={lang === 'pl' ? 'Pobierz oba pliki CSV' : 'Download both CSV files'}
                >
                  <Download className="w-3 h-3" />
                  <span>{lang === 'pl' ? 'Pobierz oba' : 'Download both'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Log content */}
        <div className="flex-1 p-6 overflow-y-auto font-mono text-xs leading-relaxed text-neutral-300 select-text whitespace-pre-wrap">
          {logs}
        </div>
      </div>
    </div>
  );
};
