type AcceptableProperty = (string | Element | { [index: string]: string });
type ConstructorArgs = (AcceptableProperty | null)[];
type RepeatConstructor = (AcceptableProperty | number | string[] | null)[];

class Manatsu {
    #element: string = 'div';
    #parent: Element | null = null;
    #options: { [index: string]: string } | null = null;

    constructor(...args: ConstructorArgs) {
        for (const arg of args) if (arg !== null && arg !== undefined) this.#setProperty(arg);
    };

    #create() {
        const newElement = document.createElement(this.#element);
        
        if (this.#options) {
            for (const [key, value] of Object.entries(this.#options)) {       
                switch (key) {
                    case 'text': newElement.textContent = value;
                        break;
                    case 'inner': newElement.innerText = value;
                        break;
    
                    default: newElement.setAttribute(key, value);
                };
            };
        };

        if (this.#parent) this.#parent.appendChild(newElement);

        return newElement;
    };

    // #createBefore() com insertBefore.

    #setProperty(value: AcceptableProperty) {
        if (typeof value === 'string') {
            if (!Manatsu.isValidElementName(value)) return;
            this.#element = value.toLowerCase();

        } else if (value instanceof Element) {
            if (this.#parent === null) this.#parent = value;

        } else if (Manatsu.isValidOption(value)) {
            if (this.#options === null) this.#options = value;
        };
    };

    #addOptions(item: { [index: string]: string }, overwrite: boolean = true) {
        if (Manatsu.isValidOption(item)) {
            const oldOptions = this.#options ? { ...this.#options } : { };
            for (const [attribute, content] of Object.entries(item as object)) {
                if (this.#options && overwrite === false && attribute in this.#options) continue;
                Object.defineProperty(oldOptions, attribute, {
                    value: content,
                    enumerable: true
                });
            };
            this.#options = oldOptions;
            return this;

        } else {
            throw new ManatsuError('O item fornecido é inválido.');
        };
    };

    static #repeat(...args: RepeatConstructor): Manatsu[] {
        const manatsu: Manatsu[] = [];
        const element: string[] = [];
        let amount: number = 1;
        let parent: Element | null = null;
        let options: { [index: string]: string } | null = null;

        for (const arg of args) {
            if (arg === null || arg === undefined) continue;

            if (typeof arg === 'number') {
                if (!Number.isFinite(arg) || arg <= 1 || amount > 1) continue;
                amount = Math.trunc(arg);

            } else if (typeof arg === 'string') {
                if (!this.#isValidElementName(arg)) continue;
                element.push(arg);

            } else if (Array.isArray(arg)) {
                arg.forEach((item: unknown) => {
                    if (typeof item === 'string' && Manatsu.isValidElementName(item)) element.push(item);
                });
                
            } else if (arg instanceof Element) {
                if (parent === null) parent = arg;

            } else if (this.#isValidOption(arg)) {
                if (options === null) options = arg;
            };
        };

        if (element.length === 0) element.push('div');
        for (let mana = 0; mana < amount; mana++) {
            const elementType: string = element[mana] ?? element[0];
            const newElement = new Manatsu(elementType, parent, options);
            manatsu.push(newElement);
        };

        return manatsu;
    };

    static #createAll(manatsu: Manatsu[]): HTMLElement[] {
        if (!Array.isArray(manatsu)) throw new ManatsuError('O valor fornecido não é uma array.');
        if (manatsu.length === 0) throw new ManatsuError('A array não pode estar vazia.');

        const collection: HTMLElement[] = [];
        for (const mana of manatsu) {
            if (mana instanceof Manatsu) {
                const newElement = mana.create();
                collection.push(newElement);
            };
        };

        return collection;
    };

    static #fromTemplate(item: Manatsu, options?: { [index: string]: string }): Manatsu {
        if (item instanceof Manatsu) {
            const properties: ConstructorArgs = [item.element, item.parent];
            if (options && this.#isValidOption(options)) {
                return new Manatsu(...properties, item.options).addOptions(options, true);

            } else {
                return new Manatsu(...properties, item.options);
            };

        } else {
            throw new ManatsuError('O item escolhido é inválido.');
        };
    };

    static #removeChildren(parentElement: Element) {
        if (!(parentElement instanceof Element)) throw new ManatsuError('O elemento fornecido é inválido.');
        while (parentElement.firstChild) parentElement.removeChild(parentElement.firstChild);
    };

    static #enableChildren(parentElement: Element, selector: string) {
        if (!(parentElement instanceof Element)) throw new ManatsuError('O elemento fornecido é inválido.');
        if (typeof selector !== 'string') throw new ManatsuError('O seletor precisa ser uma string.');

        const children = parentElement.querySelectorAll(selector);
        children.forEach((child: Element) => {
            if (child.hasAttribute('disabled')) child.removeAttribute('disabled');
        });
    };

    static #disableChildren(parentElement: Element, selector: string) {
        if (!(parentElement instanceof Element)) throw new ManatsuError('O elemento fornecido é inválido.');
        if (typeof selector !== 'string') throw new ManatsuError('O seletor precisa ser uma string.');

        const children = parentElement.querySelectorAll(selector);
        children.forEach((child: Element) => child.setAttribute('disabled', ''));
    };

    static #isValidElementName(name: string) {
        if (name.length === 0) throw new ManatsuError('O nome do elemento não foi fornecido.');
        if (!Boolean(name[0].match(/[a-zA-Z]/))) throw new ManatsuError('O nome do elemento precisa iniciar com uma letra (a-z).');
        return true;
    };

    static #isValidOption(obj: unknown) {
        if (Object.getPrototypeOf(obj) === Object.prototype) {
            for (const [attribute, content] of Object.entries(obj as object)) {
                if (typeof attribute !== 'string') throw new ManatsuError('O nome do atributo precisa ser uma string.');
                if (typeof content !== 'string') throw new ManatsuError('O valor do atributo precisa ser uma string.');
            };
            return true;
        };
        return false;
    };

    get create() {return this.#create};
    get addOptions() {return this.#addOptions};
    get element() {return this.#element};
    get parent() {return this.#parent};
    get options() {return this.#options};

    set element(name: string) {
        if (typeof name === 'string' && Manatsu.isValidElementName(name)) {
            this.#element = name.toLowerCase();
        } else {
            throw new ManatsuError('O nome do elemento precisa ser uma string.');
        };
    };

    set parent(parentElement: Element | null) {
        if (parentElement instanceof Element) {
            this.#parent = parentElement;
        } else {
            throw new ManatsuError('O elemento fornecido é inválido.');
        };
    };

    set options(item: { [index: string]: string } | null) {
        if (Manatsu.isValidOption(item)) {
            this.#options = item;
        } else {
            throw new ManatsuError('O item fornecido é inválido.');
        };
    };

    static get repeat() {return this.#repeat};
    static get createAll() {return this.#createAll};
    static get fromTemplate() {return this.#fromTemplate};

    static get removeChildren() {return this.#removeChildren};
    static get enableChildren() {return this.#enableChildren};
    static get disableChildren() {return this.#disableChildren};

    static get isValidOption() {return this.#isValidOption};
    static get isValidElementName() {return this.#isValidElementName};
};

class ManatsuError extends Error {
    constructor(message: string) {
        super();

        this.name = 'ManatsuError';
        this.message = message;
    };
};