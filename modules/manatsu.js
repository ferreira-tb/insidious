'use strict';
class Manatsu {
    #element = 'div'; // <string>.
    #options; // [object]
    #parent; // [HTML Element]

    constructor(...args) {
        for (const arg of args) this.#setProperty(arg);
    };

    #create() {
        const newElement = document.createElement(this.#element);
        
        if (this.#options) {
            for (const key in this.#options) {
                if (typeof key !== 'string') throw new SyntaxError('option must be a string.');
                if (typeof this.#options[key] !== 'string') throw new SyntaxError('option must be a string.');
    
                switch (key) {
                    case 'text': newElement.innerText = this.#options[key];
                        break;
                    case 'html': newElement.innerHTML = this.#options[key];
                        break;
                    case 'content': newElement.textContent = this.#options[key];
                        break;
    
                    default: newElement.setAttribute(key, this.#options[key]);
                };
            };
        };

        if (this.#parent) this.#parent.appendChild(newElement);

        return newElement;
    };

    #setProperty(value) {
        if (typeof value === 'string') {
            this.#element = value;

        } else if (isObject()) {
            this.#options = value;

        } else if (isHTMLElement()) {
            this.#parent = value;          
        };

        function isObject() {
            if (Object.getPrototypeOf(value) === Object.prototype) return true;
            return false;
        };

        function isHTMLElement() {
            if (value instanceof HTMLElement) return true;
            return false;
        };
    };

    // GETTERS
    get create() {return this.#create};

    // STATIC
    // Remove todos os filhos de um dado elemento.
    static #removeChildren(element) {
        while (element.firstChild) element.removeChild(element.firstChild);
    };

    // STATIC GETTERS
    static get removeChildren() {return this.#removeChildren};
};