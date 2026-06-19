# App Overview

## What It Is

A standalone, browser-based YuGi-Oh! card game simulator. No server, no build step — open `index.html` in a browser and it runs.

**Core purpose:** Visual tool for recording combos, practicing card interactions, and creating tournament board demonstrations.

**Not in scope:** Game rule enforcement. Players can move any card anywhere.

## Live Deployments

- Vietnamese: https://simulator.ygovietnam.com/
- US: https://simulator.metaduelist.com/

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 |
| Styling | CSS3 + Bootstrap 5 (grid) + Animate.css 4.1.1 |
| Logic | Vanilla JavaScript + jQuery 3.2.1 + jQuery UI 1.12.1 |
| Mobile | jQuery UI Touch Punch (drag-drop on touch) |
| Icons | Font Awesome 5.10 + Iconify |
| Toasts | SweetAlert2 |
| Fonts | Google Fonts — Poppins |

## Key User Personas

| Persona | Primary Need |
|---------|-------------|
| Combo Creator | Reliable replay, minimal friction moving cards |
| Content Creator | Clean visuals, smooth animations, correct card images |
| Tournament Organizer | State export/import, polished look |

## Script Load Order (matters)

```
jQuery → jQuery UI → Touch Punch → card_menu.js → simulator.js → main.js → Function.js → combo_graph.js → theme.js
```

`card_menu.js` must load before `simulator.js` because `Board` references `CardMenu`. `combo_graph.js` loads after `simulator.js`/`main.js` (it reads the global `board` lazily, at click/hook time).

> **Cache-bust gotcha:** scripts/styles are versioned with `?v=N` query strings. When you edit a JS/CSS file, **bump its `?v=` in `index.html`** or the browser may serve a stale cached copy (the `Last-Modified` heuristic can skip revalidation).

## Local Preview

No build step. Open `index.html`, or serve the folder — `.claude/launch.json` defines a `static` server (`python -m http.server 8123`) used for previewing/verifying changes.

## File Roles at a Glance

| File | Role |
|------|------|
| `index.html` | Board HTML structure |
| `js/simulator.js` | Core: PlayLog, Card, Collection, Board |
| `js/card_menu.js` | Context menus + card actions |
| `js/main.js` | Board init + DOM event wiring |
| `js/Function.js` | Utilities: clipboard, localStorage, toasts |
| `js/combo_graph.js` | `ComboGraph` — visual flow graph of a recorded combo (read-only; see `combo-graph.md`) |
| `js/theme.js` | Runtime theme switching |
| `js/example.js` | Sample deck JSON (30k lines) |
| `css/simulator.css` | Card and board layout |
| `css/combo_graph.css` | Combo graph nodes, arrows, zone chips |
| `css/theme.css` | CSS color variables |
| `css/app.css` | Application chrome |
| `css/tournamentStyle.css` | Tournament mode styles |
