# Luna IRC v0.3.5-13

## Nowości
- **Własne komendy jako workflow.** Komenda składa się teraz z kroków wykonywanych po kolei: „Wyślij wiadomość” (kilka kroków = kilka wiadomości), „Oznacz osobę” (stały nick albo argument komendy) i „Otwórz link w przeglądarce”. W krokach można używać `$1`, `$2`… (pojedyncze słowa wpisane po komendzie) i `$*` (wszystko). W adresach `$…` jest bezpiecznie kodowane. Dotyczy desktopu i Androida, a dotychczasowe komendy działają bez zmian.
- **Pasek formatowania w notatkach.** Nad polem treści są przyciski pogrubienia, kursywy, podkreślenia i przekreślenia (z podświetleniem aktywnego formatu) oraz bloku kodu, cytatu, listy punktowanej i numerowanej. Działają też skróty Ctrl+B, Ctrl+I, Ctrl+U i Ctrl+Shift+X.

## Zmiany
- **Notatki otwierają się w podglądzie.** Istniejąca notatka pokazuje się od razu sformatowana (przycisk ołówka przełącza na edycję), a nowo dodana notatka otwiera się w trybie edycji.
- **Podświetlenie wiadomości po najechaniu** (desktop). Wiadomość, na którą wskazuje przycisk odpowiedzi, ma podświetlone tło, a ta, na którą piszesz odpowiedź, zostaje podświetlona do wysłania lub anulowania.
- **Notatki są znowu w pełni lokalne.** Usunięto wstawianie obrazków (przycisk, wklejanie i przeciąganie), więc nic z notatek nie jest wysyłane na zewnętrzne serwery. Podgląd notatki (Markdown i HTML) nie wyświetla obrazków.
- **Status „Online”** pod osobami, które nie są nieobecne, zamiast „Obecny” (desktop i Android).

## Poprawki
- Przetłumaczono brakujące napisy: „Domyślne (ustawienie globalne)” w oknie serwera, edytor własnych komend (Opis, Sugestie, błędy pliku JSON) oraz na Androidzie m.in. ekran bez serwerów, „Zainstalowana”, nagłówek ustawień, podsumowania powiadomień i szczegóły połączenia.

## Znane ograniczenia
- HTML w notatkach jest ograniczony do bezpiecznego podzbioru znaczników (bez skryptów, stylów, ramek i formularzy).
