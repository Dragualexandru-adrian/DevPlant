# MedGuard — design system

Source of truth: [tailwind.config.js](tailwind.config.js). Use token names below, never raw hex, in new components.

## Colors

| Role | Token | Hex | Use |
|---|---|---|---|
| Primary | `primary` | `#1D6A63` | Brand accent, primary buttons, active icons |
| On primary | `on-primary` | `#E2FFFA` | Text/icons on `primary` |
| Primary container | `primary-container` | `#A8F0E7` | Active nav bg |
| On primary container | `on-primary-container` | `#045C56` | Text on `primary-container`; primary button hover bg |
| Secondary | `secondary` | `#4A6460` | Secondary accents |
| Secondary container | `secondary-container` | `#CCE8E4` | Secondary buttons (cancel, correct stock) |
| On secondary container | `on-secondary-container` | `#3D5653` | Text on `secondary-container` |
| Error | `error` | `#A83836` | Destructive actions |
| On error | `on-error` | `#FFF7F6` | Text on `error`; alert badge text |
| Surface | `surface` | `#F6FAF8` | Page/header background |
| Surface container lowest | `surface-container-lowest` | `#FFFFFF` | Cards, sidebar |
| Surface container low | `surface-container-low` | `#EEF5F3` | Nested panels, table header, hover |
| Surface container | `surface-container` | `#E7F0ED` | Inactive pill buttons |
| Surface container high / highest | `surface-container-high/-highest` | `#E1EAE8` / `#D9E5E2` | Disabled states, pill hover |
| On surface | `on-surface` | `#2A3433` | Primary text |
| On surface variant | `on-surface-variant` | `#56615F` | Secondary text, nav inactive |
| Outline / outline variant | `outline` / `outline-variant` | `#727D7B` / `#A9B4B2` | Borders (always used at `/20`–`/40` opacity) |
| Success / on-success-container | `success` / `on-success-container` | `#006D30` / `#00210A` | Confirmed dose badge |
| Warning / on-warning-container | `warning` / `on-warning-container` | `#9B4500` / `#331200` | Low stock, vial-accessed badge |

Container colors (`*-container`) always pair with their matching `on-*-container` for text — never mix across pairs.

## Typography

Fonts (see `fontFamily` in tailwind config):
- **Headline / Display** — `font-headline` / `font-display` → "Wix Madefor Display": page titles, headline numbers.
- **Body / Title / Label** — `font-body` / `font-title` / `font-label` → "Instrument Sans": everything else (UI text, buttons, form labels).
- **Mono** — `font-mono` → "Red Hat Mono": times, timestamps, numeric stats (`tabular-nums`).

Scale: `display-lg` (40/48, −0.5px, 700) down through `headline-lg/md/sm`, `title-lg/md`, `body-md/sm`, `label-lg/md/sm`, `mono-md/sm`. Pick by role, not by pixel size — e.g. a card heading is always `headline-sm`, a stat number is always `display-lg` (`display-lg-mobile` on small screens).

## Shape & spacing

- Border radius: `rounded-sm` (6px) for small controls, `rounded-md` (12px, default for buttons/inputs/cards), `rounded-lg` (16px, cards/sections), `rounded-xl` (24px, rare/large surfaces). `rounded-full` for pills/avatars/badges.
- Cards (`Card` in [ui.jsx](src/ui.jsx)): `bg-surface-container-lowest`, `rounded-lg`, `border border-outline-variant/30`, padding `p-6`.
- Page layout: sidebar `w-[260px]`, content `max-w-[1320px]` centered, consistent `gap-6`/`gap-8` rhythm.
- Transitions: `duration-state-change` (120ms) on every hover/active color change.

## Components ([ui.jsx](src/ui.jsx))

- `Icon` — Material Symbols Outlined, `fill` prop toggles filled variant (used for active nav/state).
- `Badge` — status chip (`confirmed` / `accessed` / `scheduled` / `alert`), each with its own container color + icon.
- `Card` — the standard content surface.
- `btnPrimary` — primary action button class string: `bg-primary text-on-primary`, hover `bg-on-primary-container`, disabled `bg-surface-container-high`.
- Secondary/ghost actions use `bg-secondary-container text-on-secondary-container` inline (cancel buttons, "Corectează stoc").

## Language & tone

All UI copy is in Romanian, direct and clinical (e.g. "Administrare confirmată", "Flacon accesat") — no slang, no exclamation marks.

## Adding a new screen

1. Reuse `Card`, `Icon`, `Badge`, `btnPrimary` from `ui.jsx` before writing new markup.
2. Only use the color/type tokens above — if a need doesn't fit, extend `tailwind.config.js`, don't inline a hex value.
3. Match the Romanian tone and the existing label phrasing style (short, sentence-case, no trailing punctuation on labels).
