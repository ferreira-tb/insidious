class Insidious {
    static worldInfo: WorldInfo;
    static unitInfo: UnitInfo;
    /** Mundo atual. */
    static readonly world: string | null = Utils.currentWorld();
    /** ID da aldeia atual. */
    static readonly village: string | null = Utils.currentVillage();
    /** Janela atual. */
    static readonly #screen: string | null = Utils.currentScreen();
    
    /** CHAVE: intervalo (em horas) entre cada Insidius.fetch() (fetchInterval). */
    static readonly fetchKey = `fetchInterval`;
    /** CHAVE: data do último fetch das configurações do mundo atual (worldConfigFetch). */
    static readonly worldConfigKey = `worldConfigFetch_${this.world}`;
    /** CHAVE: data do último fetch das informações sobre o estado atual do mundo (worldDataFetch). */
    static readonly worldDataKey = `worldDataFetch_${this.world}`;
    /** CHAVE: configurações do mundo atual (config). */
    static readonly configKey = `config_${this.world}`;
    /** CHAVE: detalhes sobre as unidades do jogo (unit). */
    static readonly unitKey = `unit_${this.world}`;
    /** CHAVE: último mundo acessado pelo jogador (lastWorld). */
    static readonly lastWorldKey = `lastWorld`;
    /** CHAVE: mundos nos quais o jogador está ativo (activeWorlds). */
    static readonly activeWorldsKey = `activeWorlds`;
    
    /** Intervalo (em horas) entre cada Insidious.fetch(). */
    static #fetchInterval: number = 24;

    // Inicia a extensão.
    static async start() {
        try {
            if (location.pathname === '\/game.php') {
                if (this.world === null) throw new InsidiousError('Não foi possível identificar o mundo atual.');
                if (this.#screen === 'overview') await this.setAsActiveWorld();

                // Faz download dos dados necessários para executar a extensão.
                await this.fetch();

                // Armazena as configurações do mundo para que as outras classes tenham acesso.
                // A coerção de tipo está sendo feita porquê logo após ela há uma verificação do valor das variáveis.
                this.worldInfo = await Store.get(this.configKey) as WorldInfo;
                this.unitInfo = await Store.get(this.unitKey) as UnitInfo;
                if (!this.worldInfo || !this.unitInfo) await Store.remove(this.worldConfigKey);
      
                // Adiciona as ferramentas da extensão de acordo com a página na qual o usuário está.
                if (!this.#screen) throw new InsidiousError('Não foi possível identificar a janela atual.');
                if (this.#screen.startsWith('map')) {
                    await TWMap.open();
                } else {
                    switch (this.#screen) {
                        case 'am_farm': await TWFarm.open();
                            break;
                        case 'overview_villages': await TWOverview.open();
                            break;
                    };
                };

                // Executa operações que estejam pendentes.
                await Defer.promises();

                // Verifica o status do Shield e o inicia se estiver ativado.
                const shieldStatus = await Store.get(TWShield.key) as boolean | undefined;
                if (shieldStatus === true) {
                    TWShield.start();
                } else if (shieldStatus === undefined) {
                    await Store.set({ [TWShield.key]: true });
                    TWShield.start();
                };
            };

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    private static async fetch() {
        try {
            /** Intervalo (em horas) entre cada operação fetch. */
            const fetchInterval = await Store.get(this.fetchKey) as number | undefined;
            if (!fetchInterval || !Number.isInteger(fetchInterval)) {
                await Store.set({ [this.fetchKey]: 24 });
            } else {
                this.#fetchInterval = fetchInterval;
            };

            // Verifica qual foi a hora do último fetch.
            const now: number = new Date().getTime();
            const lastConfigFetch = await Store.get(this.worldConfigKey) as number | undefined;
            const lastDataFetch = await Store.get(this.worldDataKey) as number | undefined;

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
            if (await Store.get(Plunder.key) === true) return;
            
            // Salva as configurações do mundo, caso ainda não estejam.
            if (lastConfigFetch === undefined) {
                await Store.set({ [this.worldConfigKey]: now });

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
                        Store.remove(this.worldConfigKey);
                    };
                });
            };
            
            // Caso o registro seja antigo ou não exista, faz um novo fetch.
            if (!lastDataFetch || now - lastDataFetch > (3600000 * this.#fetchInterval)) {
                await Store.set({ [this.worldDataKey]: now });

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
                            await Store.set({ [`v${thisID}_${this.world}`]: villageInfo });
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

    /** Define o mundo atual como ativo e o registra como sendo o último acessado. */
    private static async setAsActiveWorld() {
        let activeWorlds = await Store.get(this.activeWorldsKey) as Map<string, number> | undefined;
        if (activeWorlds === undefined) activeWorlds = new Map();

        const now = new Date().getTime();
        activeWorlds.set(this.world as string, now);
        Store.set({ [this.activeWorldsKey]: activeWorlds })
            .then(() => Store.set({ [this.lastWorldKey]: this.world }))
            .catch((err: unknown) => {
                if (err instanceof Error) InsidiousError.handle(err);
            });
    };
};