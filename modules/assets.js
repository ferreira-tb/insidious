'use strict';
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
        spear: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_spear.png',
        sword: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_sword.png',
        axe: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_axe.png',
        spy: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_spy.png',
        light: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_light.png',
        heavy: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_heavy.png',
        knight: 'https://dsbr.innogamescdn.com/asset/45436e33/graphic/unit/unit_knight.png'
    };

    static #freeze() {
        Object.freeze(this.#image);
        Object.freeze(this.#world);
    };

    static get image() {return this.#image};
    static get world() {return this.#world};

    static get freeze() {return this.#freeze};
};

TWAssets.freeze();