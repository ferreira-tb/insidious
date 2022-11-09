class SourceList {
    readonly config = {
        name: Keys.config,
        url: Assets.info.get_config
    };
    readonly unit = {
        name: Keys.unit,
        url: Assets.info.get_unit_info
    };
};

class WorldInfo {
    readonly speed: number;
    readonly unit_speed: number;
    readonly game = { archer: 0 };

    /** Configurações do mundo atual. */
    constructor(configXML: XMLDocument) {
        const getValue = Utils.queryXMLTags(configXML);

        this.speed = getValue('speed');
        this.unit_speed = getValue('unit_speed');
        this.game.archer = getValue('archer');
    };
};

class UnitInfo {
    readonly spear!: UnitDetails;
    readonly sword!: UnitDetails;
    readonly axe!: UnitDetails;
    readonly archer!: UnitDetails;
    readonly spy!: UnitDetails;
    readonly light!: UnitDetails;
    readonly marcher!: UnitDetails;
    readonly heavy!: UnitDetails;
    readonly ram!: UnitDetails;
    readonly catapult!: UnitDetails;
    readonly knight!: UnitDetails;
    readonly snob!: UnitDetails;

    /** Velocidade e capacidade de carga individual de cada unidade do jogo. */
    constructor(configXML: XMLDocument) {
        const getValue = Utils.queryXMLTags(configXML);

        for (const unit of Assets.list.all_units_archer) {
            this[unit] = {
                speed: getValue(`${unit} speed`),
                carry: getValue(`${unit} carry`) 
            };
        };
    };
};

class Bridge implements WindowMessage {
    readonly direction = 'from-insidious';
    readonly reason: WindowMessageReason;
    readonly message?: UIMessage;

    constructor(reason: WindowMessageReason, ...args: unknown[]) {
        this.reason = reason;

        for (const arg of args) {
            if (arg instanceof UIMessage) this.message = arg;
        };
    };
};

class UIMessage {
    readonly type: UIMessageType;
    readonly content: string;

    constructor(content: string, type: UIMessageType = 'success') {
        this.content = content;
        this.type = type;
    };
};