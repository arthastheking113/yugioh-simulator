# 02 — Architecture & Core Classes

All four engine classes live in **one file**, `js/simulator.js`, defined in this order: `PlayLog` → `Card` → `Collection` → `Board`. The verified line numbers (snapshot-accurate) are given as orientation hints.

## The ownership model

```
Board  (singleton — the single source of truth)
  ├── items: Card[]          ← EVERY card in play, regardless of zone
  ├── deck:       Collection ← main deck      (stacked zone)
  ├── exdeck:     Collection ← extra deck     (stacked zone)
  ├── graveyard:  Collection ← graveyard      (stacked zone)
  ├── banish:     Collection ← banished zone  (stacked zone)
  ├── playlog:    PlayLog    ← recording / replay engine
  └── skill:      { name, activated }
```

- **`Board`** is the central controller and the **single source of truth**. It owns the master `items` array and orchestrates everything.
- **`Card`** is a single card. It owns its own state, its own DOM element, and its own animations.
- **`Collection`** is a *view/manager* over a stacked zone. It does not own cards — it filters `Board.items` by position and renders the stack (top card + count badge).
- **`PlayLog`** records actions as steps and replays them.

`Card` and `Collection` operate on **slices of `Board.items[]`**. There is no separate per-zone storage; a card's `position` field is what places it in a zone.

---

## 1. `PlayLog` (≈ `simulator.js:6`)

Records every game action as a *step* and replays them in order. See [05-replay-and-playlog.md](05-replay-and-playlog.md) for the full algorithm.

```javascript
// Internal state (after init())
{
  initItems: {} | Card[],   // board snapshot captured when recording starts
  steps: Step[],            // ordered list of recorded action objects
  pointer: 0,               // index of the next step to replay
  isStarted: false,         // recording is active (between Start/Stop Record)
  isRePlaying: false,       // a replay is currently running
  isPausing: false,         // replay is paused mid-playback
  replaytimeout: 0
}
```

**Key methods**

| Method | Purpose |
|--------|---------|
| `addStep(action, uuid, data, oldData)` | Build a human-readable message, then push a step onto `steps[]` **if** `isStarted` (or the action is `startRecord`). Returns `false` while `isRePlaying`. |
| `replay()` | Reset `pointer`, set `isRePlaying`, begin the playback loop |
| `playStep()` | Apply the current step to the board, then schedule the next after a wait |
| `pauseReplay()` / `resumeReplay()` | Toggle `isPausing` |
| `stopReplay()` | End replay, restore UI |
| `step()` | Pop the next step; attaches computed `isLastStep` / `nextStep` |

> **Important:** the public logging call is `board.writelog(...)`, which internally calls `playlog.addStep(...)`. Code rarely calls `addStep` directly.

---

## 2. `Card` (≈ `simulator.js:560`)

A single card. Manages its own data, DOM node (`this.html`), and animations. Full property list is in [03-card-model.md](03-card-model.md).

**Constructor defaults** (verified) — note the per-direction permission flags, which the older prose docs omit:

```javascript
{
  cardId: 0,
  uuid: 0,                  // 0 means "unset" → replaced by ygoUUID()
  name: 'card',
  order: 1,
  collection_order: 1,
  foldState: 'normal',      // face-up
  switchState: 'attack',    // upright
  position: 'deck',
  isExtra: 0,
  // per-direction movement permission gates (all default true):
  canMoveHand: true, canMoveSummon: true, canMoveExDeck: true,
  canMoveDeck: true, canMoveST: true, canMoveBanish: true, canMoveGraveyard: true
}
```

**Validation gates** (checked before any state change):

| Gate | Returns true when… |
|------|--------------------|
| `canMoveTo(position)` | The destination is allowed (see table below) |
| `canFlip(state)` | `foldState != state` (i.e. it would actually change) |
| `canSwitch(state)` | `switchState != state` |

`canMoveTo(position)` logic (verified from source):

| Destination | Allowed when |
|-------------|--------------|
| `hand`, `deck`, `graveyard`, `banish` | Always |
| `summon` | A free monster slot exists (`getFreeSummon()`) |
| `st` | A free spell/trap slot exists (`getFreeST()`) |
| `exdeck` | `this.canMoveExDeck` is true |
| `fz` (field zone) | `this.isSpell` is true **and** the field zone is free |
| anything else | Never |

**Move lifecycle** — `moveTo(newPosition, isTop, order, fireEvent = true)`. This is the spine of the whole simulator; it gets its own full walkthrough in [04-combo-and-card-movement.md](04-combo-and-card-movement.md).

**Action methods** (each logs its own step):

| Method | Effect | Logged action |
|--------|--------|---------------|
| `fold(state, anim, dur)` | Flip face-up/face-down | `update` (`foldState`) |
| `attack()` / `defense()` | Battle position (defense rotates 90°) | `update` (`switchState`) |
| `target()` | Targeting flash animation | `target` |
| `declare()` | Declare animation | `declare` |
| `reveal()` | Reveal animation (and re-tops the card if in extra deck) | `reveal` |

---

## 3. `Collection` (≈ `simulator.js:1287`)

