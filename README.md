# day3

Projekty z trzeciego dnia warsztatów vibe-coding.

## Labirynt

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

### Sterowanie

Strzałki / WASD — ruch, `R` — nowy labirynt, `Esc` — menu, `Enter` / `Spacja` — start / następny poziom.
