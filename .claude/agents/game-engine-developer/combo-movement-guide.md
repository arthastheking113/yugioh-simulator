# Combo & Card Movement Guide

## What Is a Combo in This Simulator?

In YuGi-Oh!, a **combo** is a chain of card effects where each card's effect moves one or more cards to a new position, enabling the next card's effect, and so on. The simulator doesn't enforce rules — it just faithfully moves cards between positions at the player's command.

**Fundamental model:** every combo step = `card.moveTo(newPosition, isTop, order, fireEvent)`

The simulator records each step in `PlayLog` so the whole combo can be replayed later.

---

## The Position Graph

All valid positions and the typical directions of travel:

```
deck ──────────────────────────────────────────────────► hand
  │                                                        │
  │ (mill / send)                               (summon / set / activate)
  ▼                                                        ▼
graveyard ◄──────────────────────────────────── summon (slot 1–5)
  │         (send to GY after effect)              │      │
  │                                         (return)  (banish)
  │ (banish from GY)                               ▼      ▼
  └──────────────────────────────────────────► banish    exdeck
                                                  │        │
                                         (unbanish)   (special summon)
                                                  └────────┘
                                                       │
                                                   hand / summon

fz (field zone) ← hand (spell card only)
st (slots 1–5)  ← hand (spell / trap)
```

Every arrow is a `card.moveTo(destination)` call.

---

## How `moveTo` Works (Code Walkthrough)

`Card.moveTo(newPosition, isTop, order, fireEvent)` in `js/simulator.js` Line ~699:

```
1. Guard check
   └─ if newPosition not in allowed list → return false

2. beforeMove(newPosition)
   └─ snapshots card into this.itemBefore = { ...this }
   └─ used by afterMove() to write the log diff

3. canMoveTo(newPosition)
   └─ hand / deck / graveyard / banish → always allowed
   └─ summon → only if a free slot exists (getFreeSummon())
   └─ st     → only if a free slot exists (getFreeST())
   └─ exdeck → only if card.canMoveExDeck is true
   └─ fz     → only if card.isSpell AND field zone is free
   └─ returns false → move aborted

4. startMoveAnimation(isMoveAllOverlap)
   └─ clones card DOM at current screen coordinates

5. Order assignment
   └─ collection zone (deck/GY/banish/exdeck):
        isTop=true  → collection_order = topCard.collection_order + 2
        isTop=false → collection_order = 0 (bottom)
   └─ individual zone (summon/st/fz):
        collection_order = the slot number (1–5)

6. card.position = newPosition

7. Auto state resets on arrival
   └─ arriving from banish → card.fold('normal')  ← auto face-up
   └─ arriving anywhere except summon → card.switchState = 'attack'

8. appendToBoard()
   └─ places card.html into the correct DOM slot (see below)

9. afterMove()  [only if fireEvent=true]
   └─ board.writelog('update', uuid, { position, collection_order }, oldData)
   └─ old collection.drawOnBoard()  ← updates count badge

10. setTimeout 5ms → moveAnimation(clone) → 400ms → endBoardAnimation()
    └─ animates the clone from old position to new position visually
```

---

## Every Movement Transition — In Detail

### 1. Deck → Hand (Draw)

**When:** Player draws a card / deck effect sends to hand.

```javascript
card.moveTo('hand', true, null, true)
// isTop=true means top of deck → doesn't matter for hand
```

**What changes:**
- `card.position`: `'deck'` → `'hand'`
- `card.collection_order`: set to next available (top of deck had highest order)
- `card.switchState`: reset to `'attack'`

**DOM change:**
- Removed from `deck.menuElm` (collection dialog container)
- `appendToBoard()` wraps card in `<div class="hand-card-container">` → appended to `#hand-board`

**PlayLog step:**
```javascript
{ action: 'update', uuid, data: { position: 'hand', collection_order: N }, oldData: { position: 'deck', ... } }
```

**Collection effect:** `deck.drawOnBoard()` redraws the deck — count badge decrements.

---

### 2. Hand → Summon (Normal / Special Summon)

**When:** Player summons a monster from hand to a monster zone.

```javascript
card.moveTo('summon', false, slotNumber, true)
// slotNumber = 1–5, isTop=false (irrelevant for individual zone)
```

**What changes:**
- `card.position`: `'hand'` → `'summon'`
- `card.collection_order`: set to `slotNumber` (1–5)
- `card.switchState`: stays `'attack'` (or `'defense'` if Set)
- `card.foldState`: stays `'normal'` (or `'fold'` if Set)

