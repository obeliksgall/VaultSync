import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  ArrowUp,
  Search,
  X,
  Check,
  HardDrive,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  FolderPlus,
} from 'lucide-react';
import { Language, translations } from '../i18n.ts';
import { api } from '../api.ts';
import { FsItem } from '../types.ts';

interface DirectoryBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selectedPath: string) => void;
  initialPath?: string;
  lang: Language;
  title?: string;
}

export const DirectoryBrowserModal: React.FC<DirectoryBrowserModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath = '/',
  lang,
  title,
}) => {
  const t = translations[lang];
  const fb = t.fileBrowser;

  // Clean initial path (strip trailing colon if user had remote, default to /)
  const sanitizeInitialPath = (p: string) => {
    if (!p || p.trim() === '' || p.includes(':')) return '/';
    return p.trim();
  };

  const [currentPath, setCurrentPath] = useState<string>(sanitizeInitialPath(initialPath));
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [items, setItems] = useState<FsItem[]>([]);
  const [quickPaths, setQuickPaths] = useState<string[]>(['/', '/data', '/tmp']);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedItemPath, setSelectedItemPath] = useState<string>(sanitizeInitialPath(initialPath));
  const [manualInputPath, setManualInputPath] = useState<string>(sanitizeInitialPath(initialPath));
  const [pathWarning, setPathWarning] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const startPath = sanitizeInitialPath(initialPath);
      setCurrentPath(startPath);
      setSelectedItemPath(startPath);
      setManualInputPath(startPath);
      setPathWarning(null);
      setSearchTerm('');
      loadDirectory(startPath);
    }
  }, [isOpen, initialPath]);

  const loadDirectory = async (targetPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.browseFs(targetPath);
      setCurrentPath(res.currentPath);
      setParentPath(res.parentPath);
      setItems(res.items || []);
      setPathWarning(res.warning || null);
      if (res.quickPaths && res.quickPaths.length > 0) {
        setQuickPaths(res.quickPaths);
      }
      setManualInputPath(res.currentPath);
      setSelectedItemPath(res.currentPath);
    } catch (err: any) {
      setError(err.message || fb.permissionDenied);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateTo = (targetPath: string) => {
    setSearchTerm('');
    loadDirectory(targetPath);
  };

  const handleGoUp = () => {
    if (parentPath) {
      handleNavigateTo(parentPath);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInputPath.trim()) {
      handleNavigateTo(manualInputPath.trim());
    }
  };

  const handleItemClick = (item: FsItem) => {
    if (item.isDirectory) {
      setSelectedItemPath(item.path);
    }
  };

  const handleItemDoubleClick = (item: FsItem) => {
    if (item.isDirectory) {
      handleNavigateTo(item.path);
    }
  };

  const handleConfirmSelection = () => {
    onSelect(selectedItemPath || currentPath);
    onClose();
  };

  if (!isOpen) return null;

  // Split path for breadcrumbs
  const pathParts = currentPath.split('/').filter(Boolean);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                {title || fb.title}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {fb.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Path Input Bar & Quick Shortcuts */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-3">
          {/* Quick shortcuts */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="font-semibold text-neutral-500 dark:text-neutral-400 shrink-0 flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" />
              {fb.quickPaths}:
            </span>
            {quickPaths.map(qp => (
              <button
                key={qp}
                type="button"
                onClick={() => handleNavigateTo(qp)}
                className={`px-2.5 py-1 rounded-lg font-mono text-xs font-medium border transition-colors shrink-0 ${
                  currentPath === qp
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-750'
                }`}
              >
                {qp === '/' ? '/ (Root)' : qp}
              </button>
            ))}
          </div>

          {/* Breadcrumbs & Direct Path Bar */}
          <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
            <div className="flex-1 relative flex items-center">
              <span className="absolute left-3 text-neutral-400 font-mono text-xs">
                path:
              </span>
              <input
                type="text"
                value={manualInputPath}
                onChange={e => setManualInputPath(e.target.value)}
                placeholder="/sciezka/do/katalogu"
                className="w-full pl-12 pr-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 text-xs font-semibold transition-colors"
            >
              {fb.go}
            </button>
            <button
              type="button"
              onClick={() => loadDirectory(currentPath)}
              disabled={loading}
              title="Odśwież katalog"
              className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </form>

          {/* Clickable breadcrumbs */}
          <div className="flex items-center gap-1 flex-wrap text-xs font-mono text-neutral-600 dark:text-neutral-300">
            <button
              type="button"
              onClick={() => handleNavigateTo('/')}
              className="hover:underline hover:text-blue-600 font-bold px-1"
            >
              /
            </button>
            {pathParts.map((part, idx) => {
              const fullSegmentPath = '/' + pathParts.slice(0, idx + 1).join('/');
              const isLast = idx === pathParts.length - 1;
              return (
                <React.Fragment key={fullSegmentPath}>
                  <ChevronRight className="w-3 h-3 text-neutral-400" />
                  <button
                    type="button"
                    onClick={() => handleNavigateTo(fullSegmentPath)}
                    className={`hover:underline px-1 rounded ${
                      isLast
                        ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40'
                        : 'hover:text-blue-600'
                    }`}
                  >
                    {part}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Path Warning or Fallback Banner */}
        {pathWarning && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{lang === 'pl' ? 'Wskazówka montowania wolumenów Docker:' : 'Docker Volume Mounting Note:'}</p>
              <p className="text-[11px] leading-relaxed">{pathWarning}</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                {lang === 'pl'
                  ? 'Katalog ./data z Twojego komputera znajduje się wewnątrz kontenera jako /data. Jeśli dodałeś foldery na dysku komputera w osobnym miejscu (np. /DATAtest), dodaj wpis w sekcji volumes w pliku docker-compose.yml.'
                  : 'Folder ./data from host is mapped to /data inside the container. To access other host folders, add them to volumes: in docker-compose.yml.'}
              </p>
            </div>
          </div>
        )}

        {/* Filter / Search input */}
        <div className="px-4 py-2 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={fb.searchPlaceholder}
              className="w-full pl-8 pr-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 min-h-[300px] max-h-[420px] overflow-y-auto p-2 divide-y divide-neutral-100 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
          {error && (
            <div className="m-4 p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">{error}</p>
                {parentPath && (
                  <button
                    type="button"
                    onClick={() => handleNavigateTo(parentPath)}
                    className="mt-2 text-xs font-semibold text-rose-800 dark:text-rose-200 underline hover:no-underline flex items-center gap-1"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    Wróć do katalogu nadrzędnego
                  </button>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <span>{t.common.loading}</span>
            </div>
          ) : (
            <>
              {/* Parent directory row */}
              {parentPath && (
                <button
                  type="button"
                  onClick={handleGoUp}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors group"
                >
                  <div className="p-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700">
                    <ArrowUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold">.. ({fb.parentFolder})</span>
                </button>
              )}

              {filteredItems.length === 0 && !error && (
                <div className="p-12 text-center text-xs text-neutral-400">
                  {fb.emptyFolder}
                </div>
              )}

              {filteredItems.map(item => {
                const isSelected = selectedItemPath === item.path;
                return (
                  <div
                    key={item.path}
                    onClick={() => handleItemClick(item)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 font-semibold'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      {item.isDirectory ? (
                        <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <File className="w-4 h-4 text-neutral-400 shrink-0" />
                      )}
                      <span className="text-xs font-mono truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-[11px] text-neutral-400">
                      {item.size !== undefined && (
                        <span>{formatFileSize(item.size)}</span>
                      )}
                      {item.isDirectory && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleNavigateTo(item.path);
                          }}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-neutral-600 dark:text-neutral-300 hover:text-blue-600 transition-colors"
                        >
                          Otwórz ➔
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer & Selection Confirm */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto text-left">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Wybrana ścieżka:
            </span>
            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 break-all">
              {selectedItemPath || currentPath}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs font-semibold transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={handleConfirmSelection}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{fb.selectFolder}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
