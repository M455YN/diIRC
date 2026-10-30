# Luna IRC v0.3.5-18

## Nowości
- **Import i eksport ustawień oraz serwerów.** Nowa sekcja w Ustawienia → Aplikacja zapisuje wybrane dane do pliku JSON przez natywne okno zapisu i wczytuje je z natywnego okna otwierania. Możesz wskazać, czy eksportować ustawienia, które konkretnie serwery i kanały oraz które zainstalowane rozszerzenia. Przy imporcie istniejące serwery nie są nadpisywane (duplikaty są pomijane), a każde rozszerzenie z pliku pokazuje zwykłe okno uprawnień.
- **Eksport bez haseł.** Opcja „Include passwords” jest domyślnie wyłączona: pomijane są hasła serwerów, klucze kanałów, wartości nagłówków autoryzacji URL, tekstowe ustawienia rozszerzeń oraz linie logowania wykonywane po połączeniu (np. NickServ IDENTIFY).
- **Prywatne dane nie trafiają do pliku.** Eksport nie zawiera wiadomości, prywatnych czatów, reakcji, avatarów, listy ignorowanych ani słów podświetlanych.
- **Przywracanie ustawień fabrycznych.** Przycisk w tej samej sekcji usuwa wszystko, co zapisała aplikacja: ustawienia, serwery, kanały, rozszerzenia, notatki i zakładki, a potem przeładowuje aplikację. Logi czatów na dysku zostają. Przed usunięciem pojawia się potwierdzenie.
