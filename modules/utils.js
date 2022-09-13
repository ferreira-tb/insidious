'use strict';
class Utils {
    // Corrige os nomes codificados ("Aldeia+de+b%C3%A1rbaros" se torna "Aldeia de bárbaros").
    static #urlDecode(url) {
        return decodeURIComponent(url.replace(/\+/g, ' '));
    };

    // Calcula distância em campos entre duas coordenadas.
    static #calcDistance(originX, originY, destinationX, destinationY) {
        const distance = Math.sqrt(((destinationX - originX) ** 2) + ((destinationY - originY) ** 2));
        return Number(distance.toFixed(2));
    };

    static get urlDecode() {return this.#urlDecode};
    static get calcDistance() {return this.#calcDistance};
};