'use strict';
class Utils {
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
        return Number(distance.toFixed(2));
    };

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

    static get urlDecode() {return this.#urlDecode};
    static get calcDistance() {return this.#calcDistance};

    static get currentScreen() {return this.#currentScreen};
    static get currentVillage() {return this.#currentVillage};
    static get currentPlayer() {return this.#currentPlayer};
};