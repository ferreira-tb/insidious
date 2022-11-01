class TWMarket {
    // private static status = new MarketStatus();

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
        const sortedResources = await this.sortResources();
        

    };

    private static async sortResources() {
        await Insidious.updateGameData();
        const resources = new Resources();

        const resourceAmount: [ResourceList, number][] = [];
        Assets.list.resources.forEach((res) => {
            const amount: [ResourceList, number] = [res, resources[res]];
            resourceAmount.push(amount);
        });

        return resourceAmount.sort((a, b) => b[1] - a[1]);
    };
};