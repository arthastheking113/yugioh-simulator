# 08 — UI, Rendering & Context Menus

How the board is drawn, animated, themed, and how players trigger actions. **Everything here is verified against the shipped `index.html`, `css/simulator.css`, and `js/simulator.js`.** (Older project prose described a `.game-container`/`.top-row`/`.field-row`/`#field-zone` layout that does **not** exist — ignore that.)

## Real board DOM structure

```html
body
└── .play-board-container
    ├── #playtest.play-board
    │   └── #game-board.game-board
    │       ├── .game-resource.hidden          ← hidden <audio> sound effects:
    │       │       .declare-sound-effect / .reveal-sound-effect /
    │       │       .target-sound-effect / .phase-sound-effect
    │       ├── .row.actions                    ← #new "Start Again" button, coin/dice tools
    │       ├── .card-slot-row.row              ← phase row:
    │       │       .phase-container > input.phase-btn[value="dp|sp|m1|bp|m2|ep"] × 6
    │       ├── .card-slot-row                  ← extra-monster-zone row:
    │       │       .holder-slot.card-slot.summon-slot.summonex-slot[data-order="exss1"|"exss2"]
    │       │       + #banish-slot.card-collection-slot.banish
    │       ├── #field.card-slot-row            ← field + main monster zones + graveyard:
    │       │       .fz-slot[data-order="fz1"],
    │       │       .summon-slot[data-order="ss1".."ss5"]   (ss3 also has #center-m-z),
    │       │       #graveyard-slot.card-collection-slot.graveyard
    │       ├── .card-slot-row                  ← extra deck + S/T zones + deck:
    │       │       #extra-deck-slot.card-collection-slot.exdeck,
    │       │       .st-slot[data-order="st1".."st5"],
    │       │       #deck-slot.card-collection-slot.deck
    │       ├── #hand > .hand-board#hand-board  ← hand cards (each wrapped in .hand-card-container)
    │       └── .water-mark.hidden
    ├── aside.play-board-side > .log-message-container
    │       ← record/replay controls: .start-record-button .stop-record-button
    │         .replay-button .pause-button .resume-button ; #log-message ; .chat-input/.chat-btn
    ├── aside.play-board-side.lcard-informations   ← hovered-card info panel (image + .lcard-descriptons)
    ├── #deckmenu / #extradeckmenu / #graveyardmenu / #banishmenu  ← .collection-menu dialogs
    ├── #cardMenu.card-menu.menu-dialog                            ← per-card menu (opens on hover)
    └── #collectionMenu.collection-menu.menu-dialog
section.combo-graph-section                                        ← below the board (see "Combo graph")
    └── .combo-graph-toolbar (#rotate-graph) + #combo-graph.combo-graph.horizontal
```

Key facts:

- **Every slot** is a `.holder-slot.card-slot`. Individual zones add a zone class (`.summon-slot`, `.summonex-slot`, `.st-slot`, `.fz-slot`) and a **`data-order` token** (`ss1`–`ss5`, `exss1`/`exss2`, `st1`–`st5`, `fz1`) plus `data-position`. A card placed there has its `collection_order` set to that token.
- **Collection zones** are `.holder-slot.card-slot.card-collection-slot` with stable IDs `#deck-slot`, `#extra-deck-slot`, `#graveyard-slot`, `#banish-slot`, each containing a `.collection-count` badge and an `<em class="ddescription">` label.
- **Phase buttons** are `<input class="phase-btn …">` whose **`value`** holds the phase key (`dp`/`sp`/`m1`/`bp`/`m2`/`ep`) — there is no `data-phase` attribute.
- The two `.summonex-slot` cells (`exss1`/`exss2`) are the **Extra Monster Zones** where extra-deck monsters typically land.

## The card element (verified)

`Card.drawHtml()` produces:

```html
<div id="card-{uuid}" class="simulator-card card-id-{uuid}" data-id="{uuid}" title="{name}">
  <span class="card-name">{name}</span>
  <div class="card-imgs">
    <img class="card-img back-image"  src="asset/back_card.png">
    <img class="card-img front-image" src="{imageURL or fallback}">
  </div>
</div>
```

