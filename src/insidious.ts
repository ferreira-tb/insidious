class Insidious {
    static #worldInfo: { [index: string]: WorldInfo };
    static #unitInfo: { [index: string]: UnitInfo };
    static readonly world: string | null = Utils.currentWorld();
    static readonly currentScreen: string | null = Utils.currentScreen();
    static readonly currentVillageID: string | null = Utils.currentVillage();
    
    // Inicia a extensão.
    static async #start() {
        try {
            if (location.pathname === '\/game.php') {
                if (this.world === null) throw new InsidiousError('Não foi possível identificar o mundo atual.');

                // Faz download dos dados necessários para executar a extensão.
                await this.#fetch();

                // Armazena as configurações do mundo para que as outras classes tenham acesso.
                this.#worldInfo = await browser.storage.local.get(`config_${this.world}`);
                this.#unitInfo = await browser.storage.local.get(`unit_${this.world}`);
                if (!this.#worldInfo[`config_${this.world}`] || !this.#unitInfo[`unit_${this.world}`]) {
                    await browser.storage.local.remove(`worldConfigFetch_${this.world}`);
                };
      
                // Adiciona as ferramentas da extensão de acordo com a página na qual o usuário está.
                if (!this.currentScreen) throw new InsidiousError('Não foi possível identificar a janela atual.');
                if (this.currentScreen.startsWith('map')) {
                    await TWMap.open();
                } else {
                    switch (this.currentScreen) {
                        case 'am_farm': await TWFarm.open();
                            break;
                        case 'overview_villages': await TWOverview.open();
                            break;
                    };
                };

                // Executa operações que estejam pendentes.
                await Defer.promises();

                // Verifica o status do Shield e o inicia se estiver ativado.
                const shieldKey = `isShieldActive_${Insidious.world}`;
                const shieldStatus = (await browser.storage.local.get(shieldKey))[shieldKey] as boolean | undefined;
                if (shieldStatus === undefined) {
                    await browser.storage.local.set({ [shieldKey]: true });
                    TWShield.start();
                } else if (shieldStatus === true) {
                    TWShield.start();
                };
            };

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    static async #fetch() {
        try {
            // Verifica qual foi a hora do último fetch.
            const now: number = new Date().getTime();
            const lastConfigFetch: SNObject = await browser.storage.local.get(`worldConfigFetch_${this.world}`);
            const lastDataFetch: SNObject = await browser.storage.local.get(`worldDataFetch_${this.world}`);

            // Informa a data do último fetch na barra inferior, onde se encontra a hora do servidor.
            if (lastDataFetch[`worldDataFetch_${this.world}`]) {
                const lastFetchInfo = new Manatsu('span', { id: 'insidious_lastFetchInfo' }).create();
                lastFetchInfo.textContent = `Insidious: ${new Date(lastDataFetch[`worldDataFetch_${this.world}`]).toLocaleDateString('pt-br', {
                    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                })} @ `;

                const serverInfo = document.querySelector('p.server_info');
                if (!serverInfo) throw new InsidiousError('DOM: p.server_info');
                serverInfo.insertBefore(lastFetchInfo, serverInfo.firstChild);  // Não se deve usar firstElementChild aqui.
            };

            // Caso o plunder esteja ativo, impede que a função continue.
            const plunderStatus: SBObject = await browser.storage.local.get(`isPlunderActive_${this.world}`);
            if (plunderStatus[`isPlunderActive_${this.world}`] === true) return;
            
            // Salva as configurações do mundo, caso ainda não estejam.
            if (!lastConfigFetch[`worldConfigFetch_${this.world}`]) {
                await browser.storage.local.set({ [`worldConfigFetch_${this.world}`]: now });

                const configSource = [
                    { name: `config_${this.world}`, url: TWAssets.world.get_config },
                    { name: `unit_${this.world}`, url: TWAssets.world.get_unit_info }
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
                        InsidiousError.handle(err);
                        browser.storage.local.remove(`worldConfigFetch_${this.world}`);
                    };
                });
            };
            
            // Caso o registro seja antigo ou não exista, faz um novo fetch.
            if (!lastDataFetch[`worldDataFetch_${this.world}`] || now - lastDataFetch[`worldDataFetch_${this.world}`] > (3600000 * 24)) {
                await browser.storage.local.set({ [`worldDataFetch_${this.world}`]: now });

                Utils.modal('Aguarde');
                const modalWindow = document.querySelector('#insidious_modal');
                if (!modalWindow) throw new InsidiousError('Não foi possível criar a janela modal.');
                modalWindow.setAttribute('style', 'cursor: wait;');

                // Elementos do modal.
                const progressInfo = new Manatsu({
                    id: 'insidious_progressInfo',
                    text: 'Obtendo dados do servidor.'
                }, modalWindow).create();

                const percentageInfo = new Manatsu({ id: 'insidious_percentageInfo' }, modalWindow).create();

                // Faz download do arquivo contendo a lista de aldeias.
                const villages: string[] = await new Promise((resolve, reject) => {
                    fetch(TWAssets.world.village)
                        .then((raw) => raw.text())
                        .then((text) => resolve(text.split(/\r?\n/)))
                        .catch((err: unknown) => reject(err));
                });

                // Calcula a porcentagem de aldeias processadas.
                let settledPromises = 0;
                const calcPercentage = () => ((++settledPromises / villages.length) * 100).toFixed(1);

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
                            await browser.storage.local.set({ [`v${thisID}_${this.world}`]: villageInfo });
                            progressInfo.textContent = `${villageName} (${otherData[1]}|${otherData[2]})`;
                            resolve();

                        } catch (err) {
                            reject(err);

                        } finally {
                            percentageInfo.textContent = `${calcPercentage()}%`;
                        };
                    });

                })).then((results) => {
                    modalWindow.removeAttribute('style');
                    modalWindow.removeChild(percentageInfo);

                    const modalh1 = document.querySelector('#insidious_modal_h1');
                    if (modalh1) modalh1.textContent = 'Concluído';

                    // Remove o estilo do cursor.
                    const villageProgressInfo = document.querySelector('#insidious_progressInfo');
                    if (villageProgressInfo) {
                        villageProgressInfo.removeAttribute('style');
                        villageProgressInfo.textContent = `${results.length} aldeias processadas.`;
                    };

                    const logButtonArea = new Manatsu(modalWindow).create();
                    new Manatsu('button', { style: 'margin: 10px 5px 5px 5px;', text: 'Fechar' }, logButtonArea).create()
                        .addEventListener('click', () => {
                            document.querySelector('#insidious_blurBG')?.dispatchEvent(new Event('closemodal'));
                        });
                });
            };

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    static #parseXML(configXML: Element, options: { name: string }) {
        return new Promise((resolve, reject) => {
            const getValue = (value: string): number => {
                const valueField = configXML.querySelector(value);
                if (!valueField) {
                    // Caso não exista campo para arqueiros, assume que o mundo não possui arqueiros.
                    if (value.includes('archer')) {
                        return 0;
                    } else {
                        throw new InsidiousError(`O campo \"${value}\" não foi encontrado no documento XML.`);
                    };
                };

                if (valueField.textContent === null) throw new InsidiousError(`O campo \"${value}\" foi encontrado no documento XML, mas está vazio.`);
                return Number.parseFloat(valueField.textContent);
            };

            if (options.name === `config_${this.world}`) {
                const worldInfoSchema: WorldInfo = {
                    speed: getValue('speed'),
                    unit_speed: getValue('unit_speed'),
                    game: { archer: getValue('archer') }
                };

                if (!Object.hasOwn(worldInfoSchema, 'speed')) {
                    reject(new InsidiousError(`Erro na leitura do documento XML (${options.name}).`))
                } else {
                    resolve(worldInfoSchema);
                };
                
            } else if (options.name === `unit_${this.world}`) {
                const unitList: UnitList[] = [
                    'spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'
                ];

                const unitInfoSchema = { };
                for (const unit of unitList) {
                    Object.defineProperty(unitInfoSchema, unit, {
                        value: {
                            speed: getValue(`${unit} speed`),
                            carry: getValue(`${unit} carry`)
                        },
                        enumerable: true
                    });
                };

                if (!Object.hasOwn(unitInfoSchema, 'spear')) {
                    reject(new InsidiousError(`Erro na leitura do documento XML (${options.name}).`))
                } else {
                    resolve(unitInfoSchema);
                };
            };

            reject(new InsidiousError('O nome do documento XML é inválido.'));
        });
    };

    static get worldInfo() {return this.#worldInfo};
    static get unitInfo() {return this.#unitInfo};
    static get start() {return this.#start};
};

Insidious.start();