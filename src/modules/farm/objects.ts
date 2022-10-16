class PlunderButtons {
    /** Seções do menu do Plunder. */
    readonly section: SHTMLObject = { };
    /** Botões do Plunder. */
    readonly button: SHTMLObject = { };

    constructor() {
        const plunderFilters = document.querySelector('#plunder_list_filters');
        if (!plunderFilters) throw new InsidiousError('DOM: #plunder_list_filters');

        // Elementos da extensão.
        this.section.main = new Manatsu({ id: 'insidious_farmMenuArea' }).createBefore(plunderFilters.nextElementSibling);
        this.section.button = new Manatsu({ id: 'insidious_farmButtonArea' }, this.section.main).create();
        this.section.action = new Manatsu({ id: 'insidious_farmActionArea' }, this.section.main).create();

        this.button.plunder = new Manatsu('button', { class: 'insidious_farmAreaBtn', id: 'insidious_plunderButton' }).create();
        this.button.options = new Manatsu('button', { class: 'insidious_farmAreaBtn', text: 'Opções' }).create();
        this.button.info = new Manatsu('button', { class: 'insidious_farmAreaBtn', text: 'Informações' }).create();

        ////// EVENTOS
        this.button.plunder.addEventListener('click', Farm.togglePlunder);
        this.button.options.addEventListener('click', () => Farm.toggleOptions());
        this.button.info.addEventListener('click', () => Farm.toggleInfo());
    };
};

class ModelUnitAmount {
    readonly a: AvailableFarmUnits = {
        spear: 0,
        sword: 0,
        axe: 0,
        spy: 0,
        light: 0,
        heavy: 0,
        knight: 0
    };
    readonly b: AvailableFarmUnits = {
        spear: 0,
        sword: 0,
        axe: 0,
        spy: 0,
        light: 0,
        heavy: 0,
        knight: 0
    };

    /**
     * Cria um objeto contendo a quantidade de tropas nos modelos A e B do assistente de saque.
     * @param inputFields - Elementos input contendo a quantidade de cada unidade.
     * @param aRow - Linha do modelo A para ser usada como referência.
     */
    constructor(inputFields: NodeListOf<Element>, aRow: Element) {
        for (const field of Array.from(inputFields)) {
            /** O atributo name é usado para determinar a unidade referente ao campo. */
            const fieldName = field.getAttribute('name');
            if (!fieldName) throw new InsidiousError('O atributo \"name\" não foi encontrado nos campos de texto dos modelos.');

            /** O valor no atributo name é algo como "spear[11811]". */
            const fieldType = fieldName.slice(0, fieldName.indexOf('\[')) as keyof AvailableFarmUnits;
            /** Contém a quantidade de unidades. */
            const fieldValue = field.getAttribute('value');
            if (!fieldValue) throw new InsidiousError(`Não foi possível encontrar o valor do campo de texto \"${fieldType}\".`);

            // Verifica se o campo pertence ao modelo A.
            if (field.parentElement?.parentElement === aRow) {
                field.setAttribute('insidious-model-a', fieldType);
                this.a[fieldType] = Number.parseInt(fieldValue, 10);

            // Se não for o caso, assume que pertence ao modelo B.
            } else {
                field.setAttribute('insidious-model-b', fieldType);
                this.b[fieldType] = Number.parseInt(fieldValue, 10);
            };
        };
    };
};

class CarryCapacity {
    readonly a: number;
    readonly b: number;
    readonly c: number = Infinity;

