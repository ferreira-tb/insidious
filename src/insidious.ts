class Insidious {
    static #storage = {
        // Precisa ser um objeto.
        set: (value) => {
            return new Promise((resolve, reject) => {
                browser.runtime.sendMessage({ name: 'storage-set', value: value })
                    .then(() => resolve())
                    .catch((err) => reject(err));
            });
        },

        get: (key: string | string[]) => {
            return new Promise((resolve, reject) => {
                browser.runtime.sendMessage({ name: 'storage-get', key: key })
                    .then((result) => resolve(result))
                    .catch((err) => reject(err));           
            });
        },

        remove: (key: string | string[]) => {
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
            if (currentScreen?.startsWith('map')) {
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

                const serverInfo = document.querySelector('p.server_info');
                if (!serverInfo) throw new ElementError({ class: 'p.server_info' });
                serverInfo.insertBefore(lastFetchInfo, serverInfo.firstChild);  // Não se deve usar firstElementChild aqui.
            };

            // Caso o plunder esteja ativo, impede que a função continue.
            const plunderStatus = await this.#storage.get('isPlunderActive');
            if (plunderStatus.isPlunderActive === true) return;
            
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
            if (!lastFetch[1].worldDataFetch || now - lastFetch[1].worldDataFetch > (3600000 * 1.2)) {
                await this.#storage.set({ worldDataFetch: now });

                Utils.modal('Aguarde');
                new Manatsu({
                    id: 'insidious_progressInfo',
                    style: 'cursor: wait;',
                    text: 'Obtendo dados do servidor.'
                }, document.querySelector('#insidious_modal')).create();

                const villages: string[] = await new Promise((resolve, reject) => {
                    fetch(TWAssets.world.village)
                        .then((raw) => raw.text())
                        .then((text) => resolve(text.split(/\r?\n/)))
                        .catch((err) => reject(err));
                });

                // Registro de erros.
                const errorLog: string[] = [];
                // É usado para filtrar mensagens recebidas do background.
                const fetchEventTarget = new EventTarget();
                // Cria uma porta para comunicação com o background durante o processamento das promises.
                const fetchPort = browser.runtime.connect({ name: 'insidious-set' });
                fetchPort.onMessage.addListener((message) => {
                    if (message.err) {
                        errorLog.push(message.err);
                        fetchEventTarget.dispatchEvent(new Event('err' + message.id));
                    } else {
                        fetchEventTarget.dispatchEvent(new Event(message.id));
                    };
                });

                Promise.allSettled(villages.map((village) => {
                    return new Promise((resolve, reject) => {
                        const thisID = village.slice(0, village.indexOf(','));
                        const otherData = (village.replace(thisID + ',', '')).split(',');
                        
                        const villageName = Utils.urlDecode(otherData[0]);
                        const villageInfo = {
                            name: villageName,
                            x: parseInt(otherData[1], 10),
                            y: parseInt(otherData[2], 10),
                            player: parseInt(otherData[3], 10),
                            points: parseInt(otherData[4], 10),
                            rank: parseInt(otherData[5], 10)
                        };

                        const promiseCtrl = new AbortController();
                        fetchEventTarget.addEventListener(thisID, () => {
                            promiseCtrl.abort();
                            if (!document.querySelector('#insidious_progressInfo')) {
                                new Manatsu({ id: 'insidious_progressInfo' }, document.querySelector('#insidious_modal')).create();
                                document.querySelector('#insidious_modal').setAttribute('style', 'cursor: wait;');
                            };
                        
                            document.querySelector('#insidious_progressInfo').innerText = `${villageName} (${otherData[1]}|${otherData[2]})`;
                            resolve();
                        }, { signal: promiseCtrl.signal });

                        fetchEventTarget.addEventListener('err' + thisID, () => {
                            promiseCtrl.abort();
                            reject();
                        }, { signal: promiseCtrl.signal });

                        fetchPort.postMessage({ id: thisID, value: { ['village' + thisID]: villageInfo } });
                    });

                })).then((results) => {
                    fetchPort.disconnect();

                    document.querySelector('#insidious_modal').removeAttribute('style');
                    document.querySelector('#insidious_modal_h1').innerText = 'Concluído';

                    // Remove o estilo do cursor.
                    const villageProgressInfo = document.querySelector('#insidious_progressInfo');
                    villageProgressInfo.innerText = `${results.length} aldeias processadas.`;
                    villageProgressInfo.removeAttribute('style');

                    // Cria uma área para os botões.
                    const logButtonArea = new Manatsu(document.querySelector('#insidious_modal')).create();

                    // Casos alguma promise tenha sido rejeitada, informa a quantidade.
                    // Além disso, oferece uma opção para verificar os erros no console.                  
                    if (errorLog.length > 0) {
                        new Manatsu({ text: `${errorLog.length} erros.` }, logButtonArea).create();

                        // Cria um botão que permite listar os erros no console do navegador.
                        new Manatsu('button', { style: 'margin: 10px 5px 5px 5px;', text: 'Relatório' }, logButtonArea).create()
                            .addEventListener('click', () => {
                                for (const err of errorLog) console.log(err);
                            });
                    };

                    new Manatsu('button', { style: 'margin: 10px 5px 5px 5px;', text: 'Fechar' }, logButtonArea).create()
                        .addEventListener('click', () => {
                            document.querySelector('#insidious_blurBG').dispatchEvent(new Event('closemodal'));
                        });
                });
            };

        } catch (err) {
            console.error(err);
        };
    };

    static #parseXML(configXML, options: { name: string }) {
        return new Promise((resolve, reject) => {
            const getValue = (value: string): number => {
                return parseFloat(configXML.querySelector(value).textContent);
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
    tag: string | undefined;
    id: string | undefined;
    class: string | undefined;
    attribute: string | undefined;
    
    constructor(options: { tag?: string, id?: string, class?: string, attribute?: string }) {
        super();

        this.name = 'ElementError';
        this.message = '';

        this.tag = options.tag;
        this.id = options.id;
        this.class = options.class;
        this.attribute = options.attribute;
        
        for (const [key, value] of Object.entries(options)) {
            this.message += `${key}: ${value} `;
        };
    };
};

class InsidiousError extends Error {
    constructor(message: string) {
        super();

        this.name = 'InsidiousError';
        this.message = message;
    };
};

Insidious.start();