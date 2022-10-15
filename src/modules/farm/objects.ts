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

    /** Cria um objeto com a capacidade total de carga de cada modelo. */
    constructor() {
        const calcEachCarryCapacity = (unitModel: AvailableFarmUnits) => {
            let result = 0;
            for (const [key, value] of Object.entries(unitModel)) {
                // Ignora o explorador, já que ele não pode carregar recursos.
                if (key !== 'spy') {
                    result += value * Game.unitInfo[key as FarmUnitsWithArchers].carry;
                };
            };

            if (!Number.isInteger(result)) {
                throw new InsidiousError('O valor calculado para a capacidade de carga é inválido.');
            };

            return result;
        };

        const capacityA = calcEachCarryCapacity(Plunder.amodel);
        const capacityB = calcEachCarryCapacity(Plunder.bmodel);

        // Caso o valor seja zero, surge uma divisão por zero no cálculo da razão.
        // Qualquer valor dividido por Infinity se torna zero, o que o torna a melhor opção lá.
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

class ExpectedResources implements ResourceAmount {
    wood: number;
    stone: number;
    iron: number;

    /**
     * Calcula a quantidade recursos esperada no saque (sempre pressupondo carga total).
     * @param village - Elemento representando a aldeia atual.
     * @param carry - Capacidade de carga do modelo escolhido pelo Plunder.
     */
    constructor(village: HTMLElement, carry: number) {
        const woodAmount: string | null = village.getAttribute('insidious-wood');
        const stoneAmount: string | null = village.getAttribute('insidious-stone');
        const ironAmount: string | null = village.getAttribute('insidious-iron');

        if (!woodAmount || !stoneAmount || !ironAmount) {
            throw new InsidiousError('O atributo que informa a quantidade de recursos está ausente.');
        };

        this.wood = Number.parseInt(woodAmount, 10);
        this.stone = Number.parseInt(stoneAmount, 10);
        this.iron = Number.parseInt(ironAmount, 10);

        /** 
         * Caso a soma resulte em zero, "totalAmount = Infinity" garante que não surja uma divisão por zero mais adiante.
         * Qualquer valor dividido por Infinity é igual a zero.
         */
        let totalAmount = this.wood + this.stone + this.iron;
        if (totalAmount === 0) totalAmount = Infinity;

        [this.wood, this.stone, this.iron].forEach((amount: number, index) => {
            if (Number.isNaN(amount)) throw new InsidiousError('O valor dos recursos não é válido.');

            // Se houver mais recursos do que a carga suporta, calcula quanto de cada recurso deve ser saqueado.
            if (totalAmount > carry) amount = Math.floor((amount / totalAmount) * carry);

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
            if (Number.isNaN(amount)) {
                throw new InsidiousError(`A quantidade de unidades obtida é inválida ${unit}.`);
            };

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