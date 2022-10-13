type TribalWarsGameData = {
    device: string,
    features: Features,
    group_id: string,
    link_base: string,
    link_base_pure: string,
    locale: string,
    majorVersion: string,
    market: string,
    mode: string | null,
    player: Player,
    pregame: boolean,
    screen: string,
    time_generated: number,
    units: string[],
    version: string,
    village: Village,
    world: string
};

type Features = {
    AccountManager: ActivePossible,
    FarmAssistent: ActivePossible,
    Premium: ActivePossible
};

type ActivePossible = {
    active: boolean,
    possible: boolean
};

type Player = {
    ally: string,
    ally_level: string,
    ally_member_count: string,
    confirmation_skipping_hash: string,
    date_started: string,
    email_valid: string,
    id: number,
    incomings: string,
    is_guest: string,
    knight_location: string,
    knight_unit: string,
    name: string,
    new_ally_application: string,
    new_ally_invite: string,
    new_buddy_request: string,
    new_daily_bonus: string,
    new_forum_post: string,
    new_igm: string,
    new_items: string,
    new_post_notification: number,
    new_quest: string,
    new_report: string,
    points: string,
    points_formatted: string,
    pp: string,
    quest_progress: string,
    rank: number,
    rank_formatted: string,
    sitter: string,
    sitter_type: string,
    sleep_end: string,
    sleep_last: string,
    sleep_start: string,
    supports: string,
    villages: string,
};

type Village = {
    buildings: Buildings,
    coord: string,
    display_name: string,
    id: number,
    iron: number,
    iron_float: number,
    iron_prod: number,
    is_farm_upgradable: boolean,
    last_res_tick: number,
    modifications: number,
    name: string,
    player_id: number,
    points: number,
    pop: number,
    pop_max: number,
    stone: number,
    stone_float: number,
    stone_prod: number,
    storage_max: number,
    trader_away: number,
    wood: number,
    wood_float: number,
    wood_prod: number,
    x: number,
    y: number,
};

type Buildings = {
    barracks: string,
    farm: string,
    garage: string,
    hide: string,
    iron: string,
    main: string,
    market: string,
    place: string,
    smith: string,
    snob: string,
    stable: string,
    statue: string,
    stone: string,
    storage: string,
    wall: string,
    watchtower: string,
    wood: string,
};

declare namespace TribalWars {
    function getGameData(): TribalWarsGameData;
    function getIdleTime(): number;
}

declare const game_data: TribalWarsGameData;
declare const mobile: boolean;
declare const mobile_on_normal: boolean;
declare const mobiledevice: boolean;
declare const premium: boolean;
declare const server_utc_diff: number;

declare function getLocalTimeAsFloat(): number;