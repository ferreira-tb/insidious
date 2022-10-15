class Background {
    static start() {
        this.createListeners();
    };

    private static createListeners() {
        browser.runtime.onMessage.addListener(Background.handleMessage);
    };

    private static async handleMessage(message: AllMessageTypes, sender: browser.runtime.MessageSender) {
        switch (message.type) {
            case 'start': return Background.loadScripts(sender.tab?.id);
            case 'error': return Background.showErrorNotification(message.error);
            default: return;
        };
    };

    private static loadScripts(id: number | undefined) {
        if (id === undefined) throw new InsidiousError('O ID da aba é inválido.');
        return browser.scripting.executeScript({
            files: ['./modules/assets/game.js', './modules/assets/keys.js'],
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
};

Background.start();