class Manatsu {
    #element: string = 'div';
    #parent: Element | null = null;
    #options: Option | null = null;

    constructor(...args: ConstructorArgs) {
        for (const arg of args) if (arg !== null && arg !== undefined) this.setProperty(arg);
    };

    private createElement(): HTMLElement {
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

        return newElement;
    };

    /** Cria um elemento a partir do objeto Manatsu. */
    create(): HTMLElement {
        const newElement = this.createElement();
        if (this.#parent) this.#parent.appendChild(newElement);

        return newElement;
    };

    /** 
     * Cria um elemento a partir do objeto Manatsu e o insere antes do elemento indicado como referência.
     * 
     * O método createBefore() só funcionará caso parent tenha sido definido no objeto Manatsu.
     * @param referenceNode - Elemento antes do qual o novo será inserido.
     */
    createBefore(referenceNode: Element): HTMLElement {
        if (!(referenceNode instanceof Element)) throw new ManatsuError('O elemento de referência é inválido.');
        if (!this.#parent) throw new ManatsuError('Não foi especificado um elemento pai.');
        if (referenceNode.parentElement !== this.#parent) {
            throw new ManatsuError('O elemento de referência possui um pai diferente.');
        };

        const newElement = this.createElement();
        this.#parent.insertBefore(newElement, referenceNode);

        return newElement;
    };

    /** 
     * Cria um elemento e o envelopa com outro elemento. 
     * Esse outro elemento será criado com base nos argumentos fornecidos à createInside().
     */
    createInside(...args: ConstructorArgs): HTMLElement {
        const newParent = new Manatsu(...args);
        if (!this.#parent && !newParent.parent) throw new ManatsuError('Não foi especificado um elemento pai para o container.');
        if (this.#parent && !newParent.parent) newParent.parent = this.#parent;

        this.#parent = newParent.create();
        return this.create();
    };

    private setProperty(value: AcceptableProperty) {
        if (typeof value === 'string') {
            if (!Validation.isValidElementName(value)) return;
            this.#element = value.toLowerCase();

        } else if (value instanceof Element) {
            if (this.#parent === null) this.#parent = value;

        } else if (Validation.isValidOption(value)) {
            if (this.#options === null) this.#options = value;
        };
    };

    /** 
     * Adiciona novos atributos ao objeto Manatsu.
     * @param option - Lista com novos atributos para o elemento.
     * @param overwrite - Determina se os atributos serão sobrescritos caso já existam.
     */
    private addOptions(option: Option, overwrite: boolean = true) {
        if (Validation.isValidOption(option)) {
            const oldOptions = this.#options ? { ...this.#options } : { };
            for (const [attribute, content] of Object.entries(option as object)) {
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

    ////// MANATSU
    /** 
     * Cria vários objetos Manatsu a partir dos parâmetros especificados. 
     * É possível designar vários tipos diferentes para os elementos, mas apenas um parent e um objeto options. 
     * 
     * Caso vários tipos sejam fornecidos, repeat() os atribuirá em ordem. 
     * Se a quantidade de cópias desejada for maior que a quantidade de tipos fornecidos, 
     * repeat() fará normalmente a atribuição em ordem para esses fornecidos e atribuirá div ao restante.
     */
    static repeat(...args: RepeatConstructor): Manatsu[] | HTMLElement[] {
        const manatsu: Manatsu[] = [];
        const element: string[] = [];
        let amount: number = 1;
        let parent: Element | null = null;
        let options: Option | null = null;
        let shouldCreateThem: boolean = false;

        for (const arg of args) {
            if (arg === null || arg === undefined) continue;

            if (typeof arg === 'boolean') {
                shouldCreateThem = arg;

            } else if (typeof arg === 'number') {
                if (!Number.isFinite(arg) || arg <= 1 || amount > 1) continue;
                amount = Math.trunc(arg);

            } else if (typeof arg === 'string') {
                if (!Validation.isValidElementName(arg)) continue;
                element.push(arg);

            } else if (Array.isArray(arg)) {
                arg.forEach((item: unknown) => {
                    if (typeof item === 'string' && Validation.isValidElementName(item)) element.push(item);
                });
                
            } else if (arg instanceof Element) {
                if (parent === null) parent = arg;

            } else if (Validation.isValidOption(arg)) {
                if (options === null) options = arg;
            };
        };

        if (element.length === 0) element.push('div');
        for (let mana = 0; mana < amount; mana++) {
            const elementType: string = element[mana] ?? element[0];
            const newElement = new Manatsu(elementType, parent, options);
            manatsu.push(newElement);
        };

        if (shouldCreateThem === true) {
            return this.createAll(manatsu);
        } else {
            return manatsu;
        };
    };

    /** 
     * Cria vários elementos de uma só vez, a partir de uma array de objetos Manatsu. 
     * É equivalente a usar create() separadamente em cada um dos objetos. 
     * @param manatsu - Array de objetos Manatsu.
     */
    static createAll(manatsu: Manatsu[]): HTMLElement[] {
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

    /** 
     * Cria um objeto Manatsu a partir de outro já existente ou tendo algum elemento como referência. 
     * @param item - Objeto Manatsu ou elemento a ser usado como base.
     * @param options - Lista com novos atributos para o elemento.
     */
    static fromTemplate(item: Manatsu | Element, options?: Option): Manatsu {
        if (item instanceof Manatsu) {
            const properties: ConstructorArgs = [item.element, item.parent];
            if (options && Validation.isValidOption(options)) {
                return new Manatsu(...properties, item.options).addOptions(options, true);

            } else {
                return new Manatsu(...properties, item.options);
            };

        } else if (item instanceof Element) {
            const newOptions: Option = {};

            const attributeNames: string[] = item.getAttributeNames();
            if (attributeNames.length > 0) {
                attributeNames.forEach((attribute: string) => {
                    Object.defineProperty(newOptions, attribute, {
                        value: item.getAttribute(attribute),
                        enumerable: true
                    });
                });  
            };

            if (item.textContent) {
                Object.defineProperty(newOptions, 'text', {
                    value: item.textContent,
                    enumerable: true
                });
            };

            if ((item as HTMLElement).innerText) {
                Object.defineProperty(newOptions, 'inner', {
                    value: (item as HTMLElement).innerText,
                    enumerable: true
                });
            };

            if (options && Validation.isValidOption(options)) {
                for (const [attribute, content] of Object.entries(options)) {
                    Object.defineProperty(newOptions, attribute, {
                        value: content,
                        enumerable: true
                    });
                };
            };

            return new Manatsu(item.nodeName, item.parentElement, newOptions);

        } else {
            throw new ManatsuError('O item escolhido é inválido.');
        };
    };

    /**
     * Cria uma checkbox e um label associado à ela.
     * @param options - Um objeto contendo o ID da checkbox e um texto para o label.
     * @param create - Determina se os objetos serão transformados ou não em elementos.
     * @param parentElement - Um elemento-pai para associar aos objetos.
     */
    static createCheckbox(options: CheckboxOptions, create: boolean = false, parentElement?: Element): CreateCheckboxReturnValue {
        if (!options.id || typeof options.id !== 'string') throw new ManatsuError('O id fornecido é inválido.');
        if (!options.label || typeof options.label !== 'string') throw new ManatsuError('A descrição fornecida é inválida.');
        if (typeof create !== 'boolean') throw new ManatsuError('O argumento \"create\" precisa ser do tipo boolean.');

        const newCheckbox = new Manatsu('input', { type: 'checkbox', id: options.id });
        const newLabel = new Manatsu('label', { for: options.id, text: options.label });

        if (parentElement && parentElement instanceof Element) {
            newCheckbox.parent = parentElement;
            newLabel.parent = parentElement;
        };

        if (create === true) {
            return [(newCheckbox.create()) as HTMLInputElement, (newLabel.create()) as HTMLLabelElement];

        } else {
            return [newCheckbox, newLabel];
        };
    };

    /** 
     * Adiciona texto em vários elementos ou objetos Manatsu de uma única vez. 
     * Emite um erro caso o tamanho das arrays fornecidas seja diferente.
     * @param items - Array de elementos ou objetos Manatsu.
     * @param text - Array contendo as strings que serão utilizadas.
     */
    static addTextContent(items: (Element | Manatsu)[], text: string[]) {
        if (!items) throw new ManatsuError('É preciso fornecer uma array de elementos ou objetos Manatsu.');
        if (!text) throw new ManatsuError('É preciso fornecer uma array de strings.');
        if (items.length === 0 || text.length === 0) throw new ManatsuError('As arrays não podem estar vazias.');
        if (items.length !== text.length) throw new ManatsuError('As arrays precisam ter o mesmo tamanho.');

        for (const item of items) {
            const stringToAdd = text[items.indexOf(item)];
            if (typeof stringToAdd !== 'string') throw new InsidiousError(`${stringToAdd} não é uma string`);

            if (item instanceof Element) item.textContent = stringToAdd;
            if (item instanceof Manatsu) item.addOptions({ text: stringToAdd }, true);
        };

        return items;
    };

    ////// GERAL
    /** 
     * Remove todos os filhos do elemento indicado. 
     * Caso um seletor CSS seja fornecido, remove apenas os filhos que o satisfaçam.
     * @param parentElement
     * @param selector - Seletor CSS identificando quais elementos-filho serão alvo.
     */
    static removeChildren(parentElement: Element, selector?: string | string[]) {
        if (!(parentElement instanceof Element)) throw new ManatsuError('O elemento fornecido é inválido.');
 
        if (typeof selector === 'string') {
            const children = parentElement.querySelectorAll(selector);
            children.forEach((child: Element) => parentElement.removeChild(child));

        } else if (Array.isArray(selector)) {
            for (const key of selector) {
                if (typeof key !== 'string') continue;
                const children = parentElement.querySelectorAll(key);
                children.forEach((child: Element) => parentElement.removeChild(child));
            };

        } else {
            while (parentElement.firstChild) parentElement.removeChild(parentElement.firstChild);
        };
    };

    /** 
     * Remove o atributo 'disabled' de todos os filhos do elemento indicado. 
     * Caso um seletor CSS seja fornecido, remove somente dos filhos que o satisfaçam.
     * @param parentElement
     * @param selector - Seletor CSS identificando quais elementos-filho serão alvo.
     */
    static enableChildren(parentElement: Element, selector?: string) {
        if (!(parentElement instanceof Element)) throw new ManatsuError('O elemento fornecido é inválido.');
        if (selector && typeof selector !== 'string') throw new ManatsuError('O seletor precisa ser uma string.');

        if (selector) {
            const children = parentElement.querySelectorAll(selector);
            children.forEach((child: Element) => {
                if (child.hasAttribute('disabled')) child.removeAttribute('disabled');
            });

        } else {
            for (const child of Array.from(parentElement.children)) {
                if (child.hasAttribute('disabled')) child.removeAttribute('disabled');
            };
        };
    };

    /** 
     * Adiciona o atributo 'disabled' a todos os filhos do elemento indicado. 
     * Caso um seletor CSS seja fornecido, adiciona somente aos filhos que o satisfaçam.
     * @param parentElement
     * @param selector - Seletor CSS identificando quais elementos-filho serão alvo.
     */
    static disableChildren(parentElement: Element, selector?: string) {
        if (!(parentElement instanceof Element)) throw new ManatsuError('O elemento fornecido é inválido.');
        if (selector && typeof selector !== 'string') throw new ManatsuError('O seletor precisa ser uma string.');

        if (selector) {
            const children = parentElement.querySelectorAll(selector);
            children.forEach((child: Element) => child.setAttribute('disabled', ''));

        } else {
            for (const child of Array.from(parentElement.children)) {
                child.setAttribute('disabled', '');
            };
        };
    };

    set element(name: string) {
        if (typeof name === 'string' && Validation.isValidElementName(name)) {
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

    set options(item: Option | null) {
        if (Validation.isValidOption(item)) {
            this.#options = item;
        } else {
            throw new ManatsuError('O item fornecido é inválido.');
        };
    };
};

class Validation {
    static isValidElementName(name: string) {
        if (name.length === 0) throw new ManatsuError('O nome do elemento não foi fornecido.');
        if (!Boolean(name[0].match(/[a-zA-Z]/))) throw new ManatsuError('O nome do elemento precisa iniciar com uma letra (a-z).');
        return true;
    };

    static isValidOption(obj: unknown) {
        if (Object.getPrototypeOf(obj) === Object.prototype) {
            for (const [attribute, content] of Object.entries(obj as object)) {
                if (typeof attribute !== 'string') throw new ManatsuError('O nome do atributo precisa ser uma string.');
                if (typeof content !== 'string') throw new ManatsuError('O valor do atributo precisa ser uma string.');
            };
            return true;
        };
        return false;
    };
};

class ManatsuError extends Error {
    constructor(message: string) {
        super();

        this.name = 'ManatsuError';
        this.message = message;
    };
};