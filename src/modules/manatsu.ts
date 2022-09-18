class Manatsu {
    #element: string = 'div';
    #options;
    #parent:  HTMLElement;

    constructor(...args: any) {
        for (const arg of args) this.#setProperty(arg);
    };

    #create() {
        const newElement = document.createElement(this.#element);
        
        if (this.#options) {
            for (const [key, value] of Object.entries(this.#options)) {
                if (typeof key !== 'string') throw new SyntaxError('option must be a string.');
                if (typeof value !== 'string') throw new SyntaxError('option must be a string.');
    
                switch (key) {
                    case 'text': newElement.innerText = value;
                        break;
                    case 'html': newElement.innerHTML = value;
                        break;
                    case 'content': newElement.textContent = value;
                        break;
    
                    default: newElement.setAttribute(key, value);
                };
            };
        };

        if (this.#parent) this.#parent.appendChild(newElement);

        return newElement;
    };

    #setProperty(value: any) {
        if (typeof value === 'string') {
            this.#element = value;

        } else if (isValidObject()) {
            this.#options = value;

        } else if (value instanceof HTMLElement) {
            this.#parent = value;
        };

        function isValidObject() {
            if (Object.getPrototypeOf(value) === Object.prototype) return true;
            return false;
        };
    };

    // GETTERS
    get create() {return this.#create};

    // STATIC
    // Remove todos os filhos de um dado elemento.
    static #removeChildren(element: HTMLElement) {
        while (element.firstChild) element.removeChild(element.firstChild);
    };

    // STATIC GETTERS
    static get removeChildren() {return this.#removeChildren};
};