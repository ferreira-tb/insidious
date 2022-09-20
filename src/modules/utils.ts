class Utils {
    static #currentScreen(): string | undefined {
        for (const item of this.#urlFields()) {
            if (item.includes('screen=')) return item.replace('screen=', '');
        };
    };

    static #currentVillage(): string | undefined {
        for (const item of this.#urlFields()) {
            if (item.includes('village=')) return item.replace('village=', '');
        };
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

    static #decipherDate(date: string) {
        const writtenDate = date.toLowerCase();
        let sanitizedDate: string | number[] | undefined = writtenDate.split(' ').pop();
        if (sanitizedDate) {
            sanitizedDate = sanitizedDate.split('\:').map((item: string) => Number(item));

            if (writtenDate.includes('hoje')) {       
                return String(new Date().setHours(sanitizedDate[0], sanitizedDate[1], sanitizedDate[2]));
    
            } else if (writtenDate.includes('ontem')) {
                const yesterday = new Date().getTime() - (3600000 * 24);
                return String(new Date(yesterday).setHours(sanitizedDate[0], sanitizedDate[1], sanitizedDate[2]));
            };
        };

        return 'unknown';
    };

    static #portugueseName = (word: string) => {
        switch (word) {
            case 'wood': return 'Madeira';
            case 'stone': return 'Argila';
            case 'iron': return 'Ferro';

            default: return 'Palavra inválida';
        };
    };

    static #createResourceSpan(resource: ResourceSpan) {
        return new Manatsu('span', {
            class: `icon header ${resource}`,
            ['data-insidious-custom']: 'true',
            ['data-title']: this.#portugueseName(resource)
        }).create();
    };

    static #createResourceSpanLabel(resource: ResourceSpan) {
        return new Manatsu('span', {
            class: 'res',
            ['data-insidious-custom']: 'true',
            ['data-title']: this.#portugueseName(resource)
        }).create();
    };

    static #createIconImg(icon: IconImgName, size: IconImgSize) {
        return new Manatsu('img', {
            src: TWAssets.image[`${icon}_${size}`],
            ['data-insidious-custom']: 'true'
        }).create();
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

    // ELEMENTOS
    static get createResourceSpan() {return this.#createResourceSpan};
    static get createResourceSpanLabel() {return this.#createResourceSpanLabel};
    static get createIconImg() {return this.#createIconImg};

    // DADOS
    static get currentScreen() {return this.#currentScreen};
    static get currentVillage() {return this.#currentVillage};
    static get currentPlayer() {return this.#currentPlayer};

    // MODAL
    static get modal() {return this.#modal};

    // OUTROS
    static get urlDecode() {return this.#urlDecode};
    static get calcDistance() {return this.#calcDistance};
    static get decipherDate() {return this.#decipherDate};
    static get portugueseName() {return this.#portugueseName};
    static get generateIntegerBetween() {return this.#generateIntegerBetween};
};