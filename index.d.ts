declare namespace browser {
    const storage: any;
    const action: any;
}

type SSObject = { [index: string]: string }
type SNObject = { [index: string]: number }

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
type AB = 'a' | 'b' | null;

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
    totalPlundered: { [index in ResourceList]: number };
}

interface UnitModels {
    [model: string]: SNObject
}

// map.ts
type FilterContext = Set<string> | undefined;
type TagType = 'distance' | 'points' | 'bbpoints' | `time_${UnitList}`;
type FilterType = 'bbunknown';
