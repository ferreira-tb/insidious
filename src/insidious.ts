class Insidious {
    // Inicia a extensão.
    static async #start() {
        try {
            if (location.pathname === '\/game.php') {
                // Faz download dos dados necessários para executar a extensão.
                await this.#fetch();

                // Armazena as configurações do mundo para que as outras classes tenham acesso.
                this.#worldInfo = await browser.storage.local.get('config');
                this.#unitInfo = await browser.storage.local.get('unit');
                if (!this.#worldInfo.config || !this.#unitInfo.unit) {
                    await browser.storage.local.remove('worldConfigFetch');
                };
                
                // Adiciona as ferramentas da extensão de acordo com a página na qual o usuário está.
                const currentScreen: string | null = Utils.currentScreen();
                if (!currentScreen) throw new InsidiousError('Não foi possível identificar a janela atual.');

                if (currentScreen.startsWith('map')) {
                    TWMap.open();             
                } else {
                    switch (currentScreen) {
                        case 'am_farm': await TWFarm.open();
                            break;
                    };
                };
            };

        } catch (err) {
            if (err instanceof Error) console.error(err);      
        };
    };

    static async #fetch() {
        try {
            // Verifica qual foi a hora do último fetch.
            const now: number = new Date().getTime();
            const lastConfigFetch: { worldConfigFetch: number } = await browser.storage.local.get('worldConfigFetch');
            const lastDataFetch: { worldDataFetch: number } = await browser.storage.local.get('worldDataFetch');

            // Informa a data do último fetch na barra inferior, onde se encontra a hora do servidor.
            if (lastDataFetch.worldDataFetch) {
                const lastFetchInfo = new Manatsu('span', { id: 'insidious_lastFetchInfo' }).create();
                lastFetchInfo.textContent = `Insidious: ${new Date(lastDataFetch.worldDataFetch).toLocaleDateString('pt-br', {
                    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                })} @ `;

                const serverInfo = document.querySelector('p.server_info');
                if (!serverInfo) throw new InsidiousError('DOM: p.server_info');
                serverInfo.insertBefore(lastFetchInfo, serverInfo.firstChild);  // Não se deve usar firstElementChild aqui.
            };

            // Caso o plunder esteja ativo, impede que a função continue.
            const plunderStatus: { isPlunderActive: boolean } = await browser.storage.local.get('isPlunderActive');
            if (plunderStatus.isPlunderActive === true) return;
            
            // Salva as configurações do mundo, caso ainda não estejam.
            if (!lastConfigFetch.worldConfigFetch) {
                await browser.storage.local.set({ worldConfigFetch: now });

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
                        worldConfigRequest.addEventListener("error", () => reject(worldConfigRequest.status));
                        worldConfigRequest.addEventListener("timeout", () => reject(worldConfigRequest.status));
                        worldConfigRequest.addEventListener("load", () => {
                            if (worldConfigRequest.responseXML) {
                                this.#parseXML(worldConfigRequest.responseXML.documentElement, { name: source.name })
                                    .then((result) => resolve({ name: source.name, result: result }))
                                    .catch((err: unknown) => reject(err));
                            } else {
                                reject(new InsidiousError('\"XMLHttpRequest.responseXML\" não está presente.'));
                            };
                        });

                        worldConfigRequest.open('GET', source.url, true);
                        worldConfigRequest.send();
                    });
                }));

                Promise.all(worldConfigData.map((config: { name: string, result: any }) => {
                        browser.storage.local.set({ [config.name]: config.result })
                })).catch((err) => {
                    if (err instanceof Error) {
                        console.error(err);
                        browser.storage.local.remove('worldConfigFetch');
                    };
                });
            };
            
            // Caso o registro seja antigo ou não exista, faz um novo fetch.
            if (!lastDataFetch.worldDataFetch || now - lastDataFetch.worldDataFetch > (3600000 * 5)) {
                await browser.storage.local.set({ worldDataFetch: now });

                Utils.modal('Aguarde');
                const modalWindow = document.querySelector('#insidious_modal');
                if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal (#insidious_modal).');
                modalWindow.setAttribute('style', 'cursor: wait;');

                let progressInfo = new Manatsu({
                    id: 'insidious_progressInfo',
                    style: 'cursor: wait;',
                    text: 'Obtendo dados do servidor.'
                }, modalWindow).create();

                const villages: string[] = await new Promise((resolve, reject) => {
                    fetch(TWAssets.world.village)
                        .then((raw) => raw.text())
                        .then((text) => resolve(text.split(/\r?\n/)))
                        .catch((err: unknown) => reject(err));
                });

                // Armazena individualmente as aldeias no banco de dados.
                Promise.allSettled(villages.map((village) => {
                    return new Promise<void>(async (resolve, reject) => {
                        const thisID = village.slice(0, village.indexOf(','));
                        const otherData = (village.replace(thisID + ',', '')).split(',');
                        
                        const villageName: string = Utils.urlDecode(otherData[0]);
                        const villageInfo: VillageInfo = {
                            name: villageName,
                            x: Number.parseInt(otherData[1], 10),
                            y: Number.parseInt(otherData[2], 10),
                            player: Number.parseInt(otherData[3], 10),
                            points: Number.parseInt(otherData[4], 10),
                            rank: Number.parseInt(otherData[5], 10)
                        };
                    
                        try {
                            await browser.storage.local.set({ ['village' + thisID]: villageInfo })
                            progressInfo.textContent = `${villageName} (${otherData[1]}|${otherData[2]})`;
                            resolve();

                        } catch (err) {
                            reject(err);
                        };              
                    });

                })).then((results) => {
                    modalWindow?.removeAttribute('style');
                    const modalh1 = document.querySelector('#insidious_modal_h1');
                    if (modalh1) modalh1.textContent = 'Concluído';

                    // Remove o estilo do cursor.
                    const villageProgressInfo = document.querySelector('#insidious_progressInfo');
                    if (villageProgressInfo) {
                        villageProgressInfo.removeAttribute('style');
                        villageProgressInfo.textContent = `${results.length} aldeias processadas.`;
                    };

                    const logButtonArea = new Manatsu(document.querySelector('#insidious_modal')).create();
                    new Manatsu('button', { style: 'margin: 10px 5px 5px 5px;', text: 'Fechar' }, logButtonArea).create()
                        .addEventListener('click', () => {
                            document.querySelector('#insidious_blurBG')?.dispatchEvent(new Event('closemodal'));
                        });
                });
            };

        } catch (err) {
            if (err instanceof Error) console.error(err);
        };
    };

    static #parseXML(configXML: Element, options: { name: string }) {
        return new Promise((resolve, reject) => {
            const getValue = (value: string): number => {
                const valueField = configXML.querySelector(value);
                if (!valueField) throw new InsidiousError(`O campo \"${value}\" não foi encontrado no documento XML.`);
                if (valueField.textContent === null) throw new InsidiousError(`O campo \"${value}\" foi encontrado no documento XML, mas está vazio.`);
                return Number.parseFloat(valueField.textContent);
            };

            if (options.name === 'config') {
                const worldConfigSchema = {
                    speed: getValue('speed'),
                    unit_speed: getValue('unit_speed'),
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

    static #worldInfo: any;
    static #unitInfo: any;

    static get worldInfo() {return this.#worldInfo};
    static get unitInfo() {return this.#unitInfo};
    static get start() {return this.#start};
};

class InsidiousError extends Error {
    constructor(message: string) {
        super();

        this.name = 'InsidiousError';
        this.message = message;
    };
};

Insidious.start();