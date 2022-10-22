class Dealer {
    private static readonly average = new AverageExchangeRate(Game.premium_exchange);

    static async start() {
        console.log(this.average);
    };
};