Manages the four **stacked** zones: `deck`, `exdeck`, `graveyard`, `banish`. A collection renders only the **top card plus a count badge**; the rest are browsable via a dialog.

```javascript
const graveyard = new Collection('graveyard', board);

collection.getCards()                // Card[] filtered from board.items by position
collection.getTopCard()              // highest collection_order card
collection.appendCard(card, reDraw)  // add a card; optionally repaint the stack
collection.shuffleCollectionCards()  // Fisher-Yates + renumber collection_order, logs shuffle
collection.drawOnBoard()             // re-render the stack visual (top card + count)
collection.showDialog()              // open the browsable card-list modal
```

**`collection_order` means different things by zone type:**
- In a **collection zone** → a **numeric** ordering index (who is on top); new tops get `previousTop + 2`, bottoms get `0`.
- In an **individual zone** (`summon`/`st`/`fz`) → the target slot's **`data-order` token string**, e.g. `"ss3"`, `"st4"`, `"fz1"`, `"exss2"` (the integer `1` is only a default fallback).

Do not conflate the two interpretations — it is a frequent source of bugs. See [03-card-model.md](03-card-model.md) for the full slot-token list.

---

## 4. `Board` (≈ `simulator.js:1472`)

The singleton controller, instantiated in `main.js`:

```javascript
const board = new Board({
  backImageSrc: 'asset/back_card.png',
  imgPath: 'asset/',
  cardUUIdkey: 'uuid',
  defaultPhase: 'm1',
  player: 'Player',
  skill: ''
});
```

**Key state**

| Property | Type | Meaning |
|----------|------|---------|
| `items` | `Card[]` | All cards currently in play |
| `currentPhase` | String | Active phase key (`dp`/`sp`/`m1`/`bp`/`m2`/`ep`) |
| `phases` | Object | phase key → display name map |
| `deck` / `exdeck` / `graveyard` / `banish` | `Collection` | The four stacked zones |
| `playlog` | `PlayLog` | Recording/replay engine |
| `skill` | `{ name, activated }` | Player "skill" state (Speed-Duel style) |

**Critical methods** (verified signatures)

```javascript
board.addItem(item, order)                     // create a Card, assign uuid if 0, draw it
board.updateItem(id, k, v)                      // mutate ONE card property by uuid + re-render
board.writelog(action, id, data, oldData)       // record a step (delegates to playlog.addStep)
board.setPhase(phase)                           // change phase + log 'update-phase' + animate
board.getItemsByPosition(position)              // filter items by zone
board.getItemsByCollectionOrder(order)          // all cards sharing a collection_order (Xyz grouping!)
board.overlayCard(card_uuid, new_order)         // Xyz summon: attach materials (see file 07)
board.detachOverlay(uuid) / card.detachOverlap()// remove an Xyz material
board.deckToHand(count, from)                   // draw N cards from 'deck' or 'exdeck'
board.emptyBoard()                              // remove ALL cards from items[] AND the DOM
board.exportState(type = 'array')               // serialize full state → object or JSON string
board.importState(state)                        // clear + restore from object or JSON string
```

`board.getItemsByCollectionOrder(order)` is how Xyz materials and their monster are grouped: **all cards sharing a `collection_order` in the `summon` zone are visually stacked in the same slot.**

### Startup builds the board twice

Loading a shared combo (`board.json`) runs `new Board(state.items, …)` **then** `board.importState(state)`. The constructor draws an opening hand (`deckToHand(5)`); `importState` immediately discards it via `emptyBoard()` and rebuilds fresh `Card` objects at their saved positions. Because `moveTo` finishes its animation on a `setTimeout`, the discarded opening-hand draws schedule deferred `appendToBoard()` calls that fire **after** the rebuild — and would re-inject phantom cards into the hand (which then resolve to the rebuilt *deck* card on hover, showing the wrong menu). `appendToBoard()` guards this by bailing when `board.getItemById(card.uuid) !== card`, i.e. the card is no longer the board's registered instance for its uuid.

---

## The three invariants (do not break these)

These rules are repeated everywhere because violating them produces silent, hard-to-debug failures.

1. **Log every action.** Any state change must call `board.writelog(action, id, data, oldData)`. A missing log means replay diverges from the original at that point.
2. **Mutate through `board.updateItem(uuid, key, value)`.** Never set `card.someProperty = x` directly outside of `Card`'s own methods — `updateItem` triggers `card.updateHtml()` to keep the DOM in sync. (The `Card` action methods are the sanctioned exception; they mutate their own fields and then log.)
3. **Keep `exportState()` / `importState()` in sync.** A new card property must be serialized in `exportState` and restored in `importState`, or it vanishes on share/replay.

## Delegation summary

`Board` holds no per-card business logic — it delegates:

| Concern | Owner |
|---------|-------|
| Moving a card | `Card.moveTo()` |
| Rendering a stacked zone | `Collection.drawOnBoard()` |
| Phase change (log + sound + animation) | `Board.setPhase()` (owns directly) |
| Xyz overlay attach/detach | `Board.overlayCard()` / `Board.detachOverlay()` (owns directly — too complex to delegate) |
