var boardData = {
    "name": "420 Hazyyyyy",
    "author": "DBGxOsO",
    "created": "2018-01-18",
    "skill": "Beatdown!",
    "main": [
        {
            "name": "Hazy Flame Cerbereus",
            id: "card1",
            "amount": 1
        }, {
            "name": "Hazy Flame Cerbereus",
            id: "card2",
            "amount": 1,
            "switchState": "defense"
        }, {
            "name": "Hazy Flame Cerbereus",
            id: "card3",
            "amount": 1,
            "switchState": "defense"
        }, {
            "name": "Hazy Flame Sphynx",
            id: "card4",
            "amount": 1,
            "switchState": "defense"
        }, {
            "name": "Hazy Flame Sphynx",
            id: "card5",
            "amount": 1
        }, {
            "name": "Hazy Flame Sphynx",
            id: "card6",
            "amount": 1
        }, {
            "name": "Chow Len the Prophet",
            id: "card7",
            "amount": 1
        }, {
            "name": "Earth Armor Ninja",
            id: "card8",
            "amount": 1
        }, {
            "name": "Earth Armor Ninja",
            id: "card9",
            "amount": 1
        }, {
            "name": "Earth Armor Ninja",
            id: "card10",
            "amount": 1
        }, {
            "name": "Hazy Flame Peryton",
            id: "card11",
            "amount": 1
        }, {
            "name": "Hazy Flame Peryton",
            id: "card12",
            "amount": 1
        }, {
            "name": "Hazy Flame Peryton",
            id: "card13",
            "amount": 1
        }, {
            "name": "Sphere Kuriboh",
            id: "card14",
            "amount": 1
        }, {
            "name": "Anti-Magic Arrows",
            id: "card15",
            "amount": 1
        }, {
            "name": "Anti-Magic Arrows",
            id: "card16",
            "amount": 1
        }, {
            "name": "Anti-Magic Arrows",
            id: "card17",
            "amount": 1
        }, {
            "name": "Mausoleum of the Emperor",
            id: "card18",
            "amount": 1
        }, {
            "name": "Mausoleum of the Emperor",
            id: "card19",
            "amount": 1
        }, {
            "name": "Mausoleum of the Emperor",
            id: "card20",
            "amount": 1
        }, {
            "name": "Mausoleum of the Emperor",
            id: "card21",
            "amount": 1,
            "position": "extra_deck",
        }, {
            "name": "Mausoleum of the Emperor",
            id: "card22",
            "amount": 1,
            "position": "extra_deck",
        }, {
            "name": "Mausoleum of the Emperor",
            id: "card23",
            "amount": 1,
            "position": "extra_deck",
        }, {
            "name": "Mausoleum of the Emperor",
            id: "card24",
            "amount": 1,
            "position": "extra_deck",
        }, {
            "name": "Mausoleum of the Emperor",
            id: "card25",
            "amount": 1,
            "position": "extra_deck",
        }
    ],
    // "extra": [],
    "notes": [{
        "text": "First time KOG. Been playing since day one. Used a Phoenix build for most of my climb the. Switched to this in legend."
    }],
    "url": "/top-decks/january-2018/hazy-flame-br/420-hazyyyyy-by-dbgxoso/"
};

function toolsEvent(){
    $('.dice').click(function () {
        let die = [
            'asset/dice1.png',
            'asset/dice2.png',
            'asset/dice3.png',
            'asset/dice4.png',
            'asset/dice5.png',
            'asset/dice6.png',
        ];

        let faceValue = Math.floor(Math.random() * 6);
        $('#results').hide().html(`<img width="55" height="55" src=${die[faceValue]} />`).fadeIn();
    });

    $('.coin').click(function () {
        return (Math.floor(Math.random() * 2) == 0) ? 
            $('#results').hide().html(`<img width="60px" src="asset/coin.png"/>`).fadeIn() : 
            $('#results').hide().html(`<img width="60px" src="asset/N2dFEVu.png"/>`).fadeIn();
    });

    $('#deal').click(function () {
        if( typeof board == 'undefined') return false;
        board.deckToHand( 1, 'top');
    })
    $('#new').click(function () {
        location.reload();
    })
    $('#shuffle').click(function () {
        if( typeof board == 'undefined') return false;
        board.shuffleCards();
        // console.log( board.items.map(function (item) { 
        //     console.log( item.id, item.name );
        //     return OK;
        // }).join('') );
    })
    
}
$(document).ready(function () {
    toolsEvent();

});