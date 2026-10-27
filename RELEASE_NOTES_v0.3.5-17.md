# Luna IRC v0.3.5-17

## Nowości
- **Kadrowanie własnego awatara.** Po wybraniu obrazka otwiera się okno, w którym przeciągasz zdjęcie i suwakiem je przybliżasz (do 4×), żeby wskazać, co ma się zmieścić w kwadracie. Dotąd Luna zawsze brała środek zdjęcia. Kadr dotyczy też animacji: ten sam wycinek jest użyty w każdej klatce.

## Zmiany
- **Awatary w lepszej jakości: nieruchome mają 64×64.** Zdjęcie jest zmniejszane do 64×64 zamiast 32×32 (nadal filtrem Lanczos3), więc po powiększeniu w kartach użytkowników i listach jest mniej rozmyte. Luna dobiera najwyższą jakość WebP, która mieści się w limicie wiadomości, więc bardzo szczegółowe zdjęcie może wyjść nieco gorsze, a wysłanie awatara zająć więcej wiadomości niż poprzednio. Animowane awatary zostają 32×32. Starsze Luny nic nie zmieniają po swojej stronie: pokażą większy obraz tak samo jak mały.
- **Reakcje działają tylko na kanałach.** Menu kontekstowe wiadomości w rozmowie prywatnej nie ma już rzędu szybkich reakcji. Wcześniej reakcja w prywatnej rozmowie pozostawała tylko u Ciebie, jeśli rozmówca nie był znany jako Luna z żadnego wspólnego kanału. Na kanałach nic się nie zmieniło.
