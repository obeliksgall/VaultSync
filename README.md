# SyncVault 🛡️📦

**SyncVault** to nowoczesna, profesjonalna platforma webowa i zarządca automatyzacji kopii zapasowych napędzana sprawdzonymi silnikami **rsync** oraz **rclone**. Zapewnia pełną kontrolę nad synchronizacją danych lokalnych, serwerowych i chmurowych w eleganckim, bezpiecznym interfejsie z podglądem na żywo.

---

## 🚀 Główne możliwości

- **Podwójny silnik kopii:**
  - **rsync**: lokalne dyski, pamięci NAS, montowane zasoby sieciowe CIFS/NFS, wsparcie dla twardych dowiązań (hard links) i zachowywania uprawnień (`-aHAX`).
  - **rclone**: ponad 40 dostawców chmurowych (Google Drive, Microsoft OneDrive, Amazon S3, Backblaze B2, Nextcloud, SFTP, WebDAV i inne).
- **Unikalna numeracja zadań (#ID) i kolejkowanie:**
  - Każde zadanie posiada czytelny identyfikator numeryczny (`#1`, `#2`, `#3`...).
  - **Inteligentne unikanie luk w numeracji:** usunięcie zadania o najwyższym numerze (np. omyłkowo zduplikowanego zadania `#21`) powoduje automatyczne cofnięcie licznika, dzięki czemu kolejne utworzone zadanie ponownie otrzymuje zwolniony numer (`#21`).
  - **Kolejkowanie łańcuchowe (Task Chaining):** automatyczne uruchamianie zadania zależnego po pomyślnym zakończeniu innego zadania.
  - **Konfigurowalny odstęp kolejki (Queue Breather):** parametr `queueStartDelaySeconds` pozwalający ustalić bufor odpoczynku (np. 5 sekund) przed startem kolejnego zadania z kolejki.
- **Wiele par ścieżek w jednym zadaniu:**
  - Definiowanie wielu wektorów źródło &rarr; cel w ramach jednej logicznej jednostki backupu.
- **Raporty CSV wysłanych i usuniętych plików (z rzeczywistego wykonania):**
  - Generowanie precyzyjnych zestawień CSV bezpośrednio z operacji transferu (pliki wysłane) oraz czyszczenia (pliki usunięte).
  - **Nowa kolumna "Cel" / "Destination":** raporty zawierają pełną informację o wektorze transferu (`Ścieżka źródłowa` ; `Cel` ; `Rozmiar` ; `Data modyfikacji` ; `Status`).
  - **Przełącznik języka nagłówków CSV:** wybór nagłówków w języku angielskim (EN - domyślny, maksymalna zgodność) lub polskim (PL) w Ustawieniach.
  - Spójny format nazewnictwa plików: `<YYYY-MM-DD_HH-mm-ss>_<shortJobId>_sent.csv` oraz `<YYYY-MM-DD_HH-mm-ss>_<shortJobId>_deleted.csv`.
  - Format UTF-8 z BOM i separatorem średnik (`;`), w pełni czytelny w Microsoft Excel, LibreOffice Calc i arkuszach kalkulacyjnych.
  - Niezależna, konfigurowalna retencja raportów CSV (`csvReportRetentionDays`) w Ustawieniach z automatycznym oczyszczaniem plików w `data/files/<nrZadania>_<nazwaZadania>/`.
  - Wygodne pobieranie raportów bezpośrednio z poziomu panelu historii i monitora zadań.
- **Zaawansowane reguły wykluczeń (Exclude Filters):**
  - Obsługa precyzyjnych masek plików i katalogów dla silników `rsync` i `rclone` (np. `*.tmp`, `/katalog/*.tmp`, `katalog/`, `*_TRASH/`).
  - Dedykowana dokumentacja i baza przykładów znajduje się w pliku [`EXCLUDE_FILTERS.md`](./EXCLUDE_FILTERS.md).
- **Bezpieczeństwo operacyjne i zarządzanie sesją:**
  - **Licznik czasu sesji na żywo:** umieszczony na górnym pasku nawigacyjnym (między zmianą hasła a wylogowaniem), z dynamiczną kolorystyką (ostrzeżenie poniżej 5 min, pulsowanie poniżej 2 min).
  - **Auto-wylogowanie i przedłużanie przy aktywności:** konfigurowalny czas bezczynności (30m, 1h, 3h lub brak limitu); każdy ruch, kliknięcie lub akcja automatycznie odnawia sesję w tle (heartbeat), z opcją natychmiastowego odświeżenia kliknięciem w licznik.
  - **Blokada edycji i usuwania:** aktywne zadania (w trakcie wykonywania lub w kolejce) mają automatycznie zablokowaną możliwość edycji i skasowania.
  - Ochrona przed usunięciem konta ostatniego administratora oraz zabezpieczenie przed przypadkowym usunięciem własnego profilu.
- **Moduł przywracania danych (Disaster Recovery):**
  - Bezpieczne odwracanie wektora synchronizacji z możliwością wyboru konkretnych par ścieżek i katalogu docelowego.
  - Opcjonalny wyłącznik funkcji przywracania w konfiguracji zadania (przycisk wyłączony z jasnym komunikatem blokady).
- **Monitor zadań na żywo (Job Monitor):**
  - Podgląd w czasie rzeczywistym: pasek postępu, prędkość transferu (MB/s), liczba przetransferowanych bajtów i plików, strumieniowanie logów oraz bezpieczne zatrzymywanie procesów.
- **Powiadomienia wielokanałowe z auto-transliteracją:**
  - Kanały: **Discord Webhook**, **ntfy.sh (Push)** oraz **E-mail (SMTP)**.
  - **Auto-transliteracja polskich znaków (np. ó&rarr;o, ł&rarr;l, ą&rarr;a):** automatyczne usuwanie diakrytyków z tytułów wiadomości Discord, tematów e-mail oraz powiadomień ntfy, gwarantujące brak problemów z kodowaniem znaków.
  - Precyzyjna polityka dołączania plików dziennika (`.log`) w wiadomościach e-mail (*Tylko przy błędzie*, *Błąd i ostrzeżenie*, *Zawsze*, *Tylko sukces*, *Nigdy*).
  - Konfigurowalne szablony tytułów i treści ze zmiennymi (`{name}`, `{status}`, `{files}`, `{data}`, `{time}`, itp.).
- **Wielozadaniowość i harmonogramy CRON:**
  - Obsługa wielu niezależnych reguł CRON dla każdego zadania wraz z gotowymi szablonami (co godzinę, codziennie, co tydzień, co miesiąc).
  - Konfigurowalny limit jednoczesnych zadań w tle (`maxConcurrentJobs`).
- **Niezależna, atomowa architektura bazy danych:**
  - Podział bazy danych na trzy autonomiczne pliki (`syncvault-db.json`, `syncvault-history.json`, `syncvault-audit.json`), co zapewnia wysoką wydajność, brak blokowania I/O i niezawodność przy intensywnym logowaniu.
- **Automatyczne kopie bezpieczeństwa bazy danych (`data/backupdb/`):**
  - Przed każdą modyfikacją pliku `syncvault-db.json` (dodanie/edycja zadania, użytkownika, zmiana ustawień) system automatycznie odkłada kopię migawkową `syncvault-db_YYYY-MM-DD_HH-mm-ss.json`.
  - Konfigurowalna retencja czasowa (domyślnie 14 dni) z twardą gwarancją ochrony: system **nigdy nie usuwa kopii poniżej zadeklarowanego progu (domyślnie min. 14 kopii)**.
  - Podgląd i bezpośrednie pobieranie kopii bazy w zakładce *Ustawienia &rarr; Kopia & Docker*.
- **Kopia zapasowa konfiguracji (.svb):**
  - Eksport i import całej konfiguracji aplikacji, zadań, historii i haseł w zaszyfrowanych plikach `.svb`.

---

## 🐳 Szybki start z Docker Compose (Zalecane)

Aplikacja jest w pełni skonteneryzowana i gotowa do uruchomienia od ręki w środowisku Docker.

### 1. Plik `docker-compose.yml`

W głównym katalogu projektu znajduje się gotowy plik `docker-compose.yml`:

```yaml
services:
  syncvault:
    build:
      context: .
      dockerfile: Dockerfile
    image: syncvault:latest
    container_name: syncvault
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - TZ=Europe/Warsaw
      - DATA_DIR=/data
      - RCLONE_CONFIG=/data/rclone.conf
      - RCLONE_CONFIG_PATH=/data/rclone.conf
      - MAX_CONCURRENT_JOBS=2
      # Opcjonalne powiadomienia (możesz je też skonfigurować w panelu WWW):
      - DISCORD_WEBHOOK_URL=
      - NTFY_URL=
      - SMTP_HOST=
      - SMTP_PORT=587
      - SMTP_USER=
      - SMTP_PASS=
      - SMTP_FROM=syncvault@localhost
      - NOTIFY_EMAIL_TO=
    volumes:
      # 1. Główny wolumen aplikacji (pliki bazy danych, rclone.conf, logi oraz raporty CSV)
      - ./data:/data

      # 2. Katalogi danych w systemie Linux (dostosuj do swoich dysków):
      - /mnt/storage:/source:ro
      - /mnt/backups:/destination

      # 3. Przykłady dla Windows Docker Desktop (odkomentuj w razie potrzeby):
      # - C:/Users/TwojaNazwa/Dokumenty:/source:ro
      # - D:/KopieZapasowe:/destination
```

### 2. Uruchomienie kontenera

Wystarczy wykonać w terminalu (Linux/macOS) lub PowerShell (Windows):

```bash
docker compose up -d --build
```

Aplikacja natychmiast zbuduje obraz produkcyjny i uruchomi panel pod adresem:
👉 **`http://localhost:3000`**

Sprawdzenie działania i logów:
```bash
docker compose logs -f
```

Zatrzymanie aplikacji:
```bash
docker compose down
```

---

## 🗄️ Baza danych SyncVault — Architektura i podłączanie się (Linux & Windows)

### Trójstopniowa, atomowa struktura plików
Dla zapewnienia maksymalnej wydajności I/O i niezawodności, SyncVault dzieli dane na trzy niezależne pliki JSON w katalogu `/data`:
1. **`syncvault-db.json`** — Użytkownicy (`users`), zadania (`tasks`), ustawienia globalne (`settings`) i konfiguracja powiadomień.
2. **`syncvault-history.json`** — Pełna historia wykonań zadań (`history`), kody zakończenia, transferowane bajty, czasy trwania i metadane.
3. **`syncvault-audit.json`** — Dziennik zdarzeń i operacji audytowych (`auditLogs`), rejestrujący działania użytkowników i systemu.
4. **`backupdb/` (`/data/backupdb/syncvault-db_YYYY-MM-DD_HH-mm-ss.json`)** — Automatyczne migawki bazy danych wykonywane przed każdym zapisem (retencja domyślnie 14 dni, gwarantowane zachowanie minimum 14 kopii).
5. **`files/` (`/data/files/<taskNumber>_<safeTaskName>/`)** — Wygenerowane raporty CSV (`*_sent.csv`, `*_deleted.csv`) z automatyczną retencją.
6. **`logs/` (`/data/logs/<taskNumber>_<safeTaskName>/`)** — Surowe pliki logów procesów rsync/rclone z automatyczną retencją.
7. **`logs/logs_YYYY-MM-DD.log`** — Codzienne logi systemowe i kontenera Docker.

- **Lokalizacja w kontenerze:** `/data/`
- **Lokalizacja na hoście:** `./data/` (w katalogu, w którym znajduje się `docker-compose.yml`).
- **Dlaczego taki format?** Brak konieczności instalowania i utrzymywania ciężkich silników SQL (PostgreSQL/MySQL), zerowe zużycie pamięci w spoczynku, 100% odporność na awarie, atomowy zapis z podmianą plików i pełna przenośność (kopiujesz folder `./data` i masz całe środowisko).

---

### 🐧 Jak podpiąć się do bazy danych w systemie LINUX

#### Opcja A: Z poziomu terminala hosta (CLI)
Katalog `./data` jest zmapowany na dysk hosta, co umożliwia wygodne przeszukiwanie standardowymi narzędziami Linuksa:

```bash
# 1. Podgląd zdefiniowanych zadań:
jq '.tasks[] | {nr: .taskNumber, nazwa: .name, silnik: .engine, tryb: .type}' ./data/syncvault-db.json

# 2. Wyświetlenie zarejestrowanych użytkowników:
jq '.users[] | {uzytkownik: .username, rola: .role, utworzono: .createdAt}' ./data/syncvault-db.json

# 3. Sprawdzenie ostatnich wpisów w historii wykonań:
jq '.history[-5:] | .[] | {zadanie: .taskName, status: .status, czas: .startTime}' ./data/syncvault-history.json

# 4. Sprawdzenie ostatnich zdarzeń audytowych:
jq '.[-5:] | .[] | {data: .timestamp, uzytkownik: .username, akcja: .action, opis: .details}' ./data/syncvault-audit.json
```

#### Opcja B: Wejście do wnętrza działającego kontenera Docker
```bash
docker exec -it syncvault sh
ls -la /data/
cat /data/syncvault-db.json | grep -i task
```

#### Opcja C: Edytory graficzne w Linuksie (GUI)
- **Visual Studio Code:** `code ./data` (skrót `Ctrl+Shift+I` lub `Shift+Alt+F` formatuje JSON).
- **DBeaver / NoSQL Manager:** Obsługa Generic JSON / Flat File do tabelarycznego przeglądania kolekcji.

---

### 🪟 Jak podpiąć się do bazy danych w systemie WINDOWS

W systemie Windows (Docker Desktop, WSL2 lub PowerShell) pliki bazy danych znajdują się w folderze `.\data\`:

#### Opcja A: Poprzez PowerShell (Wbudowane parsowanie obiektowe)
```powershell
# 1. Wyświetlenie listy zadań w czytelnej tabeli:
(Get-Content .\data\syncvault-db.json | ConvertFrom-Json).tasks | Format-Table taskNumber, name, engine, type

# 2. Sprawdzenie zarejestrowanych użytkowników:
(Get-Content .\data\syncvault-db.json | ConvertFrom-Json).users | Format-Table username, role, createdAt

# 3. Sprawdzenie globalnych ustawień:
(Get-Content .\data\syncvault-db.json | ConvertFrom-Json).settings | Format-List

# 4. Podgląd ostatnich wykonań kopii z pliku historii:
(Get-Content .\data\syncvault-history.json | ConvertFrom-Json).history | Select-Object -Last 5 | Format-Table taskName, status, startTime, durationMs
```

#### Opcja B: Programy z interfejsem graficznym (GUI w Windows)
1. **Visual Studio Code:** otwórz folder `.\data\` i sformatuj pliki skrótem `Shift + Alt + F`.
2. **Notepad++:** wtyczka `JSTool` (`Plugins` &rarr; `JSTool` &rarr; `JSFormat`).
3. **DBeaver / TablePlus:** przeglądanie kolekcji dokumentów JSON z opcją eksportu.

---

### 🌐 Dostęp programistyczny przez REST API

Możesz integrować się z SyncVault ze skryptów (Python, Bash, PowerShell) za pośrednictwem wbudowanego REST API:

1. **Logowanie i pobranie tokena JWT/Bearer:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "admin", "password": "twoje_haslo"}'
   ```

2. **Pobranie listy zadań:**
   ```bash
   curl -X GET http://localhost:3000/api/tasks \
     -H "Authorization: Bearer <TOKEN>"
   ```

3. **Uruchomienie zadania:**
   ```bash
   curl -X POST http://localhost:3000/api/tasks/<TASK_ID>/run \
     -H "Authorization: Bearer <TOKEN>"
   ```

4. **Pobranie historii, audytu lub statusu sesji:**
   ```bash
   curl -X GET http://localhost:3000/api/jobs/history -H "Authorization: Bearer <TOKEN>"
   curl -X GET http://localhost:3000/api/audit -H "Authorization: Bearer <TOKEN>"
   curl -X POST http://localhost:3000/api/auth/heartbeat -H "Authorization: Bearer <TOKEN>"
   ```

---

### ⚠️ Ważne zasady bezpieczeństwa przy ręcznej edycji bazy

1. **Zatrzymaj kontener przed ręczną modyfikacją plików JSON:**
   SyncVault zapisuje stan atomowo. Ręczna edycja na pracującym kontenerze może doprowadzić do nadpisania zmian.
   ```bash
   docker compose stop syncvault
   # ... edycja plików w ./data ...
   docker compose start syncvault
   ```
2. **Twórz kopię bezpieczeństwa przed modyfikacją:**
   - Linux: `cp ./data/syncvault-db.json ./data/syncvault-db.json.bak`
   - Windows: `Copy-Item .\data\syncvault-db.json .\data\syncvault-db.json.bak`

---

## 🛠️ Uruchomienie lokalne (Development / Bare-Metal)

### Wymagania wstępne
- Node.js 18+ lub 20+ LTS
- `rsync` zainstalowany w systemie (`sudo apt install rsync`)
- `rclone` zainstalowany w systemie (`sudo apt install rclone`)

### Krok 1: Instalacja zależności
```bash
npm install
```

### Krok 2: Uruchomienie deweloperskie
```bash
npm run dev
```
Aplikacja uruchomi się na porcie `3000` (serwer Express + frontend Vite).

### Krok 3: Budowanie i start wersji produkcyjnej
```bash
npm run build
npm start
```

---

## 📖 Instrukcja obsługi krok po kroku

### 1. Pierwsze uruchomienie i konfiguracja Administratora
Przy pierwszym wejściu na stronę SyncVault powita Cię kreator konfiguracji:
1. Wpisz nazwę administratora (np. `admin`).
2. Podaj silne hasło (minimum 6 znaków).
3. Zostaniesz automatycznie zalogowany do panelu głównego.

### 2. Tworzenie i konfiguracja zadania
1. Kliknij **+ Nowe zadanie** w prawym górnym rogu.
2. Nadaj zadaniu nazwę (np. *Kopia Dokumentów na NAS*) i opcjonalne tagi.
3. **Wybierz silnik:**
   - `rsync` – dla dysków lokalnych, zasobów sieciowych NFS/SMB.
   - `rclone` – dla chmur i protokołów zdalnych (Google Drive, S3, SFTP, WebDAV itp.).
4. **Wybierz tryb:**
   - *Kopia lustrzana (Mirror/Sync)* – wierne odzwierciedlenie źródła w celu.
   - *Przyrostowa / Kopiuj (Copy)* – dodaje i aktualizuje pliki, nie usuwa nic z celu.
   - *Przenieś (Move)* – przenosi pliki ze źródła do celu.
5. **Zdefiniuj pary ścieżek:** źródło &rarr; cel (możliwość dodania wielu par).
6. **Filtry, Kosz i Wykluczenia:**
   - Reguły wykluczeń plików/folderów (np. `*.tmp`, `.git/`, `node_modules/`, `/dane/*.tmp`).
   - Szczegółowe zasady i gotowe przykłady filtrów zebrano w pliku [`EXCLUDE_FILTERS.md`](./EXCLUDE_FILTERS.md).
   - Opcja włączenia Kosza na usuwane pliki (`_TRASH/YYYY-MM-DD`).
   - Indywidualne dni trzymania logów dla tego zadania.
7. **Powiadomienia i raporty CSV:**
   - Zaznacz kanały dostarczania: Discord Webhook, ntfy.sh, E-mail SMTP.
   - Wybierz generowanie raportów CSV (wysłane pliki, usunięte pliki) zapisywanych w `data/files/<nrZadania>_<nazwaZadania>/`.

### 3. Zarządzanie sesją i licznik na pasku nawigacyjnym
- Pomiędzy przyciskiem zmiany hasła a przyciskiem wylogowania wyświetlany jest zegar wskazujący pozostały czas sesji (np. `29:50`).
- Wykonanie dowolnej akcji (kliknięcie, przewijanie, pisanie) natychmiast odnawia sesję.
- Kliknięcie bezpośrednio w sam licznik wysyła natychmiastowe odświeżenie sesji.
- Czas trwania sesji można dostosować w **Ustawienia &rarr; Parametry wykonania i limity** (30 min, 1 godz., 3 godz., lub brak limitu z określoną liczbą dni).

### 4. Parametry wykonania, retencja i kolejkowanie
W sekcji **Ustawienia &rarr; Parametry wykonania i limity**:
- **Maksymalna liczba zadań w tle:** limit jednoczesnych procesów (nadmiarowe zadania czekają w kolejce FIFO).
- **Odstęp przed kolejnym zadaniem (`queueStartDelaySeconds`):** konfigurowalny czas odczekania (np. 5 sek.) po zakończeniu zadania przed startem następnego z kolejki (kolejkowanie łańcuchowe, uruchomienie ręczne lub harmonogram).
- **Domyślna retencja logów (dni):** automatyczne usuwanie starych wpisów historii oraz plików `.log` z dysku.
- **Retencja raportów CSV (dni):** niezależny limit dni przechowywania wygenerowanych zestawień CSV w katalogu `data/files/`.
- **Język nagłówków raportów CSV:** wybór pomiędzy `Angielski (EN)` (domyślny: `"Name (full path)";"Destination";"Size";"Modified (mtime)";"Status"`) a `Polski (PL)` (`"Nazwa (pełna ścieżka)";"Cel";"Waga";"Data modyfikacji (mtime)";"Status"`).
- **Retencja i limit wpisów Audit Log:** automatyczne rotowanie wpisów dziennika audytu (wg dni oraz maksymalnego limitu liczby zdarzeń).

### 5. Przywracanie danych (Restore)
W razie awarii lub utraty plików kliknij **Przywróć** przy wybranym zadaniu:
- Wskaż, które pary ścieżek chcesz odtworzyć.
- Wybierz katalog docelowy odzyskiwania.
- SyncVault odwróci wektor transferu i przywróci Twoje dane z zachowaniem uprawnień.

---

## 🔒 Bezpieczeństwo i dobre praktyki

1. **Montowanie źródeł w trybie `:ro` (Read-Only):**
   Jeśli zadanie ma jedynie tworzyć kopię zapasową danych z Twojego hosta, zamontuj wolumen źródłowy jako `:ro`. Zapobiega to jakiejkolwiek przypadkowej modyfikacji danych źródłowych przez procesy kontenera.
2. **Kopie bezpieczeństwa `.svb`:**
   Przed każdą aktualizacją obrazu kontenera wejdź w `Ustawienia &rarr; Kopia & Docker` i pobierz zaszyfrowaną kopię konfiguracji.
3. **Ochrona uprawnień w systemie Linux:**
   Upewnij się, że użytkownik systemowy kontenera ma prawo zapisu w katalogach docelowych oraz w katalogu `./data`.

---

## 📄 Licencja

Projekt udostępniany na licencji **MIT**. Zapewnia pełną swobodę wdrożenia w środowiskach domowych, komercyjnych i korporacyjnych.
