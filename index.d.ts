declare namespace browser {
    const storage: any;
    const action: any;
}

type SSObject = { [index: string]: string }
type SNObject = { [index: string]: number }

interface VillageInfo {
    name: string,
    x: number,
    y: number,
    player: number,
    points: number,
    rank: number
}

type VillageQuery = { [village: string]: VillageInfo }

// background.ts
interface BackgroundListener {
    name: string;
    value?: { [item: string]: string };
    key?: string | string[];
}

type PortMessage = {
    value: { [item: string]: string },
    id: string
}

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

interface TotalPlundered {
    totalPlundered: {
        wood: number,
        stone: number,
        iron: number
    };
}

interface UnitModels {
    [model: string]: SNObject
}

// map.ts
type FilterContext = Set<string> | undefined;

// utils.ts
type IconImgName = 'spear' | 'sword' | 'axe' | 'archer' | 'spy' | 'light' | 'marcher' | 'heavy' | 'ram' | 'catapult' | 'knight' | 'snob';