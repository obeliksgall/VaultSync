# Przewodnik optymalizacji i rozwiązywania problemów: rclone + Drime (z Crypt)

Ten dokument zawiera kompendium wiedzy, zdiagnozowane problemy oraz zalecane flagi i dobre praktyki przy synchronizacji danych do chmury **Drime** (`drime.cloud`) za pomocą narzędzia **rclone**, w szczególności z wykorzystaniem warstwy szyfrującej **crypt**.

---

## 1. Zdiagnozowane problemy i ich przyczyny

### Problem 1: Błąd HTTP 422 `Folder with same name already exists`
* **Objaw w logach:**
  ```text
  ERROR : FolderName/.../ImageName.jpg: Failed to copy: failed to make directory: failed to create folder: 
  Error "422 Unprocessable Entity (422): {"message":"","errors":{"name":"Folder with same name already exists."}}"
  ```
* **Przyczyny:**
  1. **Brak idempotencji w API Drime:** W większości chmur (np. S3, Google Drive, Dropbox) próba utworzenia folderu, który już istnieje, zwraca sukces (`200 OK`). API Drime zwraca natomiast błąd `422`, którego rclone w obecnej implementacji backendu nie ignoruje i przerywa transfer pliku.
  2. **Wyścig wątków przy transferach współbieżnych:** Jeśli ustawiono `--transfers=4` i w nowym folderze wysyłanych jest równolegle kilka plików, wątki rclone w tej samej milisekundzie żądają utworzenia tego samego folderu. Jeden wątek go tworzy, a pozostałe natrafiają na kod `422`.
  3. **Różnice w datach modyfikacji (`ModTime`):** Jeśli rclone porównuje daty modyfikacji (domyślny tryb), a chmura w warstwie `crypt` nie ma nanosekundowej precyzji, rclone błędnie kwalifikuje plik jako zmieniony. Próbując wgrać go ponownie, rclone wywołuje procedurę `Mkdir`, co kończy się odmową Drime.
  4. **Konflikt z Koszem (Trash) w Drime:** Usunięcie folderu w panelu Drime przenosi go do Kosza. Unikalny indeks bazy danych Drime nadal blokuje utworzenie aktywnego folderu o tej samej nazwie.

---

### Problem 2: Błąd `Couldn't delete: object not found` i pliki widma
* **Objaw w logach:**
  ```text
  ERROR : ... —— copy.jpg: Couldn't delete: object not found
  ERROR : Attempt 1/3 failed with 3 errors and: failed to delete 2 files
  ```
* **Przyczyny:**
  1. **Użycie flagi `--fast-list`:** Flaga ta pobiera całe drzewo obiektów do pamięci RAM na samym początku zadania. Przy chmurach takich jak Drime powstaje problem opóźnionej spójności (*eventual consistency*). Gdy rclone pod koniec próbuje skasować plik, obiekt ma już inne ID lub został zarchiwizowany, a Drime zwraca kod `404 Not Found`.
  2. **Zbieżność nazw i znaki specjalne:** Pliki generowane automatycznie przez Syncthing lub systemy mobilne (np. wielokrotne kopie zawierające myślniki `—` lub `——`) w powiązaniu z opóźnieniami indeksu.

---

### Problem 3: Zwielokrotniony licznik sprawdzonych i wysłanych (np. 72 453 zamiast 24 149)
* **Objaw w SyncVault:**
  Licznik plików sprawdzonych lub przesłanych rośnie do wielokrotności faktycznej liczby plików (np. `6 / 9 przesłanych`, `72 453 sprawdzonych` zamiast `24 149`).
* **Przyczyna:**
  * Za to zachowanie odpowiada domyślny parametr rclone **`--retries 3`**.
  * Wystąpienie pojedynczego błędu I/O (np. 422 na folderze lub 404 przy kasowaniu) powoduje ponowienie całego zadania od początku:
    * Próba 1: 24 149 sprawdzonych
    * Próba 2: +24 149 sprawdzonych (łącznie 48 298)
    * Próba 3: +24 149 sprawdzonych (łącznie 72 447)
  * Statystyki rclone kumulują się w obrębie jednego procesu.

---

### Problem 4: Nietypowe myślniki i znaki typograficzne w nazwach
* **Objaw:** Różnice wizualne w logach: `plik — copy.jpg` vs `plik —— copy.jpg` lub `Tytuł – Podtytuł`.
* **Wyjaśnienie techniczne:**
  * Znak **`-`** (kod `0x2D`, `U+002D`) to standardowy myślnik ASCII (Hyphen-Minus).
  * Znak **`–`** (kod `U+2013`) to półpauza (En-Dash).
  * Znak **`—`** (kod `U+2014`) to pauza (Em-Dash).
* **Dlaczego zamiana „w locie” tylko podczas transferu nie zadziała w `rclone sync`?**
  * Jeśli rclone w locie zmieniłby nazwę pliku w chmurze ze „złej” na „dobrą”, to na dysku źródłowym plik nadal miałby starą nazwę.
  * Przy kolejnym uruchomieniu `rclone sync` rclone stwierdziłby:
    1. Pliku z dysku źródłowego (`–`) nie ma w chmurze -> *wysyłam od nowa!*
    2. Pliku z chmury (`-`) nie ma na dysku lokalnym -> *kasuję z chmury!*
  * Synchronizacja wpadłaby w wieczną pętlę ciągłego kasowania i ponownego wysyłania.
  * **Wniosek:** Nazwy muszą zostać ujednolicone **na dysku źródłowym**.

