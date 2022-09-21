class Utils {
    static #currentScreen(): string | null {
        for (const item of this.#urlFields()) {
            if (item.includes('screen=')) return item.replace('screen=', '');
        };
        return null;
    };

    static #currentVillage(): string | null {
        for (const item of this.#urlFields()) {
            if (item.includes('village=')) return item.replace('village=', '');
        };
        return null;
    };

    static #currentPlayer() {
        return new Promise((resolve, reject) => {
            const village = 'village' + this.#currentVillage();
            Insidious.storage.get(village)
                .then((result) => resolve(result[village]?.player))
                .catch((err) => reject(err));
        });
    };

    static #urlFields(): string[] {
        return (location.search.replace('\?', '')).split('\&');
    };

    // Corrige os nomes codificados ("Aldeia+de+b%C3%A1rbaros" se torna "Aldeia de bárbaros").
    static #urlDecode(url: string) {
        return decodeURIComponent(url.replace(/\+/g, ' '));
    };

    // Calcula distância em campos entre duas coordenadas.
    static #calcDistance(...args: number[]) {
        const [originX, originY, destinationX, destinationY] = args;
        return Math.sqrt(((destinationX - originX) ** 2) + ((destinationY - originY) ** 2));
    };

    // Gera um número inteiro entre dois outros inteiros.
    static #generateIntegerBetween(min: number, max: number) {
        return Math.floor(Math.random() * (max - min) + min);
    };

    static #modal(modalTitle: string) {
        const blurBG = new Manatsu({ id: 'insidious_blurBG' }, document.body).create();
        const modalWindow = new Manatsu({ id: 'insidious_modal' }, document.body).create();

        const modalCtrl = new AbortController();
        blurBG.addEventListener('closemodal', () => {
            modalCtrl.abort();
            document.body.removeChild(modalWindow);
            document.body.removeChild(blurBG);
        }, {signal: modalCtrl.signal});

        const titleContainer = new Manatsu(modalWindow).create();
        new Manatsu('h1', { id: 'insidious_modal_h1', text: modalTitle }, titleContainer).create();
    };

    // DADOS
    static get currentScreen() {return this.#currentScreen};
    static get currentVillage() {return this.#currentVillage};
    static get currentPlayer() {return this.#currentPlayer};

    // MODAL
    static get modal() {return this.#modal};

    // OUTROS
    static get urlDecode() {return this.#urlDecode};
    static get calcDistance() {return this.#calcDistance};
    static get generateIntegerBetween() {return this.#generateIntegerBetween};
};