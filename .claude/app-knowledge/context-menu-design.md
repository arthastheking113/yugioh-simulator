# Context Menu Design

## File

`js/card_menu.js` — Three classes: `MenuBase`, `CardMenu`, `CollectionMenu`

## How Menus Work

The card menu opens on **hover**, not right-click. Each card's jQuery `hover` handler (`Card.cardEvents`, `simulator.js`) does, on `mouseenter`:

```javascript
_board.cardMenu.setCard(_card);   // updateMenu(): show/hide items by position + foldState + condition
_board.cardMenu.show();           // open the shared #cardMenu dialog
```

There is a single shared `#cardMenu` jQuery UI dialog. Its menu items are static HTML (built once in `CardMenu.drawHtml`); `updateMenu()` shows only the ids listed in `menuList[card.position]` (or `menuList['overlap']` for Xyz materials) and applies per-item `condition`/state filters. On `mouseleave` the dialog hides.

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

Overlay (material) cards have a **separate** context menu (`menuList['overlap']`) — they cannot be moved independently once attached. Their only action is Detach.

## Menu Lifecycle & Positioning (important)

On `show()`, the shared dialog is **appended *inside* the hovered card** (`appendTo: '#card-<uuid>'`) so it positions relative to that card. On `mouseleave` the dialog resets `appendTo` back to `body` and hides.

**Gotcha (fixed):** clicking a menu action closes the dialog but does **not** trigger `mouseleave`. If the action then moves the card to a collection (graveyard/banish/deck…), the menu — still parented to the card — travels with it and keeps reappearing. The action click handler therefore **detaches the menu back to `<body>` first thing**, before running the action:

```javascript
menu.element.dialog('close');
menu.element.dialog('widget').appendTo('body');     // physically move it out of the card
menu.element.dialog('option', 'appendTo', 'body');
```

## Overlay Selection & Cancellation

Clicking **Overlay** on a face-up monster calls `board.startDoOverlay(card)` → `selectOverlay()`, which marks each candidate summon slot with two classes:

- `.overlay-highlight` — the animated dashed border (visible "pick me" state)
- `.waiting-overlay` — the overlay cursor **and** the click target (`selectOverlayEvent` listens on `.waiting-overlay`)

`setWaitingOverlay({card, canBeOverlayCards})` stores the pending selection. To complete, the user clicks a highlighted slot; `board.overlayCard(uuid, order)` runs and the highlights clear.

**Cancellation:** the action click handler clears `setWaitingActions(null)` **and** `setWaitingOverlay(null)` at the top, so **any non-overlay menu action cancels a pending overlay**. `setWaitingOverlay(null)` must remove **both** classes (`overlay-highlight` *and* `waiting-overlay`) — removing only the highlight leaves the slot armed (cursor + clickable). Note: the board-wide click-to-cancel (`removeOverlayHighlight`) ignores clicks inside a `.ui-dialog`, so the menu handler's explicit clear is what cancels for menu clicks.

## Adding a New Menu Item

1. Add the `<a data-target="…" id="…">` to the static menu HTML in `CardMenu.drawHtml`
2. Register its id in the relevant position array in `menuList` (so `updateMenu` shows it for that position)
3. Set `data-target` to `"position,switchState,foldState"` for a move, or a custom action key for non-moves
4. Handle the action key in the click handler switch (or let the generic move path handle it)
5. Call the appropriate `card.*` or `board.*` method, and ensure `playlog.writelog()` runs (directly or via `card.moveTo`/`updateCardbyAction`)
