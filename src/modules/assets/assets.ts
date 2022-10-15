class TWAssets {
    static readonly info = {
        get_config: location.origin + '/interface.php?func=get_config',
        get_building_info: location.origin + '/interface.php?func=get_building_info',
        get_unit_info: location.origin + '/interface.php?func=get_unit_info',
    };

    static readonly list: AssetsList = {
        // Unidades
        all_units: ['spear', 'sword', 'axe', 'spy', 'light', 'heavy', 'ram', 'catapult', 'knight', 'snob'],
        all_units_archer: ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'],
        farm_units: ['spear', 'sword', 'axe', 'spy', 'light', 'heavy', 'knight'],
        farm_units_archer: ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'knight'],

        // Outros
        resources: ['wood', 'stone', 'iron']
    };

    /** Aríetes e bárbaros, respectivamente. */
    static readonly unitsToDestroyWall: { [index in WallLevel]: [number, number]} = {
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

    static freeze() {
        Object.freeze(this.info);
        Object.freeze(this.list);

        Object.freeze(this.unitsToDestroyWall);
    };
};