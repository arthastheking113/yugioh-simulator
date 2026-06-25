# Implementing the Combo Graph

How to add the **Combo Graph** feature to a build of the simulator that doesn't have it yet.

The combo graph is a **read-only** visualizer: it turns a recorded combo (the "combo json" from `board.exportState()`) into an ordered flow of nodes — card images, action-labeled arrows, destination-zone chips, and a `+` where Xyz materials combine. It rotates (horizontal ⇄ vertical), highlights each step live during replay, and exports to PNG.

> **Design rule that makes this safe to bolt on:** the feature touches **nothing** in the game engine's state, card model, or export/import format. It only *reads* `board.exportState()`. The only edits to existing files are (a) one new HTML section, (b) one `<link>`/`<script>` pair, and (c) **four one-line guarded hook calls** in `simulator.js`. Everything else is two new files.

## Prerequisites

The host build must already have:

1. **`board.exportState()`** returning an object shaped like:
   ```js
   {
     items: [ { uuid, name, imageURL, position, ... }, ... ],
     playLogData: {
       initItems: [ { uuid, name, imageURL, ... }, ... ],
       steps:     [ { action, uuid, data, oldData }, ... ],
       ...
     },
     ...
   }
   ```
   The graph reads `playLogData.initItems` (fallback `items`) for a `uuid → {name, imageURL}` lookup, and `playLogData.steps[]` for the ordered flow. See `docs/ARCHITECTURE.md` / `replay-design.md` for the full shape.

2. A **`PlayLog`** that records `steps[]` with an `action` field, and replays them through a `playStep()` driven by a `pointer`. The four step actions the graph renders are `update` (position / fold / switch), `overlay`, `detach`, `target`, `declare`, `reveal`, `update-phase`. All others are skipped.

3. A global **`board`** instance (the graph reads it lazily, at click/hook time — it does not need `board` to exist when the script loads).

If `exportState()` or `PlayLog` differ in your build, adjust the field names in `_stepToEvent()` and the export shape accordingly — that method is the single point of coupling to the engine.

## Overview of changes

| # | File | Change |
|---|------|--------|
| 1 | `js/combo_graph.js` | **New** — the `ComboGraph` class + singleton wiring |
| 2 | `css/combo_graph.css` | **New** — node / arrow / zone-chip / `+`-connector / `.cg-active` styling |
| 3 | `index.html` | Add the `<section>`, the CSS `<link>`, and the `<script>` (loaded **after** `simulator.js`/`main.js`) |
| 4 | `js/simulator.js` | Add **4 guarded hook calls** (Stop Record, replay start, per step, replay end) |

---

## Step 1 — Create `js/combo_graph.js`

This is the whole feature. The class has four responsibilities; build them in this order.

### 1a. Build: steps → renderable events

`build(state)` indexes cards by uuid, then walks `playLogData.steps[]`, mapping each step to a renderable *event* (or `null` to skip). Skipped steps still consume an index slot in `stepToNode` so live highlighting stays aligned with the replay `pointer`.

```js
build(state) {
    this.state = state || {};
    this.cardById = {};
    var playLog = this.state.playLogData || {};
    this._indexCards(playLog.initItems);
    this._indexCards(this.state.items);

    var steps = this._asArray(playLog.steps);
    this.events = [];
    this.stepToNode = {};            // original step index -> event index
    steps.forEach((step, i) => {
        var ev = this._stepToEvent(step);
        if (!ev) return;             // skipped step: index preserved, no node
        ev.stepIndex = i;
        this.stepToNode[i] = this.events.length;
        this.events.push(ev);
    });
    return this;
}
```

The **step → event** mapping (`_stepToEvent`) is the heart of it:

| Step | Becomes event | Renders as |
|------|---------------|-----------|
| `update` with `oldData.position !== data.position` | `move` | card → *(verb)* → zone chip + `from → to` |
| `update` fold-only change | `badge` | `Set Face-down` / `Flip Face-up` |
| `update` switch-only change | `badge` | `To Defense` / `To Attack` |
| `overlay` | `overlay` | `Xyz Material` badge; consecutive overlays joined by `+` |
| `detach` | `badge` | `Detach Material` |
| `target` / `declare` / `reveal` | `badge` | that label |
| `update-phase` | `phase` | phase divider chip |
| `startRecord` / `stopRecord` / `chat` / `shuffle` / `active-skill` | `null` | skipped |

The move **verb** comes from `describeMove(from, to)` — a switch on the destination zone (Draw, Summon / Special Summon, Send to GY, Banish, Return to Deck, Set / Activate, Activate Field Spell, Return to Extra Deck).

### 1b. Render: events → DOM

`render()` clears the container, applies the orientation class (`horizontal` / `vertical`), and appends one node per event with a connector between them. A connector is a `+` (`cg-combine`) when both neighbours are `overlay` events, otherwise a flow arrow.

Each node carries `dataset.eventIndex`, a step number, the card image, and the event-specific edge/chip/badge. Card image resolution mirrors `Card.drawHtml`: `card.imageURL` → else `asset/card/<name>.jpeg` → `asset/back_card.png` on `error`.

