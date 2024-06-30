'use strict';
class MenuBase {
    constructor(element, options) {
        this.element = element;
        this.options = $.extend({}, options);
        this.dialog = {};
        this.init();
        this.infoPanel = $('.lcard-information-container');
        this.breakpoint = 1200;
    }
    init() {
        this.defineMenu();
        this.drawHtml(this.options);
        this.createDialog();
        this.events();
    }
    drawHtml() {

    }
    createDialog() {
        var w = $('.st-slot').first().width();
        this.dialog = this.element.dialog({
            minWidth: 100,
            minHeight: 60,
            width: w,
            height: 'auto',
            modal: false,
            autoOpen: false,
            classes: {
                'ui-dialog-titlebar': 'hidden',
                'ui-dialog': 'ui-dialog-card-menu',
            },
            open: function (event, ui) { },
            // create: function (event, ui) {
            //     // $(this).siblings('.ui-dialog-titlebar').addClass('hidden');
            // },
            position: {
                my: "bottom center",
                at: "top center",
                of: '#playtest'
            },
            // hide: { effect: "explode", duration: 1000 },
            // show: { effect: "blind", duration: 50 },
        });
    }
    defineMenu() {
        // This is an abstract function
    }
    show() {
        this.beforeShow();
        this.dialog.dialog('open');
        this.afterShow();
    }
    beforeShow() {
        // This is an abstract function
    }
    afterShow() {
        // This is an abstract function
    }
    events() {
        // This is an abstract function
    }
    hide() {
        this.beforeHide();
        this.element.dialog('close');
        this.afterHide();
    }
    beforeHide() {
        // This is an abstract function

    }
    afterHide() {
        // This is an abstract function

    }
    isSmallScreen() {
        return ($(window).width() < this.breakpoint);
    }
    cardInformationsPopup() {
        if (this.isSmallScreen()) {
            var card = this.getCard();
            var board = card.getBoard();
            var boardElm = board.getBoardElm();
            boardElm.find('#lightbox-card-info').remove();
            var lightbox = $('<div></div>', {
                'id': 'lightbox-card-info',
                'class': 'lightbox-card-info',
            });

            // lightbox.append(
            //     `<div class="card-lightbox-bgr">
            //     </div>
            //     <div class="card-lightbox-inner">
            //         <div class="card-info">
            //             <img class="animate__animated" src="${card.imageURL}" width="200" data-width="481" data-height="701"  />
            //             <p name="card-descriptons" id="lb-card-descriptons" class="card-descriptons animate__animated" cols="30" rows="10">  ${card.description} </p>
            //             <a href="javascript:void(0)" class="lightbox-close">
            //                 <i class="fas fa-window-close"></i>
            //             </a>
            //         </div>
            //     </div>`,
            // );

            lightbox.append(
                `<div class="card-lightbox-bgr">
                </div>
                <div class="card-lightbox-inner">
                    <div class="card-info">
                        <img class="" src="${card.imageURL}" width="200" data-width="481" data-height="701"  />
                        <p name="card-descriptons" id="lb-card-descriptons" class="card-descriptons " cols="30" rows="10">  ${card.description} </p>
                        <a href="javascript:void(0)" class="lightbox-close">
                            <i class="fas fa-window-close"></i>
                        </a>
                    </div>
                </div>`,
            );
            lightbox.on('click', '.card-lightbox-bgr, .lightbox-close', function (e) {
                lightbox.fadeOut(300, function () {
                    lightbox.remove();
                });
            });
            boardElm.append(lightbox);
        }
    }
    sideCardInformations() {
        if (!this.isSmallScreen()) {
            // Draw the card infos by jQuery <div class="lcard-header"> <div class="lcard-image"> </div> </div> <div class="lcard-descriptons-cont"> <code name="lcard-descriptons" id="lcard-descriptons" class="lcard-descriptons" cols="30" rows="10">  &nbsp;  </code> </div>
            // <h4 class="lcard-name">${card.name}</h4> 
            var card = this.getCard();

            var infoHtml = `<div class="lcard-header"> <div class="lcard-image"> <img src="${card.imageURL}" data-width="481" data-height="701"  /> </div> </div> <div class="lcard-descriptons-cont"> <p name="lcard-descriptons" id="lcard-descriptons" class="lcard-descriptons" cols="30" rows="10">  ${card.description} </p> </div>`;
            this.infoPanel.empty().append(infoHtml);
        }
    }
    hideInformationsPopup() {
        this.infoPanel.empty();
        duration = duration || 1000;
        if (this.infoPopup) {
            // this.infoPopup.removeClass( 'animate__animated animate__jackInTheBox' ).addClass(' animate__animated animate__zoomOut');
            this.infoPopup.addClass(' animate__animated animate__zoomOut');
            setTimeout(function () {
                this.infoPopup.removeClass(' animate__animated animate__zoomOut');
                lightbox.remove();
            }, duration);
        }
    }

}
class CardMenu extends MenuBase {
    constructor(element, options) {
        super(element, options);
    }
    defineMenu() {
        this.menuList = {
            banish: [
                'this-declare',
                'this-target',
                'to-deck-bottom',
                'to-deck-top',
                'to-summon-atk',
                'to-summon-def',
                'to-graveyard',
                'to-hand',
            ],
            hand: [
                'this-reveal',
                'this-declare',
                'to-deck-bottom',
                'to-deck-top',
                'to-graveyard',
                'to-banish',
                'to-banish-fold',
                'to-summon-normal',
                'to-summon-atk',
                'to-summon-def',
                'set', // isST: to-st, def, FD ELSE: to-summon-def
                'active',
            ],
            deck: [
                'to-exdeck',
                'to-hand',
                'to-summon-atk',
                'to-summon-def',
                'to-st', // st, atk, normal
                'to-banish',
                'to-banish-fold',
                'to-graveyard',
            ],
            graveyard: [
                // Target, To bottom of the deck, To top of the deck, S.S ATK, S.S DEF, Banish, Banish fold, To hand, Declare
                'this-target',
                'this-declare',
                'to-deck-bottom',
                'to-deck-top',
                'to-summon-atk',
                'to-summon-def',
                'to-banish',
                'to-banish-fold',
                'to-hand',
                'to-graveyard',

            ],
            exdeck: [
                //Reveal, Banish, Banish fold, S.S ATK, S.S DEF, To grave
                // 'set-reveal', // lam sau
                'this-reveal',
                'this-declare',
                'to-banish',
                'to-banish-fold',
                'to-summon-atk',
                'to-summon-def',
                'to-graveyard',
            ],
            summon: [
                'this-declare',
                'detact',
                'move',
                'target',
                'to-banish',
                'to-banish-fold',
                'this-atk',
                'this-def',
                'this-flip',
                // 'this-set',
                'to-hand',
                'to-exdeck',
                'to-exdeck-fu',
                'set',
                'to-graveyard',
            ],
            st: [
                'this-declare',
                'detact',
                'move',
                'target',
                'to-banish',
                'to-banish-fold',
                'to-summon-atk',
                'to-summon-def',
                'this-flip',
                'to-hand',
                'to-exdeck',
                'to-exdeck-fu',
                'to-graveyard',
                'this-set',
                'this-active',

            ],
            'fz': [ // Field zone 
                'move',
                'to-hand',
                'to-graveyard',
                'set',
                'active',

            ]
        }

    }
    beforeShow() {
        var card = this.getCard();
        var cardElm = card.html;
        var _board = card.getBoard();

        this.element.dialog('option', 'appendTo', '#' + cardElm.attr('id'));

        this.element.dialog('option', 'position', {
            my: "center bottom",
            at: "center top",
            of: '#' + cardElm.attr('id')
        });

        if (['deck', 'exdeck', 'graveyard', 'banish'].includes(card.position)) {
            var items = _board.getCollectionItems(card.position);
            var _last = items.length ? items[items.length - 1]['collection_order'] : 0;

            if (card.collection_order > (_last - 10)) {
                this.element.dialog('option', 'position', {
                    my: "center top",
                    at: "center bottom",
                    of: '#' + cardElm.attr('id')
                });
            }
        }

    }
    setCard(card) {
        this.card = card;
        this.updateMenu();
        return this;
    }
    getCard() {
        return this.card;
    }
    updateMenu() {

        var card = this.getCard();
        var ul = this.element.find('ul');
        ul.find('li a').hide();
        var pos = card.position;
        var list = this.menuList[pos];

        if (list) {
            for (var i = 0; i < list.length; i++) {
                ul.find(`#${list[i]}`).show();
                ul.find(`#${list[i]}`).parent().appendTo(ul);
            }
        }
        var itemShowed = ul.find('li a');
        //     var itemShowed =  ul.find('li a').filter( function(index, item) {
        //         console.log( item, !$(item).is(':hidden') );

        //         return !$(item).is(':hidden');
        //     } );
        //    console.log( itemShowed )

        $.each(itemShowed, function (index, menu_tag) {
            var menuElm = $(menu_tag); // a tag
            var condition = menuElm.data('condition');
            if (condition || '') {
                if (!card[condition]) {
                    menuElm.hide();
                }
            }
            if (menu_tag.id == 'this-active') {
                if (card.foldState != 'fold') {
                    menuElm.hide();
                }
            }

            if (menu_tag.id == 'this-set') {
                if (card.foldState != 'normal') {
                    menuElm.hide();
                }
            }
            if (menu_tag.id == 'set') {
                if (card.foldState != 'normal') {
                    menuElm.hide();
                }
            }

        });
        if (this.isSmallScreen()) {
            ul.find('li #this-view').show();
        } else {
            ul.find('li #this-view').hide();
        }


    }

