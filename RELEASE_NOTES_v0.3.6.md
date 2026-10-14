# Luna IRC v0.3.6 (numer do potwierdzenia)

## Nowości
- **Zakładki wiadomości.** Ikona zakładki przy wiadomości (po najechaniu) zapisuje ją lokalnie. Przycisk „Bookmarks” w nagłówku czatu otwiera listę. Kliknięcie wpisu przenosi do kanału lub rozmowy, w której wiadomość była.
- **Lokalne logo serwera.** Przy dodawaniu i edycji serwera można wybrać obrazek z dysku. Plik jest przycinany do kwadratu i zapisywany lokalnie. „Remove” przywraca domyślny obrazek.
- **Odświeżanie listy użytkowników.** Ikona przy liście użytkowników ponownie pobiera listę z serwera (to samo co `/names`). Lista odświeża się też sama po wejściu w kanał.
- **Wskaźnik historii wysłanych wiadomości.** Przy przeglądaniu strzałkami nad paskiem wejścia pojawia się np. „History 6/6”.
- **Wyszukiwarka ustawień (desktop).** Pole „Search settings” pokazuje pasujące opcje i przenosi do ich zakładki.
- **Język interfejsu: polski i angielski.** Przełącznik (System / English / Polski) jest w Settings → Appearance na desktopie i w karcie Theme na Androidzie. Daty, wyszukiwarka, podpowiedzi komend i większość okien są przetłumaczone.
- **Interaktywne panele komend (desktop).** Wybór z podpowiedzi otwiera panel:
  - `/mode`: przełączniki trybów, pola dla klucza i limitu oraz podgląd komendy przed wysłaniem,
  - `/op`, `/deop`, `/voice`, `/devoice`: lista członków, kliknięcie wysyła komendę,
  - `/invite`: lista członków serwera, którzy nie są jeszcze na kanale,
  - `/query`: lista członków serwera, kliknięcie otwiera rozmowę prywatną,
  - `/away`: gotowe powody (np. „Zaraz wracam”, „Obiad”), własny powód albo przycisk „Wróć”, gdy jesteś już nieobecny,
  - `/join`: nazwa kanału, hasło (opcjonalnie) i lista ostatnio otwieranych kanałów.

  Panele są włączone domyślnie i można je wyłączyć w Settings → Chat.
- **Status nieobecności na liście członków.** Pod nickiem osoby nieobecnej pojawia się jej powód („Nieobecny: Obiad”). Gdy powodu nie ma, widać samo „Nieobecny”. Dotyczy desktopu i Androida.
- **Okno „Już nieobecny”.** Gdy próbujesz ustawić nieobecność, będąc już nieobecnym, pojawia się okno z przyciskiem „Wróć” (z podpowiedzią po najechaniu).
- **Edycja tematu kanału.** Włączona ponownie: działa tylko przy połączeniu, a gdy kanał ma tryb `+t`, zmienić temat mogą tylko operatorzy.
- **Tryby kanału po najechaniu** na nazwę kanału w nagłówku.
- **Dwa nowe dźwięki powiadomień:** „Marimba” i „Glass Tap”, dla kanałów i prywatnych wiadomości.
- **Android: połączenia w tle.** Aplikacja uruchamia usługę pierwszoplanową, gdy jest połączona z serwerem, więc połączenia nie zrywają się po zablokowaniu ekranu lub zminimalizowaniu.

## Zmiany
- **Ustawienia uporządkowane według kategorii.** Opcje treści czatu (Markdown, podgląd formatowania, przewijanie, rozmiar emoji) są w „Chat and messaging”. Sortowanie prywatnych wiadomości i wskaźnik statusu połączenia są w „Appearance”. Dotyczy desktopu i Androida.
- **Podpowiedzi komend** są szersze, a opisy zawijają się zamiast być ucinane. Opisy wbudowanych komend są przetłumaczone.
- **Nagłówki grup listy użytkowników** (Właściciele, Operatorzy, Użytkownicy, Nieobecni itd.) są przetłumaczone.
- **Edycja tematu offline** jest zablokowana: przycisk i pole są nieaktywne, dopóki nie jesteś połączony.
- **Podpowiedzi komend** pozostają nieprzezroczyste przy materiale Mica/Akryl w Windows 11.
- **Panele komend** zamykają się po kliknięciu poza formularzem wpisywania i po zmianie kanału. Kliknięcie w pole wpisywania ich nie zamyka.
- **Przyciski „Cancel”** w oknach kanałów, serwerów i prywatnych wiadomości oraz pytanie przy opuszczaniu kanału są przetłumaczone.
- **Android: nazwa aplikacji „Luna IRC”** zamiast „di-irc”. Desktop bez zmian.

## Poprawki
- Na żywo nazwa rzeczywista (realname) użytkownika jest wyświetlana od razu, a nie dopiero po zmianie kanału.
- Po połączeniu lista użytkowników kanału pokazywała tylko siebie. Lista jest teraz pobierana ponownie zaraz po własnym wejściu na kanał.
- Ikona Androida jest brana z `icons/android`. Po `npx tauri android init` widać ją poprawnie.
- Panel `/mode` nie pokazuje już trybu `+r`. Tylko serwer może go ustawić, a wcześniej serwer odrzucał taką komendę błędem „Only servers can change that mode”.
- Na liście zaproszeń do kanału nie pojawiają się już nazwy serwerów (np. `irc.example.net`), tylko prawdziwe nicki.
- Powód „Away”, który inne klienty wysyłają domyślnie, nie jest pokazywany jako powód nieobecności.

## Znane ograniczenia
- Panele komend, zakładki, wyszukiwarka ustawień i wskaźnik historii są tylko na desktopie. Na Androidzie ich nie ma.
- `/code` i `/motd` nie mają jeszcze paneli. Zmiana istniejącego klucza kanału (`+k`) w panelu `/mode` nie jest obsługiwana (najpierw usuń klucz). Panel `/mode` nie obsługuje też `+r` ani trybów zarezerwowanych dla usług.
- Status nieobecności innych widać na żywo tylko wtedy, gdy serwer obsługuje `away-notify`. W pozostałych przypadkach status pojawi się dopiero po wiadomości prywatnej do tej osoby (serwer odpowie powodem nieobecności). Komenda `/whois` nie jest jeszcze zaimplementowana.
- Lista ostatnio otwieranych kanałów w panelu `/join` jest zapisana lokalnie na urządzeniu.
- Blokada edycji tematu zależy od tego, czy serwer zgłosił tryby kanału. Gdy tryby nie są znane, decyzję podejmuje serwer.
- Logo serwera, zakładki i ustawienia są zapisane tylko lokalnie na urządzeniu. Nie synchronizują się między klientami.
- Komunikaty zwracane przez backend (Rust) i część komunikatów IRC pozostają po angielsku.
- Usługa w tle na Androidzie pokazuje stałe powiadomienie „Connected to IRC servers”. Na Androidzie 15 i nowszym działa do około 6 godzin, potem połączenia wracają przez automatyczne ponowne połączenie. Powiadomienie wymaga zgody (Android 13+).
- Skok do zakładki działa tylko wtedy, gdy wiadomość jest załadowana w oknie czatu.
- Zmiany nie były testowane na działającej aplikacji. Przed publikacją warto przejść je ręcznie, zwłaszcza panele komend, edycję tematu i Androida.
