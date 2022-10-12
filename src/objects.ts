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
            if (!unitElem || unitElem.textContent === null) throw new InsidiousError(`DOM: #farm_units #units_home tbody tr td#${unit}`);

            this[unit] = Number.parseInt(unitElem.textContent, 10);
            
        }, this);   
    };
};