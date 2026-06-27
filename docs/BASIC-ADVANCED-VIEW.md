# Basic / Advanced View

A board-top toggle that collapses the simulator down to just the play area
("Basic") or shows the full three-column layout ("Advanced"), plus the
supporting changes that make Basic mode usable on its own.

> **TL;DR for players:** the board now opens in **Basic** — a clean, wide,
> board-only view. Click **Advanced** (top of the board) to bring back the
> card-overview column (left) and the log column (right). On phones the button
> reads **Show Logs / Hide Logs** instead, since there is no left column there.

---

## What the feature does

| Capability | Behaviour |
|------------|-----------|
| **Toggle** | A pill button on top of the board switches between Basic and Advanced. |
| **Default** | The board **always opens in Basic**. The choice is *not* persisted — every load starts in Basic. |
| **Column hiding** | Basic hides both side columns: the card-overview (`.lcard-informations`, left) and the log (`.play-board-side`, right). |
| **Board expansion** | In Basic, the board's card slots grow fluidly to reclaim the freed horizontal space (desktop only). |
| **Relocated controls** | Record / Stop / Play / Pause / Resume move to the top bar in Basic (the log header that normally holds them is hidden), and back into the log header in Advanced. |
| **Responsive label** | Desktop: `Basic` / `Advanced`. Mobile (≤1199px): `Hide Logs` / `Show Logs`. |
| **Card info on load** | The left card-info panel is pre-filled with a random visible card instead of staying blank until hover. |
| **Card info on declare** | Declaring a card's effect surfaces that card in the info panel — Advanced view only. |

---

## The two view states

```
ADVANCED (≥1200px)                          BASIC (default)
┌──────────┬───────────────┬──────────┐     ┌───────────────────────────────┐
│ card     │   game board  │   log    │     │   [controls]   [ Basic ▾ ]    │
│ overview │   (≈60% wide) │  + record│     ├───────────────────────────────┤
│ (left)   │               │  controls│     │        game board             │
│          │               │          │     │   (expanded, slots scaled up) │
└──────────┴───────────────┴──────────┘     └───────────────────────────────┘
```

- **Advanced** is the original layout: `.lcard-informations` (order 1),
  `.play-board` (order 5), `.play-board-side` log (order 9).
- **Basic** adds `.basic-mode` to `.play-board-container`, which hides every
  `.play-board-side` and scales the board up.

---

## Files touched

