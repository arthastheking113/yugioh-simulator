'use strict';
class MenuBase {
    constructor(element, options) {
        this.element = element;
        this.options = $.extend( {}, options);
        this.dialog = {};
        this.init();
    }
    init(){
        this.defineMenu();
        this.drawHtml(this.options);
        this.createDialog();
        this.events();
    }
    drawHtml(){

    }
    createDialog(){
        var w = $('.st-slot').first().width();
        this.dialog = this.element.dialog({
            minWidth: 100,
            minHeight: 60,
            width: w,
            height: 'auto',
            modal: false,
            autoOpen: false,
            classes: {
                'ui-dialog-titlebar' : 'hidden',
                'ui-dialog' : 'ui-dialog-card-menu',
            },
            open: function (event, ui) {},
            // create: function (event, ui) {
            //     console.log( $( this ), ui );
            //     // $(this).siblings('.ui-dialog-titlebar').addClass('hidden');
            // },
            position:{
                my: "bottom center",
                at: "top center",
                of: '#playtest'
            },
            // hide: { effect: "explode", duration: 1000 },
            // show: { effect: "blind", duration: 50 },
        });
    }
    defineMenu(){
        // This is an abstract function
    }
    show(){
        this.beforeShow();
        this.dialog.dialog('open');
        this.afterShow();
    }
    beforeShow(){
        // This is an abstract function
    }
    afterShow(){
        // This is an abstract function
    }
    events(){
        // This is an abstract function
    }
    hide(){
        this.beforeHide();
        // console.log('close dialog' , this.dialog);
        this.element.dialog('close');
        this.afterHide();
    }
    beforeHide(){
        // This is an abstract function

    }
    afterHide(){
        // This is an abstract function

    }
    
}
class CardMenu extends MenuBase {
    constructor(element, options) {
        super(element, options);
    }
    defineMenu(){
        this.menuList = {
            banish:  [
                'this-target',
                'to-deck-bottom',
                'to-deck-top',
                'to-summon-atk',
                'to-summon-def',
                'to-graveyard',
                'to-hand',
                'this-declare',
            ],
            hand: [
                // 'reveal',
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
                'this-target',,
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
                'to-banish',
                'to-banish-fold',
                'to-summon-atk',
                'to-summon-def',
                'to-graveyard',
            ],
            summon : [
                'detact',
                'move',
                'target',
                'to-banish',
                'to-banish-fold',
                'this-atk',
                'this-def',
                'this-flip',
                'set',
                'to-hand',
                'to-exdeck',
                'to-exdeck-fu',
                'declare',
                'to-graveyard',
            ],
            st: [
                'detact',
                'move',
                'target',
                'to-banish',
                'to-banish-fold',
                'this-atk',
                'this-def',
                'this-flip',
                'set',
                'to-hand',
                'to-exdeck',
                'to-exdeck-fu',
                'declare',
                'to-graveyard',
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

        if( ['deck', 'exdeck', 'graveyard', 'banish'].includes( card.position )  ){
            var items = _board.getCollectionItems(card.position);
            var _last = items.length ? items[items.length - 1]['collection_order'] : 0;

            if( card.collection_order > ( _last - 10 ) ){
                // console.log(card, _board,  _last,  card.collection_order );
                this.element.dialog('option', 'position', {
                    my: "center top",
                    at: "center bottom",
                    of: '#' + cardElm.attr('id')
                });
            }
        }

    }
    setCard( card ) {
        this.card = card;
        this.updateMenu();
        return this;
    }
    getCard() {
        return this.card;
    }
    updateMenu(){
        var card = this.getCard();
        var ul = this.element.find('ul');
        ul.find('li a').hide();
        var pos = card.position;
        var list = this.menuList[pos];
        if( list ){
            for( var i = 0; i < list.length; i++ ){
                ul.find(`#${list[i]}`).show();
                ul.find(`#${list[i]}`).parent().appendTo(ul);
            }
        }
        $.each( ul.find('li a').filter(':not(:hidden)') , function ( index,  menu_tag ){
            var menuElm = $(menu_tag);
            var condition = menuElm.data('condition');
            if( condition || '' ) {
                if(  ! card[condition] ) {
                    menuElm.hide();
                }
            }
        });


    }

    updateMenuOLD(){
        var card = this.getCard();
        var ul = this.element.find('ul');
        ul.find('li a').show();
        ul.find(`a[data-position="this"]`).hide();

        var pos = card.position;
        // console.log( pos );
        ul.find(`a[data-position="${pos}"]`).hide();
        
        var _board = card.getBoard();
        var summonElm = _board.getFreeSummon();
        if( !summonElm.length ){
            ul.find(`a[data-position="summon"]`).hide();
        }
        // (pos == 'summon') && ul.find(`a[data-position="summon"]`).hide();
        (pos == 'summon') && ul.find(`a[data-position="this"]`).show();
        (pos == 'summon') && ul.find(`a[data-position="this"]`).filter(`[data-switch-state="${card.switchState}"]`).hide();

        card.isExtra && ul.find(`a[data-position="deck"]`).hide();
        (!card.isExtra) && ul.find(`a[data-position="exdeck"]`).hide();
        var stElm = _board.getFreeST();
        if( !stElm.length ){
            ul.find(`a[data-position="st"]`).hide();
        }
    }
    drawHtml(){
        // console.log( this.element );
        var ul = this.element.find('ul');
        
        ul.append(`
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
                    Normal summon
                </a>
            </li>

        <!-- 'to-ss-atk' -->

            <li class="menuItem">
                <a href="javascript:void(0)" id="to-summon-atk" data-target="summon,atk">
                    SS ATK
                </a>
            </li>

        <!-- 'to-ss-def' -->

            <li class="menuItem">
                <a href="javascript:void(0)" id="to-summon-def" data-target="summon,def">
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
                <a href="javascript:void(0)" id="to-hand" data-target="hand,atk">
                    To hand
                </a>
            </li>

        <!-- 'this-declare' -->
            
            <li class="menuItem">
                <a href="javascript:void(0)" id="this-declare" data-target="this,declare">
                    Declare
                </a>
            </li>

        <!-- 'reveal' -->

            <li class="menuItem">
                <a href="javascript:void(0)" id="reveal" data-target="reveal">
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
                <a href="javascript:void(0)" id="to-banish" data-target="banish,fold">
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
                <a href="javascript:void(0)" data-condition="isST" id="set" data-target="st,normal">
                    Active
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
                <a href="javascript:void(0)" data-condition="isExtra" id="to-exdeck-fu" data-target="exdeck,top, normal">
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
    events(){
        var menu = this;
        this.element.on('click','ul li a', function(){
            var _this = this;
            var card = menu.getCard();
            var board = card.getBoard();
            var target = $(this).data('target');
            console.log(target);

            target = target.split(',');
            var newPosition = target[0];
            var isTop = true;
            var newState = target[1]|| '';
            var isFD = target[2]||'';
            var order = 0; // Use for SS / ST
            if( newPosition != 'this' && !card.canMoveTo( newPosition ) ){
                return false;
            }
            menu.dialog.dialog('close');
            if(newPosition == 'this' && newState == 'set'){
                if( card.isST ){
                    newPosition = 'st';
                    newState = 'fold';
                }else{
                    newPosition = 'summon';
                    newState = 'def';
                    isFD = 'fold';
                }
            }
            if( ( card.position != newPosition ) && ( ( newPosition == 'summon') || ( newPosition == 'st') ) ){
                // Close the collection dialog if it is already open
                if( ['deck', 'exdeck', 'banish', 'graveyard'].includes(card.position) ){
                    var collection = board.getCollectionByPosition(card.position);
                    console.log(collection);
                    collection && collection.menuElm.dialog('close');
                }

                // check order
                order =false;
                order = ( newPosition == 'st' ) ? board.isSTFreeOne() : board.isSSFreeOne();

                // If have last slot then put the card in the last slot
                if( order ) {
                    return board.updateCardbyAction( card, newPosition, order, newState, isFD);
                    
                // Else  User select a slot then put the card in the selected slot
                }else{
                    //select the new order
                    board.setWaitingActions({
                        card: card,
                        newPosition: newPosition,
                        newState: newState,
                        isFD: isFD
                    });
                    board.selectOrder(newPosition );
                    return 'waiting for select order';
                }

            }
            return board.updateCardbyAction( card, newPosition, order, newState, isFD);

        });
    }
}
class CollectionMenu extends MenuBase {
    constructor(element, options) {
        super(element, options);
    }
    setCollection( collection ) {
        this.collection = collection;
        this.updateMenu();
        return this;
    }
    getCollection() {
        return this.collection;
    }
    
    defineMenu(){
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
    updateMenu(){
        // Foe Extra deck: Hide all, only show "View" item
    }
    drawHtml(){
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

    events(){
        var menu = this;
        this.element.on('click','ul li a', function(){
            var _this = this;
            var collection = menu.getCollection();
            var curPosition = collection.getPosition();
            var card = collection.getTopCard();
            var target = $(this).data('target');
            console.log( collection, collection.getCards(), target );

            target = target.split(',');
            var newPosition = target[0];

            if( newPosition != 'this'){
                if( !card.canMoveTo( newPosition ) ){
                    return false;
                }else{
                    card.moveTo(newPosition);
                    if( target[1] ){
                        let newState = target[1];
                        switch( newState ){
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
                if( target[1] ){
                    let newState = target[1];

                    switch( newState ){
                        case'shuffle':
                            collection.shuffleCollectionCards();
                        break;
                        case 'open':
                            collection.showCollection();
                        break;
                    }
                }else{

                    collection.showCollection();
                }
            }
            menu.dialog.dialog('close');
            return true;

        });

    }
}