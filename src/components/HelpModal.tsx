import React, { useState } from 'react';
import {
  X,
  HelpCircle,
  BookOpen,
  Terminal,
  Shield,
  RotateCcw,
  Clock,
  HardDrive,
  Cloud,
  FileText,
  AlertTriangle,
  Layers,
  Search,
} from 'lucide-react';
import { Language } from '../i18n.ts';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, lang }) => {
  const [activeSection, setActiveSection] = useState<string>('quickstart');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const isPl = lang === 'pl';

  const sections = [
    {
      id: 'quickstart',
      title: isPl ? 'Szybki start i silniki' : 'Quick Start & Engines',
      icon: Terminal,
    },
    {
      id: 'modes',
      title: isPl ? 'Tryby i Bezpieczny Kosz' : 'Modes & Safe Trash',
      icon: Shield,
    },
    {
      id: 'volumes',
      title: isPl ? 'Ścieżki i Docker Volumes' : 'Paths & Docker Volumes',
      icon: HardDrive,
    },
    {
      id: 'flags',
      title: isPl ? 'Przydatne flagi CLI' : 'Useful CLI Flags',
      icon: Layers,
    },
    {
      id: 'restore',
      title: isPl ? 'Procedura Przywracania' : 'Restore Procedure',
      icon: RotateCcw,
    },
    {
      id: 'onedrive',
      title: isPl ? 'Limit 400 znaków OneDrive' : 'OneDrive 400-char Limit',
      icon: Cloud,
    },
    {
      id: 'schedules',
      title: isPl ? 'Harmonogramy i Łańcuchowanie' : 'Schedules & Chaining',
      icon: Clock,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/75 dark:bg-neutral-950/75">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                {isPl ? 'Przewodnik i Pomoc operatora SyncVault' : 'SyncVault Operator Guide & Help'}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {isPl
                  ? 'Kluczowe informacje o silnikach, składni, wolumenach i bezpiecznym przywracaniu'
                  : 'Key tips on engines, syntax, volumes, and safe recovery'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30 p-3 space-y-1 overflow-y-auto">
            {sections.map(sec => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-left transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{sec.title}</span>
                </button>
              );
            })}
          </div>

          {/* Body Section */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5 text-sm text-neutral-700 dark:text-neutral-300">
            {activeSection === 'quickstart' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  {isPl ? 'Wybór silnika: rsync vs rclone' : 'Engine selection: rsync vs rclone'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <h4 className="font-bold text-neutral-900 dark:text-white text-xs mb-1">
                      rsync (Lokalne / SSH)
                    </h4>
                    <p className="text-xs text-neutral-500 leading-relaxed mb-2">
                      {isPl
                        ? 'Dedykowany do dysków lokalnych, montowanych wolumenów kontenera (/data/sources, /data/destinations) oraz zdalnych serwerów po protokole SSH.'
                        : 'Dedicated for local storage, mapped Docker volumes (/data/sources, /data/destinations), and remote servers via SSH.'}
                    </p>
                    <div className="p-2 rounded bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono text-neutral-800 dark:text-neutral-200">
                      {isPl ? <>Ważne: ukośnik na końcu np. <code>/data/src/</code> kopiuje zawartość, a <code>/data/src</code> tworzy podfolder!</> : <>Important: trailing slash e.g. <code>/data/src/</code> copies contents, while <code>/data/src</code> creates a subdirectory!</>}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <h4 className="font-bold text-neutral-900 dark:text-white text-xs mb-1">
                      {isPl ? 'rclone (Chmury & Remote)' : 'rclone (Cloud & Remotes)'}
                    </h4>
                    <p className="text-xs text-neutral-500 leading-relaxed mb-2">
                      {isPl
                        ? 'Dedykowany do usług chmurowych: Google Drive, Microsoft OneDrive, Amazon S3, WebDAV, SFTP, Dropbox, Mega, Backblaze B2.'
                        : 'Dedicated for cloud providers: Google Drive, OneDrive, S3, WebDAV, SFTP, Dropbox, Mega, Backblaze B2.'}
                    </p>
                    <div className="p-2 rounded bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono text-neutral-800 dark:text-neutral-200">
                      {isPl ? <>Składnia zdalna: <code>remote_name:sciezka/do/katalogu</code></> : <>Remote syntax: <code>remote_name:path/to/folder</code></>}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-xs">
                  <span className="font-bold text-blue-900 dark:text-blue-300">{isPl ? 'Wskazówka operatora:' : 'Operator tip:'}</span> {isPl ? <>W widoku zadania masz przycisk <strong>Terminal ("Podgląd poleceń")</strong>, który dokładnie pokazuje wygenerowane polecenia CLI przed ich uruchomieniem!</> : <>In task actions, the <strong>Terminal ("Command Preview")</strong> button shows the exact generated CLI commands before running them!</>}
                </div>
              </div>
            )}

            {activeSection === 'modes' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {isPl ? 'Tryby operacji i Bezpieczny Kosz' : 'Operation Modes & Safe Trash'}
                </h3>
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 uppercase mb-1">
                      {isPl ? 'Mirror (Synchronizacja lustrzana)' : 'Mirror (Exact Sync)'}
                    </span>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {isPl ? (
                        <>
                          Sprawia, że cel jest dokładną kopią źródła.{' '}
                          <strong>Gdy plik zostanie skasowany w źródle:</strong> jeśli włączony jest Bezpieczny Kosz (domyślnie tak), plik nie ginie natychmiast, lecz zostaje przeniesiony do katalogu <code>_TRASH/YYYY-MM-DD</code> z automatyczną retencją (np. 14 dni).
                        </>
                      ) : (
                        <>
                          Ensures destination is an exact replica of source.{' '}
                          <strong>When a file is deleted from source:</strong> if Safe Trash is enabled (default), the file is moved to <code>_TRASH/YYYY-MM-DD</code> with configurable retention (e.g. 14 days) instead of being permanently removed.
                        </>
                      )}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 uppercase mb-1">
                      {isPl ? 'Copy (Kopiowanie przyrostowe)' : 'Copy (Incremental)'}
                    </span>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {isPl ? (
                        <>Kopiuje nowe i zmienione pliki ze źródła do celu. Pliki usunięte ze źródła <strong>nigdy</strong> nie są usuwane z celu. Najbezpieczniejsza opcja dla archiwizacji.</>
                      ) : (
                        <>Copies new and modified files from source to destination. Files deleted from source are <strong>never</strong> deleted from destination. Safest archiving mode.</>
                      )}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 uppercase mb-1">
                      {isPl ? 'Move (Przenoszenie)' : 'Move (Cut & Paste)'}
                    </span>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {isPl ? (
                        <>Kopiuje pliki do celu, a po pomyślnym transferze usuwa je ze źródła. Przydatne do czyszczenia kolejek importu lub archiwizacji comiesięcznej.</>
                      ) : (
                        <>Transfers files to destination and removes them from source after successful completion. Ideal for incoming ingest pipelines or monthly archiving.</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'volumes' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  {isPl ? 'Ścieżki i wolumeny w Dockerze' : 'Paths & Docker Volumes'}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  {isPl
                    ? 'Aplikacja SyncVault działa w kontenerze Docker. Aby mieć dostęp do danych na hoście, należy zamapować odpowiednie wolumeny w docker-compose.yml:'
                    : 'SyncVault operates inside a Docker container. Mount appropriate volumes in docker-compose.yml to expose host storage:'}
                </p>

                <div className="p-3 rounded-xl bg-neutral-950 text-neutral-200 text-xs font-mono overflow-x-auto space-y-1">
                  <p className="text-neutral-400">{isPl ? '# Przykład montowania wolumenów w docker-compose.yml:' : '# Example volume mounts in docker-compose.yml:'}</p>
                  <p>volumes:</p>
                  <p>  - /path/to/source_data:/data/sources/files:ro</p>
                  <p>  - /path/to/backup_target:/data/destinations/backup</p>
                  <p>  - ./syncvault-data:/data/config</p>
                  <p>  - ./syncvault-logs:/data/logs</p>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 text-xs space-y-1.5 border border-neutral-200 dark:border-neutral-700">
                  <p className="font-bold text-neutral-900 dark:text-white">
                    {isPl ? 'Jak wprowadzać ścieżki w SyncVault?' : 'How to enter paths in SyncVault?'}
                  </p>
                  <ul className="list-disc list-inside text-neutral-600 dark:text-neutral-300 space-y-1">
                    <li>{isPl ? <>Dla danych lokalnych: wprowadź ścieżkę z kontenera np. <code>/data/sources/files</code>.</> : <>For local storage: input container path e.g. <code>/data/sources/files</code>.</>}</li>
                    <li>{isPl ? <>Dla chmur (rclone): wprowadź nazwę skonfigurowanego remote np. <code>onedrive:Dokumenty/Projekty</code> lub <code>gdrive:Backup</code>.</> : <>For cloud (rclone): provide configured remote name e.g. <code>onedrive:Documents/Projects</code> or <code>gdrive:Backup</code>.</>}</li>
                    <li>{isPl ? <>Plik konfiguracyjny rclone: znajduje się w <code>/data/config/rclone.conf</code> i możesz edytować go bezpośrednio w zakładce <strong>Ustawienia ➔ Rclone Config</strong>.</> : <>Rclone config file: resides at <code>/data/config/rclone.conf</code> and can be managed directly under <strong>Settings ➔ Rclone Config</strong>.</>}</li>
                  </ul>
                </div>
              </div>
            )}

            {activeSection === 'flags' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  {isPl ? 'Przydatne flagi niestandardowe (Custom Flags)' : 'Useful Custom Flags'}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  {isPl
                    ? 'W polu "Dodatkowe flagi" w edycji zadania możesz wprowadzić dowolne parametry CLI przekazywane bezpośrednio do silnika:'
                    : 'In the task "Custom Flags" field, you can append any engine-specific CLI options:'}
                </p>

                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 text-xs">
                    <div className="font-mono font-bold text-blue-600 dark:text-blue-400">--dry-run</div>
                    <p className="text-neutral-600 dark:text-neutral-400 mt-0.5">
                      {isPl
                        ? 'Działa zarówno dla rclone jak i rsync. Uruchamia zadanie w trybie testowym — wykonuje pełne skanowanie i generuje raport, ale nie modyfikuje ani nie usuwa żadnych plików.'
                        : 'Supported by both rclone and rsync. Runs dry-run simulation — full traversal and metrics without modifying or deleting files.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 text-xs">
                    <div className="font-mono font-bold text-blue-600 dark:text-blue-400">--bwlimit 15M (rclone) / --bwlimit=15000 (rsync)</div>
                    <p className="text-neutral-600 dark:text-neutral-400 mt-0.5">
                      {isPl
                        ? 'Ograniczenie prędkości transferu, aby nie blokować łącza internetowego dla innych usług w firmie lub domu.'
                        : 'Rate limits network speed so backups do not saturate the local or office connection.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 text-xs">
                    <div className="font-mono font-bold text-blue-600 dark:text-blue-400">--transfers 8 --checkers 16 (rclone)</div>
                    <p className="text-neutral-600 dark:text-neutral-400 mt-0.5">
                      {isPl
                        ? 'Zwiększa liczbę równoległych transferów i wątków sprawdzających hashe plików. Znacznie przyspiesza backup tysięcy małych plików.'
                        : 'Increases parallel file transfers and checker threads, speeding up sync of large numbers of small files.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 text-xs">
                    <div className="font-mono font-bold text-blue-600 dark:text-blue-400">--fast-list (rclone)</div>
                    <p className="text-neutral-600 dark:text-neutral-400 mt-0.5">
                      {isPl
                        ? 'Używa masowego listowania katalogów w chmurach S3, Google Drive i OneDrive, zmniejszając liczbę zapytań API nawet o 90%.'
                        : 'Leverages batch directory listing for S3, Google Drive, and OneDrive, reducing API queries by up to 90%.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'restore' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  {isPl ? 'Procedura Przywracania Danych (Restore)' : 'Restore Procedure'}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {isPl
                    ? <>SyncVault posiada dedykowany moduł przywracania danych. Kliknięcie <strong>"Przywróć (Restore)"</strong> przy wybranym zadaniu otwiera okno konfiguracji odwróconego transferu:</>
                    : <>SyncVault features a safe disaster recovery module. Clicking <strong>"Restore"</strong> opens the reverse-sync configuration wizard:</>}
                </p>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] shrink-0">1</span>
                    <div>
                      <strong className="text-neutral-900 dark:text-white">{isPl ? 'Odwrócenie relacji:' : 'Vector inversion:'}</strong>
                      <p className="text-neutral-500 mt-0.5">{isPl ? 'Ścieżka Cel staje się Źródłem, a ścieżka Źródło staje się Celem przywracania.' : 'Destination becomes Source, and Source becomes Destination.'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] shrink-0">2</span>
                    <div>
                      <strong className="text-neutral-900 dark:text-white">{isPl ? 'Selektywny wybór par:' : 'Selective pair restore:'}</strong>
                      <p className="text-neutral-500 mt-0.5">{isPl ? 'Jeśli zadanie ma 5 par katalogów, nie musisz przywracać wszystkich — możesz zaznaczyć tylko ten jeden folder, który uległ awarii.' : 'If a task has multiple path pairs, you can select only the specific directory that needs recovery.'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] shrink-0">3</span>
                    <div>
                      <strong className="text-neutral-900 dark:text-white">{isPl ? 'Podgląd polecenia:' : 'Command preview:'}</strong>
                      <p className="text-neutral-500 mt-0.5">{isPl ? 'W oknie restore możesz obejrzeć dokładne polecenie, które wykona rclone lub rsync, zanim klikniesz "Potwierdź i przywróć".' : 'Verify the exact generated CLI command before confirming execution.'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'onedrive' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  {isPl ? 'Zabezpieczenie przed limitem 400 znaków w OneDrive' : 'OneDrive 400-char path protection'}
                </h3>
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{isPl ? 'Czym jest ograniczenie Microsoft OneDrive?' : 'What is the Microsoft OneDrive limitation?'}</span>
                  </div>
                  <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {isPl
                      ? <>API Microsoft OneDrive oraz SharePoint posiada twardy limit długości pełnej ścieżki pliku wynoszący <strong>400 znaków</strong> (wliczając URL i nazwę pliku). Standardowe narzędzia CLI w przypadku napotkania takiego pliku przerywają cały proces z kodem błędu.</>
                      : <>Microsoft OneDrive and SharePoint APIs enforce a strict <strong>400-character</strong> limit on total file paths (including URL components). Standard CLI tools abruptly fail when encountering such files.</>}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs space-y-2">
                  <span className="font-bold text-neutral-900 dark:text-white">{isPl ? 'Jak radzi sobie z tym SyncVault?' : 'How SyncVault handles this?'}</span>
                  <ul className="list-disc list-inside text-neutral-600 dark:text-neutral-400 space-y-1">
                    <li>{isPl ? 'SyncVault automatycznie analizuje strumień wykonania zadania dla zdalnych magazynów OneDrive.' : 'SyncVault monitors the execution stream for OneDrive remotes.'}</li>
                    <li>{isPl ? 'W przypadku wykrycia przekroczenia 400 znaków, transfer pozostałych plików jest kontynuowany bez przerywania.' : 'When a >400 char file is encountered, remaining files continue syncing without halting the job.'}</li>
                    <li>{isPl ? <>Zadanie kończy się czytelnym statusem <strong>Ostrzeżenie (Warning)</strong> zamiast błędu krytycznego.</> : <>The task finishes with a <strong>Warning</strong> status instead of a critical failure.</>}</li>
                    <li>{isPl ? 'Lista pominiętych plików ze zbyt długimi ścieżkami jest szczegółowo zapisana w logu zadania oraz dołączana do powiadomienia Discord/E-mail/ntfy.' : 'Skipped files are recorded in the job log and included in Discord/E-mail/ntfy notifications.'}</li>
                  </ul>
                </div>
              </div>
            )}

            {activeSection === 'schedules' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {isPl ? 'Harmonogramy czasowe i Łańcuchowanie (Chaining)' : 'Schedules & Chaining'}
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <h4 className="font-bold text-neutral-900 dark:text-white mb-1">
                      {isPl ? 'Do 30 reguł na zadanie' : 'Up to 30 rules per task'}
                    </h4>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      {isPl
                        ? 'Możesz skonfigurować wiele reguł: np. szybki backup codziennie o 12:00 i 18:00, oraz pełny backup w każdy piątek o 23:00 i w wybrane dni miesiąca (np. 1., 15. i 30. dzień).'
                        : 'Configure multiple rules: e.g. quick backup daily at 12:00 and 18:00, full backup every Friday at 23:00, and calendar days of the month.'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <h4 className="font-bold text-neutral-900 dark:text-white mb-1">
                      {isPl ? 'Wybór wielu dni miesiąca (1–31)' : 'Multi-day monthly selection (1–31)'}
                    </h4>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      {isPl
                        ? 'W regule miesięcznej możesz zaznaczyć dowolną liczbę dni od 1 do 31 za pomocą klikalnych kafelków kalendarza (np. początek i koniec miesiąca).'
                        : 'In monthly rules, toggle any days from 1 to 31 using interactive date pills (e.g. 1st, 15th, month end).'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <h4 className="font-bold text-neutral-900 dark:text-white mb-1">
                      {isPl ? 'Łańcuchowanie zadań (Task Chaining)' : 'Task Chaining'}
                    </h4>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      {isPl
                        ? 'W opcji "Uruchom automatycznie po pomyślnym zakończeniu innego zadania" możesz powiązać zadania w sekwencję (np. najpierw lokalny rsync z bazy danych, a zaraz po jego zakończeniu rclone do chmury).'
                        : 'Under "Run after another task completes", chain tasks in sequence (e.g. database dump rsync first, followed by cloud rclone sync upon success).'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/75 dark:bg-neutral-950/75">
          <span className="text-[11px] text-neutral-500">
            {isPl ? 'SyncVault • Bezpieczne środowisko Docker' : 'SyncVault • Secure Docker Environment'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold transition-colors"
          >
            {isPl ? 'Rozumiem, zamknij' : 'Got it, close'}
          </button>
        </div>
      </div>
    </div>
  );
};
