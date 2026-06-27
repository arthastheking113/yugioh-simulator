# Combo Simulator — Portable Knowledge Pack

> A self-contained context bundle that teaches an AI agent **how the YuGi-Oh! Combo Simulator works**, so it can reason about the project even without access to its source code.

## Who this is for

This pack is written for **an AI agent in a *different* repository**. That agent has **no access** to the simulator's source files. Everything it needs to understand the project is embedded here — class designs, data shapes, control flow, the combo/replay model, real method signatures, and the project's hard rules ("invariants").

If you are that agent: read this README first, then read the numbered files in order. Treat the numbered files as your ground truth about the simulator. Cross-references between files in this pack are valid (the pack travels together); references to paths like `js/simulator.js` point at the **source project**, not your current repo.

## Where to put this pack in your repo (recommended)

This pack is self-contained, so it can live anywhere — but for an AI agent to actually *find and use* it, put it where agent tooling looks:

- **Recommended:** `docs/combo-simulator/` (or `docs/knowledge/combo-simulator/`). Keep the whole folder together; the files cross-link by relative path. Treat it as read-only reference, version-controlled with your project.
- **If your agent uses a context/RAG index** (e.g. a docs ingestion step), also add this folder to whatever the indexer scans, or drop a one-line pointer to it from your repo's main `README`/`CONTRIBUTING`.
- **If you use Claude Code / Cursor-style agents**, surface it from your repo's agent instructions file (e.g. `CLAUDE.md`, `.cursorrules`, or an `AGENTS.md`) with a line like: *"For how the combo simulator works and how to score combos, read `docs/combo-simulator/README.md` first."* Agents read that entry file but won't discover a buried folder on their own.
- **Avoid** renaming or splitting individual files — the relative links (`04-combo-and-card-movement.md`, etc.) and the numeric reading order would break.

Keep the folder name stable; if you must rename it, update the pointer in your agent instructions, not the internal links.

## What the project is (one paragraph)

The **YuGi-Oh! Simulator** is a standalone, browser-based tool for **recording, replaying, and sharing card combos**. There is **no build step** (open `index.html` in a browser) and **no rules enforcement** — it is a *visual* tool. A "combo" here is a recorded sequence of card movements and state changes that can be replayed step-by-step and exported/imported as JSON. The whole architecture exists to make that recording → replay → share loop reliable.

## How to read this pack

Read top to bottom for a full mental model; jump to a file to answer a specific question.

| # | File | Read it to understand… |
|---|------|------------------------|
| — | [README.md](README.md) | What this pack is, the high-value corrections, reading order |
| 01 | [01-project-overview.md](01-project-overview.md) | What the app is, who uses it, tech stack, file map, non-goals |
| 02 | [02-architecture-and-core-classes.md](02-architecture-and-core-classes.md) | The 4 core classes, ownership model, the 3 invariants, key APIs |
| 03 | [03-card-model.md](03-card-model.md) | Every card property, positions/zones, CSS state classes, UUIDs |
| 04 | [04-combo-and-card-movement.md](04-combo-and-card-movement.md) | **The heart: what a combo is, `moveTo` lifecycle, every transition** |
| 05 | [05-replay-and-playlog.md](05-replay-and-playlog.md) | How recording/replay works, step shape, export/import format |
| 06 | [06-game-mechanics.md](06-game-mechanics.md) | Phases, card actions (flip/switch/target/declare/reveal), draw, shuffle |
| 07 | [07-xyz-overlay-deep-dive.md](07-xyz-overlay-deep-dive.md) | The most complex mechanic — Xyz materials, with corrected flag semantics |
| 08 | [08-ui-rendering-and-menus.md](08-ui-rendering-and-menus.md) | DOM structure, CSS layers, animations, themes, context menus, the read-only combo graph |
| 09 | [09-glossary.md](09-glossary.md) | YuGi-Oh! terms + simulator-internal terms for a reader with no domain knowledge |
| 10 | [10-ai-agent-playbook.md](10-ai-agent-playbook.md) | Task recipes, debugging guides, how to answer questions about the codebase |
| 11 | [11-combo-power-analysis.md](11-combo-power-analysis.md) | **How to score "how powerful" a combo is from its exported JSON** |

## Source of truth & provenance

This pack was assembled from the simulator project's own documentation (an internal architecture guide, agent role guides, and design references) **and verified against the actual source** in `js/simulator.js` (~2,854 lines). Where the prose docs and the code disagreed, **the code wins** and the correction is called out explicitly.

Line numbers (e.g. `simulator.js:699`) are accurate as of the snapshot used to build this pack but will drift as the project changes. Use them as hints, not addresses.

## High-value corrections (read these even if you read nothing else)

These are points where intuition — or the project's own older prose — is misleading. They are the most common source of bugs and wrong answers.

