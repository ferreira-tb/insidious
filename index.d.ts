// Global
type SSObject = { [index: string]: string };
type SNObject = { [index: string]: number };
type SHTMLObject  = { [index: string]: HTMLElement };

/** Os três recursos do jogo: madeira, argila e ferro. */
type ResourceList = 
    | 'wood'
    | 'stone'
    | 'iron';

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

/** Janelas do jogo. */
type GameScreen =
    | 'am_farm'
    | 'market'
    | 'overview'
    | 'overview_villages'
    | 'place'
    | 'report';

/** URLs permitidas em browser.tabs.create() */
type WebExtTabURLs =
    | 'https://github.com/ferreira-tb'
    | 'https://github.com/ferreira-tb/insidious';

/** URLs permitidas em browser.windows.create() */
type WebExtWindowURLs = '../config/config.html';

type WindowMessageDirection = 'from-insidious' | 'from-tribalwars';
type WindowMessageReason = 'get-game-data';
interface WindowMessage {
    direction: WindowMessageDirection;
    reason?: WindowMessageReason;
}

interface WindowMessageFromPage extends WindowMessage {
    game_data?: TribalWarsGameData;
    premium?: boolean;
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

/** Quantia de recursos. */
type ResourceAmount = { [index in ResourceList]: number };

/** Edifícios. */
type BuildingName = keyof Buildings;

// Níveis
type WallLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

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
    plunder: (keyof PlunderOptions)[]
};

type AssetsMisc = {
    months: Months[];
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

/** Quantidade de unidades disponíveis para uso nos modelos do assistente de saque. */
type AvailableFarmUnits = {
    spear: number;
    sword: number;
    axe: number;
    spy: number;
    light: number;
    heavy: number;
    knight: number;

    archer?: number;
    marcher?: number;
};

/** Quantia de recursos saqueados e ataques enviados pelo Plunder. */
type TotalPlundered = { [index in ResourceList | 'total' | 'attack_amount']: number };
/** Pares [key, value] obtidos ao usar Object.entries(). */
type TotalPlunderedEntries = [ResourceList | 'total' | 'attack_amount', number][];

/** Status das diferentes opções do plunder. */
type PlunderOptions = {
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

////// SHIELD
/** Possíveis operações executadas pelo Shield. 
 * @param redirect - O usuário será redirecionado.
 * @param group - O grupo atual será alterado para "todos".
 * @param rename - Renomeia os ataques a caminho.
 * @param go_back - O Shield redirecionará o usuário de volta para a página onde estava.
*/
type ShieldOperations = null | 'redirect' | 'group' | 'rename' | 'go_back';