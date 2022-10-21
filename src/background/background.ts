class Background {
    static async handleMessage(message: AllMessageTypes, sender: browser.runtime.MessageSender) {
        switch (message.type) {
            case 'start': return Background.loadAssets(sender.tab?.id);
            case 'error': return Background.showErrorNotification(message.error);
            default: return Background.loadScripts(message.type, sender.tab?.id);
        };
    };

    private static loadAssets(id: number | undefined) {
        if (id === undefined) return Background.showErrorNotification(new Error('O ID da aba é inválido.'));

        return browser.scripting.executeScript({
            files: Background.scripts.assets,
            injectImmediately: true,
            target: { tabId: id }
        });
    };

    private static loadScripts(screen: GameScreen, id: number | undefined) {
        if (id === undefined) return Background.showErrorNotification(new Error('O ID da aba é inválido.'));

        const files = Background.scripts[screen];
        if (!files || files.length === 0) return;

        return browser.scripting.executeScript({
            files: files,
            injectImmediately: true,
            target: { tabId: id }
        });
    };

    private static showErrorNotification(err: Error) {
        return browser.notifications.create({ 
            type: 'basic',
            title: 'Insidious',
            message: err.message
        });
    };

    private static readonly scripts: ScriptList = {
        assets: ['./modules/assets/game.js', './modules/assets/keys.js'],
        am_farm: [],
        market: ['./modules/market/market.js'],
        overview: [],
        overview_villages: ['./modules/overview/overview.js'],
        place: ['./modules/sword/sword.js', './modules/sword/objects.js'],
        report: ['./modules/report/report.js']
    };
};

browser.runtime.onMessage.addListener(Background.handleMessage);