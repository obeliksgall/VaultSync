# SyncVault – Kompletny Plan Testów i Scenariusze QA (TESTs.md)

Dokument zawiera szczegółowy spis procedur testowych (krok po kroku) pozwalających na pełną weryfikację funkcjonalną, wizualną i operacyjną platformy **SyncVault**.

Każdy przypadek testowy składa się z:
- **Celu testu**
- **Kroków do wykonania (Co zrobić)**
- **Kryteriów weryfikacji (Co sprawdzić)**
- **Oczekiwanego rezultatu**

---

## SPIS TREŚCI

1. [Środowisko i Pierwsze Uruchomienie](#1-środowisko-i-pierwsze-uruchomienie)
2. [Uwierzytelnianie, Bezpieczeństwo i Zarządzanie Sesją](#2-uwierzytelnianie-bezpieczeństwo-i-zarządzanie-sesją)
3. [Zarządzanie Użytkownikami i Uprawnienia (RBAC)](#3-zarządzanie-użytkownikami-i-uprawnienia-rbac)
4. [Tworzenie i Konfiguracja Zadania Synchronizacji](#4-tworzenie-i-konfiguracja-zadania-synchronizacji)
5. [Raporty CSV z Wykonania Zadań (Wysłane / Usunięte Pliki)](#5-raporty-csv-z-wykonania-zadań-wysłane--usunięte-pliki)
6. [Ręczne Uruchomienie i Monitor Zadań (Job Monitor)](#6-ręczne-uruchomienie-i-monitor-zadań-job-monitor)
7. [Wielokrotne Harmonogramy Automatyczne (Multi-CRON Daemon)](#7-wielokrotne-harmonogramy-automatyczne-multi-cron-daemon)
8. [Procedura Przywracania Awaryjnego (Disaster Recovery / Restore)](#8-procedura-przywracania-awaryjnego-disaster-recovery--restore)
9. [Historia Wykonań, Logi i Retencja](#9-historia-wykonań-logi-i-retencja)
10. [Ustawienia Globalne, Limity i Powiadomienia Zewnętrzne](#10-ustawienia-globalne-limity-i-powiadomienia-zewnętrzne)
11. [Dziennik Audytu (Audit Log)](#11-dziennik-audytu-audit-log)
12. [Szyfrowany Eksport i Import Konfiguracji (AES-256-GCM)](#12-szyfrowany-eksport-i-import-konfiguracji-aes-256-gcm)
13. [Weryfikacja Trybu Ciemnego i Interfejsu (Dark Mode & UI)](#13-weryfikacja-trybu-ciemnego-i-interfejsu-dark-mode--ui)

---

## 1. Środowisko i Pierwsze Uruchomienie

### TEST-01: Uruchomienie kontenera i weryfikacja bazodanowa
* **Co zrobić:**
  1. Uruchom aplikację komendą kontenera lub `npm run dev`.
  2. Sprawdź zawartość katalogu `data/`.
* **Co sprawdzić:**
  - Czy w katalogu `data/` utworzyły się pliki modułowej bazy danych: `syncvault-db.json`, `syncvault-history.json`, `syncvault-audit.json`.
  - Czy konsola serwera zgłasza gotowość na porcie `3000`.
  - Czy zainicjalizowany został daemon harmonogramu (`[Scheduler] Background job scheduler initialized.`).
* **Oczekiwany rezultat:**
  Aplikacja startuje bez błędów, struktura katalogów `data/` i `data/files/` zostaje automatycznie zainicjalizowana.

---

## 2. Uwierzytelnianie, Bezpieczeństwo i Zarządzanie Sesją

### TEST-02: Pierwsze logowanie kontem domyślnym
* **Co zrobić:**
  1. Wejdź na adres aplikacji w przeglądarce.
  2. Wprowadź login: `admin` i hasło: `admin123`.
  3. Kliknij "Zaloguj się".
* **Co sprawdzić:**
  - Czy pojawił się komunikat o pomyślnym logowaniu.
  - Czy aplikacja natychmiast przenosi do głównego widoku Zadań.
  - Czy w prawym górnym rogu wyświetla się nazwa użytkownika `admin` z etykietą `ADMIN`.
* **Oczekiwany rezultat:**
  Poprawne uwierzytelnienie, token sesji zapisany w bezpiecznym storage, widoczne menu administracyjne.

### TEST-03: Wskaźnik i licznik czasu sesji (Top Bar)
* **Co zrobić:**
  1. Zaloguj się do systemu.
  2. Zwróć uwagę na prawy górny róg paska nawigacyjnego (obok przycisku "Zmień hasło" i "Wyloguj").
* **Co sprawdzić:**
  - Czy wyświetla się klepsydra/zegar z odliczającym czasem (np. `29:58`, `29:57`...).
  - Czy po najechaniu kursorem wyświetla się tooltip informujący o wybranym trybie limitu sesji.
* **Oczekiwany rezultat:**
  Licznik czasu sesji stale odlicza sekundy do wygaśnięcia.

### TEST-04: Automatyczne odnawianie sesji przy aktywności (Activity Renewal)
* **Co zrobić:**
  1. Odczekaj aż licznik sesji spadnie o kilkanaście sekund (np. z `30:00` do `29:40`).
  2. Porusz myszką, kliknij dowolną zakładkę (np. "Historia") lub naciśnij klawisz na klawiaturze.
* **Co sprawdzić:**
  - Czy w tle zostaje wysłany lekki heartbeat `/api/auth/renew`.
  - Czy licznik sesji w nagłówku powraca do pełnej wartości początkowej (np. ponownie `30:00`).
* **Oczekiwany rezultat:**
  Każda interakcja użytkownika płynnie przedłuża aktywną sesję, zabezpieczając przed przypadkowym wylogowaniem w trakcie pracy.

### TEST-05: Konfiguracja limitu sesji i tryb Unlimited
* **Co zrobić:**
  1. Przejdź do zakładki "Użytkownicy".
  2. W sekcji "Automatyczne wylogowanie sesji" przetestuj wybór kafelków:
     - `30 min` (domyślny)
     - `1 godzina (1h)`
     - `3 godziny (3h)`
     - `Unlimited / Stała (od 1 do 28 dni)`
  3. Dla trybu `Unlimited` wybierz suwakiem np. `14 dni` i kliknij "Zapisz".
  4. Odśwież stronę (F5).
* **Co sprawdzić:**
  - Czy w nagłówku czas sesji dostosował się do nowego limitu (np. przy 1h pokazuje `60:00`, a przy 14 dniach `14d`).
  - Czy po odświeżeniu strony ustawienie zostało zachowane w bazie `syncvault-db.json`.
* **Oczekiwany rezultat:**
  Ustawienie czasu sesji zapisuje się trwale i wpływa natychmiast na czas ważności tokenów użytkowników.

---

## 3. Zarządzanie Użytkownikami i Uprawnienia (RBAC)

### TEST-06: Utworzenie operatora bez praw administratora (Rola: User)
* **Co zrobić:**
  1. Będąc zalogowanym jako `admin`, przejdź do zakładki "Użytkownicy".
  2. Kliknij "+ Nowy użytkownik".
  3. Podaj login: `operator1`, hasło: `operator123`, rola: `Użytkownik (Tylko zadania & monitor)`.
  4. Zapisz użytkownika.
  5. Wyloguj się i zaloguj kontem `operator1`.
* **Co sprawdzić:**
  - Czy użytkownik `operator1` **NIE MA** dostępu do edycji ustawień globalnych.
  - Czy przyciski "Nowe zadanie", "Edytuj", "Usuń" oraz "Duplikuj" są ukryte lub nieaktywne dla roli `user`.
  - Czy użytkownik `operator1` może uruchamiać zadania ("Uruchom kopię"), przywracać kopie ("Przywróć") i oglądać Job Monitor.
  - Czy użytkownik `operator1` nie może modyfikować kont innych użytkowników.
* **Oczekiwany rezultat:**
  Ścisła separacja uprawnień RBAC – operator ma dostęp wykonawczy, administrator posiada pełny dostęp konfiguracyjny.

### TEST-07: Zmiana hasła i blokady bezpieczeństwa
* **Co zrobić:**
  1. Kliknij "Zmień hasło" w nagłówku.
  2. Wpisz dotychczasowe hasło oraz nowe hasło (np. krótsze niż 6 znaków).
  3. Spróbuj zatwierdzić. Następnie wprowadź prawidłowe hasło (min. 6 znaków) i zapisz.
  4. Sprawdź próbę usunięcia własnego konta w zakładce "Użytkownicy".
* **Co sprawdzić:**
  - Walidacja minimalnej długości hasła blokuje formularz.
  - Przycisk kosza (usuń) przy własnym aktualnie zalogowanym koncie jest niedostępny.
  - Po zmianie hasła logowanie nowym hasłem działa poprawnie.
* **Oczekiwany rezultat:**
  Brak możliwości zablokowania samego siebie, poprawna weryfikacja i zmiana poświadczeń.

---

## 4. Tworzenie i Konfiguracja Zadania Synchronizacji

### TEST-08: Tworzenie zadania Rsync (Lokalne / NAS)
* **Co zrobić:**
  1. W widoku "Zadania" kliknij "+ Nowe zadanie".
  2. Uzupełnij dane podstawowe:
     - **Nazwa:** `Kopia Dokumentów Rsync`
     - **Opis:** `Testowa kopia lokalna`
     - **Silnik:** `rsync`
     - **Typ synchronizacji:** `Mirror / Sync (Lustro)`
     - **Pary ścieżek:**
       - Źródło: `/data/test_src/`
       - Cel: `/data/test_dst/`
  3. Kliknij "+ Dodaj kolejną parę ścieżek" i skonfiguruj drugą parę (np. `/data/test_src2/` -> `/data/test_dst2/`).
* **Co sprawdzić:**
  - Czy można dodawać i usuwać wiele par ścieżek.
  - Czy podgląd komendy na żywo u dołu modala generuje poprawne polecenie `rsync -avh --delete ...`.
* **Oczekiwany rezultat:**
  Zadanie zapisuje się pomyślnie i pojawia na liście z unikalnym numerem `#ID`.

### TEST-09: Tworzenie zadania Rclone (Chmura / S3 / Remote)
* **Co zrobić:**
  1. Utwórz nowe zadanie, wybierając silnik: `rclone`.
  2. Wprowadź parę ścieżek ze zdalnym zasobem (np. `/data/local_folder/` -> `gdrive:backup_folder/`).
  3. Sprawdź tryby synchronizacji: `Copy`, `Mirror / Sync`, `Move`.
* **Co sprawdzić:**
  - Przy `copy` komenda rclone to: `rclone copy ...`.
  - Przy `mirror` komenda to: `rclone sync ...`.
  - Przy `move` komenda to: `rclone move ...`.
* **Oczekiwany rezultat:**
  Aplikacja bezbłędnie parsuje i składa argumenty narzędzia rclone z uwzględnieniem konfiguracji `rclone.conf`.

### TEST-10: Zaawansowane filtry wykluczeń (Exclude) i Kosz (Trash)
* **Co zrobić:**
  1. W edycji zadania przejdź do zakładki "Zaawansowane / Opcje".
  2. W sekcji "Wykluczenia katalogów / plików (exclude)" przetestuj wzorce zgodnie z dokumentem `EXCLUDE_FILTERS.md`:
     - `*.tmp` (wszystkie pliki tymczasowe)
     - `/pliki1/*.tmp2` (pliki .tmp2 tylko w katalogu głównym /pliki1/)
     - `**/temp5*/**` lub `*temp5*` (katalogi zawierające w nazwie temp5)
     - `.git/` oraz `node_modules/`
  3. W sekcji "Kosz (Trash)" zaznacz "Włącz wersjonowanie / kosz dla usuwanych plików".
  4. Ustaw liczbę dni retencji kosza: `14`.
* **Co sprawdzić:**
  - Czy ramka wykluczeń i ramka kosza mają spójny, elegancki styl wizualny.
  - Czy komenda w podglądzie zawiera argumenty `--exclude "*.tmp"` oraz `--backup-dir` (kierujący do podfolderu `_TRASH/YYYY-MM-DD`).
* **Oczekiwany rezultat:**
  Pliki spełniające reguły exclude nie są synchronizowane, a pliki usuwane ze źródła trafiają do izolowanego folderu kosza z datą.

### TEST-11: Konfiguracja raportów CSV i transliteracji powiadomień
* **Co zrobić:**
  1. W oknie edycji zadania przejdź do zakładki "Powiadomienia i Raporty".
  2. W ramce "Generowanie plików CSV (z wykonania zadania)" zaznacz:
     - [x] **Wysłane** (Plik CSV z wysłanymi plikami)
     - [x] **Usunięte** (Plik CSV z usuniętymi plikami)
  3. W ramce "Kanały powiadomień" zaznacz Discord i E-mail.
  4. Wprowadź polskie znaki w polach (np. `Kopia zapasowa: żółć, gęślą jaźń`).
* **Co sprawdzić:**
  - Czy kafelki opcji są czytelne i posiadają ciemne tło w Dark Mode.
  - Czy przy powiadomieniu Discord / E-mail polskie znaki są automatycznie transliterowane zgodnie z konfiguracją (`zolc, gesla jazn`).
* **Oczekiwany rezultat:**
  Zadanie zostaje skonfigurowane do automatycznego generowania raportów CSV oraz wysyłki powiadomień bez problemów z kodowaniem znaków.

---

## 5. Raporty CSV z Wykonania Zadań (Wysłane / Usunięte Pliki)

### TEST-12: Generowanie i podgląd raportu z wykonania zadania
* **Co zrobić:**
  1. Przygotuj w folderze źródłowym pliki testowe (np. 4 pliki tekstowe). Folder docelowy pozostaw pusty.
  2. Uruchom zadanie z włączonym generowaniem raportów CSV.
  3. Po pomyślnym wykonaniu kliknij zieloną ikonę arkusza kalkulacyjnego (`FileSpreadsheet`) w wierszu zadania.
* **Co sprawdzić:**
  - Czy w oknie "Raporty CSV z wykonania zadań" widoczna jest **jedna spójna sekcja** dla danego uruchomienia (np. `2026-09-24 17:30:15`).
  - Czy wygenerowane pliki posiadają nazwy wg konwencji: `<YYYY-MM-DD_HH-mm-ss>_<shortJobId>_sent.csv` oraz `_deleted.csv`.
  - Czy raport Wysłanych zawiera dokładnie 4 przetransferowane pliki ze statusem `OK`.
  - Czy raport Usuniętych wskazuje brak plików do usunięcia (lub pustą listę / brak nieistniejących wpisów).
* **Oczekiwany rezultat:**
  Sekcja pojedynczego uruchomienia grupuje pliki raportu z rzeczywistego wykonania.

### TEST-13: Weryfikacja formatu CSV, nowej kolumny "Cel" i przełącznika języka nagłówków
* **Co zrobić:**
  1. W oknie raportów CSV kliknij przycisk "Pobierz plik CSV" dla wysłanych.
  2. Następnie kliknij "Pobierz oba raporty (ZIP)".
  3. Otwórz pobrany plik CSV w arkuszu (Excel / LibreOffice Calc) lub edytorze tekstu.
  4. Przejdź do **Ustawienia &rarr; Parametry wykonania i limity &rarr; Język nagłówków raportów CSV**:
     - Przetestuj ustawienie domyślne: `Angielski (EN)`.
     - Przełącz na `Polski (PL)`, uruchom ponowny transfer i pobierz nowy raport CSV.
* **Co sprawdzić:**
  - Czy separatorem kolumn jest średnik `;`.
  - Czy plik posiada 5 kolumn wraz z **kolumną Celu / Miejsca docelowego**:
    - Przy języku EN (domyślny): `"Name (full path)";"Destination";"Size";"Modified (mtime)";"Status"`.
    - Przy języku PL: `"Nazwa (pełna ścieżka)";"Cel";"Waga";"Data modyfikacji (mtime)";"Status"`.
  - Czy w kolumnie "Cel" / "Destination" widnieje poprawna ścieżka docelowa dla danej pary ścieżek zadania.
  - Czy wagi plików są sformatowane czytelnie z dokładną liczbą bajtów (np. `10.02 KB (10256 B)`).
  - Czy archiwum ZIP zawiera pliki CSV z poprawnymi nazwami zawierającymi datę i identyfikator.
* **Oczekiwany rezultat:**
  Poprawny format CSV z kolumną Celu, brak problemów z polskimi znakami diakrytycznymi (UTF-8 z BOM), działający przełącznik języka nagłówków.

### TEST-14: Paginacja raportów CSV (5 uruchomień na stronę)
* **Co zrobić:**
  1. Wykonaj zadanie testowe 6-7 razy (aby wygenerować więcej niż 5 par raportów).
  2. Otwórz okno "Pobierz raporty CSV".
* **Co sprawdzić:**
  - Czy na pierwszej stronie wyświetla się dokładnie 5 najświeższych kafelków uruchomień.
  - Czy u dołu okna pojawia się pasek paginacji: `Strona 1 z 2` oraz przyciski "Poprzednia" / "Następna".
  - Czy kliknięcie "Następna" płynnie przełącza na pozostałe starsze raporty.
* **Oczekiwany rezultat:**
  Paginacja zapobiega przepełnieniu okna modalnego i działa responsywnie.

### TEST-14b: Usuwanie zadania, czyszczenie katalogów logs/files oraz usuwanie historii i job monitora
* **Co zrobić:**
  1. Utwórz zadanie testowe i uruchom je przynajmniej raz (aby powstały logi, raporty CSV oraz wpisy w Monitorze zadań i Historii).
  2. Sprawdź na dysku obecność folderów: `data/logs/<nrZadania>_<nazwaZadania>/` oraz `data/files/<nrZadania>_<nazwaZadania>/`.
  3. Upewnij się, że wykonane zadanie widoczne jest w zakładce "Monitor zadań" oraz "Historia".
  4. W widoku zadań kliknij ikonę kosza (Usuń) przy tym zadaniu.
  5. Zapoznaj się z ostrzeżeniem w modalu i potwierdź usunięcie czerwonym przyciskiem "Usuń zadanie".
* **Co sprawdzić:**
  - Czy zadanie natychmiast znika z listy zadań w interfejsie.
  - Czy znikają wszelkie wpisy powiązane z tym zadaniem z widoków "Monitor zadań" oraz "Historia".
  - Czy wpis usunięcia pojawia się w Dzienniku Audytu (Zdarzenie `DELETE_TASK`).
  - Czy oba powiązane katalogi na dysku (`data/logs/...` oraz `data/files/...`) zostały całkowicie i fizycznie usunięte.
  - Czy plik bazy `syncvault-history.json` nie zawiera już osieroconych rekordów skasowanego zadania.
* **Oczekiwany rezultat:**
  Skasowanie zadania całkowicie zwalnia zasoby dyskowe (katalogi logów i plików raportów) oraz usuwa całą historię wykonania i pozycje w monitorze zadań – nie pozostawia żadnych osieroconych danych.

### TEST-14c: Inteligentna numeracja zadań (#ID) i brak luk przy usuwaniu zadania
* **Co zrobić:**
  1. Sprawdź numer ostatniego zadania (np. zadanie `#20`).
  2. Kliknij "Duplikuj" lub "+ Nowe zadanie" – nowe zadanie otrzymuje kolejny numer: `#21`.
  3. Usuń zadanie `#21` za pomocą ikony kosza.
  4. Kliknij "+ Nowe zadanie" lub "Duplikuj" inne zadanie.
* **Co sprawdzić:**
  - Czy po usunięciu zadania `#21` licznik w bazie danych cofa się do wartości najwyższego istniejącego zadania (`#20`).
  - Czy nowo utworzone zadanie otrzymuje ponownie numer `#21` (zamiast przeskakiwać na `#22`).
* **Oczekiwany rezultat:**
  Brak powstawania sztucznych luk w numeracji zadań po usunięciu ostatniego/najwyższego zadania.

---

## 6. Ręczne Uruchomienie i Monitor Zadań (Job Monitor)

### TEST-15: Ręczne uruchomienie i blokada kolizji
* **Co zrobić:**
  1. Kliknij niebieski przycisk "Uruchom kopię" (Run Now) przy wybranym zadaniu.
  2. Obserwuj stan wiersza zadania w trakcie trwania transferu.
* **Co sprawdzić:**
  - Czy przycisk zmienia się na pulsujący stan "Wykonywanie..." z ikoną oczekiwania.
  - Czy przycisk "Edytuj", "Usuń" oraz "Przywróć" zostają zablokowane (wyszarzone z tooltipem informującym o trwającym zadaniu).
  - Czy próba powtórnego kliknięcia uruchomienia nie tworzy zduplikowanego procesu tego samego zadania.
* **Oczekiwany rezultat:**
  Bezpieczna blokada kolizji – zadanie wykonuje się atomowo, uniemożliwiając uszkodzenie konfiguracji w trakcie zapisu.

### TEST-16: Podgląd na żywo w zakładce Job Monitor
* **Co zrobić:**
  1. Uruchom zadanie synchronizujące większą ilość danych (lub plik o wadze kilkuset megabajtów).
  2. Przejdź natychmiast do zakładki "Job Monitor".
* **Co sprawdzić:**
  - Pasek ogólnego postępu procentowego (0% -> 100%).
  - Licznik przesłanych megabajtów / gigabajtów.
  - Aktualną prędkość transferu (np. `12.4 MB/s`) oraz przewidywany czas do końca (ETA).
  - Listę aktualnie kopiowanych plików.
  - Okno terminala (Live CLI Console) ze strumieniowanymi liniami stdout/stderr silnika rsync/rclone.
* **Oczekiwany rezultat:**
  Telemetria na żywo bez konieczności odświeżania strony.

### TEST-17: Awaryjne przerwanie zadania (Cancel Job)
* **Co zrobić:**
  1. Podczas aktywnego transferu w zakładce "Job Monitor" kliknij czerwony przycisk "Zatrzymaj" / "Przerwij".
  2. Potwierdź chęć przerwania.
* **Co sprawdzić:**
  - Czy proces systemowy rsync/rclone zostaje natychmiast ubity sygnałem SIGTERM/SIGKILL.
  - Czy status zadania w historii zmienia się na `aborted` / `cancelled`.
  - Czy przyciski w widoku zadań powracają do stanu aktywnego.
* **Oczekiwany rezultat:**
  Błyskawiczne i bezpieczne zatrzymanie procesu transferu na żądanie operatora.

---

## 7. Wielokrotne Harmonogramy Automatyczne (Multi-CRON Daemon)

### TEST-18: Dodanie harmonogramu dziennego i tygodniowego
* **Co zrobić:**
  1. Otwórz edycję zadania, przejdź do zakładki "Harmonogram".
  2. Upewnij się, że opcja "Włącz harmonogram" jest aktywna.
  3. Kliknij "+ Dodaj harmonogram":
     - Wybierz typ: `Codziennie`, godzina: np. za 2 minuty od aktualnego czasu lokalnego.
  4. Dodaj drugi harmonogram:
     - Wybierz typ: `Co tydzień`, zaznacz bieżący dzień tygodnia (np. Wtorek) oraz godzinę.
  5. Zapisz zadanie.
* **Co sprawdzić:**
  - Czy w wierszu zadania pojawia się informacja: `2 harmonogramy`.
  - Odczekaj wskazaną minutę bez dotykania aplikacji.
  - Czy w konsoli serwera pojawia się log: `[Scheduler] Triggering task... from schedule`.
  - Czy zadanie samoczynnie startuje i zapisuje log w historii z oznaczeniem wyzwalacza `harmonogram:daily`.
* **Oczekiwany rezultat:**
  Wewnętrzny daemon weryfikuje reguły co 30 sekund i uruchamia zadania punktualnie co do minuty.

### TEST-19: Harmonogram cykliczny (Interval na stałej siatce doby)
* **Co zrobić:**
  1. Skonfiguruj regułę typu `Cyklicznie (Interval)` z parametrem np. `00:15` (co 15 minut) lub `01:00` (co godzinę).
* **Co sprawdzić:**
  - Czy harmonogram wylicza punkty startowe od północy (`00:00`, `00:15`, `00:30`, `00:45`...).
* **Oczekiwany rezultat:**
  Prawidłowe wyznaczanie punktów siatki dobowej bez dryfu czasowego.

---

## 8. Procedura Przywracania Awaryjnego (Disaster Recovery / Restore)

### TEST-20: Wykonanie przywracania danych (Restore)
* **Co zrobić:**
  1. Upewnij się, że zadanie ma włączoną opcję "Zezwól na przywracanie (Restore)".
  2. W widoku zadań kliknij bursztynowy przycisk "Przywróć" (Restore).
  3. Potwierdź chęć odwrócenia wektorów ścieżek.
* **Co sprawdzić:**
  - Czy cel staje się źródłem, a źródło celem (`Destination ➔ Source`).
  - Czy operacja restore wykonuje się bezpiecznym trybem `copy` (nigdy nie usuwa plików z odzyskiwanego źródła, zabezpieczając przed przypadkowym skasowaniem ocalałych danych).
  - Czy log w historii ma wyraźny identyfikator `RESTORE`.
* **Oczekiwany rezultat:**
  Pliki z kopii zapasowej zostają zrekonstruowane w lokalizacji źródłowej.

### TEST-21: Blokada przywracania dla wyłączonej opcji
* **Co zrobić:**
  1. Wejdź w edycję zadania i odznacz opcję "Zezwól na przywracanie danych (Restore)".
  2. Zapisz zadanie i spójrz na wiersz zadania w tabeli.
* **Co sprawdzić:**
  - Czy przycisk "Przywróć" jest wyszarzony/zablokowany (`disabled`), a nie ukryty.
  - Czy po najechaniu kursorem wyświetla się informacja: *"Przywracanie jest wyłączone dla tego zadania w konfiguracji"*.
* **Oczekiwany rezultat:**
  Zgodnie z wymaganiem przycisk pozostaje widoczny, lecz nieaktywny, informując operatora o stanie blokady.

---

## 9. Historia Wykonań, Logi i Retencja

### TEST-22: Weryfikacja logów i pobieranie pliku wykonania
* **Co zrobić:**
  1. Przejdź do zakładki "Historia".
  2. Kliknij na dowolne ukończone zadanie.
* **Co sprawdzić:**
  - Czy rozwija się pełny podgląd szczegółów: czas startu, czas trwania, ilość przesłanych danych, status końcowy.
  - Czy dostępny jest przycisk "Pobierz pełny log (.log)".
  - Czy pobrany plik tekstowy zawiera dokładny zapis konsolowy wykonania.
* **Oczekiwany rezultat:**
  Kompletna transparentność diagnostyczna każdego wykonanego procesu.

### TEST-23: Niezależna retencja logów historii oraz raportów CSV
* **Co zrobić:**
  1. Przejdź do "Ustawienia" -> "Ogólne i limity".
  2. Skonfiguruj:
     - **Limit historii zadań:** `30 dni`
     - **Limit przechowywania raportów CSV:** `7 dni`
  3. Zapisz ustawienia.
  4. Sprawdź opcjonalne nadpisanie limitu dni w konkretnym zadaniu (sekcja Filtry i Retencja).
* **Co sprawdzić:**
  - Czy raporty CSV starsze niż 7 dni są usuwane z katalogu `data/files/<id_nazwa>/`.
  - Czy wpisy historii starsze niż 30 dni są usuwane z `syncvault-history.json`.
* **Oczekiwany rezultat:**
  Rozdzielona retencja – ciężkie raporty CSV można czyścić częściej niż lekkie wpisy historii zadań.

---

## 10. Ustawienia Globalne, Limity i Powiadomienia Zewnętrzne

### TEST-24: Limit współbieżności zadań (Concurrency Limit)
* **Co zrobić:**
  1. W "Ustawienia" ustaw "Maksymalna liczba zadań w tle" na `1`.
  2. Zapisz ustawienia.
  3. Uruchom jednocześnie dwa różne zadania synchronizacji.
* **Co sprawdzić:**
  - Czy pierwsze zadanie przechodzi w stan aktywny (`running`).
  - Czy drugie zadanie przechodzi w stan oczekiwania w kolejce (`queued`).
  - Czy po ukończeniu pierwszego zadania, drugie zadanie rozpoczyna transfer po uwzględnieniu bufora odstępu.
* **Oczekiwany rezultat:**
  Kolejkowanie FIFO zapobiega przeciążeniu dysków i łącza sieciowego.

### TEST-24b: Odstęp czasowy przed startem kolejnego zadania z kolejki (Queue Start Delay)
* **Co zrobić:**
  1. W "Ustawienia" -> "Parametry wykonania i limity" ustaw "Odstęp przed kolejnym zadaniem" na `5` sekund (lub skonfiguruj parametr `queueStartDelaySeconds`).
  2. Uruchom zadanie, a następnie kolejne zadanie (lub skonfiguruj chaining "Uruchom po zakończeniu").
  3. Po zakończeniu pierwszego zadania obserwuj stan drugiego zadania w Monitorze Zadań (Job Monitor).
* **Co sprawdzić:**
  - Czy w kafelku oczekującego zadania wyświetla się żółty wskaźnik/odliczanie bufora: `Oczekiwanie na start (odstęp: 5s, 4s, 3s...)`.
  - Czy kolejne zadanie nie startuje w ułamku sekundy, lecz odczekuje zdefiniowane 5 sekund dając dyskom/chmurze czas na zwolnienie blokad (breather).
  - Czy po upływie odliczanego czasu zadanie płynnie przechodzi w stan aktywny (`running`).
* **Oczekiwany rezultat:**
  Precyzyjne i wizualnie czytelne odliczanie bufora bezpieczeństwa między kolejkowanymi zadaniami.

### TEST-25: Test powiadomień zewnętrznych (Discord, ntfy.sh, E-mail)
* **Co zrobić:**
  1. W "Ustawienia" -> "Powiadomienia zewnętrzne" skonfiguruj:
     - URL webhooka Discord
     - Temat/Topic ntfy.sh
     - Parametry serwera SMTP (host, port, użytkownik, hasło, odbiorca)
  2. Kliknij przycisk testowy przy każdej usłudze ("Wyślij test").
* **Co sprawdzić:**
  - Czy na kanale Discord pojawia się sformatowany embed ze statusem testu.
  - Czy na telefonie/przeglądarce pojawia się push z ntfy.
  - Czy do skrzynki trafia wiadomość e-mail.
* **Oczekiwany rezultat:**
  Wszystkie integracje zewnętrzne potwierdzają nawiązanie łączności komunikatem sukcesu.

---

## 11. Dziennik Audytu (Audit Log)

### TEST-26: Transparentność operacji użytkowników
* **Co zrobić:**
  1. Przejdź do zakładki "Audyt".
  2. Wykonaj kilka akcji: zmianę hasła, utworzenie nowego zadania, modyfikację limitu sesji, uruchomienie kopii.
  3. Odśwież widok audytu.
* **Co sprawdzić:**
  - Czy każda wykonana akcja posiada swój wpis z dokładnym znacznikiem czasu, nazwą użytkownika, adresem IP oraz szczegółami operacji (np. `TASK_CREATE`, `AUTH_LOGIN`, `SETTINGS_UPDATE`).
  - Czy działa wyszukiwarka oraz filtrowanie po typie zdarzenia.
  - Czy na górze widnieje pasek z informacją o polityce retencji wpisów audytowych.
* **Oczekiwany rezultat:**
  Niezaprzeczalny, chronologiczny rejestr wszystkich istotnych operacji administracyjnych.

---

## 12. Szyfrowany Eksport i Import Konfiguracji (AES-256-GCM)

### TEST-27: Eksport konfiguracji z hasłem
* **Co zrobić:**
  1. Przejdź do "Ustawienia" -> "Kopia zapasowa konfiguracji (Backup)".
  2. Wprowadź bezpieczne hasło szyfrowania (np. `MojeMocneHaslo2026!`).
  3. Kliknij "Eksportuj zaszyfrowaną konfigurację".
* **Co sprawdzić:**
  - Czy przeglądarka pobiera plik `.json` (np. `syncvault-config-backup-YYYY-MM-DD.json`).
  - Otwórz plik w notatniku – upewnij się, że nie zawiera jawnych tekstów haseł ani konfiguracji, lecz pola: `ciphertext`, `iv`, `salt`, `tag`, `version: 1`.
* **Oczekiwany rezultat:**
  Plik jest w pełni zabezpieczony kryptograficznie standardem AES-256-GCM z użyciem PBKDF2 (100 000 iteracji SHA-512).

### TEST-28: Import konfiguracji i próba złamania hasła
* **Co zrobić:**
  1. W sekcji importu wybierz pobrany plik backupu.
  2. Wpisz **błędne** hasło i kliknij "Importuj".
  3. Następnie wpisz **prawidłowe** hasło i zatwierdź import.
* **Co sprawdzić:**
  - Przy błędnym haśle system wyświetla czerwony błąd autoryzacji / uszkodzenia pliku i **nie nadpisuje** bazy danych.
  - Przy poprawnym haśle konfiguracja zostaje bezbłędnie zdeszyfrowana i przywrócona.
* **Oczekiwany rezultat:**
  Kryptograficzna ochrona integralności uniemożliwia import z nieprawidłowym kluczem deszyfrującym.

---

## 13. Weryfikacja Trybu Ciemnego i Interfejsu (Dark Mode & UI)

### TEST-29: Spójność wizualna Dark Mode
* **Co zrobić:**
  1. Przełącz motyw na Ciemny (Dark Mode) za pomocą ikony słońca/księżyca w nagłówku.
  2. Przejrzyj kolejno ekrany:
     - Formularz Edycji Zadania -> Zaawansowane (Kosz, Retencja, Wykluczenia)
     - Formularz Edycji Zadania -> Powiadomienia (Generowanie CSV, Kanały)
     - Widok Użytkowników -> Panel "Automatyczne odnawianie sesji..."
     - Widok Audytu -> Pasek informacyjny retencji
     - Okno raportów CSV (`TaskFilesModal`)
     - Zakładka Pomoc (`HelpView`)
* **Co sprawdzić:**
  - Czy żaden element nie wyświetla się jako "jasno szary" (brak nieobsługiwanych klas i brak białych plam).
  - Czy tła kontenerów wewnętrznych mają głęboki, czytelny odcień (`dark:bg-neutral-900` / `dark:bg-neutral-800`), a obramowania `dark:border-neutral-800`.
  - Czy kontrast tekstu spełnia standardy dostępności WCAG AA.
* **Oczekiwany rezultat:**
  Idealnie spójny, profesjonalny i elegancki interfejs w trybie nocnym.

---

## 14. Logi Systemowe Kontenera Docker i Retencja (Docker System Logs)

### TEST-30: Rejestrowanie logów Docker (/data/logs/logs_YYYY-MM-DD.log) i automatyczne czyszczenie retencyjne
* **Co zrobić:**
  1. Wykonaj operacje w systemie (np. uruchomienie zadania, restart, zmiana konfiguracji).
  2. Przejdź do Ustawienia -> Kopia & Docker -> Sekcja "Ogólne logi systemowe i kontenera Docker".
  3. Sprawdź zawartość pliku logów w terminalu oraz na dysku serwera/hosta w katalogu `/data/logs/`.
  4. Kliknij przycisk "Pobierz .log" lub "Odśwież".
* **Co sprawdzić:**
  - Czy wszystkie komunikaty emitowane przez serwer (w tym te widoczne w `sudo docker logs syncvault`) są na bieżąco dopisywane ze znacznikami czasu `[YYYY-MM-DD HH:mm:ss]` do pliku `logs_YYYY-MM-DD.log`.
  - Czy pliki starsze niż zdefiniowana liczba dni w `defaultLogRetentionDays` (np. 30 dni) są automatycznie kasowane przez proces czyszczenia retencyjnego.
  - Czy pobieranie pliku logu przez przeglądarkę zwraca pełny plik dzienny.
* **Oczekiwany rezultat:**
  Pełna historia działania kontenera i backendu jest bezpiecznie utrwalana w plikach dziennych w wolumenie `/data/logs` i rotowana zgodnie z harmonogramem retencji.

---

## Podsumowanie Procedury Odbiorczej

Zaliczenie powyższych 32 scenariuszy testowych gwarantuje 100% gotowości wdrożeniowej instancji **SyncVault** do produkcyjnego zabezpieczania zasobów danych w infrastrukturze lokalnej, NAS oraz chmurowej.