| File | Change |
|------|--------|
| `index.html` | Top bar markup (`.board-mode-bar` → `#board-top-controls` + `#board-mode-toggle`); cache-bust bumps. |
| `js/main.js` | `boardModeEvent()` — toggle wiring, control relocation, responsive labels. |
| `js/simulator.js` | Button lookups switched to global selectors; `Board.getRandomVisibleCard()` / `showCardInfo()` / `showRandomCardInfo()`; `Card.declare()` hook; on-load call. |
| `css/simulator.css` | Toggle/bar/top-control styling; `.basic-mode` column hiding + board expansion via `--slot-size`. |
| `css/simulator.scss` | Same rules mirrored into the SCSS source (so a rebuild won't drop them). |

> **No build step.** Edit, bump the `?v=` query string in `index.html`, reload.
> See the migration guide for the exact version bumps.

---

## How it works

### 1. The toggle (`js/main.js` → `boardModeEvent`)

Runs from `$(document).ready`. It:

- Toggles `.basic-mode` on `.play-board-container`.
- Relocates the control buttons (see §3).
- Re-renders the button label/icon, switching between desktop and mobile
  wording via a `matchMedia('(max-width: 1199px)')` query.
- **Always applies Basic on load** — there is no persistence read or write.

```js
function apply(basic) {
    $container.toggleClass('basic-mode', basic);
    placeControls(basic);
    render();
}
apply(true);                                   // every load opens in Basic
$btn.click(function () { apply(!$container.hasClass('basic-mode')); });
```

The label is re-rendered on `matchMedia` change **and** window resize, so it
stays correct when the viewport crosses the 1199px breakpoint.

### 2. Board expansion (`css/simulator.css`)

The board is a fixed-pixel layout: `.holder-slot { width: 102px }`. It uses
flex-shrink to *fit* narrow screens but never grows past 102px on its own, so
hiding the columns alone would just add empty side margins. The slot width is
therefore driven by a CSS variable, and Basic mode raises it on desktop:

```css
.holder-slot { width: var(--slot-size, 102px); }

@media (min-width: 1200px) {
    .play-board-container.basic-mode #playtest .game-board {
        --slot-size: clamp(102px, calc((min(100vw, 1500px) - 160px) / 7), 150px);
    }
}
```

- **`clamp(...)`** keeps slots between 102px and 150px.
- The middle term is **viewport-bounded** (`min(100vw, 1500px)`) and divided by
  the 7-column row, so the board grows into the free space but never overflows
  on smaller desktops.
- Scoped to `#playtest .game-board`, so the deck/graveyard collection menus
  (also `.holder-slot`, but outside the board) keep their original size.
- Advanced mode and mobile fall back to the `102px` default + flex-shrink.

Net effect on a 1400px viewport: the board grows from ~838px to ~1140px wide.

### 3. Relocating the record/replay controls

The controls live in the log header (`.log-message-header`), which Basic mode
hides. `boardModeEvent` moves the actual button nodes between two homes:

```js
var $controls = $('.start-record-button, .stop-record-button, .replay-button, .pause-button, .resume-button');
function placeControls(basic) {
    (basic ? $('#board-top-controls') : $('.log-message-header')).append($controls);
}
```

This works because the button event handlers in `simulator.js` were changed
from container-scoped lookups to **global selectors**:

```js
// before — breaks once the button leaves .log-message-container
playLog.elm.find('.start-record-button')
// after — location-independent (each button is unique on the page)
$('.start-record-button')
```

jQuery event handlers ride along with a node when it is re-parented, so no
re-binding is needed. `.board-top-controls:empty { display: none }` collapses
the top-bar slot in Advanced.

### 4. Card-information panel

Two new entry points populate the left panel (`.lcard-information-container`),
reusing the same `setCard(card).sideCardInformations()` path that hover uses
(both no-op below 1200px).

**On load** — `Board.showRandomCardInfo()` is called after `importState()`:

```js
getRandomVisibleCard() {
    var pool = this.items.filter(i =>
        ['hand','summon','st','fz','graveyard','banish','exdeck'].includes(i.position));
    var topDeck = this.getCollectionByPosition('deck')?.getTopCard();
    if (topDeck) pool.push(topDeck);            // only the *top* deck card is eligible
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : false;
}
```

**On declare** — `Card.declare()` surfaces the declaring card, but only in
Advanced (the panel is hidden in Basic / small screens). Because the hook is
inside `declare()`, it fires for both live play and replay:

```js
declare() {
    this.doAnimation('declare');
    this.getBoard().writelog('declare', this.uuid, {});
    if (!$('.play-board-container').hasClass('basic-mode')) {
        this.getBoard().showCardInfo(this);
    }
}
```

---

## Gotchas / design notes

- **Default is Basic, panel still fills on load.** Since the page opens in
  Basic, the on-load random card is populated but hidden until the user switches
  to Advanced — which is the only mode where the panel exists.
- **Selector globalisation is safe** because each record/replay button is unique
  in the DOM. If you ever add a second board, re-scope these.
- **Keep CSS in sync.** `css/simulator.css` is generated from
  `css/simulator.scss` (`simulator.css` warns it is overwritten on build). All
  rules here exist in both files.
- **Mobile is unaffected by board scaling.** The `--slot-size` override only
  applies at `≥1200px`; below that the board keeps its original
  102px-and-flex-shrink behaviour.
