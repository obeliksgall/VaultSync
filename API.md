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
| GET | `/api/tasks` | user | Lista zadań |
| GET | `/api/tasks/:id` | user | Szczegóły zadania |
| POST | `/api/tasks` | admin | Nowe zadanie |
| PUT | `/api/tasks/:id` | admin | Edycja zadania |
| DELETE | `/api/tasks/:id` | admin | Usunięcie zadania (kasuje też jego logi/pliki) |
| POST | `/api/tasks/:id/duplicate` | admin | Duplikat zadania |
| POST | `/api/tasks/preview-command` | user | Podgląd komendy rsync/rclone |
| POST | `/api/tasks/:id/run` | user | Uruchomienie zadania |
| POST | `/api/tasks/:id/restore` | user | Przywracanie (disaster recovery) |
| GET | `/api/tasks/:id/files` | user | Lista wygenerowanych raportów CSV |
| GET | `/api/tasks/:id/files/download` | user | Pobranie raportu CSV |

## Zadania w toku / historia

| Metoda | Ścieżka | Auth | Opis |
|---|---|---|---|
| GET | `/api/jobs` | user | Aktywne/kolejkowane zadania (Job Monitor) |
| POST | `/api/jobs/:id/stop` | user | Zatrzymanie zadania |
| GET | `/api/jobs/:id/logs` | user | Strumień logów zadania |
| GET | `/api/jobs/:id/download-log` | user | Pobranie pliku logu |
| GET | `/api/jobs/:id/csv/:type` | user | Pobranie CSV (wyslane/usuniete) dla joba |
| GET | `/api/history` | user | Historia wykonań |

## System / logi

| Metoda | Ścieżka | Auth | Opis |
|---|---|---|---|
| GET | `/api/system/logs` | user | Lista/treść logów serwera (`/data/logs/logs_YYYY-MM-DD.log`) |
| GET | `/api/system/logs/download` | user | Pobranie pliku logu serwera |
| GET | `/api/fs/browse` | user | Przeglądarka katalogów (do wyboru ścieżek source/destination) |

## Rclone / Ustawienia / Audyt

| Metoda | Ścieżka | Auth | Opis |
|---|---|---|---|
| GET/POST | `/api/rclone/config` | admin | Odczyt/zapis `rclone.conf` |
| GET | `/api/settings` | user | Ustawienia globalne |
| PUT | `/api/settings` | admin | Aktualizacja ustawień |
| POST | `/api/settings/test-notification` | admin | Test powiadomienia (Discord/ntfy/SMTP) |
| GET | `/api/audit` | admin | Dziennik audytu |
| POST | `/api/audit/clear` | admin | Czyszczenie dziennika audytu |

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
