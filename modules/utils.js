'use strict';
class Utils {
    static #currentScreen() {
        for (const item of this.#urlFields()) {
            if (item.includes('screen=')) return item.replace('screen=', '');
        };
    };

    static #currentVillage() {
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

    static #urlFields() {
        return (location.search.replace('\?', '')).split('\&');
    };

    // Corrige os nomes codificados ("Aldeia+de+b%C3%A1rbaros" se torna "Aldeia de bárbaros").
    static #urlDecode(url) {
        return decodeURIComponent(url.replace(/\+/g, ' '));
    };

    // Calcula distância em campos entre duas coordenadas.
    static #calcDistance(originX, originY, destinationX, destinationY) {
        const distance = Math.sqrt(((destinationX - originX) ** 2) + ((destinationY - originY) ** 2));
        return Number(distance.toFixed(1));
    };

    static #decipherDate(date) {
        const writtenDate = String(date).toLowerCase();
        let sanitizedDate = writtenDate.split(' ').pop();
        sanitizedDate = sanitizedDate.split('\:').map((item) => Number(item));

        if (writtenDate.includes('hoje')) {       
            return String(new Date().setHours(sanitizedDate[0], sanitizedDate[1], sanitizedDate[2]));

        } else if (writtenDate.includes('ontem')) {
            const yesterday = new Date().getTime() - (3600000 * 24);
            return String(new Date(yesterday).setHours(sanitizedDate[0], sanitizedDate[1], sanitizedDate[2]));
        }

        return 'unknown';
    };

    static #modal(modalTitle) {
        const blurBG = document.createElement('div');
        blurBG.setAttribute('id', 'insidious_blurBG');
        document.body.appendChild(blurBG);

        const modalWindow = document.createElement('div');
        modalWindow.setAttribute('id', 'insidious_modal');
        document.body.appendChild(modalWindow);

        const modalCtrl = new AbortController();
        blurBG.addEventListener('closemodal', () => {
            modalCtrl.abort();
            document.body.removeChild(modalWindow);
            document.body.removeChild(blurBG);
        }, {signal: modalCtrl.signal});

        const titleContainer = document.createElement('h1');
        modalWindow.appendChild(titleContainer);

        const h1Title = document.createElement('h1');
        h1Title.setAttribute('id', 'insidious_modal_h1');
        h1Title.innerText = modalTitle;
        titleContainer.appendChild(h1Title);
    };

    static get currentScreen() {return this.#currentScreen};
    static get currentVillage() {return this.#currentVillage};
    static get currentPlayer() {return this.#currentPlayer};

    static get urlDecode() {return this.#urlDecode};
    static get calcDistance() {return this.#calcDistance};
    static get decipherDate() {return this.#decipherDate};
    static get modal() {return this.#modal};
};