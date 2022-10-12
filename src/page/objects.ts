class GameData {
    readonly group_id: string;
    readonly screen: string;
    readonly world: string;

    readonly player_ally: string;
    readonly player_ally_level
    readonly player_id: number;
    readonly player_name: string;
    readonly player_points: string;
    readonly player_rank: number;
    readonly player_village_amount: string;

    readonly village_id: string;
    readonly village_points: number;
    readonly village_pop: number;
    readonly village_pop_max: number;
    readonly village_x: number;
    readonly village_y: number;


    constructor(gameData: TribalWarsGameData) {
        this.group_id = gameData.group_id;
        this.screen = gameData.screen;
        this.world = gameData.world;

        this.player_ally = gameData.player.ally;
        this.player_ally_level = gameData.player.ally_level;
        this.player_id = gameData.player.id;
        this.player_name = gameData.player.name;
        this.player_points = gameData.player.points;
        this.player_rank = gameData.player.rank;
        this.player_village_amount = gameData.player.villages;

        this.village_id = String(gameData.village.id);
        this.village_points = gameData.village.points;
        this.village_pop = gameData.village.pop;
        this.village_pop_max = gameData.village.pop_max;
        this.village_x = gameData.village.x;
        this.village_y = gameData.village.y;
    };
};