    updateMenuOLD() {
        var card = this.getCard();
        var ul = this.element.find('ul');
        ul.find('li a').show();
        ul.find(`a[data-position="this"]`).hide();

        var pos = card.position;
        ul.find(`a[data-position="${pos}"]`).hide();

        var _board = card.getBoard();
        var summonElm = _board.getFreeSummon();
        if (!summonElm.length) {
            ul.find(`a[data-position="summon"]`).hide();
        }
        // (pos == 'summon') && ul.find(`a[data-position="summon"]`).hide();
        (pos == 'summon') && ul.find(`a[data-position="this"]`).show();
        (pos == 'summon') && ul.find(`a[data-position="this"]`).filter(`[data-switch-state="${card.switchState}"]`).hide();

        card.isExtra && ul.find(`a[data-position="deck"]`).hide();
        (!card.isExtra) && ul.find(`a[data-position="exdeck"]`).hide();
        var stElm = _board.getFreeST();
        if (!stElm.length) {
            ul.find(`a[data-position="st"]`).hide();
        }
    }
    drawHtml() {
        var ul = this.element.find('ul');

        ul.append(`
        <!-- this-view-card -->
            <li class="menuItem">
                <a href="javascript:void(0)" id="this-view" data-target="this,view">
                    View
                </a>
            </li>
        <!-- 'this-target' -->
            <li class="menuItem">
                <a href="javascript:void(0)" id="this-target" data-target="this,target">
                    Target
                </a>
            </li>

        <!-- 'to-deck-bottom' -->

            <li class="menuItem">
                <a href="javascript:void(0)" id="to-deck-bottom" data-target="deck,,bottom">
                    To B deck
                </a>
            </li>

        <!-- 'to-deck-top' -->
            <li class="menuItem">
                <a href="javascript:void(0)" id="to-deck-top" data-target="deck,top">
                    To T deck
                </a>
            </li>

        <!-- 'summon-normal' -->
            <li class="menuItem">
                <a href="javascript:void(0)" id="to-summon-normal" data-target="summon,atk">
                    Normal Summon
                </a>
            </li>

        <!-- 'to-ss-atk' -->

            <li class="menuItem">
                <a href="javascript:void(0)" id="to-summon-atk" data-target="summon,atk,normal">
                    SS ATK
                </a>
            </li>

        <!-- 'to-ss-def' -->

            <li class="menuItem">
                <a href="javascript:void(0)" id="to-summon-def" data-target="summon,def,normal">
                    SS DEF
                </a>
            </li>

        <!-- 'to-graveyard' -->
            <li class="menuItem">
                <a href="javascript:void(0)" id="to-graveyard" data-target="graveyard,atk">
                    To grave
                </a>
            </li>

        <!-- 'detack' -->
            <li class="menuItem">
                <a href="javascript:void(0)" id="detack" data-target="graveyard,atk">
                    Detack
                </a>
            </li>

        <!-- 'to-hand' -->
            <li class="menuItem">
                <a href="javascript:void(0)" id="to-hand" data-target="hand,atk,normal">
                    To hand
                </a>
            </li>

        <!-- 'this-declare' -->
            
            <li class="menuItem">
                <a href="javascript:void(0)" id="this-declare" data-target="this,declare">
                    Declare
                </a>
            </li>

        <!-- 'this-reveal' -->

            <li class="menuItem">
                <a href="javascript:void(0)" id="this-reveal" data-target="this,reveal">
                    Reveal
                </a>
            </li>

        <!-- 'to-banish' -->

            <li class="menuItem">
                <a href="javascript:void(0)" id="to-banish" data-target="banish,normal">
                    Banish
                </a>
            </li>

        <!-- 'to-banish-fold' -->
            <li class="menuItem">
                <a href="javascript:void(0)" id="to-banish-fold" data-target="banish,fold">
                    Banish fold
                </a>
            </li>

        <!-- 'set' only for normal, hide when fold, isST: moveto ST/ move to SS, switch to FD, DEF -->

            <li class="menuItem">
                <a href="javascript:void(0)" id="set" data-target="this,set">
                    Set
                </a>
            </li>

        <!-- 'active' , only Spell card -->

            <li class="menuItem">
                <a href="javascript:void(0)" data-condition="isST" id="active" data-target="st,normal">
                    Active
                </a>
            </li>
        <!-- 'this-active' , only Spell card fold -->

            <li class="menuItem">
                <a href="javascript:void(0)" data-condition="isST" id="this-active" data-target="this,normal">
                    Active
                </a>
            </li>

        <!-- 'this-set' , only Spell card fold -->

            <li class="menuItem">
                <a href="javascript:void(0)" data-condition="isST" id="this-set" data-target="this,fold">
                    Set
                </a>
            </li>

        <!-- 'to-exdeck' -->
            <li class="menuItem">
                <a href="javascript:void(0)" data-condition="isExtra" id="to-exdeck" data-target="exdeck,top">
                    To extra
                </a>
            </li>

        <!-- 'to-exdeck' -->
            <li class="menuItem">
                <a href="javascript:void(0)" data-condition="isExtra" id="to-exdeck-fu" data-target="exdeck,top,normal">
                    To extra FU
                </a>
            </li>

        <!-- 'to-st' --> 

            <li class="menuItem">
                <a href="javascript:void(0)" data-condition="isST" id="to-st" data-target="st,atk,normal">
                    To ST
                </a>
            </li>

        <!-- move -->
            <li class="menuItem">
                <a href="javascript:void(0)" id="move" data-target="this,move">
                    Move to
                </a>
            </li>

        <!-- this-atk -->
            <li class="menuItem">
                <a href="javascript:void(0)" id="this-atk" data-target="this,atk">
                    To ATK
                </a>
            </li>

        <!-- this-def -->
            <li class="menuItem">
                <a href="javascript:void(0)" id="this-def" data-target="this,def">
                    To DEF
                </a>
            </li>

        <!-- this-flip -->
            <li class="menuItem">
                <a href="javascript:void(0)" id="this-flipped" data-target="this,flipped">
                    Flip
                </a>
            </li>
        `);

    }
    events() {
        var menu = this;
        this.element.on('click', 'ul li a', function () {
            var _this = this;
            var card = menu.getCard();
            var board = card.getBoard();
            var target = $(this).data('target');
            console.log(target);
            if (target == 'this,view') {
                // Not a play step 
                menu.cardInformationsPopup();
            }

            target = target.split(',');
            var newPosition = target[0];
            var isTop = true;
            var newState = target[1] || '';
            var isFD = target[2] || '';
            var order = 0; // Use for SS / ST
            if (newPosition != 'this' && !card.canMoveTo(newPosition)) {
                return false;
            }
            menu.dialog.dialog('close');
            if (newPosition == 'this' && newState == 'set') {
                if (card.isST) {
                    newPosition = 'st';
                    newState = 'fold';
                } else {
                    newPosition = 'summon';
                    newState = 'def';
                    isFD = 'fold';
                }
            }

            if (newPosition == 'this' && newState == 'move') {
                order = false;
                var free = board.isSS_STFreeOne(card);
                // cần thêm 1 position tên là 'fz'
                if (free) {
                    order = free.data('order');
                    newPosition = free.data('position');
                    return board.updateCardbyAction(card, newPosition, order, newState, isFD);
                } else {
                    //select the new order
                    board.setWaitingActions({
                        card: card,
                        newPosition: false,
                        newState: newState,
                        isFD: isFD
                    });
                    board.selectOrder(card.isMonster, card.isSpell);
                    return 'waiting for select order';
                }

            }
            if (newPosition == 'this' && ['atk', 'def'].includes(newState)) {
                isFD = 'normal'; // lật bài lên trong tường hợp position = summon, và action == defense, attack
                return board.updateCardbyAction(card, newPosition, order, newState, isFD);

            }

            if ((card.position != newPosition) && ((newPosition == 'summon') || (newPosition == 'st'))) {
                // Close the collection dialog if it is already open
                if (['deck', 'exdeck', 'banish', 'graveyard'].includes(card.position)) {
                    var collection = board.getCollectionByPosition(card.position);
                    collection && collection.menuElm.dialog('close');
                }

                // check order
                order = false;
                if (card.isMonster && newPosition == 'summon') {
                    order = board.isExSSFreeOne();
                    if (order) {
                        return board.updateCardbyAction(card, newPosition, order, newState, isFD);
                    } else {
                        //select the new order
                        board.setWaitingActions({
                            card: card,
                            newPosition: newPosition,
                            newState: newState,
                            isFD: isFD
                        });
                        board.selectOrder(true);
                        return 'waiting for select order';
                    }
                } else {
                    order = (newPosition == 'st') ? board.isSTFreeOne() : board.isSSFreeOne();

                    // If have last slot then put the card in the last slot
                    if (order) {
                        return board.updateCardbyAction(card, newPosition, order, newState, isFD);

                        // Else  User select a slot then put the card in the selected slot
                    } else {
                        //select the new order
                        board.setWaitingActions({
                            card: card,
                            newPosition: newPosition,
                            newState: newState,
                            isFD: isFD
                        });
                        board.selectOrder(newPosition);
                        return 'waiting for select order';
                    }
                }

            }

            if ((card.position != newPosition) && (['deck', 'exdeck', 'graveyard'].includes(newPosition))) {
                newState = ''; // attack && normal
            }
            // console.log( card, newPosition, order, newState, isFD );
            return board.updateCardbyAction(card, newPosition, order, newState, isFD);

        });
    }
}
class CollectionMenu extends MenuBase {
    constructor(element, options) {
        super(element, options);
    }
    setCollection(collection) {
        this.collection = collection;
        this.updateMenu();
        return this;
    }
    getCollection() {
        return this.collection;
    }

