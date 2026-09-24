import React, { useState, useMemo } from 'react';
import {
  History,
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { JobExecution } from '../types.ts';
import { Language, translations } from '../i18n.ts';
import { api } from '../api.ts';

interface HistoryViewProps {
  lang: Language;
  history: JobExecution[];
  onViewLogs: (job: JobExecution) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  lang,
  history,
  onViewLogs,
}) => {
  const t = translations[lang];
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Filtered & Sorted history
  const sortedAndFilteredHistory = useMemo(() => {
    const filtered = history.filter(item => {
      const matchesSearch =
        item.taskName.toLowerCase().includes(search.toLowerCase()) ||
        item.triggeredBy.toLowerCase().includes(search.toLowerCase()) ||
        (item.logFile && item.logFile.toLowerCase().includes(search.toLowerCase())) ||
        (item.taskNumber !== undefined && String(item.taskNumber).includes(search));

      const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
      const matchesMode = filterMode === 'all' || item.mode === filterMode;

      return matchesSearch && matchesStatus && matchesMode;
    });

    return filtered.sort((a, b) => {
      const timeA = new Date(a.startTime).getTime() || 0;
      const timeB = new Date(b.startTime).getTime() || 0;
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [history, search, filterStatus, filterMode, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedAndFilteredHistory.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return sortedAndFilteredHistory.slice(startIndex, startIndex + pageSize);
  }, [sortedAndFilteredHistory, safePage, pageSize]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleToggleSort = () => {
    setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>{t.history.title}</span>
            <span className="text-xs font-normal text-neutral-500">
              ({sortedAndFilteredHistory.length} {t.history.entriesCount})
            </span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t.history.logStructure}: <code className="font-mono">/logs/&lt;{lang === 'pl' ? 'id zadania' : 'task id'}&gt;_&lt;{lang === 'pl' ? 'zadanie' : 'task'}&gt;/yyyy-mm-dd_hh-mm[_RESTORE].log</code>
          </p>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t.history.filterPlaceholder}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-neutral-400" />
          </div>

          <select
            value={filterStatus}
            onChange={e => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300"
          >
            <option value="all">{t.history.allStatuses}</option>
            <option value="completed">{t.history.statusCompleted}</option>
            <option value="failed">{t.history.statusFailed}</option>
            <option value="stopped">{t.history.statusStopped}</option>
          </select>

          <select
            value={filterMode}
            onChange={e => {
              setFilterMode(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300"
          >
            <option value="all">{t.history.allModes}</option>
            <option value="backup">{t.history.modeBackup}</option>
            <option value="restore">{t.history.modeRestore}</option>
          </select>

          <button
            type="button"
            onClick={handleToggleSort}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            title={lang === 'pl' ? 'Sortuj po dacie' : 'Sort by date'}
          >
            {sortOrder === 'desc' ? (
              <>
                <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{lang === 'pl' ? 'Najnowsze' : 'Newest'}</span>
              </>
            ) : (
              <>
                <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{lang === 'pl' ? 'Najstarsze' : 'Oldest'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase font-semibold">
            <tr>
              <th className="py-3.5 px-4">{t.common.name}</th>
              <th className="py-3.5 px-4">{t.history.mode}</th>
              <th className="py-3.5 px-4">{t.common.status}</th>
              <th className="py-3.5 px-4">{t.history.files}</th>
              <th className="py-3.5 px-4">{t.history.dataTransferred}</th>
              <th className="py-3.5 px-4 cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white" onClick={handleToggleSort}>
                <span className="inline-flex items-center gap-1">
                  <span>{t.history.startTime}</span>
                  {sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-blue-500" /> : <ArrowUp className="w-3 h-3 text-blue-500" />}
                </span>
              </th>
              <th className="py-3.5 px-4">{t.history.duration}</th>
              <th className="py-3.5 px-4 text-right">{t.history.logs}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-mono">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-neutral-400 font-sans">
                  {t.history.noEntries}
                </td>
              </tr>
            ) : (
              paginatedItems.map(item => (
                <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="py-3.5 px-4 font-sans font-bold text-neutral-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                        #{item.taskNumber ?? item.taskId.slice(0, 6)}
                      </span>
                      <span>{item.taskName}</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 font-normal mt-0.5">
                      {t.history.by} {item.triggeredBy}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                        item.mode === 'restore'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                          : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                      }`}
                    >
                      {item.mode}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {item.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 font-sans">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t.status.completed}
                      </span>
                    ) : item.status === 'failed' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-sans">
                        <XCircle className="w-3.5 h-3.5" />
                        {t.status.failed}
                      </span>
                    ) : item.status === 'stopped' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 font-sans">
                        <Square className="w-3 h-3 fill-current" />
                        {t.status.stopped}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 font-sans">
                        {item.status}
                      </span>
                    )}

                    {item.warning && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-600 mt-0.5 font-sans" title={item.warning}>
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[150px]">{lang === 'pl' ? 'Ostrzeżenie' : 'Warning'}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-neutral-700 dark:text-neutral-300">
                    <div>{item.filesTransferred} / {item.filesTotal}</div>
                    {(item.checksTotal || 0) > 0 && (
                      <div className="text-[10px] text-neutral-400 font-normal font-sans">
                        {((item.checksChecked ?? item.checksTotal) ?? 0).toLocaleString()} {lang === 'pl' ? 'sprawdzonych' : 'checked'}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-neutral-700 dark:text-neutral-300">
                    {formatBytes(item.bytesTransferred ?? 0)}
                  </td>
                  <td className="py-3.5 px-4 text-neutral-500 text-[11px]">
                    <div>{new Date(item.startTime).toLocaleDateString()}</div>
                    <div className="text-neutral-400">{new Date(item.startTime).toLocaleTimeString()}</div>
                  </td>
                  <td className="py-3.5 px-4 text-neutral-700 dark:text-neutral-300">
                    {item.durationSeconds ? `${item.durationSeconds}s` : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => onViewLogs(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-sans font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                        title={item.logFile || (lang === 'pl' ? 'Podgląd pliku logu' : 'Preview log file')}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Log</span>
                      </button>

                      {item.csvFiles?.sentFile && (
                        <a
                          href={api.getJobCsvDownloadUrl(item.id, 'sent')}
                          download
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-sans font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                          title={lang === 'pl' ? 'Pobierz CSV wysłanych plików' : 'Download sent files CSV'}
                        >
                          <FileSpreadsheet className="w-3 h-3" />
                          <span>Wysłane</span>
                        </a>
                      )}

                      {item.csvFiles?.deletedFile && (
                        <a
                          href={api.getJobCsvDownloadUrl(item.id, 'deleted')}
                          download
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-sans font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                          title={lang === 'pl' ? 'Pobierz CSV usuniętych plików' : 'Download deleted files CSV'}
                        >
                          <FileSpreadsheet className="w-3 h-3" />
                          <span>Usunięte</span>
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

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-2">
          <span>{lang === 'pl' ? 'Liczba wpisów na stronę:' : 'Entries per page:'}</span>
          <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-800 p-0.5 bg-white dark:bg-neutral-900">
            {[10, 25, 50].map(size => (
              <button
                key={size}
                type="button"
                onClick={() => handlePageSizeChange(size)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  pageSize === size
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <span className="text-neutral-400 ml-2">
            {sortedAndFilteredHistory.length > 0 ? (
              <>
                {lang === 'pl' ? 'Wyświetlono' : 'Showing'}{' '}
                {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sortedAndFilteredHistory.length)}{' '}
                {lang === 'pl' ? 'z' : 'of'} {sortedAndFilteredHistory.length}
              </>
            ) : null}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors"
            title={lang === 'pl' ? 'Poprzednia strona' : 'Previous page'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 font-semibold text-neutral-700 dark:text-neutral-300">
            {safePage} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors"
            title={lang === 'pl' ? 'Następna strona' : 'Next page'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
