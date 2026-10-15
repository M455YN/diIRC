# Luna IRC v0.3.5-12

## Nowości
- **Notatki z obsługą HTML i obrazków.** W notatkach można wstawiać obrazki (przycisk, wklejenie ze schowka albo przeciągnięcie pliku), a przycisk oka pokazuje podgląd z Markdown i HTML. Obrazki są wysyłane przez ustawionego dostawcę uploadu, tak jak w czacie.
- **Prywatne wiadomości: najnowsze na górze.** Rozmowa z najnowszą wiadomością zawsze jest na górze listy. Starą kolejność (wg otwarcia lub alfabetycznie) przywrócisz wyłączając „Najnowsze prywatne wiadomości na górze” w Settings → Appearance. Dotyczy desktopu i Androida.
- **Sprawdzanie aktualizacji w oknie changelogu.** Przycisk „Sprawdź aktualizacje” w nagłówku okna sprawdza kanał wybrany w Settings → Updates i od razu pozwala zaktualizować.
- **Status „Obecny”.** Pod osobami, które nie są nieobecne, na liście użytkowników widać „Obecny” (desktop i Android).
- **Nowe ikony ról.** Właściciel kanału ma ikonę klucza, admin króla szachowego, operator hetmana, a half-operator skoczka.

## Zmiany
- **Tłumaczenia.** Komunikaty o trybach kanału („Tryby kanału #kanał: +nt”) i błędy trybów są po polsku. Na Androidzie przetłumaczono też nagłówek „Połączenie” w formularzu serwera.

## Poprawki
- Powód nieobecności ustawiony przez `/away` lub panel komend jest widoczny na liście użytkowników i na karcie użytkownika po najechaniu. Karta pokazuje też status nieobecności u Ciebie samego.
- Okna Notatki, Zakładki i Lista kanałów są czytelne w jasnym motywie (wcześniej nie było widać tekstu i przycisku zamknięcia).
- Lista użytkowników kanału nie traci osób, gdy serwer wysyła odpowiedź NAMES w nietypowym formacie (m.in. z prefiksem `!`).

## Znane ograniczenia
- Obrazki wstawione do notatek trafiają na zewnętrzny serwer dostawcy uploadu, więc notatka z obrazkiem nie jest już tylko lokalna.
- HTML w notatkach jest ograniczony do bezpiecznego podzbioru znaczników (bez skryptów, stylów, ramek i formularzy).
- Nowa kolejność prywatnych wiadomości działa od tej wersji: rozmowy bez żadnej wiadomości od aktualizacji zostają na dole listy, dopóki ktoś w nich nie napisze.
- Status „Obecny” i powód nieobecności innych osób zależą od tego, czy serwer obsługuje `away-notify`.
