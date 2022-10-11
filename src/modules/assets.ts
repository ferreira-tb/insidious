class TWAssets {
    static #world = {
        village: location.origin + '/map/village.txt',
        player: location.origin + '/map/player.txt',
        ally: location.origin + '/map/ally.txt',
        conquer: location.origin + '/map/conquer.txt',

        get_config: location.origin + '/interface.php?func=get_config',
        get_building_info: location.origin + '/interface.php?func=get_building_info',
        get_unit_info: location.origin + '/interface.php?func=get_unit_info',

        kill_all: location.origin + '/map/kill_all.txt',
        kill_att: location.origin + '/map/kill_att.txt',
        kill_def: location.origin + '/map/kill_def.txt',

        kill_all_tribe: location.origin + '/map/kill_all_tribe.txt',
        kill_att_tribe: location.origin + '/map/kill_att_tribe.txt',
        kill_def_tribe: location.origin + '/map/kill_def_tribe.txt'
    };

    static #image = {
        // Unidades.
        spear_18: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_spear.png',
        sword_18: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_sword.png',
        axe_18: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_axe.png',
        archer_18: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_archer.png',
        spy_18: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_spy.png',
        light_18: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_light.png',
        marcher_18: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_marcher.png',
        heavy_18: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_heavy.png',
        ram_18: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_ram.png',
        catapult_18: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_catapult.png',
        knight_18: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_knight.png',
        snob_18: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_snob.png'
    };

    static #list = {
        all_units: ['spear', 'sword', 'axe', 'spy', 'light', 'heavy', 'ram', 'catapult', 'knight', 'snob'],
        all_units_archer: ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'],
        farm_units: ['spear', 'sword', 'axe', 'spy', 'light', 'heavy', 'knight'],
        farm_units_archer: ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'knight']
    };

    /** Aríetes e bárbaros, respectivamente. */
    static #unitsToDestroyWall: { [index: number]: [number, number]} = {
        1: [3, 50],
        2: [5, 50],
        3: [8, 50],
        4: [15, 75],
        5: [20, 100],
        6: [20, 150],
        7: [30, 150],
        8: [40, 300],
        9: [40, 300],
        10: [50, 400],
        11: [60, 400],
        12: [60, 500],
        13: [80, 500],
        14: [100, 600],
        15: [150, 800],
        16: [180, 1000],
        17: [180, 1000],
        18: [200, 1100],
        19: [200, 1100],
        20: [200, 1300]
    };

    static #freeze() {
        Object.freeze(this.#image);
        Object.freeze(this.#world);
        Object.freeze(this.#list);

        Object.freeze(this.#unitsToDestroyWall);
    };

    static get image() {return this.#image};
    static get world() {return this.#world};
    static get list() {return this.#list};

    static get unitsToDestroyWall() {return this.#unitsToDestroyWall};

    static get freeze() {return this.#freeze};
};