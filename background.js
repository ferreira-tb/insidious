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

// Porta para comunicação prolongada.
browser.runtime.onConnect.addListener((port) => {
    if (port.name === 'insidious-set') {
        const insidiousPort = port;
        insidiousPort.onMessage.addListener((message) => {
            browser.storage.local.set(message.value)
                .then(() => insidiousPort.postMessage({ id: message.id }))
                .catch((err) => insidiousPort.postMessage({ id: message.id, err: err }));
        });
    };
});

browser.action.onClicked.addListener(() => browser.storage.local.clear());