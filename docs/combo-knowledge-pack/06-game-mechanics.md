# 06 — Game Mechanics

This file covers the mechanics that are not plain `moveTo` calls: phases, the non-move card actions, drawing, and shuffling. Xyz overlay is complex enough to live in its own file ([07-xyz-overlay-deep-dive.md](07-xyz-overlay-deep-dive.md)).

## Phase system

Six phases, cycled manually by the player. They are **purely cosmetic** — no card action is ever blocked by the current phase.

| Key | Display name | Button |
|-----|--------------|--------|
| `dp` | Draw Phase | DP |
| `sp` | Stand By | SP |
| `m1` | Main Phase 1 | M1 |
| `bp` | Battle Phase | BP |
| `m2` | Main Phase 2 | M2 |
| `ep` | End Phase | EP |

`board.setPhase(phase)` (`simulator.js:2012`) — verified behavior:

1. Falls back to `'m1'` if the key is missing/invalid.
2. **If** the phase actually changes, logs a step: `writelog('update-phase', undefined, phase, oldPhase)` — note `data` is the phase **string**, not an object.
3. Sets `board.currentPhase = phase`.
4. Highlights the matching phase button in the UI.
5. Plays a sound from `sound/` and shows a full-screen phase announcement (~1000ms).

On replay, an `update-phase` step calls `board.setPhase(data)` to re-trigger the announcement.

## Non-move card actions

These change a card without moving it. Each is its own logged step.

| Method | What it does | Log (`action`, `data`) | Notes |
|--------|--------------|------------------------|-------|
| `fold(state, anim, dur)` | Flip face-up (`normal`) ⇄ face-down (`fold`) | `update`, `{ foldState }` | Guarded by `canFlip` (`foldState != state`). Swaps the `.normal`/`.fold` DOM classes; redraws the source collection if in one. |
| `attack(anim, dur)` | Set battle position to attack (upright) | `update`, `{ switchState }` | Via `_switchAttack('attack')`; guarded by `canSwitch`. |
| `defense(anim, dur)` | Set battle position to defense (rotated 90°) | `update`, `{ switchState }` | Via `_switchAttack('defense')`. |
| `target()` | Targeting flash animation | `target`, `{}` | Animation only; no state field changes. |
| `declare()` | "Declare effect" animation | `declare`, `{}` | Animation only. |
| `reveal()` | Reveal animation | `reveal`, `{}` | If the card is in `exdeck`, it is also re-appended to the **top** of the extra deck. |

Key implementation facts (verified):

- `fold` and `_switchAttack` both record an `update` step that carries **only** the one changed field (a minimal diff), with `oldData` carrying the previous value.
- `target`/`declare`/`reveal` record their **own** action types with an empty `data` object — they are re-played by calling the same method again.
- Because flips and battle-position switches are tagged as fast changes, replay applies them with a 5ms wait instead of the normal 1500ms (see [05](05-replay-and-playlog.md)).

## Draw / deck-to-hand

```javascript
board.deckToHand(count, from);   // from = 'deck' (default) or 'exdeck'
```

Draws `count` cards from the named collection into the hand by calling `card.moveTo('hand', …)` for each top card in turn. Each draw is its own `update` step, and the source collection's count badge decrements.

**Edge case:** calling `deckToHand` on an empty collection has nothing to draw — there is no rule preventing the attempt, so the engine simply finds no top card.

## Shuffle

```javascript
collection.shuffleCollectionCards();   // simulator.js:1449
```

- Performs a **Fisher–Yates** shuffle over the cards in that collection.
- **Renumbers `collection_order`** sequentially afterward so the new order is stable.
- Logs a `shuffle` / `shuffle_deck` step whose `data` is the list of `{uuid, collection_order, order}` assignments, so replay can reproduce the exact post-shuffle order deterministically (it does not re-randomize on playback — it applies the recorded order).

## The "skill" concept

`board.skill = { name, activated }` models a Speed-Duel-style player "Skill." Activating it logs an `active-skill` step and shows an announcement similar to a phase change. It is serialized in `exportState()` and restored in `importState()`.

## Chat

Players can type messages into the log panel. A message records a `chat` step whose `data` is the (HTML-escaped) message string and whose on-screen rendering is prefixed with the player name. Chat is part of the recorded timeline, so replays reproduce commentary inline with the moves.
