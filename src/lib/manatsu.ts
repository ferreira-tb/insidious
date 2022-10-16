class Manatsu {
    #element: string = 'div';
    #parent: Element | null = null;
    #options: Option | null = null;

    constructor(...args: ConstructorArgs) {
        for (const arg of args) if (arg !== null && arg !== undefined) this.setProperty(arg);
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

    /**
     * Adiciona novos atributos ao objeto Manatsu.
     * @param option - Lista com novos atributos para o elemento.
     * @param overwrite - Determina se os atributos serão sobrescritos caso já existam.
     * @returns O próprio objeto Manatsu, agora modificado.
     */
     addOptions(option: Option, overwrite: boolean = true) {
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

    /**
     * Cria um elemento a partir do objeto Manatsu.
     * @returns O elemento criado.
     */
    create(): HTMLElement {
        const newElement = this.createElement();
        if (this.#parent) this.#parent.appendChild(newElement);

        return newElement;
    };

    /** 
     * Cria um elemento a partir do objeto Manatsu e o insere antes do elemento indicado como referência.
     * Se o elemento de referência for null, createBefore() tem o mesmo efeito de create().
     * Além disso, se o objeto Manatsu possuir um pai, ele é trocado pelo pai do elemento de referência.
     * @param referenceNode Elemento antes do qual o novo será inserido.
     * @returns O elemento criado a partir do objeto Manatsu.
     */
    createBefore(referenceNode: Node | null): HTMLElement {
        if (!(referenceNode instanceof Node)) {
            switch (referenceNode) {
                case null: return this.create();
                default: throw new ManatsuError('O elemento de referência é inválido.');
            };

        } else {
            if (!referenceNode.parentElement) throw new ManatsuError('O elemento de referência não possui um pai.');
            if (this.#parent) this.#parent = referenceNode.parentElement;

            const newElement = this.createElement();
            referenceNode.parentElement.insertBefore(newElement, referenceNode);
    
            return newElement;
        };
    };

    /** 
     * Cria um elemento e o envelopa com outro elemento. 
     * Esse outro elemento será criado com base nos argumentos fornecidos à createInside().
     * @returns O elemento criado a partir do objeto Manatsu.
     */
    createInside(...args: ConstructorArgs): HTMLElement {
        const newParent = new Manatsu(...args);
        if (!this.#parent && !newParent.parent) throw new ManatsuError('Não foi especificado um elemento pai para o container.');
        if (this.#parent && !newParent.parent) newParent.parent = this.#parent;

        this.#parent = newParent.create();
        return this.create();
    };

    ////// MANATSU
    /** 
     * Cria vários elementos de uma só vez, a partir de uma array de objetos Manatsu. 
     * É equivalente a usar create() separadamente em cada um dos objetos. 
     * @param manatsu - Array de objetos Manatsu.
     * @returns Array com os elementos criados.
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
     * @param reference - Objeto Manatsu ou elemento a ser usado como base.
     * @param options - Lista com novos atributos para o elemento.
     */
    static fromTemplate(reference: Manatsu | Element, options?: Option): Manatsu {
        if (reference instanceof Manatsu) {
            const properties: ConstructorArgs = [reference.element, reference.parent];
            if (options && Validation.isValidOption(options)) {
                return new Manatsu(...properties, reference.options).addOptions(options, true);

            } else {
                return new Manatsu(...properties, reference.options);
            };

        } else if (reference instanceof Element) {
            const newOptions: Option = {};

            const attributeNames: Set<string> = new Set(reference.getAttributeNames());
            if (attributeNames.size > 0) {
                attributeNames.forEach((attribute) => {
                    Object.defineProperty(newOptions, attribute, {
                        value: reference.getAttribute(attribute),
                        enumerable: true,
                        writable: true
                    });
                });  
            };

            if (reference.textContent) {
                Object.defineProperty(newOptions, 'text', {
                    value: reference.textContent,
                    enumerable: true,
                    writable: true
                });
            };

            if ((reference as HTMLElement).innerText) {
                Object.defineProperty(newOptions, 'inner', {
                    value: (reference as HTMLElement).innerText,
                    enumerable: true,
                    writable: true
                });
            };

            if (options && Validation.isValidOption(options)) {
                for (const [attribute, content] of Object.entries(options)) {
                    Object.defineProperty(newOptions, attribute, {
                        value: content,
                        enumerable: true,
                        writable: true
                    });
                };
            };

            return new Manatsu(reference.nodeName, reference.parentElement, newOptions);

        } else {
            throw new ManatsuError('O item indicado como refêrencia é inválido.');
        };
    };

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

    ////// DOM
    /** 
     * Adiciona texto em vários elementos ou objetos Manatsu de uma única vez.
     * 
     * Se as arrays forem de tamanhos diferentes e a array de strings for a maior,
     * o método irá ignorar qualquer string extra.
     * 
     * Se a array contendo os elementos ou objetos Manatsu for maior, o método adicionará o texto respeitando a ordem,
     * até chegar ao ponto onde a diferença ocorre. Dali em diante, passará a adicionar a string no índice zero ao restante dos itens.
     * @param items - Array de elementos ou objetos Manatsu.
     * @param text - Array de strings contendo o texto a ser adicionado aos itens.
     * @returns - A array elementos ou objetos Manatsu após a modificação de `textContent`.
     */
     static addTextContent(items: (Element | Manatsu)[], text: string[]): (Element | Manatsu)[] {
        if (!Array.isArray(items)) throw new ManatsuError('É preciso fornecer uma array de elementos ou objetos Manatsu.');
        if (!Array.isArray(text)) throw new ManatsuError('É preciso fornecer uma array contendo as strings que serão adicionadas aos itens.');
        if (items.length === 0 || text.length === 0) throw new ManatsuError('As arrays não podem estar vazias.');

        for (const item of items) {
            const stringToAdd = text[items.indexOf(item)] ?? text[0];
            if (typeof stringToAdd !== 'string') throw new ManatsuError(`${stringToAdd} não é uma string`);

            if (item instanceof Element) item.textContent = stringToAdd;
            if (item instanceof Manatsu) item.addOptions({ text: stringToAdd }, true);
        };

        return items;
    };

    /**
     * Cria uma `checkbox` e associa uma `label` à ela.
     * @param options - Um objeto contendo o ID da `checkbox` e um texto para a `label`.
     * @param create - Determina se os objetos serão transformados ou não em elementos.
     * @param parentElement - Um elemento-pai para associar aos objetos.
     * @returns Array contendo a `checkbox` e sua `label`. Pode ser uma array de objetos Manatsu ou de elementos.
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
     * Adiciona o atributo 'disabled' a todos os filhos do elemento indicado. 
     * Caso um seletor CSS seja fornecido, adiciona somente aos filhos que o satisfaçam.
     * @param parentElement
     * @param recursive Indica se o método deve atuar recursivamente.
     * @param selector Seletor CSS identificando quais elementos-filho serão alvo.
     */
     static disableChildren(parentElement: Element, recursive: boolean = false, selector?: string) {
        if (!(parentElement instanceof Element)) throw new ManatsuError('O elemento fornecido é inválido.');

        if (typeof selector === 'string') {
            if (recursive === true) {
                const children = parentElement.querySelectorAll(selector);
                children.forEach((child) => child.setAttribute('disabled', ''));
                
            } else {
                const children = Array.from(parentElement.children);
                for (const child of children) {
                    const matchingElement = parentElement.querySelector(selector);
                    if (matchingElement === child) child.setAttribute('disabled', '');
                };
            };

        } else {
            const children = Array.from(parentElement.children);
            for (const child of children) {
                child.setAttribute('disabled', '');

                if (child.children.length > 0 && recursive === true) {
                    this.disableChildren(child, true);
                };
            };
        };
    };

    /** 
     * Remove o atributo 'disabled' de todos os filhos do elemento indicado. 
     * Caso um seletor CSS seja fornecido, remove somente dos filhos que o satisfaçam.
     * @param parentElement
     * @param recursive Indica se o método deve atuar recursivamente.
     * @param selector - Seletor CSS identificando quais elementos-filho serão alvo.
     */
     static enableChildren(parentElement: Element, recursive: boolean = false, selector?: string) {
        if (!(parentElement instanceof Element)) throw new ManatsuError('O elemento fornecido é inválido.');

        if (typeof selector === 'string') {
            if (recursive === true) {
                const children = parentElement.querySelectorAll(selector);
                children.forEach((child) => {
                    if (child.hasAttribute('disabled')) child.removeAttribute('disabled');
                });

            } else {
                const children = Array.from(parentElement.children);
                for (const child of children) {
                    const matchingElement = parentElement.querySelector(selector);
                    if (matchingElement === child && child.hasAttribute('disabled')) {
                        child.removeAttribute('disabled');
                    };
                };
            };
            

        } else {
            for (const child of Array.from(parentElement.children)) {
                if (child.hasAttribute('disabled')) child.removeAttribute('disabled');

                if (child.children.length > 0 && recursive === true) {
                    this.enableChildren(child, true);
                };
            };
        };
    };

    /**
     * Remove um ou mais elementos do documento.
     * Ao contrário de Node.removeChild(), não é necessário especificar o pai.
     * Além disso, quando mais de um elemento é fornecido, não é necessário que todos tenham o mesmo pai.
     * @param elementsToRemove Elemento(s) que se deseja remover do documento.
     */
    static remove(elementsToRemove: Element | Element[]) {
        if (Array.isArray(elementsToRemove)) {
            elementsToRemove.forEach((element) => {
                if (!(element instanceof Element)) throw new ManatsuError('O elemento é inválido.');

                const parentElement = element.parentElement;
                if (!parentElement) throw new ManatsuError('O elemento não possui um pai.');
                parentElement.removeChild(element);
            });

        } else if (elementsToRemove instanceof Element) {
            const parentElement = elementsToRemove.parentElement;
            if (!parentElement) throw new ManatsuError('O elemento não possui um pai.');
            parentElement.removeChild(elementsToRemove);
        } else {
            throw new ManatsuError('O elemento é inválido.');
        };
    };


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