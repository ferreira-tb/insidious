'use strict';
////// EVENTOS
browser.runtime.onMessage.addListener((message) => {
    return new Promise((resolve, reject) => {
        if (message.name?.startsWith('storage-')) {
            const commandName = message.name.replace('storage-', '');
            switch (commandName) {
                case 'set':
                    browser.storage.local.set(message.value)
                        .then(() => resolve())
                        .catch((err) => reject(err));
                    break;

                case 'get':
                    browser.storage.local.get(message.key)
                        .then((result) => resolve(result))
                        .catch((err) => reject(err));
                    break;
                case 'remove':
                    browser.storage.local.remove(message.key)
                        .then(() => resolve())
                        .catch((err) => reject(err));
                    break;
            };
        };
    });
});

browser.action.onClicked.addListener(() => browser.storage.local.clear());

let currentTab;
browser.tabs.onActivated.addListener(async () => {
    currentTab = await browser.tabs.query({ currentWindow: true, active: true, url: '*://*.tribalwars.com.br/*' });
});