Empty state: if `this.events` is empty, render a `.cg-empty` hint instead.

### 1c. Orientation

```js
setOrientation(o)  // 'vertical' | 'horizontal' — swaps the container class
toggleOrientation()
```

### 1d. Replay sync

```js
highlightStep(stepIndex) {
    var eventIndex = this.stepToNode[stepIndex];
    if (eventIndex === undefined) return;   // skipped step → keep current highlight
    this.clearHighlight();
    var node = this.nodeElements[eventIndex];
    if (!node) return;
    node.classList.add('cg-active');
    this._scrollActiveIntoContainer(node);  // scroll the GRAPH BOX, not the page
}
```

> **Scroll gotcha:** do **not** use `node.scrollIntoView()` — it scrolls every ancestor including the document, yanking the page down to the graph on every step. Instead adjust only `this.container.scrollLeft` / `scrollTop` to center the active node within the graph's own scroll box. Assign the values directly rather than `scrollTo({behavior:'smooth'})`, which is unreliable across environments.

### 1e. PNG export (optional but included)

`exportImage(orientation)` returns a `Promise<filename>`. It does **not** screenshot the DOM — it draws from the structured `this.events` model onto an offscreen `<canvas>`:

1. `_preloadExportImages` — load each unique card image with `crossOrigin='anonymous'` **and a cache-busting query** (`?_cgexp=<ts>`). The cache-buster forces a fresh CORS fetch (the art CDN sends `access-control-allow-origin: *`), guaranteeing an **untainted** canvas so `toBlob()` succeeds even if the art was previously cached from a non-CORS request. 10 s timeout → fall back to the local back image, else a gray placeholder.
2. `_drawExportCanvas` — word-wrap names (≤2 lines + ellipsis), compute a uniform tile height, lay out tiles + `+`/`→`/`↓` connectors, render at 2× (scale capped so neither dimension exceeds 16384 px). Colors come from `EXPORT_PALETTE`, which mirrors the default-theme fallbacks in `combo_graph.css`.
3. `_downloadCanvas` — `toBlob()` → object-URL → click a temp `<a download>` → revoke. Filename `combo-graph-<layout>-<N>steps.png`. Includes a `toDataURL` fallback guarded by a timeout so the "Generating…" modal can't hang.

### 1f. Singleton wiring (bottom of the file, in an IIFE)

This is what connects the class to the page and the engine. It exposes **one refresh function** and **three replay hooks** on `window`, all looked up lazily:

```js
(function () {
    var graph = null;
    function getGraph() {
        if (!graph) {
            var container = document.getElementById('combo-graph');
            if (!container) return null;
            graph = new ComboGraph(container);
        }
        return graph;
    }
    function generate() {
        var g = getGraph();
        if (!g) return;
        if (typeof board === 'undefined' || !board || typeof board.exportState !== 'function') {
            g.events = []; g.render(); return;            // no engine yet → empty
        }
        g.build(board.exportState()).render();
    }

    document.addEventListener('DOMContentLoaded', function () {
        var r = document.getElementById('rotate-graph');
        if (r) r.addEventListener('click', function () { var g = getGraph(); if (g) g.toggleOrientation(); });
        var e = document.getElementById('export-graph');
        if (e) e.addEventListener('click', exportGraph);   // SweetAlert layout picker → g.exportImage()
    });

    // Public refresh: (re)build from current board state.
    window.comboGraphRefresh = generate;

    // Replay hooks called from simulator.js.
    window.comboGraphOnReplayStart = function () { var g = getGraph(); if (!g) return; generate(); g.clearHighlight(); };
    window.comboGraphOnStep        = function (i) { var g = getGraph(); if (g) g.highlightStep(i); };
    window.comboGraphOnReplayEnd   = function () { var g = getGraph(); if (g) g.clearHighlight(); };
})();
```

> Use the full implementation in [`js/combo_graph.js`](../js/combo_graph.js) as the reference — the snippets above are the skeleton; the file fills in `_renderEvent`, the canvas helpers, and the export SweetAlert flow.

---

## Step 2 — Create `css/combo_graph.css`

Style these selectors (see the shipped file for exact values; colors should read from your `theme.css` `--bs-*` variables so themes apply):

- `.combo-graph` — the scroll container; `.combo-graph.horizontal` (row, horizontal scroll) and `.combo-graph.vertical` (column).
- `.cg-step` + per-type modifiers `.cg-move` / `.cg-overlay` / `.cg-badge` / `.cg-phase`.
- `.cg-connector` (flow arrow) and `.cg-connector.cg-combine` (the `+`).
- `.cg-card`, `.cg-card-img`, `.cg-card-name`, `.cg-step-num`.
- `.cg-edge`, `.cg-arrow`, `.cg-action`, `.cg-from`, and `.cg-zone` zone chips (`.cg-zone-hand`, `-deck`, `-summon`, …) color-coded per zone.
- `.cg-active` — the live-replay highlight (e.g. ring + raised shadow).
- `.cg-empty` — empty-state hint.
- Toolbar buttons `.cg-btn-secondary`, `.cg-btn-export`.

