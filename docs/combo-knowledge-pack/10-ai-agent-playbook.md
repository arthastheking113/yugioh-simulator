# 10 — AI Agent Playbook

Practical recipes and reasoning guides for an agent that must answer questions about, or make changes to, the Combo Simulator. This file assumes you have read the rest of the pack.

## Mental model in five sentences

1. `Board` is a singleton holding every card in one `items[]` array; a card's `position` field is what puts it in a zone.
2. Almost every game action is `card.moveTo(position, isTop, order, fireEvent)` plus a few non-move actions (`fold`, `attack`/`defense`, `target`, `declare`, `reveal`).
3. Every action records a **step** through `board.writelog(...)`, and `PlayLog` replays those steps to reproduce a combo.
4. The DOM is kept in sync only because mutations go through `board.updateItem(uuid, key, value)`, which calls `updateHtml()`.
5. The whole board + log round-trips through `exportState()` / `importState()`, which is how combos are shared.

## The three laws (restate before any change)

1. **Log every state change** → `board.writelog(action, id, data, oldData)`.
2. **Mutate via `board.updateItem(uuid, key, value)`** → never assign `card.x =` directly outside Card's own methods.
3. **Keep `exportState()` and `importState()` in sync** → new properties must be in both.

Breaking any of these produces a *silent* failure (replay desync, stale DOM, or data lost on share), not a crash. Most bugs in this project trace back to one of the three.

---

## Task recipes

### Add a new card action (e.g. a new menu verb)
1. Add a menu item in `card_menu.js` → `CardMenu.renderMenu()` (set `data-target` or a custom action key).
2. Handle the action key in the menu click-handler switch.
3. Add/extend the corresponding method on `Card` (or `Board`) in `simulator.js`.
4. **Log it**: call `board.writelog(...)` inside the handler (or rely on an existing logged primitive like `moveTo`/`fold`).
5. **Replay it**: make sure `PlayLog.playStep()` can re-apply it. A position/fold/switch change is already covered by the `update` action; a brand-new *kind* of action needs a new `case` in `playStep` **and** a message branch in `addStep`.

### Add a new card property
1. Add it to the `Card` constructor defaults (`simulator.js:560`).
2. Add it to `exportState()` serialization.
3. Add it to `importState()` restoration.
4. If it has a visual, set the matching CSS class in `Card.updateHtml()`.
5. If a user action changes it, log an `update` step carrying the new key.

### Change a card's visual
1. Initial render → `Card.drawHtml()`.
2. State-change render → `Card.updateHtml()`.
3. CSS lives in `css/simulator.css`; colors come from variables in `css/theme.css` (never hardcode).
4. Re-test **defense position** (90° rotation) and a **full hand** after any sizing change.

### Add a new movement path (source → destination)
Usually no new code — the `moveTo` pipeline covers all eight positions. Only add a `canMoveTo()` case if the new destination needs a guard. See [04-combo-and-card-movement.md](04-combo-and-card-movement.md) §"Adding a new movement path."

### Analyze how powerful a combo is (from a combo JSON)
Given an exported `board.exportState('json')` value, compute structural power metrics (end-board bodies, set traps, GY setup, net card advantage, starters/efficiency) and a Power Index. Don't invent semantics from card names without a card database. Full method, scoring model, and reference pseudo-code: [11-combo-power-analysis.md](11-combo-power-analysis.md).

---

## Debugging guides

### Replay desync (the most common bug)
Symptom: replay diverges from the original at some step.
- Confirm the offending action calls `board.writelog(...)` **and** that recording was active (`isStarted`) when it happened.
- Confirm `PlayLog.playStep()` has a handler for the action type.
- Confirm `exportState()` captured the relevant card state in `initItems` (the record-start snapshot) — a card that wasn't in the snapshot can't be moved by later steps.

### Overlay (Xyz) looks wrong after import
- Check that `isOverlay`, `isOverlap`, and `overlap_order` are all serialized in `exportState()` and restored in `importState()`.
- Remember the flags are **counter-intuitive**: `isOverlap` = material, `isOverlay` = monster ([07](07-xyz-overlay-deep-dive.md)).

### Collection count badge is stale after a move
- A redraw was skipped. `afterMove()` calls the source collection's `drawOnBoard()` — but only when `fireEvent === true`. During replay the `playStep` handler is responsible for redraws instead.

### A move "does nothing"
- The target individual slot was occupied → `moveTo` logs `console.warn('No Space to move card')` and returns `false`. Or `canMoveTo()` failed a guard (`isSpell` for `fz`, `canMoveExDeck` for `exdeck`, no free slot for `summon`/`st`).

### A face-down card flipped itself face-up
- It just left `banish` — leaving banish forces `foldState = 'normal'`. Or it moved anywhere and you expected `defense` to persist: `switchState` resets to `attack` on every move except to `summon`.

---

## How to answer questions about this project

- **Ground answers in the model, not intuition.** YuGi-Oh! intuition often disagrees with this code (no rules enforcement; counter-intuitive overlay flags; non-standard UUIDs; phases are cosmetic). Prefer the verified facts in this pack.
- **Cite the mechanism.** "It's logged via `board.writelog('update', …)` and replayed by `playStep`'s `update` case" beats "the replay handles it."
- **Distinguish design intent from implementation.** Some prose describes intent (e.g. "empty board → load initItems → play steps"); the implementation may differ in detail (the record-start snapshot rides in the `startRecord` step). Say which you mean.
- **When unsure, name the file/method to inspect** rather than guessing — e.g. "check `Board.overlayCard` and `_updateOverlay`."

## Edge cases worth knowing

| Edge case | Behavior |
|-----------|----------|
| Draw from an empty deck | No top card to move; nothing happens (no guard against trying). |
| Summon with all 5 monster slots full | `canMoveTo('summon')` returns false; move aborts. |
| Move into an occupied individual slot | `moveTo` warns "No Space to move card" and returns false. |
| Import JSON with no `items` | `importState` → `checkData` **throws**. |
| Record button clicked before placing cards | `initItems`/snapshot is empty; replay starts from an empty board. |
| Overlaid Xyz monster sent to GY | Materials are auto-detached; slot overlay state cleared. |
| Two copies of the same card | Same `cardId`, **different** `uuid`; steps reference `uuid`. |

## Provenance & caveats

- This pack was distilled from the project's internal docs **and verified against `js/simulator.js`** (~2,854 lines). Where they disagreed, the code won and the difference is flagged.
- **Line numbers and counts are a snapshot** and will drift. Use them as orientation, not addresses.
- This is a **visual tool with no rules engine and no automated tests** — all real-world verification is manual, in-browser. Treat any claim about runtime behavior as "as designed," and when modifying the code, verify in a browser.