    defineMenu() {
        // This is an abstract function
    }
    beforeShow() {
        var collection = this.getCollection();
        var collectionElm = collection.elm;
        this.element.dialog('option', 'appendTo', '#' + collectionElm.attr('id'));
        this.element.dialog('option', 'position', {
            my: "center bottom",
            at: "center top",
            of: '#' + collectionElm.attr('id')
        });
    }
    updateMenu() {
        // Foe Extra deck: Hide all, only show "View" item
    }
    drawHtml() {
        //List actions: View, Banish FD, Banish T., Mill, Shuffle, Draw
        var ul = this.element.find('ul');
        ul.empty();
        // View, Banish FD, Banish T., Mill, Shuffle, Draw
        ul.append(`
            <li class="menuItem"><a href="javascript:void(0)" data-position="this" data-switch-state="" data-target="this,open">View</a></li>
            <li class="menuItem"><a href="javascript:void(0)" data-position="banish" data-switch-state="" data-target="banish,normal">Banish</a></li>
            <li class="menuItem"><a href="javascript:void(0)" data-position="banish" data-switch-state="" data-target="banish,fold">Banish FD</a></li>
            <li class="menuItem"><a href="javascript:void(0)" data-position="graveyard" data-switch-state="" data-target="graveyard">Mill</a></li>
            <li class="menuItem"><a href="javascript:void(0)" data-position="this" data-switch-state="" data-target="this,shuffle">Shuffle</a></li>
            <li class="menuItem"><a href="javascript:void(0)" data-position="hand" data-switch-state="" data-target="hand">Draw</a></li>
        `);

    }

    events() {
        var menu = this;
        this.element.on('click', 'ul li a', function () {
            var _this = this;
            var collection = menu.getCollection();
            var curPosition = collection.getPosition();
            var card = collection.getTopCard();
            var target = $(this).data('target');

            target = target.split(',');
            var newPosition = target[0];

            if (newPosition != 'this') {
                if (!card.canMoveTo(newPosition)) {
                    return false;
                } else {
                    card.moveTo(newPosition);
                    if (target[1]) {
                        let newState = target[1];
                        switch (newState) {
                            case 'def':
                                card.defense();
                                break;
                            case 'atk':
                                card.attack();
                                break;
                            case 'fold':
                            case 'normal':
                                card.fold(newState);
                                break;
                        }
                    }
                }
            }
            else {
                if (target[1]) {
                    let newState = target[1];

                    switch (newState) {
                        case 'shuffle':
                            collection.shuffleCollectionCards();
                            break;
                        case 'open':
                            collection.showCollection();
                            break;
                    }
                } else {

                    collection.showCollection();
                }
            }
            menu.dialog.dialog('close');
            return true;

        });

    }
}