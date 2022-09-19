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
interface Plundered {
    totalPlundered: {
        wood: number,
        stone: number,
        iron: number
    };
}

// utils.ts
type ResourceSpan = 'wood' | 'stone' | 'iron';
type IconImgName = 'spear' | 'sword' | 'axe' | 'archer' | 'spy' | 'light' | 'marcher' | 'heavy' | 'ram' | 'catapult' | 'knight' | 'snob';
type IconImgSize = '18';