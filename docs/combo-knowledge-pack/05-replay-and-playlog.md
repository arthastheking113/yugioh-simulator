# 05 — Replay System & PlayLog

`PlayLog` (`simulator.js:6`) is the recorder/player. It turns a session into an ordered list of **steps** and plays them back with timed pauses. This is what makes a combo shareable and watchable.

## The recording → replay loop

```
Start Record  ─►  every action appends a step  ─►  Stop Record  ─►  Replay
```

### Recording

1. User clicks **Start Record**. The handler calls `addStep('startRecord', undefined, {...currentItems}, {})`.
   - Inside the `startRecord` case: `isStarted = true`, `steps = []` (a fresh recording), and the step's `data` is set to a snapshot `{ items, currentPhase, skill }`. **This first step carries the initial board snapshot.**
2. Every subsequent state change calls `board.writelog(...)` → `addStep(...)`, which **pushes a step only while `isStarted` is true.**
3. User clicks **Stop Record** → `addStep('stopRecord', …)` sets `isStarted = false`. Steps are now frozen.

> **Gate to remember:** `addStep` returns `false` immediately if `isRePlaying` is true (so replay never records itself), and it only pushes to `steps[]` when `isStarted` (or the action is `startRecord`). Calling `writelog` outside a recording is harmless — it updates the on-screen log but stores nothing.

`initItems` is the conceptual "board snapshot at record start." Replay clears the board and restores from that snapshot before playing the recorded steps.

### Playback algorithm

```
playlog.replay()
  1. board.beforeReplay()
  2. if no steps recorded → "No Records found", stop
  3. pointer = 0;  isRePlaying = true
  4. playStep()    ← plays steps[pointer], schedules the next after a wait, repeats
        • normal wait between steps: 1500ms
        • flips / battle-position switches: 5ms (effectively instant)
        • when pointer runs past the end → writeEnd(), stopReplay()
```

`isRePlaying = true` causes `writelog/addStep` to no-op, so re-issuing moves during playback does not create new steps.

### Pause / resume / stop

| Control | Effect |
|---------|--------|
| `pauseReplay()` | sets `isPausing = true`; the loop checks the flag and stops advancing |
| `resumeReplay()` | clears `isPausing`; the loop continues from the current `pointer` |
| `stopReplay()` | ends replay, resets `pointer`, restores the UI buttons |

---

## The step object (verified shape)

When `addStep` decides to record, it pushes exactly this onto `steps[]`:

```javascript
{
  action:  action,                                   // the action type (see table)
  uuid:    uuid,                                      // which card; undefined for board-level actions
  data:    (typeof data == 'object') ? {...data} : data,  // NEW state — object OR a scalar
  oldData: oldData || {},                             // PREVIOUS state (enables future undo)
  message: message || '',                             // pre-rendered HTML shown in the log panel
}
```

Two correctness notes that older prose gets wrong:

- **`data` is not always an object.** For `update-phase` it is a phase **string**; for `chat` it is the message **string**; for card updates it is an object like `{position, collection_order}`.
- **`isLastStep` and `nextStep` are NOT stored on the step.** They are computed on the fly by `step()` when the step is dequeued during replay.

## Action types

| `action` | Triggered by | `data` payload |
|----------|--------------|----------------|
| `update` | Any card property change — position, foldState, switchState (and any other key) | object of changed keys → new values |
| `overlay` | Xyz material attached | `{ order }` (target slot) |
| `detach` | Xyz material removed | (card-scoped) |
| `target` | `card.target()` | `{}` |
| `declare` | `card.declare()` | `{}` |
| `reveal` | `card.reveal()` | `{}` |
| `shuffle` | Generic shuffle | array of `{uuid, collection_order, order}` |
| `shuffle_deck` | Deck shuffled | array of `{uuid, collection_order, order}` |
| `update-phase` | `board.setPhase()` | phase **string** (e.g. `'bp'`) |
| `active-skill` | Player skill activated | (derived) |
| `chat` | Player typed a message | message **string** |
| `startRecord` / `stopRecord` | Recording markers | snapshot object |

## How `playStep()` applies a step (dispatch on `action`)

`playStep()` (`simulator.js:314`) switches on `step.action`:

