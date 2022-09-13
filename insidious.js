'use strict';
class Insidious {
    static #storage = {
        // Value precisa ser um objeto.
        set: (value) => {
            return new Promise((resolve, reject) => {
                browser.runtime.sendMessage({ name: 'storage-set', value: value })
                    .then(() => resolve())
                    .catch((err) => reject(err));  
            });
        },

        // Key pode ser uma string ou uma array de strings.
        get: (key) => {
            return new Promise((resolve, reject) => {
                browser.runtime.sendMessage({ name: 'storage-get', key: key })
                    .then((result) => resolve(result))
                    .catch((err) => reject(err));           
            });
        }
    };

    // Inicia a extensão.
    static async #start() {
        Object.freeze(this.#storage);

        if (location.pathname === '\/game.php') {
            try {
                // Faz download dos dados necessários para executar a extensão.
                await this.#fetch();
                
                const fields = (location.search.replace('\?', '')).split('\&');
                const screen = () => {
                    for (const item of fields) {
                        if (item.includes('screen=')) return item.replace('screen=', '');
                    };
                };

                // Adiciona as ferramentas da extensão de acordo com a página na qual o usuário está.
                if (screen().startsWith('map')) TWMap.open();

            } catch (err) {
                console.error(err);
            }; 
        };
    };

    static async #fetch() {
        try {
            // Verifica qual foi a hora do último fetch.
            const result = await this.#storage.get('lastFetch');
            const now = new Date().getTime();
            console.log(await this.#storage.get('village16799'));

            // Caso não haja registro ou ele tenha sido feito há mais de três horas, faz um novo fetch.
            if (!result.lastFetch || now - result.lastFetch > (3600000 * 3)) {
                await this.#storage.set({ lastFetch: now });

                const villages = await new Promise((resolve, reject) => {
                    fetch(location.origin + '\/map\/village.txt')
                        .then((raw) => raw.text())
                        .then((text) => resolve(text.split(/\r?\n/)))
                        .catch((err) => reject(err));
                });

                await Promise.all(villages.map((village) => {
                    return new Promise((resolve, reject) => {
                        const thisID = village.slice(0, village.indexOf(','));
                        const otherData = (village.replace(thisID + ',', '')).split(',');
                        const villageInfo = {
                            name: Utils.urlDecode(otherData[0]),
                            x: Number(otherData[1]),
                            y: Number(otherData[2]),
                            player: Number(otherData[3]),
                            points: Number(otherData[4]),
                            rank: Number(otherData[5])
                        };

                        this.#storage.set({ ['village' + thisID]: villageInfo })
                            .then(() => resolve())
                            .catch((err) => reject(err));
                    });
                }));
            };

        } catch (err) {
            console.error(err);
        };
    };

    static get storage() {return this.#storage};
    static get start() {return this.#start};
};

Insidious.start();