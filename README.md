# Skrypt Atak B - Asystent Farmera Plemiona

Skrypt automatycznie klika przyciski **Atak B** na stronie Asystenta Farmera w grze Plemiona. Liczy dostępne kompozycje ataków na podstawie jednostek i ogranicza wysyłanie, aby nie spamować zapytaniami.

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

- **Panel GUI** w prawym dolnym rogu: status, lista jednostek, przycisk **START**
- Zakładka **⚙️ Konfiguracja** – jednostki na atak, max mur, opóźnienie, auto-refresh itd. Ustawienia zapisywane w localStorage. Przy pierwszym uruchomieniu (bez zapisanej konfiguracji) skrypt używa danych z szablonu B na stronie; brakujące wartości – z domyślnych ustawień
- **Auto-start**: skrypt sam rozpoczyna wysyłanie po ~1 s od załadowania (gdy włączone w GUI)
- **Ręczne**: kliknij **START**, aby wysłać ataki
- **Countdown** w prawym górnym rogu panelu pokazuje czas do odświeżenia (po najechaniu: typ – brak jednostek / po ataku)

## Konfiguracja

**Cała konfiguracja odbywa się w GUI** (zakładka ⚙️ Konfiguracja). Przy braku zapisu w localStorage skrypt korzysta z danych ze strony (szablon B), a brakujące ustawienia bierze z wartości domyślnych.

| Opcja | Opis | Domyślna |
|-------|------|----------|
| Jednostki na atak | Skład jednej kompozycji ataku (0 = nieużywane) | spy: 1, light: 1 |
| Max mur | Pomiń wioski z murem powyżej poziomu (0 = wył.) | 0 |
| Opóźnienie klik (ms) | Opóźnienie między kliknięciami | 400 |
| Auto-start | Uruchom przy załadowaniu strony | false |
| Auto-refresh | Odświeżenie strony (brak jed. / po ataku) | włączone |
| Auto-refresh – zakresy (ms) | Min/max czasu odświeżenia | patrz poniżej |
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

### autoRefreshMs

Losowy czas odświeżenia strony przy włączonym auto-start:

| Klucz | Opis | Domyślna |
|-------|------|----------|
| `brakJednostek` | Gdy brak jednostek lub przycisków B (min–max ms) | 60 000 – 300 000 (1–5 min) |
| `poAtaku` | Po wysłaniu ataków (min–max ms) | 30 000 – 160 000 (0.5–2.7 min) |

## Funkcje

- **Limit kompozycji** – wysyła tylko tyle ataków, ile pozwala skład jednostek
- **Lista jednostek** – status (zielono/czerwono): np. `Zwiadowca: 10 (10/1)`
- **Auto-refresh** – odświeża stronę po wysłaniu lub gdy brak jednostek; czas losowy z zakresu
- **Countdown** – widoczny czas do odświeżenia w headerze panelu
- **Pomijanie muru** – opcjonalne pomijanie wiosek z za wysokim murem

## Uwagi

- Skrypt działa tylko na stronie **Asystenta Farmera** (`screen=am_farm`)
- Przy wykryciu Captcha skrypt się zatrzyma i wyświetli alert – rozwiąż ją przed ponownym uruchomieniem
- **Zasady gry**: używaj zgodnie z regulaminem Plemion
