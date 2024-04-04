var board;
// (function ($) {
	'use strict';
    class PlayLog{
        constructor(options){
            var _default = {
                'Board': {},
                'elm': $('.log-message-container'),
                'name': 'PlayLog',
                'options': {},
                'initItems': {},
            };
            $.extend(this, _default, options);
            this.init();
        }
        init(){
            this.steps = [];
            this.pointer = 0;
            this.isRePlaying = false;
            this.replaytimeout = 0;
            this.messageElm = this.elm.find('#log-message');
            this.overlay = $('<div class="replay-overlay"></div>').css({
                position: 'fixed',
                width: '100vw',
                height: '100vh',
                top: 0,
                left: 0,
                backgroundColor: 'rgba(0, 0, 0, 0)',
                zIndex: 99,
                display: 'none',
            });
            $('body').find('.replay-overlay').remove();
            $('body').append(this.overlay);
            this.messageElm.empty();
            this.events();

        }
        events(){
            var playLog = this;
            this.elm.find('.replay-button').off('click').on('click', function(){
                playLog.replay();
            });
        }
        async setInitItems(items){
            this.initItems = items;
        }
        async addStep(action, id, data, oldData ){
            if( this.isRePlaying ) return false;
            var message = '';
            var board = this.Board;
            var card = board.getItemById( id );


            switch( action ){
                case 'init':
                    message += oldData;
                    id = undefined;
                    oldData = undefined;
                break;
                case 'update':
                    $.each( data, function(key, value){
                        switch( key ){
                            case 'position':
                                // console.log( 'position: ' + value );
                                var collection = board.getCollectionByPosition( value );
                                let posName = value;
                                if( collection ){
                                    posName = collection.getName();
                                };
                                message += `<p class="log-step" data-possition="${value}"> <span class="card-key">Move</span> card <span class="log-card-name" data-id="${card.id}">${card.name}</span> to <span class="new-state">${posName}</span> </p>`;

                            break;
                            case 'foldState':
                                message += `<p class="log-step" data-foldState="${value}"> <span class="card-key">Flip</span> card <span class="log-card-name" data-id="${card.id}">${card.name}</span> to <span class="new-state">${value}</span> </p>`;
                                
                            break;
                            break;
                            case 'switchState':
                                message += `<p class="log-step" data-foldState="${value}"> <span class="card-key">Switch</span> card <span class="log-card-name" data-id="${card.id}">${card.name}</span> to <span class="new-state">${value}</span> </p>`;
                                
                            break;
                            default: 
                                message += `<p class="log-step" data-newValue="${value}> Change <span class="card-key">${key}</span> <span class="log-card-name" data-id="${card.id}">${card.name}</span> to <span class="new-state">${value}</span> </p>`;
                            break;
                        }
                    });
                break;

                case 'target':
                    message += `<p class="log-step"> Target card <span class="log-card-name" data-id="${card.id}">${card.name}</span></p>`;
                break;

                case 'declare':
                    console.warn(message);
                    message += `<p class="log-step"> Declared effect of <span class="log-card-name" data-id="${card.id}">${card.name}</span></p>`;
                break;

                case 'reveal':
                    message += `<p class="log-step"> Reveal card <span class="log-card-name" data-id="${card.id}">${card.name}</span></p>`;
                break;

                case 'shuffle':
                    message += `<p class="log-step" data-shuffle="yes"> <span class="new-state"> Shuffle Cards</span> </p>`;
                    id = undefined;
                    oldData = undefined;

                case 'shuffle_deck':
                    message += `<p class="log-step" data-shuffle="yes"> <span class="new-state"> Shuffle Deck</span> </p>`;
                    id = undefined;
                    oldData = undefined;
                break;

            }
            this.steps.push({
                action: action,
                id: id, 
                data: data,
                oldData: oldData||{},
                message: message||'',
            });
            this.messageElm.append( message );
            this.messageElm.stop().animate({scrollTop: this.messageElm.height()}, 300);
            return true;
        }
        // get next step
        step(){
            let isLast = this.isLastStep();
            let step = this.steps[this.pointer++] || 0;
            if( !step ) return false;
            step['isLastStep'] = isLast;
            return step;
        }
        isFirstStep() {
            return this.pointer == 0;
        }
        isLastStep(){
            return this.pointer == this.steps.length - 1;
        }
        // replay
        replay(){
            this.pointer = 0;
            this.isRePlaying = true;
            this.addOverlay();
            // const waitTime = this.options.waitTime || 500;
            this.playStep();
        }
        addOverlay(){
            $('.replay-overlay').fadeIn('300');
        }
        playStep(){
            let step = this.step();
            let log = this;
            if(!step ) {
                this.writeEnd();
                this.stopReplay();
                return false;
            }
            let waitTime = this.options.waitTime || 500;
            let action = step.action || 'update';
            let data = step.data;
            let oldData = step.oldData;
            let board = this.Board;
            switch (action) {
                case 'update': 
                    // var card = board.getItemById( step.id );
                    $.each(data, function( key, value ){
                        log.writeStep(step.message || `Update ${key} to ${value}` );
                        board.updateItem( step.id, key, value );
                    });
                break;
                case 'shuffle':
                    log.writeStep(step.message || ` Shuffle Cards` );
                    // Update from data to cards
                    $.each(data, function( index, item ){
                        // var card = board.getItemById( item.id );
                        $.each( ['collection_order', 'order'], function( i, k ){
                            board.updateItem( item.id, k, item[k] );
                        });
                    });
                case 'shuffle_deck':
                    var position = 'deck';
                    log.writeStep(step.message || ` Shuffle Deck` );
                    // Update from data to cards
                    $.each(data, function( index, item ){
                        // var card = board.getItemById( item.id );
                        $.each( ['collection_order', 'order'], function( i, k ){
                            board.updateItem( item.id, k, item[k] );
                        });
                    });
                    var deck = board.getCollectionByPosition(position);
                    deck.reDraw();
                break;
                case 'init':
                    // var initData = {...data};
                    var initData = [];
                    $.each( data , function( i, item ) {
                        // Copy the properties from the item to initData: amount, collection_order, foldState, id, isExtra, name, order, position, switchState, imageURL
                        initData.push({
                            id: item.id,
                            amount: item.amount,
                            collection_order: item.collection_order,
                            foldState: item.foldState,
                            isExtra: item.isExtra,
                            name: item.name,
                            order: item.order,
                            position: item.position=='hand' ? 'deck' : item.position,
                            switchState: item.switchState,
                            imageURL: item.imageURL,
                        });
                    });
                    // console.log( initData );
                    this.messageElm.empty();
                    board.emptyBoard();
                    board.setItems( initData );
                    log.writeStep(`<p class="highlight-log">START REPLAY</p>` );
                    log.writeStep(step.message || `Initialized board` );

                break;

            }
            this.replaytimeout = setTimeout(function(){
                log.playStep();
            }, waitTime);

            
            // if( this.isLastStep() ){
            //     this.writeEnd();
            // }
        }

        // write step
        writeStep( message){
            this.messageElm.append(`<p>${message}</p>`);
            this.messageElm.stop().animate({scrollTop: this.messageElm.height()}, 300);

        }
        writeEnd(){
            this.writeStep(`<p class="highlight-log">COMPLETE REPLAY!!</p>` );

        }
        // stop replay
        stopReplay(){
            this.pointer = 0;
            this.isRePlaying = false;
            clearTimeout(this.replaytimeout);
            this.removeOverlay();
        }
        removeOverlay(){
            $('.replay-overlay').fadeOut('300');
        }
        // reset
        reset(){
            this.pointer = 0;
            this.isRePlaying = false;
            this.messageElm.empty();
        }
    }
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
                foldState: 'normal',
                switchState: 'attack',
                position: 'deck',
                isExtra: 0,
            };
            $.extend( this, _default, item);
            this.isExtra && ( this.position = 'exdeck'); // if isExtra card then draw it in the extra deck
            // this.isExtra && ( this.canMoveDeck = 0);
            // this.canMoveExDeck = this.isExtra;
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
                var _board = _card.getBoard();
                var cardMenu = _board.cardMenu.setCard(_card);

                cardMenu.show();
            }, function( e ) { 
                // console.log('mouseout');
                var _board = _card.getBoard();
                var cardMenu = _board.cardMenu;
                cardMenu.element.dialog('option', 'appendTo', 'body');
                cardMenu.hide();
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
            newState = newState|| 'normal'; // normal / fold 

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

            this.getBoard().writelog( 'update', this.id, {
                position: this.position,
            }, {
                position: this.itemBefore.position
            } );
            // Draw old collection was moved from
            if( this.position !=  this.itemBefore.position ){
                var collection = this.getBoard().getCollectionByPosition( this.itemBefore.position );
                    collection && collection.drawOnBoard();
            }
            return true;
        }

        // Biến order chỉ dùng cho summon và ST
        moveTo( newPosition, isTop, order, animation, duration ) {
            if(!['hand', 'deck', 'exdeck', 'graveyard','summon','st', 'banish'].includes( newPosition ) ) return false;

            var _card = this;
            var _board = _card.getBoard();
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
            if( _card.canMoveTo ( newPosition) ) {
                // 1
                result = true;
                var to = _card.getNewOffset( newPosition );
                if( animation )_card.doAnimation ( to, animation, duration );
                var newOrder = 0;
                var newCollection = _card.getBoard().getCollectionByPosition( newPosition);
                var items = [];
                if( newCollection ){
                    if( isTop ) {
                        if( newCollection ){
                            let last = newCollection.getTopCard();
                            newOrder = last ? last.collection_order + 2 : 1;
                            _card.collection_order = newOrder;
                        }
                    } else {
                        _card.collection_order = newOrder;
                    }
                } else {
                    _card.collection_order = newOrder;
                }
                if( ['summon', 'st'].includes(newPosition) ){
                    order = order || 1;
                    var _continue = 1;
                    var _stop = 10;
                    while ( _continue && _stop) {
                         var _slot = _board.elm.find('.card-slot.' + newPosition + order + '-slot');
                        if(  ! _slot.find('.card').length ) {
                            _continue = 0;
                            _card.collection_order = order;
                        }

                        order--;
                        _stop --;
                        if( order == 0 ) order = 5;
                    }
                    if( !_stop ) {
                        console.warn('No Space left');
                        return false;
                    }
                }
                // set new position here
                if( _card.itemBefore.position == 'banish' ){
                    _card.fold('normal');
                }
                _card.position = newPosition;

                // reorder newCollection
                if( newCollection ){
                    items = newCollection ? newCollection.getCollectionItems() : [];
                }
                

                if( newPosition != 'summon' ){
                    _card.switchState = 'attack';
                    _card.updateHtml();
                }
                if( newPosition != 'hand' ){
                    // _card.foldState = 'normal';
                    _card.updateHtml();
                }
                if( ! _card.appendToBoard() ){
                    console.warn('Append failed');
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

        // fold state: normal / fold
        fold( newState, animation, duration ) {
            if( !['normal', 'fold'].includes( newState ) ) return false;
            var result = false;
            if( this.canFlip ( newState ) && this.foldState !=newState ) {

                // 1
                if( animation )this.doAnimation ( newState, animation, duration );
                // 1
                // console.log( newState, this.html );
                var oldFlipState = this.foldState;
                this.foldState = newState;
                // set new state here
                this.html.removeClass('normal fold').addClass(newState);
                result = true;

                var collection = this.getBoard().getCollectionByPosition( this.get('position') );
                collection && collection.drawOnBoard();
                // console.log( this.name, this.foldState, collection );
            } else {
                // console.warn( 'Failed to update foldState to ' + newState );
            }
            result &&  this.getBoard().writelog( 'update', this.id, {
                foldState: newState,
            }, {
                foldState: oldFlipState
            } );
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
                var oldSwitchState = this.switchState;
                this.switchState = newState;
                // set new state here
                this.html.removeClass('attack defense').addClass(newState);
            }

            this.getBoard().writelog( 'update', this.id, {
                switchState: newState,
            }, {
                switchState: oldSwitchState
            } );
            return result;
        }
        target(){
            this.getBoard().writelog( 'target', this.id, {});
        }
        
        declare(){
            this.getBoard().writelog( 'declare', this.id, {});
        }
        reveal(){
            this.getBoard().writelog( 'reveal', this.id, {
                collection_position: this.collection_position
            });
            if( this.position === 'hand'){
                //1 
                // Move card to center of Hand
            }
            if( this.position === 'exdeck'){
                //1 // Show image as full screen
                // then move to the Top of the extra deck
            }

        }

        // Draw
        drawHtml( ) {
            var _card = this;
            var backImageSrc = this.options.imgPath + this.options.backImageSrc;
            var frontImageSrc = this.imageURL || (this.options.imgPath + 'card/' + this.name + '.jpeg');
            var cardId = this.id;
            var cardElement = $(`<div id="card-${cardId}" class="card card-id-${cardId}" data-id="${cardId}" title="${_card.name}"/>`);
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
                'foldState',
                'switchState',
                'position',
            ];
            states.forEach( function( stateName ) {
                if (_card[stateName]) {
                    cardElement.addClass(_card[stateName]);
                    cardElement.data( stateName, _card[stateName] );
                }
            });

            cardElement.append(`<span class="card-name">${_card.name}</span>`);
            cardElement.append(`<img src="${backImageSrc}" width="70" height="102" class="card-img back-image"/>`);
            cardElement.append(`<img src="${frontImageSrc}" width="70" height="102" class="card-img front-image""/>`);

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
                'foldState',
                'switchState',
                'position',
            ];
            cardElement.removeClass('normal fold attack defense deck exdeck graveyard banish summon st hand');
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
                    // var summonElm = _board.getFreeSummon();
                    var summonElm = _board.getCardSlot(_card.id);
                    if( !summonElm.length ){
                        return false;
                    }
                    _card.updateHtml();
                    _card.html.appendTo( summonElm );
                    
                    break;
                case'st':
                    // var stElm = _board.getFreeST();
                    var stElm = _board.getCardSlot(_card.id);
                    if( !stElm.length ){
                        return false;
                    }
                    _card.updateHtml();
                    _card.html.appendTo( stElm );
                    
                break;

                case 'hand':
                hand.append( $('<div class="hand-card-container" />').append( _card.html ) );
                break;
                default:
                    return false;

            }
            hand.find('.hand-card-container').filter( function( index, container ) {
                return $(container).is(':empty');
            }).remove();
            return true;
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
    class Collection{
        constructor ( options ) { // Board, name, elm, menuElm, options){
            var _default = {
                'Board': {},
                'name': '',
                'elm': '',
                'menuElm': '', // Đây là dialog, đặt tên nhầm
                'options': {},
                'collection_position': '',
            };
            $.extend(this, _default, options);
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
            this.elm.on('click', '.card img, .collection-count, .ddescription', function(){
                collection.showDialog();
            } );

            // Remove the event when click on card
            // this.menuElm.on('click', '.card img', function(){
            //     var _cardElm = $(this).closest('.card');
            //     // console.log( _cardElm );
            //     var _cardID = _cardElm.data('id');
            //     var _card = _board.getItemById( _cardID );
            //     _card.moveTo('hand');
            // } );

            // Current, only Deck and extra deck have menu
            // but exDeck have only 1 item show skip it
            if( collection.getPosition() == 'deck' ){
                this.elm.hover( function( e ) {
                    var _board = collection.getBoard();
                    var collectionMenu = _board.collectionMenu.setCollection(collection);

                    collectionMenu.show();
                }, function( e ) { 
                    // console.log('mouseout');
                    var _board = collection.getBoard();
                    var collectionMenu = _board.collectionMenu;
                    collectionMenu.element.dialog('option', 'appendTo', 'body');
                    collectionMenu.hide();
                });
            }
        }
        getCards(){
            return this.getBoard().getItemsByPosition(this.collection_position);
        }
        getTopCard(){
            var cards = this.getCards();
            let card = cards.length ? cards[cards.length-1] : false;
            return card;
        }

        // Draw the last card of collection on the board
        // Draw a clone of card.html, do not draw card.html
        drawOnBoard(){
            var cards = this.getCards();
            // count cards
            this.elm.find('.card').remove();
            this.elm.find('.collection-count').children().first().empty().text( cards.length );

            // TODO: check and draw top card with status;
            if( cards.length > 0 ){
                var topCard = this.getTopCard();
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
                        var _dialog = $(this);
                        $('.ui-widget-overlay').unbind('click').bind('click', function(e) {
                            _dialog.dialog('close');
                        });
                    },
                    close: function( event, ui ) {
                        $('.ui-widget-overlay').unbind('click');

                    },
                    position: {
                        my: "top center",
                        at: "top center",
                        of: '#playtest'
                    },
                    classes: {
                        'ui-dialog-titlebar' : 'collection-titlebar',
                        'ui-dialog' : 'ui-dialog-collection-menu',
                    },
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
        getName(){
            return this.name;
        }
        getPosition(){
            return this.collection_position;
        }

        // add / remove card
        appendCard( card, reDraw ){
            // if( reDraw || 0 ){
                card.position = this.collection_position;
                card.updateHtml();
            // }
            this.reDraw();

            // card.html.appendTo(this.menuElm.find('.collection-container'));
            return true;
        }
        reDraw(){
            var collection = this;
            var cards = collection.getCards();
            cards.forEach(card => {
                card.html.prependTo(this.menuElm.find('.collection-container') );
            });
            return true;
        }
        shuffleCollectionCards(){
            var _board = this.getBoard();
            var collection = this;
            var items = collection.getCards();
            // var shuffledArr = items.sort(() => Math.random() - 0.5);
            items.sort(() => Math.random() - 0.5);
            $.each( items, function( index, item ) {
                _board.updateItem( item.id, 'collection_order', index+1 );
            });
            this.reDraw();
            // console.log( collection, collection.getCards(), target );
            
            if( _board.playlog ) _board.writelog('shuffle_deck', undefined, {...items});
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

            this.cardMenuElm = $('#cardMenu');
            this.collectionMenuElm = $('#collectionMenu');

            this.initItems( this.orgitems );
            this.initDeck();
            this.initExDeck();
            this.initGraveyard();
            this.initBanish();

            this.initMenus();


            
            this.shuffleCards();
            this.events();
            this.playlog = new PlayLog({
                'Board': this,
                'name': 'PlayLog',
                'elm': $('.log-message-container'),
                'options': this.options,
                'initItems': {... this.getItems() }
            });

            this.writelog('init',undefined, {... this.getItems() }, `<p> Initialized board with ${this.items.length} cards</p>`);

        }
        // Remove all Item and HTML elements
        emptyBoard(){
            var board = this;
            this.items = [];
            this.elm.find('.card').remove();
            $.each( ['deckMenuElm','exDeckMenuElm','graveyardMenuElm','banishMenuElm', 'cardMenuElm','collectionMenuElm'], function(index, elm){
                board[elm].find('.collection-container').empty();
            });

                
                // $('.collection-count').children().first().empty().text( 0 );
        }
        initItems( ){
            var _board = this;
            this.items = [];
            // console.log( JSON.stringify(this.orgitems ));
            this.orgitems.forEach( function( item ){
                if( _board.validateBeforeAddItem( item ) ){
                    _board.addItem( item );
                }
            });
        }
        initDeck(){
            // this.deck = new Collection( this, 'deck', this.deckElm, this.deckMenuElm,this.options);
            this.deck = new Collection({
                'Board': this,
                'name': 'Deck',
                'elm': this.deckElm,
                'menuElm': this.deckMenuElm,
                'options': this.options,
                'collection_position': 'deck',
            });
        }
        initExDeck(){
            // this.exdeck = new Collection( this, 'exdeck', this.exDeckElm, this.exDeckMenuElm, this.options);
            this.exdeck = new Collection({
                'Board': this,
                'name': 'Extra Deck',
                'elm': this.exDeckElm,
                'menuElm': this.exDeckMenuElm,
                'options': this.options,
                'collection_position': 'exdeck',
            });
        }
        initGraveyard(){
            // this.graveyard = new Collection( this, 'graveyard', this.graveyardElm, this.graveyardMenuElm, this.options);
            this.graveyard = new Collection({
                'Board': this,
                'name': 'Graveyard',
                'elm': this.graveyardElm,
                'menuElm': this.graveyardMenuElm,
                'options': this.options,
                'collection_position': 'graveyard',
            });
            
        }
        initBanish(){
            // this.banish = new Collection( this, 'banish', this.banishElm, this.banishMenuElm, this.options);
            this.banish = new Collection({
                'Board': this,
                'name': 'Banish',
                'elm': this.banishElm,
                'menuElm': this.banishMenuElm,
                'options': this.options,
                'collection_position': 'banish',
            });
            
        }
        initMenus(){
            // var _board = this;
            this.cardMenu = new CardMenu( this.cardMenuElm );
            this.collectionMenu = new CollectionMenu( this.collectionMenuElm );
        }

        // START Events
        events(){
            this.removeHighlight();
            this.selectOrderEvent();

            return true;
        }
        removeHighlight(){
            var board = this;
            board.elm.on('click', function( e ){
                var willRemove = false;
                var _elm = $(e.target);
                if(  _elm.closest('.ui-dialog').length ) {
                    return;
                }
                if(  _elm.closest('.card-slot.highlight').length ) {
                    return;
                }
                if(  _elm.closest('.ui-dialog').length ) {
                    return;
                }
                willRemove = true;

                var highlightElms = board.elm.find('.card-slot.highlight');
                if( highlightElms ){
                    $.each( highlightElms, function( index, highlight){
                        // console.warn('remove highlighting' + this.classes)
                        $(highlight).removeClass( 'highlight');
                    });
                    board.setWaitingActions(false);
                }
            });
        }
        selectOrderEvent(){
            var board = this;
            this.elm.on('click', '.highlight', function( e ){
                var _this = $(this);
                var isSS = _this.hasClass( 'summon-slot');
                var isST = _this.hasClass( 'st-slot');
                var order = _this.data( 'order' );
                var waitingActions = board.getWaitingActions();
                if( order ){
                    board.updateCardbyAction( 
                        waitingActions.card, 
                        waitingActions.newPosition, 
                        order, 
                        waitingActions.newState, waitingActions.isFD
                    );
                }
                var highlightElms = board.elm.find('.card-slot.highlight');
                if( highlightElms ){
                    $.each( highlightElms, function( index, highlight){
                        // console.warn('remove highlighting' + this.classes)
                        $(highlight).removeClass( 'highlight');
                    });
                    board.setWaitingActions(false);
                }
            });
        }
        // END Events
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
            if( this.playlog ) this.writelog('shuffle', undefined, {...this.items});
        }

        // Move
        moveCard( card, to, isTop ){
            card.moveTo( to, isTop );
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
            var items = this.items.filter( function( item ){
                return item.position == position;
            });
            items.sort(function (a, b) { 
                return a.collection_order > b.collection_order ? 1 : -1; 
            });
            items.forEach(function (item, index){
                item.collection_order = index+1;
            } );
            return items;
        }
        getDeckItems(){
            return this.getItemsByPosition('deck');

        }
        getExDeckItems(){
            return this.getItemsByPosition('exdeck');
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

        writelog( action, id, data, oldData ){
            return this.playlog.addStep( action, id, data, oldData||{} );
        }

        // this is private function. do not call from outside
        updateCardbyAction(card, newPosition, order, newState, isFD){
            var isTop = true;
            if( newState ){
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
                    case 'target':
                        card.target();
                    break;

                    case 'declare':
                        card.declare();
                    break;

                    case 'reveal':
                        card.reveal();
                    break;

                    case 'active':
                        newPosition = 'st';
                        order = 5;
                        card.fold('normal');


                }
            } else{
                card.attack();
                card.fold('normal');
            }
            if( isFD ){
                switch( isFD ){
                    case 'bottom':
                        isTop = false;
                    break;
                    case 'fold':
                    case 'normal':
                        card.fold(newState);
                    case 'toendST': 
                    
                }
            }
            if( newPosition != 'this' && newPosition != card.position){
                card.moveTo(newPosition, isTop, order);
            }
            return true;
        }
        setWaitingActions(data){
            this.waitingActions = data;
        }
        set( key, value ){
            this[key] = value;
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

        // Check SS / ST board free only one slot
        // return order of free slot if true
        // return false if wrong
        isSTFreeOne(){
            var frees = [];
            $.each( this.elm.find('.st-slot'), function (i, el ){
                var _el = $(el);
                if( !_el.find('.card').length ){
                    frees.push( _el.data( 'order' ) );
                }
            });
            return frees.length == 1 ? frees[0] : false;
        }
        
        isSSFreeOne(){
            var frees = [];
            $.each( this.elm.find('.summon-slot'), function (i, el ){
                var _el = $(el);
                if( !_el.find('.card').length ){
                    frees.push( _el.data( 'order' ) );
                }
            });
            return frees.length == 1 ? frees[0] : false;
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
        getWaitingActions(){
            return this.waitingActions || false;
        }
        getCardSlot(cardId){
            var board = this;
            var card = this.getItemById(cardId);
            var order = card.get('collection_order');
            var position = card.get('position');
            if( ['summon', 'st'].includes(position) ){
                var elm = board.elm.find('.card-slot.' + position + order + '-slot');
                console.log(elm, ('.card-slot.' + position + order + '.slot'));
                return elm;
            }
            return false;
        }
        selectOrder(position, callback) {
            var waitingActions= this.getWaitingActions();
            if( waitingActions.newPosition ) {
                let newPosition = waitingActions.newPosition;
                let cardHolders = this.highlightCardHolders(newPosition);
                return cardHolders;
            }
            return false;
        }
        highlightCardHolders(position){
            var cardHolderElms = this.getCardHolder(position);
            this.elm.find('.card-slot ').removeClass('highlight');
            
            // Highlight when slot is empty
            if(! cardHolderElms.find('.card').length ){
                cardHolderElms.addClass('highlight');
            }
            return cardHolderElms;

        }
        getCardHolder(position){
            return this.elm.find('.' + position + '-slot.card-slot ')
        }





        
    }

    $(document).ready(function() {
        const isDebug = urlParams.get('debug');
        board = new Board( $('#playtest'), boardData, {
            isDebug: isDebug,
        } );
        console.log(board);

    });
// });
//s