    /** Cria um objeto com a capacidade total de carga de cada modelo. */
    constructor(cmodel?: AvailableFarmUnits) {
        const calcEachCarryCapacity = (unitModel: AvailableFarmUnits) => {
            let result = 0;
            for (let [key, value] of Object.entries(unitModel)) {
                // O JSON do modelo C aleatoriamente envia strings.
                if (typeof value !== 'number') value = Number.parseInt(value, 10);
                if (!Number.isInteger(value)) throw new InsidiousError(`A carga para ${key} é inválida (${value}).`);

                // Ignora a milícia, que aparece quando o modelo é do tipo C.
                if (key !== 'militia') {
                    result += value * Game.unitInfo[key as FarmUnitsWithArchers].carry;
                };
            };

            if (!Number.isInteger(result)) throw new InsidiousError('O valor calculado para a capacidade de carga é inválido.');

            return result;
        };

        if (cmodel) {
            const capacityC = calcEachCarryCapacity(cmodel);
            if (capacityC > 0) this.c = capacityC;
        };

        const capacityA = calcEachCarryCapacity(Plunder.amodel);
        const capacityB = calcEachCarryCapacity(Plunder.bmodel);

        // Atribuir Infinity impede divisões por zero.
        this.a = capacityA === 0 ? Infinity : capacityA;
        this.b = capacityB === 0 ? Infinity : capacityB;
    };
};

class ModelRatio {
    ratioIsOk: boolean = false;
    bestRatio: ABNull = null;
    otherRatio: ABNull = null;

    /**
     * Cria um objeto que indica qual modelo usar, tendo como base a capacidade de cada um e os recursos disponíveis.
     * Caso modelo nenhum seja adequado, o ataque não será enviado.
     * @param resourceAmount - Recursos disponíveis na aldeia alvo.
     */
    constructor(resourceAmount: number) {
        const bigger = Plunder.carry.a >= Plunder.carry.b ? 'a' : 'b';
        const smaller = Plunder.carry.a < Plunder.carry.b ? 'a' : 'b';

        // Se ambos são menores que a quantidade de recursos, basta mandar o maior.
        // A diferença entre a carga do maior e a quantidade de recursos não é relevante nesse caso.
        if (resourceAmount >= Plunder.carry[bigger]) {
            this.bestRatio = bigger;
            this.otherRatio = smaller;
            this.ratioIsOk = true;

        // Se os dois são maiores, descartam-se aqueles que estejam fora da zona aceitável.
        // Se todos forem descartados, não haverá ataque.
        } else if (resourceAmount <= Plunder.carry[smaller]) {
            this.bestRatio = resourceAmount / Plunder.carry[smaller] >= 0.8 ? smaller : null;
            this.otherRatio = resourceAmount / Plunder.carry[bigger] >= 0.8 ? bigger : null;
            if (this.bestRatio !== null) this.ratioIsOk = true;

        // Nesse caso, a quantidade de recursos é maior que a carga de um, mas menor que a de outro.
        } else {
            // Razão em relação ao maior (será sempre MENOR que 1).
            const ratioBigger = resourceAmount / Plunder.carry[bigger];
            // Razão em relação ao menor (será sempre MAIOR que 1).
            const ratioSmaller = resourceAmount / Plunder.carry[smaller];

            // O de maior carga é descartado caso seja grande demais.
            // O menor é dado como válido pois valores menores são sempre adequados.
            if (ratioBigger < 0.8) {
                this.bestRatio = smaller;
                this.otherRatio = null;
                this.ratioIsOk = true;

            // Caso o maior seja válido, verifica-se qual está mais próximo da quantidade de recursos.
            } else {
                this.bestRatio = (1 - ratioBigger) <= (ratioSmaller - 1) ? bigger : smaller;
                this.otherRatio = (1 - ratioBigger) > (ratioSmaller - 1) ? bigger : smaller;
                this.ratioIsOk = true;
            };
        };
    };
};

class ExpectedResources {
    /** Modelo usado no ataque. */
    readonly model: ABC;
    /** Quantidade de madeira esperada no saque. */
    wood: number;
    /** Quantidade de argila esperada no saque. */
    stone: number;
    /** Quantidade de ferro esperada no saque. */
    iron: number;

