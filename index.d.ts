// Global
type StandardObject<T> = { [index: string]: T };

/** Os três recursos do jogo: madeira, argila e ferro. */
type ResourceList = 
    | 'wood'
    | 'stone'
    | 'iron';

/** Nomes em português dos recursos do jogo. */
type ResourceListPTBR =
    | 'Madeira'
    | 'Argila'
    | 'Ferro';

/** Unidades que podem ser usadas no assistente de saque. */
type FarmUnits =
    | 'spear'
    | 'sword'
    | 'axe'
    | 'spy'
    | 'light'
    | 'heavy'
    | 'knight'

/** Unidades que podem ser usadas no assistente de saque em mundos com arqueiros. */
type FarmUnitsWithArchers =
    | FarmUnits
    | 'archer'
    | 'marcher'

/** Unidades que não podem saquear. */
type OtherUnits =
    | 'ram'
    | 'catapult'
    | 'snob';

/** Todas as unidades do jogo. */
type UnitList =
    | FarmUnits
    | OtherUnits;

/** Todas as unidades do jogo em mundos com arqueiros. */
type UnitListWithArchers = 
    | FarmUnitsWithArchers
    | OtherUnits;

type CurrentUnits = {
    [index in keyof TribalWarsPlunderData['current_units']]: number;
};

/** Janelas do jogo. */
type GameScreen =
    | 'am_farm'
    | 'info_player'
    | 'market'
    | 'overview'
    | 'overview_villages'
    | 'place'
    | 'report';

/** URLs permitidas em browser.tabs.create() */
type WebExtTabURLs =
    | 'https://github.com/ferreira-tb'
    | 'https://github.com/ferreira-tb/insidious'
    | 'https://github.com/ferreira-tb/insidious/issues';

/** URLs permitidas em browser.windows.create() */
type WebExtWindowURLs = '../config/config.html';

type WindowMessageDirection =
    | 'from-insidious' 
    | 'from-tribalwars';
    
type WindowMessageReason = 
    | 'get-game-data'
    | 'get-plunder-data'
    | 'get-market-data'
    | 'ui-message';

interface WindowMessage {
    direction: WindowMessageDirection;
    reason?: WindowMessageReason;
}

interface WindowMessageFromPage extends WindowMessage {
    game_data?: TribalWarsGameData;
    plunder_data?: TribalWarsPlunderData;
    market_data?: TribalWarsMarketData;
    premium?: boolean;
}

type UIMessageType = 'error' | 'info' | 'success';

interface WindowMessageFromInsidious extends WindowMessage {
    message?: UIMessage;
}

/** Histórico de navegação entre páginas do jogo. */
type NavigationHistory = {
    /** URL da página em que o usuário estava antes da navegação ser feita. */
    previous: string;
    /** URL para qual o usuário foi redirecionado pelo Insidious. */
    target: string;
    /** Hora na qual a navegação foi feita. */
    date: number;
    /** Indica se o Insidious deve ou não redirecionar o usuário de volta para a página na qual estava. */
    go_back: boolean;
};

/** Edifícios. */
type BuildingName = keyof Buildings;

// Níveis
type WallLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

// Outros
type Months = 'jan' | 'fev'| 'mar' | 'abr' | 'mai' | 'jun'| 'jul' | 'ago' | 'set' | 'out' | 'nov' | 'dez';

////// ERROR
type ErrorContext = 'main' | 'action' | 'config';

////// INSIDIOUS
type XMLType = `config_${string}` | `unit_${string}`;

type UnitDetails = {
    speed: number;
    carry: number;
};

////// MENSAGEM
type StandardMessage = {
    type: 'start' | GameScreen;
};

type ErrorMessage = {
    type: 'error';
    error: Error;
};

type AllMessageTypes = 
    | StandardMessage
    | ErrorMessage;

////// BACKGROUND
type ScriptList = {
    [index in 'assets' | GameScreen]: string[];
};

////// ASSETS
type AssetsList = {
    all_units: UnitList[];
    all_units_archer: UnitListWithArchers[];
    farm_units: FarmUnits[];
    farm_units_archer: FarmUnitsWithArchers[];
    other_units: (OtherUnits | 'militia')[];

    resources: ResourceList[];
};

type AssetsOptions = {
    plunder_checkbox: (keyof PlunderCheckboxOptions)[];
    plunder_input: (keyof PlunderInputOptions)[];
    player_radio: PlayerOptions['radio_option'][];
};

type AssetsMisc = {
    months: Months[];
};

type ResourcesObjectProperties =
    | ResourceList
    | 'storage_max';

type ResourcesObject = {
    [index in ResourcesObjectProperties]: number;
};

////// UTILS
type XMLTags =
    | 'speed'
    | 'unit_speed'
    | 'archer'
    | `${UnitListWithArchers} speed`
    | `${UnitListWithArchers} carry`

////// PLUNDER
type AB = 'a' | 'b';
type ABNull = AB | null;
type ABC = AB | 'c';
type OnOff = 'on' | 'off';

/** Quantia de recursos saqueados e ataques enviados pelo Plunder. */
type TotalPlundered = {
    [index in ResourceList | 'total' | 'attack_amount']: number
};
/** Pares [key, value] obtidos ao usar Object.entries(). */
type TotalPlunderedEntries = [ResourceList | 'total' | 'attack_amount', number][];

/** Status das diferentes opções do plunder. */
type PlunderOptions = PlunderCheckboxOptions & PlunderInputOptions;

type PlunderCheckboxOptions = {
    /** Determina se o Plunder deve atacar aldeias com muralha. */
    ignore_wall: boolean;
    /** Determina se o Plunder deve demolir a muralha das aldeias. */
    destroy_wall: boolean;
    /** Determina se o Plunder deve utilizar o grupo Insidious ao atacar. */
    group_attack: boolean;
    /** Determina se o Plunder deve atacar usando o modelo C. */
    use_c: boolean;
    /** Se ativado, o Plunder não terá delay entre os ataques. */
    no_delay: boolean;
};

type PlunderInputOptions = {
    /** Distância máxima para os ataques do Plunder. */
    max_distance: number;
    /** Ignora aldeias cujo último ataque ocorreu há uma quantidade de horas superior à indicada. */
    ignore_older_than: number;
};

////// SHIELD
/** Possíveis operações executadas pelo Shield. 
 * @param redirect - O usuário será redirecionado.
 * @param group - O grupo atual será alterado para "todos".
 * @param rename - Renomeia os ataques a caminho.
 * @param go_back - O Shield redirecionará o usuário de volta para a página onde estava.
*/
type ShieldOperations = null | 'redirect' | 'group' | 'rename' | 'go_back';

////// PLACE
type AvailableUnits = {
    [index in UnitListWithArchers]: number;
};

////// JOGADOR
type PlayerOptions = {
    radio_option:
        | 'hide_all'
        | 'show_distance'
        | 'show_time';
};