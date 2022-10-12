class Core {
    static start() {
        this.createListeners();
    };

    private static createListeners() {
        browser.runtime.onMessage.addListener((message: AllMessageTypes) => {
            return this.handleMessage(message);
        });
    };

    private static async handleMessage(message: AllMessageTypes) {
        switch (message.type) {
            case 'error': return this.showErrorNotification((message as ErrorMessage).error);
            default: return;
        };
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