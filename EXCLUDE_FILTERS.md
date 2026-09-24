# Przewodnik po regułach wykluczeń (Exclude Filters) w SyncVault

Ten dokument opisuje składnię, zasady działania oraz praktyczne przykłady wzorców wykluczeń (`--exclude`) dla silników **rsync** i **rclone** stosowanych w aplikacji SyncVault.

---

## 1. Kluczowe zasady dopasowywania wzorców

Wzorce wykluczeń w rsync i rclone są zawsze sprawdzane **względem katalogu źródłowego zadania (Source)**:

| Symbol / Konstrukcja | Znaczenie i zachowanie |
| :--- | :--- |
| **Brak `/` na początku** (np. `*.tmp`, `temp/`) | Wyszukuje i dopasowuje w **całym drzewie katalogów** na dowolnej głębokości. |
| **Początkowy `/`** (np. `/pliki1/`, `/*.log`) | **Kotwiczy wzorzec w korzeniu źródła (Root)**. Nie dopasowuje w głębszych podkatalogach. |
| **Końcowy `/`** (np. `temp4/`, `node_modules/`) | Oznacza, że reguła dotyczy **wyłącznie katalogu** (zwykły plik o tej nazwie nie zostanie wykluczony). |
| `*` (pojedyncza gwiazdka) | Dopasowuje dowolny ciąg znaków **w obrębie jednego poziomu katalogu** (nie przekracza znaku `/`). |
| `**` (podwójna gwiazdka) | Dopasowuje dowolny ciąg znaków **przechodząc przez podkatalogi na dowolną głębokość**. |
| `?` | Dopasowuje dokładnie jeden dowolny znak. |

---

## 2. Rozwiązania dla konkretnych przypadków

Poniższe przykłady przedstawiono w dwóch typowych konfiguracjach zadania:
* **Wariant A:** Źródłem w parze jest katalog nadrzędny: `Source = /dane/`
* **Wariant B:** Źródłem w parze jest bezpośrednio dany folder (np. `Source = /dane/pliki1/` lub `/dane/pliki3/`)

---

### Przypadek 1: Wszystkie pliki z rozszerzeniem `.tmp` (w całym drzewie)
* **Wzorzec:**
  ```text
  *.tmp
  ```
* **Opis:** Wyklucza każdy plik kończący się na `.tmp` zarówno w katalogu głównym, jak i w dowolnym podkatalogu.

---

### Przypadek 2: Wszystkie pliki tylko w katalogu `/dane/pliki1/` o rozszerzeniu `.tmp2` (bez podkatalogów)
* **Gdy `Source = /dane/` (Wariant A):**
  ```text
  /pliki1/*.tmp2
  ```
  *(Początkowy `/` kotwiczy w katalogu nadrzędnym `/dane/`, a pojedyncza `*` dotyczy wyłącznie plików bezpośrednio wewnątrz `pliki1`, nie wchodząc do np. `pliki1/sub/`)*.
* **Gdy `Source = /dane/pliki1/` (Wariant B):**
  ```text
  /*.tmp2
  ```
  *(Początkowy `/` oznacza: tylko pliki bezpośrednio w korzeniu tego folderu źródłowego)*.

---

### Przypadek 3: Wszystkie pliki w katalogu i podkatalogach `/dane/pliki2/` o rozszerzeniu `.tmp3`
* **Gdy `Source = /dane/` (Wariant A):**
  ```text
  /pliki2/**.tmp3
  ```
  *(Podwójna gwiazdka `**` przeszukuje `pliki2` oraz wszystkie podkatalogi na dowolną głębokość)*.
* **Gdy `Source = /dane/pliki2/` (Wariant B):**
  ```text
  *.tmp3
  ```

---

### Przypadek 4: Wszystkie katalogi o nazwie `temp4` (gdziekolwiek w strukturze)
* **Wzorzec:**
  ```text
  temp4/
  ```
