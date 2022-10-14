class Game {
    static #worldInfo: WorldInfo;
    static #unitInfo: UnitInfo;

    /** Mundo atual. */
    static readonly world = Insidious.raw_game_data.world;
    /** Janela atual. */
    static readonly screen = Insidious.raw_game_data.screen;
    /** ID da aldeia atual. */
    static readonly village = String(Insidious.raw_game_data.village.id);
    /** ID do jogador. */
    static readonly player = Insidious.raw_game_data.player.id;
    /** ID do grupo de aldeias. */
    static readonly group = String(Insidious.raw_game_data.group_id);
    /** Coordenada X da aldeia atual. */
    static readonly x = Insidious.raw_game_data.village.x;
    /** Coordenada Y da aldeia atual. */
    static readonly y = Insidious.raw_game_data.village.y;
    /** Quantidade de madeira na aldeia. */
    static readonly wood = Insidious.raw_game_data.village.wood;
    /** Quantidade de argila na aldeia. */
    static readonly stone = Insidious.raw_game_data.village.stone;
    /** Quantidade de ferro na aldeia. */
    static readonly iron = Insidious.raw_game_data.village.iron;

    /** Mundo atual. */
    readonly world: string;
    /** Janela atual. */
    readonly screen: string;
    /** ID da aldeia atual. */
    readonly village: string;
    /** ID do jogador. */
    readonly player: number;
    /** ID do grupo de aldeias. */
    readonly group: string;
    /** Coordenada X da aldeia atual. */
    readonly x: number;
    /** Coordenada Y da aldeia atual. */
    readonly y: number;
    /** Quantidade de madeira na aldeia. */
    readonly wood: number;
    /** Quantidade de argila na aldeia. */
    readonly stone: number;
    /** Quantidade de ferro na aldeia. */
    readonly iron: number;

    /** Cria um objeto com informações atualizadas sobre o jogo. */
    constructor() {
        this.world = Insidious.raw_game_data.world;
        this.screen = Insidious.raw_game_data.screen;
        this.village = String(Insidious.raw_game_data.village.id);
        this.player = Insidious.raw_game_data.player.id;
        this.group = String(Insidious.raw_game_data.group_id);
        this.x = Insidious.raw_game_data.village.x;
        this.y = Insidious.raw_game_data.village.y;
        this.wood = Insidious.raw_game_data.village.wood;
        this.stone = Insidious.raw_game_data.village.stone;
        this.iron = Insidious.raw_game_data.village.iron;
    };

    /** Verifica se os dados obtidos são válidos. */
    static verifyIntegrity() {
        for (const [key, value] of Object.entries(Game)) {
            if (value === undefined) throw new InsidiousError(`Não foi possível obter o seguinte dado: ${key.toUpperCase()}.`);
        };
    };

    /** Armazena as configurações do mundo para que as outras classes tenham acesso. */
    static async setWorldInfo() {
        // A coerção de tipo está sendo feita porquê logo após ela há uma verificação do valor das variáveis.
        this.#worldInfo = await Store.get(Keys.config) as WorldInfo;
        this.#unitInfo = await Store.get(Keys.unit) as UnitInfo;
        if (!this.#worldInfo || !this.#unitInfo) await Store.remove(Keys.worldConfig);
    };

    static get worldInfo() {return this.#worldInfo};
    static get unitInfo() {return this.#unitInfo};
};