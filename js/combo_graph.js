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

    // ---- Image export ----------------------------------------------------
    //
    // Renders the combo to an offscreen <canvas> with the Canvas 2D API (no DOM
    // capture, no third-party library) and downloads it as a PNG. We draw from
    // the structured `this.events` model rather than scraping the rendered DOM,
    // so the output is fully under our control and works for either orientation
    // regardless of what is currently on screen.
    //
    // Card art lives on a cross-origin CDN, so every image is (re)loaded with
    // crossOrigin='anonymous' AND a cache-busting query before being drawn. The
    // cache-buster forces a fresh CORS request (the CDN sends an unconditional
    // `access-control-allow-origin: *`), which guarantees an untainted canvas so
    // toBlob()/toDataURL() can succeed even if the same art was previously cached
    // from a non-CORS request elsewhere in the app.

    static get EXPORT_PALETTE() {
        // Mirrors the default-theme fallbacks in css/combo_graph.css so the export
        // looks like the on-screen graph without depending on CSS-variable resolution.
        return {
            page: '#f3f5f9',     // .combo-graph background
            tile: '#ffffff',
            dark: '#373f50',
            gray: '#7d879c',
            primary: '#fe696a',
            accent: '#4e54c8',
            badgeBg: '#eef0f6',
            phaseBg: '#fea569',
            imgBg: '#d9dce5',
            zones: {
                hand: '#69b3fe', deck: '#373f50', exdeck: '#6f42c1',
                summon: '#f34770', st: '#198754', fz: '#20c997',
                graveyard: '#7d879c', banish: '#fd7e14', default: '#7d879c',
            },
        };
    }

    // Public: export the current combo as a PNG. `orientation` is 'horizontal'
    // or 'vertical' (defaults to the graph's current orientation). Returns a
    // Promise that resolves with the download filename, or rejects on failure.
    exportImage(orientation) {
        var layout = orientation === 'vertical' ? 'vertical'
            : orientation === 'horizontal' ? 'horizontal'
                : this.orientation;
        var events = this.events || [];
        if (!events.length) return Promise.reject(new Error('No combo to export.'));
        var self = this;
        return this._preloadExportImages(events)
            .then(function (imgMap) { return self._drawExportCanvas(events, layout, imgMap); })
            .then(function (canvas) { return self._downloadCanvas(canvas, layout, events.length); });
    }

    _preloadExportImages(events) {
        var self = this;
        var urls = [];
        events.forEach(function (ev) {
            if (ev.type === 'phase') return;
            var u = self._cardImage(ev.card);
            if (urls.indexOf(u) < 0) urls.push(u);
        });
        var bust = '_cgexp=' + (new Date()).getTime();   // fresh CORS fetch → no taint from a non-CORS cache hit
        var map = {};
        return Promise.all(urls.map(function (u) {
            return self._loadExportImage(u, bust).then(function (img) { map[u] = img; });
        })).then(function () { return map; });
    }

    // Load one image CORS-enabled (cache-busted); on failure fall back to the
    // local back image; resolve null if even that fails or it times out. Never rejects.
    _loadExportImage(url, bust) {
        var back = this.options.backImage;
        function load(src, allowFallback) {
            return new Promise(function (resolve) {
                var settled = false;
                var img = new Image();
                img.crossOrigin = 'anonymous';
                var timer = setTimeout(function () {
                    if (settled) return; settled = true; resolve(null);
                }, 10000);
                img.onload = function () {
                    if (settled) return; settled = true; clearTimeout(timer); resolve(img);
                };
                img.onerror = function () {
                    if (settled) return; settled = true; clearTimeout(timer);
                    if (allowFallback) { load(back, false).then(resolve); }
                    else { resolve(null); }
                };
                var sep = src.indexOf('?') < 0 ? '?' : '&';
                img.src = bust ? src + sep + bust : src;
            });
        }
        return load(url, url !== back);
    }

    // Word-wrap `text` to at most `maxLines` lines no wider than `maxWidth`,
    // adding an ellipsis when content (or a single long word) overflows.
    _wrapText(ctx, text, maxWidth, maxLines) {
        text = String(text == null ? '' : text);
        var words = text.split(/\s+/).filter(Boolean);
        if (!words.length) return [''];
        var lines = [];
        var cur = '';
        for (var i = 0; i < words.length; i++) {
            var test = cur ? cur + ' ' + words[i] : words[i];
            if (ctx.measureText(test).width <= maxWidth || !cur) {
                cur = test;
            } else {
                lines.push(cur);
                cur = words[i];
                if (lines.length === maxLines) { cur = ''; break; }
            }
        }
        if (cur && lines.length < maxLines) lines.push(cur);
        if (lines.length === maxLines) {
            var consumed = lines.join(' ').split(/\s+/).filter(Boolean).length;
            if (consumed < words.length) {
                var last = lines[maxLines - 1];
                while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
                lines[maxLines - 1] = last + '…';
            }
        }
        for (var j = 0; j < lines.length; j++) {
            if (ctx.measureText(lines[j]).width > maxWidth) {
                var s = lines[j];
                while (s && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1);
                lines[j] = s + '…';
            }
        }
        return lines.length ? lines : [''];
    }

    _drawExportCanvas(events, layout, imgMap) {
        var self = this;
        var P = ComboGraph.EXPORT_PALETTE;
        var FONT = '"Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');

        // Layout constants (logical px, before the DPI scale below).
        var TILE_W = 152, IMG_W = 84, IMG_H = 120;
        var CONN = 32, OUTER = 24, HEADER = 34, FOOTER = 22;
        var PAD_TOP = 16, PAD_BOT = 14, GAP = 6, NAME_LH = 14;
        var ACTION_H = 16, FROMTO_H = 13, CHIP_H = 22;

        // Measure + wrap card names (<=2 lines) and find the tallest stack.
        ctx.font = '600 11px ' + FONT;
        var maxNameLines = 1;
        events.forEach(function (ev) {
            if (ev.type === 'phase') { ev._lines = [String(ev.phase || 'phase').toUpperCase()]; return; }
            var name = (ev.card && ev.card.name) || 'Unknown';
            ev._lines = self._wrapText(ctx, name, TILE_W - 20, 2);
            if (ev._lines.length > maxNameLines) maxNameLines = ev._lines.length;
        });

        // Uniform tile height = the tallest content stack (a 'move' tile).
        var ROW_H = PAD_TOP + IMG_H + GAP + (maxNameLines * NAME_LH) + GAP
            + ACTION_H + 2 + FROMTO_H + 4 + CHIP_H + PAD_BOT;

        var n = events.length;
        var W, H;
        if (layout === 'vertical') {
            W = OUTER * 2 + TILE_W;
            H = OUTER * 2 + HEADER + (n * ROW_H) + ((n - 1) * CONN) + FOOTER;
        } else {
            W = OUTER * 2 + (n * TILE_W) + ((n - 1) * CONN);
            H = OUTER * 2 + HEADER + ROW_H + FOOTER;
        }
        var contentX = OUTER;
        var contentY = OUTER + HEADER;

        // Render at 2x for crisp output, but cap so we never exceed the browser
        // canvas dimension limit on very long combos.
        var MAX_PX = 16384;
        var scale = Math.min(2, MAX_PX / W, MAX_PX / H);
        if (!isFinite(scale) || scale <= 0) scale = 1;
        canvas.width = Math.ceil(W * scale);
        canvas.height = Math.ceil(H * scale);
        ctx.scale(scale, scale);

        // ---- drawing helpers (closures over ctx) ----
        function roundRect(x, y, w, h, r) {
            r = Math.min(r, w / 2, h / 2);
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }
        function truncate(text, maxW) {
            text = String(text == null ? '' : text);
            if (ctx.measureText(text).width <= maxW) return text;
            while (text && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
            return text + '…';
        }
        function pill(text, cx, cy, bg, fg, maxW) {
            var t = truncate(text, maxW - 16);
            var w = ctx.measureText(t).width + 16;
            roundRect(cx - w / 2, cy - CHIP_H / 2, w, CHIP_H, CHIP_H / 2);
            ctx.fillStyle = bg; ctx.fill();
            ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(t, cx, cy + 0.5);
        }
        function cardImage(img, dx, dy) {
            ctx.save();
            roundRect(dx, dy, IMG_W, IMG_H, 4);
            ctx.clip();
            if (img && img.naturalWidth) {
                var s = Math.max(IMG_W / img.naturalWidth, IMG_H / img.naturalHeight); // object-fit: cover
                var sw = IMG_W / s, sh = IMG_H / s;
                ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, dx, dy, IMG_W, IMG_H);
            } else {
                ctx.fillStyle = P.imgBg; ctx.fillRect(dx, dy, IMG_W, IMG_H);
            }
            ctx.restore();
            roundRect(dx, dy, IMG_W, IMG_H, 4);
            ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.stroke();
        }
        function stepNum(num, x, y) {
            var r = 11, cx = x + r, cy = y + r;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = P.dark; ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = '700 11px ' + FONT;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(String(num), cx, cy + 0.5);
        }
        function drawTile(ev, i, x, y) {
            var center = x + TILE_W / 2;
            if (ev.type === 'phase') {
                pill((ev._lines && ev._lines[0]) || 'PHASE', center, y + ROW_H / 2, P.phaseBg, '#fff', TILE_W - 8);
                return;
            }
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.10)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetY = 2;
            roundRect(x, y, TILE_W, ROW_H, 8);
            ctx.fillStyle = P.tile; ctx.fill();
            ctx.restore();

            stepNum(i + 1, x + 4, y + 4);
            cardImage(imgMap[self._cardImage(ev.card)], center - IMG_W / 2, y + PAD_TOP);

            ctx.fillStyle = P.dark; ctx.font = '600 11px ' + FONT;
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            var ny = y + PAD_TOP + IMG_H + GAP;
            (ev._lines || []).forEach(function (ln) { ctx.fillText(ln, center, ny); ny += NAME_LH; });
            var below = ny + GAP;

            if (ev.type === 'move') {
                ctx.fillStyle = P.dark; ctx.font = '700 12px ' + FONT;
                ctx.fillText(truncate('→ ' + ev.actionLabel, TILE_W - 12), center, below);
                ctx.fillStyle = P.gray; ctx.font = '400 10px ' + FONT;
                ctx.fillText(truncate(ev.fromZone + ' → ' + ev.toZone, TILE_W - 12), center, below + ACTION_H + 2);
                var chipColor = P.zones[ev.to] || P.zones.default;
                pill(ev.toZone, center, below + ACTION_H + 2 + FROMTO_H + 4 + CHIP_H / 2, chipColor, '#fff', TILE_W - 12);
            } else if (ev.type === 'overlay') {
                pill(ev.actionLabel || 'Xyz Material', center, below + CHIP_H / 2, P.accent, '#fff', TILE_W - 12);
            } else if (ev.type === 'badge') {
                pill(ev.badge || '', center, below + CHIP_H / 2, P.badgeBg, P.dark, TILE_W - 12);
            }
        }

        // ---- background + header + footer ----
        ctx.fillStyle = P.page; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = P.dark; ctx.font = '700 16px ' + FONT;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('Combo Graph — ' + n + ' step' + (n === 1 ? '' : 's'), OUTER, OUTER + HEADER / 2);
        ctx.fillStyle = P.gray; ctx.font = '400 11px ' + FONT;
        ctx.fillText('YuGi-Oh! Simulator', OUTER, H - OUTER - FOOTER / 2);

        // ---- tiles + connectors ----
        var pos = layout === 'vertical' ? contentY : contentX;
        events.forEach(function (ev, i) {
            if (layout === 'vertical') drawTile(ev, i, contentX, pos);
            else drawTile(ev, i, pos, contentY);
            pos += (layout === 'vertical' ? ROW_H : TILE_W);
            if (i < n - 1) {
                var combine = ev.type === 'overlay' && events[i + 1].type === 'overlay';
                ctx.fillStyle = combine ? P.accent : P.gray;
                ctx.font = (combine ? '700 22px ' : '400 20px ') + FONT;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                if (layout === 'vertical') ctx.fillText(combine ? '+' : '↓', contentX + TILE_W / 2, pos + CONN / 2);
                else ctx.fillText(combine ? '+' : '→', pos + CONN / 2, contentY + ROW_H / 2);
                pos += CONN;
            }
        });
        return Promise.resolve(canvas);
    }

    _downloadCanvas(canvas, layout, stepCount) {
        return new Promise(function (resolve, reject) {
            var filename = 'combo-graph-' + layout + '-' + stepCount + 'steps.png';
            var settled = false;
            var triggerDownload = function (href, revoke) {
                if (settled) return; settled = true;
                var a = document.createElement('a');
                a.href = href; a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                if (revoke) setTimeout(function () { URL.revokeObjectURL(href); }, 1500);
                resolve(filename);
            };
            // Synchronous fallback. toDataURL either returns a string or throws
            // synchronously (e.g. a tainted canvas), so it can never hang.
            var fallbackDataUrl = function () {
                if (settled) return;
                try { triggerDownload(canvas.toDataURL('image/png'), false); }
                catch (e) { if (!settled) { settled = true; reject(e); } }
            };
            // toBlob is async; if a non-spec browser/OOM ever fails to invoke the
            // callback, the "Generating…" modal would hang forever — so guard it
            // with a timeout that falls back to the (synchronous) data-URL path.
            var timer = setTimeout(fallbackDataUrl, 12000);
            try {
                if (canvas.toBlob) {
                    canvas.toBlob(function (blob) {
                        clearTimeout(timer);
                        if (settled) return;
                        if (!blob) { fallbackDataUrl(); return; }   // encode failed → try data URL
                        triggerDownload(URL.createObjectURL(blob), true);
                    }, 'image/png');
                } else {
                    clearTimeout(timer);
                    fallbackDataUrl();
                }
            } catch (e) {
                clearTimeout(timer);
                if (!settled) { settled = true; reject(e); }
            }
        });
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

    // Ask for a layout (Horizontal / Vertical), then render + download the PNG.
    function exportGraph() {
        var g = getGraph();
        var hasSwal = typeof Swal !== 'undefined';
        if (!g || !g.events || !g.events.length) {
            if (hasSwal) {
                Swal.fire({
                    icon: 'info', title: 'Nothing to export',
                    text: 'Record or load a combo first.',
                    timer: 1800, showConfirmButton: false,
                });
            }
            return;
        }
        var run = function (orientation) {
            if (hasSwal) {
                Swal.fire({
                    title: 'Generating image…',
                    allowOutsideClick: false,
                    didOpen: function () { Swal.showLoading(); },
                });
            }
            g.exportImage(orientation).then(function (filename) {
                if (hasSwal) {
                    Swal.fire({
                        toast: true, position: 'top-end', icon: 'success',
                        title: 'Saved ' + filename, showConfirmButton: false, timer: 2200,
                    });
                }
            }).catch(function (err) {
                if (hasSwal) {
                    Swal.fire({
                        icon: 'error', title: 'Export failed',
                        text: (err && err.message) || 'Could not generate the image.',
                    });
                }
            });
        };
        if (!hasSwal) { run(g.orientation); return; }
        Swal.fire({
            title: 'Export Combo Graph',
            text: 'Choose a layout for the exported image.',
            icon: 'question',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: 'Horizontal',
            denyButtonText: 'Vertical',
            cancelButtonText: 'Cancel',
        }).then(function (result) {
            if (result.isConfirmed) run('horizontal');
            else if (result.isDenied) run('vertical');
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var rotateBtn = document.getElementById('rotate-graph');
        if (rotateBtn) {
            rotateBtn.addEventListener('click', function () {
                var g = getGraph();
                if (g) g.toggleOrientation();
            });
        }
        var exportBtn = document.getElementById('export-graph');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportGraph);
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
