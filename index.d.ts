// Global
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

type XMLType = `config_${string}` | `unit_${string}`;

/** Velocidade e capacidade de carga individual de cada unidade do jogo. */
type UnitInfo = {
    [index in UnitListWithArchers]: { speed: number; carry: number; }
}

////// MENSAGEM
type StandardMessage = {
    type: 'start'
}

type ErrorMessage = {
    type: 'error'
    error: Error
}

type AllMessageTypes = StandardMessage | ErrorMessage;

type FetchURLs = {
    village: string
}

////// ASSETS
type AssetsList = {
    all_units: UnitList[]
    all_units_archer: UnitListWithArchers[]
    farm_units: FarmUnits[]
    farm_units_archer: FarmUnitsWithArchers[]

    resources: ResourceList[]
};

////// PLUNDER
type AB = 'a' | 'b';
type ABNull = AB | null;

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

////// SHIELD
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