# Design system — Terraria-style

Chunky game UI meets a clean data app: deep night-sky background, blue panels
with stepped "pixel" corners and beveled borders, gold pixel-font headings with
dark outlines, and big terminal-style numerals. Copy is plain modern English —
the game feel comes from the visuals (and the achievements), not archaic prose.

## Tokens

| Token | Hex | Use |
|---|---|---|
| `abyss` | `#0B0D21` | night-sky app background (with faint pixel stars) |
| `surface` | `#232A5C` | panels |
| `surface-2` | `#2C3572` | raised panels / inputs |
| `rune` / `rune-2` | `#0D0F26` / `#4A55A0` | hard borders / bevel highlight |
| `gold` (`-bright`, `-dim`) | `#D8B356` / `#FFD76E` / `#9B7F45` | primary accent |
| `arcane` | `#6B74C8` | secondary accent |
| `verdant` | `#4E9E3D` / `#6ABE30` | success |
| `ember` | `#C05F2C` / `#E08850` | warning |
| `blood` | `#D43D3D` | danger / over-target / streak hearts |
| `mana` | `#5B8DD9` | water bar |
| `ink` / `ink-2` / `ink-3` | `#F2F3FA` / `#A9B0D6` / `#6A72A5` | text hierarchy |

Type: **Press Start 2P** (headings, tiny sizes, gold with outline) ·
**Pixelify Sans** (body) · **VT323** (all numbers, sized up for legibility).

Signature pieces: `.pixel-corners` stepped clip-path on every panel/button,
beveled `shadow-card`, segmented progress rings, striped chunky stat bars,
gold corner brackets (`.ornate`) on hero panels.

## Chart palette (data marks only)

Unchanged from v1 and re-validated against the new panel surface `#232A5C`
(lightness band OKLCH L 0.48–0.67, chroma ≥ 0.10, adjacent-pair CVD ΔE ≥ 12,
contrast 3.2–4.4:1 — all pass):

| Slot | Hex | Assigned to |
|---|---|---|
| chart-gold | `#AC9225` | calories / primary series |
| chart-arcane | `#926BBC` | protein |
| chart-verdant | `#4E9E67` | carbs |
| chart-ember | `#C36A1E` | fat |

Raw weigh-in dots use recessive `#7B84B8`. Chart rules unchanged: one axis,
2px lines, recessive dashed grids, data-driven Y domains for lines, tooltips
everywhere, legends for multi-series, text in ink tokens.

## Voice

Plain and modern: "Add Food", "Food Log", "Calories", "Water", "Estimated
TDEE", "Weekly Summary", "Achievements". Achievement names stay playful
("First Bite!", "Iron Discipline", "Century Streak") — that is the one place
the game flavor lives in words.
