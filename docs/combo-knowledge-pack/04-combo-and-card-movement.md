# 04 — Combos & Card Movement (the heart of the project)

This is the most important file in the pack. The entire simulator exists to make the loop **move cards → record the moves → replay them** reliable.

## What is a "combo" here?

In YuGi-Oh!, a **combo** is a chain of card effects where each effect moves cards between zones, enabling the next effect, and so on. This simulator **does not enforce** any of that — it simply moves cards wherever the player directs and **records each move**. A "combo," in this project, is therefore:

> **An ordered list of recorded steps** (`PlayLog.steps`) capturing every card movement and state change, replayable with timed pauses so a viewer can follow the line of play.

**The fundamental equation:**

```
one combo step  ≈  one call to  card.moveTo(newPosition, isTop, order, fireEvent)
                   (plus, for non-moves, fold()/attack()/defense()/target()/declare()/reveal())
```

Every arrow in the position graph below is a `moveTo` call. Replay just re-issues those calls in order. Understanding `moveTo` ⇒ understanding the project.

---

## The position graph

All zones and the typical directions of travel. Each arrow = a `card.moveTo(destination)`.

```
        draw / add-to-hand
 deck ───────────────────────────────────►  hand
  │  ▲                                       │  ▲
  │  │ return to deck (top/bottom)           │  │ bounce / recover
  │  │                                       ▼  │
  │  │            summon / set / activate        │
  │  └──────────────◄── summon (slots 1–5) ──┐   │
  │ mill/send             │   │   │          │   │
  ▼                       │   │   │ return   │   │
graveyard ◄───────────────┘   │   └──────────┼──►│
  │   ▲   send to GY          │ banish       │   │
  │   │                       ▼              │   │
  │   │ return from GY     banish ◄──────────┘   │
  │   └──────────────────────│                   │
  │ banish from GY           │ unbanish (auto face-up) ──────────────┘
  ▼                          ▼
banish                     hand / summon

 st (slots 1–5)  ◄── hand        (spell or trap)
 fz (field zone) ◄── hand        (spell only; guarded by isSpell)
 exdeck ◄──► summon              (extra-deck monsters; guarded by canMoveExDeck)
```

---

## `moveTo` — full lifecycle (verified from `simulator.js:699`)

Signature: `moveTo(newPosition, isTop, order, fireEvent = true)`

| Param | Meaning |
|-------|---------|
| `newPosition` | Destination zone. Must be one of `hand/deck/exdeck/graveyard/summon/st/banish/fz`, else `moveTo` returns `false` immediately. |
| `isTop` | For **collection** destinations: `true` = place on top, `false` = place on bottom. Irrelevant for individual zones. Defaults to `true` if undefined. |
| `order` | For **individual** destinations (`summon`/`st`/`fz`): the target slot's **`data-order` token** — `ss1`–`ss5`, `exss1`/`exss2`, `st1`–`st5`, or `fz1`. Ignored for collections. (Defaults to `1` if omitted.) |
| `fireEvent` | `true` during normal play (logs + redraws). **`false` during replay** to avoid re-logging an already-recorded step (which would create an infinite loop). |

Execution order:

```
 1. Guard: newPosition in the allowed set?            → false aborts
 2. beforeMove(newPosition)
       └─ snapshots the card into this.itemBefore = {...this}   (used to build the log diff)
 3. canMoveTo(newPosition)                            → false aborts (slot full, gate, type)
 4. startMoveAnimation() / startBoardAnimation()
       └─ clone the card's DOM at its current screen coordinates
 5. Assign collection_order for the destination:
       • collection zone, isTop=true  → topCard.collection_order + 2   (or 1 if empty)   [numeric]
       • collection zone, isTop=false → 0   (bottom)                                      [numeric]
       • individual zone (summon/st/fz) → the requested slot's data-order token (e.g. "ss3", "st4", "fz1")
            └─ if that slot is already occupied → warn "No Space to move card", abort (return false)
 6. card.position = newPosition
 7. Arrival state resets:
       • if itemBefore.position === 'banish'  → fold('normal')      (leaving banish is always face-up)
       • if newPosition !== 'summon'          → switchState = 'attack'   (only summon preserves battle position)
 8. appendToBoard()
       └─ insert the card's DOM into the correct destination slot/container
       └─ if the card is an Xyz monster carrying materials, its materials are re-appended too
 9. Redraw the SOURCE collection (count badge updates)
10. if (fireEvent)  afterMove(newPosition)
       └─ writelog('update', uuid, {position, collection_order}, {old position, old collection_order})
11. setTimeout 5ms → moveAnimation(clone) → 400ms → endBoardAnimation()
       └─ visually animate the clone from old to new coordinates, then drop the clone
```

