class PlayerProfileVillageInfo {
    readonly row: HTMLElement;
    readonly x: number;
    readonly y: number;
    readonly distance: number;

    constructor(row: HTMLElement, x: number, y: number, distance: number) {
        this.row = row;
        this.x = x;
        this.y = y;
        this.distance = distance;
    };
};

class PlayerProfileInfo {
    readonly villages: PlayerProfileVillageInfo[] = [];

    constructor() {
        const selector = 'table#villages_list > tbody > tr';
        const villages = Array.from(document.querySelectorAll(selector)) as HTMLElement[];

        if (villages.length > 0) TWPlayer.appendTableColumn();

        for (const village of villages) {
            // Ignora a aldeia caso a distância já tenha sido adicionada.
            if (village.querySelector(`.ins_${TWPlayer.options.radio_option}`)) continue;

            const getRawCoords = (): RegExpMatchArray | null => {
                for (const child of Array.from(village.children)) {
                    const raw = child.textContent?.match(/\d\d\d\|\d\d\d/m);
                    if (!raw || raw.length === 0) continue;
                    return raw;
                };

                return null;
            };

            const rawCoords = getRawCoords();
            if (!rawCoords) {
                TWPlayer.handleExcessVillages(village)
                    .catch((err: unknown) => InsidiousError.handle(err));
                continue;
            };

            const coords = rawCoords[0].split('\|').map(value => Number.parseInt(value, 10));
            const distance = Utils.calcDistance(Game.x, Game.y, coords[0], coords[1]);

            const villageInfo = new PlayerProfileVillageInfo(village, coords[0], coords[1], distance);
            this.villages.push(villageInfo);
        };
    };
};