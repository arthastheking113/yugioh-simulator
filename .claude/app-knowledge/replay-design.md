# Replay System Design

## Purpose

The `PlayLog` class records every game action as a step during a session, then replays them in sequence with timed pauses so viewers can follow a combo.

## Recording

```
User clicks "Start Record"
  → board.exportState('array') → stored as playlog.initItems
  → playlog.isStarted = true
  → Every subsequent action calls playlog.writelog(step)

User clicks "Stop Record"
  → playlog.isStarted = false
  → Steps are frozen
```

**`initItems`** is the full board snapshot at record start. Replay empties the board and restores from `initItems` before playing back steps.

## Step Shape

```javascript
{
  action: ActionType,    // what happened
  uuid: string,          // which card (null for board-level actions)
  data: object,          // new state values applied
  oldData: object,       // previous state (for future undo support)
  message: string,       // HTML shown in the log message panel
  isLastStep: boolean
}
```

## Action Types

| Action | Triggered by |
|--------|-------------|
| `update` | Any card property change (position, foldState, switchState) |
| `overlay` | Xyz material attached |
| `detach` | Xyz material removed |
| `target` | Card targeted |
| `declare` | Card declared |
| `reveal` | Card revealed from collection |
| `shuffle` | Generic shuffle |
| `shuffle_deck` | Deck shuffled |
| `update-phase` | Phase button clicked |
| `active-skill` | Skill activated |
| `chat` | Player typed a message |
| `startRecord` / `stopRecord` | Recording markers |

## Playback Algorithm

```
playlog.replay()
  1. board.emptyBoard()          ← clear all cards from DOM + items[]
  2. Load initItems              ← restore starting board state
  3. playlog.pointer = 0
  4. Loop:
       step = steps[pointer]
       playStep(step)            ← apply step to board
       wait 1500ms
       pointer++
     Until pointer >= steps.length
```

`playStep(step)` dispatches on `step.action`:
- `update` → `board.updateItem(uuid, key, value)` for each changed property
- `overlay` → `board.overlayCard(uuid, new_order)`
- `detach` → `board.detachOverlay(uuid)`
- `target` / `declare` / `reveal` → `card.doAnimation(action)`
- `update-phase` → `board.setPhase(phase)`
- others → specific handlers

## Pause / Resume

```
pause()  → isPausing = true   (loop checks flag, stops calling playStep)
resume() → isPausing = false  (loop restarts from current pointer)
stop()   → reset pointer, restore UI
```

## State Persistence

The full playlog is included in `board.exportState()`:

```javascript
playLogData: {
  initItems: Card[],
  steps: Step[],
  isPausing: false,
  isRePlaying: false,
  isStarted: false,
  pointer: 0
}
```

Importing a state restores the playlog, so combos can be shared and replayed from the exported JSON.

## Combo Graph Hooks

`PlayLog` exposes three optional, guarded global hooks so the **Combo Graph** (see `combo-graph.md`) can mirror playback without coupling the engine to it. Each call site checks `typeof window.<hook> === 'function'` first, so replay works whether or not `combo_graph.js` is loaded.

| Hook | Call site | Purpose |
|------|-----------|---------|
| `window.comboGraphOnReplayStart()` | `replay()` (after `isRePlaying = true`) | rebuild the graph so node indices match the steps about to play |
| `window.comboGraphOnStep(pointer - 1)` | `playStep()` (after a valid step is dequeued) | highlight the node for the step now playing (scrolled into view inside the graph container only — never scrolls the page) |
| `window.comboGraphOnReplayEnd()` | `stopReplay()` | clear the highlight |

Separately, `window.comboGraphRefresh()` (re)builds the graph from `board.exportState()` and is called on **Stop Record**, in **`importState()`**, and after the **initial board load** — so the graph is always current without a manual button.

## Critical Rule

**Every user-triggered action that changes game state must call `playlog.writelog(step)`.**

If any action is skipped, replay diverges from the original sequence at that point. This is the most common source of replay bugs.
