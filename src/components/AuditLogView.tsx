import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  User,
  Trash2,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AuditLogEntry, GlobalSettings } from '../types.ts';
import { Language, translations } from '../i18n.ts';
import { api } from '../api.ts';

interface AuditLogViewProps {
  lang: Language;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ lang }) => {
  const t = translations[lang];
  const auditT = t.audit || {
    title: 'Dziennik audytu i operacji',
    subtitle: 'Rejestr wszystkich działań administracyjnych, zmian zadań i operacji systemowych',
    searchPlaceholder: 'Szukaj w dzienniku...',
    clearBtn: 'Wyczyść historię',
    clearConfirm: 'Czy na pewno chcesz wyczyścić historię dziennika audytu? Ta operacja jest nieodwracalna.',
    clearedSuccess: 'Dziennik audytu został pomyślnie wyczyszczony.',
    noLogs: 'Brak wpisów w dzienniku audytu.',
    retentionNotice: 'Automatyczne czyszczenie wpisów starszych niż: {days} dni.',
    retentionUnlimited: 'Brak automatycznego usuwania wpisów (retencja nieograniczona).',
  };

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const [auditData, settingsData] = await Promise.all([
        api.getAuditLogs(),
        api.getSettings().catch(() => null),
      ]);
      setLogs(auditData || []);
      if (settingsData) setSettings(settingsData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClearHistory = async () => {
    setClearing(true);
    try {
      await api.clearAuditLogs();
      setLogs([]);
      setShowClearConfirm(false);
      setMessage(auditT.clearedSuccess);
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Błąd czyszczenia');
    } finally {
      setClearing(false);
    }
  };

  const filtered = useMemo(() => {
    return logs.filter(
      l =>
        l.username.toLowerCase().includes(search.toLowerCase()) ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.details.toLowerCase().includes(search.toLowerCase())
    );
  }, [logs, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedLogs = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, safePage, pageSize]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const retentionDays = settings?.auditLogRetentionDays ?? 30;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>{auditT.title}</span>
            <span className="text-xs font-normal text-neutral-500">
              ({filtered.length} {lang === 'pl' ? 'zdarzeń' : 'events'})
            </span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {auditT.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={auditT.searchPlaceholder}
              className="w-full sm:w-64 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-neutral-400" />
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            title={lang === 'pl' ? 'Odśwież' : 'Refresh'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-xs font-semibold disabled:opacity-40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{auditT.clearBtn}</span>
          </button>
        </div>
      </div>

      {/* Retention Policy Banner */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900 text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <span>
            {retentionDays > 0
              ? auditT.retentionNotice.replace('{days}', retentionDays.toString())
              : auditT.retentionUnlimited}
          </span>
        </div>
        <span className="text-[11px] text-neutral-400 hidden sm:inline">
          {lang === 'pl'
            ? 'Okres retencji możesz zmienić w zakładce Ustawienia -> Ogólne i limity.'
            : 'You can adjust the retention period in Settings -> General & Limits.'}
        </span>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
          {message}
        </div>
      )}

      {/* Logs Table */}
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase font-semibold">
            <tr>
              <th className="py-3 px-4">{lang === 'pl' ? 'Czas' : 'Time'}</th>
              <th className="py-3 px-4">{lang === 'pl' ? 'Użytkownik' : 'User'}</th>
              <th className="py-3 px-4">{lang === 'pl' ? 'Akcja' : 'Action'}</th>
              <th className="py-3 px-4">{lang === 'pl' ? 'Szczegóły operacji' : 'Operation Details'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-mono">
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-neutral-400 font-sans">
                  {auditT.noLogs}
                </td>
              </tr>
            ) : (
              paginatedLogs.map(l => (
                <tr key={l.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="py-3 px-4 text-neutral-500 text-[11px] whitespace-nowrap">
                    {new Date(l.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-sans font-bold text-neutral-900 dark:text-white">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-neutral-400" />
                      {l.username}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-sans text-neutral-700 dark:text-neutral-300">
                    {l.details}
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
            {filtered.length > 0 ? (
              <>
                {lang === 'pl' ? 'Wyświetlono' : 'Showing'}{' '}
                {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)}{' '}
                {lang === 'pl' ? 'z' : 'of'} {filtered.length}
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

      {/* Confirmation Modal for Clearing Audit Logs */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {auditT.clearBtn}
                </h3>
                <p className="text-xs text-neutral-500">
                  {lang === 'pl' ? 'Potwierdzenie operacji' : 'Confirm Action'}
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              {auditT.clearConfirm}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
                className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={clearing}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors"
              >
                {clearing ? t.common.loading : auditT.clearBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
