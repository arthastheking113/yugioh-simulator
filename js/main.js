var duration = 300; // For animation
function toolsEvent() {
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
        if (typeof board == 'undefined') return false;
        board.deckToHand(1, 'top');
    })
    $('#new').click(function () {
        location.reload();
    })
    $('#shuffle').click(function () {
        if (typeof board == 'undefined') return false;
        board.shuffleCards();
    })

}

const urlParams = new URLSearchParams(window.location.search);
const isDebug = urlParams.get('debug');
if (isDebug) {
    $('body').addClass('devMode');
}
$(document).ready(function () {
    toolsEvent();
    setCardSize();

});
$(window).resize(function () {
    setCardSize();

});
function sleep(ms, message) {
    if (message) console.log(message);
    return new Promise(resolve => setTimeout(resolve, ms));
}
function setCardSize() {
    var cardSlots = $('.holder-slot')
    cardSlots.width('');
    var cardSlot = cardSlots.first();
    cardSlots.height(cardSlot.width());
    cardSlots.width(cardSlot.width());
}
var _clickCard = 0;
$('body').on('click', '.card', function (event) {
    _clickCard = $(this).data('id');
});