The base class is **`.simulator-card`** (not `.card-item`). State is reflected by classes whose names are the bare property values: `.normal`/`.fold`, `.attack`/`.defense`, `.hand`/`.summon`/`.st`/`.fz`/`.deck`/`.exdeck`/`.graveyard`/`.banish`, the literal type flags `.isMonster`/`.isSpell`/`.isTrap`/`.isST`, and `.overlap` (material) / `.overlay` (Xyz monster). Full detail and the `updateHtml()` strip-and-re-add cycle are in [03-card-model.md](03-card-model.md).

## Where the rendering logic lives (inside the JS classes)

The visual layer is methods on `Card`, not a separate module:

| Method | Role |
|--------|------|
| `card.drawHtml()` | Build the element on creation |
| `card.updateHtml()` | Re-sync classes after a state change (called by `board.updateItem`) |
| `card.appendToBoard()` | Place the element into the right slot/container (see below) |
| `card.startMoveAnimation()` / `moveAnimation()` / `endBoardAnimation()` | The move clone-and-animate cycle |
| `card.doAnimation(action, animation, duration)` | Inject Animate.css classes + play a sound |
| `collection.drawOnBoard()` | Re-render a stacked zone (top card + count badge) |

`appendToBoard()` routing (verified): collection positions delegate to `collection.appendCard()`; `summon`/`st`/`fz` resolve the slot via `getCardSlot(uuid)` (which finds `.card-slot[data-order="<collection_order>"]`); `hand` wraps the card in a new `.hand-card-container` appended to `#hand-board`. **Materials (`isOverlap`) are `prependTo` the slot (drawn underneath); the Xyz monster is `appendTo` (drawn on top).** This is invariant #2's payoff: because mutations route through `updateItem → updateHtml`, the DOM never drifts from the data.

## CSS file responsibilities

| File | Owns |
|------|------|
| `css/simulator.css` | Card sizing, slot layout, zone positioning, overlay stacking (`.holder-slot.overlay-slot .simulator-card:nth-last-child(n)` does the fanned-pile look) |
| `css/theme.css` | **All** CSS custom properties (colors, backgrounds) |
| `css/app.css` | Application chrome — header, controls |
| `css/tournamentStyle.css` | Tournament overlay mode styles |

**Hard rule:** never hardcode a color in component CSS. Every color references a variable defined in `theme.css`, which is what lets `js/theme.js` re-theme at runtime by rewriting variables on `:root` without a reload.

## Animation system (verified)

| Animation | Mechanism | Duration |
|-----------|-----------|----------|
| Card movement | jQuery `.animate()` on a cloned element (`.move-container`) | **400ms** |
| Card flip (fold) | CSS class swap (`.normal` ⇄ `.fold`) | ~immediate |
| Defense rotation | CSS class `.defense` (rotate 90°) | instant |
| Target / Declare / Reveal | `doAnimation()` injects Animate.css classes + plays the matching `.animation-sound` audio | ~600ms |
| Phase / skill announcement | `doAnimation('enterPhase')` builds a `#phase-lightbox.lightbox-container` with `.animate__zoomIn` → `.animate__fadeOut` | **~1000ms** |
| Replay step wait (move) | timer between steps | **1500ms** |
| Replay step wait (flip/switch) | fast path | **5ms** |

**Movement detail:** `startMoveAnimation()` clones the card at its current screen coordinates (`getBoundingClientRect()`) into a `.move-container` appended to the board, then `moveAnimation()` animates the clone from old → new coordinates. The *real* card is already in its destination slot during the animation; the clone is cosmetic and removed at the end.

## Defense position caveat

`.defense` rotates the card 90°, so a slot must accommodate the rotated aspect ratio. Changing `.simulator-card` width/height without adjusting `.holder-slot` breaks defense display (and the overlay-pile offsets). Re-check defense rendering and a full Xyz pile after any sizing change.

## Hand layout