**DOM change:**
- `hand-card-container` wrapper removed from `#hand-board`
- Card appended to `.card-slot[data-order="slotNumber"]` inside the summon row

**canMoveTo guard:** fails if all 5 summon slots are occupied.

---

### 3. Hand → ST Zone (Activate / Set Spell or Trap)

```javascript
card.moveTo('st', false, slotNumber, true)
```

**What changes:**
- `card.position`: `'hand'` → `'st'`
- `card.collection_order`: set to `slotNumber`

**DOM change:** Card appended to `.card-slot[data-order="slotNumber"]` in the ST row.

**canMoveTo guard:** fails if all 5 ST slots are occupied.

**foldState note:** The menu sets `fold('fold')` separately for setting face-down — `moveTo` itself does not touch `foldState`.

---

### 4. Hand → Field Zone (Activate Field Spell)

```javascript
card.moveTo('fz', false, null, true)
```

**canMoveTo guard:** `card.isSpell` must be `true` AND field zone must be empty.

**DOM change:** Card appended to `#field-zone` element.

---

### 5. Hand / Summon → Graveyard (Send to GY)

**When:** Monster destroyed, spell/trap resolves, cost, discard.

```javascript
card.moveTo('graveyard', true, null, true)
// isTop=true → placed on top of GY stack
```

**What changes:**
- `card.position`: old position → `'graveyard'`
- `card.collection_order`: `topCard.collection_order + 2` (new top)
- `card.switchState`: reset to `'attack'`

**DOM change:**
- Card appended into `graveyard.menuElm` (dialog container)
- `graveyard.drawOnBoard()` renders new top card + increments count badge

**From summon:** the slot `.card-slot[data-order]` is now empty and available again.

---

### 6. Graveyard → Banish (Banish from GY)

**When:** Card effect banishes a GY card.

```javascript
card.moveTo('banish', true, null, true)
```

**What changes:**
- `card.position`: `'graveyard'` → `'banish'`
- `card.collection_order`: new top of banish stack

**No foldState change on arrival** — banished cards keep their current face state. If later unbanished (moved to `hand` or `summon`), `beforeMove` does NOT auto-flip — but the player can flip manually.

**DOM change:** Moved from `graveyard.menuElm` into `banish.menuElm`. Both collections redraw.

---

### 7. Banish → Hand / Summon (Unbanish)

**When:** Card effect returns a banished card.

```javascript
card.moveTo('hand', false, null, true)
// or
card.moveTo('summon', false, slotNumber, true)
```

**Auto state reset on arrival from banish (Line ~766):**
```javascript
if (_card.itemBefore.position == 'banish') {
    _card.fold('normal');  // always face-up when leaving banish
}
```

**What changes:**
- `card.position`: `'banish'` → destination
- `card.foldState`: forced to `'normal'` (face-up)
- `card.switchState`: reset to `'attack'`

---

### 8. Graveyard → Hand (Recycle / Recover)

**When:** Card effect returns a GY card to hand.

```javascript
card.moveTo('hand', false, null, true)
```

**What changes:**
- `card.position`: `'graveyard'` → `'hand'`
- `card.switchState`: reset to `'attack'`
- GY count badge decrements

---

### 9. Graveyard → Summon (Special Summon from GY)

```javascript
card.moveTo('summon', false, slotNumber, true)
```

Same as Hand → Summon but the source collection is graveyard. GY count decrements.

---

### 10. Deck → Graveyard (Mill / Send)

**When:** Mill effect, cost that sends from deck.

```javascript
card.moveTo('graveyard', true, null, true)
```

Deck count decrements, GY count increments. The card was face-down in deck — `foldState` is not auto-changed, but typically milled cards arrive in GY face-up in real game; the player must flip manually in the simulator.

---

### 11. Extra Deck → Summon (Special Summon from Extra Deck)

**When:** Fusing, Synchro, Xyz, or Link summoning.

```javascript
card.moveTo('summon', false, slotNumber, true)
// card.isExtra must be true
```

**canMoveTo guard:** `card.canMoveExDeck` must be `true` (default `true` for all cards). Extra deck count decrements.

---

### 12. Summon → Extra Deck (Return to Extra Deck)

```javascript
card.moveTo('exdeck', false, null, true)
```

**canMoveTo guard:** `card.canMoveExDeck` must be true. Extra deck count increments.

