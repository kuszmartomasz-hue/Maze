# day3

Projekty z trzeciego dnia warsztatów vibe-coding.

## Zaklęty Ogród

Przeglądarkowa gra logiczna — wymagania w [wymagania.md](wymagania.md).

### Uruchomienie

Moduły ES nie działają z `file://`, potrzebny jest serwer statyczny:

```sh
python3 -m http.server 8000    # na Windows: python -m http.server 8000
```

i otwórz <http://localhost:8000>.

### Testy

```sh
node --test    # Node ≥ 18
```

### Grafiki

Tekstury w `assets/*.jpg` powstają z większych PNG (prompty w `assets/prompty/`, PNG nie trafiają do repo):

```sh
python3 -c "
from PIL import Image
for n in ('zywoplot', 'zwir', 'las'):
    Image.open(f'assets/{n}.png').convert('RGB').resize((512, 512), Image.LANCZOS).save(f'assets/{n}.jpg', quality=85, optimize=True)
"
```

### Sterowanie

Strzałki / WASD — ruch, `R` — nowy labirynt, `Esc` — menu, `Enter` / `Spacja` — start / następny poziom.