1. **The Xyz overlay flags are counter-intuitive and were documented backwards in some places.** In the *actual* code:
   - `isOverlap === true` → the card **is a material** sitting *underneath* an Xyz monster.
   - `isOverlay === true` → the card **is the Xyz monster on top** that *carries* materials.
   - Both kinds of card carry an `overlap_order`. The Xyz monster gets the **highest** value (`max + 1`); materials get `1, 2, 3 …`.
   - Full detail: [07-xyz-overlay-deep-dive.md](07-xyz-overlay-deep-dive.md).

2. **`ygoUUID()` is not a standard UUID v4.** Its template is the literal string `'xyxy-xxyy-0510-xyyy-xxxx'` (note the hard-coded `0510` segment). Don't assume RFC-4122 formatting.

3. **The logging entry point is `board.writelog(action, id, data, oldData)`** (a method on `Board`), which delegates to `playlog.addStep(...)`. Older prose says `playlog.writelog(step)` — same intent, different real signature.

4. **Actions are only *recorded* between "Start Record" and "Stop Record."** `addStep` pushes to `steps[]` only when `isStarted` is true (the `startRecord` action flips it on). During replay (`isRePlaying`), logging is suppressed to avoid infinite loops.

5. **A step's `data` is not always an object.** For `update-phase` it is a phase string; for `chat` it is the message string. `isLastStep`/`nextStep` are **computed at replay time**, not stored on the step.

6. **`switchState` resets to `attack` on every move *except* moving to `summon`.** `foldState` is force-flipped to `normal` **only** when a card leaves `banish`.

7. **Cards have per-direction permission flags** (`canMoveHand`, `canMoveSummon`, `canMoveExDeck`, `canMoveDeck`, `canMoveST`, `canMoveBanish`, `canMoveGraveyard`, all default `true`) plus type gates (`isSpell` for the field zone). `canMoveTo()` checks these and whether a target slot is free.

8. **The real DOM/CSS class names differ from older prose.** The card element is **`.simulator-card`** (not `.card-item`); state classes are the **bare values** — `.normal`/`.fold`, `.attack`/`.defense`, `.hand`/`.summon`/… and literal type flags `.isMonster`/`.isSpell`/`.isTrap`/`.isST`; the Xyz classes are `.overlap` (material) / `.overlay` (monster). There are **no** `.card-item`, `.fold-state-*`, `.switch-state-*`, `.position-*`, `.is-*`, `.card-targeted`, or `.card-declared` classes. The layout has no `.game-container`/`.top-row`/`.field-row`/`#field-zone`. Verified detail: [08-ui-rendering-and-menus.md](08-ui-rendering-and-menus.md).

9. **`collection_order` is a slot *token* in individual zones, not `1`–`5`.** For `summon`/`st`/`fz` it holds the slot's `data-order` string: `ss1`–`ss5`, `exss1`/`exss2` (extra monster zones), `st1`–`st5`, `fz1`. It is only numeric in the collection zones (deck/exdeck/graveyard/banish), where new tops get `previousTop + 2`.

> **Provenance note:** items 8–9 were found by reconciling this pack against the actual `index.html`/`css`/`js`. The existing **code is correct and unchanged** — only the documentation was corrected to match it.

10. **The per-card menu opens on *hover* (not right-click) and is appended *inside* the hovered card.** Because a menu click doesn't fire mouse-leave, the action handler **detaches the `#cardMenu` dialog back to `<body>` before running the action** — otherwise sending the card to the graveyard drags the menu along and it keeps reappearing on that card. (Recent fix; see [08-ui-rendering-and-menus.md](08-ui-rendering-and-menus.md).)

11. **Cancelling a pending Xyz-overlay selection must clear *both* `overlay-highlight` and `waiting-overlay`.** `setWaitingOverlay(null)` removes both, and any non-overlay menu action cancels the overlay-select UI; clearing only the dashed `overlay-highlight` used to leave the slot armed (cursor + clickable). (Recent fix.)

12. **`moveTo` runs `appendToBoard()` twice (once synchronously, once in its ~405ms deferred animation finish), and startup builds the board twice (`new Board(state.items)` then `importState`).** The constructor's opening-hand `deckToHand(5)` schedules deferred `appendToBoard()` calls that fire *after* `importState` rebuilds the board, re-injecting phantom hand cards that resolve to the rebuilt **deck** card on hover (wrong context menu). Fixed by guarding `appendToBoard()` with `if (board.getItemById(card.uuid) !== card) return false;` so a stale card from a discarded build can't mutate the live DOM. (Recent fix.)

> Items 10–12 reflect **code fixes** made after the pack's first version (in `card_menu.js` and `simulator.js`), not just doc corrections.

## The three invariants (the project's non-negotiable rules)

Every contributor — human or AI — must preserve these. They recur throughout the pack:

1. **Log every state change.** Any function that mutates game state must record a step via `board.writelog(...)`. A missing log desyncs replay.
2. **Mutate through `board.updateItem(uuid, key, value)`.** Never assign `card.property = x` directly; `updateItem` re-renders the DOM to match.
3. **Keep export & import in sync.** A new card property must be added to **both** `exportState()` and `importState()`, or shared/replayed states silently lose it.
