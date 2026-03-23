# Skrypt Atak B - Asystent Farmera Plemiona

Skrypt automatycznie klika przyciski **Atak B** na stronie Asystenta Farmera w grze Plemiona. Liczy dostępne kompozycje ataków na podstawie jednostek, filtruje wioski po surowcach i odległości, ogranicza wysyłanie, aby nie spamować zapytaniami.

## Instalacja

### Wymagania
- **Tampermonkey** (Chrome/Firefox) lub **Greasemonkey** (Firefox)
- Konto Premium z dostępem do Asystenta Farmera

### Kroki
1. Zainstaluj rozszerzenie [Tampermonkey](https://www.tampermonkey.net/)
2. Otwórz plik `atak-b-farmer.user.js`
3. Tampermonkey wykryje skrypt i zaproponuje instalację – kliknij **Zainstaluj**
4. Wejdź na stronę Asystenta Farmera: `https://pl*.plemiona.pl/game.php?village=XXX&screen=am_farm`

## Użycie

- **Panel GUI** w prawym dolnym rogu: status, lista jednostek, filtry (max mur, min. surowce), liczba wiosek, przycisk **START**
- Zakładka **⚙️ Konfiguracja** – jednostki na atak, max mur, min. surowce (tryb i wartości), opóźnienie, auto-refresh. Ustawienia zapisywane w `localStorage`. Przy pierwszym uruchomieniu skrypt pobiera dane z szablonu B ze strony.
- **Auto-start** – skrypt sam rozpoczyna wysyłanie po ~1 s od załadowania (gdy włączone w GUI)
- **Ręczne** – kliknij **START**, aby wysłać ataki
- **Countdown** – czas do odświeżenia strony (najechanie: typ – brak jednostek / brak surowców / po ataku)

## Konfiguracja

**Cała konfiguracja odbywa się w GUI** (zakładka ⚙️ Konfiguracja). Przy braku zapisu w localStorage skrypt korzysta z danych ze strony (szablon B), a brakujące wartości z domyślnych.

| Opcja | Opis | Domyślna |
|-------|------|----------|
| Jednostki na atak | Skład jednej kompozycji ataku (0 = nieużywane) | spy: 1, light: 1 |
| Max mur | Pomiń wioski z murem powyżej poziomu (0 = wył.) | 0 |
| Min. surowce | Filtr wiosek po drewnie, glinie, żelazie | wyłączony |
| Tryb filtra surowców | Ścisły / Priorytetowy / Najwięcej | Ścisły |
| Opóźnienie klik (ms) | Opóźnienie między kliknięciami | 400 |
| Auto-start | Uruchom przy załadowaniu strony | false |
| Auto-refresh | Odświeżenie strony | włączone |
| Auto-refresh – zakresy (ms) | Min/max czasu dla każdego typu | patrz poniżej |
| Pokaż komunikaty | Komunikaty w grze | true |

### minJednostek (skład ataku)

Definiuje, ile jednostek każdego typu idzie na **jeden** atak. Skrypt liczy max. liczbę kompozycji i wysyła tylko tyle, ile możesz wykonać.

```
minJednostek: {
    spear: 0,    // Pikinier
    sword: 0,    // Miecznik
    axe: 0,      // Topornik
    archer: 0,   // Łucznik
    spy: 1,      // Zwiadowca
    light: 1,    // Lekki kawalerzysta
    marcher: 0,  // Łucznik na koniu
    heavy: 0,    // Ciężki kawalerzysta
    knight: 0    // Rycerz
}
```

Przykład: masz 10 zwiadowców i 5 LK, skład `spy: 1, light: 1` → max 5 kompozycji (ogranicza LK).

### Filtr min. surowców

Ustaw minimalne drewno, glinę i żelazo w wiosce (według ostatniego raportu zwiadowców). Dla danego surowca wartość 0 oznacza brak wymogu.

**Tryby:**
- **Ścisły** – atakuj tylko wioski spełniające limity. Brak takich wiosek → komunikat o błędzie + odświeżenie strony (zakres `brakSurowcow`).
- **Priorytetowy** – priorytet wiosek spełniających limity. Jeśli brak – wysyła ataki do wszystkich wiosek (jak bez filtra).
- **Najwięcej** – sortuje wioski po „bogactwie” (suma actual/min dla każdego surowca) i atakuje najbogatsze jako pierwsze.

### autoRefreshMs

Losowy czas odświeżenia strony:

| Klucz | Opis | Domyślna |
|-------|------|----------|
| `brakJednostek` | Gdy brak jednostek lub przycisków B | 60 000 – 300 000 (1–5 min) |
| `brakSurowcow` | Gdy filtr surowców włączony i brak wiosek spełniających (tryb ścisły) | 60 000 – 300 000 |
| `poAtaku` | Po wysłaniu ataków | 30 000 – 160 000 (0.5–2.7 min) |

## Funkcje

- **Limit kompozycji** – wysyła tylko tyle ataków, ile pozwala skład jednostek
- **Lista jednostek** – status (zielono/czerwono): np. `Zwiadowca: 10 (10/1)`
- **Filtr max mur** – pomija wioski z murem powyżej ustawionego poziomu
- **Filtr min. surowce** – trzy tryby: ścisły, priorytetowy, najwięcej
- **Liczba wiosek** – w panelu głównym: `(X/Y wiosek)` – ile spełnia filtry spośród wszystkich
- **Auto-refresh** – odświeża stronę po wysłaniu, przy braku jednostek lub braku wiosek z surowcami; czas losowy z zakresu
- **Countdown** – czas do odświeżenia w headerze panelu
- **DEBUG** – ustaw `const DEBUG = true` na początku pliku, aby w konsoli widzieć szczegóły (wioska, koordynaty, surowce, odległość, config)

## Uwagi

- Skrypt działa tylko na stronie **Asystenta Farmera** (`screen=am_farm`)
- Przy wykryciu Captcha skrypt się zatrzyma i wyświetli alert – rozwiąż ją przed ponownym uruchomieniem
- **Zasady gry**: używaj zgodnie z regulaminem Plemion
