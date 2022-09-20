browser.runtime.onMessage.addListener((message: BackgroundListener) => {
    return new Promise<void>((resolve, reject) => {
        if (message.name?.startsWith('storage-')) {
            const commandName = message.name.replace('storage-', '');
            switch (commandName) {
                case 'set':
                    if (!message.value) reject();
                    browser.storage.local.set(message.value)
                        .then(() => resolve())
                        .catch((err: unknown) => reject(err));
                    break;

                case 'get':
                    if (!message.key) reject();
                    browser.storage.local.get(message.key)
                        .then((result: any) => resolve(result))
                        .catch((err: unknown) => reject(err));
                    break;

                case 'remove':
                    if (!message.key) reject();
                    browser.storage.local.remove(message.key)
                        .then(() => resolve())
                        .catch((err: unknown) => reject(err));
                    break;
            };

        } else {
            reject();
        };
    });
});

// Porta para comunicação prolongada.
browser.runtime.onConnect.addListener((port: any) => {
    if (port.name === 'insidious-set') {
        const insidiousPort = port;
        insidiousPort.onMessage.addListener((message: PortMessage) => {
            browser.storage.local.set(message.value)
                .then(() => insidiousPort.postMessage({ id: message.id }))
                .catch((err: unknown) => insidiousPort.postMessage({ id: message.id, err: err }));
        });
    };
});

browser.action.onClicked.addListener(() => browser.storage.local.clear());