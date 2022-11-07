class PageScript {
    static start() {
        window.addEventListener('message', (e) => {
            if (e?.data?.direction === 'from-insidious') {
                PageScript.handleMessage(e.data as WindowMessageFromInsidious);
                return;
            };
        });

        const insidious = document.createElement('insidious');
        document.head.appendChild(insidious);

        // Diferença entre a hora local e a do servidor.
        const time_diff = Timing.getCurrentServerTime() - Date.now();
        insidious.setAttribute('time_diff', String(time_diff));
    };

    private static handleMessage(data: WindowMessageFromInsidious) {
        switch (data.reason) {
            case 'get-game-data': return PageScript.postGameData();
            case 'ui-message': return PageScript.showUIMessage(data.message);
            default: return PageScript.postData(data.reason);
        };
    };

    private static postGameData() {
        const message: WindowMessageFromPage = {
            direction: 'from-tribalwars',
            game_data: new TribalWarsGameData(),
            premium: premium
        };

        window.postMessage(message);
    };

    private static postData(reason?: WindowMessageReason) {
        const message: WindowMessageFromPage = {
            direction: 'from-tribalwars',
        };

        switch (reason) {
            case 'get-plunder-data': message.plunder_data = new TribalWarsPlunderData();
                break;
            case 'get-market-data': message.market_data = new TribalWarsMarketData();
                break;
            default: return;
        };

        window.postMessage(message);
    };

    private static showUIMessage(message?: UIMessage) {
        if (!message) return PageScript.handleError('showUIMessage');

        switch (message.type) {
            case 'error': return UI.ErrorMessage(message.content);
            case 'info': return UI.InfoMessage(message.content);
            case 'success': return UI.SuccessMessage(message.content);
        };
    };

    private static handleError(err: string | Error) {
        const message = typeof err === 'string' ? err : err.message;
        UI.ErrorMessage(`PAGESCRIPT ERROR: ${message}.`);
    };
};

class TribalWarsGameData {
    // TribalWars.getGameData()
    readonly device: string;
    readonly features: Features;
    readonly group_id: string;
    readonly link_base: string;
    readonly link_base_pure: string;
    readonly locale: string;
    readonly majorVersion: string;
    readonly market: string;
    readonly mode: string | null;
    readonly player: Player;
    readonly pregame: boolean;
    readonly screen: GameScreen;
    readonly time_generated: number;
    readonly units: string[];
    readonly version: string;
    readonly village: Village;
    readonly world: string;

    // Timing
    readonly added_server_time = Timing.added_server_time;
    readonly initial_server_time = Timing.initial_server_time;
    readonly offset_from_server = Timing.offset_from_server;
    readonly offset_to_server = Timing.offset_to_server;
    readonly tick_interval = Timing.tick_interval;

    constructor() {
        const game_data = TribalWars.getGameData();

        this.device = game_data.device;
        this.features = game_data.features;
        this.group_id = game_data.group_id;
        this.link_base = game_data.link_base;
        this.link_base_pure = game_data.link_base_pure;
        this.locale = game_data.locale;
        this.majorVersion = game_data.majorVersion;
        this.market = game_data.market;
        this.mode = game_data.mode;
        this.player = game_data.player;
        this.pregame = game_data.pregame;
        this.screen = game_data.screen;
        this.time_generated = game_data.time_generated;
        this.units = game_data.units;
        this.version = game_data.version;
        this.village = game_data.village;
        this.world = game_data.world;
    };
};

class TribalWarsPlunderData {
    readonly current_units = Accountmanager.farm.current_units;
    readonly hide_attacked = Accountmanager.farm.hide_attacked;
    readonly page = Accountmanager.farm.page;
    readonly page_size = Accountmanager.farm.page_size;
};

class TribalWarsMarketData {
    readonly trader_amount = Market.Data.Trader.amount;
    readonly trader_carry = Market.Data.Trader.carry;
    readonly trader_away: number;

    constructor() {
        const game_data = TribalWars.getGameData();
        this.trader_away = game_data.village.trader_away;
    };
};

PageScript.start();