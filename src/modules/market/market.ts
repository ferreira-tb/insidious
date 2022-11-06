class TWMarket {
    /** Informações sobre o estado atual do mercado. */
    static readonly status = new MarketStatus();

    static async open() {
        switch (Game.mode) {
            case 'own_offer': return this.showOwnOfferOptions();
        };
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
        await Insidious.updateGameData();
        const resources = new OwnMarketOffers();

        /** Diferença entre o recurso em excesso e a média. */
        const diffSurplusToMean = resources.surplus.amount - resources.mean;
        // Retorna caso a diferença seja menor que a capacidade de carga de um mercador.
        if (diffSurplusToMean < this.status.trader_carry) {
            const message = new UIMessage('Os recursos já estão balanceados.');
            return Insidious.showUIMessage(message);
        };

        const ownOfferForm = document.querySelector('form#own_offer_form');
        if (!ownOfferForm) throw new InsidiousError('DOM: form#own_offer_form');

        // Venda.
        const sellAmount = ownOfferForm.querySelector('tbody tr td input#res_sell_amount') as HTMLInputElement | null;
        if (!sellAmount) throw new InsidiousError('DOM: tbody tr td input#res_sell_amount');
        sellAmount.value = this.status.trader_carry.toString(10);

        const sellSelector = `#res_sell_selection #res_sell_${resources.surplus.name}`;
        const sellInput = ownOfferForm.querySelector(sellSelector) as HTMLInputElement | null;
        if (!sellInput) throw new InsidiousError(`DOM: ${sellSelector}`);
        sellInput.checked = true;

        // Compra.
        const buyAmount = ownOfferForm.querySelector('tbody tr td input#res_buy_amount') as HTMLInputElement | null;
        if (!buyAmount) throw new InsidiousError('DOM: tbody tr td input#res_buy_amount');
        buyAmount.value = this.status.trader_carry.toString(10);

        const buySelector = `#res_buy_selection #res_buy_${resources.shortage.name}`;
        const buyInput = ownOfferForm.querySelector(buySelector) as HTMLInputElement | null;
        if (!buyInput) throw new InsidiousError(`DOM: ${buySelector}`);
        buyInput.checked = true;

        const offerAmount = ownOfferForm.querySelector('tbody tr td input[name="multi"][type="text"]') as HTMLInputElement | null;
        if (!offerAmount) throw new InsidiousError('DOM: tbody tr td input[name="multi"][type="text"]');

        // Quantidade de ofertas que serão criadas.
        let amount = Math.floor(diffSurplusToMean / this.status.trader_carry);
        if (amount > this.status.trader_amount) amount = this.status.trader_amount;
        if (amount < 1) amount = 0;

        // Impede que o recurso em escassez supere a mediana.
        const updatedShortageAmount = () => (amount * this.status.trader_carry) + resources.shortage.amount;
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
};