**Things that surprise people (all verified):**

- **Occupied individual slot ⇒ the move fails silently** (a `console.warn('No Space to move card')` and `return false`). The card stays put. There is no auto-pick-next-slot.
- **`+2` ordering on collection tops** leaves gaps in `collection_order` on purpose, so a future card can be slotted "between" without renumbering.
- **`switchState` is reset to `attack` on every arrival EXCEPT `summon`.** Moving a defense-position monster to the graveyard, hand, deck, etc. silently flips it back to attack.
- **`foldState` is force-flipped to `normal` only when *leaving* `banish`.** No other transition touches `foldState` inside `moveTo` — setting a card face-down is a *separate* `fold('fold')` call.

---

## Every movement transition, in detail

Below, `→` is a `moveTo`. Each entry notes what changes and what the recorded step looks like. In the code samples, `slot`/`slotNumber` is a **slot token** (`ss1`–`ss5`, `exss1`/`exss2`, `st1`–`st5`, `fz1`) — *not* an integer; for an individual zone, the card's `collection_order` becomes that token.

### 1. Deck → Hand (draw / add to hand)
```javascript
card.moveTo('hand', true, null, true);
```
`position: deck→hand`; `collection_order` becomes the next hand index; `switchState→attack`. Deck count badge decrements. Step: `update {position:'hand', collection_order:N}`.

### 2. Hand → Summon (normal / special summon, face-up attack)
```javascript
card.moveTo('summon', false, slotNumber, true);   // slotNumber = a slot token, e.g. "ss3"
```
`position: hand→summon`; `collection_order = slotNumber`; `switchState` preserved (this is the only zone that preserves it). Aborts if all 5 monster slots are full.

### 3. Hand → ST Zone (activate / set spell or trap)
```javascript
card.moveTo('st', false, slotNumber, true);
```
`position: hand→st`; `collection_order = slotNumber`. **`moveTo` does not set face-down** — setting is a separate `fold('fold')` after the move. Aborts if all 5 ST slots are full.

### 4. Hand → Field Zone (activate field spell)
```javascript
card.moveTo('fz', false, null, true);
```
Guard: `card.isSpell` must be true **and** the field zone empty. `position: hand→fz`.

### 5. Hand / Summon → Graveyard (send to GY)
```javascript
card.moveTo('graveyard', true, null, true);   // top of GY
```
`position→graveyard`; `collection_order = topCard.collection_order + 2`; `switchState→attack`. GY count increments; the vacated summon slot becomes free.

### 6. Graveyard → Banish
```javascript
card.moveTo('banish', true, null, true);
```
`position: graveyard→banish`; new top of banish. `foldState` unchanged (banished cards keep their face state until they *leave* banish).

### 7. Banish → Hand / Summon (unbanish)
```javascript
card.moveTo('hand', false, null, true);
card.moveTo('summon', false, slotNumber, true);
```
**Auto state reset on leaving banish:** `foldState` is forced to `normal` (face-up); `switchState→attack` (unless destination is `summon`, which preserves it — but leaving banish still face-ups it).

### 8. Graveyard → Hand (recover / recycle)
```javascript
card.moveTo('hand', false, null, true);
```
`position: graveyard→hand`; `switchState→attack`; GY count decrements.

### 9. Graveyard → Summon (special summon from GY)
```javascript
card.moveTo('summon', false, slotNumber, true);
```
Same shape as Hand→Summon, source is the graveyard; GY count decrements.

### 10. Deck → Graveyard (mill / send from deck)
```javascript
card.moveTo('graveyard', true, null, true);
```
Deck count down, GY count up. (`foldState` is not auto-changed; if you want the milled card face-up, that is the default `normal` already.)

### 11. Extra Deck → Summon (Fusion/Synchro/Xyz/Link summon)
```javascript
card.moveTo('summon', false, slotNumber, true);   // card.isExtra === true
```
Guard: `card.canMoveExDeck` must be true. Extra-deck count decrements.

### 12. Summon → Extra Deck (return to extra deck)
```javascript
card.moveTo('exdeck', false, null, true);
```
Guard: `card.canMoveExDeck`. Extra-deck count increments.

### 13. Deck → Banish (banish from deck)
```javascript
card.moveTo('banish', true, null, true);
```

