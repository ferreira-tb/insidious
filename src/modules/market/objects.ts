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

class OwnMarketOffers implements ResourceRatio {
    readonly wood!: number;
    readonly stone!: number;
    readonly iron!: number;
    readonly storage_max!: number;
    readonly total!: number;
    readonly mean!: number;

    readonly surplus!: ResourceNameAndAmount;
    readonly shortage!: ResourceNameAndAmount;
    
    constructor() {
        // Recursos procurados.
        const wantedResources = new ResourceAmount();

        const selector = '#own_offers_table tr.offer_container[id^="offer_"]';
        const ownOffersRows = Array.from(document.querySelectorAll(selector)) as HTMLTableRowElement[];

        for (const row of ownOffersRows) {
            const count = row.getAttribute('data-count');
            if (!count) throw new InsidiousError('Não foi possível determinar a quantidade de ofertas.');
            const offerAmount = Number.parseInt(count, 10);
            if (Number.isNaN(offerAmount)) throw new InsidiousError('A quantidade de ofertas é inválida.');

            Assets.list.resources.forEach((res) => {
                const wanted = row.getAttribute(`data-wanted_${res}`);
                if (!wanted) throw new InsidiousError(`Não foi possível determinar o recurso em oferta (${res.toUpperCase()}).`);
                const wantedAmount = Number.parseInt(wanted, 10);
                if (Number.isNaN(wantedAmount)) {
                    const errorMsg = `Não foi possível determinar a quantidade de ${res.toUpperCase()} desejada.`;
                    throw new InsidiousError(errorMsg);
                };

                wantedResources[res] += wantedAmount * offerAmount;
            });
        };

        const wood = Insidious.raw_game_data.village.wood + wantedResources.wood;
        const stone = Insidious.raw_game_data.village.stone + wantedResources.stone;
        const iron = Insidious.raw_game_data.village.iron + wantedResources.iron;

        const resources = new ResourceRatio(wood, stone, iron);
        for (const [key, value] of Object.entries(resources)) {
            this[key as keyof ResourceRatio] = value;
        };
    };
};