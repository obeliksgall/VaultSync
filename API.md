# SyncVault — Dokumentacja API

Base URL: `http://<host>:3000`

## Autoryzacja (Bearer Token)

API nie używa cookies — wszystkie chronione endpointy wymagają nagłówka:

```
Authorization: Bearer <token>
```

(alternatywnie token można przekazać jako query param `?token=<token>`, np. do pobierania plików w przeglądarce).

### Jak zdobyć token

**Pierwsze uruchomienie (brak jeszcze żadnego użytkownika):**

```bash
curl -X POST http://localhost:3000/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"minimum6znakow"}'
```

Odpowiedź zawiera `token` — to Twój Bearer token, ważny od razu.

**Kolejne logowania:**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"..."}'
```

Odpowiedź: `{ "success": true, "token": "...", "user": {...} }`.

### Ważność tokenu

- Token jest trzymany **w pamięci procesu** (nie przeżywa restartu/rebuildu kontenera — po restarcie wszyscy muszą zalogować się ponownie).
- Czas wygaśnięcia zależy od ustawienia `autoLogoutTimeout` (30m / 1h / 3h / brak limitu), widocznego w `/api/system/status`.
- Każde żądanie z aktywnością (poza pasywnym pollingiem `/api/jobs` i `/api/system/status`) odświeża `expiresAt`.
- Wylogowanie: `POST /api/auth/logout` (unieważnia token po stronie serwera).
- Ręczne odświeżenie: `POST /api/auth/heartbeat`.

---

## Endpoint informacyjny / healthcheck

### `GET /api` lub `GET /api/health`
Bez autoryzacji. Zwraca status API i listę endpointów (skrócona).

```json
{
  "name": "SyncVault REST API",
  "status": "online",
  "version": "1.0.0",
  "endpoints": { "...": "..." }
}
```

Przydatne do healthchecków Dockera/monitoringu (`HEALTHCHECK CMD curl -f http://localhost:3000/api/health || exit 1`).

### `GET /api/system/status`
Bez autoryzacji (część danych ujawniana jest niezależnie od loginu — status setupu, dostępność rclone/rsync). Jeśli podasz token, doda `currentUser`.

---

## Autentykacja

| Metoda | Ścieżka | Auth | Opis |
|---|---|---|---|
| POST | `/api/auth/setup-admin` | brak | Tworzy pierwsze konto admina (tylko gdy 0 userów) |
| POST | `/api/auth/login` | brak | Logowanie, zwraca token |
| POST | `/api/auth/logout` | Bearer | Unieważnia token |
| POST | `/api/auth/heartbeat` | Bearer | Odświeża czas ważności sesji |
| POST | `/api/auth/change-password` | Bearer | Zmiana własnego hasła |
| POST | `/api/auth/verify-password` | Bearer | Weryfikacja hasła (np. przed akcją krytyczną) |

## Użytkownicy (tylko admin)

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/users` | Lista użytkowników |
| POST | `/api/users` | Nowy użytkownik |
| DELETE | `/api/users/:id` | Usunięcie użytkownika |
| GET/PUT | `/api/users/auto-logout` | Odczyt/ustawienie limitu bezczynności |

## Zadania (Tasks)

| Metoda | Ścieżka | Auth | Opis |
|---|---|---|---|
| GET | `/api/tasks` | user | Lista wszystkich zdefiniowanych zadań |
| GET | `/api/tasks/:id` | user | Szczegóły pojedynczego zadania |
| POST | `/api/tasks` | admin | Utworzenie nowego zadania (automatyczne nadanie unikalnego `taskNumber`) |
| PUT | `/api/tasks/:id` | admin | Edycja zadania (zablokowana gdy zadanie jest w trakcie pracy lub w kolejce) |
| DELETE | `/api/tasks/:id` | admin | Usunięcie zadania (anuluje aktywne procesy, kasuje logi, pliki CSV i historię) |
| POST | `/api/tasks/:id/duplicate` | admin | Zduplikowanie zadania z nową unikalną nazwą i nowym numerem ID |
| POST | `/api/tasks/preview-command` | user | Podgląd wygenerowanej komendy rsync/rclone |
| POST | `/api/tasks/:id/run` | user | Ręczne uruchomienie zadania backupu |
| POST | `/api/tasks/:id/restore` | user | Awaryjne przywrócenie danych (Disaster Recovery) |
| GET | `/api/tasks/:id/files` | user | Lista wygenerowanych raportów CSV w katalogu `data/files/<nr>_<nazwa>/` |
| GET | `/api/tasks/:id/files/download?file=<nazwa>` | user | Pobranie wskazanego pliku CSV |

### Numeracja zadań (`taskNumber`)
Każde zadanie posiada czytelny identyfikator numeryczny (`#1`, `#2`, `#3`...).
- Przy tworzeniu zadania (`POST /api/tasks` lub `/duplicate`) system automatycznie przydziela kolejny unikalny numer (`maxExisting + 1`).
- **Inteligentne cofanie licznika:** Jeśli usunięto zadanie o najwyższym numerze (np. omyłkowo utworzone zadanie `#21`), licznik bazy danych automatycznie cofa się do wartości najwyższego z pozostałych zadań (`#20`). Kolejne nowo utworzone zadanie bez luk otrzyma zwolniony numer (`#21`).

