class Resources implements ResourcesObject {
    /** Quantidade de madeira na aldeia. */
    readonly wood: number;
    /** Quantidade de argila na aldeia. */
    readonly stone: number;
    /** Quantidade de ferro na aldeia. */
    readonly iron: number;
    /** Capacidade máxima do armazém. */
    readonly storage_max = Insidious.raw_game_data.village.storage_max;

    constructor(wood?: number, stone?: number, iron?: number) {
        this.wood = wood ?? Insidious.raw_game_data.village.wood;
        this.stone = stone ?? Insidious.raw_game_data.village.stone;
        this.iron = iron ?? Insidious.raw_game_data.village.iron;
    };
};

class ResourceAmount {
    wood: number;
    stone: number;
    iron: number;

    constructor(wood: number = 0, stone: number = 0, iron: number = 0) {
        this.wood = wood;
        this.stone = stone;
        this.iron = iron;
    };
};

class ResourceNameAndAmount {
    readonly name: ResourceList;
    readonly amount: number;

    constructor(name: ResourceList, amount: number) {
        this.name = name;
        this.amount = amount;
    };
};

class ResourceRatio extends Resources {
    /** Recurso em maior quantidade. */
    readonly surplus: ResourceNameAndAmount;
    /** Recurso em menor quantidade. */
    readonly shortage: ResourceNameAndAmount;
    /** Soma de todos os recursos da aldeia. */
    readonly total = this.wood + this.stone + this.iron;
    /** Média de todos os recursos da aldeia. */
    readonly mean = Math.floor(this.total / 3);

    constructor(wood?: number, stone?: number, iron?: number) {
        super(wood, stone, iron);

        const resourceAmount: ResourceNameAndAmount[] = [];
        Assets.list.resources.forEach((res) => {
            const amount = new ResourceNameAndAmount(res, this[res]);
            resourceAmount.push(amount);
        }, this);

        // Do recurso em maior quantidade para o em menor quantidade.
        const sortedResources = resourceAmount.sort((a, b) => b.amount - a.amount);

        this.surplus = sortedResources[0];
        this.shortage = sortedResources[2];
    };
};