class Game {
    /** Mundo atual. */
    static readonly world = Insidious.game_data.world;
    /** Janela atual. */
    static readonly screen = Insidious.game_data.screen;
    /** ID da aldeia atual. */
    static readonly village = Insidious.game_data.village_id;
    /** ID do jogador. */
    static readonly player = Insidious.game_data.player_id;
    /** ID do grupo de aldeias. */
    static readonly group = Insidious.game_data.group_id;
    /** Coordenadas da aldeia atual. */
    static readonly coords = { x: Insidious.game_data.village_x, y: Insidious.game_data.village_y };

    static verifyIntegrity() {
        if (!this.world) throw new InsidiousError('Não foi possível identificar o mundo atual.');
        if (!this.screen) throw new InsidiousError('Não foi possível identificar a janela atual.');
        if (!this.village) throw new InsidiousError('Não foi possível identificar a aldeia atual.');
        if (!this.player) throw new InsidiousError('Não foi possível identificar o jogador atual.');
        if (!this.group) throw new InsidiousError('Não foi possível identificar o grupo atual.');
        if (!this.coords.x || !this.coords.y) throw new InsidiousError('Não foi possível identificar as coordenadas da aldeia atual.');
    };
};