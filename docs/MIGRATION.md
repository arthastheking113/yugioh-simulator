# Migration Guide

How to bring an existing build / fork of the simulator up to the **Basic /
Advanced view** release.

This release is **additive and backwards-compatible** — no save format, export
shape, or game-engine behaviour changed. Existing `board.json` exports and
recorded combos load and replay exactly as before. The work is mostly markup,
CSS, and a few small JS hooks.

> **Reminder — no build step.** The app runs by opening `index.html`. After
> editing JS/CSS you must bump the `?v=` query string in `index.html` or the
> browser may serve a stale cached copy.

---

## At a glance

| Area | What changed | Action on upgrade |
|------|--------------|-------------------|
| Default view | Board now opens in **Basic** every load (not persisted). | None — automatic. |
| Layout | Side columns hide in Basic; board expands. | None — automatic. |
| Record/replay buttons | Relocate to the top bar in Basic. | None — automatic. |
| Card-info panel | Pre-fills on load; follows declares in Advanced. | None — automatic. |
| `simulator.js` button lookups | `playLog.elm.find('.x-button')` → `$('.x-button')`. | Re-apply if you patched these lines. |
| Cache versions | `?v=` bumped on `simulator.css`, `simulator.js`, `main.js`. | Bump again if you re-edit. |

If you track this repo with git, a normal pull/merge of the
`feature/basic-advanced-view-toggle` branch is all you need. The steps below are
for **forks that hand-merge** or builds assembled from copied files.

---

## Step 1 — Replace / merge the changed files

Pull these files (or merge their diffs):

- `index.html`
- `js/main.js`
- `js/simulator.js`
- `css/simulator.css`
- `css/simulator.scss`

If your fork has diverged, apply the pieces below by hand.

### 1a. `index.html`

Add the top bar as the first child of `.play-board-container`:

```html
<div class="play-board-container">
    <div class="board-mode-bar">
        <!-- Record/replay controls relocate here in Basic mode -->
        <div id="board-top-controls" class="board-top-controls"></div>
        <button type="button" id="board-mode-toggle" class="board-mode-toggle" aria-pressed="false">
            <i class="fas fa-eye" aria-hidden="true"></i>
            <span class="board-mode-label">Basic</span>
        </button>
    </div>
    ...
```

Bump the cache-bust versions (use higher numbers than whatever your build has):

```html
<link rel="stylesheet" href="css/simulator.css?v=1.1.4" />
<script src="js/simulator.js?v=1.1.5"></script>
<script src="js/main.js?v=1.1.5"></script>
```

### 1b. `js/main.js`

Add the `boardModeEvent()` function and call it from `$(document).ready`. It
needs: a `.board-mode-bar` with `#board-top-controls` + `#board-mode-toggle`,
a `.play-board-container`, the record/replay buttons, and a `.log-message-header`
as their Advanced home. See `js/main.js` for the full function.

### 1c. `js/simulator.js`

Three edits:

1. **Globalise the record/replay button lookups.** Replace every
   `playLog.elm.find('.<button>')` with `$('.<button>')` for these five classes:
   `start-record-button`, `stop-record-button`, `replay-button`,
   `pause-button`, `resume-button`. (Each is unique on the page, so the global
   selector is safe and keeps working after the buttons are relocated.)

2. **Add the card-info helpers** to the `Board` class:
   `getRandomVisibleCard()`, `showCardInfo(card)`, `showRandomCardInfo()`.

3. **Hook `Card.declare()`** to call `board.showCardInfo(this)` when
   `.play-board-container` is *not* in `.basic-mode`, and call
   `board.showRandomCardInfo()` right after `board.importState(state)` in the
   `board.json` loader.

### 1d. CSS — `css/simulator.css` **and** `css/simulator.scss`

`simulator.css` is generated from `simulator.scss`; **edit both** (or edit the
SCSS and rebuild). The new rules:

- `.holder-slot { width: var(--slot-size, 102px); }` (was `width: 102px`)
- The `.board-mode-bar`, `.board-mode-toggle`, and `.board-top-controls` styling.
- `.play-board-container.basic-mode .play-board-side { display: none; }`
- The Basic-mode board expansion (`--slot-size` clamp) inside the
  `@media (min-width: 1200px)` block.

---

## Step 2 — Verify

Open `index.html` and confirm:

1. **Opens in Basic.** Side columns hidden; board is wide; `Start Record` and
   `Play` sit on top next to the **Basic** toggle.
2. **Toggle works.** Click **Advanced** → card-overview (left) and log (right)
   reappear; controls move back into the log header; board returns to normal
   size.
3. **Reload always returns to Basic** (even after switching to Advanced).
4. **Mobile** (narrow window): toggle reads **Show Logs / Hide Logs**; the
   board is not scaled up.
5. **Card info pre-fills** on load (visible once in Advanced); declaring a
   card's effect in Advanced shows that card in the left panel.
6. No console errors.

---

## Rollback

Because nothing in the engine or save format changed, rollback is just reverting
the five files and the `?v=` bumps. Existing `board.json` exports remain valid
against the previous version.

---

## Compatibility notes

- **Old `localStorage` key.** A previous iteration stored a `BoardViewMode`
  value; the final release no longer reads or writes it. Any stale value is
  harmless and can be ignored (or deleted).
- **Custom themes.** New colors are inline in `simulator.scss`
  (`#011d38`, `#0a4d2c`, `#fe696a`, `greenyellow`). Move them to
  `css/theme.css` variables if your fork centralises colors there.
- **Second board / multiplayer.** The globalised button selectors assume a
  single board. Re-scope them if you render more than one.
