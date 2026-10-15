# Luna IRC v0.3.5-13

## Nowości
- **Podgląd linków w oknie aplikacji (desktop).** Kliknięcie linku w czacie otwiera go w modalu z paskiem (adres, „Otwórz w przeglądarce”, zamknij), bez wychodzenia z aplikacji. Podgląd jest prywatny i może nawigować tylko po stronach http(s). Można go wyłączyć w Settings → Chat („Otwieraj linki w oknie podglądu”); na Androidzie linki nadal otwierają się w przeglądarce.
- **Własne komendy jako workflow.** Komenda składa się teraz z kroków wykonywanych po kolei: „Wyślij wiadomość” (kilka kroków = kilka wiadomości), „Oznacz osobę” (stały nick albo argument komendy) i „Otwórz link w przeglądarce”. W krokach można używać `$1`, `$2`… (pojedyncze słowa wpisane po komendzie) i `$*` (wszystko). W adresach `$…` jest bezpiecznie kodowane. Dotyczy desktopu i Androida, a dotychczasowe komendy działają bez zmian.
- **Pasek formatowania w notatkach.** Nad polem treści są przyciski pogrubienia, kursywy, podkreślenia i przekreślenia (z podświetleniem aktywnego formatu) oraz bloku kodu, cytatu, listy punktowanej i numerowanej. Działają też skróty Ctrl+B, Ctrl+I, Ctrl+U i Ctrl+Shift+X.
- **Blokada reklam, trackerów i banerów cookie w podglądzie linków (desktop).** Podgląd korzysta z filtrów EasyList, EasyPrivacy i listy cookie. Listy są pobierane przy pierwszym otwarciu podglądu i odświeżane raz w tygodniu. Ukrywanie elementów działa na wszystkich systemach, blokada żądań sieciowych tylko na Windows. Włącznik jest w Settings, w sekcji podglądów linków, i jest domyślnie włączony.

## Zmiany
- **Obrazek, który się nie wczytał** (np. przez zabezpieczenie Cloudflare) ma przycisk „Zobacz w przeglądarce”, który otwiera go w tym samym oknie podglądu zamiast pokazywać tylko błąd.
- **Notatki otwierają się w podglądzie.** Istniejąca notatka pokazuje się od razu sformatowana (przycisk ołówka przełącza na edycję), a nowo dodana notatka otwiera się w trybie edycji.
- **Podświetlenie wiadomości po najechaniu** (desktop). Wiadomość, na którą wskazuje przycisk odpowiedzi, ma podświetlone tło, a ta, na którą piszesz odpowiedź, zostaje podświetlona do wysłania lub anulowania.
- **Notatki są znowu w pełni lokalne.** Usunięto wstawianie obrazków (przycisk, wklejanie i przeciąganie), więc nic z notatek nie jest wysyłane na zewnętrzne serwery. Podgląd notatki (Markdown i HTML) nie wyświetla obrazków.
- **Status „Online”** pod osobami, które nie są nieobecne, zamiast „Obecny” (desktop i Android).
- **Prywatne wiadomości: najnowsze na górze.** Lista rozmów sortuje się od najnowszej. Dawną kolejność można przywrócić w ustawieniach (Sortowanie prywatnych wiadomości).
- **Sprawdzanie aktualizacji w oknie zmian.** Okno „Zmiany wersji” pokazuje nowości dla wybranego kanału aktualizacji.
- **Szybszy start.** Okna ustawień, edycji serwera, kanałów, notatek i emoji ładują się dopiero przy pierwszym otwarciu.
- **Nowe ikony ról:** klucz, król szachowy, hetman i skoczek.
- **Zakładka „O programie”** w ustawieniach: wersja, autorzy z linkami do profili i link do kodu źródłowego.

## Poprawki
- Lista użytkowników nie gubi nicków, gdy serwer odpowie na NAMES w nietypowym formacie. Pusta odpowiedź nie czyści już listy.
- Twój własny powód nieobecności jest poprawnie pokazywany na liście członków.
- Ikona aplikacji na Androidzie to logo Luna, a nie domyślna ikona Tauri (w buildach z CI).
- Przetłumaczono tryby kanału i formularz serwera na Androidzie.
- Okna notatek, zakładek i listy kanałów są czytelne w jasnym motywie.
- Przetłumaczono brakujące napisy: „Domyślne (ustawienie globalne)” w oknie serwera, edytor własnych komend (Opis, Sugestie, błędy pliku JSON) oraz na Androidzie m.in. ekran bez serwerów, „Zainstalowana”, nagłówek ustawień, podsumowania powiadomień i szczegóły połączenia.

## Znane ograniczenia
- Blokada w podglądzie linków używa tylko części reguł EasyList: pomija reguły z opcjami, ścieżkami i ograniczeniem do konkretnych stron. Pierwsze otwarcie podglądu może chwilę trwać, bo pobiera listy.
- HTML w notatkach jest ograniczony do bezpiecznego podzbioru znaczników (bez skryptów, stylów, ramek i formularzy).
