class MarketStatus {
    readonly merchant: MerchantAmount = {
        available: null,
        total: Game.trader_total,
        carry: Game.trader_carry
    };

    constructor() {
        const availableField = document.querySelector('#market_status_bar #market_merchant_available_count');
        const available = availableField?.textContent?.trim();
        if (available) this.merchant.available = Number.parseInt(available, 10);
        if (Number.isNaN(this.merchant.available)) throw new InsidiousError('A quantidade de mercadores é inválida.');
    };
};

class ExchangeRate {
    /** Taxa de troca para a madeira. */
    readonly wood_rate: number;
    /** Taxa de troca para a argila. */
    readonly stone_rate: number;
    /** Taxa de troca para o ferro. */
    readonly iron_rate: number;
    /** Data do momento no qual os dados foram obtidos. */
    readonly date = Date.now();

    constructor() {
        const woodRateField = document.querySelector('td#premium_exchange_rate_wood div.premium-exchange-sep');
        if (!woodRateField) throw new InsidiousError('DOM: td#premium_exchange_rate_wood div.premium-exchange-sep');
        const woodRate = woodRateField.textContent?.replace(/\D/g, '');
        if (!woodRate) throw new InsidiousError('Não foi possível obter a taxa de troca para a madeira');

        const stoneRateField = document.querySelector('td#premium_exchange_rate_stone div.premium-exchange-sep');
        if (!stoneRateField) throw new InsidiousError('DOM: td#premium_exchange_rate_stone div.premium-exchange-sep');
        const stoneRate = stoneRateField.textContent?.replace(/\D/g, '');
        if (!stoneRate) throw new InsidiousError('Não foi possível obter a taxa de troca para a argila');

        const ironRateField = document.querySelector('td#premium_exchange_rate_iron div.premium-exchange-sep');
        if (!ironRateField) throw new InsidiousError('DOM: td#premium_exchange_rate_iron div.premium-exchange-sep');
        const ironRate = ironRateField.textContent?.replace(/\D/g, '');
        if (!ironRate) throw new InsidiousError('Não foi possível obter a taxa de troca para o ferro');

        this.wood_rate = Number.parseInt(woodRate, 10);
        if (Number.isNaN(this.wood_rate)) throw new InsidiousError('A taxa de troca para a madeira é inválida.');

        this.stone_rate = Number.parseInt(stoneRate, 10);
        if (Number.isNaN(this.stone_rate)) throw new InsidiousError('A taxa de troca para a argila é inválida.');

        this.iron_rate = Number.parseInt(ironRate, 10);
        if (Number.isNaN(this.iron_rate)) throw new InsidiousError('A taxa de troca para o ferro é inválida.');
    };
};

class Transaction extends ExchangeRate {
    /** Estoque de madeira. */
    readonly wood_stock: number;
    /** Estoque de argila. */
    readonly stone_stock: number;
    /** Estoque de ferro. */
    readonly iron_stock: number;

    /** Capacidade total do estoque de madeira. */
    readonly wood_capacity: number;
    /** Capacidade total do estoque de argila. */
    readonly stone_capacity: number;
    /** Capacidade total do estoque de ferro. */
    readonly iron_capacity: number;

    readonly buy_wood: HTMLInputElement;
    readonly buy_stone: HTMLInputElement;
    readonly buy_iron: HTMLInputElement;

    readonly sell_wood: HTMLInputElement;
    readonly sell_stone: HTMLInputElement;
    readonly sell_iron: HTMLInputElement;

    /** Botão para calcular a melhor oferta. */
    private readonly submit: HTMLInputElement;

