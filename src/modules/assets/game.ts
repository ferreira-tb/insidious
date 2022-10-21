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
    /** Hora na qual a página foi carregada. */
    static readonly time_generated = Insidious.raw_game_data.time_generated;

    static readonly offset_from_server = Insidious.raw_game_data.offset_from_server;
    static readonly offset_to_server = Insidious.raw_game_data.offset_to_server;

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
    /** Hora na qual a página foi carregada. */
    readonly time_generated: number;

    readonly offset_from_server: number;
    readonly offset_to_server: number;

    /**
     * Cria um objeto com informações atualizadas sobre o jogo.
     * O construtor só deve ser chamado após `Insidious.updateGameData()`.
     * */
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
        this.time_generated = Insidious.raw_game_data.time_generated;

        this.offset_from_server = Insidious.raw_game_data.offset_from_server;
        this.offset_to_server = Insidious.raw_game_data.offset_to_server;
    };

    /** Verifica se os dados obtidos são válidos. */
    static verifyIntegrity() {
        for (const [key, value] of Object.entries(Game)) {
            if (value === undefined) throw new InsidiousError(`Não foi possível obter o seguinte dado: ${key.toUpperCase()}.`);
        };
    };

    /** Armazena as configurações do mundo para que as outras classes tenham acesso. */
    static async setWorldConfig() {
        this.#worldInfo = await Store.get(Keys.config) as WorldInfo;
        this.#unitInfo = await Store.get(Keys.unit) as UnitInfo;
        if (!this.#worldInfo || !this.#unitInfo) await Store.remove(Keys.worldConfig);
    };

    static get worldInfo() {return this.#worldInfo};
    static get unitInfo() {return this.#unitInfo};
};