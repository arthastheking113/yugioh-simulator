# 03 — Card Model

A `Card` (defined at `simulator.js:560`) is the atomic unit. Everything the simulator does is ultimately a change to a card's properties, recorded as a step.

## Full property reference

| Property | Type | Values | Meaning |
|----------|------|--------|---------|
| `cardId` | Number | e.g. `48130397` | Card database ID (which printed card this is) |
| `uuid` | String | see UUID note | Unique **instance** ID — distinguishes two copies of the same card |
| `name` | String | card name | Display name; also used to build the art fallback path |
| `position` | String | see Positions | Current zone the card lives in |
| `foldState` | String | `normal` \| `fold` | Face-up (`normal`) vs face-down (`fold`) |
| `switchState` | String | `attack` \| `defense` | Battle position; `defense` is rotated 90° |
| `collection_order` | Number **or** String | e.g. `7` or `"ss3"` | **Numeric** stack index in collection zones; **string slot token** in individual zones (see note) |
| `order` | Number | | Secondary ordering value used during shuffle/restore |
| `isMonster` | Boolean | | Card is a monster |
| `isSpell` | Boolean | | Card is a spell |
| `isTrap` | Boolean | | Card is a trap |
| `isST` | Boolean | | Card is a spell **or** trap (`isSpell || isTrap`) |
| `isExtra` | Boolean | | Belongs to the extra deck (Fusion/Synchro/Xyz/Link) |
| `imageURL` | String | URL or `''` | Card art source; if empty, a fallback path is used |
| `description` | String | card text | Shown in the hover info panel |
| `isOverlap` | Boolean | | **The card IS an Xyz material** (sits beneath a monster) — see warning below |
| `isOverlay` | Boolean | | **The card IS the Xyz monster on top** that carries materials — see warning below |
| `overlap_order` | Number | `0,1,2,3…` | Stacking index within an Xyz pile (materials `1..N`, monster `max+1`) |
| `canMoveHand` | Boolean | default `true` | May move to hand |
| `canMoveSummon` | Boolean | default `true` | May move to a monster zone |
| `canMoveExDeck` | Boolean | default `true` | May move to/from the extra deck |
| `canMoveDeck` | Boolean | default `true` | May move to the deck |
| `canMoveST` | Boolean | default `true` | May move to a spell/trap zone |
| `canMoveBanish` | Boolean | default `true` | May move to banish |
| `canMoveGraveyard` | Boolean | default `true` | May move to graveyard |

> ⚠️ **Overlay flag warning.** The names are unintuitive and were documented backwards in some of the project's older prose. The code is authoritative:
> - **`isOverlap === true` ⇒ this card is a MATERIAL** (the card *overlapped underneath*).
> - **`isOverlay === true` ⇒ this card is the XYZ MONSTER on top** (the card *overlaid on top*).
> - A solo monster with no materials has **both false**.
>
> Full mechanics: [07-xyz-overlay-deep-dive.md](07-xyz-overlay-deep-dive.md).

### Card type flags

A card sets **exactly one** of `isMonster` / `isSpell` / `isTrap`. `isST` is the convenience union `isSpell || isTrap`. `isExtra` is true for extra-deck monster types (Fusion, Synchro, Xyz, Link).

## Positions (the `position` field)

`position` is the single field that determines which zone a card is in.

| Value | Zone | Slots | Display style |
|-------|------|-------|---------------|
| `hand` | Player hand | Unlimited | Flex row at the bottom; every card face-up to the owner |
| `deck` | Main deck | Unlimited | **Collection** — top card + count badge |
| `exdeck` | Extra deck | Unlimited | **Collection** — top card + count badge |
| `summon` | Monster zones | 5 (slots `1`–`5`) | **Individual** — one card per numbered slot |
| `st` | Spell/Trap zones | 5 (slots `1`–`5`) | **Individual** — one card per numbered slot |
| `fz` | Field zone | 1 | **Individual** — single slot |
| `graveyard` | Graveyard | Unlimited | **Collection** — top card + count badge |
| `banish` | Banished zone | Unlimited | **Collection** — top card + count badge |