    constructor() {
        super();
        
        // Estoque.
        const woodStockField = document.querySelector('td#premium_exchange_stock_wood');
        if (!woodStockField) throw new InsidiousError('DOM: td#premium_exchange_stock_wood');
        const woodStock = woodStockField.textContent?.replace(/\D/g, '');
        if (!woodStock) throw new InsidiousError('Não foi possível obter o estoque de madeira');

        const stoneStockField = document.querySelector('td#premium_exchange_stock_stone');
        if (!stoneStockField) throw new InsidiousError('DOM: td#premium_exchange_stock_stone');
        const stoneStock = stoneStockField.textContent?.replace(/\D/g, '');
        if (!stoneStock) throw new InsidiousError('Não foi possível obter o estoque de argila.');

        const ironStockField = document.querySelector('td#premium_exchange_stock_iron');
        if (!ironStockField) throw new InsidiousError('DOM: td#premium_exchange_stock_iron');
        const ironStock = ironStockField.textContent?.replace(/\D/g, '');
        if (!ironStock) throw new InsidiousError('Não foi possível obter o estoque de ferro.');

        this.wood_stock = Number.parseInt(woodStock, 10);
        if (Number.isNaN(this.wood_stock)) throw new InsidiousError('O estoque de madeira é inválido.');

        this.stone_stock = Number.parseInt(stoneStock, 10);
        if (Number.isNaN(this.stone_stock)) throw new InsidiousError('O estoque de argila é inválido.');

        this.iron_stock = Number.parseInt(ironStock, 10);
        if (Number.isNaN(this.iron_stock)) throw new InsidiousError('O estoque de ferro é inválido.');

        // Capacidade total.
        const woodCapacityField = document.querySelector('td#premium_exchange_capacity_wood');
        if (!woodCapacityField) throw new InsidiousError('DOM: td#premium_exchange_capacity_wood');
        const woodCapacity = woodCapacityField.textContent?.replace(/\D/g, '');
        if (!woodCapacity) throw new InsidiousError('Não foi possível obter a capacidade do estoque de madeira');

        const stoneCapacityField = document.querySelector('td#premium_exchange_capacity_stone');
        if (!stoneCapacityField) throw new InsidiousError('DOM: td#premium_exchange_capacity_stone');
        const stoneCapacity = stoneCapacityField.textContent?.replace(/\D/g, '');
        if (!stoneCapacity) throw new InsidiousError('Não foi possível obter a capacidade do estoque de argila');

        const ironCapacityField = document.querySelector('td#premium_exchange_capacity_iron');
        if (!ironCapacityField) throw new InsidiousError('DOM: td#premium_exchange_capacity_iron');
        const ironCapacity = ironCapacityField.textContent?.replace(/\D/g, '');
        if (!ironCapacity) throw new InsidiousError('Não foi possível obter a capacidade do estoque de ferro');

        this.wood_capacity = Number.parseInt(woodCapacity, 10);
        if (Number.isNaN(this.wood_capacity)) throw new InsidiousError('A capacidade do estoque de madeira é inválida.');

        this.stone_capacity = Number.parseInt(stoneCapacity, 10);
        if (Number.isNaN(this.stone_capacity)) throw new InsidiousError('A capacidade do estoque de argila é inválida.');

        this.iron_capacity = Number.parseInt(ironCapacity, 10);
        if (Number.isNaN(this.iron_capacity)) throw new InsidiousError('A capacidade do estoque de ferro é inválida.');

        // Caixas de texto (compra).
        const buyWoodSelector = '#premium_exchange_buy_wood div input[data-resource="wood" i]';
        this.buy_wood = document.querySelector(buyWoodSelector) as HTMLInputElement;
        if (!this.buy_wood) throw new InsidiousError(`DOM: ${buyWoodSelector}`);

        const buyStoneSelector = '#premium_exchange_buy_stone div input[data-resource="stone" i]';
        this.buy_stone = document.querySelector(buyStoneSelector) as HTMLInputElement;
        if (!this.buy_stone) throw new InsidiousError(`DOM: ${buyStoneSelector}`);

        const buyIronSelector = '#premium_exchange_buy_iron div input[data-resource="iron" i]';
        this.buy_iron = document.querySelector(buyIronSelector) as HTMLInputElement;
        if (!this.buy_iron) throw new InsidiousError(`DOM: ${buyIronSelector}`);

        // Caixas de texto (venda).
        const sellWoodSelector = '#premium_exchange_sell_wood div input[data-resource="wood" i]';
        this.sell_wood = document.querySelector(sellWoodSelector) as HTMLInputElement;
        if (!this.sell_wood) throw new InsidiousError(`DOM: ${sellWoodSelector}`);

        const sellStoneSelector = '#premium_exchange_sell_stone div input[data-resource="stone" i]';
        this.sell_stone = document.querySelector(sellStoneSelector) as HTMLInputElement;
        if (!this.sell_stone) throw new InsidiousError(`DOM: ${sellStoneSelector}`);

        const sellIronSelector = '#premium_exchange_sell_iron div input[data-resource="iron" i]';
        this.sell_iron = document.querySelector(sellIronSelector) as HTMLInputElement;
        if (!this.sell_iron) throw new InsidiousError(`DOM: ${sellIronSelector}`);

        // Botão para calcular a melhor oferta.
        const submitSelector = 'input[class*="btn-premium-exchange-buy"][type="submit"][value*="Calcular" i]';
        this.submit = document.querySelector(submitSelector) as HTMLInputElement;
        if (!this.submit) throw new InsidiousError(`DOM: ${submitSelector}`);
    };

    finish() {
        this.submit.click();
    };
};

class AverageExchangeRate {
    readonly yesterday: ResourceAmount = {
        wood: 0,
        stone: 0,
        iron: 0
    };

    readonly total: ResourceAmount = {
        wood: 0,
        stone: 0,
        iron: 0
    };

    constructor(data: PremiumExchangeData) {
        Assets.list.resources.forEach((res) => {
            const average =  data[`average_${res}_rate`];
            if (!average) throw new InsidiousError('Não foi possível obter dados sobre o histórico da Troca Premium.');

            // Organiza da data mais recente para a mais antiga.
            average.sort((a, b) => b[0] - a[0]);

            this.yesterday[res] = Number.parseInt(average[0][1], 10);
            const errorMessage = `Não foi possível determinar a taxa média de ontem (${res}).`;
            if (Number.isNaN(this.yesterday[res])) throw new InsidiousError(errorMessage);

            for (const rate of average) {
                this.total[res] += Number.parseInt(rate[1], 10);
            };

            this.total[res] = Math.round(this.total[res] / average.length);
            if (Number.isNaN(this.total[res])) {
                throw new InsidiousError(`Não foi possível determinar a taxa média da semana (${res}).`);
            };
        }, this);
    };
};