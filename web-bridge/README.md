# Luna IRC w przeglądarce (PWA) + most WebSocket↔IRC

Wersja webowa działa w Safari/Chrome (też jako PWA na iPhonie). Przeglądarka nie otwiera gniazd TCP,
więc klient IRC działa w TypeScript (`src/web/`), a połączenie idzie przez WebSocket:

| Serwer IRC | Co wpisać w „Host” |
|---|---|
| ZNC, zwykły ircs:// (bez WebSocket) | zwykły host (`irc.firma.pl`) + port + TLS — idzie przez **most** |
| Serwer z IRC-over-WebSocket | pełny adres `wss://irc.example.org/ws` (port ignorowany), bez mostu |

Logi i ustawienia trzymane są w przeglądarce (IndexedDB / localStorage), nie na dysku.

## Budowa i uruchomienie

```bash
npm run build:web                 # -> dist-web (build Tauri bez zmian)
cd web-bridge && npm install
BRIDGE_TOKEN=tajny PORT=8080 node server.mjs   # serwuje dist-web + /irc
```

Opcjonalnie `BRIDGE_HOSTS=irc.firma.pl,inny.host` ogranicza, z czym most może się łączyć.
`BRIDGE_TOKEN` jest wymagany (otwarty most TCP to dziura bezpieczeństwa).

Podgląd deweloperski: `npm run dev:web` (port 1421; wtedy ustaw w konsoli przeglądarki
`localStorage["luna.bridge"]="ws://localhost:8080/irc"`).

## HTTPS (wymagane dla PWA i service workera)

Wystaw port 8080 przez reverse proxy z TLS (Caddy: `irc.twojadomena.pl { reverse_proxy localhost:8080 }`
— Caddy obsłuży też upgrade WebSocket). Klient sam używa `wss://`, gdy strona jest po HTTPS.

## Token mostu

Raz na urządzeniu, w konsoli Safari (lub przez zakładkę z `javascript:`):

```js
localStorage.setItem("luna.bridgeToken", "tajny")
```

(Most ustawiony osobno od strony: `localStorage.setItem("luna.bridge", "wss://most.domena.pl/irc")`.)

## iPhone

Safari → otwórz `https://irc.twojadomena.pl` → Udostępnij → „Dodaj do ekranu początkowego”.

## Czego brak względem wersji desktop/Android

Edycja i usuwanie wiadomości (draft/message-edit, redaction), podgląd surowego logu, podgląd linków w oknie,
powiadomienia systemowe w tle (iOS: tylko gdy aplikacja jest otwarta; Web Push nie jest zaimplementowany),
utrzymanie połączenia w tle (iOS zawiesza kartę — po powrocie następuje ponowne łączenie; do historii
w tle użyj ZNC z playbackiem), aktualizator (aktualizacje przychodzą z hostingu).
