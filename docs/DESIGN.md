# Design system — RPG-minimal

Dark fantasy meets clinical precision: parchment-gold accents and serif display type over a
near-black warm surface, with all data set in a mono font. The fantasy layer is language and
texture, never a gimmick that obscures numbers.

## Tokens

| Token | Hex | Use |
|---|---|---|
| `abyss` | `#0D0B0E` | app background |
| `surface` | `#1A1720` | cards |
| `surface-2` | `#211D2A` | inputs, raised panels |
| `rune` / `rune-2` | `#2A2535` / `#3A3348` | borders / hover borders |
| `gold` (`-bright`, `-dim`) | `#C9A84C` | primary accent — candlelight |
| `arcane` | `#6B4F8A` | secondary accent |
| `verdant` | `#4A7C59` | success |
| `ember` | `#C4622D` | warning |
| `blood` | `#A63A3A` | danger / over-target |
| `ink` / `ink-2` / `ink-3` | `#E8E4DE` / `#8A8278` / `#575047` | text hierarchy |

Type: **Cinzel** (display, uppercase, tracked) · **Inter** (body) · **DM Mono** (all numbers).

## Chart palette (data marks only)

The brand accents above fail chart-safety checks on the dark surface (validated with the
dataviz palette validator: lightness band OKLCH L 0.48–0.67, chroma ≥ 0.10, adjacent-pair
CVD ΔE ≥ 12, contrast ≥ 3:1 vs `#1A1720`). Data marks therefore use OKLCH-snapped variants
of the same hues — **all four checks pass**:

| Slot | Hex | Assigned to |
|---|---|---|
| chart-gold | `#AC9225` | calories / primary series |
| chart-arcane | `#926BBC` | protein |
| chart-verdant | `#4E9E67` | carbs |
| chart-ember | `#C36A1E` | fat |

Raw weigh-in dots use recessive `#6B6478` so the gold trend line reads as the signal.

Chart rules applied throughout: one axis, 2px lines, recessive dashed grids, data-driven
Y domains for line charts (zero baseline only for bars), tooltips everywhere, legends for
multi-series, text always in ink tokens (color carries identity via marks, not words).

## RPG language layer

| Concept | In-app name |
|---|---|
| Calorie goal | **Daily Ration** |
| Protein target | **Strength Quota** |
| Deficit / surplus | **Endurance Tax** / **Growth Tithe** |
| TDEE estimate | **Metabolic Codex** |
| Logging streak | **Chronicle Streak** |
| Weekly summary | **Weekly Ledger** |
| Achievements | **Feats** ("Iron Discipline" = 30-day streak, "The Consistent" = 7) |

Restraint rule: numbers, units and math are always plain; the flavor lives in headings and copy.