    /**
     * Calcula a quantidade recursos esperada no saque.
     * Sempre presume carga total.
     * @param village - Elemento representando a aldeia atual.
     * @param model - Modelo usado no ataque.
     */
    constructor(village: HTMLElement, model: ABC) {
        // Um erro será emitido posteriormente caso os valores não sejam strings.
        const woodAmount = village.getAttribute('insidious-wood') as string;
        const stoneAmount = village.getAttribute('insidious-stone') as string;
        const ironAmount = village.getAttribute('insidious-iron') as string;

        this.wood = Number.parseInt(woodAmount, 10);
        this.stone = Number.parseInt(stoneAmount, 10);
        this.iron = Number.parseInt(ironAmount, 10);

        // Atribuir Infinity impede divisões por zero.
        let totalAmount = this.wood + this.stone + this.iron;
        if (totalAmount === 0) totalAmount = Infinity;

        this.model = model;
        // Se a capacidade de carga for zero, o valor de carry será Infinity.
        const carry = (model !== 'c') ? Plunder.carry[model] : Plunder.getCModelCarryCapacity(village);

        [this.wood, this.stone, this.iron].forEach((amount, index) => {
            // Se houver mais recursos do que a carga suporta, calcula quanto de cada recurso deve ser saqueado.
            if (totalAmount > carry) amount = Math.floor((amount / totalAmount) * carry);
            if (!Number.isInteger(amount)) throw new InsidiousError('A quantia de recursos não é válida.');

            switch (index) {
                case 0: this.wood = amount;
                    break;
                case 1: this.stone = amount;
                    break;
                case 2: this.iron = amount;
                    break;
            };

        }, this);
    };
};

class PlunderedAmount implements TotalPlundered {
    readonly wood: number;
    readonly stone: number;
    readonly iron: number;
    readonly attack_amount: number;

    /**
     * Cria um objeto representando a quantidade de recursos saqueados pelo processo atual do Plunder.
     * @param expected - Estimativa de saque do ataque atual.
     * @param firstAttack - Indica se esse é ou não o primeiro ataque;
     */
    constructor(expected: ExpectedResources, firstAttack: boolean) {
        if (firstAttack === false) {
            const plundered = Plunder.amount as TotalPlundered;
            this.wood = plundered.wood + expected.wood;
            this.stone = plundered.stone + expected.stone;
            this.iron = plundered.iron + expected.iron;
            this.attack_amount = ++plundered.attack_amount;

        } else {
            this.wood = expected.wood;
            this.stone = expected.stone;
            this.iron = expected.iron;
            this.attack_amount = 1;
        };
    };
};

class PlunderAvailableTroops {
    spear?: number;
    sword?: number;
    axe?: number;
    spy?: number;
    light?: number;
    heavy?: number;
    knight?: number;
    archer?: number;
    marcher?: number;

    /**
     * Cria um objeto com a quantidade de tropas disponíveis para uso no Plunder.
     * @param units - Lista de unidades.
     */
    constructor(units: FarmUnitsWithArchers[]) {
        units.forEach((unit) => {
            const unitElem = document.querySelector(`#farm_units #units_home tbody tr td#${unit}`);
            if (!unitElem || unitElem.textContent === null) {
                throw new InsidiousError(`DOM: #farm_units #units_home tbody tr td#${unit}`);
            };

            const amount = Number.parseInt(unitElem.textContent, 10);
            if (Number.isNaN(amount)) throw new InsidiousError(`A quantidade de unidades obtida é inválida ${unit}.`);

            this[unit] = amount;
            
        }, this);   
    };
};

class PlunderGroupNavigation {
    /** Última aldeia com a qual o Plunder atacou. */
    readonly last_attacking_village: string | null = null;
    /** Aldeia na qual o Plunder estava quando utilizou a opção "Group Jump" pela última vez. */
    readonly last_group_jump: string | null = null;
    /** Data do último evento. */
    readonly date: number = 0;

    /**
     * Cria um objeto com detalhes sobre a navegação entre aldeias feita pelo Plunder.
     * @param type O tipo de navegação feita.
     */
    constructor(type?: 'attack' | 'jump') {
        if (type) {
            this.date = Date.now();

            switch (type) {
                case 'attack': this.last_attacking_village = Game.village;
                    break;
                case 'jump': this.last_group_jump = Game.village;
                    break;
            };
        };
    };
};

class PlunderPageNavigation {
    /** Data da última troca de página. */
    readonly date: number;
    /** ID da aldeia atual. */
    readonly village: string = Game.village;

