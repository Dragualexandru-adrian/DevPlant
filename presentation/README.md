# MedGuard pitch deck

A 7-slide, ~3-minute pitch for Life Science HackDay Timișoara (Challenge 3, Medication companion).

## Files

| File | What it is |
| --- | --- |
| `index.html` | The deck. Single self-contained file (inline CSS/JS) |
| `assets/` | Phone screenshots used by the slides (`dashboard`, `doses`, `scan`, `history`, `welcome`, `largetext`, `login`) |
| `assets/old/` | Previous wide screenshots, kept for reference |
| `MedGuard-pitch.pdf` | Static PDF export (no animations) |

## Presenting

1. Open `index.html` in Chrome or Edge (double-click it). Press **F11** for full screen.
2. The deck is a fixed 16:9 stage that scales to any window.
3. Open it from the `presentation/` folder, or the screenshots won't load.

Controls:

- **Next:** Right arrow, Space, Page Down, mouse wheel down, swipe left
- **Previous:** Left arrow, Page Up, mouse wheel up, swipe right
- **Jump:** open `index.html#4` to start on slide 4
- **Edit text:** press **E** (or hover the top-left corner), click any text, **Ctrl+S** to save

## Slides and timing

| # | Slide | Time |
| --- | --- | --- |
| 1 | Title | 15 s |
| 2 | The problem (statistics) | 25 s |
| 3 | Why not cameras? Acceptance | 25 s |
| 4 | How it works: *Flacon accesat* ≠ *Administrare confirmată* | 30 s |
| 5 | The working app (real screenshots; switch to the live demo here) | 30 s |
| 6 | Further direction: elderly users | 25 s |
| 7 | Close: decision support, call 112, AI tools, data | 15 s |

Key message to land on slide 4: the system detects that a vial was **accessed**, not that a dose was **swallowed**. Confirmation is a separate button press.

## Updating the screenshots

1. Run the frontend (`cd frontend && npm run dev`) and open it in a browser at phone width (about 390×800).
2. Capture each screen and save it over the matching file in `assets/` (JPG, about 387×795 so the aspect ratio stays portrait).
3. Image heights are set in `index.html`: `.phones .shot` (slide 5), `.pair .shot` (slide 6), `.s1 .shot` (slide 1).

The current screenshots use demo data only (a fictional patient, three medicines). No real patient data.

## Re-exporting the PDF

Use the frontend-slides export script (needs Playwright/Chromium):

```bash
bash ~/.claude/skills/frontend-slides/scripts/export-pdf.sh presentation/index.html presentation/MedGuard-pitch.pdf
```

Use absolute paths if the output lands in a temp folder.

## Editing the look

- Colors and fonts are CSS variables in `:root` at the top of `index.html`.
- Each slide is a `<section class="slide">`; entrance animations use the `.reveal` class (`d1`–`d4` set the delay).
- Keep slide content inside the 1920×1080 stage. Do not add responsive breakpoints.
