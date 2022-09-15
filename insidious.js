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
        },

        remove: (key) => {
            return new Promise((resolve, reject) => {
                browser.runtime.sendMessage({ name: 'storage-remove', key: key })
                    .then(() => resolve())
                    .catch((err) => reject(err));
            });
        }
    };

    // Inicia a extensão.
    static async #start() {
        Object.freeze(this.#storage);

        if (location.pathname === '\/game.php') {
            // Faz download dos dados necessários para executar a extensão.
            await this.#fetch();
                
            // Adiciona as ferramentas da extensão de acordo com a página na qual o usuário está.
            const currentScreen = Utils.currentScreen();
            if (currentScreen.startsWith('map')) {
                TWMap.open();             
            } else {
                switch (currentScreen) {
                    case 'am_farm': TWFarm.open();
                        break;
                };
            };
        };
    };

    static async #fetch() {
        try {
            // Caso o plunder esteja ativo, impede que a função continue.
            const plunderStatus = await this.#storage.get('isPlunderActive');
            if (plunderStatus.isPlunderActive === true) return;

            // Verifica qual foi a hora do último fetch.
            const now = new Date().getTime();
            const lastFetch = [
                await this.#storage.get('worldConfigFetch'),
                await this.#storage.get('worldDataFetch')
            ];

            // Informa a data do último fetch na barra inferior, onde se encontra a hora do servidor.
            if (lastFetch[1].worldDataFetch) {
                const lastFetchInfo = document.createElement('span');
                lastFetchInfo.setAttribute('id', 'insidious_lastFetchInfo');
                const hourFormat = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
                lastFetchInfo.innerText = `Insidious: ${new Date(lastFetch[1].worldDataFetch).toLocaleDateString('pt-br', hourFormat)} @ `;

                const serverInfo = document.querySelector('p.server_info:not(#insidious_lastFetchInfo)');
                if (!serverInfo) throw new ElementError({ class: 'p.server_info' });
                serverInfo.insertBefore(lastFetchInfo, serverInfo.firstChild);
            };
            
            // Salva as configurações do mundo, caso ainda não estejam.
            if (!lastFetch[0].worldConfigFetch) {
                await this.#storage.set({ worldConfigFetch: now });

                const configSource = [
                    { name: 'config', url: TWAssets.world.get_config },
                    { name: 'unit', url: TWAssets.world.get_unit_info }
                ];

                const worldConfigData = await Promise.all(configSource.map((source) => {
                    return new Promise((resolve, reject) => {
                        const worldConfigRequest = new XMLHttpRequest();
                        worldConfigRequest.timeout = 2000;

                        // Para detalhes sobre os códigos de status HTTP:
                        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
                        worldConfigRequest.addEventListener("error", (e) => reject(worldConfigRequest.status));
                        worldConfigRequest.addEventListener("timeout", (e) => reject(worldConfigRequest.status));
                        worldConfigRequest.addEventListener("load", (e) => {
                            this.#parseXML(worldConfigRequest.responseXML.documentElement, { name: source.name })
                                .then((result) => resolve({ name: source.name, result: result }))
                                .catch((err) => reject(err));
                        });

                        worldConfigRequest.open('GET', source.url, true);
                        worldConfigRequest.send();
                    });
                }));

                Promise.all(worldConfigData.map((config) => {
                    return new Promise((resolve, reject) => {
                        this.#storage.set({ [config.name]: config.result })
                            .then(() => resolve())
                            .catch((err) => reject(err));
                    });

                })).catch((err) => {
                    console.error(err);
                    this.#storage.remove('worldConfigFetch');
                });
            };
            
            // Caso o registro seja antigo ou não exista, faz um novo fetch.
            if (!lastFetch[1].worldDataFetch || now - lastFetch[1].worldDataFetch > (3600000 * 3)) {
                await this.#storage.set({ worldDataFetch: now });

                const villages = await new Promise((resolve, reject) => {
                    fetch(TWAssets.world.village)
                        .then((raw) => raw.text())
                        .then((text) => resolve(text.split(/\r?\n/)))
                        .catch((err) => reject(err));
                });

                Promise.allSettled(villages.map((village) => {
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

    static #parseXML(configXML, options) {
        return new Promise((resolve, reject) => {
            const getValue = (value) => {
                return Number(configXML.querySelector(value).textContent);
            };

            if (options.name === 'config') {
                const worldConfigSchema = {
                    speed: getValue('speed'),
                    unit_speed: getValue('unit_speed'),
                    moral: getValue('moral'),
                    game: { archer: getValue('archer') }
                };

                if (!worldConfigSchema.speed) {
                    reject(new InsidiousError(`Erro na leitura do documento XML (${options.name}).`))
                } else {
                    resolve(worldConfigSchema);
                };
                
            } else if (options.name === 'unit') {
                const worldConfigSchema = {
                    spear: { speed: getValue('spear speed'), carry: getValue('spear carry') },
                    sword: { speed: getValue('sword speed'), carry: getValue('sword carry') },
                    axe: { speed: getValue('axe speed'), carry: getValue('axe carry') },
                    spy: { speed: getValue('spy speed'), carry: getValue('spy carry') },
                    light: { speed: getValue('light speed'), carry: getValue('light carry') },
                    heavy: { speed: getValue('heavy speed'), carry: getValue('heavy carry') },
                    ram: { speed: getValue('ram speed'), carry: getValue('ram carry') },
                    catapult: { speed: getValue('catapult speed'), carry: getValue('catapult carry') },
                    knight: { speed: getValue('knight speed'), carry: getValue('knight carry') },
                    snob: { speed: getValue('snob speed'), carry: getValue('snob carry') }
                };

                if (!worldConfigSchema.spear.speed) {
                    reject(new InsidiousError(`Erro na leitura do documento XML (${options.name}).`))
                } else {
                    resolve(worldConfigSchema);
                };
            };

            reject(new InsidiousError('O nome do documento XML é inválido.'));
        });
    };

    static get storage() {return this.#storage};
    static get start() {return this.#start};
};

// Usado quando um elemento do DOM original não está mais acessível.
// Isso pode ocorrer devido a mudanças feitas pelos desenvolvedores do jogo.
class ElementError extends Error {
    constructor(options) {
        super();

        this.name = 'ElementError';
        this.tag = options.tag ?? '###';
        this.id = options.id ?? '###';
        this.class = options.class ?? '###';

        this.message = `TAG: ${this.tag}, ID: ${this.id}, CLASS: ${this.class}`;
    };
};

class InsidiousError extends Error {
    constructor(message) {
        super();

        this.name = 'InsidiousError';
        this.message = message;
    };
};

Insidious.start();