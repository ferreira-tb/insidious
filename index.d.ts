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

type UnitModels = {
    [model: string]: SNObject
};

interface PlunderOptions {
    ignore_wall: boolean,
    destroy_wall: boolean
}

// map.ts
type FilterContext = Set<string> | undefined;
type TagType = 'distance' | 'points' | 'bbpoints' | `time_${UnitList}`;
type FilterType = 'bbunknown';