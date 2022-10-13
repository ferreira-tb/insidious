class Insidious {
    /** Inicia a extensão. */
    static async start() {
        try {
            // Inicia os scripts de apoio.
            await browser.runtime.sendMessage({ type: 'start' });
            Game.verifyIntegrity();

            // Faz download dos dados necessários para executar a extensão.
            await this.fetch();
            await Game.setGameInfo();

            // Aciona as ferramentas da extensão de acordo com a janela na qual o usuário está.
            switch (Game.screen) {
                case 'am_farm': await TWFarm.open();
                    break;
                case 'map': await TWMap.open();
                    break;
                case 'overview': this.setAsActiveWorld();
                    break;
                case 'overview_villages': await TWOverview.open();
                    break;
            };

            // Executa operações que estejam pendentes.
            await Defer.promises();

            // Verifica o status do Shield e o inicia se estiver ativado.
            const shieldStatus = await Store.get(Keys.shield) as boolean | undefined;
            if (shieldStatus === true) {
                TWShield.start();
            } else if (shieldStatus === undefined) {
                await Store.set({ [Keys.shield]: true });
                TWShield.start();
            };

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    /** Atualiza os dados sobre o jogo. */
    static updateGameData() {
        return new Promise<void>((resolve, reject) => {
            const startCtrl = new AbortController();
            window.addEventListener('message', (e) => {
                if (e?.data?.direction === 'from-tribalwars') {
                    startCtrl.abort();
                    if (!e.data.game_data) reject(new InsidiousError('Não foi possível iniciar o Insidious.'));
                    this.#raw_game_data = e.data.game_data;
                    resolve();
                };
            }, { signal: startCtrl.signal });

            const message: WindowMessage = {
                direction: 'from-insidious',
                reason: 'get-game-data'
            };

            window.postMessage(message);
        });
    };

    private static async fetch() {
        try {
            /** Intervalo (em horas) entre cada operação fetch. */
            let fetchInterval = await Store.get(Keys.fetchInterval) as number ?? 24;
            if (!Number.isInteger(fetchInterval)) {
                fetchInterval = 24;
                await Store.set({ [Keys.fetchInterval]: 24 });
            };

            // Verifica qual foi a hora do último fetch.
            const now: number = new Date().getTime();
            const lastConfigFetch = await Store.get(Keys.worldConfig) as number | undefined;
            const lastDataFetch = await Store.get(Keys.worldData) as number | undefined;

            // Informa a data do último fetch na barra inferior, onde se encontra a hora do servidor.
            if (lastDataFetch) {
                const lastFetchInfo = new Manatsu('span', { id: 'insidious_lastFetchInfo' }).create();
                lastFetchInfo.textContent = `Insidious: ${new Date(lastDataFetch).toLocaleDateString('pt-br', {
                    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                })} @ `;

                const serverInfo = document.querySelector('p.server_info');
                if (!serverInfo) throw new InsidiousError('DOM: p.server_info');
                serverInfo.insertBefore(lastFetchInfo, serverInfo.firstChild);  // Não se deve usar firstElementChild aqui.
            };

            // Caso o plunder esteja ativo, impede que a função continue.
            if (await Store.get(Keys.plunder) === true) return;
            
            // Salva as configurações do mundo, caso ainda não estejam.
            if (lastConfigFetch === undefined) {
                await Store.set({ [Keys.worldConfig]: now });

                const configSource = [
                    { name: Keys.config, url: TWAssets.world.get_config },
                    { name: Keys.unit, url: TWAssets.world.get_unit_info }
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
                                this.parseXML(worldConfigRequest.responseXML.documentElement, { name: source.name })
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
                        Store.set({ [config.name]: config.result })
                })).catch((err) => {
                    if (err instanceof Error) {
                        InsidiousError.handle(err);
                        Store.remove(Keys.worldConfig);
                    };
                });
            };
            
            // Caso o registro seja antigo ou não exista, faz um novo fetch.
            if (!lastDataFetch || now - lastDataFetch > (3600000 * fetchInterval)) {
                await Store.set({ [Keys.worldData]: now });

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
                            await Store.set({ [`v${thisID}_${Game.world}`]: villageInfo });
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

    private static parseXML(configXML: Element, options: { name: string }) {
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

            if (options.name === `config_${Game.world}`) {
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
                
            } else if (options.name === `unit_${Game.world}`) {
                const unitInfoSchema = { };
                for (const unit of TWAssets.list.all_units_archer) {
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

    /** Define o mundo atual como ativo e o registra como sendo o último acessado. */
    private static async setAsActiveWorld() {
        try {
            let activeWorlds = await Store.get(Keys.activeWorlds) as Map<string, number> | undefined;
            if (activeWorlds === undefined) activeWorlds = new Map();

            const now = new Date().getTime();
            activeWorlds.set(Game.world as string, now);
            Store.set({ [Keys.activeWorlds]: activeWorlds })
                .then(() => Store.set({ [Keys.lastWorld]: Game.world }))
                .catch((err: unknown) => {
                    if (err instanceof Error) InsidiousError.handle(err);
                });

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    /** Dados ainda sem tratamento, obtidos diretamente do jogo. */
    static #raw_game_data: TribalWarsGameData;
    static get raw_game_data() {return this.#raw_game_data};
};