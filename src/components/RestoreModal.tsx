import React, { useState, useEffect } from 'react';
import { X, RotateCcw, AlertTriangle, Terminal, CheckSquare, Square, KeyRound, Eye, EyeOff } from 'lucide-react';
import { Task, User } from '../types.ts';
import { Language, translations } from '../i18n.ts';
import { api } from '../api.ts';

interface RestoreModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  currentUser?: User | null;
  onConfirmRestore: (taskId: string, selectedPairIds?: string[], password?: string) => Promise<void> | void;
}

export const RestoreModal: React.FC<RestoreModalProps> = ({
  lang,
  isOpen,
  onClose,
  task,
  currentUser,
  onConfirmRestore,
}) => {
  const t = translations[lang];
  const [selectedPairIds, setSelectedPairIds] = useState<string[]>([]);
  const [previewCommands, setPreviewCommands] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [operatorPassword, setOperatorPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const isOperator = currentUser?.role !== 'admin';

  // Reset loading state and initialize pairs whenever modal opens or task changes
  useEffect(() => {
    if (isOpen) {
      setLoading(false);
      setOperatorPassword('');
      setShowPassword(false);
      setPasswordError(null);
      if (task) {
        setSelectedPairIds(task.pairs.map(p => p.id));
      }
    } else {
      setLoading(false);
      setOperatorPassword('');
      setPasswordError(null);
    }
  }, [task, isOpen]);

  useEffect(() => {
    if (task && selectedPairIds.length > 0) {
      api
        .previewCommand(task, 'restore', selectedPairIds)
        .then(res => setPreviewCommands(res.commands))
        .catch(() => {});
    } else {
      setPreviewCommands([]);
    }
  }, [task, selectedPairIds]);

  if (!isOpen || !task) return null;

  const handleClose = () => {
    setLoading(false);
    setOperatorPassword('');
    setPasswordError(null);
    onClose();
  };

  const togglePair = (pairId: string) => {
    if (selectedPairIds.includes(pairId)) {
      if (selectedPairIds.length > 1) {
        setSelectedPairIds(selectedPairIds.filter(id => id !== pairId));
      }
    } else {
      setSelectedPairIds([...selectedPairIds, pairId]);
    }
  };

  const selectAll = () => {
    setSelectedPairIds(task.pairs.map(p => p.id));
  };

  const handleExecute = async () => {
    if (!task) return;
    if (isOperator && !operatorPassword.trim()) {
      setPasswordError(t.restoreModal.passwordRequired || 'Hasło operatora jest wymagane.');
      return;
    }

    try {
      setLoading(true);
      setPasswordError(null);
      const pairsToPass = selectedPairIds.length === task.pairs.length ? undefined : selectedPairIds;
      await onConfirmRestore(task.id, pairsToPass, isOperator ? operatorPassword : undefined);
    } catch (err: any) {
      setPasswordError(err.message || 'Błąd autoryzacji');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                {t.restoreModal.title}
              </h2>
              <p className="text-xs text-neutral-500">
                Zadanie: <span className="font-semibold">{task.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Warning banner */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <p className="font-bold mb-1">{t.restoreModal.directionNotice}</p>
              <p>{t.restoreModal.warningNotice}</p>
            </div>
          </div>

          {/* Pairs selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                {t.restoreModal.selectPairsLabel}
              </label>
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {t.restoreModal.allPairs}
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {task.pairs.map(pair => {
                const isSelected = selectedPairIds.includes(pair.id);
                return (
                  <div
                    key={pair.id}
                    onClick={() => togglePair(pair.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4 text-neutral-400" />
                      )}
                      <div className="text-xs">
                        <div className="font-mono text-neutral-500 line-through">
                          Źródło: {pair.source}
                        </div>
                        <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          Nowy kierunek: {pair.destination} ➔ {pair.source}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reverse Command Preview */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>Podgląd komendy przywracania:</span>
            </div>
            <div className="p-3 rounded-xl bg-neutral-950 text-neutral-100 font-mono text-xs border border-neutral-800 max-h-32 overflow-x-auto">
              {previewCommands.map((cmd, idx) => (
                <div key={idx} className="text-emerald-400 break-all mb-1">
                  {cmd}
                </div>
              ))}
            </div>
          </div>

          {/* Operator Password Authorization Box (Mandatory for non-admin) */}
          {isOperator && (
            <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{t.restoreModal.operatorPasswordLabel || 'Autoryzacja hasłem (wymagane dla Operatora)'}</span>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                {t.restoreModal.operatorPasswordDesc || 'Wprowadź swoje hasło użytkownika, aby potwierdzić i autoryzować procedurę przywracania danych (RESTORE).'}
              </p>
              <div className="relative mt-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={operatorPassword}
                  onChange={e => {
                    setOperatorPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleExecute();
                    }
                  }}
                  placeholder={t.restoreModal.operatorPasswordPlaceholder || 'Wpisz swoje hasło...'}
                  className={`w-full pl-3 pr-10 py-2 text-xs rounded-lg border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 ${
                    passwordError
                      ? 'border-rose-500 focus:ring-rose-500/20'
                      : 'border-neutral-300 dark:border-neutral-700 focus:ring-amber-500/20 focus:border-amber-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={loading || selectedPairIds.length === 0 || (isOperator && !operatorPassword.trim())}
            className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? t.common.loading : t.restoreModal.executeRestore}
          </button>
        </div>
      </div>
    </div>
  );
};
