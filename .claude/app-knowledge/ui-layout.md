# UI Layout & Visual Design

## Board DOM Structure

```html
body
└── .play-board-container          ← gets `.basic-mode` when the Basic view is active
    ├── .board-mode-bar            ← top bar: #board-top-controls (record/replay buttons in Basic) + #board-mode-toggle
    ├── #playtest.play-board > #game-board.game-board
    │   ├── .game-resource.hidden        ← <audio> sound effects (declare/reveal/target/phase)
    │   ├── .row.actions                 ← #new button, coin/dice tools
    │   ├── .card-slot-row > .phase-container
    │   │       └── input.phase-btn[value="dp|sp|m1|bp|m2|ep"] × 6   ← phase key is the `value` attr (no data-phase)
    │   ├── .card-slot-row               ← extra monster zones + banish:
    │   │       .summon-slot.summonex-slot[data-order="exss1"|"exss2"], #banish-slot.card-collection-slot
    │   ├── #field.card-slot-row         ← field + main monster zones + graveyard:
    │   │       .fz-slot[data-order="fz1"], .summon-slot[data-order="ss1".."ss5"], #graveyard-slot.card-collection-slot
    │   ├── .card-slot-row               ← extra deck + S/T zones + deck:
    │   │       #extra-deck-slot.card-collection-slot, .st-slot[data-order="st1".."st5"], #deck-slot.card-collection-slot
    │   └── #hand > .hand-board#hand-board   ← hand cards (each in a .hand-card-container)
    ├── aside.play-board-side > .log-message-container   ← replay/record controls, #log-message, chat
    ├── aside.play-board-side.lcard-informations         ← card info panel (shown on hover)
    └── #cardMenu / #collectionMenu / #deckmenu / #extradeckmenu / #graveyardmenu / #banishmenu
section.combo-graph-section                              ← below the board (see combo-graph.md)
    └── .combo-graph-toolbar (#rotate-graph) + #combo-graph.combo-graph.horizontal
```

> `#cardMenu` is a jQuery UI dialog that, while open, is appended **inside** the hovered `.simulator-card` and moved back to `<body>` on mouse-leave / on any menu action — see `context-menu-design.md`.

> Every slot is a `.holder-slot.card-slot`; individual zones add `.summon-slot`/`.summonex-slot`/`.st-slot`/`.fz-slot` + a `data-order` token; collection zones add `.card-collection-slot` with a `.collection-count` badge. There is **no** `.game-container`/`.top-row`/`.field-row`/`#field-zone`/`#deck-zone` — those never existed.

> **Basic / Advanced view.** The board opens in **Basic** (always — not persisted): `.play-board-container.basic-mode` hides both `.play-board-side` columns and scales the board up via `--slot-size` on `.holder-slot` (desktop only). The record/replay buttons move from `.log-message-header` into `#board-top-controls`. `js/main.js > boardModeEvent()` drives it. Full reference: [`docs/BASIC-ADVANCED-VIEW.md`](../../docs/BASIC-ADVANCED-VIEW.md).

## Card DOM Element

Each card is a `<div class="simulator-card card-id-{uuid}" ...>` (NOT `.card-item`) inserted into the appropriate slot by `card.appendToBoard()`. The full class list reflects the card's current state — see `card-model.md` for the verified class mapping (`.normal`/`.fold`, `.attack`/`.defense`, position value, `.overlap`/`.overlay`).

## CSS File Responsibilities

| File | Owns |
|------|------|
| `css/simulator.css` | Card sizing, slot layout, zone positioning, overlay stacking |
| `css/combo_graph.css` | Combo graph nodes/arrows/zone chips; `.horizontal`/`.vertical` rotation, `.cg-active` highlight (colors from `theme.css` vars) |
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
| Defense rotation | CSS class swap `.defense` | Instant |
| Target / Declare / Reveal | Animate.css class injection | ~600ms |
| Phase announcement | `position: fixed` overlay + zoom CSS | 1000ms |
| Skill activation | Same as phase announcement | 1000ms |

**Movement detail:** `startMoveAnimation()` clones the card at its current screen coordinates (via `getBoundingClientRect()`), appends the clone to `document.body`, then `moveAnimation()` animates the clone to the destination coordinates. The real card is already in the new slot during animation.

## Defense Position

`.defense` rotates the card 90°. Card slots must accommodate the rotated aspect ratio — changing `.simulator-card` width/height without adjusting the slot container will break defense position display.

## Xyz Overlay Visual

When cards are overlaid:
- DOM slot gets `.overlay-slot` class
- Material cards sit at lower z-index than the main Xyz card
- `overlap_order` controls visual stacking order of materials

## Hand Layout

`#hand-board` uses flexbox. Cards space evenly as more are added. Adding margin/padding to `.simulator-card` shifts all hand cards — test with full 5+ card hands.

## Mobile

jQuery UI Touch Punch enables drag-drop on touch devices. Phase announcement and collection dialogs use `position: fixed` — test they don't clip on narrow viewports.

## Card Info Panel

`.lcard-informations` shows the hovered card's name, image, and description text. Populated on `mouseenter` by the board's delegated hover handler (`Board.cardHoverEvents()`).
