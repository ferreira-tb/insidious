// Global
type SSObject = { [index: string]: string };
type SNObject = { [index: string]: number };
type SBObject = { [index: string]: boolean };

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

/** URLs permitidas em browser.tabs.create() */
type WebExtTabURLs = 'https://github.com/ferreira-tb/insidious';
/** URLs permitidas em browser.windows.create() */
type WebExtWindowURLs = '../config/config.html';

type WindowMessageDirection = 'from-insidious' | 'from-tribalwars';
type WindowMessageReason = 'get-game-data';
type WindowMessage = {
    direction: WindowMessageDirection,
    reason?: WindowMessageReason
    game_data?: TribalWarsGameData
};

/** Informações sobre as aldeias do mundo. */
interface VillageInfo {
    name: string,
    x: number,
    y: number,
    player: number,
    points: number,
    rank: number
}

/** Histórico de navegação entre páginas do jogo. */
type NavigationHistory = {
    /** URL da página em que o usuário estava antes da navegação ser feita. */
    previous: string,
    /** URL para qual o usuário foi redirecionado pelo Insidious. */
    target: string,
    /** Hora na qual a navegação foi feita. */
    date: number,
    /** Indica se o Insidious deve ou não redirecionar o usuário de volta para a página na qual estava. */
    go_back: boolean
};

/** Quantia de recursos. */
type ResourceAmount = { [index in ResourceList]: number };

/** Edifícios. */
type BuildingName = keyof Buildings;

// Níveis
type WallLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

////// ERROR
type ErrorContext = 'main' | 'action' | 'background'| 'config';

////// INSIDIOUS
/** Configurações do mundo atual. */
type WorldInfo = {
    speed: number,
    unit_speed: number,
    game: {
        archer: number
    }
};

/** Velocidade e capacidade de carga individual de cada unidade do jogo. */
type UnitInfo = {
    [index in UnitList]: { speed: number; carry: number; };
};

////// MENSAGEM
type StandardMessage = {
    type: string,
    sender?: string
};

type ErrorMessage = {
    type: 'error',
    error: Error
};

type AllMessageTypes = StandardMessage | ErrorMessage;

////// ASSETS
type ImageIndex = `${UnitListWithArchers}_18`;

type ImageURL = `https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_${UnitListWithArchers}.png`;

type AssetsImage = {
    [index in ImageIndex]: ImageURL;
};

type AssetsList = {
    all_units: UnitList[],
    all_units_archer: UnitListWithArchers[],
    farm_units: FarmUnits[],
    farm_units_archer: FarmUnitsWithArchers[]
};

////// PLUNDER
type AB = 'a' | 'b';
type ABNull = AB | null;

/** Capacidade de carga dos modelos A e B. */
type CarryCapacity = { [index in AB]: number };

/** Quantidade de unidades disponíveis para uso nos modelos do assistente de saque. */
type AvailableFarmUnits = {
    spear: number,
    sword: number,
    axe: number,
    spy: number,
    light: number,
    heavy: number,
    knight: number,

    archer?: number,
    marcher?: number
};

/** Quantia de recursos saqueados e ataques enviados pelo Plunder. */
type TotalPlundered = { [index in ResourceList | 'attack_amount']: number };
/** Pares [key, value] obtidos ao usar Object.entries(). */
type TotalPlunderedEntries = [ResourceList | 'attack_amount', number][];

/** Status das diferentes opções do plunder. */
type PlunderOptions = {
    /** Determina se o Plunder deve atacar aldeias com muralha. */
    ignore_wall: boolean,
    /** Determina se o Plunder deve demolir a muralha das aldeias. */
    destroy_wall: boolean,
    /** Determina se o Plunder deve utilizar o grupo Insidious ao atacar. */
    group_attack: boolean
};

/** Parâmetros que auxiliam o funcionamento das opções do plunder. 
 *  São todos resetados sempre que o evento "stopplundering" é emitido.
 */
type PlunderOptionsParameters = {
    /** Última aldeia com a qual o Plunder atacou. */
    last_attacking_village: string,
    /** Aldeia na qual o Plunder estava quando utilizou a opção "Group Jump" pela última vez. */
    last_group_jump: string
};

////// MAP
type FilterContext = Set<string> | undefined;

/** Tags de mapa. */
type TagType = 'distance' | 'points' | 'bbpoints' | `time_${UnitList}`;
/** Filtros de mapa. */
type FilterType = 'bbunknown';
/** Tags e filtros de mapa. */
type AllMapTypes = TagType | FilterType;

// shield.ts
/** Possíveis operações executadas pelo Shield. 
 * @param redirect - O usuário será redirecionado.
 * @param group - O grupo atual será alterado para "todos".
 * @param rename - Renomeia os ataques a caminho.
 * @param go_back - O Shield redirecionará o usuário de volta para a página onde estava.
*/
type ShieldOperations = 'redirect' | 'group' | 'rename' | 'go_back';

type ShieldStatus = {
    /** Etapa sendo executada no momento. */
    step: ShieldOperations | null,
    /** Próxima etapa a ser executada. */
    next: ShieldOperations | null
    /** Hora da última atualização. */
    time: number
};