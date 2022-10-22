class TWMarket {
    // private static readonly status = new MarketStatus();

    static async open() {
        if (Game.mode === 'exchange') await Dealer.start();
    };
};