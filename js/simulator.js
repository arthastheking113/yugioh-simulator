var board;
// (function ($) {
	'use strict';
    class Card {
        constructor (Board, item, order, options){
            // this.item = item;
            var _default = {
                id: 0,
                name: 'card',
                order: 1,
                collection_order: 1,
                canMoveHand : true,
                canMoveSummon : true,
                canMoveExDeck : true,
                canMoveDeck : true,
                canMoveST : true,
                canMoveBanish : true,
                canMoveGraveyard : true,
                flipState: 'normal',
                switchState: 'attack',
                position: 'deck',
            };
            $.extend( this, _default, item);
            // console.log( this );
            this.options = options;
            this.order = order;
            this.Board = Board;
            this.itemBefore = {};
            this.init();
        }
        init(){
            this.drawHtml(this.options);
            this.cardEvents();
        }
        cardEvents(){
            var _card = this;
            // console.log(this.html );

            this.html.hover( function( e ) {
                // console.log('mousein', e);
                var _board = _card.getBoard();
                var cardMenu = _board.cardMenu.setCard(_card);
                // console.log( cardMenu );

                cardMenu.show();
            }, function( e ) { 
                // console.log('mouseout');

                var _board = _card.getBoard();
                var cardMenu = _board.cardMenu;
                cardMenu.hide();
                // console.log( cardMenu );
            });
        }
        // validate
        canMoveTo( newPosition ){
            var _board = this.getBoard();
            newPosition = newPosition|| 'hand'; // hand / deck / exdeck / graveyard / summon / st / banish 
            //1
            var allow = false;
            switch( newPosition ){
                case 'hand':
                case 'deck':
                case 'graveyard':
                case 'banish':
                    allow = true;
                    break;
                case'summon':
                case'st':
                    allow = true;
                    var summonElm = _board.getFreeSummon();
                    if( !summonElm.length ){
                        allow = false;
                    }
                break;
                case 'exdeck':
                    if( this.canMoveExDeck ){
                        allow = true;
                    }
                    break;
                default:
                    allow = false;
                
            }

            return allow;
        }
        canFlip( newState ) {
            newState = newState|| 'normal'; // normal / flipped 

            //1 
            return true;
        }

        canSwitch( newState ) {
            newState = newState|| 'attack'; // attack / defense

            //1 
            return true;
        }

        getNewOffset(){
            return [0,0];
        }

        // Switch state
        beforeMove( newPosition ){
            this.itemBefore = {...this};
            return true;
        }
        afterMove(newPosition){
            // console.log( 'afterMove', newPosition );

            // Draw old collection was moved from
            if( this.position !=  this.itemBefore.position ){
                var collection = this.getBoard().getCollectionByPosition( this.itemBefore.position );
                     collection && collection.drawOnBoard();
            }
            return true;
        }
        moveTo( newPosition, isTop, animation, duration ) {
            if(!['hand', 'deck', 'exdeck', 'graveyard','summon','st', 'banish'].includes( newPosition ) ) return false;

            var _card = this;
            var result = false;
            if( typeof isTop == 'undefined' ) isTop = true;
            var oldPosition = _card.position;
            if( ! _card.beforeMove( newPosition ) ) return false;

            //1
            // Nếu oldPosition là hand thì lưu thẻ cha để remove
            var willRemove = [];
            if( oldPosition == 'hand' ){
                willRemove = _card.html.parent();
            }
            if( this.canMoveTo ( newPosition) ) {

                // 1
                result = true;
                var to = this.getNewOffset( newPosition );
                if( animation )this.doAnimation ( to, animation, duration );
                var newOrder = 0;
                var collection = 0;
                collection = this.getBoard().getCollectionByPosition( newPosition);
                var items = [];
                if( collection ){
                    if( isTop ) {
                        if( collection ){
                            items = collection.getCollectionItems();
                            let last = items.length ? items[ items.length - 1 ]['collection_order'] : 0;
                            newOrder = last + 1;
                            _card.collection_order = newOrder;
                        }
                    } else {
                        _card.collection_order = newOrder;
                    }
                } else {
                    _card.collection_order = newOrder;
                }
                // set new position here
                this.position = newPosition;

                // reorder collection
                items = collection ? collection.getCollectionItems() : [];
                if( items.length ){
                    $.each( items, function ( i, item ){
                        item.collection_order = i+1;
                    });
                }

                if( newPosition != 'summon' ){
                    this.switchState = 'attack';
                    _card.updateHtml();
                }
                if( newPosition != 'hand' ){
                    // this.flipState = 'normal';
                    _card.updateHtml();
                }
                if( ! this.appendToBoard() ){
                    return false;
                }
            }
            //1
            // Nếu oldPosition là hand thì xóa thẻ div cha
            if( willRemove.length ){
                willRemove.remove();
            }
            _card.afterMove( newPosition );
            return result;
        }

        // flip state: normal / flipped
        flip( newState, animation, duration ) {
            if( !['normal', 'flipped'].includes( newState ) ) return false;
            var result = false;
            if( this.canFlip ( newState ) ) {

                // 1
                result = true;
                if( animation )this.doAnimation ( newState, animation, duration );
                // 1
                console.log( newState, this.html );
                this.flipState = newState;
                // set new state here
                this.html.removeClass('normal flipped').addClass(newState);

            }
            return result;

        }
        // attack / defense state
        attack( animation, duration){
            this._switchAttack ( 'attack', animation, duration );
        }
        defense( animation, duration){
            this._switchAttack ( 'defense', animation, duration );
        }
        _switchAttack (newState, animation, duration ) {
            if( !['attack', 'defense'].includes( newState ) ) return false;
            var result = false;
            if( this.canSwitch ( newState ) ) {

                // 1
                result = true;
                if( animation ) this.doAnimation ( newState, animation, duration );
                // 1
                this.switchState = newState;
                // set new state here
                this.html.removeClass('attack defense').addClass(newState);
            }
            return result;
        }

        // Draw
        drawHtml( ) {
            var _card = this;
            var backImageSrc = this.options.imgPath + this.options.backImageSrc;
            var frontImageSrc = this.options.imgPath + 'card/' + this.name + '.jpeg';
            var cardId = this.id;
            var cardElement = $(`<div id="card-${cardId}" class="card card-id-${cardId}" data-id="${cardId}" />`);
            var moveOptions = [
                'canMoveHand',
                'canMoveSummon',
                'canMoveExDeck',
                'canMoveDeck',
                'canMoveST',
                'canMoveBanish',
                'canMoveGraveyard',
            ];
            moveOptions.forEach( function( moveOption ) {
                if (_card[moveOption] || 1 ) {
                    cardElement.addClass(moveOption);
                }
            });
            var states = [
                'flipState',
                'switchState',
                'position',
            ];
            states.forEach( function( stateName ) {
                if (_card[stateName]) {
                    cardElement.addClass(_card[stateName]);
                    cardElement.data( stateName, _card[stateName] );
                }
            });

            cardElement.append(`<img src="${backImageSrc}" width="70" height="102" class="back-image"/>`);
            cardElement.append(`<img src="${frontImageSrc}" width="70" height="102" class="front-image""/>`);

            this.html = cardElement;

        }
        updateHtml(){
            var _card = this;
            var cardElement = _card.html;

            var moveOptions = [
                'canMoveHand',
                'canMoveSummon',
                'canMoveExDeck',
                'canMoveDeck',
                'canMoveST',
                'canMoveBanish',
                'canMoveGraveyard',
            ];
            moveOptions.forEach( function( moveOption ) {
                if (_card[moveOption] || 1 ) {
                    cardElement.toggleClass(moveOption, (moveOption in _card ) && (_card[moveOption] == 1) );
                }
            });
            var states = [
                'flipState',
                'switchState',
                'position',
            ];
            cardElement.removeClass('normal flipped attack defense deck exdeck graveyard banish summon st hand');
            states.forEach( function( stateName ) {
                if (_card[stateName]) {
                    cardElement.addClass(_card[stateName]);
                    cardElement.data( stateName, _card[stateName] );
                }
            });

        }
        appendToBoard(){
            var _card = this;
            var _board = _card.getBoard();
            var hand = _board.getHandElm();
            var position = _card.get('position');
            // console.log( position );
            switch(position){
                case 'deck':
                case 'exdeck':
                case 'graveyard':
                case 'banish':
                    var collection = _board.getCollectionByPosition(position);
                    collection && collection.appendCard( _card );
                    collection && collection.drawOnBoard();
                break;

                case'summon':
                    var summonElm = _board.getFreeSummon();
                    if( !summonElm.length ){
                        return false;
                    }
                    _card.updateHtml();
                    _card.html.appendTo( summonElm );
                    
                    break;
                case'st':
                    var stElm = _board.getFreeST();
                    if( !stElm.length ){
                        return false;
                    }
                    _card.updateHtml();
                    _card.html.appendTo( stElm );
                    
                break;

                case 'hand': //default is hand
                hand.append( $('<div class="hand-card-container" />').append( _card.html ) );
                // var _handCardContainer = $('<div class="hand-card-container" />');
                // hand.append( _handCardContainer );
                // _card.html.appendTo(_handCardContainer);

                // _card.html.appendTo( _card.getBoard().getHandElm() );
                break;
                // default:

            }
            hand.find('.hand-card-container').filter( function( index, container ) {
                return $(container).is(':empty');
            }).remove();
        }

        // get / set
        getBoard() {
            return this.Board;
        }
        get( k, defaultValue){
            // console.log( k, this[k])
            if( this[k] ) return this[k];
            return defaultValue||false;
        }
    }

    // Desk, ExDeck, Graveyar, Banish
    //1
    // Thiếu: Hiển thị 2 phần: board & dialog ( đang làm dialog)
    class Collection{
        constructor ( Board, name, elm, menuElm, options){
            this.Board = Board;
            this.name = name;
            this.collection_position = name;
            this.elm = elm;
            this.menuElm = menuElm;
            this.options = options;
            this.init();
        }
        init(){
            // console.log( this.menuElm );
            if(! this.menuElm.length){
                console.error( 'menuElm no found' );
            }
            if(! this.elm.length){
                console.error( 'Collection elm no found' );
            }
            this.drawDialog();
            this.events();
        }
        events(){
            var collection = this;
            var _board = collection.getBoard();
            this.elm.on('click', function(){
                collection.showDialog();
            } );

            this.menuElm.on('click', '.card img', function(){
                var _cardElm = $(this).closest('.card');
                // console.log( _cardElm );
                var _cardID = _cardElm.data('id');
                var _card = _board.getItemById( _cardID );
                _card.moveTo('hand');
            } );
        }
        getCards(){
            return this.getBoard().getItemsByPosition(this.collection_position);
        }
        getTopCard(){
            var cards = this.getCards();
            cards.sort((a,b) => {
                return a.collection_order < b.collection_order;
            });
            return cards.length > 0 ? cards[ cards.length - 1] : false;
        }
        drawOnBoard(){
            var cards = this.getCards();

            // count cards
            this.elm.find('.card').remove();
            this.elm.find('.collection-count').children().first().empty().text( cards.length );

            // TODO: check and draw top card with status;
            if( cards.length > 0 ){
                var topCard = this.getTopCard();
                // temporarily flip items
                this.elm.prepend(  topCard.html.clone().attr('id', '') ); 
            }
        }
        drawDialog(){
            // if( this.menuElm.length ){
                var dialog = this.menuElm.dialog({
                    width: 450,
                    height: 563,
                    resizable: true,
                    draggable: true,
                    autoOpen: false,
                    modal: true, // Overlay mode
                    open: function (event, ui) {
                        // $(this).closest(".ui-dialog")
                            // .find(".ui-dialog-titlebar-close")
                            // .removeClass("ui-dialog-titlebar-close")
                            // .html("<span class='ui-button-icon-primary ui-icon ui-icon-closethick'></span>")
                    },
                    position: {
                        my: "top center",
                        at: "top center",
                        of: '#playtest'
                    }
                });
                // this.menuElm = dialog;
            // console.log( this.menuElm );
                
            // }
        }
        showDialog(){
            // console.log(this );
            this.menuElm.dialog('open');
        }
        // show Collection board
        showCollection(){
            this.showDialog();
        }
        getCollectionItems(){
            var _board = this.getBoard();
            return _board.getCollectionItems(this.collection_position);
        }
        getBoard(){
            return this.Board;
        }

        // add / remove card
        appendCard( card, reDraw ){
            if( reDraw || 0 ){
                card.position = this.collection_position;
                card.updateHtml();
            }
            card.html.appendTo(this.menuElm.find('.collection-container'));
            return true;
        }

    }
    class Board{
        constructor (elm, data, options){
            this.elm = elm;
            this.orgitems = data.main;
            // this.extra = data.extra;
            var defaultOptions = {
                backImageSrc: 'back_card.png',
                imgPath: 'asset/'
            };
            this.options = $.extend( defaultOptions, options);
            this.init();
            this.deckToHand( 5, 'top');
        }
        init(){
            // console.log("init");
            this.deckElm = this.elm.find('#deck-slot');
            this.exDeckElm = this.elm.find('#extra-deck-slot');
            this.handElm = this.elm.find('#hand-board');
            this.graveyardElm = this.elm.find('#graveyard-slot');
            // this.summonElm = this.elm.find('#summon-slot');
            // this.stElm = this.elm.find('#st-slot');
            this.banishElm = this.elm.find('#banish-slot');

            this.deckMenuElm = $('#deckmenu');
            this.exDeckMenuElm = $('#extradeckmenu');
            this.graveyardMenuElm = $('#graveyardmenu');
            this.banishMenuElm = $('#banishmenu');

            this.cardManuElm = $('#cardMenu');
            this.collectionMenuElm = $('#collectionMenu');

            this.initItems( this.orgitems );
            this.initDeck();
            this.initExDeck();
            this.initGraveyard();
            this.initBanish();

            this.initMenus();


            
            this.shuffleCards();
            this.events();

        }
        initItems( ){
            var _board = this;
            this.items = [];
            this.orgitems.forEach( function( item ){
                if( _board.validateBeforeAddItem( item ) ){
                    _board.addItem( item );
                }
            });
        }
        initDeck(){
            this.deck = new Collection( this, 'deck', this.deckElm, this.deckMenuElm,this.options);
        }
        initExDeck(){
            this.exdeck = new Collection( this, 'exdeck', this.exDeckElm, this.exDeckMenuElm, this.options);
        }
        initGraveyard(){
            this.graveyard = new Collection( this, 'graveyard', this.graveyardElm, this.graveyardMenuElm, this.options);
        }
        initBanish(){
            this.banish = new Collection( this, 'banish', this.banishElm, this.banishMenuElm, this.options);
        }
        initMenus(){
            // var _board = this;
            this.cardMenu = new CardMenu( this.cardManuElm );
            this.collectionMenu = new CollectionMenu( this.collectionMenuElm );
        }

        events(){
            return true;
        }
        // Add, update, remove
        validateBeforeAddItem( item ){
            return true;
        }
        addItem( item, order ){
            order = order || ( this.items.length + 1);
            var card = new Card( this, item, order, this.options);
            this.items.push( card );
            card.appendToBoard();
        }
        updateItem( id, k, v ){
            var card = this.getItemById(id);
            card[k] = v;
            card.updateHtml();
            card.appendToBoard();
            return card;
        }
        shuffleCards(){
            var _board = this;
            var items = _board.getItems();
            // var shuffledArr = items.sort(() => Math.random() - 0.5);
            items.sort(() => Math.random() - 0.5);
            $.each( items, function( index, item ) {
                _board.updateItem( item.id, 'collection_order', index+1 );
                _board.updateItem( item.id, 'order', index+1 );
            });
        }

        // Move
        moveCard( card, to ){
            card.moveTo( to );
        }
        deckToHand( count, from ) {
            var _board = this;
            var deckItems = _board.getDeckItems();
            var length = deckItems.length;
            var end = Math.max(length - count, 0) - 1;
            for (var i = length-1; i > end; i--) {
                deckItems[i].moveTo( 'hand' );
            }
        }

        // get / set
        getItems(){
            return this.items;
        }
        getLength(){
            return this.items.length;
        }

        getCollectionItems(collection_position){
            return this.getItemsByPosition(collection_position);
        }
        getItemsByPosition(position){
            return this.items.filter( function( item ){
                return item.position == position;
            });
        }
        getDeckItems(){
            return this.getItemsByPosition('deck');

        }
        getExtraDeckItems(){
            return this.getItemsByPosition('exdeck');

        }
        getGraveyardItems(){
            return this.getItemsByPosition('graveyard');
        }
        getBanishItems(){
            return this.getItemsByPosition('banish');
        }
        getHandItems(){
            return this.getItemsByPosition('hand');
        }
        getSummonItems(){
            return this.getItemsByPosition('summon');
        }
        getStItems(){
            return this.getItemsByPosition('st');
        }

        setItems( items ){
            this.orgitems = items;
            this.initItems();
        }
        get( key, defaultValue ){
            if( typeof this[key] != 'undefined' ){
                return this[key];
            }
            return defaultValue||undefined;
        }
        getFreeSummon(){
            var _free = [];
            $.each( this.elm.find('.summon-slot'), function (i, el ){
                var _el = $(el);
                if( (!_free.length) && (!_el.find('.card').length) ){
                    _free = _el;
                }
            });
            return _free;
        }
        getFreeST(){
            var _free = [];
            $.each( this.elm.find('.st-slot'), function (i, el ){
                var _el = $(el);
                if( (!_free.length) && (!_el.find('.card').length) ){
                    _free = _el;
                }
            });
            return _free;
        }
        set( key, value ){
            this[key] = value;
        }

        getItemById(id){
            return this.items.filter( function( item ){
                return item.id == id;
            })[0];   
        }
        getItemByName(name){
            return this.items.filter( function( item ){
                return item.name == name;
            })[0];   
        }
        getItemByOrder(order){
            return this.items.filter( function( item ){
                return item.order == order;
            })[0];   
        }
        getItemByPosition(position){
            return this.items.filter( function( item ){
                return item.position == position;
            });
        }

        // get the elements
        getHandElm() {
            return this.handElm;
        }
        getGraveyardElm() {
            return this.graveyardElm;
        }
        getSummonElm() {
            return this.summonElm;
        }
        getStElm() {
            return this.stElm;
        }
        getBanishElm() {
            return this.banishElm;
        }
        getDeckElm() {
            return this.deckElm;
        }
        getExDeckElm() {
            return this.exDeckElm;
        }
        getBoardElm() {
            return this.elm;
        }
        getBoard() {
            return this;
        }
        getCollectionByPosition(position) {
            var collection = false;
            switch( position ){
                case 'deck':
                    collection = this.deck;
                    // console.log( deck)
                break;
                
                case 'exdeck':
                    collection = this.exdeck;
                    // console.log(collection);
                break;

                case 'graveyard':
                    collection = this.graveyard;
                break;
                case 'banish':
                    collection = this.banish;
                break;
            }
            // console.log( deck)
            return collection;
        }

        getGraveyardMenuElm() {
            return this.graveyardMenuElm;
        }
        getBanishMenuElm() {
            return this.banishMenuElm;
        }
        getDeckMenuElm() {
            return this.deckMenuElm;
        }
        getExDeckMenuElm() {
            return this.exDeckMenuElm;
        }


        
    }

    $(document).ready(function() {
        board = new Board( $('#playtest'), boardData, {} );
        console.log(board);

    });
// });
//s