/**
 * ComboGraph — a vanilla-JS visualizer for a recorded combo.
 *
 * It consumes the "combo json" produced by `board.exportState()` and renders an
 * ordered, rotatable flow graph of the combo: card images as nodes, arrows with
 * the action performed, destination-zone labels, and a "+" for combined material.
 *
 * Read-only: it never mutates board state, card properties, or export/import.
 * Replay sync is driven by three global hooks that simulator.js calls:
 *   window.comboGraphOnReplayStart()  — replay begins
 *   window.comboGraphOnStep(index)    — step `index` is now playing
 *   window.comboGraphOnReplayEnd()    — replay stops/completes
 */
'use strict';

class ComboGraph {
    constructor(container, options) {
        this.container = (container instanceof Element)
            ? container
            : document.querySelector(container);
        this.options = Object.assign({
            imgPath: 'asset/',
            cardPath: 'asset/card/',
            backImage: 'asset/back_card.png',
        }, options || {});
        this.orientation = 'horizontal';
        this.events = [];        // renderable graph events, in flow order
        this.nodeElements = [];  // DOM node per event (index-aligned with this.events)
        this.stepToNode = {};    // original step index -> event index (for replay sync)
        this.cardById = {};      // uuid -> { name, imageURL }
    }

    // Human-readable zone names.
    static get ZONE_NAMES() {
        return {
            hand: 'Hand',
            deck: 'Deck',
            exdeck: 'Extra Deck',
            summon: 'Monster Zone',
            st: 'Spell / Trap',
            fz: 'Field Zone',
            graveyard: 'Graveyard',
            banish: 'Banished',
        };
    }

    zoneName(pos) {
        return ComboGraph.ZONE_NAMES[pos] || pos || '';
    }

    // Verb describing a move, derived from source/destination zones.
    describeMove(from, to) {
        switch (to) {
            case 'hand': return from === 'deck' ? 'Draw' : 'Add to Hand';
            case 'summon': return from === 'exdeck' ? 'Special Summon' : 'Summon';
            case 'graveyard': return 'Send to GY';
            case 'banish': return 'Banish';
            case 'deck': return 'Return to Deck';
            case 'st': return 'Set / Activate';
            case 'fz': return 'Activate Field Spell';
            case 'exdeck': return 'Return to Extra Deck';
            default: return 'Move';
        }
    }

    // ---- Build -----------------------------------------------------------

    build(state) {
        this.state = state || {};
        this.cardById = {};
        var playLog = this.state.playLogData || {};

        this._indexCards(playLog.initItems);
        this._indexCards(this.state.items);

        var steps = this._asArray(playLog.steps);
        this.events = [];
        this.stepToNode = {};

        steps.forEach((step, i) => {
            var ev = this._stepToEvent(step);
            if (!ev) return;
            ev.stepIndex = i;
            this.stepToNode[i] = this.events.length;
            this.events.push(ev);
        });
        return this;
    }