---

### 13. Deck → Banish (Banish from Deck)

```javascript
card.moveTo('banish', true, null, true)
```

Deck count decrements, banish count increments.

---

### 14. Summon / ST → Deck (Return to Deck)

```javascript
card.moveTo('deck', true, null, true)   // top of deck
card.moveTo('deck', false, null, true)  // bottom of deck
```

`isTop` controls whether the card goes to top or bottom of deck. Deck count increments; a `deck.drawOnBoard()` updates the visual.

---

## State Changes Summary Table

| Transition | foldState | switchState | collection_order |
|-----------|-----------|-------------|-----------------|
| → hand | unchanged | reset to `attack` | next index |
| → deck | unchanged | reset to `attack` | top or bottom index |
| → graveyard | unchanged | reset to `attack` | new top |
| → banish | unchanged | reset to `attack` | new top |
| from banish → anywhere | **forced `normal`** | reset to `attack` | new position |
| → summon | unchanged | unchanged | slot number (1–5) |
| → st | unchanged | unchanged | slot number (1–5) |
| → exdeck | unchanged | reset to `attack` | new top |
| → fz | unchanged | unchanged | 0 |

---

## How a Full Combo Looks in PlayLog

Example: "Draw 1 card, Normal Summon it, use its effect to send from deck to GY, then banish the GY card."

```javascript
steps = [
  // Step 1: Deck → Hand
  { action: 'update', uuid: 'card-A',
    data:    { position: 'hand',      collection_order: 5 },
    oldData: { position: 'deck',      collection_order: 3 } },

  // Step 2: Hand → Summon slot 3
  { action: 'update', uuid: 'card-A',
    data:    { position: 'summon',    collection_order: 3 },
    oldData: { position: 'hand',      collection_order: 5 } },

  // Step 3: Deck → Graveyard (card-A's effect mills card-B)
  { action: 'update', uuid: 'card-B',
    data:    { position: 'graveyard', collection_order: 1 },
    oldData: { position: 'deck',      collection_order: 8 } },

  // Step 4: Graveyard → Banish (follow-up effect banishes card-B)
  { action: 'update', uuid: 'card-B',
    data:    { position: 'banish',    collection_order: 1 },
    oldData: { position: 'graveyard', collection_order: 1 } },
]
```

Each step is the **minimal diff** — only `position` and `collection_order` change on a move. Other properties (`foldState`, `switchState`) are logged separately if also changed.

---

## Special Cases

### Xyz Overlay (Materials under a Monster)

Xyz summoning is **not** a simple `moveTo`. It goes through `board.overlayCard(uuid, slotNumber)`:

```
1. Pick the Xyz monster card (already on summon)
2. Pick material cards (also on summon)
3. board.overlayCard(xyz_uuid, targetSlot)
   └─ reassigns all involved cards to targetSlot's collection_order
   └─ Xyz card: isOverlay = true  (it has materials)
   └─ materials: isOverlap = true, overlap_order = 1/2/3...
4. PlayLog: action = 'overlay'
```

To **detach** a material:
```
board.detachOverlay(material_uuid)
   └─ material.moveTo('graveyard')
   └─ decrements remaining overlap_order values
   └─ if 0 materials left: xyz_card.isOverlay = false
4. PlayLog: action = 'detach'
```

### Moving a Card Face-Down (Set)

`moveTo` does NOT set `foldState`. The menu calls `fold()` separately after the move:

```javascript
// Set a monster
card.moveTo('summon', false, slot, true);
card.defense();           // rotate to defense position
card.fold('fold', true);  // flip face-down
```

Each of these generates its own `PlayLog` step.

### `fireEvent = false` (Replay Mode)

During replay, `playStep()` calls `moveTo` with `fireEvent = false`. This skips:
- `afterMove()` → no new PlayLog entry (would create infinite loop)
- `collection.drawOnBoard()` → caller handles redraw

---

## Adding a New Movement Path

If you need a new source→destination pair (e.g., "deck → exdeck"):

1. **Check `canMoveTo()`** — add the case if it needs a guard
2. **Call `card.moveTo(newPosition, ...)`** — existing pipeline handles the rest
3. **Verify `appendToBoard()`** covers the destination — it already covers all 8 positions
4. **Confirm `afterMove()`** logs it — it always does as long as `fireEvent=true`
5. **Check `PlayLog.playStep()`** — `'update'` action type handles all position changes, so no new case needed unless you're adding a non-move action
