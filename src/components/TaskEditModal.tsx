import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Terminal,
  Clock,
  Filter,
  Bell,
  Archive,
  RotateCcw,
  Copy,
  Check,
  Calendar,
  AlertCircle,
  FolderOpen,
  Cloud,
  AlertTriangle,
  Mail,
  FileSpreadsheet,
  Sliders,
} from 'lucide-react';
import {
  Task,
  TaskPair,
  TaskSchedule,
  BackupEngine,
  BackupType,
  RsyncFlagsMode,
  EmailLogAttachmentCondition,
  TaskNotifications,
} from '../types.ts';
import { Language, translations } from '../i18n.ts';
import { api } from '../api.ts';
import { generateUUID, copyToClipboard } from '../utils.ts';
import { DirectoryBrowserModal } from './DirectoryBrowserModal.tsx';

// Computes the fixed "every N minutes since midnight" grid used by the 'interval'
// schedule type, e.g. "03:30" -> 00:00, 03:30, 07:00, 10:30, 14:00, 17:30, 21:00.
// The grid always starts at 00:00 and resets each day, so the last segment before
// midnight can be shorter than the configured step.
function computeIntervalTimes(step: string): string[] {
  const match = /^(\d{1,2}):(\d{2})$/.exec((step || '').trim());
  if (!match) return [];
  const stepMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  if (!stepMinutes || stepMinutes <= 0) return [];

  const times: string[] = [];
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    times.push(`${hh}:${mm}`);
  }
  return times;
}