`#hand-board.hand-board` is a flex row; each card sits inside a `.hand-card-container`. Empty containers are pruned by `appendToBoard()`. Adding margin/padding to `.simulator-card` shifts every hand card — test with a full 5+ card hand.

## Mobile

jQuery UI **Touch Punch** (`js/jquery.ui.touch-punch.min.js`) enables drag-drop on touch devices. Phase announcements and collection dialogs are overlays; verify they don't clip on narrow viewports. Overlay slots + touch drag are a known fiddly combination.

## Card info panel

`aside.lcard-informations` shows the hovered card's image and `description` (`.lcard-descriptons`). It is populated on `mouseenter` by the card's jQuery hover handler (which also shows the context menu via `cardMenu.sideCardInformations()`).

---

## Combo graph (read-only visualization)

`js/combo_graph.js` (`ComboGraph`) renders a **visual flow of a recorded combo** into `<section class="combo-graph-section"><div id="combo-graph">` below the board, styled by `css/combo_graph.css`. It is **read-only**: it consumes `board.exportState()` and never mutates state, adds no card property, and changes nothing in export/import.

- **Input:** the export's `playLogData.initItems`/`items` (→ a `uuid → {name, imageURL}` lookup) and `playLogData.steps[]` (→ the ordered flow). See [05-replay-and-playlog.md](05-replay-and-playlog.md).
- **Each step → a node:** a position-changing `update` → card image + action verb (Draw / Summon / Send to GY / Banish / …) + a destination zone chip; `overlay` → a material node, with consecutive overlays joined by a `+`; fold/switch-only updates and `target`/`declare`/`reveal` → small badges; `update-phase` → a divider; record markers / `chat` / `shuffle` are skipped (their step index is preserved so replay highlighting stays aligned).
- **Rotatable:** container class `.horizontal` ⇄ `.vertical` via the `#rotate-graph` button. There is **no** manual "Generate" button — it auto-builds.
- **Auto-build + live sync:** `window.comboGraphRefresh()` rebuilds from the current board on Stop Record, in `importState()`, and on initial load; during replay the engine calls guarded `comboGraphOnReplayStart` / `comboGraphOnStep` / `comboGraphOnReplayEnd` hooks to highlight the playing step. Detail in [05-replay-and-playlog.md](05-replay-and-playlog.md).

---

## Context menu system

**File:** `js/card_menu.js` — three classes: `MenuBase`, `CardMenu`, `CollectionMenu`. The menu containers in the DOM are `#cardMenu.card-menu.menu-dialog` (per-card) and `#collectionMenu.collection-menu.menu-dialog`, plus the four browsable zone dialogs `#deckmenu` / `#extradeckmenu` / `#graveyardmenu` / `#banishmenu`.

