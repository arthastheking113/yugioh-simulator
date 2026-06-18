# 07 — Xyz Overlay Deep Dive

The Xyz "overlay" system stacks **material** cards visually beneath an **Xyz monster** in a single `summon` slot. It is the most complex mechanic in the simulator and the most error-prone part of its documentation. This file is authoritative and verified against the source.

## ⚠️ The flag-naming trap (read first)

The two boolean flags read backwards from English intuition, and some of the project's older prose got them inverted. **The code is the source of truth:**

| Flag | When `true`, the card is… | Real example |
|------|---------------------------|--------------|
| **`isOverlap`** | **a MATERIAL** sitting *underneath* the monster | the cards you "detach to pay a cost" |
| **`isOverlay`** | **the XYZ MONSTER** on top that *carries* the materials | the actual monster on the field |

Mnemonic that matches the code: a material is *overlapped under* the monster (`isOverlap`); the monster is *overlaid on top* (`isOverlay`).

**`overlap_order`** exists on *both* kinds:
- materials get `1, 2, 3, …` (their stacking position),
- the Xyz monster gets the **highest** value, `max(materials) + 1`.

A lone monster with no materials has **both flags false** and is just a normal card in a slot.

## The grouping mechanism

There is no parent/child pointer between a monster and its materials. They are grouped purely by sharing the **same `collection_order`** while in the `summon` zone:

```
board.getItemsByCollectionOrder(order)  → every card in that slot (monster + its materials)
```

The DOM slot element gets the class `.overlay-slot` whenever more than one card shares its order.

---

## Attach flow — `board.overlayCard(card_uuid, new_order)`

Verified from `simulator.js:2495`. `card_uuid` is the **Xyz monster** you right-clicked; `new_order` is the destination slot (`1`–`5`).

```
overlayCard(monster_uuid, new_order):
  1. currentOrder = monster.collection_order
  2. cards = getItemsByCollectionOrder(currentOrder)      // the monster + anything already grouped with it
  3. slot = the summon slot DOM element whose data-order == new_order
  4. for each card in `cards` that is NOT the monster:
         _updateOverlap(slot, card, new_order)            // make it a MATERIAL
  5. _updateOverlay(slot, monster, new_order)             // make the monster the carrier
```

`_updateOverlap(slot, card, new_order)` — turns a card into a material:
```
card.collection_order = new_order
card.setDataOverlap(maxExistingOverlapOrder + 1)         // isOverlap=true, isOverlay=false, overlap_order=N
append card's DOM into the slot
```

`_updateOverlay(slot, monster, order)` — turns the monster into the carrier:
```
slot.addClass('overlay-slot')
for each existing material in the slot: setDataOverlap(index+1)   // re-number materials 1..N
monster.setDataOverlay(maxMaterialOrder + 1)             // isOverlay=true, isOverlap=false, overlap_order=max+1
monster.collection_order = order
append monster's DOM into the slot (on top)
```

`setDataOverlap(n)` (on a **material**) sets: `isOverlap=true`, `isOverlay=false`, `overlap_order=n`, `switchState='attack'`, `foldState='normal'`.

`setDataOverlay(n)` (on the **monster**) sets: `isOverlay=true`, `isOverlap=false`, `overlap_order=n`, `foldState='normal'`.

### Resulting state invariant

| Property | Xyz monster (on top) | Material (beneath) |
|----------|:--------------------:|:------------------:|
| `isOverlay` | `true` | `false` |
| `isOverlap` | `false` | `true` |
| `overlap_order` | `max + 1` (highest) | `1, 2, 3, …` |
| `collection_order` | the shared slot token (e.g. `"ss3"`) | the **same** shared slot token |

The shared `collection_order` is what visually groups them; `overlap_order` controls z-stacking within the pile.

The replay step for an attach is `{ action: 'overlay', uuid: monster_uuid, data: { order } }`.

---

## Detach flow

Removing a single material — `card.detachOverlap()` / `board.detachOverlay(uuid)`:

```
- move the material out to the graveyard
- decrement the overlap_order of the remaining materials
- if no materials remain, the monster is no longer a carrier (its overlay state clears)
```

The replay step is `{ action: 'detach', uuid: material_uuid }`, re-applied during playback via `card.detachOverlap()`.

## Carrying & auto-detach on the monster's move

This is handled inside `moveTo` (verified `simulator.js:707-816`) and mirrored in `playStep`:

- When a card with **`isOverlay === true`** (the monster) moves **to another `summon` slot**, `isMoveAllOverlap` is true and **all its materials move with it** (they are re-assigned to the new slot's `collection_order` and re-appended).
- When that monster moves **off the `summon` zone** (to GY, hand, etc.), the engine sets the monster's `isOverlay = false`, calls `detachAllOverlap()`, and clears the slot's overlay state via `checkOverlaySlot()`.

`checkOverlaySlot(order)` (verified): if a slot ends up with more than one card it keeps `.overlay-slot`; if exactly one card remains, that card has **both** `isOverlay` and `isOverlap` reset to `false` (it is a plain monster again); zero cards removes the class.

---

## Worked example

Start: an Xyz monster `M` alone in summon slot 2; two future materials `A`, `B` already grouped at slot 2 (e.g. you placed them there first).

```
overlayCard(M.uuid, 2):
  cards at order 2 = [M, A, B]
  A → _updateOverlap → isOverlap=true,  overlap_order=1
  B → _updateOverlap → isOverlap=true,  overlap_order=2
  M → _updateOverlay → isOverlay=true,  overlap_order=3   (max material order 2, +1)
  slot 2 gets .overlay-slot

Result in slot 2 (z-order bottom→top):  A(1) · B(2) · M(3, on top, visible)
```

Detach `A`:
```
A.detachOverlap():
  A → graveyard
  remaining material B: overlap_order decremented → 1
  M still carries 1 material, stays isOverlay=true
```

Move `M` to the graveyard:
```
M.moveTo('graveyard', …):
  isOverlay was true & destination != 'summon' → detach all
  M.isOverlay = false; remaining materials detached; slot 2 overlay state cleared
```

---

## Why this matters for export/import and replay

- All three overlay fields (`isOverlay`, `isOverlap`, `overlap_order`) are ordinary `Card` properties, so they must be present in `exportState()` and restored by `importState()` — otherwise an imported board shows the cards un-stacked. (This is the classic "overlay after import" bug: booleans not restored.)
- The replay actions `overlay` and `detach` re-run `board.overlayCard` / `card.detachOverlap`, which **recompute** the flags. So a correctly recorded overlay sequence rebuilds the pile during playback even if the intermediate snapshots were imperfect.

## Common Xyz pitfalls (for an agent)

1. **Inverting the flags.** Re-read the table above. `isOverlap` = material; `isOverlay` = monster.
2. **Assuming `overlap_order = 0` for the monster.** It is the *highest* order, not zero. (Zero/absent means "not part of a pile.")
3. **Forgetting the shared `collection_order`.** Materials and monster must share the slot's order or they will not be grouped.
4. **Replay desync on overlay.** Ensure the `overlay`/`detach` steps are actually recorded; a missing one leaves the pile wrong from that point on.
