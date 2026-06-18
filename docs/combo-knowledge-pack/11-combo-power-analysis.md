# 11 — Analyzing Combo Power from a Combo JSON

This file describes how to take a **combo JSON** (the output of `board.exportState('json')`) and estimate **how powerful the combo is** — purely from the data, with an optional path to deeper analysis using an external card database.

## What "power" can and cannot mean here

The simulator stores **structure and sequence**, not **card semantics**. From the JSON alone you can measure *how much a combo does* — bodies produced, resources set up, cards spent, steps taken. You **cannot**, from the JSON alone, know *what those cards actually do* (whether a monster negates, whether a trap is a board-wipe). Two layers of analysis follow from this:

- **Layer 1 — Structural power (JSON only).** Quantity and shape of the end board and the resource flow. No card knowledge required. This is the focus of this file.
- **Layer 2 — Semantic power (JSON + external card DB).** Join each card's `cardId`/`name` to a card-effect database to classify negates, hand traps, archetypes, etc. Covered briefly at the end as an enrichment.

Always label your output as a **heuristic estimate**, not a verdict.

## The inputs you have (recap)

A combo JSON is the `exportState` object (see [05-replay-and-playlog.md](05-replay-and-playlog.md)):

```jsonc
{
  "items":        [ /* Card[] — the board AS IT IS NOW (the END state if exported at combo end) */ ],
  "currentPhase": "m1",
  "skill":        { "name": "", "activated": false },
  "playLogData": {
    "initItems": [ /* Card[] — board snapshot at record start (the START state) */ ],
    "steps":     [ /* Step[] — the ordered recorded actions */ ],
    "pointer": 0, "isStarted": false, "isRePlaying": false, "isPausing": false
  }
}
```

Three views drive the analysis:

| View | Where | Tells you |
|------|-------|-----------|
| **Start state** | `playLogData.initItems` (fallback: the `startRecord` step's `data.items`) | What the player began with (esp. starting hand). |
| **End state** | top-level `items` | The final board the combo produced. |
| **Timeline** | `playLogData.steps` | Every action in order — the "work" the combo did. |

Each `Card` in those arrays carries the fields from [03-card-model.md](03-card-model.md): `position`, `isMonster/isSpell/isTrap`, `isExtra`, `foldState`, `isOverlay/isOverlap`, `cardId`, `name`, etc. Each `step` is `{ action, uuid, data, oldData, message }`.

> Reminder on the overlay flags ([07](07-xyz-overlay-deep-dive.md)): a body on the field is a `summon` card that is **not** a material (`isOverlap !== true`). The Xyz monster on top (`isOverlay === true`) counts as **one** body; its materials do not count as separate bodies.

---

## Layer 1 — structural metrics (computable from JSON only)

### A. End-board presence
From top-level `items`:

| Metric | How to compute |
|--------|----------------|
| `endMonsters` | count of `items` with `position === 'summon'` and `isOverlap !== true` (bodies, materials excluded) |
| `bossMonsters` | of those, how many have `isExtra` truthy (extra-deck monsters — usually the payoff) |
| `setOrActiveST` | count of `items` with `position === 'st'` |
| `faceDownST` | of those, how many have `foldState === 'fold'` (set = likely interaction/disruption) |
| `fieldSpell` | `1` if any `items` has `position === 'fz'`, else `0` |

### B. Resource setup
| Metric | How to compute |
|--------|----------------|
| `graveyardResources` | count of `items` with `position === 'graveyard'` |
| `banishedCards` | count of `items` with `position === 'banish'` |
| `endHandSize` | count of `items` with `position === 'hand'` (cards left in hand) |

### C. The work done (from `steps`)
Filter `steps` to "engine" actions (exclude `chat`, `update-phase`, `startRecord`, `stopRecord`):

| Metric | How to compute |
|--------|----------------|
| `comboLength` | number of `update` steps that are **moves** (`data.position` present and `!== oldData.position`) plus `overlay`/`detach` steps |
| `specialSummons` | `update` move-steps with `data.position === 'summon'` and `oldData.position ∈ {deck, graveyard, banish, exdeck}` (clearly special). Add hand→summon beyond the first as *likely* special. |
| `extraDeckSummons` | move-steps with `oldData.position === 'exdeck'` and `data.position === 'summon'` |
| `searchesAndDraws` | move-steps with `oldData.position === 'deck'` and `data.position === 'hand'` (cards added to hand from deck) |
| `discardsAndCosts` | move-steps with `oldData.position === 'hand'` and `data.position ∈ {graveyard, banish}` (resources spent) |
| `overlayCount` | number of `overlay` steps (Xyz plays) |

### D. Going-in cost & efficiency
| Metric | How to compute |
|--------|----------------|
| `starterCount` | count of `initItems` with `position === 'hand'` (cards the combo started from) |
| `netCardAdvantage` | `(endMonsters + setOrActiveST + fieldSpell + endHandSize) − starterCount` (rough +N) |
| `boardPerStarter` | `(endMonsters + setOrActiveST) / max(starterCount, 1)` (does a lot from a little ⇒ strong) |

---

## A scoring model (heuristic, tunable)

Group the metrics into four interpretable categories, each scored, then combine. **The weights below are a starting point — tune them to taste; expose them so they can be changed.**

```text
BoardScore     = 6*bossMonsters + 3*(endMonsters - bossMonsters) + 2*fieldSpell
DisruptionScore= 4*faceDownST + 1*(setOrActiveST - faceDownST)        // Layer-2 enrich for real negate count
ResourceScore  = 1.5*graveyardResources + 1*searchesAndDraws + 2*max(netCardAdvantage, 0)
EfficiencyScore= 5*boardPerStarter - 1.5*starterCount + 1*specialSummons

RawPower = BoardScore + DisruptionScore + ResourceScore + EfficiencyScore
```

Normalize to a friendly 0–100 and a tier (cap is a tunable expectation of a "fully developed" board, e.g. `EXPECTED_MAX = 60`):

```text
PowerIndex = clamp(round(RawPower / EXPECTED_MAX * 100), 0, 100)

Tier:
  PowerIndex >= 80  → "Explosive"   (full, efficient end board)
  PowerIndex >= 60  → "Strong"
  PowerIndex >= 35  → "Fair"
  else              → "Weak / setup-only"
```

Report the **four category sub-scores alongside the index** — they explain *why* a combo scores the way it does (e.g. high Board but low Efficiency = "powerful but needs many cards").

### Why these signs
- **Boss monsters and set traps** are weighted highest: a finished board's strength is mostly "how many threats/answers does it present."
- **Fewer starters is better:** a 1-card combo that builds a full board is far stronger/more consistent than a 5-card one producing the same board — hence the `-starterCount` penalty and the `boardPerStarter` reward.
- **Resources** (GY setup, searches, net advantage) reward combos that also refuel.
- **Special-summon count** is a mild proxy for "this combo extends," but it is intentionally low-weighted because step count ≠ power.

---

## Worked example

A compact combo JSON (start: 2-card hand; end: one Xyz boss with 2 materials, one set trap, 3 cards in GY):

```jsonc
{
  "items": [
    { "uuid": "m1", "name": "Boss Xyz",   "position": "summon", "isMonster": 1, "isExtra": 1, "isOverlay": 1, "collection_order": "ss3" },
    { "uuid": "u1", "name": "Material A",  "position": "summon", "isMonster": 1, "isOverlap": 1, "overlap_order": 1, "collection_order": "ss3" },
    { "uuid": "u2", "name": "Material B",  "position": "summon", "isMonster": 1, "isOverlap": 1, "overlap_order": 2, "collection_order": "ss3" },
    { "uuid": "t1", "name": "Set Trap",    "position": "st",     "isTrap": 1, "foldState": "fold", "collection_order": "st1" },
    { "uuid": "g1", "name": "Used Spell",  "position": "graveyard" },
    { "uuid": "g2", "name": "Cost Monster","position": "graveyard" },
    { "uuid": "g3", "name": "Milled Card", "position": "graveyard" }
  ],
  "playLogData": {
    "initItems": [
      { "uuid": "a", "name": "Starter",  "position": "hand" },
      { "uuid": "b", "name": "Extender", "position": "hand" }
    ],
    "steps": [ /* … the recorded update/overlay steps … */ ]
  }
}
```

Layer-1 metrics:

```text
endMonsters        = 1     (m1; materials u1/u2 excluded)
bossMonsters       = 1     (m1 has isExtra)
setOrActiveST      = 1     faceDownST = 1
fieldSpell         = 0
graveyardResources = 3
endHandSize        = 0
starterCount       = 2
searchesAndDraws   = (depends on steps; assume 1)
specialSummons     = (assume 2)
netCardAdvantage   = (1 + 1 + 0 + 0) − 2 = 0
boardPerStarter    = (1 + 1) / 2 = 1.0
```

Scores (default weights):

```text
BoardScore      = 6*1 + 3*0 + 2*0            = 6
DisruptionScore = 4*1 + 1*0                  = 4
ResourceScore   = 1.5*3 + 1*1 + 2*0          = 5.5
EfficiencyScore = 5*1.0 − 1.5*2 + 1*2        = 4
RawPower        = 6 + 4 + 5.5 + 4            = 19.5
PowerIndex      = round(19.5 / 60 * 100)     = 33  → "Weak / setup-only"
```

Interpretation to report: *"A single Xyz boss + one set trap off a 2-card start, with light GY setup. Solid but not explosive — one threat and one interaction; doesn't refuel (net 0 cards). Power Index ≈ 33 (Fair/low)."* The sub-scores show the board itself is fine; the low overall is driven by it being a small, single-threat board.

---

## Reference algorithm (pseudo-code)

```javascript
function analyzeComboPower(json, weights = DEFAULTS) {
  const state   = typeof json === 'string' ? JSON.parse(json) : json;
  const end     = state.items || [];
  const start   = (state.playLogData?.initItems?.length
                    ? state.playLogData.initItems
                    : firstStartRecordItems(state)) || [];
  const steps   = state.playLogData?.steps || [];

  const at  = (arr, pos) => arr.filter(c => c.position === pos);
  const bodies = at(end, 'summon').filter(c => c.isOverlap !== 1 && c.isOverlap !== true);

  const m = {
    endMonsters:        bodies.length,
    bossMonsters:       bodies.filter(c => c.isExtra).length,
    setOrActiveST:      at(end, 'st').length,
    faceDownST:         at(end, 'st').filter(c => c.foldState === 'fold').length,
    fieldSpell:         at(end, 'fz').length ? 1 : 0,
    graveyardResources: at(end, 'graveyard').length,
    endHandSize:        at(end, 'hand').length,
    starterCount:       at(start, 'hand').length,
  };

  const moves = steps.filter(s => s.action === 'update'
      && s.data && s.oldData && s.data.position && s.data.position !== s.oldData.position);
  const fromTo = (from, to) => moves.filter(s => s.oldData.position === from && s.data.position === to);

  m.searchesAndDraws = fromTo('deck', 'hand').length;
  m.extraDeckSummons = fromTo('exdeck', 'summon').length;
  m.specialSummons   = moves.filter(s => s.data.position === 'summon'
      && ['deck','graveyard','banish','exdeck'].includes(s.oldData.position)).length;
  m.discardsAndCosts = moves.filter(s => s.oldData.position === 'hand'
      && ['graveyard','banish'].includes(s.data.position)).length;
  m.overlayCount     = steps.filter(s => s.action === 'overlay').length;
  m.comboLength      = moves.length + m.overlayCount
                       + steps.filter(s => s.action === 'detach').length;

  m.netCardAdvantage = (m.endMonsters + m.setOrActiveST + m.fieldSpell + m.endHandSize) - m.starterCount;
  m.boardPerStarter  = (m.endMonsters + m.setOrActiveST) / Math.max(m.starterCount, 1);

  const board   = 6*m.bossMonsters + 3*(m.endMonsters - m.bossMonsters) + 2*m.fieldSpell;
  const disrupt = 4*m.faceDownST + 1*(m.setOrActiveST - m.faceDownST);
  const resource= 1.5*m.graveyardResources + 1*m.searchesAndDraws + 2*Math.max(m.netCardAdvantage, 0);
  const effic   = 5*m.boardPerStarter - 1.5*m.starterCount + 1*m.specialSummons;
  const raw     = board + disrupt + resource + effic;
  const index   = Math.max(0, Math.min(100, Math.round(raw / (weights.expectedMax || 60) * 100)));

  return { metrics: m, subScores: { board, disrupt, resource, effic }, raw, index, tier: tierOf(index) };
}
```

`firstStartRecordItems(state)` falls back to the snapshot carried by the first `startRecord` step when `initItems` is empty.

---

## Layer 2 — semantic power (JSON + external card database)

To judge *quality* (not just quantity), enrich each card via its `cardId`/`name` against a card-effect database — e.g. the public **YGOPRODeck** API (`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=<cardId>`), or a local copy of one. With that you can compute much stronger signals:

- **Interruptions / negates on board** — classify end-board monsters and set traps that negate (the single best predictor of board strength). Replace the crude `DisruptionScore` proxy with a real "number of interruptions."
- **Hand traps held** — monsters left in hand that work on the opponent's turn.
- **Archetype / engine vs. non-engine** — group by archetype to see how focused the combo is.
- **Card-quality weighting** — weight specific boss monsters by known power level.

**Caveats for an agent:** hitting an external API sends the deck's card IDs to a third party and may be rate-limited or unavailable — prefer a bundled local dataset, cache results, and tell the user before making network calls. Keep Layer-2 results clearly separated from Layer-1 so the structural estimate still works offline.

---

## How an agent should present a power analysis

1. Lead with the **Power Index + tier**, then the **four sub-scores** so the rating is explainable.
2. Give a one-paragraph plain-English read of the end board ("one extra-deck boss, one set trap, light GY setup, off a 2-card start").
3. State the **biggest lever**: e.g. "needs 2 starters — efficiency is the limiter" or "no refuel — net 0 cards."
4. **Always caveat** that this is a structural heuristic from the simulator data, and that true power needs card-effect knowledge (Layer 2).
5. If asked to compare combos, run the same function on each JSON and compare sub-scores, not just the single index.
