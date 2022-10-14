class WorldInfo {
    speed: number;
    unit_speed: number;
    game = { archer: 0 };

    /** Configurações do mundo atual. */
    constructor(configXML: XMLDocument) {
        const getValue = Utils.queryXMLTags(configXML);

        this.speed = getValue('speed');
        this.unit_speed = getValue('unit_speed');
        this.game.archer = getValue('archer');
    };
};

class UnitInfo {
    spear?: UnitDetails;
    sword?: UnitDetails;
    axe?: UnitDetails;
    archer?: UnitDetails;
    spy?: UnitDetails;
    light?: UnitDetails;
    marcher?: UnitDetails;
    heavy?: UnitDetails;
    ram?: UnitDetails;
    catapult?: UnitDetails;
    knight?: UnitDetails;
    snob?: UnitDetails;

    /** Velocidade e capacidade de carga individual de cada unidade do jogo. */
    constructor(configXML: XMLDocument) {
        const getValue = Utils.queryXMLTags(configXML);

        for (const unit of TWAssets.list.all_units_archer) {
            this[unit] = {
                speed: getValue(`${unit} speed`),
                carry: getValue(`${unit} carry`) 
            };
        };
    };
};