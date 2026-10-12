# Narzędzia pomocnicze SyncVault (Scripts)

Katalog ten zawiera narzędzia pomocnicze i skrypty administracyjne dla SyncVault, przydatne m.in. na serwerach NAS (UGREEN UGOS, Synology DSM, QNAP QTS, Unraid, TrueNAS) oraz systemach Linux.

---

# `sanitize_names.py` – Skaner i konwerter nietypowych myślników

## 📌 Dlaczego ten skrypt powstał?
Podczas synchronizacji danych do usług chmurowych (np. **Drime**, Proton Drive, chmury z API REST) oraz przy korzystaniu z warstwy szyfrowania **rclone crypt**, nietypowe znaki typograficzne w nazwach plików mogą powodować trudne do zdiagnozowania błędy:
1. **Podwójna pauza `——` (U+2014 U+2014):** Artefakt tworzony m.in. przez Windows przy wielokrotnym kopiowaniu plików (`CTRL+C` / `CTRL+V`) lub aplikacje do synchronizacji mobilnej (Syncthing / Android). Powoduje błędy usuwania `Couldn't delete: object not found`.
2. **Półpauza `–` (En-Dash, U+2013) oraz Pauza `—` (Em-Dash, U+2014):** Powszechne w tytułach albumów i utworów muzycznych. W usługach chmurowych takich jak Drime potrafią wywołać błąd `422 Unprocessable Entity: Folder with same name already exists`.

Skrypt przeszukuje wskazany zasób sieciowy (*share*), wyświetla statystyki oraz w bezpieczny sposób zamienia te znaki na standardowy myślnik ASCII **`-`**.

---

## 🚀 Wymagania
* **Python 3** (dostępny fabrycznie w UGREEN UGOS Pro, Synology DSM 7+, Linuxie oraz w kontenerze Dockera SyncVault).
* Brak zewnętrznych bibliotek (skrypt korzysta wyłącznie ze standardowej biblioteki Pythona: `os`, `sys`, `argparse`).

---

## 🛠️ Instrukcja obsługi

### Krok 1: Bezpieczne skanowanie (Tylko podgląd / Dry-Run)
Domyślnie skrypt **nie modyfikuje żadnych plików na dysku**. Przeszukuje katalog, zlicza znalezione pozycje i pokazuje, jak wyglądałyby proponowane nazwy.

```bash
python3 scripts/sanitize_names.py /volume1/DANE
```

#### Zapis raportu do pliku tekstowego:
Możesz zapisać pełną listę plików do pliku raportu (np. bezpośrednio w swoim zasobie sieciowym, aby otworzyć go na komputerze):
```bash
python3 scripts/sanitize_names.py /volume1/DANE --report /volume1/DANE/raport_myslniki.txt
```

#### Skanowanie TYLKO podwójnych myślników `——`:
Jeśli chcesz sprawdzić wyłącznie duplikaty z dwoma myślnikami `——` (zostawiając pojedyncze pauzy `—` i `–` w tytułach utworów):
```bash
python3 scripts/sanitize_names.py /volume1/DANE --only-double
```

---

### Krok 2: Wykonanie właściwej zmiany nazw na dysku (`--fix`)
Gdy zweryfikujesz raport i zechcesz zaktualizować nazwy na dysku, dodaj flagę `--fix`:

```bash
# Zamiana wszystkich nietypowych myślników (rekomendowana pod chmurę):
python3 scripts/sanitize_names.py /volume1/DANE --fix

# LUB zamiana wyłącznie podwójnych myślników '——':
python3 scripts/sanitize_names.py /volume1/DANE --fix --only-double
```

---

## 🐳 Uruchamianie z poziomu Dockera (SyncVault)

Jeśli nie chcesz logować się bezpośrednio do systemu NAS przez SSH jako root, możesz uruchomić skrypt bezpośrednio wewnątrz działającego kontenera SyncVault:

```bash
# Podgląd zamontowanego zasobu:
docker exec -it syncvault python3 /app/scripts/sanitize_names.py /storage/DANE

# Właściwa zmiana nazw przez Dockera:
docker exec -it syncvault python3 /app/scripts/sanitize_names.py /storage/DANE --fix
```

---

## 🛡️ Mechanizmy bezpieczeństwa w skrypcie

1. **Przetwarzanie „od dołu do góry” (*Bottom-Up*):**  
   Skrypt najpierw zmienia nazwy plików w najgłębszych podkatalogach, a dopiero na samym końcu foldery nadrzędne. Zapobiega to utracie dostępu do plików w trakcie zmiany nazw drzewa katalogów.
2. **Ochrona przed kolizjami i nadpisaniem:**  
   Przed każdą zmianą nazwy skrypt sprawdza, czy plik o nowej nazwie już istnieje. Jeśli tak – operacja jest bezpiecznie pomijana z ostrzeżeniem w raporcie, aby **nigdy nie doszło do nadpisania danych**.
3. **Pełne wsparcie dla kodowania UTF-8 i polskich znaków:**  
   Litery takie jak `ą, ć, ę, ł, ń, ó, ś, ź, ż` oraz znaki innych języków pozostają nienaruszone.
