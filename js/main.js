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

// Basic / Advanced view toggle: hide or show the side columns
// (card overview on the left, log on the right). On mobile the left
// column is already hidden, so the toggle only affects the log.
function boardModeEvent() {
    var $container = $('.play-board-container');
    var $btn = $('#board-mode-toggle');
    if (!$btn.length) return;

    var mobileQuery = window.matchMedia('(max-width: 1199px)');

    function isMobile() {
        return mobileQuery.matches;
    }

    function render() {
        var basic = $container.hasClass('basic-mode');
        var label = isMobile()
            ? (basic ? 'Show Logs' : 'Hide Logs')
            : (basic ? 'Basic' : 'Advanced');
        $btn.find('.board-mode-label').text(label);
        $btn.find('i')
            .toggleClass('fa-eye', !basic)
            .toggleClass('fa-eye-slash', basic);
        $btn.toggleClass('is-basic', basic);
        $btn.attr('aria-pressed', basic ? 'true' : 'false');
    }

    function apply(basic, persist) {
        $container.toggleClass('basic-mode', basic);
        if (persist) {
            localStorage.setItem('BoardViewMode', basic ? 'basic' : 'advanced');
        }
        render();
    }

    // Basic is the default view (columns hidden, board expanded);
    // only switch to Advanced if the user explicitly chose it before.
    var stored = localStorage.getItem('BoardViewMode');
    apply(stored ? stored === 'basic' : true, false);

    $btn.click(function () {
        apply(!$container.hasClass('basic-mode'), true);
    });

    // Re-render the label when crossing the mobile breakpoint
    // (Basic/Advanced on desktop vs Hide Logs/Show Logs on mobile).
    if (mobileQuery.addEventListener) {
        mobileQuery.addEventListener('change', render);
    } else if (mobileQuery.addListener) {
        mobileQuery.addListener(render); // older Safari
    }
    $(window).resize(render);
}

const urlParams = new URLSearchParams(window.location.search);
const isDebug = urlParams.get('debug');
if (isDebug) {
    $('body').addClass('devMode');
}
$(document).ready(function () {
    toolsEvent();
    boardModeEvent();
    // setCardSize();
    $('html').scrollTop( $('#playtest').offset().top - 20 );

});
// $(window).resize(function () {
//     setCardSize();

// });
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
$('body').on('click', '.simulator-card', function (event) {
    _clickCard = $(this).data('id');
});