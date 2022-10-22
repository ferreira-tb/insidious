class Game {
    static #worldInfo: WorldInfo;
    static #unitInfo: UnitInfo;

    /** Obtém o valor de algum campo da URL. */
    private static currentField(fieldName: string) {
        return function(url: string) {
            if (typeof url !== 'string') throw new InsidiousError('A URL fornecida é inválida.');

            const urlFields = (url.replace('\?', '')).split('\&');
            for (const field of urlFields) {
                if (field.includes(`${fieldName}=`)) return field.replace(`${fieldName}=`, '');
            };
            return null;
        };
    };

    static readonly currentScreen = this.currentField('screen');
    static readonly currentMode = this.currentField('mode');
    static readonly currentSubType = this.currentField('subtype');

    /** Mundo atual. */
    static readonly world = Insidious.raw_game_data.world;
    /** Janela atual. */
    static readonly screen = Insidious.raw_game_data.screen ?? this.currentScreen(location.href);
    /** Modo da janela atual. */
    static readonly mode = Insidious.raw_game_data.mode ?? this.currentMode(location.href);
    /** Subtipo da janela atual. */
    static readonly subtype = this.currentSubType(location.href);
    /** ID do grupo de aldeias. */
    static readonly group = String(Insidious.raw_game_data.group_id);

    /** ID do jogador. */
    static readonly player = Insidious.raw_game_data.player.id;
    /** Nome do jogador. */
    static readonly player_name = Insidious.raw_game_data.player.name;
    /** Quantidade de aldeias do jogador. */
    static readonly village_amount = Insidious.raw_game_data.player.villages;

    /** ID da aldeia atual. */
    static readonly village = String(Insidious.raw_game_data.village.id);
    /** Edifícios da aldeia atual. */
    static readonly buildings = Insidious.raw_game_data.village.buildings;
    /** Coordenada X da aldeia atual. */
    static readonly x = Insidious.raw_game_data.village.x;
    /** Coordenada Y da aldeia atual. */
    static readonly y = Insidious.raw_game_data.village.y;

    /** Quantidade de madeira na aldeia. */
    static readonly wood = Insidious.raw_game_data.village.wood;
    /** Produção de madeira por segundo na aldeia atual. */
    static readonly wood_prod = Insidious.raw_game_data.village.wood_prod;
    /** Quantidade de argila na aldeia. */
    static readonly stone = Insidious.raw_game_data.village.stone;
    /** Produção de argila por segundo na aldeia atual. */
    static readonly stone_prod = Insidious.raw_game_data.village.stone_prod;
    /** Quantidade de ferro na aldeia. */
    static readonly iron = Insidious.raw_game_data.village.iron;
    /** Produção de ferro por segundo na aldeia atual. */
    static readonly iron_prod = Insidious.raw_game_data.village.iron_prod;
    /** Capacidade máxima do armazém. */
    static readonly storage_max = Insidious.raw_game_data.village.storage_max;

    /** Mercadores fora da aldeia. */
    static readonly trader_away = Insidious.raw_game_data.village.trader_away;
    /** Quantidade de mercadores na aldeia. */
    static readonly trader_amount: number | null = Insidious.raw_game_data.trader_amount;
    /** Total de mercadores da aldeia. */
    static readonly trader_total: number | null = Insidious.raw_game_data.trader_total;
    /** Capacidade dos mercadores. */
    static readonly trader_carry: number | null = Insidious.raw_game_data.trader_carry;
    /** Informações sobre a Troca Premium. */
    static readonly premium_exchange = Insidious.raw_game_data.premium_exchange;

    /** Hora na qual a página foi carregada. */
    static readonly time_generated = Insidious.raw_game_data.time_generated;
    static readonly offset_from_server = Insidious.raw_game_data.offset_from_server;
    static readonly offset_to_server = Insidious.raw_game_data.offset_to_server;

    ////// INSTÂNCIA
    // É possível criar uma instância de Game contendo dados mais atualizados.
    // No entanto, primeiro é preciso chamar Insidious.updateGameData().
    /** Mundo atual. */
    readonly world = Insidious.raw_game_data.world;
    /** Janela atual. */
    readonly screen = Insidious.raw_game_data.screen ?? Game.currentScreen(location.href);
    /** Modo da janela atual. */
    readonly mode =  Insidious.raw_game_data.mode ?? Game.currentMode(location.href);
    /** Subtipo da janela atual. */
    readonly subtype = Game.currentSubType(location.href);
    /** ID do grupo de aldeias. */
    readonly group = String(Insidious.raw_game_data.group_id);

    /** ID do jogador. */
    readonly player = Insidious.raw_game_data.player.id;
    /** Nome do jogador. */
    readonly player_name = Insidious.raw_game_data.player.name;
    /** Quantidade de aldeias do jogador. */
    readonly village_amount = Insidious.raw_game_data.player.villages;

    /** ID da aldeia atual. */
    readonly village = String(Insidious.raw_game_data.village.id);
    /** Edifícios da aldeia atual. */
    readonly buildings = Insidious.raw_game_data.village.buildings;
    /** Coordenada X da aldeia atual. */
    readonly x = Insidious.raw_game_data.village.x;
    /** Coordenada Y da aldeia atual. */
    readonly y = Insidious.raw_game_data.village.y;

    /** Quantidade de madeira na aldeia. */
    readonly wood = Insidious.raw_game_data.village.wood;
    /** Produção de madeira por segundo na aldeia atual. */
    readonly wood_prod = Insidious.raw_game_data.village.wood_prod;
    /** Quantidade de argila na aldeia. */
    readonly stone = Insidious.raw_game_data.village.stone;
    /** Produção de argila por segundo na aldeia atual. */
    readonly stone_prod = Insidious.raw_game_data.village.stone_prod;
    /** Quantidade de ferro na aldeia. */
    readonly iron = Insidious.raw_game_data.village.iron;
    /** Produção de ferro por segundo na aldeia atual. */
    readonly iron_prod = Insidious.raw_game_data.village.iron_prod;
    /** Capacidade máxima do armazém. */
    readonly storage_max = Insidious.raw_game_data.village.storage_max;

    /** Mercadores fora da aldeia. */
    readonly trader_away = Insidious.raw_game_data.village.trader_away;
    /** Quantidade de mercadores na aldeia. */
    readonly trader_amount: number | null = Insidious.raw_game_data.trader_amount;
    /** Total de mercadores da aldeia. */
    readonly trader_total: number | null = Insidious.raw_game_data.trader_total;
    /** Capacidade dos mercadores. */
    readonly trader_carry: number | null = Insidious.raw_game_data.trader_carry;
    /** Informações sobre a Troca Premium. */
    readonly premium_exchange = Insidious.raw_game_data.premium_exchange;

    /** Hora na qual a página foi carregada. */
    readonly time_generated = Insidious.raw_game_data.time_generated;
    readonly offset_from_server = Insidious.raw_game_data.offset_from_server;
    readonly offset_to_server = Insidious.raw_game_data.offset_to_server;

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