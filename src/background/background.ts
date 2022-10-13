class Core {
    static start() {
        this.createListeners();
    };

    private static createListeners() {
        browser.runtime.onMessage.addListener(Core.handleMessage);
    };

    private static async handleMessage(message: AllMessageTypes, sender: browser.runtime.MessageSender) {
        switch (message.type) {
            case 'start': return Core.loadScripts(sender.tab?.id as number);
            case 'error': return Core.showErrorNotification((message as ErrorMessage).error);
            default: return;
        };
    };

    private static loadScripts(id: number) {
        return browser.scripting.executeScript({
            files: ['./modules/game.js', './modules/keys.js'],
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

Core.start();