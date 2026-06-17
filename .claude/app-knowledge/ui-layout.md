# UI Layout & Visual Design

## Board DOM Structure

```html
body
└── .game-container
    ├── .game-board
    │   ├── .top-row
    │   │   ├── #extra-deck-zone          ← exdeck Collection (stacked)
    │   │   └── .opponent-area            ← visual only, no logic
    │   ├── .field-row
    │   │   ├── #field-zone               ← fz position (1 slot)
    │   │   ├── .summon-slot[data-order="1..5"]   ← monster zones
    │   │   ├── .st-slot[data-order="1..5"]       ← spell/trap zones
    │   │   └── .graveyard-zone           ← graveyard Collection
    │   ├── #deck-zone                    ← deck Collection
    │   └── #hand-board                   ← hand cards (flex row, dynamic)
    ├── .phase-container
    │   └── .phase-btn[data-phase="dp|sp|m1|bp|m2|ep"] × 6
    ├── .log-message-container            ← replay step log messages
    └── .lcard-informations               ← card info panel (shown on hover)
```

## Card DOM Element

Each card is a `<div class="card-item ...">` inserted into the appropriate slot by `card.appendToBoard()`. The full class list reflects the card's current state — see `card-model.md` for the full class mapping.

## CSS File Responsibilities

| File | Owns |
|------|------|
| `css/simulator.css` | Card sizing, slot layout, zone positioning, overlay stacking |
| `css/theme.css` | CSS custom properties (colors, backgrounds) — all theming |
| `css/app.css` | Application chrome, header, controls |
| `css/tournamentStyle.css` | Tournament overlay mode styles |

**Rule:** Never hardcode colors in component CSS. All colors must reference CSS variables from `theme.css`.

## Theme System

`js/theme.js` (1,754 lines) handles runtime theme switching. It writes to CSS custom properties on `:root`. Users can switch themes without reload.

## Animation Design

| Animation | Mechanism | Duration |
|-----------|-----------|---------|
| Card movement | jQuery `.animate()` on a position clone | 400ms |
| Card flip | CSS class swap (fold state) | 5ms (immediate) |
| Defense rotation | CSS class swap `.switch-state-defense` | Instant |
| Target / Declare / Reveal | Animate.css class injection | ~600ms |
| Phase announcement | `position: fixed` overlay + zoom CSS | 1000ms |
| Skill activation | Same as phase announcement | 1000ms |

**Movement detail:** `startMoveAnimation()` clones the card at its current screen coordinates (via `getBoundingClientRect()`), appends the clone to `document.body`, then `moveAnimation()` animates the clone to the destination coordinates. The real card is already in the new slot during animation.

## Defense Position

`.switch-state-defense` rotates the card 90°. Card slots must accommodate the rotated aspect ratio — changing `.card-item` width/height without adjusting the slot container will break defense position display.

## Xyz Overlay Visual

When cards are overlaid:
- DOM slot gets `.overlay-slot` class
- Material cards sit at lower z-index than the main Xyz card
- `overlap_order` controls visual stacking order of materials

## Hand Layout

`#hand-board` uses flexbox. Cards space evenly as more are added. Adding margin/padding to `.card-item` shifts all hand cards — test with full 5+ card hands.

## Mobile

jQuery UI Touch Punch enables drag-drop on touch devices. Phase announcement and collection dialogs use `position: fixed` — test they don't clip on narrow viewports.

## Card Info Panel

`.lcard-informations` shows the hovered card's name, image, and description text. Populated on `mouseenter` by the card's jQuery event handler.
