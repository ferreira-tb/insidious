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
        farm_units: ['spear', 'sword', 'axe', 'spy', 'light', 'heavy', 'knight']
    };

    static #freeze() {
        Object.freeze(this.#image);
        Object.freeze(this.#world);
        Object.freeze(this.#list);
    };

    static get image() {return this.#image};
    static get world() {return this.#world};
    static get list() {return this.#list};

    static get freeze() {return this.#freeze};
};

TWAssets.freeze();