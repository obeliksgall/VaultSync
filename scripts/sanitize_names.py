#!/usr/bin/env python3
"""
SyncVault Utility: Skaner i konwerter nietypowych znaków typograficznych (myślników).
Zaprojektowany specjalnie dla systemów NAS (UGREEN UGOS, Synology, QNAP, Linux).

Zastosowanie:
  1. Wykrywanie i zamiana podwójnych myślników '——' (artefakty kopiowania w Windows/Syncthing).
  2. Wykrywanie i zamiana pauz '—' (Em-Dash) i półpauz '–' (En-Dash) na bezpieczny myślnik ASCII '-'.

Użycie:
  # 1. Tylko skanowanie i raport (BEZPIECZNE - nie modyfikuje żadnych plików):
  python3 scripts/sanitize_names.py /sciezka/do/share

  # 2. Skanowanie z zapisem raportu do pliku:
  python3 scripts/sanitize_names.py /sciezka/do/share --report raport.txt

  # 3. Sprawdzenie TYLKO podwójnych myślników '——':
  python3 scripts/sanitize_names.py /sciezka/do/share --only-double

  # 4. Wykonanie właściwej zamiany na dysku:
  python3 scripts/sanitize_names.py /sciezka/do/share --fix
"""

import os
import sys
import argparse

# Typograficzne myślniki powodujące problemy w chmurach / API
BAD_DASHES = [
    ('\u2014\u2014', '-'),  # Podwójny Em-Dash '——'
    ('\u2013\u2013', '-'),  # Podwójny En-Dash '––'
    ('\u2014', '-'),        # Pojedynczy Em-Dash '—'
    ('\u2013', '-'),        # Pojedynczy En-Dash '–'
    ('\u2212', '-'),        # Znak minusa '−'
]

ONLY_DOUBLE_DASHES = [
    ('\u2014\u2014', '-'),  # Podwójny Em-Dash '——'
    ('\u2013\u2013', '-'),  # Podwójny En-Dash '––'
]


def clean_name(name: str, only_double: bool = False) -> str:
    rules = ONLY_DOUBLE_DASHES if only_double else BAD_DASHES
    res = name
    for bad, good in rules:
        res = res.replace(bad, good)
    return res


def scan_and_process(target_path: str, fix: bool = False, only_double: bool = False, report_file: str = None):
    if not os.path.exists(target_path):
        print(f"BŁĄD: Ścieżka nie istnieje: {target_path}", file=sys.stderr)
        sys.exit(1)

    print("=" * 70)
    print(" SyncVault Name Sanitizer (NAS & Linux Filesystem)")
    print("=" * 70)
    print(f"Katalog docelowy : {target_path}")
    print(f"Tryb działania   : {'[MODYFIKACJA] Zmiana nazw na dysku' if fix else '[SKANOWANIE] Tylko podgląd (Dry-Run)'}")
    print(f"Zakres znaków    : {'Tylko podwójne myślniki (——)' if only_double else 'Wszystkie pauzy/półpauzy (——, —, –, −)'}")
    if report_file:
        print(f"Zapis raportu do : {report_file}")
    print("=" * 70)
    print("Rozpoczynanie skanowania... (może chwilę potrwać dla dużych zasobów)\n")

    found_files = []
    found_dirs = []
    renamed_count = 0
    error_count = 0

    # Przetwarzamy od dołu do góry (topdown=False), aby zmiana nazwy podkatalogu
    # nie uszkodziła ścieżek do plików wewnątrz niego!
    for root, dirs, files in os.walk(target_path, topdown=False):
        # 1. Najpierw pliki
        for fname in files:
            new_fname = clean_name(fname, only_double)
            if new_fname != fname:
                old_full = os.path.join(root, fname)
                new_full = os.path.join(root, new_fname)
                found_files.append((old_full, new_full, fname, new_fname))

        # 2. Następnie katalogi
        for dname in dirs:
            new_dname = clean_name(dname, only_double)
            if new_dname != dname:
                old_full = os.path.join(root, dname)
                new_full = os.path.join(root, new_dname)
                found_dirs.append((old_full, new_full, dname, new_dname))

    total_found = len(found_files) + len(found_dirs)

    if total_found == 0:
        print("✅ Świetnie! Nie znaleziono żadnych plików ani katalogów z nietypowymi myślnikami.")
        return

    print(f"Znaleziono łącznie: {total_found} pozycji ({len(found_files)} plików, {len(found_dirs)} folderów).\n")

    report_lines = []
    report_lines.append(f"RAPORT SKANOWANIA: {target_path}\n")
    report_lines.append(f"Znaleziono pozycji: {total_found}\n\n")

    # Wypisywanie wyników
    all_items = found_files + found_dirs
    for idx, (old_p, new_p, old_n, new_n) in enumerate(all_items, start=1):
        is_dir = (old_p, new_p, old_n, new_n) in found_dirs
        item_type = "[KATALOG]" if is_dir else "[PLIK]   "
        line = f"{idx}. {item_type} {old_p}\n    -> NOWA NAZWA: {new_n}"
        print(line)
        report_lines.append(line + "\n")

        if fix:
            if os.path.exists(new_p):
                err = f"    [BŁĄD] Plik docelowy już istnieje: {new_p}. Pomijam, aby nie nadpisać danych!"
                print(err)
                report_lines.append(err + "\n")
                error_count += 1
            else:
                try:
                    os.rename(old_p, new_p)
                    renamed_count += 1
                except Exception as e:
                    err = f"    [BŁĄD ZMIANY] {e}"
                    print(err)
                    report_lines.append(err + "\n")
                    error_count += 1

    print("\n" + "=" * 70)
    print(" PODSUMOWANIE")
    print("=" * 70)
    print(f"Znalezione pozycje: {total_found} (Pliki: {len(found_files)}, Foldery: {len(found_dirs)})")
    if fix:
        print(f"Pomyślnie zmieniono: {renamed_count}")
        if error_count > 0:
            print(f"Błędy / Kolizje    : {error_count}")
    else:
        print("Status: To był tylko podgląd. Żadne pliki nie zostały zmodyfikowane.")
        print("Aby zastosować zmiany na dysku, dodaj parametr: --fix")
    print("=" * 70)

    if report_file:
        try:
            with open(report_file, 'w', encoding='utf-8') as rf:
                rf.writelines(report_lines)
            print(f"\n📄 Raport został pomyślnie zapisany w pliku: {report_file}")
        except Exception as e:
            print(f"\n[BŁĄD ZAPISU RAPORTU] {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(
        description="SyncVault: Narzędzie do skanowania i naprawy nietypowych myślników na dyskach NAS."
    )
    parser.add_argument(
        "path",
        help="Ścieżka do skanowanego katalogu lub zasobu (np. /volume1/DANE lub /storage/DANE)"
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Wykonaj faktyczną zmianę nazw na dysku (domyślnie jest tylko bezpieczny podgląd)"
    )
    parser.add_argument(
        "--only-double",
        action="store_true",
        help="Wyszukuj i zamieniaj wyłącznie podwójne myślniki '——' (zostawia pojedyncze pauzy '—' i '–')"
    )
    parser.add_argument(
        "--report",
        metavar="PLIK.txt",
        help="Zapisz listę znalezionych plików i proponowanych zmian do pliku tekstowego"
    )

    args = parser.parse_args()
    scan_and_process(args.path, fix=args.fix, only_double=args.only_double, report_file=args.report)


if __name__ == "__main__":
    main()
