import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Calendar,
  HardDrive,
  RefreshCw,
  FolderArchive,
  ArrowUpRight,
  Trash2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { Task } from '../types.ts';
import { Language } from '../i18n.ts';
import { api } from '../api.ts';

interface TaskFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  lang: Language;
}

interface CsvFileItem {
  filename: string;
  filePath: string;
  type: 'sent' | 'deleted' | 'other';
  size: number;
  createdAt: string;
}

interface RunGroup {
  runKey: string;
  displayDate: string;
  sentFile?: CsvFileItem;
  deletedFile?: CsvFileItem;
  otherFiles: CsvFileItem[];
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const TaskFilesModal: React.FC<TaskFilesModalProps> = ({
  isOpen,
  onClose,
  task,
  lang,
}) => {
  const [files, setFiles] = useState<CsvFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const RUNS_PER_PAGE = 5;
  const [page, setPage] = useState(0);

  const fetchFiles = () => {
    if (!task) return;
    setLoading(true);
    setError(null);
    api
      .getTaskFiles(task.id)
      .then(res => {
        setFiles(res);
      })
      .catch(err => {
        setError(err.message || (lang === 'pl' ? 'Błąd pobierania listy plików CSV' : 'Failed to fetch CSV files'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen && task) {
      setPage(0);
      fetchFiles();
    }
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  // Group files by execution run (prefix before _wyslane or _usuniete)
  const runGroups: RunGroup[] = [];
  const runMap = new Map<string, RunGroup>();

  for (const f of files) {
    // Expected pattern: yyyy-mm-dd_hh-mm-ss_jobId_sent.csv (or _deleted.csv, or legacy _wyslane.csv / _usuniete.csv).
    const runKey = f.filename.replace(/_(sent|deleted|wyslane|usuniete)\.csv$/i, '');

    if (!runMap.has(runKey)) {
      // Parse human readable date
      const datePart = f.filename.slice(0, 16).replace('_', ' ');
      const group: RunGroup = {
        runKey,
        displayDate: datePart || new Date(f.createdAt).toLocaleString(),
        otherFiles: [],
      };
      runMap.set(runKey, group);
      runGroups.push(group);
    }

    const grp = runMap.get(runKey)!;
    if (f.type === 'sent') {
      grp.sentFile = f;
    } else if (f.type === 'deleted') {
      grp.deletedFile = f;
    } else {
      grp.otherFiles.push(f);
    }
  }

  const totalPages = Math.max(1, Math.ceil(runGroups.length / RUNS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedGroups = runGroups.slice(safePage * RUNS_PER_PAGE, safePage * RUNS_PER_PAGE + RUNS_PER_PAGE);

  const handleDownloadSingle = (filename: string) => {
    const url = api.getTaskFileDownloadUrl(task.id, filename);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadBoth = (group: RunGroup) => {
    if (group.sentFile) {
      handleDownloadSingle(group.sentFile.filename);
    }
    if (group.deletedFile) {
      setTimeout(() => {
        if (group.deletedFile) {
          handleDownloadSingle(group.deletedFile.filename);
        }
      }, 350);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <span>{lang === 'pl' ? 'Pliki raportów CSV' : 'CSV Report Files'}</span>
                <span className="font-mono text-xs font-normal text-neutral-500">
                  [{task.name}]
                </span>
              </h2>
              <p className="text-xs text-neutral-500 font-mono mt-0.5">
                data/files/{task.taskNumber ? `${task.taskNumber}_${task.name.replace(/[^a-zA-Z0-9_-]/g, '_')}` : `${task.id.slice(0, 8)}_${task.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`}/
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchFiles}
              disabled={loading}
              className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title={lang === 'pl' ? 'Odśwież listę plików' : 'Refresh file list'}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {/* Informative CSV schema card */}
          <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs text-neutral-700 dark:text-neutral-300">
            <div className="flex items-center gap-2 mb-1 text-blue-900 dark:text-blue-200 font-semibold">
              <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{lang === 'pl' ? 'Format generowanych raportów CSV:' : 'Generated CSV reports format:'}</span>
            </div>
            <p className="text-[11px] font-mono text-neutral-800 dark:text-neutral-200 bg-white/70 dark:bg-neutral-800/70 px-2 py-1 rounded border border-blue-200/50 dark:border-blue-800/50 leading-relaxed">
              "Name (full path)";"Destination";"Size";"Modified (mtime)";"Status"
            </p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed mt-1.5">
              {lang === 'pl'
                ? 'Kolumny: Ścieżka pliku | Cel zadania (z pola Cel/Destination) | Rozmiar (w bajtach i sformatowany) | Data modyfikacji (mtime) | Status (OK = sukces, TMP = kosz, ERR = błąd).'
                : 'Columns: File path | Target destination | Size (bytes and formatted) | Modification date (mtime) | Status (OK = success, TMP = trash, ERR = error).'}
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs">
              {error}
            </div>
          )}

          {loading && files.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              <span>{lang === 'pl' ? 'Wczytywanie raportów CSV...' : 'Loading CSV reports...'}</span>
            </div>
          ) : runGroups.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
              <FolderArchive className="w-8 h-8 text-neutral-300 dark:text-neutral-700" />
              <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                {lang === 'pl' ? 'Brak wygenerowanych raportów CSV dla tego zadania' : 'No CSV reports generated for this task yet'}
              </p>
              <p className="max-w-md text-neutral-400 text-[11px]">
                {lang === 'pl'
                  ? 'Raporty CSV są automatycznie generowane przed uruchomieniem zadania (poprzez dry-run verbose/itemized), jeżeli w konfiguracji zadania zaznaczono opcję "Wysłane" lub "Usunięte".'
                  : 'CSV reports are automatically generated prior to task execution (via dry-run verbose/itemized) when "Sent" or "Deleted" are enabled in task settings.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-500 font-semibold uppercase tracking-wider px-1">
                <span>{lang === 'pl' ? 'Uruchomienie / Data' : 'Execution Run / Date'}</span>
                <span>{lang === 'pl' ? 'Dostępne raporty CSV (możliwość pobrania 1 lub obu)' : 'Available CSV Reports (Download 1 or both)'}</span>
              </div>

              {pagedGroups.map((grp, idx) => (
                <div
                  key={grp.runKey || idx}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-bold text-xs text-neutral-900 dark:text-white font-mono">
                        {grp.displayDate}
                      </span>
                    </div>

                    {grp.sentFile && grp.deletedFile && (
                      <button
                        type="button"
                        onClick={() => handleDownloadBoth(grp)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
                        title={lang === 'pl' ? 'Pobierz oba pliki: Wysłane oraz Usunięte' : 'Download both Sent and Deleted files'}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{lang === 'pl' ? 'Pobierz oba pliki' : 'Download both'}</span>
                      </button>
                    )}
                  </div>

                  {/* Sent and Deleted items */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Sent file */}
                    {grp.sentFile ? (
                      <div className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs">
                        <div className="min-w-0 mr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-emerald-800 dark:text-emerald-300">
                              {lang === 'pl' ? 'Pliki wysłane' : 'Transferred files'}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-mono">
                              ({formatBytes(grp.sentFile.size)})
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-500 truncate block font-mono">
                            {grp.sentFile.filename}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadSingle(grp.sentFile!.filename)}
                          className="px-2.5 py-1 rounded-md bg-white dark:bg-neutral-800 hover:bg-emerald-100 dark:hover:bg-neutral-700 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200 dark:border-emerald-800 shrink-0 flex items-center gap-1 transition-colors"
                          title={lang === 'pl' ? 'Pobierz plik CSV wysłanych' : 'Download sent CSV'}
                        >
                          <Download className="w-3 h-3" />
                          <span>CSV</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 text-neutral-400 text-xs flex items-center justify-center">
                        <span>{lang === 'pl' ? 'Brak raportu wysłanych' : 'No sent report'}</span>
                      </div>
                    )}

                    {/* Deleted file */}
                    {grp.deletedFile ? (
                      <div className="flex items-center justify-between p-2.5 rounded-lg border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 text-xs">
                        <div className="min-w-0 mr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-rose-800 dark:text-rose-300">
                              {lang === 'pl' ? 'Pliki usunięte' : 'Deleted files'}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-mono">
                              ({formatBytes(grp.deletedFile.size)})
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-500 truncate block font-mono">
                            {grp.deletedFile.filename}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadSingle(grp.deletedFile!.filename)}
                          className="px-2.5 py-1 rounded-md bg-white dark:bg-neutral-800 hover:bg-rose-100 dark:hover:bg-neutral-700 text-rose-700 dark:text-rose-300 font-semibold text-[11px] border border-rose-200 dark:border-rose-800 shrink-0 flex items-center gap-1 transition-colors"
                          title={lang === 'pl' ? 'Pobierz plik CSV usuniętych' : 'Download deleted CSV'}
                        >
                          <Download className="w-3 h-3" />
                          <span>CSV</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 text-neutral-400 text-xs flex items-center justify-center">
                        <span>{lang === 'pl' ? 'Brak raportu usuniętych' : 'No deleted report'}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {runGroups.length > RUNS_PER_PAGE && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {lang === 'pl'
                      ? `Strona ${safePage + 1} z ${totalPages}`
                      : `Page ${safePage + 1} of ${totalPages}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      {lang === 'pl' ? 'Poprzednia' : 'Previous'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage >= totalPages - 1}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      {lang === 'pl' ? 'Następna' : 'Next'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70">
          <span className="text-xs text-neutral-500">
            {lang === 'pl' ? `Łącznie plików raportów: ${files.length}` : `Total CSV report files: ${files.length}`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold transition-colors"
          >
            {lang === 'pl' ? 'Zamknij' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