---

## Raporty CSV z wykonania zadań

Aplikacja generuje raporty CSV bezpośrednio z operacji transferu oraz usuwania plików podczas każdego uruchomienia.

- **Lokalizacja na dysku:** `/data/files/<taskNumber>_<safeTaskName>/`
- **Konwencja nazw:**
  - Wysłane pliki: `<YYYY-MM-DD_HH-mm-ss>_<shortJobId>_sent.csv`
  - Usunięte pliki: `<YYYY-MM-DD_HH-mm-ss>_<shortJobId>_deleted.csv`
- **Format:** CSV rozdzielany średnikiem (`;`), kodowanie **UTF-8 z BOM** (zapewnia bezbłędne otwieranie w Microsoft Excel i LibreOffice z obsługą polskich znaków).
- **Kolumny (w zależności od ustawienia `csvHeaderLanguage`):**
  - **Angielski (EN - domyślny):**
    `"Name (full path)";"Destination";"Size";"Modified (mtime)";"Status"`
  - **Polski (PL):**
    `"Nazwa (pełna ścieżka)";"Cel";"Waga";"Data modyfikacji (mtime)";"Status"`
- **Kolumna "Cel" / "Destination":** wskazuje konkretną ścieżkę lub katalog docelowy danej pary ścieżek zadania.

### Endpointy raportów CSV:
- `GET /api/tasks/:id/files` — zwraca tablicę obiektów:
  ```json
  [
    {
      "filename": "2026-09-24_17-30-00_a1b2c3d4_sent.csv",
      "filePath": "files/21_Kopia_NAS/2026-09-24_17-30-00_a1b2c3d4_sent.csv",
      "type": "sent",
      "size": 1420,
      "createdAt": "2026-09-24T15:30:00.000Z"
    }
  ]
  ```
- `GET /api/tasks/:id/files/download?file=<filename>` — bezpośrednie pobranie pliku CSV z nagłówkiem `Content-Disposition: attachment`.
- `GET /api/jobs/:id/csv/:type` — pobranie raportu dla konkretnego zadania (`:type` to `sent` lub `deleted`).

---

## Zadania w toku / historia

| Metoda | Ścieżka | Auth | Opis |
|---|---|---|---|
| GET | `/api/jobs` | user | Aktywne i oczekujące zadania (Job Monitor, domyślny limit konfigurowalny) |
| POST | `/api/jobs/:id/stop` | user | Natychmiastowe zatrzymanie / przerwanie procesu zadania |
| GET | `/api/jobs/:id/logs` | user | Strumień logów zadania (stdout/stderr procesu) |
| GET | `/api/jobs/:id/download-log` | user | Pobranie pliku logu (`.log`) danego wykonania |
| GET | `/api/jobs/:id/csv/:type` | user | Pobranie raportu CSV (`sent` lub `deleted`) dla joba |
| GET | `/api/history` | user | Pełna historia wykonań zadań (opcjonalny parametr `?limit=N`) |

---

## System / logi / Kopie bazy danych