interface TaskEditModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  initialTask?: Task | null;
  existingTasks: Task[];
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  lang,
  isOpen,
  onClose,
  onSave,
  initialTask,
  existingTasks,
}) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<
    'general' | 'paths' | 'schedule' | 'advanced' | 'notifications' | 'preview'
  >('general');

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [engine, setEngine] = useState<BackupEngine>('rclone');
  const [type, setType] = useState<BackupType>('mirror');
  const [rsyncFlagsMode, setRsyncFlagsMode] = useState<RsyncFlagsMode>('avh');
  const [pairs, setPairs] = useState<TaskPair[]>([
    { id: generateUUID(), source: '/source/data', destination: '/destination/backup' },
  ]);
  const PAIRS_PER_PAGE = 5;
  const [pairPage, setPairPage] = useState(0);
  const [customFlags, setCustomFlags] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [schedules, setSchedules] = useState<TaskSchedule[]>([]);
  const SCHEDULES_PER_PAGE = 5;
  const [schedulePage, setSchedulePage] = useState(0);
  const [runAfterTaskId, setRunAfterTaskId] = useState<string | null>(null);
  const [filterInput, setFilterInput] = useState('');
  const [excludeFilters, setExcludeFilters] = useState<string[]>(['*.tmp', '*.log']);
  const [restoreEnabled, setRestoreEnabled] = useState(true);
  const [logRetentionDays, setLogRetentionDays] = useState<number | ''>('');
  const [trashEnabled, setTrashEnabled] = useState(true);
  const [trashRetentionDays, setTrashRetentionDays] = useState(14);
  const [oneDriveLongPathsHandling, setOneDriveLongPathsHandling] = useState(true);
  const [notifications, setNotifications] = useState<TaskNotifications>({
    enabled: true,
    trigger: 'all',
    discord: true,
    ntfy: true,
    email: true,
    emailLogAttachment: 'error',
  });

  // Command preview states
  const [previewCommands, setPreviewCommands] = useState<string[]>([]);
  const [previewMode, setPreviewMode] = useState<'backup' | 'restore'>('backup');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Local directory browser state
  const [browserState, setBrowserState] = useState<{
    isOpen: boolean;
    pairIndex: number;
    field: 'source' | 'destination';
    initialPath: string;
  }>({
    isOpen: false,
    pairIndex: 0,
    field: 'source',
    initialPath: '/',
  });

  const [nameError, setNameError] = useState<string | null>(null);

  const openBrowserForPair = (pairIndex: number, field: 'source' | 'destination') => {
    const currentVal = pairs[pairIndex]?.[field] || '/';
    setBrowserState({
      isOpen: true,
      pairIndex,
      field,
      initialPath: currentVal,
    });
  };

  const handleBrowserSelect = (selectedPath: string) => {
    handlePairChange(browserState.pairIndex, browserState.field, selectedPath);
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab('general');
    }
  }, [isOpen, initialTask]);

  useEffect(() => {
    if (initialTask) {
      setName(initialTask.name);
      setDescription(initialTask.description || '');
      setTags(initialTask.tags || []);
      setEngine(initialTask.engine);
      setType(initialTask.type);
      setRsyncFlagsMode(initialTask.rsyncFlagsMode || 'avh');
      setPairs(
        initialTask.pairs && initialTask.pairs.length > 0
          ? initialTask.pairs
          : [{ id: generateUUID(), source: '', destination: '' }]
      );
      setCustomFlags(initialTask.customFlags || '');
      setScheduleEnabled(initialTask.scheduleEnabled || false);
      setSchedules(initialTask.schedules || []);
      setRunAfterTaskId(initialTask.runAfterTaskId || null);
      setExcludeFilters(initialTask.excludeFilters || []);
      setRestoreEnabled(initialTask.restoreEnabled !== false);
      setLogRetentionDays(
        initialTask.logRetentionDays !== undefined && initialTask.logRetentionDays !== null
          ? initialTask.logRetentionDays
          : ''
      );
      setTrashEnabled(!!initialTask.trashEnabled);
      setTrashRetentionDays(initialTask.trashRetentionDays ?? 14);
      setOneDriveLongPathsHandling(initialTask.oneDriveLongPathsHandling !== false);
      setNotifications({
        enabled: initialTask.notifications?.enabled !== false,
        trigger: initialTask.notifications?.trigger || 'all',
        discord: initialTask.notifications?.discord !== false,
        ntfy: initialTask.notifications?.ntfy !== false,
        email: initialTask.notifications?.email !== false,
        emailLogAttachment: initialTask.notifications?.emailLogAttachment || 'error',
        csvReportSent: initialTask.notifications?.csvReportSent ?? true,
        csvReportDeleted: initialTask.notifications?.csvReportDeleted ?? true,
      });
      setPairPage(0);
    } else {
      setName('');
      setDescription('');
      setTags([]);
      setEngine('rclone');
      setType('mirror');
      setRsyncFlagsMode('avh');
      setPairs([{ id: generateUUID(), source: '/source/data', destination: '/destination/backup' }]);
      setCustomFlags('');
      setScheduleEnabled(false);
      setSchedules([
        { id: generateUUID(), type: 'daily', time: '02:00', enabled: true },
      ]);
      setRunAfterTaskId(null);
      setExcludeFilters(['*.tmp', '*.log', 'node_modules/', '.cache/']);
      setRestoreEnabled(true);
      setLogRetentionDays('');
      setTrashEnabled(true);
      setTrashRetentionDays(14);
      setOneDriveLongPathsHandling(true);
      setNotifications({
        enabled: true,
        trigger: 'all',
        discord: true,
        ntfy: true,
        email: true,
        emailLogAttachment: 'error',
        csvReportSent: true,
        csvReportDeleted: true,
      });
      setPairPage(0);
    }
  }, [initialTask, isOpen]);

  // Keep the pairs pagination in range whenever the list shrinks (delete) or the modal resets.
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(pairs.length / PAIRS_PER_PAGE));
    if (pairPage > totalPages - 1) {
      setPairPage(totalPages - 1);
    }
  }, [pairs.length, pairPage]);

  // Keep the schedules pagination in range whenever the list shrinks (delete) or the modal resets.
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(schedules.length / SCHEDULES_PER_PAGE));
    if (schedulePage > totalPages - 1) {
      setSchedulePage(totalPages - 1);
    }
  }, [schedules.length, schedulePage]);

  // Update preview commands when relevant fields change
  useEffect(() => {
    const dummyTask: Partial<Task> = {
      name: name || 'DemoTask',
      engine,
      type,
      rsyncFlagsMode,
      pairs: pairs.filter(p => p.source.trim() || p.destination.trim()),
      customFlags,
      excludeFilters,
      trashEnabled,
      trashRetentionDays,
    };

    api
      .previewCommand(dummyTask, previewMode)
      .then(res => setPreviewCommands(res.commands))
      .catch(() => {});
  }, [name, engine, type, rsyncFlagsMode, pairs, customFlags, excludeFilters, trashEnabled, previewMode]);

  if (!isOpen) return null;

  // Pairs helpers
  const handleAddPair = () => {
    const nextPairs = [...pairs, { id: generateUUID(), source: '', destination: '' }];
    setPairs(nextPairs);
    setPairPage(Math.floor((nextPairs.length - 1) / PAIRS_PER_PAGE));
  };

  const handleRemovePair = (index: number) => {
    if (pairs.length <= 1) return;
    setPairs(pairs.filter((_, i) => i !== index));
  };

  const handlePairChange = (index: number, field: 'source' | 'destination', value: string) => {
    const next = [...pairs];
    next[index][field] = value;
    setPairs(next);
  };

  // Tags helpers
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/^,+|,+$/g, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Exclude filters helpers
  const handleAddFilter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = filterInput.trim();
      if (val && !excludeFilters.includes(val)) {
        setExcludeFilters([...excludeFilters, val]);
        setFilterInput('');
      }
    }
  };

  const handleRemoveFilter = (filterToRemove: string) => {
    setExcludeFilters(excludeFilters.filter(f => f !== filterToRemove));
  };

  // Schedule helpers (up to 30)
  const handleAddSchedule = () => {
    if (schedules.length >= 30) return;
    setSchedules([
      ...schedules,
      {
        id: generateUUID(),
        type: 'daily',
        time: '03:00',
        enabled: true,
      },
    ]);
    // Jump to the page that will contain the newly added schedule.
    setSchedulePage(Math.floor(schedules.length / SCHEDULES_PER_PAGE));
  };

  const handleRemoveSchedule = (id: string) => {
    setSchedules(schedules.filter(s => s.id !== id));
  };

  const handleScheduleChange = (id: string, updates: Partial<TaskSchedule>) => {
    setSchedules(schedules.map(s => (s.id === id ? { ...s, ...updates } : s)));
  };

  const toggleDayOfWeek = (scheduleId: string, day: number) => {
    setSchedules(
      schedules.map(s => {
        if (s.id !== scheduleId) return s;
        const currentDays = s.daysOfWeek || [];
        const nextDays = currentDays.includes(day)
          ? currentDays.filter(d => d !== day)
          : [...currentDays, day];
        return { ...s, daysOfWeek: nextDays };
      })
    );
  };

  const toggleDayOfMonth = (scheduleId: string, day: number) => {
    setSchedules(
      schedules.map(s => {
        if (s.id !== scheduleId) return s;
        const currentDays = s.daysOfMonth || (s.dayOfMonth ? [s.dayOfMonth] : [1]);
        const nextDays = currentDays.includes(day)
          ? currentDays.filter(d => d !== day)
          : [...currentDays, day].sort((a, b) => a - b);
        const finalDays = nextDays.length > 0 ? nextDays : [day];
        return { ...s, daysOfMonth: finalDays, dayOfMonth: finalDays[0] };
      })
    );
  };

  const setBulkDaysOfMonth = (scheduleId: string, days: number[]) => {
    setSchedules(
      schedules.map(s => {
        if (s.id !== scheduleId) return s;
        return { ...s, daysOfMonth: days, dayOfMonth: days[0] || 1 };
      })
    );
  };

  const handleCopyCommand = async (cmd: string, idx: number) => {
    await copyToClipboard(cmd);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validPairs = pairs
      .map(p => ({ ...p, source: p.source.trim(), destination: p.destination.trim() }))
      .filter(p => p.source.length > 0 && p.destination.length > 0);

    if (validPairs.length === 0) {
      alert(lang === 'pl' ? 'Podaj co najmniej jedną parę Źródło -> Cel.' : 'Specify at least one Source -> Destination pair.');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(lang === 'pl' ? 'Nazwa zadania nie może być pusta.' : 'Task name cannot be empty.');
      setActiveTab('general');
      return;
    }

    // Enforce unique task name
    const collision = existingTasks.some(
      t => t.id !== initialTask?.id && t.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (collision) {
      setNameError(
        lang === 'pl'
          ? `Zadanie o nazwie "${trimmedName}" już istnieje. Wybierz unikalną nazwę.`
          : `A task named "${trimmedName}" already exists. Please choose a unique name.`
      );
      setActiveTab('general');
      return;
    }
    setNameError(null);

    const payload: Task = {
      id: initialTask ? initialTask.id : generateUUID(),
      taskNumber: initialTask?.taskNumber,
      name: trimmedName,
      description: description.trim(),
      tags,
      engine,
      type,
      rsyncFlagsMode: engine === 'rsync' ? rsyncFlagsMode : undefined,
      pairs: validPairs,
      customFlags: customFlags.trim(),
      scheduleEnabled,
      schedules: schedules.slice(0, 30),
      runAfterTaskId: runAfterTaskId || null,
      excludeFilters,
      restoreEnabled,
      logRetentionDays: logRetentionDays === '' ? null : Number(logRetentionDays),
      trashEnabled: type === 'mirror' ? trashEnabled : false,
      trashRetentionDays: Number(trashRetentionDays) || 14,
      oneDriveLongPathsHandling,
      notifications,
      createdAt: initialTask ? initialTask.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(payload);
  };

  const daysOfWeekLabels = [
    { num: 1, label: lang === 'pl' ? 'Pn' : 'Mon' },
    { num: 2, label: lang === 'pl' ? 'Wt' : 'Tue' },
    { num: 3, label: lang === 'pl' ? 'Śr' : 'Wed' },
    { num: 4, label: lang === 'pl' ? 'Cz' : 'Thu' },
    { num: 5, label: lang === 'pl' ? 'Pt' : 'Fri' },
    { num: 6, label: lang === 'pl' ? 'Sb' : 'Sat' },
    { num: 0, label: lang === 'pl' ? 'Nd' : 'Sun' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                {initialTask ? t.taskModal.editTitle : t.taskModal.createTitle}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {engine.toUpperCase()} • {type.toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-x-auto">
          {[
            { id: 'general', label: t.taskModal.generalTab, icon: Archive },
            { id: 'paths', label: t.taskModal.pathsTab, icon: Copy },
            { id: 'schedule', label: t.taskModal.scheduleTab, icon: Clock },
            { id: 'advanced', label: t.taskModal.advancedTab, icon: Filter },
            { id: 'notifications', label: t.taskModal.notificationsTab, icon: Bell },
            { id: 'preview', label: t.taskModal.previewTab, icon: Terminal },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-6 overflow-y-auto max-h-[calc(92vh-180px)]">
          {/* TAB: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
                  {t.taskModal.nameLabel} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  placeholder="np. Kopia bazy i załączników"
                  className={`w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:outline-none ${
                    nameError
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-neutral-300 dark:border-neutral-700 focus:ring-blue-500'
                  }`}
                />
                {nameError && (
                  <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{nameError}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
                  {t.taskModal.descLabel}
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Opcjonalny opis zawartości zadania..."
                  className="w-full px-3.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
                    {t.taskModal.engineLabel}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (engine !== 'rclone') {
                          setEngine('rclone');
                          setCustomFlags('');
                        }
                      }}
                      className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                        engine === 'rclone'
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {lang === 'pl' ? 'rclone (Chmury & Dyski)' : 'rclone (Cloud & Remotes)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (engine !== 'rsync') {
                          setEngine('rsync');
                          setCustomFlags('');
                        }
                      }}
                      className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                        engine === 'rsync'
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {lang === 'pl' ? 'rsync (Lokalne / SSH)' : 'rsync (Local / SSH)'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
                    {t.taskModal.typeLabel}
                  </label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as BackupType)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="mirror">{t.taskModal.typeMirror}</option>
                    <option value="copy">{t.taskModal.typeCopy}</option>
                    <option value="move">{t.taskModal.typeMove}</option>
                  </select>
                </div>
              </div>

              {/* RSYNC Mode: -avh vs -rtv */}
              {engine === 'rsync' && (
                <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      {lang === 'pl' ? 'Tryb flag bazowych rsync' : 'Base rsync flags mode'}
                    </span>
                    <div className="inline-flex p-0.5 rounded-lg bg-neutral-200/80 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 shrink-0">
                      <button
                        type="button"
                        onClick={() => setRsyncFlagsMode('avh')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                          rsyncFlagsMode === 'avh'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                      >
                        -avh {lang === 'pl' ? '(Archiwum z uprawnieniami)' : '(Archive with permissions)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRsyncFlagsMode('rtv')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                          rsyncFlagsMode === 'rtv'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                      >
                        -rtv {lang === 'pl' ? '(Uproszczony bez uprawnień)' : '(Simplified, no permissions)'}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    {rsyncFlagsMode === 'avh'
                      ? (lang === 'pl'
                          ? 'Tryb archiwalny (-avh): Zachowuje rekurencję podkatalogów (-r), czasy modyfikacji (-t), uprawnienia chmod (-p), właściciela/grupę chown (-o/-g) oraz dowiązania symboliczne (-l). Zalecany standard dla pełnych kopii.'
                          : 'Archive mode (-avh): Preserves directory recursion (-r), modification times (-t), chmod permissions (-p), chown owner/group (-o/-g), and symlinks (-l). Recommended standard.')
                      : (lang === 'pl'
                          ? 'Tryb uproszczony (-rtv): Kopiuje rekurencyjnie (-r) i zachowuje czasy modyfikacji (-t), ale NIE narusza uprawnień (chmod) ani właściciela/grupy (chown) w miejscu docelowym. Przydatne dla udziałów SMB/FAT32 lub gdy chcesz uniknąć zmian uprawnień.'
                          : 'Simplified mode (-rtv): Recursively copies (-r) and preserves timestamps (-t), but does NOT enforce permissions (chmod) or owner/group (chown) on destination.')
                    }
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
                  {t.taskModal.tagsLabel}
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder={lang === 'pl' ? 'Wpisz tag i naciśnij Enter...' : 'Type tag and press Enter...'}
                  className="w-full px-3.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
                  {t.taskModal.customFlagsLabel}
                </label>
                <input
                  type="text"
                  value={customFlags}
                  onChange={e => setCustomFlags(e.target.value)}
                  placeholder={t.taskModal.customFlagsHelp}
                  className="w-full px-3.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  {lang === 'pl'
                    ? <>Dla rclone np. <code className="text-blue-600 dark:text-blue-400">--transfers 4 --fast-list</code> | Dla rsync np. <code className="text-blue-600 dark:text-blue-400">-z --bwlimit=10M</code></>
                    : <>For rclone e.g. <code className="text-blue-600 dark:text-blue-400">--transfers 4 --fast-list</code> | For rsync e.g. <code className="text-blue-600 dark:text-blue-400">-z --bwlimit=10M</code></>}
                </p>
                {engine === 'rsync' && (customFlags.includes('--transfers') || customFlags.includes('--checkers') || customFlags.includes('--fast-list')) && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                      <span>
                        {lang === 'pl'
                          ? 'Wykryto flagi rclone (--transfers/--checkers), które powodują błąd w rsync.'
                          : 'Detected rclone flags (--transfers/--checkers) which cause errors in rsync.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomFlags(customFlags.replace(/--transfers(\s+|=)\d+|--checkers(\s+|=)\d+|--fast-list/g, '').replace(/\s+/g, ' ').trim())}
                      className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 font-semibold text-xs transition-colors shrink-0"
                    >
                      {lang === 'pl' ? 'Wyczyść flagi rclone' : 'Remove rclone flags'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: PATHS (Multiple pairs support) */}
          {activeTab === 'paths' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {lang === 'pl'
                      ? `Pary ścieżek Źródło ➔ Cel (${pairs.length})`
                      : `Source ➔ Destination Pairs (${pairs.length})`}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {lang === 'pl'
                      ? 'Możesz podać ścieżki zamontowane w wolumenach Docker (np. /source, /destination) lub nazwy skonfigurowanych remotes w rclone (np. gdrive:backup).'
                      : 'You can provide paths mounted in Docker volumes (e.g. /source, /destination) or configured rclone remote names (e.g. gdrive:backup).'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPair}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t.taskModal.addPair}
                </button>
              </div>

              <div className="space-y-3">
                {pairs
                  .slice(pairPage * PAIRS_PER_PAGE, pairPage * PAIRS_PER_PAGE + PAIRS_PER_PAGE)
                  .map((pair, pIdx) => {
                    const idx = pairPage * PAIRS_PER_PAGE + pIdx;
                    return (
                      <div
                        key={pair.id}
                        className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 relative group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                            {lang === 'pl' ? `Para #${idx + 1}` : `Pair #${idx + 1}`}
                          </span>
                          {pairs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePair(idx)}
                              className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              title={lang === 'pl' ? 'Usuń tę parę' : 'Remove this pair'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                {lang === 'pl' ? 'Źródło (Source)' : 'Source'}
                              </label>
                              <button
                                type="button"
                                onClick={() => openBrowserForPair(idx, 'source')}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                <FolderOpen className="w-3 h-3" />
                                <span>{lang === 'pl' ? 'Przeglądaj...' : 'Browse...'}</span>
                              </button>
                            </div>
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                required
                                value={pair.source}
                                onChange={e => handlePairChange(idx, 'source', e.target.value)}
                                placeholder={t.taskModal.sourcePlaceholder}
                                className="w-full pr-8 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => openBrowserForPair(idx, 'source')}
                                title={lang === 'pl' ? 'Wybierz katalog lokalny' : 'Browse local folder'}
                                className="absolute right-2 p-1 text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              >
                                <FolderOpen className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                {lang === 'pl' ? 'Cel (Destination)' : 'Destination'}
                              </label>
                              <button
                                type="button"
                                onClick={() => openBrowserForPair(idx, 'destination')}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                <FolderOpen className="w-3 h-3" />
                                <span>{lang === 'pl' ? 'Przeglądaj...' : 'Browse...'}</span>
                              </button>
                            </div>
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                required
                                value={pair.destination}
                                onChange={e => handlePairChange(idx, 'destination', e.target.value)}
                                placeholder={t.taskModal.destPlaceholder}
                                className="w-full pr-8 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => openBrowserForPair(idx, 'destination')}
                                title={lang === 'pl' ? 'Wybierz katalog lokalny' : 'Browse local folder'}
                                className="absolute right-2 p-1 text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              >
                                <FolderOpen className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {pairs.length > PAIRS_PER_PAGE && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {lang === 'pl'
                        ? `Strona ${pairPage + 1} z ${Math.ceil(pairs.length / PAIRS_PER_PAGE)}`
                        : `Page ${pairPage + 1} of ${Math.ceil(pairs.length / PAIRS_PER_PAGE)}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPairPage(p => Math.max(0, p - 1))}
                        disabled={pairPage === 0}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                      >
                        {lang === 'pl' ? 'Poprzednia' : 'Previous'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPairPage(p =>
                            Math.min(Math.ceil(pairs.length / PAIRS_PER_PAGE) - 1, p + 1)
                          )
                        }
                        disabled={pairPage >= Math.ceil(pairs.length / PAIRS_PER_PAGE) - 1}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                      >
                        {lang === 'pl' ? 'Następna' : 'Next'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* OneDrive Long Paths Handling Toggle (Na samym dole, domyślnie zaznaczone) */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40 flex items-center justify-between mt-4">
                <div className="pr-4">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      {lang === 'pl'
                        ? 'Obsługa długich ścieżek dla OneDrive (>400 znaków)'
                        : 'OneDrive Long Paths Support (>400 characters)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    {lang === 'pl'
                      ? 'Automatycznie wykrywa i raportuje pliki przekraczające limit 400 znaków w usłudze Microsoft OneDrive, zapobiegając niepowodzeniu całego zadania i oznaczając ostrzeżenie.'
                      : 'Automatically detects and logs files exceeding Microsoft OneDrive 400-char path limit, preventing whole job crash and flagging as warning.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={oneDriveLongPathsHandling}
                    onChange={e => setOneDriveLongPathsHandling(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* TAB: SCHEDULE & CHAINING */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              {/* Schedule master toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {t.taskModal.enableSchedule}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {t.taskModal.scheduleHelp}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={e => setScheduleEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Schedules list (up to 30) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    {lang === 'pl'
                      ? `Zdefiniowane harmonogramy (${schedules.length}/30)`
                      : `Defined Schedules (${schedules.length}/30)`}
                  </span>
                  {schedules.length < 30 && (
                    <button
                      type="button"
                      onClick={handleAddSchedule}
                      className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t.taskModal.addScheduleRule}
                    </button>
                  )}
                </div>

                {schedules.length === 0 ? (
                  <div className="p-4 text-center rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-xs text-neutral-500">
                    {lang === 'pl'
                      ? 'Brak zdefiniowanych reguł czasowych. Kliknij "Dodaj regułę czasową" powyżej.'
                      : 'No schedule rules defined. Click "Add schedule rule" above.'}
                  </div>
                ) : (
                  schedules.slice(schedulePage * SCHEDULES_PER_PAGE, schedulePage * SCHEDULES_PER_PAGE + SCHEDULES_PER_PAGE).map((sch) => {
                    const sIdx = schedules.findIndex(s => s.id === sch.id);
                    return (
                    <div
                      key={sch.id}
                      className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-neutral-400">#{sIdx + 1}</span>
                          <select
                            value={sch.type}
                            onChange={e => handleScheduleChange(sch.id, { type: e.target.value as any })}
                            className="px-2.5 py-1 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white"
                          >
                            <option value="daily">{t.taskModal.scheduleDaily}</option>
                            <option value="weekly">{t.taskModal.scheduleWeekly}</option>
                            <option value="monthly">{t.taskModal.scheduleMonthly}</option>
                            <option value="interval">{t.taskModal.scheduleInterval}</option>
                            <option value="once">{t.taskModal.scheduleOnce}</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSchedule(sch.id)}
                          className="p-1 text-neutral-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div>
                          <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                            {sch.type === 'interval'
                              ? (lang === 'pl' ? 'Co ile (hh:mm)' : 'Every (hh:mm)')
                              : (lang === 'pl' ? 'Godzina (hh:mm)' : 'Time (hh:mm)')}
                          </label>
                          <input
                            type="time"
                            value={sch.time}
                            onChange={e => handleScheduleChange(sch.id, { time: e.target.value })}
                            className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono text-neutral-900 dark:text-white"
                          />
                        </div>

                        {sch.type === 'interval' && (
                          <div className="col-span-1 sm:col-span-2">
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                              {t.taskModal.scheduleIntervalHelp}
                            </p>
                            {computeIntervalTimes(sch.time).length > 0 && (
                              <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                                {lang === 'pl' ? 'Godziny uruchomienia:' : 'Run times:'}{' '}
                                <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
                                  {computeIntervalTimes(sch.time).join(', ')}
                                </span>
                              </p>
                            )}
                          </div>
                        )}

                        {sch.type === 'once' && (
                          <div>
                            <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                              {lang === 'pl' ? 'Data wykonania (YYYY-MM-DD)' : 'Execution Date (YYYY-MM-DD)'}
                            </label>
                            <input
                              type="date"
                              value={sch.date || ''}
                              onChange={e => handleScheduleChange(sch.id, { date: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono text-neutral-900 dark:text-white"
                            />
                          </div>
                        )}

                        {sch.type === 'monthly' && (
                          <div className="col-span-1 sm:col-span-2 pt-1 border-t border-neutral-100 dark:border-neutral-700/60">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                                {lang === 'pl' ? 'Dni miesiąca (wybierz od 1 do 31):' : 'Days of month (select from 1 to 31):'}
                              </label>
                              <div className="flex items-center gap-1 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setBulkDaysOfMonth(sch.id, [1])}
                                  className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300"
                                >
                                  {lang === 'pl' ? '1. dzień' : '1st day'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBulkDaysOfMonth(sch.id, [1, 15])}
                                  className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300"
                                >
                                  {lang === 'pl' ? '1. i 15.' : '1st & 15th'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBulkDaysOfMonth(sch.id, [28, 29, 30, 31])}
                                  className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300"
                                >
                                  {lang === 'pl' ? 'Koniec m-ca' : 'Month end'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBulkDaysOfMonth(sch.id, Array.from({ length: 31 }, (_, i) => i + 1))}
                                  className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300"
                                >
                                  {lang === 'pl' ? 'Wszystkie' : 'All'}
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-7 sm:grid-cols-11 md:grid-cols-16 gap-1">
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                                const activeDays = sch.daysOfMonth || (sch.dayOfMonth ? [sch.dayOfMonth] : [1]);
                                const isSelected = activeDays.includes(day);
                                return (
                                  <button
                                    type="button"
                                    key={day}
                                    onClick={() => toggleDayOfMonth(sch.id, day)}
                                    className={`py-1 text-xs font-mono font-medium rounded transition-colors ${
                                      isSelected
                                        ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/20'
                                        : 'bg-neutral-100 dark:bg-neutral-700/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                                    }`}
                                  >
                                    {day}
                                  </button>
                                );
                              })}
                            </div>

                            <p className="mt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                              {lang === 'pl' ? 'Wybrane dni:' : 'Selected days:'}{' '}
                              <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
                                {(sch.daysOfMonth || (sch.dayOfMonth ? [sch.dayOfMonth] : [1])).join(', ')}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>

                      {sch.type === 'weekly' && (
                        <div>
                          <label className="block text-[11px] font-medium text-neutral-500 mb-1.5">
                            {lang === 'pl' ? 'Dni tygodnia:' : 'Days of week:'}
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {daysOfWeekLabels.map(d => {
                              const isChecked = (sch.daysOfWeek || []).includes(d.num);
                              return (
                                <button
                                  type="button"
                                  key={d.num}
                                  onClick={() => toggleDayOfWeek(sch.id, d.num)}
                                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                    isChecked
                                      ? 'bg-blue-600 text-white font-bold'
                                      : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                                  }`}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })
                )}

                {schedules.length > SCHEDULES_PER_PAGE && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {lang === 'pl'
                        ? `Strona ${schedulePage + 1} z ${Math.ceil(schedules.length / SCHEDULES_PER_PAGE)}`
                        : `Page ${schedulePage + 1} of ${Math.ceil(schedules.length / SCHEDULES_PER_PAGE)}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSchedulePage(p => Math.max(0, p - 1))}
                        disabled={schedulePage === 0}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      >
                        {lang === 'pl' ? 'Poprzednia' : 'Previous'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSchedulePage(p =>
                            Math.min(Math.ceil(schedules.length / SCHEDULES_PER_PAGE) - 1, p + 1)
                          )
                        }
                        disabled={schedulePage >= Math.ceil(schedules.length / SCHEDULES_PER_PAGE) - 1}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      >
                        {lang === 'pl' ? 'Następna' : 'Next'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Chaining: "możliwość ustawienia uruchom po zakończeniu innego zadania" */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  {t.taskModal.runAfterLabel}
                </label>
                <select
                  value={runAfterTaskId || ''}
                  onChange={e => setRunAfterTaskId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">{t.taskModal.runAfterNone}</option>
                  {existingTasks
                    .filter(t => !initialTask || t.id !== initialTask.id)
                    .map((t, idx) => (
                      <option key={t.id} value={t.id}>
                        [#{t.taskNumber ?? idx + 1}] {t.name} ({t.engine} • {t.type})
                      </option>
                    ))}
                </select>
                <p className="text-xs text-neutral-500">
                  {lang === 'pl'
                    ? 'Gdy wybrane nadrzędne zadanie zakończy się sukcesem, to zadanie zostanie automatycznie uruchomione w kolejce.'
                    : 'When the selected parent task completes successfully, this task will be triggered automatically.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB: ADVANCED (Filters, Trash, Restore toggle, Retention) */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              {/* Exclude filters in matching frame */}
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {t.taskModal.filtersLabel}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {t.taskModal.filtersHelp}
                  </p>
                </div>

                {excludeFilters.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {excludeFilters.map(f => (
                      <span
                        key={f}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-xs bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 shadow-2xs"
                      >
                        {f}
                        <button
                          type="button"
                          onClick={() => handleRemoveFilter(f)}
                          className="text-neutral-400 hover:text-rose-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={filterInput}
                    onChange={e => setFilterInput(e.target.value)}
                    onKeyDown={handleAddFilter}
                    placeholder={lang === 'pl' ? 'np. *.tmp, *.bak, cache/, .git/ (wpisz i naciśnij Enter)' : 'e.g. *.tmp, *.bak, cache/, .git/ (type & press Enter)'}
                    className="flex-1 px-3.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (filterInput.trim()) {
                        const val = filterInput.trim();
                        if (!excludeFilters.includes(val)) {
                          setExcludeFilters([...excludeFilters, val]);
                        }
                        setFilterInput('');
                      }
                    }}
                    className="px-3.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-200 shrink-0 transition-colors"
                  >
                    {lang === 'pl' ? 'Dodaj' : 'Add'}
                  </button>
                </div>
              </div>

              {/* Trash & Retention */}
              {type === 'mirror' && (
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                        {t.taskModal.trashToggle}
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {t.taskModal.trashHelp}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={trashEnabled}
                        onChange={e => setTrashEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {trashEnabled && (
                    <div className="pt-2">
                      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                        {t.taskModal.trashDays}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={trashRetentionDays}
                        onChange={e => setTrashRetentionDays(parseInt(e.target.value, 10) || 14)}
                        className="w-32 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-mono text-neutral-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Restore capability toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {t.taskModal.restoreToggle}
                  </h4>
                  <p className="text-xs text-neutral-500">
                    {lang === 'pl'
                      ? 'Umożliwia przywrócenie danych (kierunek Cel ➔ Źródło) przez uprawnionych użytkowników.'
                      : 'Allows restoring data (Destination ➔ Source) by authorized users.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreEnabled}
                    onChange={e => setRestoreEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Log retention in matching frame */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {t.taskModal.logDays}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {lang === 'pl'
                      ? 'Puste pole = zastosuj globalne ustawienie retencji; 0 = usuwaj logi natychmiast po zakończeniu zadania.'
                      : 'Empty = apply global retention settings; 0 = prune logs immediately after task completion.'}
                  </p>
                </div>
                <div className="w-full sm:w-64 shrink-0 relative">
                  <input
                    type="number"
                    min={0}
                    max={3650}
                    value={logRetentionDays}
                    onChange={e => setLogRetentionDays(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    placeholder={lang === 'pl' ? 'Domyślne z Ustawień' : 'Default from Settings'}
                    className="w-full pl-3 pr-12 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-neutral-400 dark:text-neutral-500 font-medium pointer-events-none">
                    {lang === 'pl' ? 'dni' : 'days'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40">
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {lang === 'pl' ? 'Powiadomienia dla tego zadania' : 'Task Notifications'}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {lang === 'pl'
                      ? 'Wysyłaj alerty po zakończeniu lub wystąpieniu błędu.'
                      : 'Send notifications upon completion or failure.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.enabled}
                    onChange={e => setNotifications({ ...notifications, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {notifications.enabled && (
                <div className="space-y-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
                      {lang === 'pl' ? 'Warunek wysłania' : 'Trigger Condition'}
                    </label>
                    <select
                      value={notifications.trigger}
                      onChange={e => setNotifications({ ...notifications, trigger: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
                    >
                      <option value="all" className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">
                        {lang === 'pl' ? 'Wszystkie stany (sukces, błąd, zatrzymanie)' : 'All events (success, error, stopped)'}
                      </option>
                      <option value="error" className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">
                        {lang === 'pl' ? 'Tylko w przypadku błędu (Error only)' : 'On Error only'}
                      </option>
                      <option value="success" className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">
                        {lang === 'pl' ? 'Tylko w przypadku sukcesu (Success only)' : 'On Success only'}
                      </option>
                    </select>

                    {/* Generowanie raportów CSV: Wysłane i Usunięte */}
                    <div className="mt-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                          {lang === 'pl' ? 'Generowanie plików CSV (przed uruchomieniem - dry-run):' : 'Generate CSV files (pre-run dry-run):'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2.5">
                        {lang === 'pl'
                          ? 'Wykonuje dry-run (verbose/itemized) i zapisuje raporty CSV w data/files/<id_nazwa>/ (ścieżka, waga, data modyfikacji mtime, status OK/TMP/ERR).'
                          : 'Performs dry-run (verbose/itemized) and saves CSV reports in data/files/<id_name>/ (path, size, mtime, status OK/TMP/ERR).'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <label className="flex items-center gap-2.5 p-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
                          <input
                            type="checkbox"
                            checked={notifications.csvReportSent !== false}
                            onChange={e => setNotifications({ ...notifications, csvReportSent: e.target.checked })}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white block">
                              {lang === 'pl' ? 'Wysłane' : 'Sent'}
                            </span>
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              {lang === 'pl' ? 'Plik CSV z wysyłanymi plikami' : 'CSV with sent files'}
                            </span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
                          <input
                            type="checkbox"
                            checked={notifications.csvReportDeleted !== false}
                            onChange={e => setNotifications({ ...notifications, csvReportDeleted: e.target.checked })}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white block">
                              {lang === 'pl' ? 'Usunięte' : 'Deleted'}
                            </span>
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              {lang === 'pl' ? 'Plik CSV z usuwanymi plikami' : 'CSV with deleted files'}
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                    {/* Kanały powiadomień skonstruowane w taką samą ramkę jak Generowanie CSV */}
                    <div className="mt-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Bell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                          {lang === 'pl' ? 'Kanały powiadomień:' : 'Notification Channels:'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2.5">
                        {lang === 'pl'
                          ? 'Wybierz kanały zewnętrzne, do których mają być wysyłane raporty po wykonaniu zadania.'
                          : 'Select external notification channels to deliver execution reports for this task.'}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* Discord */}
                        <label className={`flex items-center gap-2.5 p-2 rounded-md border cursor-pointer transition-colors ${
                          notifications.discord
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                            : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-blue-400 dark:hover:border-blue-600'
                        }`}>
                          <input
                            type="checkbox"
                            checked={!!notifications.discord}
                            onChange={e => setNotifications({ ...notifications, discord: e.target.checked })}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white block">
                              Discord
                            </span>
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              Webhook Discord
                            </span>
                          </div>
                        </label>

                        {/* ntfy.sh */}
                        <label className={`flex items-center gap-2.5 p-2 rounded-md border cursor-pointer transition-colors ${
                          notifications.ntfy
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                            : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-blue-400 dark:hover:border-blue-600'
                        }`}>
                          <input
                            type="checkbox"
                            checked={!!notifications.ntfy}
                            onChange={e => setNotifications({ ...notifications, ntfy: e.target.checked })}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white block">
                              ntfy.sh
                            </span>
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              Push topic
                            </span>
                          </div>
                        </label>

                        {/* E-mail (SMTP) */}
                        <label className={`flex items-center gap-2.5 p-2 rounded-md border cursor-pointer transition-colors ${
                          notifications.email
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                            : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-blue-400 dark:hover:border-blue-600'
                        }`}>
                          <input
                            type="checkbox"
                            checked={!!notifications.email}
                            onChange={e => setNotifications({ ...notifications, email: e.target.checked })}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white block">
                              E-mail (SMTP)
                            </span>
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              Raport pocztowy
                            </span>
                          </div>
                        </label>
                      </div>

                      {notifications.email && (
                        <div className="mt-3 pt-2.5 border-t border-neutral-200/80 dark:border-neutral-700/80 space-y-1">
                          <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                            {lang === 'pl' ? 'Wysyłanie pliku logów w załączniku E-mail' : 'Email Log Attachment Policy'}
                          </label>
                          <select
                            value={notifications.emailLogAttachment || 'error'}
                            onChange={e =>
                              setNotifications({
                                ...notifications,
                                emailLogAttachment: e.target.value as any,
                              })
                            }
                            className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="error">{lang === 'pl' ? 'Tylko błąd (Domyślne)' : 'Error only (Default)'}</option>
                            <option value="error_warning">{lang === 'pl' ? 'Błąd i ostrzeżenie (Warning)' : 'Error and Warning'}</option>
                            <option value="warning">{lang === 'pl' ? 'Tylko ostrzeżenie (Warning)' : 'Warning only'}</option>
                            <option value="success">{lang === 'pl' ? 'Tylko sukces' : 'Success only'}</option>
                            <option value="always">{lang === 'pl' ? 'Zawsze (do każdej wiadomości)' : 'Always (every email)'}</option>
                            <option value="never">{lang === 'pl' ? 'Nigdy (bez załącznika logów)' : 'Never (no logs attached)'}</option>
                          </select>
                        </div>
                      )}
                    </div>

                </div>
              )}
            </div>
          )}

          {/* TAB: COMMAND PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {lang === 'pl' ? 'Podgląd uruchamianej komendy w systemie' : 'System Command Preview'}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {lang === 'pl'
                      ? 'Oto dokładna postać poleceń, które wykona kontener dla każdej pary.'
                      : 'Exact system command strings that will be executed by the container for each pair.'}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('backup')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      previewMode === 'backup'
                        ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-neutral-500'
                    }`}
                  >
                    {lang === 'pl' ? 'Kopia (Backup)' : 'Backup'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('restore')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      previewMode === 'restore'
                        ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-neutral-500'
                    }`}
                  >
                    {lang === 'pl' ? 'Przywracanie (Restore)' : 'Restore'}
                  </button>
                </div>
              </div>

              {previewCommands.length === 0 ? (
                <div className="p-4 text-xs text-neutral-500 dark:text-neutral-400">
                  {lang === 'pl'
                    ? 'Uzupełnij przynajmniej jedno źródło i cel, aby wygenerować komendę.'
                    : 'Fill in at least one source and destination to generate command preview.'}
                </div>
              ) : (
                previewCommands.map((cmd, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl bg-neutral-950 text-neutral-100 p-4 font-mono text-xs border border-neutral-800 shadow-inner overflow-x-auto"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800 text-[11px] text-neutral-400">
                      <span>
                        {lang === 'pl'
                          ? `Polecenie #${idx + 1} (${previewMode === 'restore' ? 'ODWRÓCONE CEL ➔ ŹRÓDŁO' : 'ŹRÓDŁO ➔ CEL'})`
                          : `Command #${idx + 1} (${previewMode === 'restore' ? 'REVERSED DEST ➔ SRC' : 'SRC ➔ DEST'})`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCommand(cmd, idx)}
                        className="flex items-center gap-1 text-neutral-400 hover:text-white"
                      >
                        {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedIndex === idx ? (lang === 'pl' ? 'Skopiowano!' : 'Copied!') : (lang === 'pl' ? 'Kopiuj' : 'Copy')}</span>
                      </button>
                    </div>
                    <code className="text-emerald-400 break-all whitespace-pre-wrap">{cmd}</code>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
          >
            {t.common.save}
          </button>
        </div>
      </div>

      {/* Directory / File Browser Modal */}
      <DirectoryBrowserModal
        isOpen={browserState.isOpen}
        onClose={() => setBrowserState(prev => ({ ...prev, isOpen: false }))}
        onSelect={handleBrowserSelect}
        initialPath={browserState.initialPath}
        lang={lang}
        title={
          browserState.field === 'source'
            ? (lang === 'pl' ? 'Wybierz katalog źródłowy (Source)' : 'Select Source Directory')
            : (lang === 'pl' ? 'Wybierz katalog docelowy (Destination)' : 'Select Destination Directory')
        }
      />
    </div>
  );
};
