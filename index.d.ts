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
    | WorldInfo;

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

interface VillageInfo {
    name: string,
    x: number,
    y: number,
    player: number,
    points: number,
    rank: number
}

type VillageQuery = { [village: string]: VillageInfo }

type WallLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

// insidious.ts
interface WorldInfo {
    speed: number,
    unit_speed: number,
    game: {
        archer: number
    }
}

type UnitInfo = {
    [index in UnitList]: { speed: number; carry: number; };
};

// farm.ts
type AB = 'a' | 'b';
type ABNull = 'a' | 'b' | null;

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

type PlunderOptions = {
    ignore_wall: boolean,
    destroy_wall: boolean,
    group_attack: boolean
};

// map.ts
type FilterContext = Set<string> | undefined;
type TagType = 'distance' | 'points' | 'bbpoints' | `time_${UnitList}`;
type FilterType = 'bbunknown';