| Metoda | Ścieżka | Auth | Opis |
|---|---|---|---|
| GET | `/api/system/logs` | user | Treść logów serwera/kontenera Docker (opcjonalny parametr `?date=YYYY-MM-DD`) |
| GET | `/api/system/logs/download` | user | Pobranie pliku dziennego logu (`/data/logs/logs_YYYY-MM-DD.log`) |
| GET | `/api/system/db-backups` | admin | Lista automatycznych kopii bazy danych z `/data/backupdb/` |
| GET | `/api/system/db-backups/download?file=<nazwa>` | admin | Pobranie wskazanego pliku kopii bazy (`syncvault-db_*.json`) |
| GET | `/api/fs/browse` | user | Przeglądarka systemu plików kontenera (`?path=/ścieżka`) do wyboru folderów |

### Automatyczne kopie bazy danych (`/data/backupdb/`)
Przed każdą modyfikacją pliku bazy `syncvault-db.json` (dodaniem/edycją/usunięciem zadania, użytkownika, hasła, ustawień) SyncVault automatycznie odkłada migawkę stanu do `/data/backupdb/syncvault-db_YYYY-MM-DD_HH-mm-ss.json`.
- **Retencja czasowa (`dbBackupRetentionDays`):** domyślnie 14 dni.
- **Twarda gwarancja ochrony (`dbBackupMinCopies`):** domyślnie min. 14 kopii. Nawet jeśli minęło więcej niż 14 dni, system **nigdy nie usunie** kopii, jeżeli w katalogu zostanie ich 14 lub mniej.

---

## Rclone / Ustawienia / Audyt

| Metoda | Ścieżka | Auth | Opis |
|---|---|---|---|
| GET/POST | `/api/rclone/config` | admin | Odczyt i zapis konfiguracji zdalnych zasobów chmurowych `rclone.conf` |
| GET | `/api/settings` | user | Odczyt parametrów globalnych systemu |
| PUT | `/api/settings` | admin | Aktualizacja ustawień globalnych (wymusza też czyszczenie retencyjne CSV) |
| POST | `/api/settings/test-notification` | admin | Test wysyłki powiadomienia (`{"type":"discord"|"ntfy"|"email"}`) |
| GET | `/api/audit` | admin | Dziennik audytu operacji administracyjnych i systemowych |
| POST | `/api/audit/clear` | admin | Wyczyszczenie historii dziennika audytu |

### Kluczowe pola w `/api/settings`:
```json
{
  "maxConcurrentJobs": 2,
  "queueStartDelaySeconds": 5,
  "jobMonitorLimit": 25,
  "historyLimit": 250,
  "defaultLogRetentionDays": 30,
  "defaultTrashRetentionDays": 14,
  "csvReportRetentionDays": 7,
  "csvHeaderLanguage": "en",
  "dbBackupRetentionDays": 14,
  "dbBackupMinCopies": 14,
  "auditLogRetentionDays": 30,
  "auditLogMaxEntries": 2000,
  "autoLogoutTimeout": "30m",
  "unlimitedDays": 7,
  "theme": "dark",
  "language": "pl",
  "notifications": {
    "discordWebhookUrl": "...",
    "ntfyUrl": "...",
    "smtpHost": "...",
    "smtpPort": 587,
    "smtpUser": "...",
    "smtpPass": "...",
    "smtpFrom": "...",
    "notifyEmailTo": "..."
  }
}
```
- **`queueStartDelaySeconds`**: liczba sekund odstępu (bufora) po zakończeniu zadania, zanim ruszy kolejne zadanie oczekujące w kolejce (domyślnie `5`, `0` = natychmiast).
- **`csvReportRetentionDays`**: liczba dni retencji plików CSV w `/data/files/` (`0` = bez usuwania).
- **`csvHeaderLanguage`**: `'en'` (domyślny angielski) lub `'pl'` (polskie nagłówki kolumn w CSV).

## Kopia zapasowa konfiguracji (.svb)

| Metoda | Ścieżka | Auth | Opis |
|---|---|---|---|
| POST | `/api/config/export` | admin | Eksport zaszyfrowanej konfiguracji (.svb) |
| POST | `/api/config/import` | admin | Import zaszyfrowanej konfiguracji (.svb) |

---

## Przykład: pełny przepływ curl

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"haslo123"}' | jq -r .token)

curl -s http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN" | jq .
```
