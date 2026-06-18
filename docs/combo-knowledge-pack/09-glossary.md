# 09 — Glossary

For a reader (human or model) who knows neither YuGi-Oh! nor this codebase. Two sections: **game terms** (real-world card-game vocabulary the simulator imitates) and **simulator-internal terms** (names that mean something specific in this project's code).

## Game terms (YuGi-Oh!)

| Term | Meaning |
|------|---------|
| **Combo** | A chain of card effects played in sequence, each enabling the next. In this project, the recorded list of steps that reproduces such a sequence. |
| **Deck** | The main library a player draws from (40–60 cards). Face-down stack. |
| **Extra Deck** | A separate pile (≤15 cards) of special monsters (Fusion/Synchro/Xyz/Link) summoned via specific procedures, not drawn. |
| **Hand** | Cards held by the player, hidden from the opponent. |
| **Monster Zone** | Up to 5 slots where monsters are placed. Called `summon` in this code. |
| **Spell/Trap Zone** | Up to 5 slots for spell and trap cards. Called `st` in this code. |
| **Field Zone** | A single slot for a "Field Spell." Called `fz`. |
| **Graveyard (GY)** | The discard pile; destroyed/used cards go here, often reusable by effects. |
| **Banish** | A removed-from-play zone, generally harder to recover from than the GY. |
| **Normal Summon** | Placing a monster from hand to a monster zone (limited per turn in real rules; unlimited here). |
| **Special Summon** | Summoning by a card effect rather than the normal summon. |
| **Set** | Placing a card face-down (a monster in defense face-down, or a spell/trap face-down). |
| **Attack / Defense position** | A monster's battle stance. Defense is shown rotated 90°. |
| **Flip** | Turning a face-down card face-up (or vice versa). |
| **Face-up / Face-down** | Whether a card's front is visible. `foldState = normal` vs `fold`. |
| **Target** | To designate a card as the object of an effect. Here, a flash animation. |
| **Declare** | To announce activating an effect. Here, an animation + log entry. |
| **Reveal** | To show a hidden card to the opponent. Here, an animation. |
| **Mill** | To send cards from the top of the deck directly to the GY. |
| **Bounce** | To return a card to the hand. |
| **Xyz Monster** | A special monster summoned by stacking other monsters ("materials") beneath it. |
| **Xyz Material / Overlay Unit** | A card placed beneath an Xyz monster; "detached" to pay for effects. |
| **Phase** | A segment of a turn (Draw, Standby, Main 1, Battle, Main 2, End). Cosmetic here. |
| **Skill** | A Speed-Duel-format player ability, separate from cards. |

## Simulator-internal terms

| Term | Meaning in this codebase |
|------|--------------------------|
| **Board** | The singleton controller class; the single source of truth holding all cards. |
| **Card** | A single card instance (data + DOM element + animations). |
| **Collection** | A manager/view over a *stacked* zone (`deck`, `exdeck`, `graveyard`, `banish`). |
| **PlayLog** | The recorder/replayer; owns `steps[]` and the replay loop. |
| **Step** | One recorded action: `{ action, uuid, data, oldData, message }`. |
| **`position`** | The card field naming its zone: `hand/deck/exdeck/summon/st/fz/graveyard/banish`. |
| **`collection_order`** | Slot **token** (`ss1`–`ss5`, `exss1`/`exss2`, `st1`–`st5`, `fz1`) in individual zones; **numeric** stack index in collection zones. |
| **Individual zone** | `summon`, `st`, `fz` — one card per numbered DOM slot. |
| **Collection zone** | `deck`, `exdeck`, `graveyard`, `banish` — stacked; only the top card shows + a count badge. |
| **`foldState`** | `normal` (face-up) or `fold` (face-down). |
| **`switchState`** | `attack` (upright) or `defense` (rotated 90°). |
| **`isOverlap`** | `true` ⇒ this card **is a material** (beneath an Xyz monster). (Counter-intuitive — see [07](07-xyz-overlay-deep-dive.md).) |
| **`isOverlay`** | `true` ⇒ this card **is the Xyz monster** carrying materials (on top). |
| **`overlap_order`** | Stacking index in an Xyz pile: materials `1..N`, monster `max+1`. |
| **`uuid`** | A per-instance ID from `ygoUUID()` (template `'xyxy-xxyy-0510-xyyy-xxxx'`, not RFC-4122). |
| **`cardId`** | The printed-card database ID (two copies share it but have different `uuid`s). |
| **`moveTo`** | The universal "move a card to a zone" method; nearly every combo step is one. |
| **`writelog` / `addStep`** | The logging entry point (`board.writelog(action, id, data, oldData)` → `playlog.addStep`). |
| **`updateItem`** | The sanctioned mutator: `board.updateItem(uuid, key, value)` — changes data **and** re-renders. |
| **`exportState` / `importState`** | Serialize / restore the full board + PlayLog as object or JSON. |
| **`initItems`** | The board snapshot captured when recording starts; replay restores from it. |
| **`fireEvent`** | `moveTo` flag; `false` during replay to suppress re-logging and let the replay handler manage redraws. |
| **`drawOnBoard`** | A Collection's "re-render the stack visual" method. |
| **`.overlay-slot`** | CSS class on a summon slot that currently holds an Xyz pile. |
| **`getItemsByCollectionOrder(order)`** | Returns every card sharing a `collection_order` — how an Xyz monster and its materials are grouped. |
| **Phase keys** | `dp` Draw, `sp` Standby, `m1` Main 1, `bp` Battle, `m2` Main 2, `ep` End. |