The per-card menu opens **on hover** (the card's jQuery `mouseenter` calls `cardMenu.setCard(card).show()`; `mouseleave` hides it). Its items are static HTML built once in `CardMenu.drawHtml`; `updateMenu()` shows only the ids listed in `menuList[card.position]` (or `menuList['overlap']` for a material), filtered by `card.foldState` and per-item `condition`. Each item encodes its action in a `data-target` attribute:

```html
<a data-target="summon,attack,normal">SS ATK</a>
```

Parsed as `[destination_position, switchState, foldState]`. The click handler splits it and calls `card.moveTo(destination, …)` with the decoded values (plus any `attack()`/`defense()`/`fold()` the item implies). Non-move actions use a custom action key instead of a position triple.

**Menu lifecycle (important):** while open, the shared `#cardMenu` dialog is appended **inside** the hovered card (so it positions relative to it) and is moved back to `<body>` on mouse-leave. Because a menu click does **not** fire mouse-leave, the action handler **first detaches the dialog to `<body>`** (and clears any pending overlay/slot selection) before running the action — otherwise a move (e.g. to the graveyard) would drag the menu along with the card, and it would keep reappearing on that card.

### Actions available per position

**Hand**

| Action | Effect |
|--------|--------|
| Reveal / Declare / Target | `card.reveal()` / `card.declare()` / `card.target()` |
| To Deck (Top / Bottom) | `card.moveTo('deck', isTop, null)` |
| SS ATK | `card.moveTo('summon', false, slotToken)` + `card.attack()` |
| Set (monster) | `card.moveTo('summon', false, slotToken)` + `card.defense()` + `card.fold('fold')` |
| Activate (ST) | `card.moveTo('st', false, slotToken)` + `card.fold('normal')` |
| Set (ST) | `card.moveTo('st', false, slotToken)` + `card.fold('fold')` |

**Summon (face-up)**

| Action | Effect |
|--------|--------|
| Declare / Target | `card.declare()` / `card.target()` |
| Move | prompt for a new slot → `card.moveTo('summon', false, newSlotToken)` |
| Overlay | prompt for a target slot → `board.overlayCard(uuid, slotToken)` |
| Detach | `board.detachOverlay(uuid)` |
| ATK ⇄ DEF | `card.defense()` / `card.attack()` |
| To Hand / To GY / To Banish | `card.moveTo('hand' / 'graveyard' / 'banish')` |

**Spell/Trap zone**

| Action | Effect |
|--------|--------|
| Declare | `card.declare()` |
| Move | `card.moveTo('st', false, newSlotToken)` |
| Flip (activate) | `card.fold('normal')` |
| Detach | `board.detachOverlay(uuid)` |

### Collection dialogs (`CollectionMenu`)

Clicking a stacked zone opens a browsable list of all its cards; each row has its own action buttons:

| Zone (dialog id) | Row actions |
|------------------|-------------|
| Graveyard (`#graveyardmenu`) | To Hand, To Summon, To Banish, Declare, Target |
| Banish (`#banishmenu`) | To Hand, To Summon, Declare, Target |
| Extra Deck (`#extradeckmenu`) | To Summon (SS), To Banish, Reveal |
| Deck (`#deckmenu`) | browse / draw |

### Slot selection & highlighting

When a move needs a target slot, the board highlights eligible empty slots (`highlightSS_STCardHolders` / `highlightSSExCardHolders` add `.highlight` to free `.summon-slot, .summonex-slot, .st-slot, .fz-slot`). A field-zone slot is only offered when the card `isSpell`. The chosen slot's `data-order` token becomes the card's `collection_order`.

### Overlay selection & cancellation

**Overlay** on a face-up monster calls `board.startDoOverlay(card)` → `selectOverlay()`, which marks each candidate summon slot with `overlay-highlight` (the animated dashed border) **and** `waiting-overlay` (the overlay cursor + the click target — `selectOverlayEvent` listens on `.waiting-overlay`), and stores the pending pick via `setWaitingOverlay({card, canBeOverlayCards})`. Clicking a highlighted slot runs `board.overlayCard(uuid, slotToken)`.

The menu action handler clears `setWaitingActions(null)` **and** `setWaitingOverlay(null)` up front, so **any non-overlay action cancels a pending overlay.** `setWaitingOverlay(null)` must strip **both** classes — leaving `waiting-overlay` would keep the slot armed (cursor + clickable). (The board-wide click-to-cancel `removeOverlayHighlight` ignores clicks inside a `.ui-dialog`, so the menu's explicit clear is what cancels for menu clicks.)

### Condition system

Menu items can carry a `condition` field checked against card state; if `card[condition]` is falsy the item is hidden — context-sensitive menus without per-card branching.

### Xyz material menu

A material card (`isOverlap === true`) has a separate, minimal menu — it cannot move independently while attached. Its only meaningful action is **Detach**.

### Adding a new menu item (recipe)

1. Add the `<a data-target id>` to the static menu HTML in `CardMenu.drawHtml`, and register its id in the relevant `menuList[position]` array.
2. Set `data-target` to `"position,switchState,foldState"` (move) or a custom action key (non-move).
3. Handle the action key in the click-handler switch.
4. Call the appropriate `card.*` / `board.*` method.
5. **Ensure the action logs to PlayLog** (invariant #1) — the underlying primitive (`moveTo`/`fold`/…) usually does, but verify.