    _asArray(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === 'object') return Object.values(value);
        return [];
    }

    _indexCards(source) {
        this._asArray(source).forEach((card) => {
            if (card && card.uuid && !this.cardById[card.uuid]) {
                this.cardById[card.uuid] = card;
            }
        });
    }

    // Map a recorded step to a renderable event, or null to skip it.
    _stepToEvent(step) {
        if (!step) return null;
        var action = step.action || 'update';
        var data = step.data;
        var oldData = step.oldData || {};
        var card = this.cardById[step.uuid];

        switch (action) {
            case 'update': {
                if (!data || typeof data !== 'object') return null;
                var from = oldData.position;
                var to = data.position;
                if (to && from && to !== from) {
                    return {
                        type: 'move',
                        card: card,
                        from: from,
                        to: to,
                        actionLabel: this.describeMove(from, to),
                        fromZone: this.zoneName(from),
                        toZone: this.zoneName(to),
                    };
                }
                if ('foldState' in data && data.foldState !== oldData.foldState) {
                    return {
                        type: 'badge',
                        card: card,
                        badge: data.foldState === 'fold' ? 'Set Face-down' : 'Flip Face-up',
                    };
                }
                if ('switchState' in data && data.switchState !== oldData.switchState) {
                    return {
                        type: 'badge',
                        card: card,
                        badge: data.switchState === 'defense' ? 'To Defense' : 'To Attack',
                    };
                }
                return null;
            }
            case 'overlay':
                return { type: 'overlay', card: card, actionLabel: 'Xyz Material' };
            case 'detach':
                return { type: 'badge', card: card, badge: 'Detach Material' };
            case 'target':
                return { type: 'badge', card: card, badge: 'Target' };
            case 'declare':
                return { type: 'badge', card: card, badge: 'Declare' };
            case 'reveal':
                return { type: 'badge', card: card, badge: 'Reveal' };
            case 'update-phase':
                return { type: 'phase', phase: (typeof data === 'string' ? data : '') };
            default:
                // startRecord / stopRecord / chat / shuffle / active-skill: not flow steps.
                return null;
        }
    }

    // ---- Render ----------------------------------------------------------

    render() {
        if (!this.container) return this;
        this.container.innerHTML = '';
        this.container.classList.remove('horizontal', 'vertical');
        this.container.classList.add(this.orientation);
        this.nodeElements = [];

        if (!this.events.length) {
            this.container.appendChild(this._emptyState());
            return this;
        }

        this.events.forEach((ev, i) => {
            // A "+" connector groups consecutive overlay (Xyz material) events;
            // every other transition is a flow arrow showing sequence order.
            if (i > 0) {
                var combine = ev.type === 'overlay' && this.events[i - 1].type === 'overlay';
                this.container.appendChild(this._connector(combine));
            }
            var node = this._renderEvent(ev, i);
            this.nodeElements.push(node);
            this.container.appendChild(node);
        });
        return this;
    }

    _emptyState() {
        var el = document.createElement('div');
        el.className = 'cg-empty';
        el.textContent = 'No combo recorded yet. Use Start Record → play your combo → Stop, then click "Generate Combo Graph".';
        return el;
    }

    _connector(isCombine) {
        var el = document.createElement('div');
        el.className = 'cg-connector' + (isCombine ? ' cg-combine' : '');
        el.textContent = isCombine ? '+' : '';
        return el;
    }

    _renderEvent(ev, index) {
        var node = document.createElement('div');
        node.className = 'cg-step cg-' + ev.type;
        node.dataset.eventIndex = index;

        if (ev.type === 'phase') {
            node.classList.add('cg-phase');
            node.appendChild(this._span('cg-phase-label', (ev.phase || 'phase').toUpperCase()));
            return node;
        }

        node.appendChild(this._stepNumber(index));
        node.appendChild(this._cardEl(ev.card));

        if (ev.type === 'move') {
            var edge = document.createElement('div');
            edge.className = 'cg-edge';
            edge.appendChild(this._span('cg-arrow', '→'));
            edge.appendChild(this._span('cg-action', ev.actionLabel));
            edge.appendChild(this._span('cg-from', ev.fromZone + ' → ' + ev.toZone));
            node.appendChild(edge);
            node.appendChild(this._zoneChip(ev.to, ev.toZone));
        } else if (ev.type === 'overlay') {
            node.appendChild(this._span('cg-badge cg-badge-overlay', ev.actionLabel));
        } else if (ev.type === 'badge') {
            node.appendChild(this._span('cg-badge', ev.badge));
        }
        return node;
    }

    _stepNumber(index) {
        return this._span('cg-step-num', String(index + 1));
    }

    _cardEl(card) {
        var wrap = document.createElement('div');
        wrap.className = 'cg-card';
        var name = (card && card.name) || 'Unknown';

        var img = document.createElement('img');
        img.className = 'cg-card-img';
        img.alt = name;
        img.title = name;
        img.src = this._cardImage(card);
        var back = this.options.backImage;
        img.addEventListener('error', function onErr() {
            img.removeEventListener('error', onErr);
            img.src = back;
        });
        wrap.appendChild(img);
        wrap.appendChild(this._span('cg-card-name', name));
        return wrap;
    }

    _cardImage(card) {
        if (!card) return this.options.backImage;
        if (card.imageURL) return card.imageURL;
        if (card.name) return this.options.cardPath + card.name + '.jpeg';
        return this.options.backImage;
    }

    _zoneChip(pos, label) {
        var chip = this._span('cg-zone cg-zone-' + (pos || 'default'), label);
        return chip;
    }

    _span(className, text) {
        var el = document.createElement('span');
        el.className = className;
        el.textContent = text;
        return el;
    }

    // ---- Orientation -----------------------------------------------------

    setOrientation(orientation) {
        this.orientation = orientation === 'vertical' ? 'vertical' : 'horizontal';
        if (this.container) {
            this.container.classList.remove('horizontal', 'vertical');
            this.container.classList.add(this.orientation);
        }
        return this;
    }

    toggleOrientation() {
        return this.setOrientation(this.orientation === 'horizontal' ? 'vertical' : 'horizontal');
    }

    // ---- Replay sync -----------------------------------------------------

    highlightStep(stepIndex) {
        var eventIndex = this.stepToNode[stepIndex];
        if (eventIndex === undefined) return; // skipped step: keep current highlight
        this.clearHighlight();
        var node = this.nodeElements[eventIndex];
        if (!node) return;
        node.classList.add('cg-active');
        this._scrollActiveIntoContainer(node);
    }

    // Keep the active node visible *within the graph's own scroll box* during
    // replay, WITHOUT scrolling the main page to the graph (the user scrolls to
    // it themselves). `node.scrollIntoView()` would scroll every ancestor incl.
    // the document, so instead we only adjust this.container's own scroll —
    // centering the active node along whichever axis the container scrolls.
    // (Assigning scrollLeft/scrollTop directly, not scrollTo({behavior:'smooth'}),
    // because programmatic smooth scrolling is unreliable across environments.)
    _scrollActiveIntoContainer(node) {
        var c = this.container;
        if (!c) return;
        var nodeRect = node.getBoundingClientRect();
        var contRect = c.getBoundingClientRect();
        c.scrollLeft += (nodeRect.left - contRect.left) - (c.clientWidth - nodeRect.width) / 2;
        c.scrollTop += (nodeRect.top - contRect.top) - (c.clientHeight - nodeRect.height) / 2;
    }

    clearHighlight() {
        this.nodeElements.forEach((node) => node.classList.remove('cg-active'));
    }
}

