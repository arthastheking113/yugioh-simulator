# 01 — Project Overview

## What it is

A **standalone, browser-based YuGi-Oh! card game simulator**. There is no server and no build step — opening `index.html` in a browser runs the whole app. Its job is to be a faithful **visual surface** for moving cards between zones and **recording those moves as a replayable combo**.

## Core purpose

- **Record combos** — capture a sequence of card movements/state changes and play it back step-by-step.
- **Practice interactions** — move any card anywhere to rehearse a line of play.
- **Create tournament/coverage demos** — set up a board state and present it cleanly.
- **Share** — export the whole board + combo as JSON and import it elsewhere.

## What is explicitly NOT in scope

- **No game-rule enforcement.** The simulator does not check card legality, summon conditions, timing, costs, or turn structure. A player can move any card to any zone at any time. This is a deliberate design choice — it is a *demonstration tool*, not a rules engine.
- **No multiplayer netcode.** There is an opponent area in the layout, but it is visual only with no logic behind it.
- **No accounts/backend.** Persistence is via JSON export/import and browser `localStorage`.

> Mental model: think "a digital playmat with an undo-less tape recorder," not "a video game that knows the rules."

## Live deployments

- Vietnamese site: `https://simulator.ygovietnam.com/`
- US site: `https://simulator.metaduelist.com/`

It ships as a module embedded on `https://ygovietnam.com/` and `https://metaduelist.com/` to display combos.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 |
| Styling | CSS3 + Bootstrap 5 (grid only) + Animate.css 4.1.1 |
| Logic | Vanilla JavaScript + jQuery 3.2.1 + jQuery UI 1.12.1 |
| Mobile input | jQuery UI Touch Punch (drag-drop on touch devices) |
| Icons | Font Awesome 5.10 + Iconify |
| Toasts/dialogs | SweetAlert2 |
| Fonts | Google Fonts — Poppins |

No npm, no webpack, no transpilation, no minification step in development. Edit a file, reload the browser.

## Key user personas

The project optimizes for three users. Knowing them explains *why* the code prioritizes replay fidelity and smooth visuals over correctness checks.

| Persona | Primary need | Implication for the code |
|---------|--------------|--------------------------|
| **Combo Creator** | Reliable replay, low-friction card movement | Every action must be logged; moves must be quick |
| **Content Creator** | Clean visuals, smooth animation, correct card art | Animation system + image loading matter |
| **Tournament Organizer** | Export/import of board state, polished look | Serialization round-trip must be lossless |

## File map (the source project's layout)

```
yugioh-simulator/
├── index.html              ← Board HTML structure (~374 lines)
├── js/
│   ├── simulator.js        ← Core classes: PlayLog, Card, Collection, Board (~2,854 lines)
│   ├── card_menu.js        ← Context menus: MenuBase, CardMenu, CollectionMenu (~930 lines)
│   ├── main.js             ← DOM-ready + Board initialization (~65 lines)
│   ├── Function.js         ← Utilities: clipboard, localStorage, SweetAlert toasts (~449 lines)
│   ├── combo_graph.js      ← ComboGraph: read-only visual flow graph of a recorded combo
│   ├── theme.js            ← Runtime theme switching (~1,754 lines)
│   └── example.js          ← Sample deck data as JSON (~30,644 lines — generated, never hand-edited)
├── css/
│   ├── simulator.css       ← Game board + card layout
│   ├── combo_graph.css     ← Combo graph nodes, arrows, zone chips
│   ├── theme.css           ← CSS custom properties (all colors live here)
│   ├── app.css             ← Application chrome
│   └── tournamentStyle.css ← Tournament overlay styles
├── asset/                  ← back_card.png, coin/dice images, UI icons, card art fallback
└── sound/                  ← Phase + declare sound effects
```

### What each JS file is responsible for

| File | Responsibility |
|------|----------------|
| `index.html` | The board's DOM skeleton and the script load order |
| `js/simulator.js` | **The engine.** Four classes — `PlayLog`, `Card`, `Collection`, `Board` |
| `js/card_menu.js` | Hover-open per-card menus and the per-position action lists |
| `js/main.js` | Instantiates the singleton `Board`, wires DOM events |
| `js/Function.js` | Clipboard, `localStorage` helpers, toast notifications |
| `js/combo_graph.js` | `ComboGraph` — read-only visual flow graph of a recorded combo |
| `js/theme.js` | Runtime theme switching (writes CSS variables on `:root`) |
| `js/example.js` | A large sample deck data set (JSON). Not in the current script load order — see "Startup data load" below for what actually loads. |

## Script load order (this ordering is load-bearing)

`index.html` loads scripts in exactly this sequence (verified — `<head>` first, then end of `<body>`):

```
# in <head>:
1. jQuery 3.2.1
2. jQuery UI 1.12.1
3. jQuery UI Touch Punch      ← enables mobile drag-drop
   (also: iconify, SweetAlert2)

# at end of <body>:
4. card_menu.js               ← defines MenuBase, CardMenu, CollectionMenu
5. simulator.js               ← defines PlayLog, Card, Collection, Board
6. main.js                    ← instantiates Board, wires events
7. Function.js                ← clipboard / localStorage / toasts
8. combo_graph.js             ← ComboGraph: builds the combo flow graph (reads global `board` lazily)
9. theme.js                   ← runtime theme switching
10. removeBackDrop.js         ← small jQuery-UI dialog backdrop cleanup
```

## Startup data load

On `$(document).ready` (bottom of `simulator.js`), the app loads a **saved board state from a local `board.json`** (a full `board.exportState()` export — `items` + `playLogData`) and restores it with `board.importState(state)`. That re-creates the cards in their saved zones, restores phase/skill, and brings back the recorded combo (so it can be replayed and shown in the combo graph).

The original loader — fetch the sample deck from the live API (`$.getJSON('…/sample-simulator-deck.json')` → `parseDataFromOther` → `new Board`) — is **kept but commented out**, with a note on how to switch back. Key difference: the API path is a *deck* (built fresh via `parseDataFromOther`), whereas `board.json` is a *full state* (restored via `importState`). See [05-replay-and-playlog.md](05-replay-and-playlog.md) for the export/import format.

`card_menu.js` **must** load before `simulator.js` because `Board` references `CardMenu` during construction. Reordering these breaks initialization.

## Where to go next

- The class design and the project's hard rules → [02-architecture-and-core-classes.md](02-architecture-and-core-classes.md)
- The data a single card holds → [03-card-model.md](03-card-model.md)
- The combo model itself → [04-combo-and-card-movement.md](04-combo-and-card-movement.md)
