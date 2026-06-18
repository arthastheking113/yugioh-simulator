# Core Classes

All four classes live in `js/simulator.js`. Load order within the file: `PlayLog` → `Card` → `Collection` → `Board`.

## Class Responsibilities

| Class | Line | Role |
|-------|------|------|
| `PlayLog` | ~6 | Records every action; replays them in order |
| `Card` | ~560 | Single card: owns its state, DOM element, and animations |
| `Collection` | ~1287 | Stacked zone manager (deck, GY, banish, extra deck) |
| `Board` | ~1472 | Central controller: holds all cards, orchestrates everything |

## Ownership Model

```
Board (singleton)
  ├── items: Card[]          ← every card in play
  ├── deck: Collection       ← main deck
  ├── exdeck: Collection     ← extra deck
  ├── graveyard: Collection
  ├── banish: Collection
  └── playlog: PlayLog
```

`Board` is the single source of truth. `Card` and `Collection` operate on slices of `Board.items[]`.

## The Three Invariants

1. **Log every action.** Any function changing game state must call `board.playlog.writelog(step)`. Missing logs desync replay.
2. **Mutate via `board.updateItem()`.** Never set `card.property` directly. `updateItem` triggers `card.updateHtml()` to sync the DOM.
3. **Keep export/import in sync.** New card properties must appear in both `exportState()` and `importState()`.

## Board as Controller

`Board` does not contain business logic for individual cards — it delegates:
- Card moves → `Card.moveTo()`
- Collection display → `Collection.drawOnBoard()`
- Phase change → `Board.setPhase()` (owns this directly, involves logging + animation)
- Xyz overlay → `Board.overlayCard()` (owns this; too complex to delegate)

## Collection vs. Individual Zone

| Zone type | Positions | Display |
|-----------|-----------|---------|
| **Collection** | `deck`, `exdeck`, `graveyard`, `banish` | Stack — only top card visible + count badge |
| **Individual** | `summon` (1–5), `st` (1–5), `fz` | Each card in its own numbered slot |

`collection_order` means different things per zone type:
- In individual zones → the slot's `data-order` token (`ss1`–`ss5`, `exss1`/`exss2`, `st1`–`st5`, `fz1`)
- In collection zones → sequential index for ordering