- **Individual zones** (`summon`, `st`, `fz`): each card occupies a specific DOM slot. `collection_order` holds that slot's **`data-order` token string** — verified from both code and sample data. In the shipped `index.html` the tokens are:
  - `ss1`–`ss5` — the five main monster zones
  - `exss1`, `exss2` — the two extra monster zones (where extra-deck monsters land)
  - `st1`–`st5` — the five spell/trap zones
  - `fz1` — the field zone
  The card is matched to its slot by `getCardSlot()` via `.card-slot[data-order="<collection_order>"]`. (The integer `1` is only a constructor default/fallback; placed cards carry the token.)
- **Collection zones** (`deck`, `exdeck`, `graveyard`, `banish`): cards stack; only the top is shown. `collection_order` is a **numeric** index; new tops are assigned `previousTop + 2` (gaps are intentional), bottoms get `0`.

## The card DOM element & its state classes (verified)

`Card.drawHtml()` builds this element (NOT a `.card-item` — that name does not exist in the code):

```html
<div id="card-{uuid}" class="simulator-card card-id-{uuid}" data-id="{uuid}" title="{name}">
  <span class="card-name">{name}</span>
  <div class="card-imgs">
    <img class="card-img back-image"  src="asset/back_card.png">
    <img class="card-img front-image" src="{imageURL or fallback}">
  </div>
</div>
```

State is reflected by adding classes whose names are the **bare property values** (verified in `drawHtml`/`updateHtml` and in `css/simulator.css`):

```
.simulator-card                    always present (base class)
.card-id-{uuid}                    per-instance id class

# foldState value, added directly  →  .normal | .fold        (NOT .fold-state-*)
# switchState value, added directly →  .attack | .defense     (NOT .switch-state-*; .defense rotates 90°)
# position value, added directly    →  .hand .deck .exdeck .summon .st .fz .graveyard .banish  (NOT .position-*)

# type flags, added as literal class names when the flag == 1:
.isMonster | .isSpell | .isTrap | .isST            (NOT .is-monster etc.)

# Xyz flags, mapped in updateHtml:
.overlap                           this card IS a material (isOverlap === true)
.overlay                           this card IS the Xyz monster carrying materials (isOverlay === true)
```

`updateHtml()` first strips `normal fold attack defense deck exdeck graveyard banish summon st hand fz overlay overlap`, then re-adds the current ones — so the class list always matches the live state.

There are **no** `.card-targeted` / `.card-declared` classes (those were invented by older docs). Target/declare/reveal/phase use **Animate.css** classes (`animate__animated animate__zoomIn`, `animate__fadeOut`, …) injected by `doAnimation()`, plus a sound from the hidden `.game-resource` `<audio>` elements.

**Slots:** the containing slot element is a `.holder-slot.card-slot`; it gains `.overlay-slot` when it holds an Xyz pile (more than one card sharing the slot's `collection_order`). Zone-specific slot classes are `.summon-slot`, `.summonex-slot`, `.st-slot`, `.fz-slot`, and the four collection slots carry `.card-collection-slot` (see [08-ui-rendering-and-menus.md](08-ui-rendering-and-menus.md)).

## UUID generation (verified — NOT standard UUID v4)

Each card instance gets a `uuid` from `ygoUUID()` (`simulator.js:2673`). It is **not** an RFC-4122 UUID. The real template string is:

```
'xyxy-xxyy-0510-xyyy-xxxx'
```

Each `x`/`y` is replaced with a hex digit seeded from `Date.now()` and (when available) `performance.now()` microseconds; the literal `0510` segment is kept verbatim (a project signature). A card whose `uuid` is `0` (the constructor default for "unset") is assigned a fresh `uuid` in the `Card` constructor and again, defensively, when added via `board.addItem()`.

**Why it matters:** the `uuid` is how steps reference cards (`step.uuid`), how `board.getCard(uuid)` finds a card, and how export/import re-link cards. Two physical copies of the same printed card (`cardId`) have **different** `uuid`s.

## Image loading

1. If `card.imageURL` is set, use it (production art is served from the CDN `ygovietnamcdn.azureedge.net`).
2. Otherwise fall back to a local path derived from the card — the renderer builds `imgPath + 'card/' + name + '.jpeg'` (and the project also references `asset/card/{cardId}.jpeg` as a fallback convention).
3. The card back is `asset/back_card.png`, shown whenever `foldState === 'fold'`.
