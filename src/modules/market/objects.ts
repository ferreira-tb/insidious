class MarketStatus {
    /** Mercadores fora da aldeia. */
    readonly trader_away = Insidious.raw_game_data.village.trader_away;
    /** Quantidade de mercadores na aldeia. */
    readonly trader_amount = Insidious.raw_game_data.trader_amount;
    /** Quantidade total de mercadores. */
    readonly trader_total = this.trader_away + this.trader_amount;

    /** Capacidade individual do mercador. */
    readonly trader_carry = Insidious.raw_game_data.trader_carry;
    /** Capacidade total de carga dos mercadores. */
    readonly trader_capacity = this.trader_amount * this.trader_carry;

    constructor() {
        this.verifyIntegrity();
    };

    /** Verifica se os dados obtidos são válidos. */
    verifyIntegrity() {
        for (const [key, value] of Object.entries(this)) {
            if (value === null || value === undefined) {
                throw new InsidiousError(`Não foi possível obter o seguinte dado: ${key.toUpperCase()}.`);
            };
        };
    };
};