import React, { useState } from 'react';
import {
  Plus,
  Play,
  RotateCcw,
  Edit2,
  Copy,
  Trash2,
  Terminal,
  Clock,
  Search,
  Layers,
  ArrowRight,
  Tag,
  Folder,
  AlertCircle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Task, User } from '../types.ts';
import { Language, translations } from '../i18n.ts';
import { TaskFilesModal } from './TaskFilesModal.tsx';

interface TasksViewProps {
  lang: Language;
  tasks: Task[];
  user: User | null;
  activeTaskIds?: Set<string>;
  onNewTask: () => void;
  onEditTask: (task: Task) => void;
  onDuplicateTask: (taskId: string) => void;
  onDeleteTask: (task: Task) => void | Promise<void>;
  onRunTask: (taskId: string) => void;
  onRestoreTask: (task: Task) => void;
  onQuickPreview: (task: Task) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  lang,
  tasks,
  user,
  activeTaskIds,
  onNewTask,
  onEditTask,
  onDuplicateTask,
  onDeleteTask,
  onRunTask,
  onRestoreTask,
  onQuickPreview,
}) => {
  const t = translations[lang];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [filesModalTask, setFilesModalTask] = useState<Task | null>(null);

  const isAdmin = user?.role === 'admin';

  // Extract all unique tags
  const allTags = Array.from(new Set(tasks.flatMap(t => t.tags || [])));

  const filteredTasks = tasks.filter(task => {
    const matchesSearch =
      task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.pairs.some(
        p =>
          p.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.destination.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesTag = !selectedTag || (task.tags && task.tags.includes(selectedTag));

    return matchesSearch && matchesTag;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTasks = filteredTasks.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleTagToggle = (tag: string | null) => {
    setSelectedTag(tag);
    setCurrentPage(1);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await onDeleteTask(taskToDelete);
      setTaskToDelete(null);
    } catch (err: any) {
      setDeleteError(
        err.message || (lang === 'pl' ? 'Wystąpił błąd podczas usuwania zadania' : 'Failed to delete task')
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar: Search, Tag filter, Create button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder={t.common.search}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          </div>

          {selectedTag && (
            <button
              onClick={() => handleTagToggle(null)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 flex items-center gap-1 cursor-pointer"
            >
              <span>#{selectedTag}</span>
              <span>×</span>
            </button>
          )}
        </div>

        {isAdmin && (
          <button
            id="btn-create-task"
            onClick={onNewTask}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.tasks.createNew}</span>
          </button>
        )}
      </div>

      {/* Tags strip */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-neutral-400 flex items-center gap-1 shrink-0">
            <Tag className="w-3 h-3" /> {lang === 'pl' ? 'Tagi:' : 'Tags:'}
          </span>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => handleTagToggle(selectedTag === tag ? null : tag)}
              className={`px-2 py-0.5 rounded-full font-medium transition-colors shrink-0 cursor-pointer ${
                selectedTag === tag
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Task List - One task per line, standardized structure */}
      {filteredTasks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50">
          <div className="inline-flex p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
            {t.tasks.emptyTitle}
          </h3>
          <p className="mt-1 text-xs text-neutral-500 max-w-sm mx-auto">
            {t.tasks.emptySubtitle}
          </p>
          {isAdmin && (
            <button
              onClick={onNewTask}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              {t.tasks.createNew}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedTasks.map((task, idx) => {
            const hasSchedules = task.scheduleEnabled && task.schedules && task.schedules.length > 0;
            const hasMorePairs = task.pairs.length > 1;
            const isRunning = activeTaskIds?.has(task.id) || false;
            const taskDisplayNum = task.taskNumber ?? ((safePage - 1) * pageSize + idx + 1);

            return (
              <div
                key={task.id}
                className={`flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-2xl border bg-white dark:bg-neutral-900 shadow-sm transition-all ${
                  isRunning
                    ? 'border-blue-400 dark:border-blue-700/80 ring-1 ring-blue-400/30'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                {/* 1. LEWA CZĘŚĆ (Zawsze spójna, 5 wierszy):
                    - ID / Numer + Nazwa
                    - Silnik kopii | Tryb operacji
                    - Ilość harmonogramów
                    - Kosz / Restore / Kolejna
                    - Tagi
                */}
                <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-1.5 min-w-0">
                  {/* Linia 1: Numer/ID zadania + Nazwa */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="px-2 py-0.5 text-xs font-mono font-bold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 shrink-0"
                      title={lang === 'pl' ? `Unikalny numer zadania: #${taskDisplayNum}` : `Unique task ID: #${taskDisplayNum}`}
                    >
                      #{taskDisplayNum}
                    </span>
                    <h3
                      className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight truncate"
                      title={task.name}
                    >
                      {task.name}
                    </h3>
                    {isRunning && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 shrink-0 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                        {lang === 'pl' ? 'Wykonywanie...' : 'Running...'}
                      </span>
                    )}
                  </div>

                  {/* Linia 2: Silnik kopii | Tryb operacji */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-neutral-400">
                        {lang === 'pl' ? 'Silnik:' : 'Engine:'}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded border ${
                        task.engine === 'rsync' && task.rsyncFlagsMode === 'rtv'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                      }`}>
                        {task.engine === 'rsync' ? (task.rsyncFlagsMode === 'rtv' ? 'rsync (-rtv)' : 'rsync (-avh)') : task.engine}
                      </span>
                    </div>

                    <span className="text-neutral-300 dark:text-neutral-700 font-light">|</span>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-neutral-400">
                        {lang === 'pl' ? 'Tryb:' : 'Mode:'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${
                          task.type === 'mirror'
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50'
                            : task.type === 'move'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                        }`}
                      >
                        {task.type}
                      </span>
                    </div>
                  </div>

                  {/* Linia 3: Ilość harmonogramów */}
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate">
                      {hasSchedules
                        ? task.schedules.length === 1
                          ? lang === 'pl'
                            ? '1 harmonogram'
                            : '1 schedule'
                          : `${task.schedules.length} ${lang === 'pl' ? 'harmonogramy' : 'schedules'}`
                        : lang === 'pl'
                        ? 'Brak harmonogramu (ręcznie)'
                        : 'No schedule (manual only)'}
                    </span>
                  </div>

                  {/* Linia 4: Kosz / Restore / Kolejna */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {/* Kosz */}
                    {task.trashEnabled ? (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50"
                        title={
                          lang === 'pl'
                            ? `Kosz aktywny: retencja ${task.trashRetentionDays} dni`
                            : `Trash active: retention ${task.trashRetentionDays} days`
                        }
                      >
                        {lang === 'pl' ? `Kosz (${task.trashRetentionDays}d)` : `Trash (${task.trashRetentionDays}d)`}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800/60 text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700/60">
                        {lang === 'pl' ? 'Kosz: wył.' : 'Trash: off'}
                      </span>
                    )}

                    {/* Restore */}
                    {task.restoreEnabled ? (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                        title={lang === 'pl' ? 'Przywracanie (Restore) dozwolone' : 'Restore enabled'}
                      >
                        Restore
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800/60 text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700/60">
                        {lang === 'pl' ? 'Restore: wył.' : 'Restore: off'}
                      </span>
                    )}

                    {/* Kolejna / Kolejka */}
                    {task.runAfterTaskId ? (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50"
                        title={lang === 'pl' ? 'Zadanie wyzwalane po innym zadaniu' : 'Triggered after previous task'}
                      >
                        {lang === 'pl' ? 'Kolejka' : 'Queued'}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800/60 text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700/60">
                        {lang === 'pl' ? 'Kolejka: brak' : 'Queue: none'}
                      </span>
                    )}

                    {/* OneDrive long paths handling */}
                    {task.oneDriveLongPathsHandling && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-900/50"
                        title="OneDrive ścieżki > 400 znaków"
                      >
                        OneDrive (&gt;400)
                      </span>
                    )}
                  </div>

                  {/* Linia 5: Tagi */}
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 min-h-[20px] overflow-hidden">
                    <Tag className="w-3 h-3 text-neutral-400 shrink-0" />
                    {task.tags && task.tags.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1 overflow-hidden">
                        {task.tags.map(tag => (
                          <span
                            key={tag}
                            className="text-[10px] font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.2 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-neutral-400 italic">
                        {lang === 'pl' ? 'Brak tagów' : 'No tags'}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. ŚRODEK: Pary ścieżek (Source ➔ Destination) */}
                <div className="flex-1 min-w-0 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-200/80 dark:border-neutral-800/80 font-mono text-xs flex flex-col justify-center">
                  <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-neutral-200/50 dark:border-neutral-800/50">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1 font-sans">
                      <Folder className="w-3 h-3 text-neutral-400" />
                      <span>{lang === 'pl' ? 'Pary ścieżek' : 'Path Pairs'} ({task.pairs.length}):</span>
                    </span>
                    {hasMorePairs && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold font-sans">
                        +{task.pairs.length - 1} {lang === 'pl' ? 'więcej' : 'more'}
                      </span>
                    )}
                  </div>

                  {/* Wyświetlanie par ścieżek */}
                  <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                    {task.pairs.slice(0, 2).map((pair, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 text-[11px] leading-tight"
                      >
                        <span
                          className="truncate flex-1 bg-white dark:bg-neutral-900 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800"
                          title={`Źródło: ${pair.source}`}
                        >
                          {pair.source || '/'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span
                          className="truncate flex-1 bg-white dark:bg-neutral-900 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800"
                          title={`Cel: ${pair.destination}`}
                        >
                          {pair.destination || '/'}
                        </span>
                      </div>
                    ))}
                    {task.pairs.length > 2 && (
                      <p className="text-[10px] text-neutral-400 italic text-center font-sans">
                        ...{lang === 'pl' ? `oraz ${task.pairs.length - 2} dodatkowe pary` : `and ${task.pairs.length - 2} more pairs`}
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. PRAWA STRONA:
                    uruchom | przywróć | przyciski czyli pokaż komendy | duplikuj | edytuj | usuń
                */}
                <div className="flex items-center justify-end gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-neutral-100 dark:border-neutral-800">
                  {/* Uruchom (Run Now) */}
                  <button
                    id={`btn-run-${task.id}`}
                    type="button"
                    disabled={isRunning}
                    onClick={() => !isRunning && onRunTask(task.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                      isRunning
                        ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 cursor-not-allowed opacity-75'
                        : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white cursor-pointer'
                    }`}
                    title={isRunning ? (lang === 'pl' ? 'Zadanie jest aktualnie w trakcie wykonywania' : 'Task is currently running') : t.common.runNow}
                  >
                    <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-pulse text-amber-500' : 'fill-current'}`} />
                    <span>{isRunning ? (lang === 'pl' ? 'Wykonywanie' : 'Running') : t.common.runNow}</span>
                  </button>

                  {/* Przywróć (Restore):
                      Zgodnie z życzeniem użytkownika:
                      "jeżeli RESTORE jest wyłączony to wyłącz przycisk - nie usuwaj/ukrywaj tak jak jest teraz"
                  */}
                  {task.restoreEnabled ? (
                    <button
                      id={`btn-restore-${task.id}`}
                      type="button"
                      disabled={isRunning}
                      onClick={() => !isRunning && onRestoreTask(task)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        isRunning
                          ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-neutral-200 dark:border-neutral-700 opacity-40 cursor-not-allowed'
                          : 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 active:scale-95 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 cursor-pointer'
                      }`}
                      title={
                        isRunning
                          ? (lang === 'pl' ? 'Zadanie jest w trakcie wykonywania – przywracanie zablokowane' : 'Task is running – restore locked')
                          : t.common.restore
                      }
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t.common.restore}</span>
                    </button>
                  ) : (
                    <button
                      id={`btn-restore-${task.id}`}
                      type="button"
                      disabled
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 text-neutral-400 dark:text-neutral-600 border border-neutral-200 dark:border-neutral-700/60 text-xs font-semibold opacity-40 cursor-not-allowed"
                      title={
                        lang === 'pl'
                          ? 'Przywracanie jest wyłączone dla tego zadania w konfiguracji'
                          : 'Restore is disabled for this task in its configuration'
                      }
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t.common.restore}</span>
                    </button>
                  )}

                  {/* Przyciski: Pokaż komendy | Duplikuj | Edytuj | Usuń */}
                  <div className="flex items-center gap-1 pl-2 border-l border-neutral-200 dark:border-neutral-800">
                    {/* Pokaż komendy */}
                    <button
                      type="button"
                      onClick={() => onQuickPreview(task)}
                      className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                      title={lang === 'pl' ? 'Pokaż komendy CLI' : t.common.preview}
                    >
                      <Terminal className="w-4 h-4" />
                    </button>

                    {/* Pliki raportów CSV (Tylko administrator) */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setFilesModalTask(task)}
                        className="p-2 rounded-xl text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                        title={lang === 'pl' ? 'Pobierz raporty CSV (Wysłane / Usunięte)' : 'Download CSV reports (Sent / Deleted)'}
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>
                    )}

                    {/* Duplikuj */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onDuplicateTask(task.id)}
                        className="p-2 rounded-xl text-neutral-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                        title={t.common.duplicate}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}

                    {/* Edytuj - zablokowane gdy zadanie wykonuje się */}
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => !isRunning && onEditTask(task)}
                        className={`p-2 rounded-xl transition-colors ${
                          isRunning
                            ? 'text-neutral-300 dark:text-neutral-600 opacity-40 cursor-not-allowed'
                            : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer'
                        }`}
                        title={
                          isRunning
                            ? (lang === 'pl'
                                ? 'Zadanie jest aktualnie uruchomione – edycja zablokowana'
                                : 'Task is currently running – editing is locked')
                            : t.common.edit
                        }
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Usuń - zablokowane gdy zadanie wykonuje się */}
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => {
                          if (isRunning) return;
                          setDeleteError(null);
                          setTaskToDelete(task);
                        }}
                        className={`p-2 rounded-xl transition-colors ${
                          isRunning
                            ? 'text-neutral-300 dark:text-neutral-600 opacity-40 cursor-not-allowed'
                            : 'text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer'
                        }`}
                        title={
                          isRunning
                            ? (lang === 'pl'
                                ? 'Zadanie jest aktualnie uruchomione – usunięcie zablokowane'
                                : 'Task is currently running – cannot be deleted')
                            : t.common.delete
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {filteredTasks.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 text-xs text-neutral-600 dark:text-neutral-400">
          <div className="flex items-center gap-2">
            <span>{lang === 'pl' ? 'Liczba wpisów na stronę:' : 'Entries per page:'}</span>
            <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-800 p-0.5 bg-white dark:bg-neutral-900">
              {[5, 10, 25, 50].map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handlePageSizeChange(size)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
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
              {lang === 'pl' ? 'Wyświetlono' : 'Showing'}{' '}
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredTasks.length)}{' '}
              {lang === 'pl' ? 'z' : 'of'} {filteredTasks.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
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
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
              title={lang === 'pl' ? 'Następna strona' : 'Next page'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Task Confirmation Modal (Fix for "USUŃ nie działa na Zadania") */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {lang === 'pl' ? 'Usunąć zadanie?' : 'Delete Task?'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {lang === 'pl' ? 'Tej operacji nie można cofnąć.' : 'This action cannot be undone.'}
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  {lang === 'pl' ? 'Zadanie:' : 'Task:'}
                </span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white truncate max-w-[260px]">
                  {taskToDelete.name}
                </span>
              </div>
              <p className="text-neutral-500 text-[11px]">
                {lang === 'pl'
                  ? 'Konfiguracja zadania, harmonogramy, historia wykonania, wpisy w monitorze zadań oraz foldery logów i raportów CSV (data/logs/ i data/files/) zostaną bezpowrotnie usunięte.'
                  : 'Task configuration, schedules, execution history, job monitor entries, and associated log/CSV folders (data/logs/ and data/files/) will be permanently deleted.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {deleteLoading
                    ? lang === 'pl'
                      ? 'Usuwanie...'
                      : 'Deleting...'
                    : lang === 'pl'
                    ? 'Usuń zadanie'
                    : 'Delete Task'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal przeglądania i pobierania plików raportów CSV */}
      <TaskFilesModal
        isOpen={!!filesModalTask}
        onClose={() => setFilesModalTask(null)}
        task={filesModalTask}
        lang={lang}
      />
    </div>
  );
};
