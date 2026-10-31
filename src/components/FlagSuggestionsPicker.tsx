import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  Plus,
  Info,
  X,
  Terminal,
  BookOpen,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  FLAG_SUGGESTIONS,
  CATEGORY_LABELS,
  FlagSuggestion,
} from '../data/flagSuggestions.ts';
import { api } from '../api.ts';
import { Language } from '../i18n.ts';

interface SystemFlagItem {
  flag: string;
  flagBase: string;
  short?: string;
  paramPlaceholder?: string;
  description: string;
  isDangerous?: boolean;
}

interface FlagSuggestionsPickerProps {
  engine: 'rclone' | 'rsync';
  customFlags: string;
  onFlagsChange: (newFlags: string) => void;
  lang: Language;
}

export const FlagSuggestionsPicker: React.FC<FlagSuggestionsPickerProps> = ({
  engine,
  customFlags,
  onFlagsChange,
  lang,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'curated' | 'system'>('curated');

  // State for dynamic system help flags
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemAvailable, setSystemAvailable] = useState<boolean | null>(null);
  const [systemVersion, setSystemVersion] = useState<string | undefined>(undefined);
  const [systemFlags, setSystemFlags] = useState<SystemFlagItem[]>([]);

  // Filter curated flags matching active engine
  const engineFlags = useMemo(() => {
    return FLAG_SUGGESTIONS.filter(
      f => f.engine === engine || f.engine === 'both'
    );
  }, [engine]);

  // Popular quick flags for immediate one-click addition
  const popularFlags = useMemo(() => {
    return engineFlags.filter(f => f.isPopular);
  }, [engineFlags]);

  // Fetch dynamic system help flags when switching to 'system' mode or when engine changes
  const fetchSystemFlags = async () => {
    setSystemLoading(true);
    try {
      const res = await api.getSystemFlagsHelp(engine);
      setSystemAvailable(res.available);
      setSystemVersion(res.version);
      setSystemFlags(res.flags || []);
    } catch (e) {
      console.error('Error fetching system help flags:', e);
      setSystemAvailable(false);
      setSystemFlags([]);
    } finally {
      setSystemLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && viewMode === 'system') {
      fetchSystemFlags();
    }
  }, [isOpen, viewMode, engine]);

  // Helper: check if a flag or its base is currently active in customFlags
  const isFlagActive = (flagString: string, flagBase: string): boolean => {
    const trimmed = customFlags.trim();
    if (!trimmed) return false;

    const words = trimmed.split(/\s+/);
    return words.some(w => {
      const wBase = w.split('=')[0];
      return (
        w === flagString ||
        wBase === flagBase ||
        w === flagBase
      );
    });
  };

  // Toggle flag: append or remove
  const handleToggleFlag = (flagString: string, flagBase: string) => {
    const active = isFlagActive(flagString, flagBase);
    let current = customFlags.trim();

    if (active) {
      // Remove flag and potential trailing value
      const words = current.split(/\s+/);
      const newWords: string[] = [];
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const wBase = w.split('=')[0];
        if (
          w === flagString ||
          wBase === flagBase ||
          w === flagBase
        ) {
          // If flag takes a value separated by space, skip next word too
          if (
            flagString.includes(' ') &&
            i + 1 < words.length &&
            !words[i + 1].startsWith('-')
          ) {
            i++;
          }
          continue;
        }
        newWords.push(w);
      }
      onFlagsChange(newWords.join(' '));
    } else {
      // Add flag cleanly
      if (current.length === 0) {
        onFlagsChange(flagString);
      } else {
        onFlagsChange(`${current} ${flagString}`);
      }
    }
  };

  // Filter curated flags
  const filteredCuratedFlags = useMemo(() => {
    let list = engineFlags;

    if (selectedCategory !== 'all') {
      list = list.filter(f => f.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(f => {
        const flagMatch = f.flag.toLowerCase().includes(q);
        const nameMatch = f.flagBase.toLowerCase().includes(q);
        const descMatch =
          lang === 'pl'
            ? f.descPl.toLowerCase().includes(q) || f.labelPl.toLowerCase().includes(q)
            : f.descEn.toLowerCase().includes(q) || f.labelEn.toLowerCase().includes(q);
        return flagMatch || nameMatch || descMatch;
      });
    }

    return list;
  }, [engineFlags, selectedCategory, searchQuery, lang]);

  // Filter system flags
  const filteredSystemFlags = useMemo(() => {
    if (!systemFlags || systemFlags.length === 0) return [];
    if (!searchQuery.trim()) return systemFlags;

    const q = searchQuery.toLowerCase().trim();
    return systemFlags.filter(f => {
      const flagMatch = f.flag.toLowerCase().includes(q);
      const baseMatch = f.flagBase.toLowerCase().includes(q);
      const shortMatch = f.short ? f.short.toLowerCase().includes(q) : false;
      const descMatch = f.description.toLowerCase().includes(q);
      return flagMatch || baseMatch || shortMatch || descMatch;
    });
  }, [systemFlags, searchQuery]);

  return (
    <div className="mt-2 space-y-2">
      {/* Quick popular suggestions bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>{lang === 'pl' ? 'Częste flagi:' : 'Popular flags:'}</span>
        </span>

        {popularFlags.map(suggestion => {
          const active = isFlagActive(suggestion.flag, suggestion.flagBase);
          return (
            <button
              key={suggestion.flag}
              type="button"
              onClick={() => handleToggleFlag(suggestion.flag, suggestion.flagBase)}
              title={lang === 'pl' ? suggestion.descPl : suggestion.descEn}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-all cursor-pointer ${
                active
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500'
                  : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
              }`}
            >
              {active ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 text-neutral-400" />}
              <span>{lang === 'pl' ? suggestion.labelPl : suggestion.labelEn}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
        >
          <span>
            {isOpen
              ? (lang === 'pl' ? 'Zwiń katalog' : 'Close catalog')
              : (lang === 'pl'
                  ? `Katalog flag (${engineFlags.length} opisanych / pełny help)...`
                  : `Flags catalog (${engineFlags.length} curated / full help)...`)}
          </span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Catalog Drawer */}
      {isOpen && (
        <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/90 dark:bg-neutral-900/90 backdrop-blur-sm space-y-3 transition-all animate-in fade-in duration-150">
          
          {/* Top Mode Switch: Curated Polish Catalog vs Full System --help */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pb-2 border-b border-neutral-200/80 dark:border-neutral-800">
            <div className="inline-flex rounded-lg bg-neutral-200 dark:bg-neutral-800 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('curated')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'curated'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                <span>{lang === 'pl' ? 'Katalog z polskim opisem' : 'Curated catalog (PL/EN)'}</span>
                <span className="text-[10px] px-1 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-500">
                  {engineFlags.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('system')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'system'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                <span>{lang === 'pl' ? `Wszystkie z help (${engine})` : `All from ${engine} --help`}</span>
                {systemFlags.length > 0 && (
                  <span className="text-[10px] px-1 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    {systemFlags.length}
                  </span>
                )}
              </button>
            </div>

            {viewMode === 'system' && (
              <button
                type="button"
                onClick={fetchSystemFlags}
                disabled={systemLoading}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                title={lang === 'pl' ? 'Odśwież flagi z systemu' : 'Refresh from system'}
              >
                <RefreshCw className={`w-3 h-3 ${systemLoading ? 'animate-spin' : ''}`} />
                <span>{lang === 'pl' ? 'Odśwież z kontenera' : 'Refresh'}</span>
              </button>
            )}
          </div>

          {/* Controls: Search + Category Filters (for curated) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {/* Search box */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  viewMode === 'curated'
                    ? (lang === 'pl'
                        ? `Szukaj flagi ${engine.toUpperCase()} (np. checksum, limit, ram, wątki)...`
                        : `Search ${engine.toUpperCase()} flags (e.g. checksum, limit, ram, threads)...`)
                    : (lang === 'pl'
                        ? `Filtruj pełną listę ${engine} --help...`
                        : `Filter all ${engine} --help flags...`)
                }
                className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Category selector for Curated Mode */}
            {viewMode === 'curated' && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  {lang === 'pl' ? 'Wszystkie' : 'All'}
                </button>
                {(Object.keys(CATEGORY_LABELS) as Array<FlagSuggestion['category']>).map(catKey => (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedCategory(catKey)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      selectedCategory === catKey
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    {lang === 'pl' ? CATEGORY_LABELS[catKey].pl : CATEGORY_LABELS[catKey].en}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* VIEW MODE 1: CURATED FLAGS WITH POLISH DESCRIPTIONS */}
          {viewMode === 'curated' && (
            <>
              <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 px-0.5">
                <span>
                  {lang === 'pl'
                    ? `Wyświetlane flagi: ${filteredCuratedFlags.length} z ${engineFlags.length}`
                    : `Showing flags: ${filteredCuratedFlags.length} of ${engineFlags.length}`}
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {filteredCuratedFlags.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                    {lang === 'pl'
                      ? 'Nie znaleziono flag spełniających kryteria wyszukiwania.'
                      : 'No flags match the search criteria.'}
                  </div>
                ) : (
                  filteredCuratedFlags.map(suggestion => {
                    const active = isFlagActive(suggestion.flag, suggestion.flagBase);
                    return (
                      <div
                        key={suggestion.flag}
                        onClick={() => handleToggleFlag(suggestion.flag, suggestion.flagBase)}
                        className={`flex items-start justify-between gap-3 p-2 rounded-lg border transition-all cursor-pointer ${
                          active
                            ? 'border-blue-500/60 bg-blue-500/10 dark:bg-blue-950/30'
                            : 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <code className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100">
                              {suggestion.flag}
                            </code>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400">
                              {lang === 'pl'
                                ? CATEGORY_LABELS[suggestion.category].pl
                                : CATEGORY_LABELS[suggestion.category].en}
                            </span>
                            {active && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <Check className="w-3 h-3" />
                                {lang === 'pl' ? 'Aktywna' : 'Active'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-snug">
                            {lang === 'pl' ? suggestion.descPl : suggestion.descEn}
                          </p>
                        </div>

                        <button
                          type="button"
                          className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors shrink-0 ${
                            active
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                          }`}
                        >
                          {active
                            ? (lang === 'pl' ? 'Usuń' : 'Remove')
                            : (lang === 'pl' ? '+ Wstaw' : '+ Insert')}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* VIEW MODE 2: RAW SYSTEM HELP FLAGS */}
          {viewMode === 'system' && (
            <>
              {systemLoading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-neutral-500 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  <span>
                    {lang === 'pl'
                      ? `Odpytywanie zainstalowanego programu ${engine} (${engine === 'rclone' ? 'rclone help flags' : 'rsync --help'})...`
                      : `Querying ${engine} help output...`}
                  </span>
                </div>
              ) : systemAvailable === false ? (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      {lang === 'pl'
                        ? `Program ${engine} nie jest zainstalowany w obecnym środowisku dev.`
                        : `${engine} is not installed in the dev environment.`}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {lang === 'pl'
                      ? `W produkcyjnym kontenerze Docker (${engine}) jest preinstalowany i w pełni dostępny. W tym środowisku możesz korzystać ze sprawdzonego "Katalogu z polskim opisem" (przełącz zakładkę powyżej).`
                      : `In production Docker, ${engine} is fully installed. You can switch to the Curated catalog tab above.`}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 px-0.5">
                    <span>
                      {lang === 'pl'
                        ? `Dostępne flagi z ${engine} (${systemVersion || 'wersja systemowa'}): ${filteredSystemFlags.length} z ${systemFlags.length}`
                        : `Flags from ${engine} help (${systemVersion || 'system'}): ${filteredSystemFlags.length} of ${systemFlags.length}`}
                    </span>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                    {filteredSystemFlags.length === 0 ? (
                      <div className="py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                        {lang === 'pl'
                          ? 'Brak flag spełniających kryteria.'
                          : 'No matching flags.'}
                      </div>
                    ) : (
                      filteredSystemFlags.map((item, idx) => {
                        const active = isFlagActive(item.flag, item.flagBase);
                        return (
                          <div
                            key={`${item.flagBase}_${idx}`}
                            onClick={() => handleToggleFlag(item.flag, item.flagBase)}
                            className={`flex items-start justify-between gap-3 p-2 rounded-lg border transition-all cursor-pointer ${
                              active
                                ? 'border-blue-500/60 bg-blue-500/10 dark:bg-blue-950/30'
                                : 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <code className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                  {item.short ? `${item.short}, ${item.flag}` : item.flag}
                                </code>
                                {item.isDangerous && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold">
                                    {lang === 'pl' ? 'Blokowana' : 'Blocked'}
                                  </span>
                                )}
                                {active && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    <Check className="w-3 h-3" />
                                    {lang === 'pl' ? 'Aktywna' : 'Active'}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-snug">
                                {item.description}
                              </p>
                            </div>

                            <button
                              type="button"
                              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors shrink-0 ${
                                active
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                              }`}
                            >
                              {active
                                ? (lang === 'pl' ? 'Usuń' : 'Remove')
                                : (lang === 'pl' ? '+ Wstaw' : '+ Insert')}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* Footer explanation */}
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 pt-1 border-t border-neutral-200/80 dark:border-neutral-800">
            <Info className="w-3.5 h-3.5 shrink-0 text-blue-500" />
            <span>
              {lang === 'pl'
                ? 'Kliknij dowolną flagę, aby dodać lub usunąć ją z pola zadania. Możesz edytować wartości bezpośrednio w polu tekstowym.'
                : 'Click any flag to toggle it. You can edit values directly in the text input.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