---

## 2. Zalecany zestaw flag dla zadań Drime w SyncVault

W konfiguracji zadania w SyncVault (pole *Dodatkowe flagi*) wklej poniższy zestaw parametrów:

```text
--buffer-size=64M --transfers=2 --check-first --order-by=size,desc --drime-chunk-size=32M --tpslimit=3 --retries=1 --delete-excluded --drime-hard-delete --size-only
```

### Wyjaśnienie poszczególnych flag:

| Flaga | Zastosowanie i korzyść |
| :--- | :--- |
| **`--size-only`** | **Kluczowa flaga.** Porównuje pliki wyłącznie po rozmiarze bajtowym, ignorując niedokładne znaczniki czasu Drime. Jeśli plik o tym rozmiarze już istnieje na Drime, rclone natychmiast go pomija i **nie wywołuje zapytania o tworzenie folderu**. |
| **`--tpslimit=3`** | Ogranicza liczbę operacji do 3 zapytań/sekundę. Zapobiega blokadom API Drime i wyścigom wątków przy tworzeniu zasobów. |
| **`--transfers=2`** | Bezpieczna liczba równoległych transferów (zamiast 4). Zapobiega kolizjom przy tworzeniu nowych podkatalogów. |
| **`--retries=1`** | Zapobiega 3-krotnemu powtarzaniu całego skanu 25 000+ plików w razie błędu pojedynczego pliku i zapobiega zwielokrotnianiu liczników statystyk. |
| **`--drime-hard-delete`** | Trwale kasuje pliki z Drime z pominięciem Kosza. Zapobiega powstawaniu duplikatów i konfliktów w unikalnym indeksie bazy Drime. |
| **`--drime-chunk-size=32M`** | Optymalny rozmiar części przy multipart uploadzie dużych plików. |
| **`--order-by=size,desc`** | Przesyła najpierw największe pliki (np. flac/wideo), a małe pliki (okładki/txt) na końcu. |
| **`--buffer-size=64M`** | Pamięć podręczna RAM na każdy transfer. |
| **`--check-first`** | Najpierw wykonuje pełne sprawdzenie plików przed rozpoczęciem wysyłania. |

> ⚠️ **Uwaga:** Dla backendu Drime **NIE należy stosować flagi `--fast-list`**. Powoduje ona błędy `object not found` przy usuwaniu plików.

> ⚠️ **Uwaga:** Można dodać * - - * - usuń spacje do listy --excluded/wyjątków - wtedy nie będą one w ogóle wysyłane.

---

## 3. Skrypt do automatycznej naprawy myślników na dysku

Aby jednorazowo zamienić wszystkie nietypowe myślniki typograficzne (`–`, `—`, `−`) na standardowy znak ASCII `-` w nazwach plików i folderów na dysku, wykonaj poniższe kroki w terminalu hosta lub w kontenerze:

### Krok 1: Bezpieczny podgląd (Dry-Run – bez modyfikacji plików)
```bash
python3 -c "
import os
target_dir = '/storage/DataStore/FolderToSend'
bad_chars = ['\u2013', '\u2014', '\u2212']

for root, dirs, files in os.walk(target_dir, topdown=False):
    for name in files + dirs:
        cleaned = name
        for c in bad_chars:
            cleaned = cleaned.replace(c, '-')
        if cleaned != name:
            print(f'[DO ZMIANY] \"{name}\" \n       ---> \"{cleaned}\"')
"
```

### Krok 2: Właściwa zmiana nazw (od najgłębszych podfolderów)
```bash
python3 -c "
import os
target_dir = '/storage/DataStore/FolderToSend'
bad_chars = ['\u2013', '\u2014', '\u2212']
count = 0

for root, dirs, files in os.walk(target_dir, topdown=False):
    for name in files + dirs:
        cleaned = name
        for c in bad_chars:
            cleaned = cleaned.replace(c, '-')
        if cleaned != name:
            old_path = os.path.join(root, name)
            new_path = os.path.join(root, cleaned)
            os.rename(old_path, new_path)
            print(f'[ZMIENIONO] {name} -> {cleaned}')
            count += 1
print(f'Gotowe! Zaktualizowano {count} nazw.')
"
```

---

## 4. Dobre praktyki przy synchronizacji z Drime

1. **Regularnie opróżniaj Kosz w Drime:**
   * W panelu WWW [drime.cloud](https://drime.cloud) wejdź w **Trash** i kliknij **Empty Trash**.
   * API Drime indeksuje również pliki w koszu, co bywa przyczyną fałszywych konfliktów nazw.
2. **Nie usuwaj plików z chmury przed ponowną synchronizacją:**
   * Po dodaniu flagi `--size-only` rclone natychmiast rozpozna już wysłane pliki po ich rozmiarze i nie będzie ich wysyłał ponownie.
3. **Weryfikacja zawartości chmury przez rclone:**
   * Sprawdzenie listy folderów widocznych przez rclone:
     ```bash
     rclone lsf "cryptdrime:FolderToSend/FolderName"
     ```
   * Sprawdzenie spójności bez przesyłania danych (dry-run):
     ```bash
     rclone check "/storage/DataStore/FolderToSend" "cryptdrime:FolderToSend" --size-only
     ```
