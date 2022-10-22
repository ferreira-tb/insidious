class Manatsu {
    #element: string = 'div';
    #parent: Element | null = null;
    #options: Option | null = null;
    readonly #style: Option = {};

    constructor(...args: ConstructorArgs) {
        for (const arg of args) {
            if (arg !== null && arg !== undefined) this.#setProperty(arg);
        };
    };

    #createElement(): HTMLElement {
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

    #updateStylePropertiesFromOptions() {
        if (!this.#options) throw new ManatsuError('Não existem opções registradas no objeto.');
        if (!this.#options.style) throw new ManatsuError('Não existe estilo registrado no objeto.');

        const properties = this.#options.style.split(';')
            .map((value) => value.trim())
            .filter((value) => value);

        for (const property of properties) {
            const lastIndex = property.lastIndexOf('\:');
            if (lastIndex === -1) throw new ManatsuError('O estilo fornecido é inválido.');
            
            let name = property.substring(0, lastIndex).toLowerCase().trim();
            if (name.includes('\-')) name = name.replaceAll('\-', '\_');

            const value = property.substring(lastIndex + 1).toLowerCase().trim();
            if (value && this.style[name] !== value) Reflect.set(this.style, name, value);
        };
    };

    #setProperty(value: AcceptableProperty) {
        if (typeof value === 'string') {
            if (!Validation.isElementNameValid(value)) return;
            this.#element = value.toLowerCase();

        } else if (value instanceof Element) {
            if (this.#parent === null) this.#parent = value;

        } else if (Validation.isOptionValid(value)) {
            if (this.#options === null) {
                this.#options = value;

                if (this.#options.style) this.#updateStylePropertiesFromOptions();
            };
        };
    };

    /**
     * Adiciona novos atributos ao objeto Manatsu.
     * @param option - Lista com novos atributos para o elemento.
     * @param overwrite - Determina se os atributos serão sobrescritos caso já existam.
     * @returns O próprio objeto Manatsu, agora modificado.
     */
    public addOptions(option: Option, overwrite: boolean = true) {
        if (Validation.isOptionValid(option)) {
            const oldOptions = this.#options ? { ...this.#options } : { };
            for (const [attribute, content] of Object.entries(option as object)) {
                if (this.#options && overwrite === false && attribute in this.#options) continue;
                Object.defineProperty(oldOptions, attribute, {
                    value: content,
                    enumerable: true,
                    writable: true
                });
            };

            this.#options = oldOptions;
            if (this.#options.style) this.#updateStylePropertiesFromOptions();

            return this;

        } else {
            throw new ManatsuError('O item fornecido é inválido.');
        };
    };

    /**
     * Cria um elemento a partir do objeto Manatsu.
     * @returns Elemento criado.
     */
    public create(): HTMLElement {
        const newElement = this.#createElement();
        if (this.#parent) this.#parent.appendChild(newElement);

        return newElement;
    };

    /**
     * Cria um elemento a partir do objeto Manatsu e o insere antes ou depois do elemento indicado como referência.
     * Se o elemento de referência for `null`, o método tem o mesmo efeito de `create()`.
     * Além disso, se o objeto Manatsu possuir um pai, ele é trocado pelo pai do elemento de referência.
     * @param type Define se o elemento deve ser inserido antes ou depois do elemento de referência.
     * @returns O elemento criado a partir do objeto Manatsu.
     */
    #createThere(type: ElementPosition) {
        const self = this;
        return function(referenceNode: Node | null): HTMLElement {
            if (!(referenceNode instanceof Node)) {
                switch (referenceNode) {
                    case null: return self.create();
                    default: throw new ManatsuError('O elemento de referência é inválido.');
                };
    
            } else {
                if (!referenceNode.parentElement) throw new ManatsuError('O elemento de referência não possui um pai.');
                if (self.#parent) self.#parent = referenceNode.parentElement;
    
                const newElement = self.#createElement();

                switch(type) {
                    case 'after':
                        const nextElement = referenceNode.nextSibling;
                        referenceNode.parentElement.insertBefore(newElement, nextElement);
                        break;
                    case 'before':
                        referenceNode.parentElement.insertBefore(newElement, referenceNode);
                        break;
                };   
    
                return newElement;
            };
        };
    };

    /** 
     * Cria um elemento e o envelopa com outro elemento. 
     * Esse outro elemento será criado com base nos argumentos fornecidos à `createInside()`.
     * @returns O objeto Manatsu original, agora como elemento.
     */
    public createInside(...args: ConstructorArgs): HTMLElement {
        const newParent = new Manatsu(...args);
        if (!this.#parent && !newParent.parent) throw new ManatsuError('Não foi especificado onde posicionar o elemento.');
        if (this.#parent && !newParent.parent) newParent.parent = this.#parent;

        this.#parent = newParent.create();
        return this.create();
    };

    /**
     * Cria um elemento a partir do objeto Manatsu, envelopa-o com outro elemento
     * e em seguida insere o envelope antes ou após o elemento indicado como referência.
     * @param type Define se o envelope deve ser inserido antes ou depois do elemento de referência.
     * @returns O elemento criado a partir do objeto Manatsu.
     */
    #createInsideThen(type: ElementPosition) {
        const self = this;
        return function(referenceNode: Node | null, parentArgs?: ConstructorArgs) {
            const referenceParent = referenceNode?.parentElement;
            if (!referenceParent) throw new ManatsuError('O elemento de referência não possui um pai.');

            const newParent = Array.isArray(parentArgs) ? new Manatsu(...parentArgs) : new Manatsu();
            if (!newParent.parent) newParent.parent = referenceParent;

            switch (type) {
                case 'after':
                    self.#parent = newParent.createAfter(referenceNode);
                    break;
                case 'before':
                    self.#parent = newParent.createBefore(referenceNode);
                    break;
            };
    
            return self.create();
        };
    };

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
    public static addTextContent(items: (Element | Manatsu)[], text: string[]): (Element | Manatsu)[] {
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
     * Cria vários elementos de uma só vez, a partir de uma array de objetos Manatsu. 
     * É equivalente a usar `create()` separadamente em cada um dos objetos. 
     * @param manatsu Array contendo os objetos Manatsu a serem criados.
     * @returns Array com os elementos criados.
     */
    public static createAll(manatsu: Manatsu[]): HTMLElement[] {
        if (!Array.isArray(manatsu)) throw new ManatsuError('O valor fornecido não é uma array.');

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
     * Cria vários elementos, envelopando todos com outros elementos.
     * Esses outros elementos serão criados com base no conteúdo da array `parentArgs`.
     * @param manatsu Array contendo os objetos Manatsu a serem criados.
     * @param step Número indicando a cada quantos objetos Manatsu um novo envelope deve ser criado.
     * @param parentArgs Array contendo informações sobre os elementos que serão usados como envelope.
     * @returns Array contendo os elementos criados a partir dos objetos Manatsu originais.
     */
    public static createAllInside(manatsu: Manatsu[], step: number = 1, parentArgs: AcceptableProperty[] = []): HTMLElement[] {
        if (!Array.isArray(manatsu)) throw new ManatsuError('O valor fornecido não é uma array.');
        if (!Number.isFinite(step) || Math.sign(step) !== 1) throw new ManatsuError('A quantidade de passos é inválida.');
        if (!Number.isInteger(step)) step = Math.trunc(step);

        const collection: HTMLElement[] = [];
        if (step !== 1) {
            let progress = 0;
            let newElement: HTMLElement;
            manatsu.forEach((mana) => {
                if (!(mana instanceof Manatsu)) return;
                // Não se deve usar o índice do item na array em vez de "progress".
                const ratio = progress / step;

                // O elemento criado a partir do objeto Manatsu.
                let currentManatsu: HTMLElement;

                if (Number.isInteger(ratio)) {
                    currentManatsu = mana.createInside(...parentArgs);
                    newElement = mana.parent as HTMLElement;

                } else {
                    mana.parent = newElement;
                    currentManatsu = mana.create();
                };
        
                progress++;
                collection.push(currentManatsu);
            });

        } else {
            for (const mana of manatsu) {
                if (mana instanceof Manatsu) {
                    const currentManatsu = mana.createInside(...parentArgs);
                    collection.push(currentManatsu);
                };
            };
        };

        return collection;
    };

    /**
     * Cria uma `checkbox` e associa uma `label` à ela.
     * @param options - Um objeto contendo o ID da `checkbox` e um texto para a `label`.
     * @param create - Determina se os objetos serão transformados ou não em elementos.
     * @param parentElement - Um elemento-pai para associar aos objetos.
     * @returns Array contendo a `checkbox` e sua `label`. Pode ser uma array de objetos Manatsu ou de elementos.
     */
     public static createCheckbox(options: CheckboxOptions, create: boolean = false, parentElement?: Element): CreateCheckboxReturnValue {
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
     * Adiciona o atributo `disabled` a todos os filhos do elemento indicado. 
     * Caso um seletor CSS seja fornecido, adiciona somente aos filhos que o satisfaçam.
     * @param parentElement
     * @param recursive Indica se o método deve atuar recursivamente.
     * @param selector Seletor CSS identificando quais elementos-filho serão alvo.
     */
    public static disableChildren(parentElement: Element, recursive: boolean = false, selector?: string) {
        if (!(parentElement instanceof Element)) throw new ManatsuError('O elemento fornecido é inválido.');

        if (typeof selector === 'string' && Validation.isSelectorValid(selector)) {
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
     * Remove o atributo `disabled` de todos os filhos do elemento indicado. 
     * Caso um seletor CSS seja fornecido, remove somente dos filhos que o satisfaçam.
     * @param parentElement
     * @param recursive Indica se o método deve atuar recursivamente.
     * @param selector - Seletor CSS identificando quais elementos-filho serão alvo.
     */
    public static enableChildren(parentElement: Element, recursive: boolean = false, selector?: string) {
        if (!(parentElement instanceof Element)) throw new ManatsuError('O elemento fornecido é inválido.');

        if (typeof selector === 'string' && Validation.isSelectorValid(selector)) {
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
     * Cria um objeto Manatsu a partir de outro já existente ou tendo algum elemento como referência. 
     * @param reference - Objeto Manatsu ou elemento a ser usado como base.
     * @param options - Lista com novos atributos para o elemento.
     */
    public static fromTemplate(reference: Manatsu | Element, options?: Option): Manatsu {
        if (reference instanceof Manatsu) {
            const properties: ConstructorArgs = [reference.element, reference.parent];
            if (options && Validation.isOptionValid(options)) {
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

            if (options && Validation.isOptionValid(options)) {
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
     * Recursivamente busca o ancestral do elemento indicado, com base no valor de `level`.
     * Caso não encontre, retorna `null`.
     * 
     * Esse método é um atalho para quando se precisa encadear `Node.parentElement` repetidas vezes.
     * 
     * Se `level` for igual a zero, o método retornará o próprio elemento.
     * @param element Elemento a partir do qual iniciar a busca.
     * @param level O nível de ancestralidade.
     * @returns O elemento ancestral.
     */
    public static getAncestorElement(element: Element, level: number = 1): Element | null {
        if (!(element instanceof Element)) throw new ManatsuError('O elemento é inválido.');
        if (level === 0) return element;
        if (level && (!Number.isInteger(level) || Math.sign(level) !== 1)) {
            throw new ManatsuError('O número de passos é inválido.');
        };

        let progress = 0;
        let parent: Element | null
        const getParentElement = (el: Element): Element | null => {
            parent = el.parentElement;
            if (!parent) return null;

            progress++;
            if (progress < level) return getParentElement(parent);
            return parent;
        };

        return getParentElement(element);
    };

    /**
     * Busca entre vários elementos aquele que contém determinada string como seu valor de `Node.textContent`.
     * @param text String a ser buscada.
     * @param selector Seletor CSS indicando em quais elementos buscar.
     * @param sensitive Indica se deve haver diferenciação entre letras maiúsculas e minúsculas.
     * @param exact Indica se o valor de `textContent` deve ser exatamente igual ao texto buscado ou apenas contê-lo.
     * @returns O elemento que contém o texto buscado ou `null` caso ele não exista.
     */
    public static getElementByTextContent(text: string, selector: string, sensitive: boolean = false, exact: boolean = true): Element | null {
        if (!text || typeof text !== 'string') throw new ManatsuError('O texto fornecido é inválido.');
        if (!selector || !Validation.isSelectorValid(selector)) {
            throw new ManatsuError('O seletor fornecido é inválido');
        };

        if (sensitive === false) text = text.toLowerCase();
        const elements = Array.from(document.querySelectorAll(selector));
        for (const element of elements) {
            let textContent = element.textContent;
            if (!textContent) continue;
            if (sensitive === false) textContent = textContent.toLowerCase();

            switch (exact) {
                case true: if (textContent === text) return element;
                    break;
                case false: if (textContent.includes(text)) return element;
                    break;
            };
        };

        return null;
    };

    /**
     * Gera um seletor CSS que identifica precisamente o elemento indicado.
     * @param element Elemento a partir do qual gerar o seletor.
     * @param attributes Indica se os atributos do elemento também devem ser inclusos no seletor.
     * @param insensitive Indica se deve haver diferenciação entre maiúsculas e minúsculas no valor dos atributos.
     * @returns Seletor CSS.
     */
    public static getSelector(element: Element, attributes: boolean = false, insensitive: boolean = false) {
        if (!(element instanceof Element)) throw new ManatsuError('O elemento é inválido.');

        const getElementSelectors = (el: Element): string => {
            const nodeName = el.nodeName.toLowerCase();

            let id = el.getAttribute('id') ?? '';
            if (id) id = `#${id}`;

            const classes = el.getAttribute('class')?.split(' ')
                .filter((value) => value);

            let classList: string = '';
            if (Array.isArray(classes)) {
                for (const name of classes) {
                    classList = classList.concat(`.${name}`);
                };
            };

            let attributeList: string = '';
            if (attributes === true) {
                for (const name of el.getAttributeNames()) {
                    if (name === 'class' || name === 'id') continue;
                    const value = el.getAttribute(name);

                    const insensibility = insensitive === true ? ' i' : '';
                    const attributeSelector = `[${name}="${value}"${insensibility}]`;
                    attributeList = attributeList.concat(attributeSelector);
                };
            };

            let selector = `${nodeName}${id}${classList}${attributeList}`;
            if (nodeName === 'html') return selector;

            const previousSiblingName = el.previousElementSibling?.nodeName.toLowerCase();
            if (previousSiblingName) selector = `${previousSiblingName} + ${selector}`;

            const requiredOrOptional = ['input', 'select', 'textarea'];
            if (requiredOrOptional.includes(nodeName)) {
                switch (el.hasAttribute('required')) {
                    case true:
                        selector = selector.concat(':required');
                        break;
                    case false:
                        selector = selector.concat(':optional');
                        break;
                };
            };

            const parent = el.parentElement;
            // Verifica se o elemento é o primeiro entre seus possíveis irmãos.
            if (parent?.firstElementChild === el) selector = selector.concat(':first-child');
            // Verifica se ele é o último.
            if (!el.nextElementSibling) selector = selector.concat(':last-child');

            if (parent) {
                // Verifica se é o único de seu tipo.
                const sameTypeSiblings = parent.querySelectorAll(nodeName);
                if (sameTypeSiblings.length === 1) selector = selector.concat(':only-of-type');

                // Se o elemento possuir um pai, obtem também seus seletores.
                selector = `${getElementSelectors(parent)} ${selector}`;
            };
            
            return selector;
        };

        return getElementSelectors(element);
    };

    /**
     * Remove um ou mais elementos do documento.
     * Ao contrário de `Node.removeChild()`, não é necessário especificar o pai.
     * Além disso, quando mais de um elemento é fornecido, não é necessário que todos tenham o mesmo pai.
     * @param elementsToRemove Elemento(s) que se deseja remover do documento.
     */
    public static remove(elementsToRemove: Element | Element[]) {
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
    public static removeChildren(parentElement: Element, selector?: string | string[]) {
        if (!(parentElement instanceof Element)) throw new ManatsuError('O elemento fornecido é inválido.');
 
        if (typeof selector === 'string' && Validation.isSelectorValid(selector)) {
            const children = parentElement.querySelectorAll(selector);
            children.forEach((child: Element) => parentElement.removeChild(child));

        } else if (Array.isArray(selector)) {
            for (const key of selector) {
                if (typeof key !== 'string' || !Validation.isSelectorValid(key)) continue;

                const children = parentElement.querySelectorAll(key);
                children.forEach((child: Element) => parentElement.removeChild(child));
            };

        } else {
            while (parentElement.firstChild) parentElement.removeChild(parentElement.firstChild);
        };
    };

    /** 
     * Cria vários objetos Manatsu a partir dos parâmetros especificados. 
     * É possível designar vários tipos diferentes para os elementos, mas apenas um `parent` e um objeto `options`. 
     * 
     * Caso vários tipos sejam fornecidos, `repeat()` os atribuirá em ordem. 
     * Se a quantidade de cópias desejada for maior que a quantidade de tipos fornecidos, 
     * `repeat()` fará normalmente a atribuição em ordem para esses fornecidos e atribuirá `div` ao restante.
     * 
     * A ordem dos argumentos não é relevante, apenas seu tipo.
     */
    public static repeat(...args: RepeatConstructor): Manatsu[] | HTMLElement[] {
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
                if (!Validation.isElementNameValid(arg)) continue;
                element.push(arg);

            } else if (Array.isArray(arg)) {
                arg.forEach((item: unknown) => {
                    if (typeof item === 'string' && Validation.isElementNameValid(item)) element.push(item);
                });
                
            } else if (arg instanceof Element) {
                if (parent === null) parent = arg;

            } else if (Validation.isOptionValid(arg)) {
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
    // Manatsu.prototype.createWithChildren() ?
    get element() { return this.#element };
    get parent() { return this.#parent };
    get options() { return this.#options };

    get style() {
        const self = this;
        return new Proxy(this.#style, {
            get(target, property) {
                if (!property || typeof property !== 'string') throw new ManatsuError('O nome da propriedade é inválido.');

                if (property.includes('\_')) property = property.replaceAll('\_', '\-');
                return Reflect.get(target, property);
            },

            set(target, property, value) {
                if (!property || typeof property !== 'string') throw new ManatsuError('O nome da propriedade é inválido.');
                if (!value || typeof value !== 'string') throw new ManatsuError('O valor da propriedade é inválido.');

                if (!self.#options) self.#options = {};

                if (property.includes('\_')) property = property.replaceAll('\_', '\-');
                const styleList: string[] = [`${property}: ${value};`];

                for (let [prop, val] of Object.entries(self.#style)) {
                    if (prop.includes('\_')) prop = prop.replaceAll('\_', '\-');
                    styleList.push(`${prop}: ${val};`);
                };

                self.#options.style = styleList.join(' ').trim();

                return Reflect.set(target, property, value);
            }
        });
    };

    set element(name: string) {
        if (typeof name === 'string' && Validation.isElementNameValid(name)) {
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

    // É necessário trocar para um Proxy.
    set options(item: Option | null) {
        if (Validation.isOptionValid(item)) {
            this.#options = item;
        } else {
            throw new ManatsuError('O item fornecido é inválido.');
        };
    };

    get createAfter() { return this.#createThere('after') };
    get createBefore() { return this.#createThere('before') };
    get createInsideThenAfter() { return this.#createInsideThen('after') };
    get createInsideThenBefore() { return this.#createInsideThen('before') };
};

class Validation {
    public static isElementNameValid(name: string) {
        if (name.length === 0) throw new ManatsuError('O nome do elemento não foi fornecido.');
        if (!Boolean(name[0].match(/[a-zA-Z]/))) throw new ManatsuError('O nome do elemento precisa iniciar com uma letra (a-z).');
        return true;
    };

    public static isOptionValid(obj: unknown) {
        if (Object.getPrototypeOf(obj) === Object.prototype) {
            for (const [attribute, content] of Object.entries(obj as object)) {
                if (typeof attribute !== 'string') throw new ManatsuError('O nome do atributo precisa ser uma string.');
                if (typeof content !== 'string') throw new ManatsuError('O valor do atributo precisa ser uma string.');
            };
            return true;
        };
        return false;
    };

    public static isSelectorValid(selector: string) {
        if (typeof selector !== 'string') throw new ManatsuError('O seletor precisa ser uma string');

        try {
            document.createDocumentFragment().querySelector(selector);
            return true;

        } catch {
            return false;
        };
    };
};

class ManatsuError extends Error {
    constructor(message: string) {
        super();

        this.name = 'ManatsuError';
        this.message = message;
    };
};

// Adiciona métodos aos objetos originais do DOM.
HTMLElement.prototype.appendManatsu = function(...args: HTMLConstructorArgs): HTMLElement {
    // Se for houver um objeto Manatsu entre os argumentos, ele é usado e todos os outros são ignorados.
    for (const arg of args) {
        if (arg instanceof Manatsu) return arg.create();
    };

    const newElement = new Manatsu(...args as ConstructorArgs);
    newElement.parent = this;

    return newElement.create();
};