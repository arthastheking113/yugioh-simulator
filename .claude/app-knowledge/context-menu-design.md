# Context Menu Design

## File

`js/card_menu.js` — Three classes: `MenuBase`, `CardMenu`, `CollectionMenu`

## How Menus Work

Right-clicking (or long-press on mobile) a card calls `CardMenu.renderMenu(card)`. It generates an HTML dropdown based on `card.position` and `card.foldState`. The menu is appended to the DOM and positioned near the card.

Each menu item has a `data-target` attribute encoding the action:

```html
<a data-target="summon,attack,normal">SS ATK</a>
```

Parsed as: `[destination_position, switchState, foldState]`

The click handler splits this string and calls `card.moveTo(destination, ...)` with the decoded values.

## Actions by Position

### Hand
| Action | What it does |
|--------|-------------|
| Reveal | `card.reveal()` |
| Declare | `card.declare()` |
| Target | `card.target()` |
| To Deck (Top / Bottom) | `card.moveTo('deck', isTop, null)` |
| SS ATK | `card.moveTo('summon', false, slot)` + `card.attack()` |
| Set (monster) | `card.moveTo('summon', false, slot)` + `card.fold('fold')` + `card.defense()` |
| Activate (ST) | `card.moveTo('st', false, slot)` + `card.fold('normal')` |
| Set (ST) | `card.moveTo('st', false, slot)` + `card.fold('fold')` |

### Summon (face-up)
| Action | What it does |
|--------|-------------|
| Declare / Target | `card.declare()` / `card.target()` |
| Move | Prompts for new slot → `card.moveTo('summon', false, newSlot)` |
| Overlay | Prompts for target slot → `board.overlayCard(uuid, slot)` |
| Detach | `board.detachOverlay(uuid)` |
| ATK → DEF | `card.defense()` |
| DEF → ATK | `card.attack()` |
| To Hand | `card.moveTo('hand')` |
| To GY | `card.moveTo('graveyard')` |
| To Banish | `card.moveTo('banish')` |

### Spell/Trap Zone
| Action | What it does |
|--------|-------------|
| Declare | `card.declare()` |
| Move | `card.moveTo('st', false, newSlot)` |
| Flip (activate) | `card.fold('normal')` |
| Detach | `board.detachOverlay(uuid)` |

### Collection Dialogs (graveyard / banish / extra deck)

`CollectionMenu` shows a browsable list when the collection zone is clicked. Each card in the list has its own action buttons:

| Zone | Actions |
|------|---------|
| Graveyard | To Hand, To Summon, To Banish, Declare, Target |
| Banish | To Hand, To Summon, Declare, Target |
| Extra Deck | To Summon (SS), To Banish, Reveal |

## Condition System

Menu items have a `condition` field checked against card state. If `card[condition]` is falsy, the item is hidden. This drives context-sensitive menus without hard-coded branches per card.

## Xyz Material Menu

Overlay (material) cards have a **separate** context menu — they cannot be moved independently once attached. Their only action is Detach.

## Adding a New Menu Item

1. Add the item object to the relevant position's array in `CardMenu.renderMenu()`
2. Set `data-target` to `"position,switchState,foldState"` for a move, or a custom action key for non-moves
3. Add the action key to the click handler switch statement
4. Call the appropriate `card.*` or `board.*` method
5. Ensure `playlog.writelog()` is called inside the action handler
