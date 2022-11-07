class TWMarket {
    /** Informações sobre o estado atual do mercado. */
    static data: MarketData;

    static async open() {
        await this.updateMarketData();
        this.data = new MarketData();

        switch (Game.mode) {
            case 'own_offer': return this.showOwnOfferOptions();
        };
    };

    /** Atualiza os dados sobre o mercado. */
    private static updateMarketData() {
        return new Promise<void>((resolve) => {
            const request = async (e: MessageEvent<WindowMessageFromPage>) => {
                if (e?.data?.direction === 'from-tribalwars') {
                    window.removeEventListener('message', request);
                    
                    if (!e.data.market_data) throw new InsidiousError('Não foi possível obter informações sobre o mercado.');

                    this.#raw_market_data = e.data.market_data;
                    resolve();
                };
            };

            const bridge = new Bridge('get-market-data');
            window.addEventListener('message', request);
            window.postMessage(bridge);
        });
    };

    private static showOwnOfferOptions() {
        const ownOfferForm = document.querySelector('form#own_offer_form');
        if (!ownOfferForm) throw new InsidiousError('DOM: form#own_offer_form');

        const lineBreak = ownOfferForm.querySelector('br:first-of-type');
        if (lineBreak) ownOfferForm.removeChild(lineBreak);

        // Elementos da extensão.
        const buttonArea = new Manatsu({ class: 'ins_button_area' }).createAfter(ownOfferForm.firstElementChild);
        new Manatsu('button', buttonArea, { class: 'ins_button', text: 'Balancear' }).create()
            .addEventListener('click', (e) => {
                e.preventDefault();
                this.balanceResourcesCreatingOffers()
                    .catch((err: unknown) => InsidiousError.handle(err));
            });
    };

    private static async balanceResourcesCreatingOffers() {
        // Retorna caso não existam mercadores disponíveis.
        if (this.data.trader_amount === 0) {
            const message = new UIMessage('Não há mercadores disponíveis.', 'error');
            return Insidious.showUIMessage(message);
        };

        await Insidious.updateGameData();
        const resources = new OwnMarketOffers();

        /** Diferença entre o recurso em excesso e a média. */
        const diffSurplusToMean = resources.surplus.amount - resources.mean;
        // Retorna caso a diferença seja menor que a capacidade de carga de um mercador.
        if (diffSurplusToMean < this.data.trader_carry) {
            const message = new UIMessage('Os recursos já estão balanceados.');
            return Insidious.showUIMessage(message);
        };

        const ownOfferForm = document.querySelector('form#own_offer_form');
        if (!ownOfferForm) throw new InsidiousError('DOM: form#own_offer_form');

        // Venda.
        const sellAmount = ownOfferForm.querySelector('tbody tr td input#res_sell_amount') as HTMLInputElement | null;
        if (!sellAmount) throw new InsidiousError('DOM: tbody tr td input#res_sell_amount');
        sellAmount.value = this.data.trader_carry.toString(10);

        const sellSelector = `#res_sell_selection #res_sell_${resources.surplus.name}`;
        const sellInput = ownOfferForm.querySelector(sellSelector) as HTMLInputElement | null;
        if (!sellInput) throw new InsidiousError(`DOM: ${sellSelector}`);
        sellInput.checked = true;

        // Compra.
        const buyAmount = ownOfferForm.querySelector('tbody tr td input#res_buy_amount') as HTMLInputElement | null;
        if (!buyAmount) throw new InsidiousError('DOM: tbody tr td input#res_buy_amount');
        buyAmount.value = this.data.trader_carry.toString(10);

        const buySelector = `#res_buy_selection #res_buy_${resources.shortage.name}`;
        const buyInput = ownOfferForm.querySelector(buySelector) as HTMLInputElement | null;
        if (!buyInput) throw new InsidiousError(`DOM: ${buySelector}`);
        buyInput.checked = true;

        const offerAmount = ownOfferForm.querySelector('tbody tr td input[name="multi"][type="text"]') as HTMLInputElement | null;
        if (!offerAmount) throw new InsidiousError('DOM: tbody tr td input[name="multi"][type="text"]');

        // Quantidade de ofertas que serão criadas.
        let amount = Math.floor(diffSurplusToMean / this.data.trader_carry);
        // Ajusta caso a quantidade de ofertas seja maior do que o número de mercadores disponíveis.
        if (amount > this.data.trader_amount) amount = this.data.trader_amount;
        // Não cria ofertas caso a diferença entre o excesso e a média seja muito pequena.
        if (amount < 1) amount = 0;

        // Impede que o recurso em escassez supere a média.
        const updatedShortageAmount = () => (amount * this.data.trader_carry) + resources.shortage.amount;
        while (updatedShortageAmount() > resources.mean) amount--;

        offerAmount.value = amount.toString(10);
        if (amount === 0) {
            const message = new UIMessage('Os recursos já estão balanceados.');
            return Insidious.showUIMessage(message);
        };

        const submit = ownOfferForm.querySelector('input#submit_offer[type="submit"]') as HTMLInputElement | null;
        if (!submit) throw new InsidiousError('DOM: input#submit_offer[type="submit"]');
        submit.click();
    };

    static #raw_market_data: TribalWarsMarketData;
    static get raw_market_data() { return this.#raw_market_data };
};