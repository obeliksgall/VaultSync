import React, { useState } from 'react';
import {
  HelpCircle,
  HardDrive,
  FolderSync,
  CloudCog,
  Clock,
  RotateCcw,
  Sliders,
  Bell,
  Terminal,
  AlertTriangle,
  FileText,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Layers,
  Mail,
} from 'lucide-react';
import { Language } from '../i18n.ts';

interface HelpViewProps {
  lang: Language;
}

export const HelpView: React.FC<HelpViewProps> = ({ lang }) => {
  const isPl = lang === 'pl';
  const [activeSection, setActiveSection] = useState<'quickstart' | 'docker' | 'engines' | 'scheduling' | 'restore' | 'flags' | 'troubleshooting' | 'queuing' | 'notifications'>('quickstart');

  const navItems = [
    { id: 'quickstart', label: isPl ? '1. Szybki start i obsługa' : '1. Quickstart & Workflow', icon: FolderSync },
    { id: 'docker', label: isPl ? '2. Docker i wolumeny' : '2. Docker & Volumes', icon: HardDrive },
    { id: 'engines', label: isPl ? '3. Silniki (rsync vs rclone)' : '3. Engines (rsync vs rclone)', icon: CloudCog },
    { id: 'scheduling', label: isPl ? '4. Harmonogramy (CRON)' : '4. Scheduling (CRON)', icon: Clock },
    { id: 'restore', label: isPl ? '5. Przywracanie danych (Restore)' : '5. Restore Procedure', icon: RotateCcw },
    { id: 'flags', label: isPl ? '6. Przydatne flagi i parametry' : '6. Useful Flags & Options', icon: Sliders },
    { id: 'troubleshooting', label: isPl ? '7. Rozwiązywanie problemów' : '7. Troubleshooting', icon: AlertTriangle },
    { id: 'queuing', label: isPl ? '8. Kolejkowanie i numery zadań (#ID)' : '8. Chaining & Task #IDs', icon: Layers },
    { id: 'notifications', label: isPl ? '9. Powiadomienia i załączanie logów' : '9. Email Notifications & Logs', icon: Mail },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>{isPl ? 'Pomoc i podręcznik operatora' : 'Operator Guide & Documentation'}</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {isPl
              ? 'Praktyczne wskazówki, architektura kontenera Docker, konfiguracja rsync/rclone oraz scenariusze awaryjne.'
              : 'Practical guidelines, Docker container architecture, rsync/rclone configuration and disaster recovery.'}
          </p>
        </div>
      </div>

      {/* Main Layout: Left Navigation + Right Content */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 space-y-1 bg-white dark:bg-neutral-900 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 h-fit">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-3 py-1.5">
            {isPl ? 'Spis zagadnień' : 'Table of Contents'}
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="md:col-span-3 space-y-6">
          {/* SECTION: Quickstart */}
          {activeSection === 'quickstart' && (
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-6">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                <FolderSync className="w-5 h-5" />
                <h3>{isPl ? '1. Szybki start i cykl pracy' : '1. Quickstart & Workflow'}</h3>
              </div>

              <div className="space-y-4 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                <p>
                  {isPl
                    ? 'Aplikacja SyncVault została zaprojektowana jako samodzielny kontener Docker do automatyzacji, monitorowania i awaryjnego przywracania kopii zapasowych.'
                    : 'SyncVault is designed as a standalone Docker container for automated backups, real-time job monitoring, and disaster recovery.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs">1</span>
                    <h4 className="font-bold text-neutral-900 dark:text-white">{isPl ? 'Krok 1: Utwórz zadanie' : 'Step 1: Create Task'}</h4>
                    <p className="text-neutral-500 text-[11px]">
                      {isPl
                        ? 'Kliknij "+ Nowe zadanie", wybierz silnik (rsync/rclone), zdefiniuj pary ścieżek źródło-cel oraz opcjonalne harmonogramy.'
                        : 'Click "+ New Task", select engine, specify source/destination pairs and optional cron schedules.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs">2</span>
                    <h4 className="font-bold text-neutral-900 dark:text-white">{isPl ? 'Krok 2: Uruchom i monitoruj' : 'Step 2: Run & Monitor'}</h4>
                    <p className="text-neutral-500 text-[11px]">
                      {isPl
                        ? 'Uruchom zadanie ręcznie przyciskiem "Uruchom kopię" lub poczekaj na harmonogram. Śledź postęp na żywo w zakładce Job Monitor.'
                        : 'Run manually or await cron triggers. Watch live progress, transferred files and bandwidth in Job Monitor.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs">3</span>
                    <h4 className="font-bold text-neutral-900 dark:text-white">{isPl ? 'Krok 3: Przywracanie' : 'Step 3: Disaster Recovery'}</h4>
                    <p className="text-neutral-500 text-[11px]">
                      {isPl
                        ? 'W razie awarii kliknij "Przywróć (Restore)". Aplikacja odwróci wektory ścieżek i zrekonstruuje utracone dane.'
                        : 'In case of failure, use "Restore". The system safely reverses the sync direction to restore files.'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300">
                  <h5 className="font-bold mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isPl ? 'Role użytkowników i bezpieczeństwo' : 'User Roles & Security'}</span>
                  </h5>
                  <p className="text-[11px]">
                    {isPl
                      ? 'Administratorzy mogą dodawać użytkowników, edytować konfiguracje, usuwać zadania i zarządzać ustawieniami kontenera. Standardowi użytkownicy (rola "user") mogą przeglądać zadania, uruchamiać je na żądanie oraz monitorować ich przebieg.'
                      : 'Administrators have full privileges. Regular users can view tasks, launch backup jobs, and inspect the real-time job monitor.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Docker */}
          {activeSection === 'docker' && (
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-6">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                <HardDrive className="w-5 h-5" />
                <h3>{isPl ? '2. Architektura Docker i montowanie wolumenów' : '2. Docker Architecture & Volumes'}</h3>
              </div>

              <div className="space-y-4 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                <p>
                  {isPl
                    ? 'Aplikacja działa w izolowanym kontenerze Docker. Aby rsync i rclone mogły odczytywać i zapisywać dane z Twojego komputera/serwera, należy zamontować odpowiednie katalogi (bind mounts lub named volumes):'
                    : 'The application runs inside a Docker container. Host directories must be mounted into the container via volumes:'}
                </p>

                <div className="p-4 rounded-xl bg-neutral-950 text-neutral-200 font-mono text-xs border border-neutral-800 overflow-x-auto">
                  <pre>{`services:
  syncvault:
    image: syncvault:latest
    container_name: syncvault
    ports:
      - "3000:3000"
    volumes:
      # 1. Dane źródłowe (zalecane ':ro' dla ochrony przed omyłkowym skasowaniem)
      - /mnt/storage/moje_pliki:/source:ro

      # 2. Katalog docelowy kopii lokalnych
      - /mnt/backups/syncvault:/destination

      # 3. Baza danych aplikacji i zadania (NIE kasować!)
      - ./syncvault_data:/app/data

      # 4. Trwały plik konfiguracji chmur rclone
      - ./rclone_config:/root/.config/rclone

      # 5. Długoterminowe logi operacji backupu
      - ./syncvault_logs:/logs
    restart: unless-stopped`}</pre>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-900 dark:text-white">
                    {isPl ? 'Wskazówki montowania:' : 'Mounting Tips:'}
                  </h4>
                  <ul className="list-disc pl-5 space-y-1 text-neutral-500 text-[11px]">
                    <li>
                      <strong className="text-neutral-700 dark:text-neutral-300">:ro (Read-Only) {isPl ? 'na źródle' : 'on source'}</strong>: {isPl ? 'W przypadku trybu Mirror (Sync), montowanie źródła jako :ro gwarantuje, że skrypt backupu nigdy przypadkowo nie zmodyfikuje Twoich oryginalnych plików.' : 'In Mirror (Sync) mode, mounting the source as :ro guarantees the backup task will never accidentally modify or delete your original files.'}
                    </li>
                    <li>
                      <strong className="text-neutral-700 dark:text-neutral-300">{isPl ? 'Wiele źródeł i celów' : 'Multiple sources and targets'}</strong>: {isPl ? 'Możesz zamontować dowolną liczbę wolumenów, np. /mnt/dane1:/data/source1 i /mnt/dane2:/data/source2.' : 'You can mount any number of host paths into the container, e.g. /mnt/data1:/data/source1 and /mnt/data2:/data/source2.'}
                    </li>
                    <li>
                      <strong className="text-neutral-700 dark:text-neutral-300">{isPl ? 'Uprawnienia plików (UID/GID)' : 'File permissions (UID/GID)'}</strong>: {isPl ? 'Upewnij się, że użytkownik kontenera ma uprawnienia do zapisu w katalogach docelowych oraz w /app/data.' : 'Ensure the container user has write permissions to destination directories and to /app/data.'}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Engines */}
          {activeSection === 'engines' && (
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-6">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                <CloudCog className="w-5 h-5" />
                <h3>{isPl ? '3. Silniki (rsync vs rclone) i typy synchronizacji' : '3. Engines & Sync Types'}</h3>
              </div>

              <div className="space-y-4 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* rsync */}
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-2">
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>rsync (Local / NAS / NFS)</span>
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      {isPl
                        ? 'Idealny do synchronizacji lokalnych dysków, macierzy RAID, zasobów NFS/SMB oraz wolumenów hosta. Bardzo szybki algorytm delta-transfer przesyłający wyłącznie zmienione bloki plików.'
                        : 'Optimal for local drives, RAID arrays, NFS/SMB shares, and host volumes. Employs a delta-transfer algorithm sending only modified file blocks.'}
                    </p>
                    <div className="font-mono text-[10px] bg-neutral-900 text-neutral-300 p-2 rounded">
                      rsync -avh --progress --delete /source/ /destination/
                    </div>
                  </div>

                  {/* rclone */}
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-2">
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <CloudCog className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>rclone (Cloud / Object Storage)</span>
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      {isPl
                        ? 'Obsługuje ponad 50 dostawców chmurowych: Google Drive, OneDrive, AWS S3, Cloudflare R2, Backblaze B2, SFTP, WebDAV. Obsługuje szyfrowanie w locie (crypt).'
                        : 'Supports over 50 cloud storage providers: Google Drive, OneDrive, AWS S3, Cloudflare R2, Backblaze B2, SFTP, WebDAV. Supports on-the-fly encryption (crypt).'}
                    </p>
                    <div className="font-mono text-[10px] bg-neutral-900 text-neutral-300 p-2 rounded">
                      rclone sync /source/ gdrive:backups/my_files/ -v
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <h4 className="font-bold text-neutral-900 dark:text-white">
                    {isPl ? 'Różnica między trybami synchronizacji:' : 'Sync Types Comparison:'}
                  </h4>
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                      <strong className="text-blue-600 dark:text-blue-400">{isPl ? 'Copy (Kopiuj):' : 'Copy:'}</strong> {isPl ? 'Kopiuje nowe i zmienione pliki z lokalizacji źródłowej do celu. Nigdy nie usuwa plików z celu, nawet jeśli zostały skasowane ze źródła. Najbezpieczniejszy tryb archiwizacji przyrostowej.' : 'Copies new and modified files from source to destination. Never deletes files from the destination even if removed from the source. The safest incremental backup mode.'}
                    </div>
                    <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                      <strong className="text-amber-600 dark:text-amber-400">{isPl ? 'Mirror / Sync (Lustro):' : 'Mirror / Sync:'}</strong> {isPl ? 'Zapewnia, że cel jest dokładną kopią źródła. Pliki usunięte ze źródła zostaną bezpowrotnie usunięte z celu (--delete).' : 'Ensures destination is an exact replica of source. Files removed from source will be deleted from destination (--delete).'}
                    </div>
                    <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                      <strong className="text-rose-600 dark:text-rose-400">{isPl ? 'Move (Przenieś):' : 'Move:'}</strong> {isPl ? 'Przenosi pliki do celu i usuwa je ze źródła po pomyślnym przesłaniu. Przydatne do archiwizacji wygenerowanych logów lub zrzutów bazy danych.' : 'Moves files to destination and removes them from source after successful transfer. Useful for archiving logs or database dumps.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Scheduling */}
          {activeSection === 'scheduling' && (
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-6">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                <Clock className="w-5 h-5" />
                <h3>{isPl ? '4. Harmonogramy wielokrotne (CRON)' : '4. Multi-Schedule Execution'}</h3>
              </div>

              <div className="space-y-4 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                <p>
                  {isPl
                    ? 'Każde zadanie może posiadać do 30 niezależnych reguł harmonogramu. Wewnętrzny silnik cron co 30 sekund weryfikuje zarejestrowane reguły i kolejkuje zadania w kolejce FIFO z poszanowaniem limitu równoległych procesów.'
                    : 'Each task supports up to 30 custom schedules evaluated by the internal scheduler daemon every 30 seconds, maintaining a strict FIFO queue according to concurrency limits.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <h5 className="font-bold text-neutral-900 dark:text-white mb-1">{isPl ? 'Codziennie (hh:mm)' : 'Daily (hh:mm)'}</h5>
                    <p className="text-[11px] text-neutral-500">
                      {isPl
                        ? 'Wykonuje zadanie każdego dnia o zadanej godzinie, np. 03:30 w nocy.'
                        : 'Executes the task every day at a specified time, e.g. 03:30 at night.'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <h5 className="font-bold text-neutral-900 dark:text-white mb-1">{isPl ? 'Co tydzień (dni + hh:mm)' : 'Weekly (days + hh:mm)'}</h5>
                    <p className="text-[11px] text-neutral-500">
                      {isPl
                        ? 'Wybór konkretnych dni tygodnia (np. Piątek i Niedziela o 22:00).'
                        : 'Select specific days of the week (e.g., Friday and Sunday at 22:00).'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <h5 className="font-bold text-neutral-900 dark:text-white mb-1">{isPl ? 'Co miesiąc (dni 1-31 + hh:mm)' : 'Monthly (days 1-31 + hh:mm)'}</h5>
                    <p className="text-[11px] text-neutral-500">
                      {isPl
                        ? 'Wybór wielu dni miesiąca z siatki 1-31 (np. 1-szy i 15-ty dzień miesiąca lub koniec miesiąca).'
                        : 'Select multiple calendar days from grid 1-31 (e.g., 1st and 15th day of the month).'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <h5 className="font-bold text-neutral-900 dark:text-white mb-1">{isPl ? 'Tylko na żądanie (Manual Only)' : 'Manual Only (On-Demand)'}</h5>
                    <p className="text-[11px] text-neutral-500">
                      {isPl
                        ? 'Możesz w każdej chwili wyłączyć harmonogram suwakiem "Włącz harmonogram" i uruchamiać zadanie wyłącznie ręcznie przyciskiem "Uruchom kopię".'
                        : 'Disable scheduling to trigger tasks exclusively on-demand using the "Run Backup" action.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Restore */}
          {activeSection === 'restore' && (
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-6">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                <RotateCcw className="w-5 h-5" />
                <h3>{isPl ? '5. Procedura przywracania danych (Disaster Recovery)' : '5. Disaster Recovery & Restore'}</h3>
              </div>

              <div className="space-y-4 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                <p>
                  {isPl
                    ? 'SyncVault posiada wbudowany moduł bezpiecznego przywracania danych, który eliminuje ryzyko pomyłki przy ręcznym wpisywaniu komend w terminalu.'
                    : 'SyncVault provides a safe restore wizard to quickly recover data without error-prone manual commands.'}
                </p>

                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 space-y-1">
                  <h5 className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{isPl ? 'Zasada działania Restore' : 'How Restore Operates'}</span>
                  </h5>
                  <p className="text-[11px]">
                    {isPl
                      ? 'System odwraca wektor transferu: dane z lokalizacji kopii zapasowej (CEL) zostają skopiowane z powrotem do katalogu roboczego (ŹRÓDŁO).'
                      : 'The system reverses the sync transfer vector: data from backup location (DESTINATION) is copied back to working directory (SOURCE).'}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-900 dark:text-white">
                    {isPl ? 'Procedura krok po kroku:' : 'Step-by-step procedure:'}
                  </h4>
                  <ol className="list-decimal pl-5 space-y-2 text-neutral-600 dark:text-neutral-300 text-[11px]">
                    <li>{isPl ? 'Przejdź do zakładki Zadania i znajdź zadanie zawierające kopię zapasową.' : 'Go to Tasks and locate the task containing your backup.'}</li>
                    <li>{isPl ? 'Kliknij przycisk Przywróć (Restore).' : 'Click the Restore button.'}</li>
                    <li>{isPl ? 'W oknie dialogowym zweryfikuj podgląd wygenerowanej komendy rsync / rclone.' : 'Inspect the generated rsync / rclone preview command.'}</li>
                    <li>{isPl ? 'Wybierz docelowy katalog odzyskiwania (domyślnie oryginalne źródło, lub alternatywna ścieżka).' : 'Choose target recovery directory (default source or custom alternative path).'}</li>
                    <li>{isPl ? 'Potwierdź operację. W zakładce Job Monitor zobaczysz aktywny proces restore ze specjalnym oznaczeniem.' : 'Confirm action. Check the live restore process in the Job Monitor.'}</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Flags */}
          {activeSection === 'flags' && (
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-6">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                <Sliders className="w-5 h-5" />
                <h3>{isPl ? '6. Przydatne flagi dla rsync i rclone' : '6. Useful Flags'}</h3>
              </div>

              <div className="space-y-4 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                <p>
                  {isPl
                    ? 'W polach "Dodatkowe flagi (opcjonalne)" w edycji zadania możesz podać zaawansowane parametry dostosowujące działanie procesów rsync oraz rclone:'
                    : 'In the "Custom Flags (optional)" field of the task editor, you can supply advanced CLI flags to fine-tune rsync and rclone operations:'}
                </p>

                <h4 className="font-bold text-neutral-900 dark:text-white pt-2">
                  {isPl ? 'Przydatne flagi dla rsync:' : 'Essential rsync flags:'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">--dry-run (lub -n)</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Tryb symulacji: proces wykonuje pełną analizę plików bez dokonywania jakichkolwiek zmian na dysku.'
                        : 'Simulation mode: performs dry run file traversal without making modifications or writing to disk.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">--bwlimit=10000</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Ogranicza prędkość transferu (w KB/s, np. 10000 = ~10 MB/s), zapobiegając wysyceniu łącza lub I/O dysków.'
                        : 'Bandwidth limit in KB/s (e.g. 10000 = ~10 MB/s), preventing network or disk saturation.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">--exclude="*.tmp" --exclude=".git/"</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Wyklucza wybrane wzorce plików i katalogów (np. cache, pliki tymczasowe, node_modules).'
                        : 'Excludes matching file patterns or directories from transfer (e.g. caches, temp files, .git).' }
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">-c, --checksum</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Porównuje pliki na podstawie sumy kontrolnej (checksum), zamiast rozmiaru i czasu modyfikacji. Dokładniejsze, lecz wolniejsze.'
                        : 'Forces comparison by MD5 checksum instead of mtime and file size. More thorough, but requires I/O reads.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">--partial --partial-dir=.rsync-partial</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Wznawia przerwane pobieranie dużych plików od miejsca zerwania połączenia.'
                        : 'Resumes partially transferred large files on connection interruptions.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">--inplace</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Aktualizuje pliki bezpośrednio na miejscu (bez pliku tymczasowego). Oszczędza miejsce na dysku docelowym.'
                        : 'Updates destination files in-place without creating intermediate temporary files, saving disk space.'}
                    </p>
                  </div>
                </div>

                <h4 className="font-bold text-neutral-900 dark:text-white pt-3">
                  {isPl ? 'Przydatne flagi dla rclone (Chmura i Remote):' : 'Essential rclone flags (Cloud & Remotes):'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">--transfers=8 --checkers=16</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Zwiększa liczbę równoległych transferów plików i wątków sprawdzających hashe. Znacząco przyspiesza backup wielu małych plików w chmurze.'
                        : 'Increases parallel file transfers and checker threads, dramatically speeding up sync of numerous small files.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">--fast-list</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Używa masowego listowania katalogów w chmurach S3, Google Drive i OneDrive, redukując liczbę zapytań API nawet o 90%.'
                        : 'Employs recursive batch directory listing for S3, GDrive, and OneDrive, reducing API calls by up to 90%.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">--bwlimit 15M</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Ogranicza pasmo wysyłania/pobierania w rclone (np. 15M = 15 Megabajtów/sekundę lub 08:00,10M 18:00,50M dla harmonogramu pasma).'
                        : 'Rate limits transfer bandwidth (e.g. 15M or schedule syntax 08:00,10M 18:00,50M).'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">--checksum (lub -c)</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Pomija pliki bazując na hashu (np. MD5, SHA1), zamiast czasu modyfikacji (szczególnie przydatne gdy chmura zaokrągla czasy).'
                        : 'Skips files based on cloud checksum instead of modification timestamps.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">--s3-chunk-size 64M</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Zwiększa rozmiar pojedynczej części multipart upload dla AWS S3, Wasabi, Cloudflare R2 i MinIO, przyspieszając wysyłanie gigabajtowych plików.'
                        : 'Increases multipart chunk size for AWS S3, Cloudflare R2, and MinIO, boosting upload throughput for large files.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">--drive-acknowledge-abuse</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Dla Google Drive: pozwala na pobieranie plików oznaczonych przez skanery Google jako potencjalnie ryzykowne (np. archiwa .zip/.exe).'
                        : 'For Google Drive: permits downloading files flagged as potentially hazardous by Google scanners.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">--retries 5 --low-level-retries 10</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Zwiększa odporność transferu na niestabilne połączenia internetowe lub limity throttling API w chmurze.'
                        : 'Increases retry resilience against unstable network connections or cloud API rate limiting.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-blue-600 dark:text-blue-400">--drive-export-formats docx,xlsx,pdf</span>
                    <p className="font-sans text-neutral-500 mt-1 text-[11px]">
                      {isPl
                        ? 'Automatycznie eksportuje dokumenty Google Docs i Sheets do wybranych formatów biurowych Microsoft Office lub PDF.'
                        : 'Automatically exports Google Docs and Sheets to chosen Microsoft Office or PDF formats.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Troubleshooting */}
          {activeSection === 'troubleshooting' && (
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-6">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" />
                <h3>{isPl ? '7. Rozwiązywanie problemów (Troubleshooting)' : '7. Troubleshooting'}</h3>
              </div>

              <div className="space-y-4 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1.5">
                    <h5 className="font-bold text-neutral-900 dark:text-white">
                      {isPl ? 'Błąd "Permission denied (13)"' : 'Error "Permission denied (13)"'}
                    </h5>
                    <p className="text-[11px] text-neutral-500">
                      {isPl
                        ? 'Użytkownik wewnątrz kontenera nie ma uprawnień do zapisu w podmontowanym katalogu docelowym. Sprawdź na hoście uprawnienia (chmod 775 /sciezka lub chown -R 1000:1000 /sciezka).'
                        : 'The container user lacks write permissions on the mounted host directory. Fix host permissions via chmod 775 /path or chown -R 1000:1000 /path.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1.5">
                    <h5 className="font-bold text-neutral-900 dark:text-white">
                      {isPl ? 'Zadanie tkwi w stanie "W kolejce (queued)"' : 'Task stuck in "Queued" state'}
                    </h5>
                    <p className="text-[11px] text-neutral-500">
                      {isPl
                        ? 'Osiągnięto limit równoległych zadań (maxConcurrentJobs) lub trwa odliczanie odstępu między zadaniami. Zadanie rozpocznie się automatycznie po zakończeniu poprzedniego procesu (+ skonfigurowany odstęp w sekundach). Oba parametry można dostosować w Ustawienia -> Parametry wykonania i limity.'
                        : 'Max concurrent jobs limit reached, or the inter-job delay is counting down. The task will launch automatically once the active job finishes (+ the configured delay in seconds). Adjust both in Settings -> Execution Parameters & Limits.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1.5">
                    <h5 className="font-bold text-neutral-900 dark:text-white">
                      {isPl ? 'Rclone zwraca błąd tokena (expired token)' : 'Rclone returns expired auth token'}
                    </h5>
                    <p className="text-[11px] text-neutral-500">
                      {isPl
                        ? 'Przejdź do Ustawienia -> Rclone Config i zaktualizuj plik konfiguracyjny lub zautoryzuj remote ponownie na swoim komputerze, a następnie wklej odświeżoną sekcję rclone.conf.'
                        : 'Go to Settings -> Rclone Config and update the token or re-authenticate the remote on your local machine and paste the refreshed section.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1.5">
                    <h5 className="font-bold text-neutral-900 dark:text-white">
                      {isPl ? 'Kopia bezpieczeństwa konfiguracji (.svb)' : 'Configuration Disaster Backup (.svb)'}
                    </h5>
                    <p className="text-[11px] text-neutral-500">
                      {isPl
                        ? 'Przed aktualizacją kontenera lub modyfikacjami infrastruktury wejdź w Ustawienia -> Kopia & Docker i wygeneruj zaszyfrowany plik .svb z kopią wszystkich zadań i haseł.'
                        : 'Before container updates or host changes, visit Settings -> Backup & Docker to download an encrypted .svb bundle containing all task configurations and credentials.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Queuing & Task IDs */}
          {activeSection === 'queuing' && (
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-6">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                <Layers className="w-5 h-5" />
                <h3>{isPl ? '8. Kolejkowanie i numery zadań (#ID)' : '8. Task Chaining & Task Numbers (#ID)'}</h3>
              </div>

              <div className="space-y-4 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                <p>
                  {isPl
                    ? 'SyncVault automatycznie przypisuje każdemu zadaniu unikalny, czytelny identyfikator numeryczny (np. #1, #2, #3). Numer ten jest widoczny po lewej stronie nazwy zadania na liście zadań oraz we wszystkich selektorach kolejkowania.'
                    : 'SyncVault automatically assigns every task a readable sequential identifier (e.g. #1, #2, #3). This number appears next to the task name on the tasks view and in chaining dropdowns.'}
                </p>

                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 space-y-2">
                  <h4 className="font-bold text-neutral-900 dark:text-white">
                    {isPl ? 'Uruchamianie po zakończeniu innego zadania (Task Chaining)' : 'Run after another task completes'}
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    {isPl
                      ? 'W oknie edycji zadania, w sekcji "Harmonogram i wyzwalacze", możesz ustawić parametr "Uruchom po zakończeniu innego zadania". Gdy zadanie poprzedzające zakończy się sukcesem, zadanie zależne zostanie natychmiast automatycznie dodane do kolejki wykonania.'
                      : 'In the task editor under "Schedule & Triggers", configure "Run after another task completes". When the parent task finishes successfully, this downstream task is automatically enqueued.'}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {isPl
                      ? 'Dzięki prefiksowi [#1], [#2] w rozwijanej liście łatwo odnajdziesz docelowe zadanie nawet przy dużej liczbie pozycji o zbliżonych nazwach.'
                      : 'The [#1], [#2] prefixes in the dropdown allow fast identification of predecessor tasks even with many tasks.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 space-y-1">
                  <h5 className="font-bold">
                    {isPl ? 'Blokada edycji i usuwania podczas pracy zadania' : 'Lock during task execution'}
                  </h5>
                  <p className="text-[11px]">
                    {isPl
                      ? 'Dla zapewnienia integralności danych i uniknięcia konfliktów procesów w tle, przyciski "Edytuj" oraz "Usuń" są automatycznie blokowane dla zadań będących aktualnie w trakcie wykonywania lub oczekujących w kolejce.'
                      : 'To preserve data integrity, "Edit" and "Delete" actions are locked while a task is running or queued.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Notifications & Email Logs */}
          {activeSection === 'notifications' && (
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-6">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                <Mail className="w-5 h-5" />
                <h3>{isPl ? '9. Powiadomienia E-mail i polityka załączania logów' : '9. Email Notifications & Log Attachments'}</h3>
              </div>

              <div className="space-y-4 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                <p>
                  {isPl
                    ? 'SyncVault oferuje elastyczny system powiadomień E-mail przez SMTP z precyzyjną kontrolą dołączania pełnych logów procesów.'
                    : 'SyncVault provides an SMTP email notification system with granular attachment policy for full process execution logs.'}
                </p>

                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-900 dark:text-white">
                    {isPl ? 'Warunki załączania pliku dziennika (.log):' : 'Log file attachment conditions:'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                      <span className="font-bold text-neutral-900 dark:text-white">
                        {isPl ? 'Tylko przy błędzie (Domyślnie)' : 'On Error Only (Default)'}
                      </span>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        {isPl
                          ? 'Plik logu dołączany jest wyłącznie w przypadku zakończenia procesu błędem (failed/stopped). Oszczędza miejsce w skrzynce pocztowej przy regularnych kopiach.'
                          : 'Log file is attached only when the task fails or stops unexpectedly, preserving mailbox storage on routine runs.'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                      <span className="font-bold text-neutral-900 dark:text-white">
                        {isPl ? 'Błąd i ostrzeżenie (Warning)' : 'Error and Warning'}
                      </span>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        {isPl
                          ? 'Załącza log przy błędach krytycznych oraz w sytuacjach ostrzegawczych (np. wykrycie za długich ścieżek OneDrive > 260 znaków lub plików zablokowanych).'
                          : 'Attaches log on critical errors as well as warning events (e.g. OneDrive path exceeding limits or locked files).'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                      <span className="font-bold text-neutral-900 dark:text-white">
                        {isPl ? 'Tylko przy sukcesie' : 'On Success Only'}
                      </span>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        {isPl
                          ? 'Załącza log tylko przy w pełni udanych synchronizacjach bez żadnych ostrzeżeń.'
                          : 'Attaches log files exclusively for successful backup executions.'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                      <span className="font-bold text-neutral-900 dark:text-white">
                        {isPl ? 'Zawsze / Nigdy' : 'Always / Never'}
                      </span>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        {isPl
                          ? '"Zawsze" dołącza plik .log do każdej wysłanej wiadomości, a "Nigdy" wysyła samą treść raportu e-mail z podsumowaniem transferu i ostatnimi liniami bez załącznika.'
                          : '"Always" includes .log attachment on every notification, while "Never" sends only email body metrics without files.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300">
                  <p className="text-[11px]">
                    {isPl
                      ? 'Politykę załączania logów możesz ustawić globalnie w Ustawienia -> Powiadomienia lub nadpisać indywidualnie dla konkretnego zadania w oknie jego edycji.'
                      : 'Log attachment policies can be set globally under Settings -> Notifications or overridden on a per-task basis in the task editor.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
