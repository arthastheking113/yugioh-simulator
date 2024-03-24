'use strict';
class MenuBase {
    constructor(element, options) {
        this.element = element;
        this.options = $.extend( {}, options);
        this.dialog = {};
        this.init();
    }
    init(){
        this.drawHtml(this.options);
        this.createDialog();
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
            show: { effect: "blind", duration: 50 },
        });
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
        this.events();
    }
    beforeShow() {
        var card = this.getCard();
        var cardElm = card.html;
        // cardElm.addClass('card-hover');
        this.element.dialog('option', 'appendTo', '#' + cardElm.attr('id'));
        this.element.dialog('option', 'position', {
            my: "center bottom",
            at: "center top",
            of: '#' + cardElm.attr('id')
        });

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

        var stElm = _board.getFreeST();
        if( !stElm.length ){
            ul.find(`a[data-position="st"]`).hide();
        }
    }
    drawHtml(){
        // console.log( this.element );
        var ul = this.element.find('ul');
        // list actions to S/T, To Bottom of Deck, to Top of Deck, Banish, Banish FD, To Graveyard, to S Summon DEF, to S Summon ATK, to Hand
        ul.append(`
            <li class="menuItem"><a href="javascript:void(0)" data-position="st" data-switch-state="" data-target="st">To S/T</a></li>
        `);
        ul.append(`
            <li class="menuItem"><a href="javascript:void(0)" data-position="banish" data-switch-state="" data-target="banish,normal">Banish</a></li>
        `);
        ul.append(`
            <li class="menuItem"><a href="javascript:void(0)" data-position="deck" data-switch-state="" data-target="deck,bottom">To B Deck</a></li>
        `);
        ul.append(`
            <li class="menuItem"><a href="javascript:void(0)" data-position="deck" data-switch-state="" data-target="deck">To Top Deck</a></li>
        `);
        ul.append(`
            <li class="menuItem"><a href="javascript:void(0)" data-position="banish" data-switch-state="" data-target="banish,flipped">Banish FD</a></li>
        `);
        ul.append(`
            <li class="menuItem"><a href="javascript:void(0)" data-position="graveyard" data-switch-state="" data-target="graveyard">To Graveyard</a></li>
        `);
        ul.append(`
            <li class="menuItem"><a href="javascript:void(0)" data-position="hand" data-switch-state="" data-target="hand">To Hand</a></li>
        `);
        ul.append(`
            <li class="menuItem"><a href="javascript:void(0)" data-position="summon" data-switch-state="defense" data-target="summon,def">To Summon DEF</a></li>
        `);
        ul.append(`
            <li class="menuItem"><a href="javascript:void(0)" data-position="summon" data-switch-state="attack" data-target="summon,atk">To Summon ATK</a></li>
        `);
        ul.append(`
            <li class="menuItem"><a href="javascript:void(0)" data-position="this" data-switch-state="attack" data-target="this,atk">To ATK</a></li>
        `);
        ul.append(`
            <li class="menuItem"><a href="javascript:void(0)" data-position="this" data-switch-state="defense" data-target="this,def">To DEF</a></li>
        `);
    }
    events(){
        var menu = this;
        this.element.on('click','ul li a', function(){
            var _this = this;
            var card = menu.getCard();
            var target = $(this).data('target');

            target = target.split(',');
            var newPosition = target[0];
            if( newPosition != 'this' && !card.canMoveTo( newPosition ) ){
                return false;
            }
            if( target[1] ){
                let newState = target[1];
                switch( newState ){
                    case 'def':
                        card.defense();
                        break;
                    case 'atk':
                        card.attack();
                        break;
                    case 'flipped':
                    case 'normal':
                        card.flip(newState);
                        break;
                }
            }else{
                card.attack();
                card.flip('normal');
            }
            menu.dialog.dialog('close');
            card.moveTo(newPosition);
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
    }
    updateMenu(){

    }
    drawHtml(){
        //List actions: View, Banish FD, Banish T., Mill, Shuffle, Draw

    }

}