// ---- Singleton wiring ----------------------------------------------------

(function () {
    var graph = null;

    function getGraph() {
        if (!graph) {
            var container = document.getElementById('combo-graph');
            if (!container) return null;
            graph = new ComboGraph(container);
        }
        return graph;
    }

    function generate() {
        var g = getGraph();
        if (!g) return;
        if (typeof board === 'undefined' || !board || typeof board.exportState !== 'function') {
            g.events = [];
            g.render();
            return;
        }
        g.build(board.exportState()).render();
    }

    document.addEventListener('DOMContentLoaded', function () {
        var rotateBtn = document.getElementById('rotate-graph');
        if (rotateBtn) {
            rotateBtn.addEventListener('click', function () {
                var g = getGraph();
                if (g) g.toggleOrientation();
            });
        }
    });

    // Public refresh: (re)build the graph from the current board state.
    // Called on Stop Record and whenever board JSON is loaded.
    window.comboGraphRefresh = generate;

    // Hooks invoked from simulator.js during replay.
    window.comboGraphOnReplayStart = function () {
        var g = getGraph();
        if (!g) return;
        generate();        // rebuild so node indices match the steps about to play
        g.clearHighlight();
    };
    window.comboGraphOnStep = function (stepIndex) {
        var g = getGraph();
        if (g) g.highlightStep(stepIndex);
    };
    window.comboGraphOnReplayEnd = function () {
        var g = getGraph();
        if (g) g.clearHighlight();
    };
})();