- **`update`** — the workhorse. For each `key`→`value` in `data`, it calls `board.updateItem(uuid, key, value)`.
  - It first inspects the diff to classify the change: a **move** (`position` or `collection_order` changed), a **flip** (`foldState` changed), or a **rotate** (`switchState` changed).
  - Moves run the clone animation (`startMoveAnimation` → `moveAnimation` → `endBoardAnimation`) and redraw the affected collections; flips/rotations use the 5ms fast path with no animation wait.
  - If the moving card is an Xyz monster (`isOverlay === true`), its materials are carried along when moving to `summon` (`isMoveWithAllOverlap`) or detached when leaving `summon` (`isDetachAllOverlap`).
- **`shuffle` / `shuffle_deck`** — apply `collection_order` + `order` from `data` to each listed card, then redraw the deck.
- **`target` / `declare` / `reveal`** — call `card[action]()` to re-play the animation.
- **`overlay`** — `board.overlayCard(card.uuid, data.order)`.
- **`detach`** — `card.detachOverlap()`.
- **`update-phase`** — `board.setPhase(data)`.

Each handler also writes the step's pre-rendered `message` into the on-screen log panel.

---

## State export / import (verified)

The full board — including the entire PlayLog — round-trips through these two methods. This is how combos are shared.

### `board.exportState(type = 'array')` → object (or JSON string if `type === 'json'`)

```javascript
{
  dateCreate:   "2024-07-13T08:21:18.151Z",  // new Date().toISOString()
  items:        [ /* Card[] currently on the board */ ],
  version:      board.version,                // schema version
  currentPhase: "m1",
  skill:        { name: "", activated: false },
  playLogData: {
    initItems:   [ /* snapshot at record start */ ],
    steps:       [ /* the recorded Step[] */ ],
    isPausing:   false,
    isRePlaying: false,
    isStarted:   false,
    pointer:     0
  }
}
```

### `board.importState(state)` — order of operations (verified)

```
1. board.emptyBoard()                 ← clear items[] AND the DOM
2. board.playlog.reset()
3. checkStateType(state)              ← JSON.parse if it's a string
4. checkData(state)                   ← THROWS if there is no `items` array; validates each item
5. board.setItems(items)             ← re-create Card instances
6. board.setPhase(state.currentPhase)
7. board.setSkill(state.skill)
8. copy every key of state.playLogData onto board.playlog   ← restores initItems, steps, pointer, …
```

Because import calls `emptyBoard()` first, importing is destructive to the current board — it fully replaces it.

---

## Combo graph hooks (optional, read-only)

The same `steps[]` that replay consumes also drive the **combo graph** — a read-only visual flow shown below the board (see [08-ui-rendering-and-menus.md](08-ui-rendering-and-menus.md)). `PlayLog` exposes it through guarded global hooks so the engine never depends on `combo_graph.js` (each call site checks `typeof window.<hook> === 'function'`):

| Hook | Call site | Purpose |
|------|-----------|---------|
| `window.comboGraphOnReplayStart()` | `replay()` | rebuild the graph so node indices match the steps about to play |
| `window.comboGraphOnStep(pointer - 1)` | `playStep()` (after a valid step is dequeued) | highlight the node for the step now playing, scrolling it into view **inside the graph container only** (never scrolls the page) |
| `window.comboGraphOnReplayEnd()` | `stopReplay()` | clear the highlight |

A separate `window.comboGraphRefresh()` rebuilds the graph from `board.exportState()` and is invoked on **Stop Record**, inside **`importState()`**, and after the **initial board load** — so the graph always reflects the current recording without a manual button. (At startup the app loads a saved state via `importState(board.json)`, so the saved combo's graph appears immediately.)

---

## The single most important rule

> **Every user-triggered action that changes game state must be logged** (via `board.writelog(...)`, while recording is active).

If one action is skipped, replay diverges from the original at exactly that point and everything after it is wrong. This is the **number-one source of replay bugs.** When adding any new state-changing feature, the checklist is:

1. Does the action call `board.writelog(...)` (so it can be recorded)?
2. Does `PlayLog.playStep()` know how to re-apply it (an existing `update` covers position/fold/switch; a brand-new action type needs a new `case`)?
3. Does `exportState()`/`importState()` carry any new fields the action depends on?
