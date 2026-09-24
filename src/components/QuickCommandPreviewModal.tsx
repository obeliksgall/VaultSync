import React, { useState, useEffect } from 'react';
import { X, Terminal, Copy, Check } from 'lucide-react';
import { Task } from '../types.ts';
import { api } from '../api.ts';
import { Language } from '../i18n.ts';
import { copyToClipboard } from '../utils.ts';

interface QuickCommandPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  lang: Language;
}

export const QuickCommandPreviewModal: React.FC<QuickCommandPreviewModalProps> = ({
  isOpen,
  onClose,
  task,
  lang,
}) => {
  const [mode, setMode] = useState<'backup' | 'restore'>('backup');
  const [commands, setCommands] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (task && isOpen) {
      api
        .previewCommand(task, mode)
        .then(res => setCommands(res.commands))
        .catch(() => {});
    }
  }, [task, mode, isOpen]);

  if (!isOpen || !task) return null;

  const handleCopy = async (cmd: string, idx: number) => {
    await copyToClipboard(cmd);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-neutral-950 rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden text-neutral-100 font-mono">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/90 font-sans">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {lang === 'pl' ? 'Polecenia systemowe dla:' : 'System commands for:'} {task.name}
              </h3>
              <p className="text-xs text-neutral-400">
                {lang === 'pl' ? 'Silnik' : 'Engine'}: {task.engine.toUpperCase()} • {lang === 'pl' ? 'Typ' : 'Type'}: {task.type.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-neutral-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setMode('backup')}
                className={`px-3 py-1 rounded text-xs font-semibold font-sans transition-colors ${
                  mode === 'backup' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {lang === 'pl' ? 'Kopia' : 'Backup'}
              </button>
              <button
                type="button"
                onClick={() => setMode('restore')}
                className={`px-3 py-1 rounded text-xs font-semibold font-sans transition-colors ${
                  mode === 'restore' ? 'bg-amber-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {lang === 'pl' ? 'Przywracanie' : 'Restore'}
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {commands.map((cmd, idx) => (
            <div
              key={idx}
              className="relative group rounded-xl bg-neutral-900/90 p-4 border border-neutral-800"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800/80 text-[11px] text-neutral-400 font-sans">
                <span>
                  {lang === 'pl'
                    ? `Para #${idx + 1} (${mode === 'restore' ? 'Cel ➔ Źródło' : 'Źródło ➔ Cel'})`
                    : `Pair #${idx + 1} (${mode === 'restore' ? 'Destination ➔ Source' : 'Source ➔ Destination'})`}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(cmd, idx)}
                  className="flex items-center gap-1 text-neutral-400 hover:text-white transition-colors"
                >
                  {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedIdx === idx ? (lang === 'pl' ? 'Skopiowano!' : 'Copied!') : (lang === 'pl' ? 'Kopiuj' : 'Copy')}</span>
                </button>
              </div>
              <pre className="text-emerald-400 text-xs break-all whitespace-pre-wrap font-mono">
                {cmd}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
