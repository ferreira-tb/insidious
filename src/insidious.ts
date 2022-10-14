class Insidious {
    /** Inicia a extensão. */
    static async start() {
        try {
            // Inicia os scripts de apoio.
            await browser.runtime.sendMessage({ type: 'start' });
            Game.verifyIntegrity();
            // Faz download dos dados necessários para executar a extensão.
            await this.fetchWorldInfo();
            // Armazena as informações obtidas em propriedades da classe Game.
            await Game.setWorldInfo();

            // Aciona as ferramentas da extensão de acordo com a janela na qual o usuário está.
            switch (Game.screen) {
                case 'am_farm': await TWFarm.open();
                    break;
                case 'overview': await this.setAsActiveWorld();
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

    private static async fetchWorldInfo() {
        try {
            // Verifica se as configurações do mundo atual foram salvas.
            // Em caso negativo, faz download dos arquivos XML.
            if (!(await Store.get(Keys.worldConfig))) {
                const configSource = [
                    { name: Keys.config, url: TWAssets.info.get_config },
                    { name: Keys.unit, url: TWAssets.info.get_unit_info }
                ];

                const worldConfigData = await Promise.all(configSource.map((source) => {
                    return new Promise((resolve, reject) => {
                        const request = new XMLHttpRequest();
                        request.timeout = 2000;

                        request.addEventListener("error", () => reject(request.status));
                        request.addEventListener("timeout", () => reject(request.status));
                        request.addEventListener("load", () => {
                            if (request.responseXML) {
                                const result = this.parseXML(request.responseXML.documentElement, source.name);
                                resolve({ name: source.name, result: result });

                            } else {
                                reject(new InsidiousError('\"XMLHttpRequest.responseXML\" não está presente.'));
                            };
                        });

                        request.open('GET', source.url, true);
                        request.send();
                    });
                }));

                await Promise.all(worldConfigData.map((config: { name: string, result: any }) => {
                    Store.set({ [config.name]: config.result });
                }));

                await Store.set({ [Keys.worldConfig]: true });
            };

        } catch (err) {
            await Store.remove(Keys.worldConfig);
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    private static parseXML(configXML: Element, type: XMLType ) {
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

            if (valueField.textContent === null) {
                throw new InsidiousError(`O campo \"${value}\" foi encontrado no documento XML, mas está vazio.`)
            };

            return Number.parseFloat(valueField.textContent);
        };

        if (type === Keys.config) {
            const worldInfoSchema: WorldInfo = {
                speed: getValue('speed'),
                unit_speed: getValue('unit_speed'),
                game: { archer: getValue('archer') }
            };

            if (!Object.hasOwn(worldInfoSchema, 'speed')) {
                throw new InsidiousError(`Erro na leitura do documento XML (${type}).`);
            } else {
                return worldInfoSchema;
            };
            
        } else if (type === Keys.unit) {
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
                throw new InsidiousError(`Erro na leitura do documento XML (${type}).`);
            } else {
                return unitInfoSchema;
            };
        };

        throw new InsidiousError('O nome do documento XML é inválido.');
    };

    /** Define o mundo atual como ativo e o registra como sendo o último acessado. */
    private static async setAsActiveWorld() {
        try {
            const activeWorlds = await Store.get(Keys.activeWorlds) as SNObject ?? { };
            activeWorlds[Game.world] = new Date().getTime();

            await Store.set({ [Keys.activeWorlds]: activeWorlds });
            await Store.set({ [Keys.lastWorld]: Game.world });

        } catch (err) {
            if (err instanceof Error) InsidiousError.handle(err);
        };
    };

    /** Dados, ainda sem tratamento, obtidos diretamente do jogo. */
    static #raw_game_data: TribalWarsGameData;
    static get raw_game_data() {return this.#raw_game_data};
};