# YuGi-Oh! Simulator — Claude Code Guide

## What This Project Is

A standalone, browser-based YuGi-Oh! card game simulator. No build step — open `index.html` directly in a browser. Used by players to record and share combos, practice card interactions, and create tournament demos.

**Key constraint:** No game rules are enforced. This is a visual tool only.

## Quick File Reference

| File | What it does |
|------|-------------|
| `js/simulator.js` | Core classes: `PlayLog`, `Card`, `Collection`, `Board` (2,854 lines) |
| `js/card_menu.js` | Context menus and card actions (930 lines) |
| `js/main.js` | Initializes Board, wires DOM events (65 lines) |
| `js/Function.js` | Utility functions: clipboard, localStorage, SweetAlert toasts |
| `js/theme.js` | Runtime theme switching (1,754 lines) |
| `js/example.js` | Sample deck JSON (30,644 lines — do not edit manually) |
| `css/simulator.css` | Game board and card layout |
| `css/theme.css` | CSS color variables — all colors go here |
| `index.html` | Board layout and script load order |

Full architecture: see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## The Four Core Classes (in simulator.js)

```
PlayLog   → records/replays every action
Card      → a single card: state, DOM element, animations
Collection → stacked zones (deck, graveyard, banish, extra deck)
Board     → central controller: holds all cards, delegates to Card + Collection
```

## Card Positions

`hand` | `deck` | `exdeck` | `summon` (slots 1–5) | `st` (slots 1–5) | `fz` | `graveyard` | `banish`

## The Three Laws (Don't Break These)

1. **Log every action.** Any game state change must call `board.playlog.writelog(step)` or replay will desync.
2. **Mutate through `board.updateItem()`.** Never directly set `card.property`. This syncs the DOM.
3. **Keep export/import in sync.** New card properties must be added to both `exportState()` and `importState()`.

## Agile Team Agents

This project has custom agents for each team role. Invoke them with `/agent <name>`:

| Agent | Role | Use When |
|-------|------|----------|
| `product-owner` | Requirements & priorities | Defining features, writing user stories |
| `frontend-developer` | UI, CSS, animations | Visual changes, layout, themes |
| `game-engine-developer` | Game logic & classes | simulator.js, card_menu.js, replay, state |
| `qa-engineer` | Testing & validation | Bug reports, test checklists, regression |
| `scrum-master` | Process & coordination | Sprint planning, task breakdown, blockers |

Agent files live in `.claude/agents/`.

## Common Tasks

**Add a new card action:**
1. Add menu item in `card_menu.js` → `CardMenu.renderMenu()`
2. Add handler in action switch
3. Add the action method to `Card` class in `simulator.js`
4. Call `board.playlog.writelog()` inside the handler
5. Handle the action type in `PlayLog.playStep()` for replay

**Add a new card property:**
1. Add to `Card` constructor defaults
2. Add to `Board.exportState()` serialization
3. Add to `Board.importState()` restoration
4. Update CSS class in `Card.updateHtml()` if it has a visual state

**Change card visual:**
1. Check `Card.drawHtml()` for initial render
2. Check `Card.updateHtml()` for state-change updates
3. CSS classes live in `css/simulator.css`

**Debug a replay bug:**
- Check `PlayLog.writelog()` is called for the action
- Check `PlayLog.playStep()` handles that action's type
- Check `board.exportState()` captures the relevant card state in `initItems`

## Script Load Order (matters!)

```
jQuery → jQuery UI → Touch Punch → card_menu.js → simulator.js → main.js → Function.js
```

## No Build Step

Edit files, reload browser. That's it. No npm, no webpack, no transpilation.