    /** Cria um objeto detalhes sobre a última troca de página no Plunder. */
    constructor() {
        this.date = Date.now();
    };
};

class PlunderPageURL {
    /** URL da primeira página. */
    readonly first: string;
    /** URL da próxima página. */
    readonly next: string | null = null;
    
    /**
     * Cria um objeto contendo as URLs para navegação entre páginas do Plunder.
     * @param plunderListNav Linha da tabela com os números das páginas.
     * @param currentPage Numeração da página atual.
     */
    constructor(plunderListNav: Element, currentPage?: number) {
        // Seleciona um link arbitrário para servir como referência para a construção do novo.
        // Exemplo de link: "/game.php?village=23215&screen=am_farm&order=distance&dir=asc&Farm_page=1".
        const plunderPageArbitraryLink = plunderListNav.querySelector('a.paged-nav-item');
        if (!plunderPageArbitraryLink) throw new InsidiousError('Não foi encontrado um link de referência para a navegação.');

        // A coerção de tipo é feita pois há uma verificação logo após.
        const pageURL = plunderPageArbitraryLink.getAttribute('href') as string;
        if (!pageURL) throw new InsidiousError('Não foi possível obter a URL para a navegação entre as páginas.');

        // Determina qual página foi escolhida arbitrariamente.
        let arbitraryPage: string | string[] = pageURL.split('&').filter((item) => item.includes('Farm_page='));
        arbitraryPage = arbitraryPage[0].replace(/\D/g, '');
        if (!arbitraryPage) throw new InsidiousError('Não foi possível determinar uma página arbitrária.');

        // Ao contrário de como acontece na lista, as páginas no link começam no índice zero.
        // Ou seja, no link, a página 2 é representada por "Farm_page=1", e a página 5 por "Farm_page=4".
        this.first = pageURL.replace(`Farm_page=${arbitraryPage}`, 'Farm_page=0');

        if (currentPage !== undefined) {
            // Para navegar para a próxima página, é preciso usar currentPage ao atribuir o link.
            // Isso porquê currentPage é a numeração na lista (começa no indíce 1), mas o link em si começa no índice zero.
            // Logo, se a página atual é a 3, seu link é "Farm_page=2", com o link da próxima sendo "Farm_page=3".
            if (Number.isInteger(currentPage)) {
                this.next = pageURL.replace(`Farm_page=${arbitraryPage}`, `Farm_page=${String(currentPage)}`);
            } else {
                throw new InsidiousError('A página atual é inválida (PlunderPageURL).');
            };
        };
    };
};

class PlunderAttack {
    /** ID da aldeia atual. */
    readonly id: string;
    /** Quantidade total de recursos disponíveis na aldeia alvo. */
    readonly resources: number;
    /** Nível da muralha. */
    readonly wall_level: number;
    /** Estado do botão C. */
    readonly c_button: OnOff;

    /**
     * Cria um objeto com informações sobre o ataque a ser enviado.
     * @param village Elemento correspondente à linha na qual a aldeia se encontra na tabela.
     */
    constructor(village: HTMLElement) {
        const villageID = village.getAttribute('insidious-village');
        if (!villageID) throw new InsidiousError('Não foi possível obter o id da aldeia.');
        this.id = villageID;

        const cFarmBtnStatus = village.getAttribute('insidious-c-btn') as OnOff | null;
        if (!cFarmBtnStatus) throw new InsidiousError('Não foi possível determinar o estado do botão C.');
        this.c_button = cFarmBtnStatus;

        const resourceAmount = Number.parseInt(village.getAttribute('insidious-resources') as string, 10);
        if (Number.isNaN(resourceAmount)) throw new InsidiousError('Não foi possível obter a quantidade de recursos da aldeia.');
        this.resources = resourceAmount;

        const wallLevel = village.getAttribute('insidious-wall');
        if (!wallLevel) throw new InsidiousError('Não foi possível determinar o nível da muralha.');
        this.wall_level = Number.parseInt(wallLevel, 10);
        if (Number.isNaN(this.wall_level)) throw new InsidiousError('O nível da muralha é inválido.');
    };
};