### 14. Summon / ST → Deck (return to deck, top or bottom)
```javascript
card.moveTo('deck', true,  null, true);   // top
card.moveTo('deck', false, null, true);   // bottom
```
`isTop` decides top vs bottom; deck count increments.

---

## State-change summary table

For a `moveTo` into each destination, what happens to the three mutable fields:

| Destination | `foldState` | `switchState` | `collection_order` |
|-------------|-------------|---------------|--------------------|
| `hand` | unchanged | reset → `attack` | next hand index |
| `deck` | unchanged | reset → `attack` | top (`+2`) or bottom (`0`) |
| `graveyard` | unchanged | reset → `attack` | new top (`+2`) |
| `banish` | unchanged | reset → `attack` | new top (`+2`) |
| `exdeck` | unchanged | reset → `attack` | new top (`+2`) |
| `summon` | unchanged | **preserved** | slot token (`ss1`–`ss5`, `exss1`/`exss2`) |
| `st` | unchanged | reset → `attack` | slot token (`st1`–`st5`) |
| `fz` | unchanged | reset → `attack` | slot token (`fz1`) |
| **(leaving `banish`, any destination)** | **forced → `normal`** | per destination | per destination |

Setting a card face-down (`fold('fold')`) or to defense (`defense()`) is **always a separate call** that produces its **own** step.

---

## A full combo as recorded steps

Line of play: *Draw a card → Normal Summon it → its effect mills a card from deck to GY → a follow-up effect banishes that GY card.* Four moves ⇒ four `update` steps:

```javascript
steps = [
  // 1) Deck → Hand   (hand is not a managed collection, so its order is 0)
  { action: 'update', uuid: 'card-A',
    data:    { position: 'hand',      collection_order: 0 },
    oldData: { position: 'deck',      collection_order: 3 } },

  // 2) Hand → Summon, slot token "ss3"
  { action: 'update', uuid: 'card-A',
    data:    { position: 'summon',    collection_order: 'ss3' },
    oldData: { position: 'hand',      collection_order: 0 } },

  // 3) Deck → Graveyard  (card-A's effect mills card-B; first GY card → 1)
  { action: 'update', uuid: 'card-B',
    data:    { position: 'graveyard', collection_order: 1 },
    oldData: { position: 'deck',      collection_order: 8 } },

  // 4) Graveyard → Banish  (follow-up banishes card-B)
  { action: 'update', uuid: 'card-B',
    data:    { position: 'banish',    collection_order: 1 },
    oldData: { position: 'graveyard', collection_order: 1 } },
]
```

Each step is a **minimal diff**: a move records only `position` + `collection_order`. A flip or battle-position change is logged as its **own** `update` step carrying only `foldState` or `switchState`. (Full step anatomy: [05-replay-and-playlog.md](05-replay-and-playlog.md).)

---

## Special cases

### Setting a monster face-down (Set)
`moveTo` never sets `foldState`. To Set a monster you issue three logged actions:
```javascript
card.moveTo('summon', false, slot, true);  // place it
card.defense();                            // rotate to defense
card.fold('fold', true);                   // flip face-down
```
Three separate steps result, and replay re-applies all three in order.

### Xyz summon (materials beneath a monster)
This is **not** a plain `moveTo`. It goes through `board.overlayCard(uuid, slot)` and produces `overlay` / `detach` steps. It is intricate enough — and was mis-documented enough — to get its own file: [07-xyz-overlay-deep-dive.md](07-xyz-overlay-deep-dive.md).

### `fireEvent = false` (replay mode)
During replay, `playStep()` re-issues moves with `fireEvent = false`. That skips:
- `afterMove()` → so no **new** step is recorded (otherwise replay would log the steps it is replaying — an infinite loop), and
- the source-collection redraw that `afterMove` would trigger (the replay handler manages redraws itself).

---

## Adding a new movement path (for an agent modifying the engine)

The pipeline already handles all eight positions, so a new source→destination pair usually needs **no new code**:

1. **`canMoveTo()`** — add a case only if the new destination needs a guard.
2. **Call `card.moveTo(newPosition, …)`** — the existing lifecycle does the rest.
3. **`appendToBoard()`** already covers every position's DOM slot.
4. **`afterMove()`** logs it automatically as long as `fireEvent` is true.
5. **`PlayLog.playStep()`** handles all position changes under the `update` action — no new case is needed unless you are introducing a brand-new **non-move** action type.
