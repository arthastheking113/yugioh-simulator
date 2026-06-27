# Game Mechanics

## Phase System

Six phases, cycled by player:

| Key | Display Name | Button label |
|-----|-------------|-------------|
| `dp` | Draw Phase | DP |
| `sp` | Stand By | SP |
| `m1` | Main Phase 1 | M1 |
| `bp` | Battle Phase | BP |
| `m2` | Main Phase 2 | M2 |
| `ep` | End Phase | EP |

`board.setPhase(key)`:
1. Updates `board.currentPhase`
2. Highlights the matching phase button
3. Plays a sound from `sound/`
4. Shows full-screen phase announcement text (~1 second)
5. Writes `update-phase` step to `PlayLog`

Phases are **purely visual** — no card actions are blocked by phase.

## Card Move Lifecycle

Every card move goes through the same pipeline:

```
card.moveTo(newPosition, isTop, order, fireEvent)
  1. beforeMove()            → store old position/state snapshot
  2. canMoveTo(newPosition)  → return false to abort (gate check)
  3. startMoveAnimation()    → clone card at current screen coords
  4. Update card.position, card.collection_order
  5. moveAnimation()         → animate clone old → new (400ms)
  6. appendToBoard()         → insert into new DOM slot
  7. afterMove()             → writelog() + source collection.drawOnBoard()
```

**fireEvent = false** skips `afterMove()` logging and collection redraw — use only during replay playback.

**Deferred animation finish:** `moveTo` runs `appendToBoard()` synchronously, then schedules a `setTimeout` (~405ms) that ends the animation and calls `appendToBoard()` **again**. That deferred callback can fire *after* the board has been torn down and rebuilt (the startup flow builds the board twice — see [core-classes.md](core-classes.md)). To stop a discarded build's leftover cards from re-inserting orphan DOM (e.g. phantom cards in the hand that hover the **wrong** context menu), `appendToBoard()` bails out when the card is no longer the board's registered card for its uuid: `if (board.getItemById(card.uuid) !== card) return false;`.

## Card Actions (non-move)

| Action | Method | Log entry | Visual |
|--------|--------|-----------|--------|
| Flip face-up | `card.fold('normal', true, 400)` | `update` | Card flip animation |
| Flip face-down | `card.fold('fold', true, 400)` | `update` | Card flip animation |
| Switch to ATK | `card.attack()` | `update` | Upright |
| Switch to DEF | `card.defense()` | `update` | Rotated 90° |
| Target | `card.target()` | `target` | Flash animation |
| Declare | `card.declare()` | `declare` | Declare animation |
| Reveal | `card.reveal()` | `reveal` | Reveal animation |

## Xyz Overlay (Materials)

The most complex mechanic. An Xyz monster in a `summon` slot can have "material" cards visually stacked beneath it.

**Attach flow (`board.overlayCard(uuid, new_order)`):**
1. Collect all cards at the same `collection_order` as the Xyz card
2. Move all to `new_order` slot
3. Set main Xyz card: `isOverlay = true`, `overlap_order = max + 1` (highest)
4. Set each material: `isOverlap = true`, `overlap_order = N` (1, 2, 3…)
5. Add `.overlay-slot` CSS class to the DOM slot element

**Detach flow (`board.detachOverlay(uuid)`):**
1. Move material to graveyard
2. Decrement `overlap_order` of remaining materials
3. If no materials remain: set Xyz card `isOverlay = false`

**State invariant:**

| Property | Main Xyz card (on top) | Material card (beneath) |
|----------|:----------------------:|:-----------------------:|
| `isOverlap` | `false` | `true` |
| `isOverlay` | `true` | `false` |
| `overlap_order` | `max + 1` (highest) | `1`, `2`, `3`… |

> Verified against `setDataOverlap`/`setDataOverlay` in `simulator.js`: **`isOverlap === true` marks a MATERIAL**, **`isOverlay === true` marks the XYZ MONSTER** that carries them. (The names read backwards from intuition.)

`collection_order` must be the same value for the Xyz card and all its materials — this is how they're visually grouped in the slot.

## Draw / Deck Actions

```javascript
board.deckToHand(count, from)
// Draws `count` cards from `from` ('deck' or 'exdeck') to hand.
// Calls card.moveTo('hand', ...) for each card in order.
```

## Shuffle

```javascript
collection.shuffleCollectionCards()
// Fisher-Yates shuffle on collection cards.
// Renumbers collection_order sequentially after shuffle.
// Logs 'shuffle_deck' action to PlayLog.
```
