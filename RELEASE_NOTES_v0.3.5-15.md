# Luna IRC v0.3.5-15

## Nowości
- **Okno „Funkcje Luna”: wszystko, co Luny robią między sobą, w jednym miejscu.** Przycisk z księżycem nad ustawieniami (na Androidzie: Więcej → Funkcje Luna) otwiera okno z trzema kartami. „Ustawienia” to przełączniki handshake, awatarów i „Przekaż na kanał” oraz lista serwerów z włączaniem awatarów i wyborem własnego obrazka. „Wykryte Luny” pokazuje, kto przysłał powitanie Luny, z wersją i funkcjami. „Log” to dziennik tego, co poszło między Lunami w tej sesji (>> wysłane, << odebrane): powitania, przesyłanie awatarów i reakcje, z przyciskami Kopiuj i Wyczyść. Przełączniki zniknęły ze starych miejsc (Settings → Czat, Settings → Eksperymentalne, zakładka Eksperymentalne w ustawieniach serwera i opcja awatarów w ustawieniach Androida).
- **Animowane awatary.** Animowany GIF (także animowany WebP i APNG) zostaje animowany: klatki są skalowane, zapisywane jako GIF o ograniczonej palecie i przesyłane innym Lunom. Gdy animacja jest za szczegółowa, żeby zmieścić się w limicie (ok. 5 KB), najpierw zmniejszane są kolory i liczba klatek (czas trwania zostaje), a w ostateczności awatar jest nieruchomy (pierwsza klatka).
- **Lepsza jakość awatarów.** Zdjęcie jest zmniejszane do 32x32 filtrem Lanczos3 zamiast zwykłego skalowania przeglądarki, więc małe awatary są ostrzejsze i bez poszarpanych krawędzi.

## Zmiany
- **Nic, co Luny wysyłają między sobą, nie trafia już na kanał.** Powitanie Luny idzie jako ukryty tag klienta (`+lunairc/hello` w `TAGMSG`), a nie wiadomość: klient bez `message-tags` nie dostaje nic, a pozostałe tego nie wyświetlają. Awatary i reakcje idą prywatnie do poszczególnych Lun, które się przywitały, więc inne klienty (HexChat, mIRC) i starsze wersje Luny niczego nie widzą. Odpowiedzi na powitanie to prywatne NOTICE i nie są odpowiadane dalej.
- **Reakcje na wiadomości z kanału** są wysyłane osobno do każdej Luny na kanale i niosą nazwę kanału. Reakcje w rozmowach prywatnych działają jak dotąd.
- **Awatar zmieniony u Ciebie dociera szybciej.** Ogłoszenie nowego awatara idzie prywatnie do Lun z włączonymi awatarami, które są z Tobą na kanale, a wysyłki wywołane Twoją zmianą wyprzedzają kolejkę innych komunikatów. Nowy awatar jest wydawany od razu, a nie dopiero po minucie od poprzedniej prośby tej osoby. Pytania o awatar dostają tylko osoby, które w powitaniu zgłosiły tę funkcję.
- **Awatar jest też widoczny w nagłówku rozmowy prywatnej** oraz na liście rozmów, w oknie członków serwera i na mobilnych listach rozmów i członków.

## Poprawki
- **Lista osób na kanale po starcie nie pokazuje już tylko Ciebie.** Klient łączył się z serwerem, zanim zarejestrował wszystkie nasłuchiwania zdarzeń, więc pierwsze JOIN i NAMES z autojoin mogły zginąć. Teraz czeka na rejestrację (maksymalnie 3 s), a trzy sekundy po połączeniu jeszcze raz dopytuje o listy kanałów, które są puste lub zawierają tylko Ciebie.
- **Adres obrazka w składni markdown nie pokazuje już podglądu linku.**

## Znane ograniczenia
- Luny wykrywają się przez tag klienta, więc serwer musi mieć `message-tags` i nie blokować tagu `lunairc/hello` w `CLIENTTAGDENY`. Inaczej nikt nikogo nie wykryje i awatary oraz reakcje między Lunami nie działają. Wyłączenie handshake („Ogłaszaj Lunę innym klientom Luna”) wyłącza je także.
- Luna v0.3.5-14 nie rozumie nowego powitania, animowanych awatarów (odrzuca GIF i obrazy dłuższe niż 8 kawałków) ani reakcji na wiadomości z kanału (nowy format z nazwą kanału). Nieruchome awatary i reakcje w rozmowach prywatnych nadal działają. Luna 14 dalej wysyła stare powitanie wprost na kanał, więc użytkownicy innych klientów mogą je widzieć, dopóki wszyscy nie zaktualizują.
- Animowany awatar przesyła się do kilkunastu sekund (do 24 wiadomości, ok. 0,4 s na wiadomość). Dekodowanie animacji wymaga `ImageDecoder` w przeglądarce; bez niego (np. Safari) awatar zostaje nieruchomy.
- Zmiany `/away` i `/back` innych osób na liście kanału widać na żywo tylko na serwerach z IRCv3 `away-notify`. Bez niego status odświeża się przy wejściu na kanał i przy ręcznym odświeżeniu listy. Gdy coś nie działa, `/rawlog` pokazuje, czy serwer odpowiada na `NAMES` i `WHO`.
- Lista „Wykryte Luny” i log są tylko z bieżącej sesji i nie zostają po restarcie.
