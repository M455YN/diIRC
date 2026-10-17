# Luna IRC v0.3.5-14

## Nowości
- **Osobny przełącznik dla obrazków, które się nie wczytały** (np. przez zabezpieczenie Cloudflare). W Settings → Chat jest nowe ustawienie „Otwieraj zablokowane obrazy w oknie podglądu”, niezależne od otwierania zwykłych linków. Można mieć wyłączony podgląd linków i nadal otwierać w aplikacji obrazki, które nie chcą się wczytać. Dotyczy desktopu.

## Zmiany
- **Linki w oknie podglądu są domyślnie wyłączone.** Zwykłe linki otwierają się w domyślnej przeglądarce; podgląd w aplikacji włączysz w Settings → Chat („Otwieraj linki w oknie podglądu”). Zablokowane obrazy mają własny przełącznik, domyślnie włączony.
- **Domyślny format odpowiedzi to „Hybrydowe”.** Odpowiedź niesie jednocześnie tag IRCv3 z `msgid` i cytat tekstowy, więc odbiorca zawsze zobaczy autora i podgląd wiadomości, na którą odpowiadasz, także gdy nie zna jej `msgid`. Dotyczy nowych instalacji i ustawień, których nie zmieniano. Wybór „Auto” zostaje zachowany, a tryb można ustawić globalnie albo osobno dla serwera.

## Poprawki
- **Komunikaty „X dołączył” nie wracają już na dół czatu ze starą godziną.** Każda linia logu ma teraz unikalne id, a wiadomość „na żywo” jest dopasowywana do swojej kopii z logu po tym id, a nie po treści i nadawcy. Wcześniej zdarzenia systemowe nigdy się nie dopasowywały, więc po przeładowaniu historii (np. po przełączeniu kanału) lądowały na końcu z godziną przyjścia.
- **Poprawna godzina dla JOIN i PART.** Zdarzenia wejścia i wyjścia z kanału używają czasu serwera (tag `time`, np. z bouncera), a nie chwili, w której klient je odebrał.
- **Odpowiedzi na własne wiadomości nie kończą się napisem „Referenced message (…)”.** `msgid` własnej wiadomości jest zapisywany w logu po potwierdzeniu przez serwer (wymaga `echo-message`), więc odpowiedź innej osoby znajdzie rodzica także po restarcie aplikacji.

## Znane ograniczenia
- Stare linie logu nie mają id, więc dla nich działa dotychczasowe dopasowanie po treści i czasie. Własne wiadomości wysłane przed tą wersją nadal nie mają `msgid` w logu, więc odpowiedzi na nie mogą pokazać „Referenced message”.
- Czas serwera jest używany tylko dla JOIN i PART. QUIT, NICK, KICK, TOPIC i MODE nadal dostają czas odebrania.
- Zapis `msgid` w logu mieści się w zarezerwowanych 96 bajtach, a nietypowo długi `msgid` nie zostanie zapisany.
- Bez IRCv3 (`message-tags`) odpowiedzi działają tylko jako cytat tekstowy rozpoznawany przez klienta Luna.