---

## Step 3 — Wire `index.html`

**Head — add the stylesheet:**
```html
<link rel="stylesheet" href="css/combo_graph.css?v=1.1" integrity="" />
```

**Below the play board — add the section:**
```html
<section class="container mt-4 combo-graph-section">
  <div class="row justify-content-center">
    <div class="col-md-11">
      <div class="combo-graph-toolbar">
        <h5>Combo Graph</h5>
        <button type="button" id="rotate-graph" class="cg-btn-secondary">Rotate</button>
        <button type="button" id="export-graph" class="cg-btn-export">Export Image</button>
      </div>
      <p class="text-muted">The graph builds automatically when you Stop recording (or load a combo).
         Hit "Play" above to watch it highlight each step live, "Rotate" to switch orientation,
         and "Export Image" to save a PNG.</p>
      <div id="combo-graph" class="combo-graph horizontal">
        <div class="cg-empty">No combo recorded yet. Start Record &rarr; play your combo &rarr; Stop.</div>
      </div>
    </div>
  </div>
</section>
```

**Script — load it AFTER `simulator.js` and `main.js`** (it reads the global `board` lazily, so order only matters in that it must come after the engine defines `board`):
```html
<script src="js/combo_graph.js?v=1.3" integrity=""></script>
```

> **Cache-bust gotcha:** bump the `?v=N` on the new `<link>`/`<script>` whenever you edit the CSS/JS, or the browser may serve a stale copy.

---

## Step 4 — Add the four hooks in `js/simulator.js`

These are the *only* edits to engine code. Each is one line, guarded by a `typeof … === 'function'` check so the engine still runs if `combo_graph.js` is absent.

**1. Stop Record** — rebuild after the `stopRecord` step (in the stop-record button handler):
```js
if (typeof window.comboGraphRefresh === 'function') window.comboGraphRefresh();
```

**2. Replay start** — in `PlayLog.replay()`, after `this.isRePlaying = true`:
```js
if (typeof window.comboGraphOnReplayStart === 'function') window.comboGraphOnReplayStart();
```

**3. Per step** — in `PlayLog.playStep()`, after the pointer is post-incremented (pass `pointer - 1`):
```js
if (typeof window.comboGraphOnStep === 'function') window.comboGraphOnStep(this.pointer - 1);
```

**4. Replay end** — in `PlayLog.stopReplay()`, after `board.afterReplay()`:
```js
if (typeof window.comboGraphOnReplayEnd === 'function') window.comboGraphOnReplayEnd();
```

**Also (recommended) — load points** so the graph appears without recording:
```js
// at the end of Board.importState(), and after a board.json fetch is restored:
if (typeof window.comboGraphRefresh === 'function') window.comboGraphRefresh();
```
This makes loading a combo JSON (or the startup `board.json`) render its graph immediately.

---

## Verify

1. **Empty state** — load the page with no combo: the section shows the "No combo recorded yet" hint.
2. **Record** — Start Record → draw, summon, send to GY, make an Xyz (overlay two materials) → Stop. The graph should show a node per move, a `+` joining the two Xyz materials, and zone chips matching destinations.
3. **Replay** — Play. Each node gets the `.cg-active` highlight in turn, and the graph box scrolls to keep it visible **without** scrolling the whole page.
4. **Rotate** — toggles horizontal ⇄ vertical.
5. **Export Image** — pick Horizontal or Vertical; a `combo-graph-<layout>-<N>steps.png` downloads with real card art (not the back image — confirms the CORS/cache-bust path works).
6. **Load a combo JSON** — the graph rebuilds to match.

## Common pitfalls

- **Highlight drifts off by N during replay** — a skipped step isn't preserving its index. Ensure `build()` keeps the `stepToNode` slot for every step and only *omits the node*, never the index accounting.
- **Page jumps to the graph on every replay step** — you used `scrollIntoView()`. Adjust only the container's `scrollLeft`/`scrollTop`.
- **Export downloads the card back instead of art / `toBlob` throws** — a tainted canvas. Confirm `crossOrigin='anonymous'` **and** the `?_cgexp=<ts>` cache-buster are both applied on every export image load.
- **Graph never updates after recording** — the `comboGraphRefresh` hook isn't firing, or `combo_graph.js` loads *before* `board` is defined and `getGraph()` cached a `null`. The lazy `getGraph()`/guarded hooks avoid both; verify the script tag is after `simulator.js`.
- **New card property doesn't show** — the graph reads whatever `exportState()` emits; if a property matters to a node, surface it in `_stepToEvent()`. No export/import change is needed (the graph is read-only).

## Reference

- [`js/combo_graph.js`](../js/combo_graph.js) — full implementation.
- [`.claude/app-knowledge/combo-graph.md`](../.claude/app-knowledge/combo-graph.md) — the "how it works" design reference (keep in sync with `docs/combo-knowledge-pack/`).
- `replay-design.md` — the steps / export format the graph consumes, plus the hook call sites.