* **Opis:** Końcowy ukośnik `/` gwarantuje, że wykluczony zostanie **wyłącznie katalog** `temp4` wraz z całą jego zawartością. Jeśli istnieje zwykły plik o nazwie `temp4` (bez rozszerzenia), nie zostanie pominięty.

---

### Przypadek 5: Wszystkie katalogi o nazwie zawierającej `temp5`
*(np. `temp5`, `moj_temp5`, `temp5_stary`, `arch_temp5_2026`)*
* **Wzorzec:**
  ```text
  *temp5*/
  ```
* **Opis:** Gwiazdki dopasowują dowolny fragment nazwy, a końcowy slash `/` ogranicza regułę wyłącznie do folderów.

---

### Przypadek 6: Wszystkie katalogi o nazwie `temp6` znajdujące się w `/dane/pliki3/` (tylko na tym poziomie)
* **Gdy `Source = /dane/` (Wariant A):**
  ```text
  /pliki3/temp6/
  ```
  *(Dopasowuje `/dane/pliki3/temp6/`, ale NIE wykluczy np. `/dane/pliki3/archiwum/temp6/`)*.
* **Gdy `Source = /dane/pliki3/` (Wariant B):**
  ```text
  /temp6/
  ```

---

### Przypadek 7: Wszystkie katalogi o nazwie `temp7` znajdujące się w `/dane/pliki3/` i we wszystkich podkatalogach
* **Gdy `Source = /dane/` (Wariant A):**
  ```text
  /pliki3/**/temp7/
  /pliki3/temp7/
  ```
  *(Wyklucza `temp7/` leżący bezpośrednio w `pliki3/` oraz w dowolnym zagnieżdżonym podkatalogu wewnątrz `pliki3`)*.
* **Gdy `Source = /dane/pliki3/` (Wariant B):**
  ```text
  temp7/
  ```
  *(Brak początkowego slasha powoduje wyszukanie każdego folderu `temp7/` w całym poddrzewie `pliki3`)*.

---

## 3. Inne ważne i przydatne przykłady

### A. Pliki tymczasowe edytorów i systemowe
```text
*~
*.swp
.DS_Store
Thumbs.db
desktop.ini
```

### B. Pliki niedokończone / częściowo pobrane
```text
*.part
*.crdownload
*.tmp
```

### C. Foldery projektowe, cache i środowiska uruchomieniowe
```text
node_modules/
.cache/
__pycache__/
.venv/
vendor/
```

### D. Systemy kontroli wersji (Git, SVN)
```text
.git/
.svn/
.gitignore
```

### E. Wszystkie pliki ukryte (zaczynające się od kropki)
* **Wszystkie ukryte pliki** w dowolnym katalogu:
  ```text
  .*
  ```
* **Wszystkie ukryte foldery**:
  ```text
  .*/
  ```

### F. Wykluczenie zawartości folderu, ale zachowanie samego pustego katalogu
* Jeśli chcesz zachować strukturę katalogu `cache`, ale nie przesyłać jego zawartości:
  ```text
  /cache/*
  ```
  *(Uwaga: reguła `/cache/` pominęłaby całkowicie tworzenie folderu `cache` w miejscu docelowym)*.

### G. Zabezpieczenie katalogów kosza SyncVault
SyncVault w trybie synchronizacji lustrzanej (`mirror`) z włączonym koszem tworzy foldery `*_TRASH/`. Warto upewnić się, że nie kopiujemy kosza do kolejnych podfolderów:
```text
*_TRASH/
```

---

## 4. Jak dodawać filtry w SyncVault

1. Otwórz edycję zadania (przycisk ołówka przy zadaniu).
2. Przejdź do zakładki **Zaawansowane** (**Advanced**).
3. W sekcji **Wykluczenia (Filtry)** wpisz wzorzec i naciśnij klawisz `Enter` lub przecinek `,`.
4. Sprawdź sekcję **Podgląd polecenia** na dole okna – od razu zobaczysz wygenerowane flagi `--exclude "..."` (lub `--exclude='...'`) dla każdego ze skonfigurowanych filtrów.
