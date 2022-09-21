declare const browser: any;

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

// utils.ts
type IconImgName = 'spear' | 'sword' | 'axe' | 'archer' | 'spy' | 'light' | 'marcher' | 'heavy' | 'ram' | 'catapult' | 'knight' | 'snob';