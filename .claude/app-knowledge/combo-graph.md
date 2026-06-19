# Combo Graph

## Purpose

A visual flow graph of a recorded combo, shown in a section **below** the play board. It turns the "combo json" (`board.exportState()`) into an ordered sequence of nodes — card images, action-labeled arrows, destination-zone chips, and a `+` where Xyz materials combine. It is **rotatable** (horizontal ⇄ vertical) and **highlights each step live** during replay.

## Files

| File | Role |
|------|------|
| `js/combo_graph.js` | `ComboGraph` class + singleton wiring (Rotate button, replay hooks) |
| `css/combo_graph.css` | Node/arrow/zone-chip/`+`-connector styling, `.horizontal`/`.vertical`, `.cg-active` |
| `index.html` | `<section class="combo-graph-section">` with `#combo-graph` + `#rotate-graph` button |

Loaded **after** `simulator.js`/`main.js` (it reads the global `board` lazily, at click/hook time).

## Data source

It consumes `board.exportState()` — see `replay-design.md` for the shape. It uses:
- `playLogData.initItems` (fallback `items`) → a `uuid → {name, imageURL}` lookup for card identity + image.
- `playLogData.steps[]` → the ordered flow.

**Read-only:** the graph never mutates board state, adds no card property, and changes nothing in export/import. It just renders.

## `ComboGraph` API

```javascript
const g = new ComboGraph(document.getElementById('combo-graph'));
g.build(board.exportState())   // walk steps[] → graph events; build stepToNode map
 .render();                    // draw nodes into the container
g.setOrientation('vertical');  // or 'horizontal'; toggleOrientation() flips
g.highlightStep(i);            // mark the node for original step index i (replay sync)
g.clearHighlight();
```

`build()` keeps `stepToNode` (original step index → rendered-event index). Skipped steps (record markers, chat, shuffle) keep their index slot so live-replay highlighting stays aligned with `PlayLog.pointer`.

## Step → visual mapping

| Step | Renders as |
|------|-----------|
| `update` w/ position change | card image →(verb)→ zone chip + `from → to` sub-label |
| `update` fold-only | badge `Set Face-down` / `Flip Face-up` |
| `update` switch-only | badge `To Defense` / `To Attack` |
| `overlay` | overlay badge `Xyz Material`; consecutive overlays are joined by a `+` connector |
| `detach` | badge `Detach Material` |
| `target` / `declare` / `reveal` | badge with that label |
| `update-phase` | phase divider chip |
| `startRecord` / `stopRecord` / `chat` / `shuffle` / `active-skill` | skipped (index preserved) |

**Move verbs** (`describeMove(from, to)`): Draw, Summon / Special Summon, Send to GY, Banish, Return to Deck, Set / Activate, Activate Field Spell, Return to Extra Deck.

**Card image:** `card.imageURL` → else `asset/card/<name>.jpeg` → `asset/back_card.png` on load error (mirrors `Card.drawHtml`). Zone chips are color-coded from `theme.css` `--bs-*` variables.

## Auto-generate (no manual button)

The graph rebuilds itself via `window.comboGraphRefresh()` (= rebuild from the current `board.exportState()`); there is **no** "Generate" button, only **Rotate**. `comboGraphRefresh` is called from three load points in `simulator.js`:

1. **Stop Record** — the stop-record-button handler, after the `stopRecord` step.
2. **`Board.importState()`** — after the playlog is restored (load a combo JSON → graph loads).
3. **Initial board load** — on startup `simulator.js` fetches `board.json` and restores it with `importState()` (so point #2 fires and the saved combo's graph shows immediately). If the sample-deck API loader is re-enabled instead, the graph just starts empty for a fresh deck.

## Live replay sync

`simulator.js` calls three guarded global hooks (all `typeof === 'function'` checks, so the engine runs fine without the graph):

| Hook | Called from | Effect |
|------|-------------|--------|
| `window.comboGraphOnReplayStart()` | `PlayLog.replay()` | rebuild graph + clear highlight (indices match the steps about to play) |
| `window.comboGraphOnStep(i)` | `PlayLog.playStep()` with `i = pointer - 1` | highlight the node for step `i` and scroll it into view **within the graph container only** |
| `window.comboGraphOnReplayEnd()` | `PlayLog.stopReplay()` | clear highlight |

> **Scroll behavior:** the active node is centered by adjusting only the graph container's own `scrollLeft`/`scrollTop` (`_scrollActiveIntoContainer`) — it deliberately does **not** use `node.scrollIntoView()`, which would scroll the whole page down to the graph. The user scrolls to the graph themselves; replay then keeps the active step visible inside it. (Direct scroll assignment, not `scrollTo({behavior:'smooth'})`, since programmatic smooth scroll is unreliable across environments.)

## Related

- `replay-design.md` — the steps/export format the graph reads, plus the hook call sites.
- `ui-layout.md` — where the section sits, CSS responsibilities.
- `context-menu-design.md` — the menu/overlay interactions that feed steps into a combo.
