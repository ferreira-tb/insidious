// Manifest V3
interface EvListener<T extends Function> {
    addListener: (callback: T) => void;
    removeListener: (listener: T) => void;
    hasListener: (listener: T) => boolean;
}

type Listener<T> = EvListener<(arg: T) => void>;

declare namespace browser.storage {
    type StorageValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | StorageArray
    | StorageMap
    | StorageSet
    | StorageObject

    // Valores específicos do Insidious.
    | VillageInfo
    | PlunderOptions
    | PlunderOptionsParameters
    | WorldInfo
    | UnitInfo;

    interface StorageArray extends Array<StorageValue> {}
    interface StorageMap extends Map<StorageValue, StorageValue> {}
    interface StorageSet extends Set<StorageValue> {}

    interface StorageObject {
        [key: string]: StorageValue;
    }

    interface Get {
        <T extends StorageObject>(keys?: string | string[] | null): Promise<T>;
        <T extends StorageObject>(keys: T): Promise<T>;
    }

    type StorageArea = {
        get: Get;
        set: (keys: StorageObject) => Promise<void>;
        remove: (keys: string | string[]) => Promise<void>;
        clear: () => Promise<void>;
    };

    const local: StorageArea;
}

declare namespace browser.action {
    const onClicked: Listener<browser.tabs.Tab>;
}

declare namespace browser.tabs {
    type MutedInfoReason = "capture" | "extension" | "user";
    type MutedInfo = {
        muted: boolean;
        extensionId?: string;
        reason: MutedInfoReason;
    };

    type Tab = {
        active: boolean;
        audible?: boolean;
        autoDiscardable?: boolean;
        cookieStoreId?: string;
        discarded?: boolean;
        favIconUrl?: string;
        height?: number;
        hidden: boolean;
        highlighted: boolean;
        id?: number;
        incognito: boolean;
        index: number;
        isArticle: boolean;
        isInReaderMode: boolean;
        lastAccessed: number;
        mutedInfo?: MutedInfo;
        openerTabId?: number;
        pinned: boolean;
        selected: boolean;
        sessionId?: string;
        status?: string;
        title?: string;
        url?: string;
        width?: number;
        windowId: number;
      };
}

// Global
type SSObject = { [index: string]: string };
type SNObject = { [index: string]: number };
type SBObject = { [index: string]: boolean };

type ResourceList = 'wood'
    | 'stone'
    | 'iron';

type UnitList = 'spear'
    | 'sword'
    | 'axe'
    | 'archer'
    | 'spy'
    | 'light'
    | 'marcher'
    | 'heavy'
    | 'ram'
    | 'catapult'
    | 'knight'
    | 'snob';

/** Informações sobre as aldeias do mundo. */
interface VillageInfo {
    name: string,
    x: number,
    y: number,
    player: number,
    points: number,
    rank: number
}

type VillageQuery = { [village: string]: VillageInfo }

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

// Níveis
type WallLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

// insidious.ts
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

// farm.ts
type AB = 'a' | 'b';
type ABNull = 'a' | 'b' | null;

/** Capacidade de carga dos modelos A e B. */
type CarryCapacity = { [index in AB]: number };

interface AvailableTroops {
    spear: number,
    sword: number,
    axe: number,
    spy: number,
    light: number,
    heavy: number,
    knight: number
}

type TotalPlundered = {
    [index: string]: { [index in ResourceList]: number };
};

type UnitModels = {
    [model: string]: SNObject
};

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

// map.ts
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